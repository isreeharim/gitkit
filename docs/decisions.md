# GitKit Architecture Decision Records (ADRs)

This document tracks the foundational architectural decisions made for GitKit, their context, and consequences.

---

## ADR 001: Strict Zero AI / Zero LLM Policy

### Status

Accepted

### Context

Many developer tools have integrated LLMs to provide summaries or subjective ratings. These introduce high API latency, unpredictable hallucinations, nondeterministic outputs, privacy risks, and recurring API costs that violate our ₹0 budget.

### Decision

GitKit will strictly forbid any AI models, LLM APIs, or agent frameworks. All analysis must be 100% deterministic, computed via AST parsers (Tree-sitter), static regex/pattern matchers, deterministic graph algorithms, and formal code metrics.

### Consequences

- **Pros**: Predictable, mathematically reproducible, verifiable, zero API subscription costs, microsecond latency.
- **Cons**: Requires building and maintaining explicit AST and grammar parsers for language features.

---

## ADR 002: Framework Selection — Astro with React Islands

### Status

Accepted

### Context

GitKit needs fast initial page loads, optimal SEO, and clean serverless deployment, alongside rich interactive visualizers (dependency graphs, interactive AST trees, metric charts).

### Decision

Adopt **Astro 5** as the core meta-framework with **React 19** for interactive islands.

### Consequences

- **Pros**: Ships zero JavaScript by default for content and structural layouts. Supports selective hydration (`client:load`, `client:visible`) for graph and canvas visualizers.
- **Cons**: Requires discipline separating Astro component boundaries (`.astro`) from React interactive islands (`.tsx`).

---

## ADR 003: Deployment Target — Cloudflare Workers / Pages

### Status

Accepted

### Context

The operational budget is ₹0. We must avoid vendor lock-in to paid server platforms or single-vendor hosting tiers (e.g., Vercel) while maintaining global low latency.

### Decision

Use `@astrojs/cloudflare` targeting Cloudflare Workers.

### Consequences

- **Pros**: Generous free tier (100k requests/day), instant edge routing worldwide, zero server maintenance costs.
- **Cons**: Edge runtime lacks Node.js filesystem access (`fs`); heavy Git clone operations must use in-memory virtual filesystems (`isomorphic-git`) or client-side Web Workers.

---

## ADR 004: UI Foundations & Anti-Slop Visual Aesthetics

### Status

Accepted

### Context

Developer tools often fall into one of two traps: either unstyled developer wireframes or generic AI SaaS marketing templates with excessive rainbow gradients, glassmorphism, and fake badges.

### Decision

Adopt a dark-first, technical, dense, and minimal aesthetic inspired by GitHub, Linear, and modern IDEs (subtle 1px borders, neutral dark palette, clear monospace accents). Utilize Tailwind CSS v4 and Lucide icons.

### Consequences

- **Pros**: Professional, focused developer experience with maximum data density and minimal visual distraction.
- **Cons**: Requires custom token discipline rather than copying off-the-shelf marketing kits.

---

## ADR 005: Deferral of Custom Domain (`gitkit.in`)

### Status

Accepted

### Context

The domain `gitkit.in` is reserved for future launch but has not yet been purchased.

### Decision

Development, staging, and preview workflows will not depend on `gitkit.in`. Preview and staging deployments will use Cloudflare `workers.dev` URLs until the domain is purchased and explicitly confirmed.

### Consequences

- **Pros**: Zero initial capital outlay; application architecture remains domain-agnostic.
- **Cons**: Custom domain configuration is deferred to post-launch hardening.

---

## ADR 006: Deterministic GitHub URL Parsing & Coordinate Validation

### Status

Accepted

### Context

Users supply GitHub URLs in dozens of formats (with or without protocols, `www.github.com`, `.git` extensions, SSH prefixes, trailing slashes, deep subpaths like `/issues`, `/tree/main`, `/blob/main/...`, and query strings/fragments). The engine must extract canonical `{owner}` and `{repo}` coordinates without making premature network calls and without treating subpaths as repository names.

### Decision

Implement a pure, deterministic parser in `src/lib/github/parse-repo-url.ts` using discriminated union result types (`ParseGitHubUrlResult`). Validate owner names against GitHub username constraints and reserved root paths (e.g. `settings`, `explore`), and validate repository names against character rules (alphanumeric, dots, hyphens, underscores).

### Consequences

- **Pros**: Zero network overhead, microsecond execution, mathematically predictable extraction, robust support for copy-pasted deep GitHub URLs.
- **Cons**: Requires keeping the reserved GitHub root path list up to date.

---

## ADR 007: GitHub Client Abstraction, Model Decoupling, and Rate Limit Safety

### Status

Accepted

### Context

Public GitHub repositories must be ingested without scraping or forcing users to log in. Raw Octokit response schemas contain hundreds of internal GitHub API fields that create tight coupling between the view layer and third-party APIs. Furthermore, unauthenticated requests are strictly rate-limited (60 req/hr per IP), requiring clear error handling without leaking stack traces or credentials.

### Decision

1. Implement a dedicated client abstraction (`GitHubClient` / `IGitHubClient`) wrapping Octokit, keeping tokens server-side only.
2. Maintain a strict separation of layers:
   `GitHub API Layer` $\to$ `GitKit Repository Service` $\to$ `Typed Application Models` $\to$ `UI Components`.
3. Normalize raw payloads into pure domain models: `RepositoryMetadata` and `RepositoryTree`.
4. Implement deterministic error mapping with `GitHubApiError` and `RepositoryIngestionError` to handle 404s, rate limiting, and private repositories cleanly.

### Consequences

- **Pros**: UI is completely insulated from GitHub schema changes; 100% of the service layer can be tested with deterministic in-memory fixtures; zero credentials or stack traces ever reach the client.
- **Cons**: Unauthenticated requests are constrained by GitHub's 60 req/hr IP rate limits until an optional server-side token is configured.

