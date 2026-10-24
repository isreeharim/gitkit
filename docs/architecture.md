# GitKit Architecture Specification

## Overview

GitKit is an edge-native, zero-AI repository inspection and visualization engine. It is architected for zero operational server costs, fast initial page loads, and modular extensibility.

---

## System Overview

```text
                               +-----------------------------+
                               |     Client Browser          |
                               | (Astro Pages + React Island)|
                               +--------------+--------------+
                                              |
                                              | Request / Query
                                              v
                               +-----------------------------+
                               | Cloudflare Workers Runtime  |
                               |  (Astro Server-Side Engine) |
                               +--------------+--------------+
                                              |
                        +---------------------+---------------------+
                        |                                           |
                        v                                           v
       +---------------------------------+         +---------------------------------+
       |         Git / GitHub            |         |       Static Analysis Core      |
       |  - Octokit (REST / GraphQL)     |         |  - Tree-sitter AST Engines      |
       |  - isomorphic-git (tree/commit) |         |  - Deterministic Dependency Dags|
       +---------------------------------+         |  - Code Metrics & Complexity    |
                                                   +---------------------------------+
```

---

## Directory Organization

```text
src/
├── components/          # Reusable UI components
│   ├── dashboard/       # Executive overview summaries (Health, Security, Git, Launcher)
│   ├── dependencies/    # Dependency graph canvas, custom nodes, inspector panel
│   ├── export/          # Multi-format export dialog (SVG, PNG, Mermaid, JSON)
│   ├── git/             # Commit timeline, activity chart, hotspots table
│   ├── graph/           # Repository map canvas, hierarchical nodes, inspector panel
│   ├── health/          # Health score card, category breakdown cards, methodology
│   ├── layout/          # Header, Footer, RepoWorkspaceHeader, Navigation tabs
│   ├── pulls/           # PR lists, status badges, blast radius impact view
│   ├── repository/      # Repository URL input, metadata cards, file tree explorer
│   └── ui/              # Base primitives (Card, Badge, Button)
├── layouts/             # Layout wrappers (RootLayout.astro, RepoWorkspaceLayout.astro)
├── lib/                 # Pure deterministic engines (zero UI dependencies)
│   ├── analyzer/        # Dependency resolution, cycle detection, health rule scoring
│   ├── export/          # SVG, PNG, Mermaid, JSON schema generator, download utilities
│   ├── git/             # Git provider abstraction, hotspot scoring, timeline builder
│   ├── github/          # Octokit connector, client/service, URL parser, error handling
│   ├── graph/           # Tree-to-graph transformation, hierarchical layout, collapse
│   ├── metrics/         # LOC counter, language detector, structure & complexity analyzer
│   ├── parser/          # JS/TS & Python AST parsers, manifest parsers
│   ├── pulls/           # Pull request normalizer, BFS blast radius impact analyzer
│   ├── security/        # Gitleaks regex rules, OSV batch client, secret masking
│   └── utils.ts         # Formatting and utility functions
├── pages/               # Astro routes
│   ├── index.astro      # Homepage with repository input and engine status
│   └── [owner]/[repo]/  # Unified repository intelligence workspace
│       ├── index.astro  # Overview intelligence dashboard
│       ├── map.astro    # Interactive repository map
│       ├── dependencies.astro # Deterministic dependency graph
│       ├── git.astro    # Git evolution and hotspots
│       ├── pulls/       # Pull request analyzer (list and PR detail)
│       ├── health.astro # Deterministic repository health assessment
│       └── security.astro # Security audit and vulnerability findings
├── styles/              # Global styles, Tailwind CSS v4, dark scrollbars, focus outline
└── types/               # Dedicated TypeScript interface models
```

---

## Core Architectural Principles

### 1. Purely Deterministic Analysis

Every calculation produced by GitKit must be mathematically reproducible:

- Same repository commit SHA $\to$ Identical metric results.
- No probabilistic generation or fuzzy heuristics.
- All rules are declared as transparent, unit-tested TypeScript engines.

### 2. Zero Server Budget (₹0 Operating Cost)

- Runs serverless on the Cloudflare edge runtime (`@astrojs/cloudflare`).
- Compute executes either on Cloudflare Workers (within free CPU limits) or in the user's browser via WebAssembly / Web Workers for heavy AST parsing.
- No dedicated persistent server instances or paid cloud databases.

### 3. Progressive Isolation & Client Islands

- Astro handles fast HTML delivery, static shell rendering, and SEO.
- Interactive tools (React Flow canvas, dynamic filters, inputs) are loaded as React client islands (`client:load` or `client:visible`).
- Heavy visualizers are code-split and loaded only when requested.

### 4. Edge & Browser Security

- Public repositories require no user authentication.
- Any server-side GitHub requests (e.g. rate-limit optimization tokens) are strictly bound to server environment variables and never leaked to client bundles.
- No user code is stored on server disks.

---

## Future Engine Extensibility

As new analysis capabilities are introduced, they follow the pluggable analyzer interface:

```typescript
export interface RepositoryAnalyzer<TInput, TOutput> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  analyze(input: TInput): Promise<TOutput>;
}
```

This guarantees each analyzer can be built, benchmarked, and unit-tested in complete isolation.
