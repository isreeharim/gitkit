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
│   ├── charts/          # D3 / metric charts (future phases)
│   ├── dashboard/       # Repo dashboard widgets (future phases)
│   ├── graph/           # React Flow / dependency visualizers (future phases)
│   ├── layout/          # Header, Footer, Navigation, AppShell
│   ├── repository/      # Repository URL input & viewer components
│   └── ui/              # Atom-level primitives (Button, Card, Badge, Input)
├── layouts/             # Astro base layouts (RootLayout.astro)
├── lib/                 # Core domain logic (strictly decoupled from UI)
│   ├── analyzer/        # Deterministic static analysis rules & engine
│   ├── git/             # Low-level git repository & tree traversals
│   ├── github/          # GitHub REST/GraphQL connectors & URL parsers
│   ├── graph/           # Graph algorithms (topological sort, cycle detection)
│   ├── metrics/         # Cyclomatic complexity, SLOC, language breakdowns
│   ├── parser/          # AST parsing (Tree-sitter WASM / regex fallbacks)
│   ├── security/        # Security scanners (secret patterns, licenses)
│   └── utils.ts         # Shared UI & string utilities
├── pages/               # Astro routes
│   ├── index.astro      # Homepage
│   └── [...future]      # Dynamic repository workspace: [owner]/[repo].astro
├── styles/              # Global styles & Tailwind CSS entry points
├── types/               # TypeScript interface definitions
└── workers/             # Dedicated Web Workers / Cloudflare Worker utilities
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