---

## ADR 008: Normalized Internal Graph Engine, Decoupled React Flow Adapter, and Hierarchical Layout

### Status

Accepted

### Context

GitKit requires an interactive visual representation of ingested repository file trees at `/{owner}/{repo}/map`. The graph engine must remain independent of any particular visual rendering library so that future deterministic analysis engines (AST call graphs, dependency cycles, Topological sort, PageRank) operate on a clean graph data structure. Furthermore, rendering entire repositories without collapsing or progressive expansion creates unreadable node clouds and severe browser DOM overhead on medium-to-large repositories.

### Decision

1. **Normalized Internal Graph Model (`src/lib/graph/graph-model.ts`)**:
   Construct an independent data model (`RepoGraph`, `RepositoryGraphNode`, `DirectoryGraphNode`, `FileGraphNode`, `RepoGraphEdge`) completely decoupled from React Flow or any UI library.
2. **Deterministic Bottom-Up Aggregation (`src/lib/graph/tree-to-graph.ts`)**:
   Transform `RepositoryTree` entries into directed `CONTAINS` edges and bottom-up aggregated directory statistics (direct child counts, total descendant files, and recursive byte totals).
3. **Progressive Collapsing & Ancestor Expansion (`src/lib/graph/graph-collapse.ts`)**:
   Keep top-level folders expanded by default while collapsing depth $\ge 2$. Provide instant O(1) expanding/collapsing that traverses only visible nodes.
4. **Deterministic Search & Multi-Criteria Filtering (`src/lib/graph/graph-filter.ts`)**:
   Support text matching, type filtering (directories vs files), and dynamic file extension filtering. When filtering, automatically calculate ancestor directory chains to reveal matching files inside collapsed folders.
5. **Collision-Free Hierarchical Tree Layout (`src/lib/graph/graph-layout.ts`)**:
   Calculate left-to-right 2D coordinates ($x = \text{depth} \times (\text{width} + \text{gap})$), vertically centering parent nodes relative to their visible children with zero bounding collisions.
6. **Decoupled Serialization Adapter (`src/lib/graph/react-flow-adapter.ts`)**:
   Convert visible graph nodes and layout coordinates into React Flow nodes and edges (`@xyflow/react`).
7. **Immediate Failover on Rate Limits in Octokit**:
   Disable Octokit's retry and throttling auto-sleep hooks so rate-limited requests fail immediately and render informative UI rather than hanging connections.

### Consequences

- **Pros**: 100% deterministic, zero layout jitter, instant search and filtering, highly performant on large repos, completely decoupled graph engine tested via pure unit tests.
- **Cons**: Deep directory hierarchies require horizontal panning; addressed with viewport fit controls and minimap/navigation zoom limits.

---

## ADR 009: Deterministic Dependency Graph Architecture, Multi-Language Import Parsers, Manifest Ingestion, and Elementary Cycle Detection

### Status

Accepted

### Context

GitKit requires understanding relationships between source files and external packages for ingested repositories at `/{owner}/{repo}/dependencies`. Under GitKit's non-negotiable architectural constraints:

1. Zero AI/LLM inference: all dependencies must be derived deterministically via AST / regex parsing and manifest analysis.
2. Cloudflare Serverless / Edge runtime compatibility: native Node.js binaries or blocking operations are prohibited.
3. Multi-language support: JavaScript, TypeScript, JSX, TSX, and Python must be handled reliably, alongside multi-ecosystem package manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`).
4. Graph cycles: circular dependencies must be detected deterministically without false positives, normalized by canonical rotation, and visually highlighted.

### Decision

1. **Decoupled Architecture (`src/lib/parser/` and `src/lib/analyzer/`)**:
   - `src/lib/parser/`: Language-specific parsers (`JavaScriptTypeScriptParser`, `PythonParser`, `manifest-parser`) conforming to `ISourceParser`.
   - `src/lib/analyzer/`: Deterministic module resolution (`resolver.ts`), cycle detection (`cycle-detector.ts`), graph builder (`graph-builder.ts`), filtering (`graph-filter.ts`), 2D collision-free layout (`graph-layout.ts`), and React Flow rendering adapter (`react-flow-adapter.ts`).
2. **Deterministic Module Resolution (`resolver.ts`)**:
   - Resolves relative imports (`./`, `../`), extensionless paths (`.ts`, `.tsx`, `.js`, etc.), directory index files (`index.ts`), path aliases (`@/`, `~/`), Python relative package imports (`.`, `..`), and classifies bare module names as external package dependencies.
3. **Canonical Cycle Detection (`cycle-detector.ts`)**:
   - Implements DFS back-edge detection with canonical rotation normalization (smallest lexicographical node starting the cycle representation `[A, B, C, A]`) to avoid duplicate permutations of identical cycles.
4. **Prioritized Batch Blob Ingestion**:
   - Manifests are always fetched and parsed. Source files are prioritized based on entrypoint patterns (`index`, `main`, `app`, `server`) and shallow path depth up to an edge-friendly quota to stay well within GitHub API limits.
5. **Interactive React Flow Dependency Workspace (`/{owner}/{repo}/dependencies`)**:
   - Renders custom node components (`depFileNode`, `depPackageNode`), incoming/outgoing degree badges, cycle chain warnings in rose-500, search filtering, and an interactive detail panel inspector.

### Consequences

- **Pros**: 100% reproducible and verifiable; zero AI hallucination; fast execution; pure testability with 99 unit tests; clean UI with responsive dark theme.
- **Cons**: Large repositories fetch a prioritized subset of source files to respect GitHub API rate limits; users can inspect full manifests and prioritized modules.
