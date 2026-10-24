# GitKit

> **Understand. Analyze. Visualize. Your repositories.**

GitKit is a free, open-source-friendly, deterministic developer toolkit for understanding, analyzing, visualizing, and inspecting GitHub repositories.

---

## What GitKit Is

- A fast, client-and-edge powered repository inspection workspace.
- A deterministic analysis platform powered by AST parsing, static analysis, graph algorithms, and Git history inspection.
- An interactive visualizer for codebases (dependency topologies, file architectures, commit flows).
- ₹0 operational cost architecture designed for edge deployment on Cloudflare.
- 100% reproducible and verifiable: every metric and graph has clear, inspectable code formulas.

## What GitKit Is NOT

- **NOT an AI/LLM wrapper**: GitKit contains **zero AI/LLMs**. It does not use OpenAI, Gemini, Claude, or any generative models. There are no hallucinatory summaries or nondeterministic scores.
- **NOT a GitHub clone**: It does not host repositories, issues, or pull requests.
- **NOT a simple redirector**: It provides deep, actionable static analysis and visualizations instead of bouncing the user back to GitHub.
- **NOT a paid SaaS**: It is built to run on free and open-source infrastructure without recurring subscription paywalls.

---

## Core Flow & Workspaces

Given any public GitHub repository:

```text
https://github.com/{owner}/{repo}
```

GitKit provides an interactive, deterministic intelligence workspace:

| Workspace Route                | Analytical Capability    | Core Engine                                                                             |
| :----------------------------- | :----------------------- | :-------------------------------------------------------------------------------------- |
| `/{owner}/{repo}`              | **Overview**             | Deterministic metrics, health score preview, security posture, file tree                |
| `/{owner}/{repo}/map`          | **Interactive Map**      | Hierarchical file tree topology, node collapse, React Flow canvas                       |
| `/{owner}/{repo}/dependencies` | **Dependency Graph**     | Concrete AST imports, manifest parsing, cycle detection, PageRank                       |
| `/{owner}/{repo}/git`          | **Git History**          | Commit timeline, weekly activity velocity, deterministic hotspots formula               |
| `/{owner}/{repo}/pulls`        | **Pull Requests**        | PR list, status filtering, blast radius analysis, changed files                         |
| `/{owner}/{repo}/health`       | **Repository Health**    | Transparent 7-category rule assessment, evidence-based score (0–100)                    |
| `/{owner}/{repo}/security`     | **Security Audit**       | Deterministic secret detection, Gitleaks rules, OSV vulnerability advisory              |
| `/{owner}/{repo}/diagram`      | **Architecture Diagram** | Deterministic subsystem synthesis, Mermaid compiler, pan/zoom canvas, 4x PNG/SVG export |
| `Global Export`                | **Multi-Format Export**  | Standalone SVG, 2x Retina PNG, Mermaid flowchart, JSON Schema v1.0                      |

_(Note: The domain `gitkit.in` is reserved for future launch. Development and staging use Cloudflare preview/workers.dev targets)._

---

## Technology Foundation

- **Framework**: [Astro 5](https://astro.build/) (Island Architecture, edge serverless rendering)
- **UI & Islands**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Target Platform**: Cloudflare Workers / Pages via `@astrojs/cloudflare`
- **Testing**: [Vitest](https://vitest.dev/) (Unit), [Playwright](https://playwright.dev/) (E2E)
- **Code Quality**: Strict TypeScript, ESLint 9, Prettier
- **Continuous Integration**: GitHub Actions CI workflow

---

## Quick Start

### Prerequisites

- Node.js >= 20 (v24 LTS recommended)
- npm >= 10

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/gitkit.git
cd gitkit

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

### Quality & Testing

```bash
npm run typecheck    # Verify strict TypeScript
npm run lint         # Check ESLint rules
npm run test         # Run unit tests via Vitest
npm run test:e2e     # Run E2E tests via Playwright
npm run build        # Production build for Cloudflare
```

---

## Documentation

Detailed architectural and engineering documentation is available in the [`docs/`](./docs) directory:

- [Architecture Guide](./docs/architecture.md)
- [Development Workflow](./docs/development.md)
- [Architecture Decision Records (ADRs)](./docs/decisions.md)
- [Roadmap & Milestone Plan](./docs/roadmap.md)
- [Engineering Guardrails](./AGENTS.md)

---

## License

MIT License. Open source and community-focused.
