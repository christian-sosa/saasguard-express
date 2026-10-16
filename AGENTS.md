# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## SaaSGuard decisions

- Follow the user's Figma v2: https://www.figma.com/design/7ooEdCaHVh4rrrBjXlipuA/SaaSGuard?node-id=0-1&p=f.
- The initial prototype used React + TypeScript instead of the TP's original no-code proposal. The Drive advances dated 08/10/2026 and 16/10/2026 now document React + TypeScript, local-session processing and no authentication as the adopted MVP scope; see `docs/decision-tecnologica.md`. Do not describe the current stack as awaiting a technology choice or claim the paid multiuser product is implemented.
- Do not modify earlier TP documents, Drive deliverables or Trello boards as part of app development. The user reserves that decision for the team.
- Commit source and synthetic fixtures only. Personnel CSVs and downloaded reports must stay out of Git.
- Preserve human review, unknown-versus-zero costs, explicit checklist selection and local-session deletion. The app does not verify inactivity, cancel accounts, authenticate operational roles or prove realized savings.
- On 16/10/2026 the user authorized choosing the stack and deploying the academic MVP for free on Vercel. Keep React + TypeScript + Vite and client-side CSV processing. Fábrica de Fútbol has real users on Supabase Free: do not change that project's database, Auth, settings or keys for SaaSGuard. The current MVP does not need Supabase; add cloud persistence only when a concrete feature requires it, in an independent free project if available. Do not enable paid services or buy a domain.
- Visual preference from 16/10/2026: the app fills the viewport with its white surface on desktop and mobile. Do not restore the dark outer frame, centered maximum-width shell, outer margins or rounded shell corners. Keep spacing and styling inside the app.
- Retention update from 16/10/2026: each audit expires at the next 00:00 in `America/Argentina/Buenos_Aires` (currently 03:00 UTC), with an absolute maximum of 24 hours from its start. Activity must not renew the deadline. Clear the in-memory audit and invalidate pending async reads on expiry; manual close and reload can discard it earlier. Pilot aggregates in `localStorage` must also expire by Argentina calendar day, including after an audit was manually closed. Remove previous-day, future and invalid aggregates when reading storage. A suspended or closed browser performs cleanup when the app resumes or opens; do not describe this as a server cron job or database deletion. Keep the app client-side, with no new Supabase or Vercel backend, and never delete original CSVs or downloaded reports from the user's disk.
- Synthetic manual-test sets live in `fixtures/pruebas/`, with `GUIA.txt` instructions and `expected-results.json`. Their shared Drive folder is https://drive.google.com/drive/folders/1i1J6-JrD6jGmc6fOfWLYmAj0pHw1pOBO. The four sets cover a small audit, a medium audit across providers with unknown/zero costs, the global 250-person/1,000-license limit, and invalid CSVs paired with corrected files. Keep all fixtures synthetic; do not modify historical academic Drive deliverables when maintaining these tests.
