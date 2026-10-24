# GitKit Engineering & Architectural Rules (AGENTS.md)

This document defines the non-negotiable architectural constraints, coding standards, and operating rules for all automated assistants, agents, and human contributors working on GitKit.

---

## 1. Absolute Rule: Zero AI / LLMs Inside GitKit

1. **GitKit MUST NOT use AI or LLMs inside the product.**
2. **NEVER introduce:**
   - OpenAI, Gemini, Claude, or any external/local LLM APIs
   - AI agent frameworks (LangChain, LlamaIndex, etc.)
   - AI-generated repository summaries, code explanations, or semantic interpretations
   - AI-generated scoring or heuristic fuzziness
3. **Deterministic analysis only**: All analysis results, graphs, metrics, and insights must be 100% reproducible and verifiable via:
   - AST parsing & concrete syntax trees (Tree-sitter)
   - Static code analysis & regex/pattern matching
   - Deterministic graph algorithms (tarjan, cycle detection, topological sort, pagerank)
   - Dependency manifest parsing (`package.json`, `Cargo.toml`, `go.mod`, etc.)
   - Git commit history, tree inspection, and deterministic metrics via `isomorphic-git` / GitHub REST/GraphQL APIs
   - Deterministic formulas with explicit criteria

---

## 2. Operating Budget & Infrastructure

1. **₹0 Operating Budget**: The budget is ₹0 except for the eventual `gitkit.in` domain registration.
2. **Domain Rule**: The `gitkit.in` domain is NOT yet purchased. Do NOT configure production DNS, do NOT assume it exists, and do NOT make development depend on it. Deployments test against Cloudflare `workers.dev` staging URLs until confirmed by the owner.
3. **No Paid Services**: Never introduce SaaS tools, databases, or services that require a credit card or exceed generous permanent free tiers.
4. **Cloudflare Target**: GitKit is engineered to run serverless on Cloudflare Workers / Cloudflare Pages via `@astrojs/cloudflare`. Avoid Node.js-exclusive runtime bindings in edge runtime paths.
5. **Phase 0 Exclusions**: Do NOT add a database, Redis, Supabase, authentication, or Vercel infrastructure unless explicitly authorized for a subsequent phase.

---

## 3. Security & Credentials

1. **Zero Secret Exposure**: Never expose GitHub credentials, personal access tokens (PATs), webhook secrets, or server environment variables to client bundles.
2. **Public First**: Public repositories must work seamlessly without requiring GitHub authentication.
3. **Private Repositories**: Deferred. Any future private repo support requires explicit OAuth authorization with minimal scoping and must never persist user source code insecurely.

---

## 4. Engineering Standards & Quality

1. **Strict TypeScript**: Every file must compile under TypeScript strict mode (`noEmitOnError`, `noImplicitAny`, strict null checks).
2. **No Fake / Mock Functionality**: Never create fake analysis data, mock metric numbers, or placeholder features that masquerade as real functionality. If a feature is not yet implemented, clearly state that it is unimplemented or leave the engine uncalled.
3. **Modular Architecture**:
   - `src/pages/`: Astro routing only. Keep page scripts thin.
   - `src/components/`: Reusable UI components split by domain (`layout/`, `repository/`, `graph/`, `dashboard/`, `charts/`, `ui/`).
   - `src/lib/`: Pure deterministic logic modules (`github/`, `git/`, `parser/`, `analyzer/`, `graph/`, `metrics/`, `security/`).
   - `src/types/`: Dedicated type definition files.
4. **Small, Testable Modules**: Favor small single-responsibility modules over monolithic files. Every analysis engine must have dedicated Vitest unit tests.
5. **Testing Discipline**:
   - Unit tests: `npm run test` (Vitest)
   - E2E tests: `npm run test:e2e` (Playwright)
   - Typechecking: `npm run typecheck` (`tsc --noEmit`)
   - Linting & Formatting: `npm run lint` (ESLint 9) & `npm run format:check` (Prettier)

---

## 5. UI & Design Principles

1. **Aesthetic Target**: GitHub + Linear + Modern IDE.
2. **Dark-first**: Technical, dense yet readable, monospace accenting where data is shown.
3. **Restrained Visuals**: Clean subtle 1px borders (`border-neutral-800`), neutral backgrounds (`#0a0a0a`, `#121212`), crisp typography.
4. **Anti-Slop**:
   - NO generic AI SaaS landing page designs.
   - NO multi-color rainbow gradients.
   - NO glowing blurred blobs or gratuitous glassmorphism.
   - NO gimmicky animations that delay workflow navigation.
   - NO fake "AI-powered" badge claims.

---

## 6. Dependency Discipline

1. Do NOT install packages preemptively.
2. Only install a dependency when it is immediately needed by the current phase.
3. Check package bundle weight and edge runtime compatibility before adding dependencies.
