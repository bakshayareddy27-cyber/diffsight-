"""Semantic AST analysis: signature extraction, contract diffing, call-site validation."""
import ast
from collections.abc import Callable
from dataclasses import dataclass

from .schemas import CallIssue, Change, Param, Signature

POSITIONAL = ("posonly", "pos_or_kw")
VARIADIC = ("var_pos", "var_kw")
FUNCS = (ast.FunctionDef, ast.AsyncFunctionDef)


@dataclass
class Parsed:
    tree: ast.Module | None
    symbols: dict[str, Signature]
    error: str | None = None


def module_name(path: str) -> str:
    stem = path.replace("\\", "/").removesuffix(".py")
    parts = [p for p in stem.split("/") if p]
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _param(arg: ast.arg, kind: str, required: bool) -> Param:
    annotation = ast.unparse(arg.annotation) if arg.annotation else None
    return Param(name=arg.arg, kind=kind, required=required, annotation=annotation)


def extract_signature(node: ast.FunctionDef | ast.AsyncFunctionDef, symbol: str, is_method: bool) -> Signature:
    a = node.args
    positional = a.posonlyargs + a.args
    first_default = len(positional) - len(a.defaults)
    params: list[Param] = []
    for i, arg in enumerate(positional):
        kind = "posonly" if i < len(a.posonlyargs) else "pos_or_kw"
        params.append(_param(arg, kind, i < first_default))
    if a.vararg:
        params.append(_param(a.vararg, "var_pos", False))
    for arg, default in zip(a.kwonlyargs, a.kw_defaults):
        params.append(_param(arg, "kw_only", default is None))
    if a.kwarg:
        params.append(_param(a.kwarg, "var_kw", False))
    if is_method and params and params[0].name in ("self", "cls"):
        params = params[1:]
    return Signature(
        symbol=symbol,
        params=params,
        returns=ast.unparse(node.returns) if node.returns else None,
        is_async=isinstance(node, ast.AsyncFunctionDef),
        is_method=is_method,
        line=node.lineno,
    )


def parse_source(source: str) -> Parsed:
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return Parsed(None, {}, f"line {exc.lineno}: {exc.msg}")
    symbols: dict[str, Signature] = {}
    for node in tree.body:
        if isinstance(node, FUNCS):
            symbols[node.name] = extract_signature(node, node.name, False)
        elif isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, FUNCS):
                    name = f"{node.name}.{item.name}"
                    symbols[name] = extract_signature(item, name, True)
    return Parsed(tree, symbols)


def render_signature(sig: Signature) -> str:
    parts: list[str] = []
    has_var_pos = any(p.kind == "var_pos" for p in sig.params)
    last_posonly = max((i for i, p in enumerate(sig.params) if p.kind == "posonly"), default=-1)
    star_emitted = False
    for i, p in enumerate(sig.params):
        if p.kind == "kw_only" and not has_var_pos and not star_emitted:
            parts.append("*")
            star_emitted = True
        text = {"var_pos": "*", "var_kw": "**"}.get(p.kind, "") + p.name
        if p.annotation:
            text += f": {p.annotation}"
        if not p.required and p.kind not in VARIADIC:
            text += " = ..."
        parts.append(text)
        if i == last_posonly:
            parts.append("/")
    prefix = "async def" if sig.is_async else "def"
    returns = f" -> {sig.returns}" if sig.returns else ""
    return f"{prefix} {sig.symbol.rsplit('.', 1)[-1]}({', '.join(parts)}){returns}"


def syntax_change(path: str, error: str) -> Change:
    return Change(
        id=f"{path}::syntax::0", file=path, symbol="<module>", kind="syntax_error",
        severity="critical", breaking=True, message=f"Head revision does not parse ({error}).",
        base_sig=None, head_sig=None, line=1,
    )


Adder = Callable[[str, str, str, bool, str, Signature | None, Signature | None, int], None]


