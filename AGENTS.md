# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## SaaSGuard decisions

- Follow the user's Figma v2: https://www.figma.com/design/7ooEdCaHVh4rrrBjXlipuA/SaaSGuard?node-id=0-1&p=f.
- The user chose React + TypeScript for a free local MVP and a private GitHub repository. This is a provisional change from the TP's no-code proposal; explain it separately in `docs/decision-tecnologica.md`.
- Do not modify earlier TP documents, Drive deliverables or Trello boards as part of app development. The user reserves that decision for the team.
- Commit source and synthetic fixtures only. Personnel CSVs and downloaded reports must stay out of Git.
- Preserve human review, unknown-versus-zero costs, explicit checklist selection and local-session deletion. The app does not verify inactivity, cancel accounts, authenticate operational roles or prove realized savings.
