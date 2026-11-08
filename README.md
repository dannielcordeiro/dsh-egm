<p align="center">
  <img src="packages/core/icon.svg" width="88" height="88" alt="dsh-egm mark: an elephant head and a goldfish tail split down the middle">
</p>

<h1 align="center">dsh-egm</h1>

<p align="center"><strong>Design with an elephant. Review with a goldfish. Route each one to its own model.</strong></p>

<p align="center">
  <a href="#install">Install</a> &ensp;·&ensp;
  <a href="#the-model">The model</a> &ensp;·&ensp;
  <a href="#routes">Routes</a> &ensp;·&ensp;
  <a href="#surfaces">Surfaces</a> &ensp;·&ensp;
  <a href="#compatibility-and-limits">Limits</a> &ensp;·&ensp;
  <a href="docs/architecture.md">Architecture</a>
</p>

The [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) — EGM — separates the
design conversation from independent criticism. **dsh-egm** runs that model inside
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and adds the two things a host
usually gets wrong: the reviewer is genuinely isolated, and the human can say which model does which job.

- **Upstream text, unchanged.** The seven skills, ten reviewer personas and five document standards are
  vendored byte-for-byte from a pinned upstream commit, with one SHA-256 per file. The harness layer is
  injected at registration, never written into those files.
- **A model per role, optionally.** The Elephant, a phase, or any reviewer persona can use its own
  provider, model, effort and output cap. A role with no route inherits the session model, which is what
  upstream expects.
- **Two scopes.** The profile (shared by every project) and `.dsh/egm.yaml` inside a project
  (versioned with the code), plus a session override.
- **A run you can see.** Phase, review stages, every reviewer with its route and token count, and the
  artifacts it produced — in the terminal and in the browser.

## Install

Requires DeepSeek Harness `>=0.2.1-rc.5 <0.3.0` and Node 22 or 24.

```bash
# the host half and the browser half are two packages
dsh plugin --profile dsh-tui add /path/to/dsh-egm/packages/core
dsh plugin --profile dsh-tui add /path/to/dsh-egm/packages/ui

dsh plugin --profile web add /path/to/dsh-egm/packages/core
dsh plugin --profile web add /path/to/dsh-egm/packages/ui
```

Restart the profile. The browser package disables its own row in a profile that has no Web shell, so the
same two commands are correct in both.

Profiles seeded from the `headless` or `sdk` templates compose no agent-preset registry. Start them with
the opt-in prerequisite overlay:

```bash
dsh headless --patch <installed package>/adapters/prereqs/agent-presets.patch.yml
```

Check the composition with `/egm doctor` in the session. It reports the skill registry, the command
registry, the run projection, the `egm-reviewer` preset, the in-process `spawn` provider, delegation
depth, every provider's catalogue and credentials, the workspace file and every configured route,
each with the fix next to a failure.

## The model

| Role | Who it is | What it does |
| --- | --- | --- |
| **Elephant** | the session you are talking to | explores the problem, drafts the design, resolves findings |
| **Goldfish** | a fresh, read-only child | reviews the written design without the conversation that produced it |
| **You** | — | decide the trade-offs, approve the design, and own the outcome |

Seven skills, all user-invoked:

`/egm-brainstorm` · `/egm-draft` · `/egm-review` · `/egm-review-loop` · `/egm-resolve` ·
`/egm-bootstrap` · `/egm-drift-report`

A review runs five stages in order — Initial Zoom Out, Comprehension, Design Critique, Intermediate Zoom
Out, Implementation Readiness. Reviewers inside a stage run in parallel; the stages never do. At the start
of any phase the Elephant calls `egm_begin`, which applies the model configured for that phase.

## Routes

Configure a route anywhere, in decreasing precedence:

1. **Session** — `/egm model set <role> <route> --session`. Recorded in the session log, so it survives a
   resume and does not leak into other sessions.
2. **Workspace** — `.dsh/egm.yaml` in the project, found by walking up to the repository root:

   ```yaml
   # .dsh/egm.yaml — routes for this project
   routing.elephant: anthropic/claude-sonnet-5-5#high
   routing.phases.review: deepseek-official/deepseek-v4-pro
   routing.reviewers.design_critic: anthropic/claude-sonnet-5-5#high
   routing.reviewers.default: ollama/lumi-4b
   maxTokens.policy: model-default
   ```

