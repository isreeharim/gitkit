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

---

## ADR 010: Deterministic Repository Statistics & Metrics Engine, Concrete LOC Counting, and Exclusion Rules

### Status

Accepted

### Context

GitKit requires rich repository metrics across code, structure, repository metadata, and activity. Under GitKit's core principles:

1. All metrics must be 100% deterministic, reproducible, and derived from actual repository structures or official GitHub APIs.
2. Never invent numbers, fake code metrics, or use AI to guess maintainability or code sizes.
3. Clearly label data provenance, calculation methodology, and approximation boundaries (e.g. sampled LOC vs tree-level counts).
4. Explicitly exclude vendor, build, package cache, and minified artifacts from clean source metrics.

### Decision

1. **Decoupled Metrics Engine (`src/lib/metrics/`)**:
   - `types.ts`: Rich typed models (`MetricItem<T>`, `LanguageMetric`, `FileTypeMetric`, `LargestFileMetric`, `DirectorySizeMetric`, `DeepestPathMetric`, `LocAnalysisResult`, `StructureMetrics`, `ActivityMetrics`, `RepositoryMetricsReport`). Every metric carries explicit `source`, `calculationMethod`, `unit`, and `confidence` fields.
   - `language-detector.ts`: Linguist-aligned extension and filename lookup database for 35+ languages and canonical color codes.
   - `exclusion-rules.ts`: Explicit directory (`node_modules`, `dist`, `vendor`, `target`, `.git`, `.next`, etc.), lockfile, and minified bundle filters.
   - `loc-counter.ts`: Deterministic line-of-code, blank, and comment parser across multiple comment syntax families (C-style, Python/hash-style, HTML-style, SQL-style, CSS-style).
   - `structure-analyzer.ts`: Recursive bottom-up directory size aggregation, deepest path hierarchy discovery, largest files and directories, and language/file-type distributions.
   - `metrics-engine.ts`: Normalized report construction assembling metadata, tree, LOC, and activity metrics.
2. **Activity Metrics without Rate Limit Burn**:
   - Commit counts and contributor counts are extracted via GitHub's `Link` pagination header (`per_page=1&anon=true` and reading the `rel="last"` page parameter), obtaining the exact total count in a single lightweight HTTP request.
3. **Transparent Sampling and Provenance UI (`RepoMetricsDashboard.astro`)**:
   - Displays proportional multi-segment language distribution bar with color legend.
   - Provides summary metric cards with clear "Sampled" badges and exact methodology notes.
   - Renders structural breakdowns for largest files, largest directories, and deepest tree paths.

### Consequences

- **Pros**: 100% deterministic, zero LLM guesswork, strict transparency on approximation boundaries, fast edge-compatible execution, and comprehensive unit tests.
- **Cons**: LOC analysis on very large repositories is calculated from prioritized entrypoints and shallow source files to respect edge runtime timeouts and rate limits.

---

## ADR 011: Git History Analysis, Deterministic Code Churn Hotspots, and Provider Abstraction

### Status

Accepted

### Context

Understanding repository evolution requires analyzing commit history, file change frequency, code volume churn (additions/deletions), and temporal activity patterns. Under GitKit's non-negotiable architectural constraints:

1. Zero AI/LLM inside the product: GitKit must NOT claim "risk", "bug predictability", or "AI code smells".
2. Deterministic Hotspots Formula: Any "hotspot" or churn score must be computed with a published, explainable mathematical formula and reproducible inputs.
3. Edge and Serverless compatibility: Git history extraction must work cleanly under Cloudflare Workers / Cloudflare Pages runtime limits and support both GitHub REST API ingestion and isomorphic-git virtual filesystem inspection.
4. Transparency: The UI must clearly explain the scoring methodology and display the exact formula used.

### Decision

1. **Provider Abstraction (`src/lib/git/types.ts`)**:
   - `IGitHistoryProvider`: Standard interface (`getCommits`, `getCommit`) decoupled from the underlying storage mechanism.
   - `GitHubGitProvider`: Retrieves commit history and detailed file diff deltas via official GitHub REST APIs.
   - `IsomorphicGitProvider`: Powered by `isomorphic-git` for in-memory virtual filesystems, local test fixtures, and client-side repos.
