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
