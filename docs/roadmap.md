# GitKit Development Roadmap

This roadmap outlines the planned development phases for GitKit. Features marked as planned or deferred must **not** be mocked, faked, or presented as implemented until their respective phase is initiated.

---

## Phase 0: Engineering Foundation & Architecture (Current Phase)

- [x] Repository initialization & Git setup
- [x] Strict TypeScript configuration
- [x] Astro 5 + React 19 + Tailwind CSS setup
- [x] Cloudflare adapter configuration
- [x] Quality toolchain: ESLint 9, Prettier, Vitest, Playwright
- [x] GitHub Actions CI pipeline
- [x] Engineering documentation & persistent rules (`AGENTS.md`)
- [x] Application shell & minimalist developer homepage with URL input visual foundation (no mock data)

---

## Phase 1: GitHub URL Engine & Repository Routing (Completed)

- [x] Robust deterministic GitHub URL parser supporting all protocols, domains, .git, and subpaths
- [x] Strict TypeScript types (`GitHubRepositoryReference`, discriminated unions)
- [x] Initial dynamic repository route `/{owner}/{repo}` with coordinate validation
- [x] Polished repository loading shell (no mock data, zero AI)
- [x] Proper 404 error state for invalid repository paths
- [x] Comprehensive unit and E2E test suites covering all edge cases

---

## Phase 2: Repository Ingestion & Metadata Engine (Completed)

- [x] Official GitHub API client abstraction using Octokit
- [x] Strict decoupling: GitHub API -> GitKit Repository Service -> Typed Models -> UI
- [x] Typed `RepositoryMetadata` domain model (stars, forks, watchers, license, dates, language, size)
- [x] Recursive public repository file tree ingestion (`RepositoryTree`)
- [x] Deterministic error classification (not found, rate limited, private/unauthorized, network, service down)
- [x] Real repository metadata & dense file tree view rendered at `/{owner}/{repo}`
- [x] Comprehensive mock unit tests (57 tests) and Playwright E2E tests

---

## Phase 3: Interactive Repository Map (Completed)

- [x] Normalized internal graph data model (`src/lib/graph/graph-model.ts`)
- [x] Tree-to-graph deterministic conversion with bottom-up aggregation (`src/lib/graph/tree-to-graph.ts`)
- [x] Progressive directory collapse and expansion engine (`src/lib/graph/graph-collapse.ts`)
- [x] Search, type filtering, and dynamic file extension filtering with ancestor expansion (`src/lib/graph/graph-filter.ts`)
- [x] Collision-free hierarchical tree layout algorithm (`src/lib/graph/graph-layout.ts`)
- [x] Decoupled React Flow serialization adapter (`src/lib/graph/react-flow-adapter.ts`)
- [x] Custom dark-theme React Flow nodes and node inspector details panel (`src/components/graph/`)
- [x] Interactive repository map canvas with controls and search toolbar (`src/components/graph/RepoMapCanvas.tsx`)
- [x] Full-workspace route at `/{owner}/{repo}/map` linked from repository overview page
- [x] Comprehensive unit tests (68 tests) and Playwright E2E integration test suite

---

## Phase 4: Dependency Graph & Analysis Engine (Completed)

- [x] Multi-language deterministic source parsers (JavaScript, TypeScript, JSX, TSX, Python)
- [x] Multi-ecosystem manifest parsers (`package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`)
- [x] Deterministic module resolution engine (relative paths, extension matching, directory index, path aliases `@/` and `~/`, Python relative imports)
- [x] Canonical DFS back-edge cycle detection algorithm (`A -> B -> C -> A`) with canonical rotation normalization
- [x] Decoupled graph construction, degrees calculation, and collision-free 2D layered layout
- [x] Custom dark-theme React Flow workspace at `/{owner}/{repo}/dependencies` with cycle highlights and inspector panel
- [x] Full unit test coverage (31 tests in dependency suite, 99 total unit tests) and Playwright E2E tests

---

## Phase 5: Repository Statistics & Metrics Engine (Completed)

