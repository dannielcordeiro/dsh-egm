# Architecture

Two packages, one product. The split is not cosmetic: a package that declares a
browser half (`dsh.client`) must resolve from exactly one active Loader source,
and the host half needs several rows — the plugin itself, the reviewer preset and
the read-only guard inside that preset. So the host lives in `packages/core` and
the browser surfaces in `packages/ui`.

```
                 ┌───────────────────────────── profile ─────────────────────────────┐
                 │                                                                    │
  /egm-<skill>   │  egm  ── registers skills, tools, /egm, projection, tui surfaces   │
     ────────────┼──▶   │                                                              │
                 │      ├─ skills.js   vendored SKILL.md + <dsh_integration> preamble  │
                 │      ├─ reviewer.js egm_reviewer / egm_worker / egm_begin           │
                 │      ├─ router.js   session → workspace → profile → inherit         │
                 │      └─ projection.js  egmRun (durable) + live.js (in-process)      │
                 │                                                                    │
                 │  egm-ui ── disabled unless the Web shell is composed               │
                 │      └─ client.js   chip · reviewer card · settings page            │
                 │                                                                    │
                 │  preset-egm-reviewer ── persona · tool-fs(read) · tool-fs-search    │
                 │      └─ egm-guard ── deny-list + call guard in the child scope      │
                 └────────────────────────────────────────────────────────────────────┘
```

## Why a reviewer is a `spawn` child

`ctx.subagents.startActivation({ provider: 'spawn', request: { parent, agentPreset, agentOptions, maxDepth } })`
creates a child session with its own composition and no parent transcript. The plugin:

1. resolves the role (explicit argument, or the `Persona:` line of the envelope) and the route;
2. validates the route with `llm.resolveCallConfig` **before** any child exists;
3. chooses the output-token cap from the policy;
4. starts the child with `agentOptions` and the `egm-reviewer` preset;
5. records the activation in `live.js` so the run view can show its route, status and tokens.

`maxDepth` comes from `ctx.subagents.resolveMaxDepth()`, so the host's own cap applies. A reviewer is
single-use: its id goes into a set that a `send_message` guard checks.

## Why the route lives in three places

- The **session** override is a durable fact: `/egm model set … --session` is a logged command, and the
  projection folds `command/run` + `command/done` into `state.overrides`. It survives resume and dies with
  the session.
- The **workspace** file is read at activation time, cached by path + mtime. It travels with the
  repository, is reviewable in a pull request, and is parsed by a deliberately tiny YAML subset so there
  is no dependency and a malformed line is reported with its number.
- The **profile** layer is written through `ctx.get('configEditor').edit(ctx.fiber.entry, …)`, which keeps
  comments and `!!js` expressions and rejects a write when a higher patch layer overrides the field. This
  is why a route edit never means hand-editing `cordis.patch.yml`.

Precedence is resolved in `router.js`, which also reports provenance so `/egm routes` and the UIs can say
*why* a role uses what it uses.

## Why the run state is a projection

`sessionProjections.register({ key: 'egmRun', stateSchema, init, apply, wire })` folds the session log
into plain JSON: phases from commands and `egm_begin`, children from `subagent/catalog` paired with the
tool call that started them, settlement notices, artifact writes and token usage.

Two rules matter:

- the fold is pure and returns the same reference for an event it does not track, so the registry can
  cache it;
- the wire `view` is where process-local facts enter — the route a child actually started on, its live
  status and its tokens — because those are not in the log.

A plugin cannot add forwarded events or a typert remote in plain JavaScript, so the browser reads the
projection and calls `/egm … --json` through the command channel. One code path, two surfaces,
no private bridge.

## Why `/egm-*` are skills, not commands

The seven EGM entry points are registered in the Harness **skill** registry, and only one slash command
(`/egm`) is registered by this plugin. The `/egm-<phase>` entries you see in the terminal come from the
terminal itself: `@deepseek-harness-tui/dsh-tui` mirrors every user-invocable skill into its command
registry (`lib/types/dsh-adapter/channel/skill-catalog.js`), with `recordInput: false`, and it skips a
name that a command already owns (`commandService.find(target, name) !== undefined`).

That is deliberate. Registering our own `/egm-review` command would collide with the mirror: one of the
two would win silently — either the skill body would never reach the model, or the command would never
run — and the user would have no way to tell which. So:

- the skill stays the single invocation path, in the terminal and in the browser;
- phase routing happens inside the session, through `egm_begin`, which the injected preamble asks for at
  the start of every phase;
- when the terminal delivers `/egm-review`, it logs a `command/run` named `egm-review`, which the
  projection already folds into the phase, so the run view learns the phase from either surface.

## Why the browser never calls a command

A command result is appended to the session as `command/done` and rendered as a local transcript block.
Polling `/egm report --json` from a surface therefore floods the conversation and the host log — one open
browser session produced hundreds of multi-kilobyte entries. The browser half is read-only by
construction: it renders the `egmRun` projection, and every change goes through `/egm …`, typed by the
human, exactly as in the terminal. `packages/ui/test/client.test.js` fails if the bundle ever references
`remote.commands.execute` or a polling timer.

## Why `/egm …` output needed a renderer in the browser

The web folds `command/run` + `command/done` into a chat node whose body comes from the keyed slot
`conversation.chat.commandview`, keyed by the command name. An unoccupied key falls back to a generic card
that carries no text, so a third-party command ran, logged its lifecycle and showed nothing on screen.
`packages/ui` now registers that key for `egm` and renders the command line plus its outcome text.

The terminal needs none of this: it prints command results as a local block.

What the browser does not have is the terminal's nested completion: there, `tuiCommandTrees` expands
`/egm model …` into roles and stages. In the browser the `/` list is flat.

## Terminal surfaces

`tuiStatus.setField`, `tuiPanels.register`, `tuiCommandTrees.register`, `tuiSettingsSections.register` and
`tuiDialogs` are all probed with `ctx.get(name, false)` and skipped when absent. A refusal is logged and
never thrown: a terminal that rejects one surface must not take the plugin down.

## Failure behaviour

| Situation | Result |
| --- | --- |
| No `agentPresets` service | `egm_reviewer unavailable: the agent-presets service is not composed…` |
| No in-process `spawn` provider | `egm_reviewer unavailable: no in-process "spawn" subagent provider is composed` |
| `egm-reviewer` preset missing or broken | `egm_reviewer unavailable: … reinstall @local/dsh-egm` |
| Configured route unusable, `onInvalidRoute: fail` | the reviewer does not start; the message names the route and the command that fixes it |
| Configured route unusable, `onInvalidRoute: inherit` | the child inherits the caller's model and the tool result carries a note |
| Malformed `.dsh/egm.yaml` | the reviewer does not start; the message names the file, the line and the expected syntax |
| Calling agent already at the depth cap | `/egm doctor` reports it; starting a reviewer fails with the depth error |
| `send_message` to a reviewer | refused with the single-use notice |
| No skill registry | the plugin activates, logs a warning and registers no skills |
