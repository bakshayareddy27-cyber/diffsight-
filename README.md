# DiffSight

> **Semantic pull request risk analysis for Python code changes.**

DiffSight analyzes changes between a **base** and **head** version of Python files and identifies contract-level changes that may break existing callers.

Instead of treating a pull request as a collection of changed lines, DiffSight analyzes the code structurally:

**Parse → Compare contracts → Resolve dependencies → Validate call sites → Score risk → Visualize**

The current implementation is a deterministic static-analysis pipeline built around Python's built-in `ast` module. It does **not** currently use an LLM, LangGraph, GitHub API, database, or automatic code modification.

---

## Table of Contents

* [What Problem Does DiffSight Solve?](#what-problem-does-diffsight-solve)
* [What DiffSight Currently Does](#what-diffsight-currently-does)
* [How the System Works](#how-the-system-works)
* [Analysis Pipeline](#analysis-pipeline)
* [1. Parser](#1-parser)
* [2. Contract Analysis](#2-contract-analysis)
* [3. Dependency Analysis](#3-dependency-analysis)
* [4. Impact Analysis](#4-impact-analysis)
* [5. Risk Scoring](#5-risk-scoring)
* [Output Report](#output-report)
* [Architecture](#architecture)
* [Repository Structure](#repository-structure)
* [Backend](#backend)
* [Frontend](#frontend)
* [WebSocket Protocol](#websocket-protocol)
* [Input Model](#input-model)
* [Supported Change Detection](#supported-change-detection)
* [Important Limitations](#important-limitations)
* [Running Locally](#running-locally)
* [Environment Variables](#environment-variables)
* [Production Deployment](#production-deployment)
* [Sample Analysis](#sample-analysis)
* [Technology Stack](#technology-stack)
* [Design Principles](#design-principles)
* [Current Status](#current-status)
* [Future Extensions](#future-extensions)

---

# What Problem Does DiffSight Solve?

A conventional code diff tells a developer **what lines changed**.

It does not necessarily tell them:

* whether a function's contract changed
* whether an existing caller is now invalid
* which files depend on the changed function
* how far the potential impact propagates
* which changes are likely to require attention before merging

For example, changing:

```python
def compute_total(items, tax_rate):
    ...
```

to:

```python
def compute_total(items, tax_rate, currency):
    ...
```

is more significant than simply adding a comment.

Existing callers that still invoke:

```python
compute_total(cart, rate)
```

now have a missing required argument.

DiffSight attempts to surface this kind of **semantic compatibility risk** automatically.

---

# What DiffSight Currently Does

The current implementation accepts a pull-request-like payload containing:

* a PR title
* one or more files
* the `base` source of each file
* the `head` source of each file

It then:

1. Parses both versions of every file into Python ASTs.
2. Extracts top-level functions and class methods.
3. Builds normalized function signatures.
4. Compares base and head signatures.
5. Detects supported contract changes.
6. Resolves imports between files included in the analysis.
7. Builds an in-repository dependency graph.
8. Finds certain call sites affected by changed contracts.
9. Calculates a deterministic risk score for each file.
10. Propagates risk through relevant dependency edges.
11. Produces a structured analysis report.
12. Streams pipeline progress to the frontend through WebSockets.
13. Visualizes the result as a dependency graph and risk report.

---

# How the System Works

```text
                    Pull Request Payload
                            │
                            ▼
                  ┌──────────────────┐
                  │      Parser      │
                  │  Base + Head AST │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │    Contract      │
                  │  AST signatures  │
                  │  Base vs Head    │
                  └────────┬─────────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
        ┌─────────────────┐  ┌─────────────────┐
        │   Dependency    │  │     Impact      │
        │ Import / Module │  │ Call-site check │
        │     Graph       │  │ against changed │
        └────────┬────────┘  │    contracts    │
                 │           └────────┬────────┘
                 └──────────┬──────────┘
                            ▼
                   ┌──────────────────┐
                   │       Risk       │
                   │   Score + Level  │
                   │    Propagation   │
                   └────────┬─────────┘
                            │
                            ▼
                     Analysis Report
                            │
                            ▼
              ┌─────────────────────────┐
              │      Next.js UI         │
              │                         │
              │  Risk Score             │
              │  Agent Timeline         │
              │  Dependency Graph       │
              │  Change Details         │
              │  Broken Call Sites      │
              └─────────────────────────┘
```

---

# Analysis Pipeline

DiffSight uses five sequential analysis stages.

```text
Parser
   ↓
Contract
   ↓
Dependency
   ↓
Impact
   ↓
Risk
```

These are called "agents" in the current UI and backend pipeline, but they are **deterministic analysis stages rather than LLM-based autonomous agents**.

---

# 1. Parser

### Source

`backend/app/ast_analyzer.py`

The parser uses Python's standard-library `ast` module.

For every input file, DiffSight parses:

```text
base source → AST
head source → AST
```

The parser extracts:

* top-level functions
* class methods
* parameter names
* parameter kinds
* required/optional status
* annotations
* return annotations
* async/sync status
* source line numbers

The extracted information is represented by the `Signature` and `Param` Pydantic models.

### Syntax errors

If the head revision cannot be parsed, DiffSight creates a critical breaking change:

```text
syntax_error
```

The analysis can therefore identify a syntactically invalid head revision without attempting semantic analysis of an unavailable AST.

---

# 2. Contract Analysis

### Source

`backend/app/ast_analyzer.py`

The base and head signatures are compared symbol-by-symbol.

DiffSight currently detects changes including:

* symbol removal
* parameter removal
* required parameter addition
* optional parameter addition
* parameter rename
* parameter reordering
* default removal
* parameter kind changes
* annotation changes
* return annotation changes
* sync/async changes
* symbol addition

Each detected change is represented by a `Change` object.

A change contains:

```text
file
symbol
kind
severity
breaking
message
base signature
head signature
line number
```

### Example

Base:

```python
def calculate(price, tax):
    ...
```

Head:

```python
def calculate(price, tax, currency):
    ...
```

DiffSight identifies:

```text
required_param_added
severity: critical
breaking: true
```

because existing callers do not provide the new required parameter.

---

# 3. Dependency Analysis

### Source

`backend/app/ast_analyzer.py`
`backend/app/agents.py`

DiffSight examines imports in the analyzed files and attempts to resolve imports to other files included in the current pull-request payload.

It supports analysis of patterns such as:

```python
from billing.pricing import calculate
```

and:

```python
import billing.pricing
```

The analyzer creates bindings that associate local names with:

```text
target file
target symbol
```

These relationships become dependency graph edges.

Each edge contains:

```text
source
target
symbols
risky
```

The graph is currently based on **imports between files present in the supplied analysis payload**.

---

# 4. Impact Analysis

### Source

`backend/app/ast_analyzer.py`

After detecting breaking contract changes, DiffSight examines call expressions in the head revision.

It attempts to resolve calls through the previously constructed import bindings.

For resolved calls, it checks whether the call is compatible with the new function signature.

The current call validation checks conditions such as:

* too many positional arguments
* unexpected keyword arguments
* duplicate positional/keyword binding
* missing required arguments

The result is represented as a `CallIssue`.

Each issue records:

```text
id
change_id
file
line
symbol
problem
snippet
```

This creates a relationship between:

```text
Changed contract
       ↓
Affected call site
```

---

# 5. Risk Scoring

### Source

`backend/app/agents.py`

DiffSight calculates risk deterministically.

The current severity weights are:

| Severity | Weight |
| -------- | -----: |
| Critical |     40 |
| High     |     25 |
| Medium   |     10 |
| Low      |      4 |
| Info     |      0 |

Each broken call-site issue adds:

```text
12 points
```

The raw file score is transformed using:

```text
own_score = 100 × (1 - exp(-raw_score / 60))
```

This produces a bounded score between 0 and 100.

---

## Risk Levels

The resulting score is mapped to:

|    Score | Level    |
| -------: | -------- |
|      70+ | Critical |
| 45–69.99 | High     |
| 20–44.99 | Medium   |
| below 20 | Low      |

These levels are deterministic thresholds defined in the backend.

---

## Dependency Risk Propagation

Risk can also propagate through relevant dependency edges.

The current propagation factor is:

```text
PROPAGATION = 0.35
```

For a file with a risky dependency, inherited risk is calculated from the target file's score:

```text
inherited risk =
    0.35 × target score
```

The file's final score is:

```text
final score =
    own score + inherited risk
```

with a maximum of 100.

Only edges marked as `risky` participate in this propagation.

---

## Overall Pull Request Score

The overall score combines:

```text
70% × highest file score
+
30% × average file score
```

This means the report considers both:

* the highest-risk file
* the overall distribution of risk across analyzed files

---

# Output Report

The backend returns a `Report` containing:

```text
title
score
level
verdict
changes
issues
nodes
edges
stats
```

### Statistics

The report also contains:

```text
files
symbols_compared
breaking
broken_calls
duration_ms
```

This allows the frontend to show both the qualitative result and measurable analysis information.

---

# Architecture

DiffSight is split into two applications.

```text
diffsight/
│
├── backend/
│   └── FastAPI + Python AST analysis
│
└── frontend/
    └── Next.js + React visualization
```

Communication occurs over WebSockets:

```text
Next.js frontend
       │
       │ WebSocket
       ▼
FastAPI backend
       │
       ▼
run_pipeline()
       │
       ├── Parser
       ├── Contract
       ├── Dependency
       ├── Impact
       └── Risk
       │
       ▼
JSON report
       │
       ▼
Next.js UI
```

---

# Repository Structure

```text
diffsight/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── agents.py
│   │   ├── ast_analyzer.py
│   │   ├── schemas.py
│   │   │
│   │   └── routers/
│   │       ├── __init__.py
│   │       └── analysis.py
│   │
│   ├── requirements.txt
│   ├── runtime.txt
│   ├── Procfile
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── AgentTimeline.tsx
│   │   ├── DependencyGraph.tsx
│   │   ├── RiskViewer.tsx
│   │   └── ScoreRing.tsx
│   │
│   ├── lib/
│   │   ├── sample.ts
│   │   ├── types.ts
│   │   ├── risk.ts
│   │   └── useAnalysis.ts
│   │
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── .env.example
│
├── render.yaml
├── push.ps1
└── .gitignore
```

---

# Backend

## `backend/app/main.py`

Creates the FastAPI application.

Responsibilities:

* initialize FastAPI
* configure CORS
* register the analysis router
* expose `/health`
* expose `/`

The API currently reports:

```text
DiffSight 0.1.0
```

---

## `backend/app/schemas.py`

Defines the data contracts shared by the backend pipeline.

Important models:

```text
FileVersion
PullRequest
Param
Signature
Change
CallIssue
GraphNode
GraphEdge
Stats
Report
```

Pydantic is used for validation.

The `PullRequest` model currently requires:

```text
1–200 files
```

per analysis request.

---

## `backend/app/ast_analyzer.py`

This is the core static-analysis module.

Responsibilities include:

* parsing Python
* extracting signatures
* rendering signatures
* comparing signatures
* detecting contract changes
* resolving module names
* collecting imports
* resolving calls
* validating call arguments

This module contains the majority of DiffSight's semantic analysis logic.

---

## `backend/app/agents.py`

Orchestrates the complete analysis pipeline.

Responsibilities:

1. parse files
2. compare contracts
3. build dependency relationships
4. identify call-site issues
5. calculate risk
6. build graph nodes and edges
7. generate the final report

It also emits progress events while each stage runs.

---

## `backend/app/routers/analysis.py`

Provides the WebSocket endpoint:

```text
/ws/analyze
```

The endpoint:

1. accepts the WebSocket connection
2. receives JSON
3. validates it using `PullRequest`
4. runs the analysis pipeline
5. streams progress events
6. sends the final report
7. sends structured errors when validation or analysis fails

---

# Frontend

The frontend is implemented with:

* Next.js 14
* React 18
* TypeScript
* Tailwind CSS
* Framer Motion
* `@xyflow/react`
* Lucide React

---

## `frontend/app/page.tsx`

This is the main application screen.

The current UI:

* displays the DiffSight header
* starts the sample analysis
* displays analysis progress
* displays errors
* displays the final risk score
* displays statistics
* displays the dependency graph
* displays detailed risk findings

### Current input behavior

The current UI runs:

```text
SAMPLE_PR
```

from:

```text
frontend/lib/sample.ts
```

The application does **not currently provide a GitHub PR URL/input form**.

---

# Frontend Components

## `AgentTimeline.tsx`

Displays progress emitted by the backend pipeline.

Stages currently shown:

```text
Parser
Contract
Dependency
Impact
Risk
```

---

## `DependencyGraph.tsx`

Uses React Flow (`@xyflow/react`) to visualize the analyzed file graph.

Each node displays:

* filename
* directory
* risk score
* number of breaking changes
* number of broken call sites

Edges represent dependency relationships.

Risky dependency edges are visually emphasized.

Clicking a node selects the corresponding file.

---

## `RiskViewer.tsx`

Displays contract changes and their associated call-site issues.

For each change it can show:

* severity
* symbol
* change type
* breaking status
* explanation
* base signature
* head signature
* file and line
* affected call sites

Selecting a dependency-graph node filters the displayed findings.

---

## `ScoreRing.tsx`

Displays the overall numerical risk score and corresponding risk level.

The score is clamped to:

```text
0–100
```

for presentation.

---

# WebSocket Protocol

The frontend connects to:

```text
/ws/analyze
```

using a WebSocket.

After connecting, the client sends a serialized `PullRequest`.

The server streams events.

---

## Agent Event

Example:

```json
{
  "type": "agent",
  "agent": "Parser",
  "status": "running",
  "message": "Parsing 4 files into syntax trees"
}
```

Completion example:

```json
{
  "type": "agent",
  "agent": "Parser",
  "status": "done",
  "message": "Built 8 syntax trees"
}
```

---

## Report Event

The final successful response has the structure:

```json
{
  "type": "report",
  "report": {
    "title": "...",
    "score": 72.4,
    "level": "critical",
    "verdict": "...",
    "changes": [],
    "issues": [],
    "nodes": [],
    "edges": [],
    "stats": {}
  }
}
```

---

## Error Event

Errors use:

```json
{
  "type": "error",
  "message": "..."
}
```

Validation errors and pipeline exceptions are converted into this format.

---

# Input Model

A request looks conceptually like:

```json
{
  "title": "Example pull request",
  "files": [
    {
      "path": "billing/pricing.py",
      "base": "def calculate(items, tax): ...",
      "head": "def calculate(items, tax, currency): ..."
    }
  ]
}
```

The backend accepts between 1 and 200 files.

Each file contains:

```text
path
base
head
```

The current system expects the source code itself rather than a Git repository URL.

---

# Supported Change Detection

The current implementation detects these contract-level changes:

| Change                       | Breaking?           |
| ---------------------------- | ------------------- |
| Public symbol removed        | Yes                 |
| Private symbol removed       | Usually no          |
| Required parameter added     | Yes                 |
| Parameter removed            | Yes                 |
| Parameter reordered          | Yes                 |
| Parameter renamed            | Usually yes         |
| Default removed              | Yes                 |
| Parameter kind changed       | Depending on change |
| Sync → async / async → sync  | Yes                 |
| Optional parameter added     | No                  |
| Symbol added                 | No                  |
| Parameter annotation changed | No                  |
| Return annotation changed    | No                  |

The exact behavior is determined by `diff_signatures()` and `_diff_pair()` in `ast_analyzer.py`.

---

# Important Limitations

DiffSight is currently a **Python static-analysis prototype**, not a complete production pull-request intelligence platform.

The following limitations are important.

## Python only

The parser uses Python's built-in `ast` module.

Other languages are not currently supported.

---

## Limited repository scope

Dependency resolution is based on modules represented by the supplied file payload.

DiffSight does not currently clone or inspect an arbitrary Git repository.

---

## No GitHub integration

The current implementation does not fetch pull requests directly from GitHub.

A caller must provide the base/head source content.

---

## No LLM

There is currently no:

* OpenAI API
* Anthropic API
* Gemini API
* local LLM
* embedding model

in the implementation.

The analysis is deterministic.

---

## No LangGraph

The current pipeline does not use LangGraph.

The term "agent" refers to the five analysis stages:

```text
Parser
Contract
Dependency
Impact
Risk
```

---

## No automatic patch generation

DiffSight reports detected issues but does not currently:

* modify source files
* generate patches
* create commits
* open pull requests
* automatically fix callers

---

## No test generation

The current implementation does not generate or execute regression tests.

---

## Call resolution is intentionally limited

The analyzer can resolve certain statically identifiable calls through imports and local bindings, but it is not a full Python type checker or interpreter.

Dynamic Python behavior may not be resolved.

Examples of difficult cases include:

* dynamic imports
* runtime monkey patching
* complex aliasing
* reflection
* dynamically assigned functions
* dependency injection
* runtime-generated attributes
* external packages not represented in the analyzed files

---

## Signature analysis is not behavioral analysis

DiffSight primarily reasons about **function contracts and call compatibility**.

A function can keep the same signature while changing its behavior internally.

For example:

```python
def calculate(x):
    return x * 2
```

changing to:

```python
def calculate(x):
    return x / 2
```

may introduce a serious behavioral regression, but the current contract analyzer does not infer that merely from the unchanged signature.

---

# Running Locally

## Prerequisites

Recommended environment:

* Python 3.12+
* Node.js 20+
* npm

---

## 1. Clone the repository

```bash
git clone https://github.com/bakshayareddy27-cyber/diffsight-.git
cd diffsight-
```

---

## 2. Start the backend

```bash
cd backend
python -m venv .venv
```

### Windows

```powershell
.venv\Scripts\Activate.ps1
```

### macOS / Linux

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

Health check:

```text
http://localhost:8000/health
```

---

## 3. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend normally runs at:

```text
http://localhost:3000
```

The default WebSocket endpoint is:

```text
ws://localhost:8000/ws/analyze
```

---

# Environment Variables

## Backend

Copy:

```text
backend/.env.example
```

to your local environment.

Important variables:

```text
DIFFSIGHT_ORIGINS=http://localhost:3000
HOST=0.0.0.0
PORT=8000
```

`DIFFSIGHT_ORIGINS` controls which frontend origins are allowed by the FastAPI CORS middleware.

---

## Frontend

Copy:

```text
frontend/.env.example
```

to:

```text
frontend/.env.local
```

The important variable is:

```text
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/analyze
```

For a TLS-enabled production deployment, the WebSocket URL should use:

```text
wss://
```

---

# Production Deployment

The repository contains:

```text
render.yaml
```

which defines two Render web services:

```text
diffsight-backend
diffsight-frontend
```

### Backend

Runtime:

```text
Python
```

Start command:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Health check:

```text
/health
```

### Frontend

Runtime:

```text
Node
```

Build:

```text
npm ci && npm run build
```

Start:

```text
node .next/standalone/server.js
```

Health check:

```text
/
```

The frontend connects to the backend using the configured `NEXT_PUBLIC_WS_URL`.

---

# Sample Analysis

The repository includes a built-in demonstration payload:

```text
frontend/lib/sample.ts
```

The sample contains files such as:

```text
billing/pricing.py
billing/checkout.py
api/orders.py
api/reports.py
```

The sample demonstrates a contract change in `billing/pricing.py` and dependent callers.

The frontend's **Analyze pull request** button currently runs this sample payload.

This sample is intended to demonstrate the complete analysis and visualization pipeline without requiring external GitHub integration.

---

# Technology Stack

## Backend

* Python
* FastAPI
* Pydantic
* Python `ast`
* Uvicorn
* WebSockets

## Frontend

* Next.js 14
* React 18
* TypeScript
* Tailwind CSS
* Framer Motion
* `@xyflow/react`
* Lucide React

## Deployment

* Render
* Python web service
* Node.js web service
* WebSocket communication

---

# Design Principles

## 1. Analyze structure, not only text

The system uses Python ASTs rather than relying solely on line-based string comparison.

---

## 2. Separate detection from presentation

The backend produces a structured `Report`.

The frontend is responsible for visualizing that report.

---

## 3. Deterministic analysis

Given the same input source versions, the analysis logic is deterministic.

This makes the current implementation easier to reason about and test than an unconstrained generative approach.

---

## 4. Explain why a change is risky

DiffSight does not only output a number.

It attempts to connect:

```text
change
   ↓
affected contract
   ↓
affected call site
   ↓
dependency relationship
   ↓
risk
```

The UI exposes these relationships to make the result inspectable.

---

# Current Status

### Implemented

* [x] Python AST parsing
* [x] Base/head comparison
* [x] Function signature extraction
* [x] Class method signature extraction
* [x] Contract change detection
* [x] Syntax error detection
* [x] Import/dependency resolution for supported in-analysis modules
* [x] Dependency graph generation
* [x] Call-site compatibility checks
* [x] Broken call-site reporting
* [x] Deterministic file risk scoring
* [x] Risk propagation
* [x] Overall PR risk score
* [x] WebSocket streaming
* [x] Structured report generation
* [x] Interactive dependency graph
* [x] Risk/change viewer
* [x] Sample PR demonstration
* [x] Render deployment configuration

### Not currently implemented

* [ ] Direct GitHub PR ingestion
* [ ] Git repository cloning
* [ ] Multi-language analysis
* [ ] LLM-based reasoning
* [ ] LangGraph orchestration
* [ ] Automatic fix generation
* [ ] Patch creation
* [ ] Regression test generation
* [ ] Regression test execution
* [ ] GitHub status/check integration
* [ ] Persistent analysis history
* [ ] Authentication
* [ ] Database-backed storage

---

# Future Extensions

Potential future versions could extend the existing architecture with:

```text
GitHub PR
    ↓
Repository / Diff ingestion
    ↓
Language-specific analyzers
    ↓
AST / symbol / dependency analysis
    ↓
Impact analysis
    ↓
Risk engine
    ↓
Optional LLM reasoning layer
    ↓
Human-readable explanation
    ↓
Optional suggested fix
    ↓
Developer approval
```

Possible future capabilities include:

* GitHub App integration
* multi-language AST analysis
* deeper symbol resolution
* behavioral change detection
* test impact analysis
* regression-test recommendations
* LLM-assisted explanations
* suggested patches
* CI/CD integration
* merge checks
* historical risk tracking

These are **future extensions and are not part of the current implementation**.

---

# Development Notes for Contributors and AI Coding Agents

If you are modifying this repository, treat the existing implementation as the source of truth.

## Core execution path

The primary backend execution path is:

```text
backend/app/routers/analysis.py
        ↓
backend/app/agents.py
        ↓
backend/app/ast_analyzer.py
        ↓
backend/app/schemas.py
```

The frontend execution path is:

```text
frontend/app/page.tsx
        ↓
frontend/lib/useAnalysis.ts
        ↓
WebSocket /ws/analyze
        ↓
Report
        ↓
frontend/components/*
```

## Important implementation boundaries

Do not assume that DiffSight currently has:

* an LLM
* LangGraph
* GitHub API access
* a database
* authentication
* automatic code modification
* test generation
* patch generation

unless those capabilities are explicitly added to the repository.

When extending the project, preserve the distinction between:

```text
CURRENT IMPLEMENTATION
```

and:

```text
PLANNED / FUTURE CAPABILITY
```

The existing deterministic AST pipeline should remain understandable and testable even if additional AI capabilities are introduced later.

---

# License

No license has currently been specified in the repository.
