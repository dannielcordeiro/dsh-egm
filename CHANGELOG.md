# Changelog

## 1.0.0 — 2026-11-07

First release of the two-package product.

**Core (`@local/dsh-egm`)**

- Vendored upstream EGM at `e9e1f06`: seven skills, ten reviewer personas (including the new
  `inventive_catalyst`), five document standards and the shared resources, byte-identical, with one
  SHA-256 per file in `upstream.lock.json` and an offline gate in CI.
- Harness integration injected at registration: paths, `egm_begin`, `egm_reviewer`, `egm_worker`,
  single-use reviewers, stage sequencing, gates and artifact placement.
- Per-role model routing: Elephant, phases, workers and every reviewer persona, with the profile,
  `.dsh/egm.yaml` and a session override, in that precedence.
- Read-only isolation in two layers: the `egm-reviewer` preset and its own guard row inside that scope.
- `egm_reviewer`, `egm_worker`, `egm_begin`; route validation before any child exists; output-token
  policy that asks the target model for its own cap.
- `/egm` command: `status`, `routes`, `model`, `phase`, `stage`, `review preset`, `artifacts`, `report`,
  `doctor`, `workspace`, each answering as text and, where useful, as JSON.
- Durable run projection (`egmRun`) plus in-process live facts: phase, stages, reviewers with route and
  tokens, artifacts, optional cost estimate.
- Terminal surfaces: footer field, side panel, command tree, settings section, provider→model→effort
  picker — all optional.

**Browser (`@local/dsh-egm-ui`)**

- Composer chip with the phase, the reviewers, their routes and tokens, refreshed from `/egm report`.
- Compact card for every reviewer activation.
- EGM page under Settings describing both scopes with a ready-to-copy `.dsh/egm.yaml`.
- Loads only where the Web shell is composed; its row disables itself elsewhere.

**Also**

- Opt-in prerequisite overlay for profiles without an agent-preset registry (`headless`, `sdk`).
- CI running the vendor gate, the syntax check and both test suites on Node 22 and 24.
