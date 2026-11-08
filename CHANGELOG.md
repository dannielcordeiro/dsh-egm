# Changelog

## 1.1.0 — 2026-11-08

**Window (browser)**

- A full EGM window on the shell overlay, opened from the chip's "Details" and from
  every `/egm …` chat row, with four tabs: runs, configuration, artifacts and
  diagnostics. Escape closes it; it traps focus and never polls.
- Runs tab: the merged tree of the Elephant's descendants (children and
  grandchildren), each row with live status, role, stage, route, tokens and
  duration, plus "open session" and "open beside".
- Configuration tab: one row per role with the effective route, its provenance,
  and Apply-to-profile / Apply-to-this-session / Clear / Test. The model catalogue
  loads only when the button is pressed.
- Artifacts and diagnostics tabs; the doctor report renders inside the window.

**Corrections**

- The chip no longer reports a stale status: live `running`, timing and tokens come
  from the client session store, not from the plugin's in-process map, so a running
  reviewer shows as running and settles when it ends. Generic `subagent` children
  now appear too.
- The tree is no longer truncated to the last eight children.

**Host**

- `/egm catalogue [--json]` lists providers, models and efforts for the
  configuration tab.

**Corrections after the first browser test**

- The window is no longer registered on `shell.overlay` (which mounted nothing for
  this package): the composer chip portals it to `document.body`, and falls back
  to rendering in place when `react-dom` is unavailable, so "Details" always does
  something.
- A defect inside the window now shows an error inside the dialog instead of
  tearing down the composer (error boundary).
- Opening from a chat row whose slot omits the session id reuses the session the
  chip published.

**Configuration tab**

- `default`, `reviewer`, `reviewers`, `any`, `todos` and `padrao` all address the
  catch-all reviewer role; the parser's refusal now lists the accepted kinds.
- The route field shows the effective route and Apply sends what the screen shows;
  before, an untouched row sent an empty draft and did nothing.
- Apply/This session are disabled while the field is empty.
- Phase names are roles: `brainstorm`, `draft`, `review`, `resolve`, `bootstrap` and
  `drift` are accepted wherever a role is named. Before, every phase row failed
  with `unknown role "<phase>"`, which is what Test hit first.
- Test targets the typed route when the field holds one (`provider/model`), and the
  role's current route otherwise.
- The command line is built by a tested helper: the row object was being
  interpolated, so every Apply sent `/egm model set [object Object] …` and the
  host answered "unknown role".
- Apply then stopped running anything at all: the handler still named a variable
  that no longer existed, threw before building the command, and the rejection was
  swallowed by `void`. A pure `applyPlan()` now decides the command (or the
  reason) and every click surfaces its failure in the window.

**Repository**

- The browser bundle is generated from ordered parts by
  `scripts/bundle-client.mjs` (`npm run build:client`); CI fails when the checked-in
  file is stale. The client bundle now has 9 parts instead of one 900-line file.

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