2. **Explainable Deterministic Hotspot Formula (`src/lib/git/hotspot-analyzer.ts`)**:
   - Computes raw score per file:
     $$\text{RawScore}_f = C_f \times \ln(L_f + 1) \times R_f$$
     where:
     - $C_f$: Commit change frequency count for file $f$.
     - $L_f$: Total line changes ($A_f + D_f$, additions plus deletions) dampened logarithmically by $\ln(L_f + 1)$ to prevent massive auto-generated files (e.g. 20,000 line bundles or lockfiles) from dominating frequently touched hand-crafted source code.
     - $R_f$: Average recency weight calculated with a linear decay window over 90 days from the latest commit down to a baseline floor of 0.2.
   - Normalized score:
     $$\text{HotspotScore}_f = \text{round}\left(100 \times \frac{\text{RawScore}_f}{\max(\text{RawScore})}\right)$$
   - Activity tier classification:
     - `critical_churn`: Score $\ge 75$
     - `high_churn`: $50 \le \text{Score} < 75$
     - `moderate_churn`: $25 \le \text{Score} < 50$
     - `stable`: $\text{Score} < 25$
3. **Chronological Activity Timeline (`src/lib/git/timeline-builder.ts`)**:
   - Buckets commits into ISO 8601 weeks (`YYYY-Www`) with additions, deletions, commit counts, and active contributors.
4. **Git History & Hotspots Workspace Route (`/{owner}/{repo}/git`)**:
   - Displays summary cards (Commits Analyzed, Net Growth, Active Authors, Hotspots Identified).
   - Interactive Hotspots Table (`GitHotspotsTable.astro`) with score bars, tier badges, additions/deletions, recent 30d changes, and explicit methodology banner.
   - Activity timeline chart (`GitActivityChart.astro`) showing commit velocity and line volume over time.
   - Chronological commit feed (`GitCommitTimeline.astro`) with author avatars, diff statistics, and file change tags.

### Consequences

- **Pros**: 100% deterministic, reproducible, transparent math; zero AI hallucinations; no false claims of bug prediction; responsive dark-first UI matching GitHub/Linear aesthetic; fully covered by unit and E2E tests.
- **Cons**: Analyzes recent commit window (e.g. 30–50 commits) in public API paths to respect GitHub rate limits; clearly communicates sampling boundaries to users.

---

## ADR 012: Deterministic Pull Request Analyzer, Dependency Blast Radius Traversal, and Non-Causal Impact Reporting

### Status

Accepted

### Context

Understanding the downstream impact of proposed code changes in a Pull Request is essential for technical repo inspection. Under GitKit's non-negotiable architectural rules:

1. Strictly Zero AI / Zero LLMs: GitKit MUST NOT guess PR risk, predict merge bugs, or invent semantic interpretations.
2. Transparent Non-Causal Reporting: GitKit must state facts based strictly on deterministic AST/dependency graphs and file churn (e.g. "Potentially affected modules based on deterministic dependency graph traversal. Does not imply runtime failure or bug causation").
3. Multi-route PR Navigation: Dedicated routes at `/{owner}/{repo}/pulls` (listing public PRs) and `/{owner}/{repo}/pulls/{number}` (detailed impact inspection workspace).
4. Edge Runtime Compatibility: All traversals and aggregations run serverless on Cloudflare Workers / Pages with zero external databases or paid services.

### Decision

1. **Decoupled Pull Request Architecture (`src/lib/pulls/`)**:
   - `normalizer.ts`: Deterministically parses raw GitHub pull request and changed files payloads into `PullRequestSummary` and `PullRequestDetail` models. Accurately determines states (`open`, `merged`, `closed`) and file statuses (`added`, `modified`, `removed`, `renamed`).
   - `impact-analyzer.ts`: Performs deterministic blast radius analysis. Computes directory-level churn and concentration percentage, largest changed files, and downstream module dependents.
   - `pull-service.ts`: Coordinates GitHub client, normalization, and graph traversal.
2. **Reverse Dependency Graph Traversal (Blast Radius)**:
   - For every changed file present in the repository's dependency graph, an incoming adjacency list is traversed via Breadth-First Search (BFS) up to a bounded depth (level 3).
   - Classifies module impacts into explicit relationship depths:
     - Depth 0: Directly modified in the PR.
     - Depth 1: Directly imports a modified module.
     - Depth 2+: Transitively depends on modified modules.
   - Uses a cycle-safe `visited` set to ensure deterministic, loop-free termination even on circular codebases.
3. **Change Concentration & Churn**:
   - Identifies top affected directory and calculates exact percentage of total PR changes concentrated in that directory.
   - Aggregates file type distribution across modified extensions.
4. **Developer-Oriented UI Components (`src/components/pulls/`)**:
   - `PullRequestHeader.astro`: State badge, author, branch flow (`base` <- `head`), timestamps, and link to GitHub.
   - `PullRequestImpactSummary.astro`: High-level metrics (Files Changed, Net Growth, Concentration, Blast Radius).
   - `PullRequestImpactView.astro`: Methodology disclaimer, directory breakdown, largest changed files, and downstream affected modules table.
   - `PullRequestFilesList.astro`: Comprehensive changed files list with status badges and expandable diff patch snippets.

