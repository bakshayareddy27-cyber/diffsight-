"""Multi-agent risk pipeline: Parser -> Contract -> Dependency -> Impact -> Risk."""
import asyncio
import math
import time
from collections.abc import AsyncIterator

from . import ast_analyzer as tools
from .schemas import CallIssue, Change, GraphEdge, GraphNode, PullRequest, Report, Severity, Stats

SEVERITY_WEIGHT = {"critical": 40, "high": 25, "medium": 10, "low": 4, "info": 0}
SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]
ISSUE_WEIGHT = 12
PROPAGATION = 0.35


def _step(agent: str, status: str, message: str) -> dict:
    return {"type": "agent", "agent": agent, "status": status, "message": message}


def _level(score: float) -> Severity:
    if score >= 70:
        return "critical"
    if score >= 45:
        return "high"
    if score >= 20:
        return "medium"
    return "low"


def _parse_pair(file):
    return tools.parse_source(file.base), tools.parse_source(file.head)


def _depths(paths: list[str], deps: dict[str, set[str]]) -> dict[str, int]:
    memo: dict[str, int] = {}

    def depth(node: str, stack: set[str]) -> int:
        if node in memo:
            return memo[node]
        if node in stack:
            return 0
        stack.add(node)
        value = 1 + max((depth(d, stack) for d in deps.get(node, ())), default=-1)
        stack.discard(node)
        memo[node] = value
        return value

    return {p: depth(p, set()) for p in paths}


async def run_pipeline(pr: PullRequest) -> AsyncIterator[dict]:
    started = time.perf_counter()
    paths = [f.path for f in pr.files]
    sources = {f.path: f.head for f in pr.files}

    yield _step("Parser", "running", f"Parsing {len(paths)} files into syntax trees")
    pairs = await asyncio.gather(*(asyncio.to_thread(_parse_pair, f) for f in pr.files))
    parsed = dict(zip(paths, pairs))
    yield _step("Parser", "done", f"Built {2 * len(paths)} syntax trees")

    yield _step("Contract", "running", "Diffing function contracts on the AST")
    changes: list[Change] = []
    compared = 0
    for path, (base, head) in parsed.items():
        if head.error:
            changes.append(tools.syntax_change(path, head.error))
            continue
        compared += len(base.symbols.keys() | head.symbols.keys())
        changes.extend(tools.diff_signatures(path, base.symbols, head.symbols))
    breaking = [c for c in changes if c.breaking]
    yield _step("Contract", "done", f"{len(changes)} changes, {len(breaking)} breaking")

    yield _step("Dependency", "running", "Resolving imports into a dependency graph")
    mods = {tools.module_name(f.path): f.path for f in pr.files if f.head.strip()}
    bindings: dict[str, dict] = {}
    edge_symbols: dict[tuple[str, str], set[str]] = {}
    for path, (_, head) in parsed.items():
        if head.tree is None:
            continue
        bindings[path], imports = tools.collect_imports(path, head.tree, mods)
        for target, symbols in imports.items():
            edge_symbols.setdefault((path, target), set()).update(symbols)
    deps: dict[str, set[str]] = {p: set() for p in paths}
    for source, target in edge_symbols:
        deps[source].add(target)
    depths = _depths(paths, deps)
    yield _step("Dependency", "done", f"{len(edge_symbols)} import edges across {len(mods)} modules")

    yield _step("Impact", "running", "Validating every call site against new contracts")
    breaking_index: dict[tuple[str, str], list[Change]] = {}
    for c in breaking:
        breaking_index.setdefault((c.file, c.symbol), []).append(c)
    head_sigs = {p: h.symbols for p, (_, h) in parsed.items()}
    issues: list[CallIssue] = []
    for path, (_, head) in parsed.items():
        if head.tree is not None:
            issues.extend(tools.call_issues(
                path, head.tree, sources[path], bindings[path], head_sigs, breaking_index, edge_symbols))
    yield _step("Impact", "done", f"{len(issues)} broken call sites")

    yield _step("Risk", "running", "Scoring files and propagating risk through the graph")
    raw = dict.fromkeys(paths, 0.0)
    for c in changes:
        raw[c.file] += SEVERITY_WEIGHT[c.severity]
    for i in issues:
        raw[i.file] += ISSUE_WEIGHT
    own = {p: 100 * (1 - math.exp(-r / 60)) for p, r in raw.items()}

    breaking_symbols: dict[str, set[str]] = {}
    for c in breaking:
        breaking_symbols.setdefault(c.file, set()).update({c.symbol, c.symbol.split(".")[0]})
    edges = [
        GraphEdge(source=s, target=t, symbols=sorted(sy), risky=bool(sy & breaking_symbols.get(t, set())))
        for (s, t), sy in edge_symbols.items()
    ]
    score = dict(own)
    for path in sorted(paths, key=lambda p: depths[p]):
        inherited = sum(PROPAGATION * score[e.target] for e in edges if e.source == path and e.risky)
        score[path] = min(100.0, own[path] + inherited)

    nodes = [
        GraphNode(
            id=p, depth=depths[p], score=round(score[p], 1), level=_level(score[p]),
            breaking=sum(1 for c in breaking if c.file == p),
            issues=sum(1 for i in issues if i.file == p),
        )
        for p in paths
    ]
    values = list(score.values())
    overall = round(0.7 * max(values) + 0.3 * sum(values) / len(values), 1)
    if not breaking:
        verdict = "No breaking contract changes detected. Safe to merge from an API-compatibility standpoint."
    elif issues:
        verdict = f"{len(breaking)} breaking contract changes break {len(issues)} call sites. Block the merge until callers are updated."
    else:
        verdict = f"{len(breaking)} breaking contract changes, but no in-repo callers break. Confirm there are no external consumers."
    changes.sort(key=lambda c: (SEVERITY_ORDER.index(c.severity), c.file, c.line))
    yield _step("Risk", "done", f"Overall risk {overall}")

    report = Report(
        title=pr.title, score=overall, level=_level(overall), verdict=verdict, changes=changes,
        issues=issues, nodes=nodes, edges=edges,
        stats=Stats(
            files=len(paths), symbols_compared=compared, breaking=len(breaking),
            broken_calls=len(issues), duration_ms=int((time.perf_counter() - started) * 1000),
        ),
    )
    yield {"type": "report", "report": report.model_dump()}
