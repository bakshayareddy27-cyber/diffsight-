from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["critical", "high", "medium", "low", "info"]
ParamKind = Literal["posonly", "pos_or_kw", "kw_only", "var_pos", "var_kw"]


class FileVersion(BaseModel):
    path: str = Field(..., min_length=1, max_length=512)
    base: str = Field(default="", max_length=500_000)
    head: str = Field(default="", max_length=500_000)


class PullRequest(BaseModel):
    title: str = Field(default="Untitled pull request", max_length=500)
    files: list[FileVersion] = Field(min_length=1, max_length=200)


class Param(BaseModel):
    name: str
    kind: ParamKind
    required: bool
    annotation: str | None = None


class Signature(BaseModel):
    symbol: str
    params: list[Param]
    returns: str | None = None
    is_async: bool = False
    is_method: bool = False
    line: int = 1


class Change(BaseModel):
    id: str
    file: str
    symbol: str
    kind: str
    severity: Severity
    breaking: bool
    message: str
    base_sig: str | None = None
    head_sig: str | None = None
    line: int
    # Vulnerability intelligence fields
    vuln_category: str | None = None   # "security" | "injection" | "data_exposure"
    vuln_reason: str | None = None     # Human-readable heuristic explanation


class CallIssue(BaseModel):
    id: str
    change_id: str
    file: str
    line: int
    symbol: str
    problem: str
    snippet: str


class GraphNode(BaseModel):
    id: str
    depth: int
    score: float
    level: Severity
    breaking: int
    issues: int
    vuln_flags: list[str] = Field(default_factory=list)


class GraphEdge(BaseModel):
    source: str
    target: str
    symbols: list[str]
    risky: bool


class Stats(BaseModel):
    files: int
    symbols_compared: int
    breaking: int
    broken_calls: int
    duration_ms: int
    vuln_hits: int = 0


class Report(BaseModel):
    title: str
    score: float
    level: Severity
    verdict: str
    changes: list[Change]
    issues: list[CallIssue]
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    stats: Stats