### Consequences

- **Pros**: 100% deterministic, reproducible, grounded in actual import graphs; zero AI hallucinations; no misleading claims of "risk" or "bugs"; fully covered by unit and E2E tests.
- **Cons**: Downstream blast radius analysis relies on analyzed dependency graph nodes; files in unparsed or unsupported languages are recorded as directly changed without AST propagation.

---

## ADR 013: Deterministic Repository Health Scoring Engine, Modular Rule Architecture, and Transparent Evidence Reporting

### Status

Accepted

### Context

Assessing repository health often relies on subjective ratings, proprietary ML models, or LLM-generated summaries. These are nondeterministic, prone to hallucination, opaque, and violate GitKit's strict zero AI / zero LLM policy and ₹0 budget.

GitKit requires an objective, 100% reproducible, transparent repository health engine with:
1. Seven concrete evaluation categories: Documentation, Testing, Repository Hygiene, Dependency Health, Maintainability, Activity, and Security.
2. Modular rule architecture where each rule returns structured findings with concrete evidence (paths, sizes, dates, counts).
3. Non-penalizing waivers: Non-applicable rules (e.g. package lockfiles on non-package script projects, or test-to-code ratios on repos under 5 files) must not penalize small repositories.
4. Transparent UI explanation: Users must see every rule evaluated, exact points awarded, why points were awarded, and verifiable evidence.

### Decision

1. **Modular Rule Architecture (`src/lib/analyzer/health/`)**:
   - `types.ts`: Defines `HealthRule` and `HealthRuleContext` (`metadata`, `tree`, optional `graph`, `metrics`, `commits`).
   - `rules/documentation-rules.ts`: Evaluates README existence & size, open source license, description, CONTRIBUTING guide, CODE_OF_CONDUCT, and CHANGELOG.
   - `rules/testing-rules.ts`: Evaluates test file directory presence, test runner configuration (`vitest`, `jest`, `pytest`, `cargo test`, etc.), and test-to-source ratio with small repository waivers.
   - `rules/hygiene-rules.ts`: Evaluates `.gitignore`, CI configuration (`.github/workflows`, `.gitlab-ci.yml`, etc.), issue/PR templates, and absence of committed compiled binary blobs (`.exe`, `.so`, `.class`, etc.).
   - `rules/dependency-rules.ts`: Evaluates lockfile presence (with non-manifest waiver), cycle-free import graph traversal, and manifest definition validity.
   - `rules/maintainability-rules.ts`: Evaluates directory hierarchy depth (<= 6 levels), monolithic file absence (warning on files > 100 KB), and root directory cleanliness.
   - `rules/activity-rules.ts`: Evaluates recent push/commit window (active within 30d, 90d, 180d, or dormant > 365d), historical commit volume, and contributor diversity.
   - `rules/security-rules.ts`: Evaluates SECURITY.md policy presence, absence of committed secrets/private keys (`.env`, `id_rsa`, `*.key`, `credentials.json`), and lockfile supply chain integrity.
2. **Deterministic Scoring Formula & Weights (`src/lib/analyzer/health/scoring-engine.ts`)**:
   - Explicit category weights totaling 100%:
     - Documentation: 20%
     - Testing: 20%
     - Hygiene: 15%
     - Dependencies: 15%
     - Maintainability: 10%
     - Activity: 10%
     - Security: 10%
   - Formula: $\text{Overall Score} = \text{round}\left( \sum (\text{CategoryPercentage} \times \text{Weight}) \right)$
   - Rating tiers: `exemplary` ($\ge 85$), `healthy` ($\ge 70$), `moderate` ($\ge 50$), `needs_attention` ($< 50$).
3. **Transparent Evidence Model**:
   - Every `HealthFinding` includes `pointsAwarded`, `maxPoints`, `kind` (`positive` | `negative` | `neutral`), `summary`, `explanation`, and `evidence` string.
4. **Health Workspace Route (`/{owner}/{repo}/health`)**:
   - Dedicated route displaying Methodology Banner, Composite Health Index card, 7 Category cards with percentage bars, and full detailed findings with verifiable evidence.

### Consequences

- **Pros**: 100% deterministic, 100% reproducible; zero AI/LLM cost or latency; completely transparent explanations with evidence; fair evaluation across both large frameworks and minimal single-file scripts.
- **Cons**: Limited to static indicators visible in repository trees, metadata, and Git history without dynamic test execution.
