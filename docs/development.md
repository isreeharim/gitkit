# GitKit Development Guide

This guide covers local setup, workflows, coding conventions, testing procedures, and deployment targeting for GitKit.

---

## 1. Prerequisites

- **Node.js**: `v20.0.0` or higher (`v24.x` recommended).
- **npm**: `v10.x` or higher.
- **Git**: Installed and configured.

---

## 2. Setup & Installation

Clone and install dependencies:

```bash
git clone https://github.com/your-org/gitkit.git
cd gitkit
npm install
```

---

## 3. Available npm Commands

| Command                 | Purpose                                                            |
| :---------------------- | :----------------------------------------------------------------- |
| `npm run dev`           | Start local development server with HMR at `http://localhost:4321` |
| `npm run build`         | Compile the Astro application for Cloudflare deployment            |
| `npm run preview`       | Preview production build locally                                   |
| `npm run test`          | Run unit tests with Vitest                                         |
| `npm run test:watch`    | Run Vitest in interactive watch mode                               |
| `npm run test:coverage` | Generate unit test code coverage report                            |
| `npm run test:e2e`      | Run end-to-end tests via Playwright                                |
| `npm run typecheck`     | Run strict TypeScript compiler verification without emitting code  |
| `npm run lint`          | Inspect code for ESLint violations                                 |
| `npm run lint:fix`      | Automatically fix autofixable ESLint violations                    |
| `npm run format`        | Format repository code with Prettier                               |
| `npm run format:check`  | Verify formatting without modifying files                          |

---

## 4. Coding Conventions

- **Strict TypeScript**: Never use `any` unless strictly interfacing with an un-typed third-party boundary (and always wrap/narrow it).
- **File Naming**:
  - Components: PascalCase for components (`RepoInput.tsx`, `Header.astro`).
  - Utilities & modules: kebab-case (`parse-repo-url.ts`, `validate-schema.ts`).
  - Tests: Matching source name with `.test.ts` or `.spec.ts` inside `tests/unit/` or `tests/e2e/`.
- **Pure Functions**: Logic in `src/lib/` must be pure functions with zero side-effects whenever possible, enabling straightforward unit testing.

---

## 5. Testing Strategy

GitKit enforces a multi-tier testing model:

1. **Unit Tests (`tests/unit/`)**:
   - Built with Vitest and `@testing-library/react`.
   - Tests pure deterministic algorithms, metric calculations, and URL/manifest parsers.
   - Run rapidly on every commit.

2. **End-to-End Tests (`tests/e2e/`)**:
   - Built with Playwright.
   - Validates user workflows, page navigation, interactive island state, and responsive viewports.

---

## 6. Deployment Direction

- GitKit is compiled with `@astrojs/cloudflare` targeting Cloudflare Workers.
- Staging and preview builds deploy to Cloudflare's `workers.dev` subdomain automatically via CI.
- **Custom Domain (`gitkit.in`)**: The custom domain has **not** been purchased yet. Do NOT configure DNS records or hardcode domain dependencies until confirmed.