3. **Profile** — `/egm model set <role> <route>` writes the `egm` row of the profile patch through the
   harness configuration editor, so it is `cordis.patch.yml`, not a private store.
4. **Inherit** — nothing configured means the child uses the caller's model, exactly as before.

Roles are the Elephant (`elephant`), the bootstrap workers (`worker`), the phases
(`brainstorm`/`draft`/`review`/`resolve`/`bootstrap`/`drift`), the catch-all (`default`) and every
reviewer persona: `zoom_out`, `comprehension`, `design_critic`, `structural`, `style`,
`implementation_readiness`, `codebase_details`, `inventive_catalyst`, `synthesizer`,
`bootstrap_orchestrator`.

A route is `provider/model` with an optional `#effort`. Three policies keep the failure modes honest:

- `routing.onInvalidRoute: fail` (default) — a configured but unusable route stops the reviewer with the
  fix in the message. `inherit` falls back to the caller's model and says so.
- `routing.onMissingRole: inherit` (default) — a role with no route inherits.
- `maxTokens.policy: model-default` (default) — when a child's model differs from the caller's, the output
  cap comes from the child's own model instead of leaking the caller's. `inherit` and `fixed` are the
  alternatives.

`pricing.<provider>/<model>` accepts `{input, output, cacheRead, cacheWrite}` per million tokens; the run
view then reports an estimated cost and counts the children it could not price instead of pretending
they were free.

Commands: `/egm status`, `/egm routes [--json]`, `/egm model [show|set|reset|test]`, `/egm phase`,
`/egm stage`, `/egm review preset`, `/egm artifacts`, `/egm report [--json]`, `/egm doctor`,
`/egm workspace`. Every command answers as text and, where a screen needs it, as JSON.

## Surfaces

**Terminal (`dsh-tui`)** — a footer field with the phase and the current route (click it for the run
panel), a side panel with the stage stepper and one row per reviewer, `/egm` completion including role
names, an EGM section under `/settings` for the two most-used routes and the token policy, and a
provider → model → effort picker behind `/egm model`.

**Browser (Web profile)** — a chip in the composer with the phase, the reviewers and their tokens; a
compact card for every reviewer activation; and an EGM page under Settings that explains both scopes with
a ready-to-copy `.dsh/egm.yaml`.

Neither surface is required: the same plugin gives skills, tools and commands in a headless profile.

## Safety

A Goldfish reviewer runs in the `egm-reviewer` preset — persona, read-only file tools, file search,
compaction — and the plugin mounts a guard inside that scope which hides every tool outside a read-only
allowlist and denies any non-allowlisted call. Two layers, because a tool published later is still
denied. Reviewers are single-use: `send_message` to a reviewer is refused, and a truncated answer is
replaced by a fresh reviewer.

That is tool isolation, not a filesystem sandbox. A reviewer can read and search whatever its tools
reach, and the host may inject project instructions such as `AGENTS.md`. Reading lists and file
boundaries in the skills are workflow instructions, not allowlists. Do not treat a reviewer as a
confidentiality boundary.

## Compatibility and limits

- DeepSeek Harness `0.2.2-rc.1` is the development target; the package declares `>=0.2.1-rc.5 <0.3.0`.
  The test suite runs against a simulated host and a real Cordis instance, not against a live model.
- The Elephant must be at delegation depth 0: inside a workflow or a goal, a reviewer cannot start, and
  `/egm doctor` says so before you try.
- A route whose provider has no credentials fails at the first request; `/egm doctor` detects the empty
  catalogue first.
- `maxTokens` on a same-model child still inherits, which is what the harness does; the policy only
  intervenes when the route changes.
- There is no cross-session project index in this version: the run view is durable per session.
- The terminal side panel API is experimental upstream; the plugin treats every terminal surface as
  optional and degrades to text.

## Provenance

The vendored content is Copyright Google LLC, Apache-2.0, pinned in
[`packages/core/upstream.lock.json`](packages/core/upstream.lock.json) and redistributed unchanged; see
[`NOTICE`](NOTICE). The harness layer is original work in this repository under the same license.
`npm run vendor:sync` refreshes the snapshot and rewrites the lock; `npm run vendor:verify` fails when a
vendored byte drifts, and CI runs it on every push.

dsh-egm is an independent community port, not affiliated with, endorsed by, or supported by Google.
