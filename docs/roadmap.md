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

## Phase 4: Static Analysis & Code Metrics Engine (Upcoming)

- [ ] Tree-sitter AST parsing integration (via WebAssembly)
- [ ] Cyclomatic complexity and Halstead metrics calculation
- [ ] Dependency manifest parsers (`package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`)
- [ ] License detection and compliance scanner
- [ ] Code health & maintainability index calculator (deterministic formulas only)

---

## Phase 5: Production Hardening & Custom Domain Launch

- [ ] Performance profiling and WebAssembly worker offloading
- [ ] Cloudflare deployment optimization
- [ ] Purchase confirmation and DNS configuration for `gitkit.in`
- [ ] Production SSL and security headers verification