def diff_signatures(path: str, base: dict[str, Signature], head: dict[str, Signature]) -> list[Change]:
    out: list[Change] = []

    def add(symbol, kind, severity, breaking, message, old, new, line):
        out.append(Change(
            id=f"{path}::{symbol}::{kind}::{len(out)}", file=path, symbol=symbol, kind=kind,
            severity=severity, breaking=breaking, message=message,
            base_sig=render_signature(old) if old else None,
            head_sig=render_signature(new) if new else None, line=line,
        ))

    for symbol, old in base.items():
        new = head.get(symbol)
        if new is None:
            public = not symbol.rsplit(".", 1)[-1].startswith("_") or symbol.endswith("__init__")
            add(symbol, "symbol_removed", "critical" if public else "medium", public,
                f"`{symbol}` no longer exists; every caller will fail.", old, None, old.line)
        else:
            _diff_pair(symbol, old, new, add)
    for symbol, new in head.items():
        if symbol not in base:
            add(symbol, "symbol_added", "info", False, f"`{symbol}` was added.", None, new, new.line)
    return out


def _diff_pair(symbol: str, old: Signature, new: Signature, add: Adder) -> None:
    line = new.line
    old_by = {p.name: p for p in old.params}
    new_by = {p.name: p for p in new.params}
    removed = [p for p in old.params if p.name not in new_by]
    added = [p for p in new.params if p.name not in old_by]

    if len(removed) == 1 and len(added) == 1 and removed[0].kind == added[0].kind:
        same_slot = old.params.index(removed[0]) == new.params.index(added[0])
        if same_slot:
            r, a = removed[0], added[0]
            breaking = r.kind != "posonly"
            add(symbol, "param_renamed", "high" if breaking else "low", breaking,
                f"Parameter `{r.name}` was renamed to `{a.name}`; keyword callers break.", old, new, line)
            removed, added = [], []

    for p in removed:
        add(symbol, "param_removed", "high", True, f"Parameter `{p.name}` was removed.", old, new, line)
    for p in added:
        if p.required and p.kind not in VARIADIC:
            add(symbol, "required_param_added", "critical", True,
                f"New required parameter `{p.name}`; existing callers do not pass it.", old, new, line)
        else:
            add(symbol, "optional_param_added", "info", False,
                f"Optional parameter `{p.name}` was added.", old, new, line)

    old_order = [p.name for p in old.params if p.kind in POSITIONAL and p.name in new_by]
    new_order = [p.name for p in new.params if p.kind in POSITIONAL and p.name in old_by]
    if old_order != new_order:
        add(symbol, "param_reordered", "high", True,
            "Positional parameters were reordered; positional callers now bind to the wrong arguments.",
            old, new, line)

    for name, n in new_by.items():
        o = old_by.get(name)
        if o is None:
            continue
        if not o.required and n.required and n.kind not in VARIADIC:
            add(symbol, "default_removed", "high", True,
                f"Parameter `{name}` lost its default and is now required.", old, new, line)
        if o.kind != n.kind:
            narrowed = o.kind == "pos_or_kw"
            add(symbol, "param_kind_changed", "high" if narrowed else "low", narrowed,
                f"Parameter `{name}` changed from {o.kind} to {n.kind}.", old, new, line)
        if o.annotation != n.annotation:
            add(symbol, "annotation_changed", "medium", False,
                f"Type of `{name}` changed from {o.annotation or 'untyped'} to {n.annotation or 'untyped'}.",
                old, new, line)

    if old.returns != new.returns:
        add(symbol, "return_type_changed", "medium", False,
            f"Return type changed from {old.returns or 'untyped'} to {new.returns or 'untyped'}.", old, new, line)
    if old.is_async != new.is_async:
        add(symbol, "async_changed", "critical", True,
            "Function switched between sync and async; callers must change how they invoke it.", old, new, line)


def _local_names(tree: ast.Module) -> list[str]:
    return [n.name for n in tree.body if isinstance(n, (*FUNCS, ast.ClassDef))]