- [x] Deterministic repository metrics engine (`src/lib/metrics/metrics-engine.ts`)
- [x] Typed metric models with explicit unit, source, calculationMethod, and confidence levels (`src/types/metrics.ts`)
- [x] Linguist-aligned language detection and canonical color mapping (`src/lib/metrics/language-detector.ts`)
- [x] Explicit exclusion rules for vendor/build/cache directories, lockfiles, and minified bundles (`src/lib/metrics/exclusion-rules.ts`)
- [x] Concrete multi-syntax line-of-code, blank, and comment counter (`src/lib/metrics/loc-counter.ts`)
- [x] Recursive structure analyzer: deepest paths, directory size aggregation, largest files and directories (`src/lib/metrics/structure-analyzer.ts`)
- [x] Activity metrics extraction (commit count & contributor count via single-request pagination Link headers)
- [x] Polished repository statistics dashboard with language composition bar and methodology notice (`src/components/repository/RepoMetricsDashboard.astro`)
- [x] Full unit test suite (20 tests in metrics suite, 119 total unit tests) and Playwright E2E tests

---

## Phase 6: Git History Analysis and Code Hotspots (Completed)

- [x] Typed domain models for commits, authors, diff statistics, hotspots, and activity periods (`src/types/git.ts`)
- [x] Provider abstraction interface `IGitHistoryProvider` with GitHub REST API and `isomorphic-git` implementations (`src/lib/git/`)
- [x] Deterministic code hotspot scoring formula ($\text{RawScore}_f = C_f \times \ln(L_f + 1) \times R_f$) with logarithmic volume dampening and recency decay weighting
- [x] Chronological activity timeline builder grouping commits into ISO 8601 weekly buckets with additions/deletions and active author sets
- [x] Dedicated Git history and code hotspots workspace route at `/{owner}/{repo}/git`
- [x] UI components: `GitHotspotsTable.astro`, `GitActivityChart.astro`, and `GitCommitTimeline.astro`
- [x] Cross-navigation links between Repository Overview, Repo Map, Dependencies, and Git History
- [x] Full unit test coverage (11 tests in git suite, 130 total unit tests) and Playwright E2E tests

---

## Phase 7: Pull Request Analyzer (Completed)

- [x] Typed domain models for pull requests, changed files, impact metrics, and blast radius (`src/types/pull-request.ts`)
- [x] GitHub client integration for public PR lists, PR detail, and changed files diffs (`src/lib/github/client.ts`)
- [x] Deterministic PR normalizer for states (open, merged, closed, draft) and file change statuses (`src/lib/pulls/normalizer.ts`)
- [x] Deterministic blast radius and reverse dependency graph traversal algorithm with cycle-safe BFS up to depth 3 (`src/lib/pulls/impact-analyzer.ts`)
- [x] Directory churn concentration percentage and largest changed files identification
- [x] Dedicated PR list route at `/{owner}/{repo}/pulls`
- [x] Dedicated PR analysis workspace at `/{owner}/{repo}/pulls/{number}`
- [x] UI components: `PullRequestHeader.astro`, `PullRequestBadge.astro`, `PullRequestList.astro`, `PullRequestImpactSummary.astro`, `PullRequestImpactView.astro`, `PullRequestFilesList.astro`
- [x] Unit test suite with 11 tests in `tests/unit/pull-request-analyzer.test.ts` (141 total unit tests)
- [x] Playwright E2E suite in `tests/e2e/pull-requests-route.spec.ts`

---

## Phase 8: Deterministic Repository Health (Completed)

- [x] Typed domain models for health categories, findings, category scores, rating tiers, and methodology (`src/types/health.ts`)
- [x] Modular rule architecture evaluating 7 distinct categories (`src/lib/analyzer/health/rules/`)
  - [x] Documentation & Licensing (README, license, description, contributing, code of conduct, changelog)
  - [x] Automated Testing (test directories, test runner configurations, test-to-code ratio with small repo waivers)
  - [x] Repository Hygiene (.gitignore, CI workflows, issue/PR templates, binary artifact absence)
  - [x] Dependency Health (lockfile presence with non-manifest waiver, cycle-free imports, manifest validity)
  - [x] Maintainability & Structure (directory depth balance, modular file sizing, root organization)
  - [x] Development Activity (recent push window, historical commit volume, contributor base)
  - [x] Security Hygiene (SECURITY.md policy, credential leakage scan, lockfile integrity)
