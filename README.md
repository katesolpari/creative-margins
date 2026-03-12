# Fertile Margins

**Find structural homologies across disciplines.**

Fertile Margins is a tool for interdisciplinary thinking. Paste texts from two or more fields and the system identifies deep structural parallels — shared patterns, transferable methods, isomorphic problems — that neither field sees on its own.

It is built on a specific premise: that the most generative ideas emerge not within disciplines but at their boundaries. A surgeon and an architect may never meet, but the cognitive structure of navigating anatomical variation and the cognitive structure of adaptive reuse share a formal skeleton that, once named, becomes a source of transferable insight.

## What it does

1. **Structural analysis.** Given texts from different fields, the system extracts connections that go beyond surface similarity. "Both involve complex systems" is not a connection. "Both use negative feedback loops to maintain homeostasis under perturbation, but Field A has formalized the control theory while Field B relies on heuristic titration" is.

2. **Bidirectional transfer.** For each connection, the tool suggests concrete techniques or frameworks that could move from Field A to Field B and vice versa.

3. **False homology detection.** Not every analogy holds. The system flags parallels that look tempting but break down on inspection, and names exactly where they fail.

4. **Generative questions.** Each analysis produces research questions that emerge from the intersection. Click any question to explore it further — the tool surfaces relevant existing work, applicable methods from each field, and a sketch of what a study might look like.

5. **Deepen.** Take any connection and test whether the pattern extends to a third field. Does the structural parallel hold, transform, or break? This is how you find out whether you've identified a local analogy or a deep isomorphism.

6. **Export.** Copy any analysis as Markdown for use in writing, proposals, or research notes.

## Setup

```
npm install
npm run dev
```

Requires access to the Anthropic API. The app runs as a client-side React application and makes API calls directly. Configure your API key via the Anthropic artifact environment or set up a proxy for local development.

## Examples

The app ships with three curated text pairs:

- **Epidemiology × Beekeeping** — Sentinel surveillance and colony-level diagnostics as parallel information-processing systems.
- **Surgery × Architecture** — Intraoperative decision-making and adaptive reuse as instances of navigating constraint under uncertainty.
- **Perfumery × Diagnostics** — Temporal layering in fragrance composition and differential diagnosis as choreographed unfolding.

Additional example pairs are in the [`examples/`](./examples) directory.

## Architecture

Single-page React app. No backend, no database, no user accounts. All state lives in the browser session. The tool makes three types of API calls:

- **Analyze**: Primary structural analysis of input texts
- **Explore**: Deep dive into a specific generative question
- **Deepen**: Test whether a connection extends to a new field

System prompts are structured to return JSON, which the UI parses and renders directly.

## License

MIT