def collect_imports(path: str, tree: ast.Module, mods: dict[str, str]):
    """Return (bindings, imports). bindings maps a local dotted name to (target_path, symbol|None);
    imports maps each imported in-PR file to the set of symbols imported from it."""
    bindings: dict[str, tuple[str, str | None]] = {name: (path, name) for name in _local_names(tree)}
    imports: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                target = mods.get(alias.name)
                if target:
                    bindings[alias.asname or alias.name] = (target, None)
                    imports.setdefault(target, set())
        elif isinstance(node, ast.ImportFrom):
            pkg = module_name(path).split(".")[: -node.level] if node.level else []
            base = ".".join(pkg + ([node.module] if node.module else []))
            for alias in node.names:
                local = alias.asname or alias.name
                sub = mods.get(f"{base}.{alias.name}" if base else alias.name)
                if sub:
                    bindings[local] = (sub, None)
                    imports.setdefault(sub, set())
                elif base in mods:
                    bindings[local] = (mods[base], alias.name)
                    imports.setdefault(mods[base], set()).add(alias.name)
    imports.pop(path, None)
    return bindings, imports


def _dotted(node: ast.AST) -> str | None:
    parts: list[str] = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
        return ".".join(reversed(parts))
    return None


def _resolve_call(call: ast.Call, bindings: dict[str, tuple[str, str | None]]):
    name = _dotted(call.func)
    if not name:
        return None
    bound = bindings.get(name)
    if bound and bound[1]:
        return bound
    if "." in name:
        prefix, attr = name.rsplit(".", 1)
        module = bindings.get(prefix)
        if module and module[1] is None:
            return module[0], attr
    return None


def check_call(call: ast.Call, sig: Signature) -> list[str]:
    starred = any(isinstance(a, ast.Starred) for a in call.args)
    splat = any(k.arg is None for k in call.keywords)
    slots = [p for p in sig.params if p.kind in POSITIONAL]
    has_var_pos = any(p.kind == "var_pos" for p in sig.params)
    has_var_kw = any(p.kind == "var_kw" for p in sig.params)
    problems: list[str] = []
    if not starred and len(call.args) > len(slots) and not has_var_pos:
        problems.append(f"passes {len(call.args)} positional arguments but accepts {len(slots)}")
    bound = set() if starred else {p.name for p in slots[: len(call.args)]}
    keywords = {k.arg for k in call.keywords if k.arg}
    keyword_ok = {p.name for p in sig.params if p.kind in ("pos_or_kw", "kw_only")}
    for name in sorted(keywords):
        if name in bound:
            problems.append(f"got multiple values for `{name}`")
        elif name not in keyword_ok and not has_var_kw:
            problems.append(f"unexpected keyword `{name}`")
    if not starred and not splat:
        missing = [
            p.name for p in sig.params
            if p.required and p.kind not in VARIADIC and p.name not in bound and p.name not in keywords
        ]
        if missing:
            problems.append("missing required " + ", ".join(f"`{m}`" for m in missing))
    return problems


def call_issues(
    path: str,
    tree: ast.Module,
    source: str,
    bindings: dict[str, tuple[str, str | None]],
    head_sigs: dict[str, dict[str, Signature]],
    breaking_index: dict[tuple[str, str], list[Change]],
    edges: dict[tuple[str, str], set[str]],
) -> list[CallIssue]:
    lines = source.splitlines()
    found: list[CallIssue] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        target = _resolve_call(node, bindings)
        if not target:
            continue
        target_path, symbol = target
        for candidate in (symbol, f"{symbol}.__init__"):
            changes = breaking_index.get((target_path, candidate))
            if not changes:
                continue
            if target_path != path:
                edges.setdefault((path, target_path), set()).add(symbol)
            sig = head_sigs.get(target_path, {}).get(candidate)
            problems = [f"`{candidate}` no longer exists"] if sig is None else check_call(node, sig)
            if problems:
                snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                found.append(CallIssue(
                    id=f"{path}:{node.lineno}:{node.col_offset}:{candidate}",
                    change_id=changes[0].id, file=path, line=node.lineno, symbol=candidate,
                    problem="; ".join(problems), snippet=snippet,
                ))
            break
    return found