- [x] Transparent scoring engine with explicit category weights totaling 100% and tier classification (`exemplary`, `healthy`, `moderate`, `needs_attention`)
- [x] Repository Health workspace route at `/{owner}/{repo}/health`
- [x] UI components: `HealthScoreCard.astro`, `CategoryScoreCard.astro`, `CategoryDetailsSection.astro`, `HealthMethodologyBanner.astro`
- [x] Cross-navigation links across all workspaces (Overview, Map, Dependencies, Git, Pulls, Health)
- [x] Comprehensive unit test suite with 10 test fixtures in `tests/unit/repository-health.test.ts` (151 total unit tests)
- [x] Playwright E2E test suite in `tests/e2e/repository-health-route.spec.ts`

---

## Phase 9: Deterministic Security Analysis (Completed)

- [x] Strongly typed domain models for security finding severities, types, confidences, and reports (`src/types/security.ts`)
- [x] Deterministic secret masking utility ensuring zero raw secret leakage in UI, logs, or evidence (`src/lib/security/masking.ts`)
- [x] Gitleaks regex rule engine and false-positive filtering (`src/lib/security/rules/secret-rules.ts`)
- [x] Multi-vector security scanners:
  - [x] Secret scanner for tree files (.env, id_rsa, credentials.json) and source contents (GitHub PATs, AWS, Google, Slack, Stripe, JWT, private keys) (`src/lib/security/scanners/secret-scanner.ts`)
  - [x] OpenSSF OSV batch API client adapter (`api.osv.dev/v1/querybatch`) querying package coordinates without sending source code externally (`src/lib/security/scanners/osv-scanner.ts`)
  - [x] Configuration scanner detecting vulnerable `pull_request_target` workflows, mutable action tags, Dockerfile secrets, and unsafe package scripts (`src/lib/security/scanners/config-scanner.ts`)
- [x] Security engine orchestrator deduplicating findings, ordering by severity, and calculating summary metrics (`src/lib/security/security-engine.ts`)
- [x] Dedicated Security Audit workspace at `/{owner}/{repo}/security`
- [x] UI components: `SecurityMethodologyBanner.astro`, `SecuritySummaryCard.astro`, `SecurityFindingsList.astro`
- [x] Cross-navigation links across all workspaces (Overview, Map, Dependencies, Git, Pulls, Health, Security)
- [x] Comprehensive unit test suite with 22 test fixtures in `tests/unit/security-engine.test.ts` (173 total unit tests)
- [x] Playwright E2E test suite in `tests/e2e/security-route.spec.ts` (24 total E2E tests)

---

## Phase 10: Export System (Completed)

- [x] Strongly typed export domain models and targets (`src/types/export.ts`)
- [x] Deterministic sanitized filename generator (`src/lib/export/filename.ts`)
- [x] Standalone SVG generator with dark theme and bezier curves (`src/lib/export/svg-generator.ts`)
- [x] Deterministic Mermaid flowchart generator for hierarchy and dependencies (`src/lib/export/mermaid-generator.ts`)
- [x] Normalized JSON schema v1.0 payload generator (`src/lib/export/json-generator.ts`)
- [x] Client-side 2x Retina PNG rasterizer using HTML5 Canvas (`src/lib/export/png-exporter.ts`)
- [x] Direct browser download utility for binary blobs and UTF-8 text (`src/lib/export/browser-download.ts`)
- [x] Interactive Export control dialog component (`src/components/export/ExportControl.tsx`)
- [x] Integration into Repo Map toolbar, Dependency Graph toolbar, and Overview action bar
- [x] Comprehensive unit test suite in `tests/unit/export-system.test.ts` (187 total unit tests)
- [x] Playwright E2E test suite in `tests/e2e/export-system.spec.ts` (26 total E2E tests)

---

## Phase 11: Production Hardening & Custom Domain Launch (Upcoming)

- [ ] Performance profiling and WebAssembly worker offloading
- [ ] Cloudflare deployment optimization
- [ ] Purchase confirmation and DNS configuration for `gitkit.in`
- [ ] Production SSL and security headers verification
