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

## Phase 2: Repository Ingestion & Metadata Engine (Upcoming)

- [ ] Deterministic GitHub public API client (rate-limit safe, caching headers, zero client token leakage)
- [ ] Tree & commit metadata ingestion via GitHub REST & `isomorphic-git`
- [ ] Deterministic repository summary card (languages, stars, forks, license, commit frequency)
- [ ] Edge caching strategy on Cloudflare Workers KV / Cache API

---

## Phase 2: Static Analysis & Code Metrics Engine

- [ ] Tree-sitter AST parsing integration (via WebAssembly)
- [ ] Cyclomatic complexity and Halstead metrics calculation
- [ ] Dependency manifest parsers (`package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`)
- [ ] License detection and compliance scanner
- [ ] Code health & maintainability index calculator (deterministic formulas only)

---

## Phase 3: Interactive Visualization Engine

- [ ] File tree architecture visualizer (treemap & icicle diagrams)
- [ ] Module dependency graph (React Flow + D3 force-directed layout)
- [ ] Git commit activity timeline & hotspot heatmaps
- [ ] Interactive filtering and search across graph nodes

---

## Phase 4: Production Hardening & Custom Domain Launch

- [ ] Performance profiling and WebAssembly worker offloading
- [ ] Cloudflare deployment optimization
- [ ] Purchase confirmation and DNS configuration for `gitkit.in`
- [ ] Production SSL and security headers verification
