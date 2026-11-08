# Testing record

## Commands

```bash
npm install --include=dev       # NODE_ENV=production would omit the dev dependency
npm run verify                  # vendor lock + syntax + unit/integration tests
npm run vendor:verify           # offline: vendored bytes match upstream.lock.json
node --test packages/core/test/*.test.js
node --test packages/ui/test/*.test.js
```

## What the suites cover

| Area | Where | Checks |
| --- | --- | --- |
| Vendored upstream | `scripts/verify-vendor.mjs`, `test/manifest.test.js` | 27 files, one SHA-256 each, no unexpected file, the seventh persona present, the pin recorded |
| Config schema | `test/config.test.js` | defaults, `effort` alias, role normalisation, unknown role/phase reported, malformed config rejected, route grammar round-trip |
| Workspace file | `test/workspace.test.js` | dotted keys, comments, nested/list rejection with line numbers, unknown keys, discovery walking up, stop at the repository root, cache invalidation, snippet rendering |
| Personas | `test/personas.test.js` | ten roles from frontmatter, alias table, `Persona:` extraction, catalogue loaded once |
| Router | `test/router.test.js` | four-layer precedence, deliberate session `inherit`, phase → Elephant fallback, validation (unknown model, unsupported effort, unregistered provider), the three token policies, `agentOptions`, `applyToAgent` |
| Command grammar | `test/commands-parse.test.js` | tokenising, help, `--json`, picker, `model set/reset/test`, session vs profile scope, `inherit` semantics, validation errors |
| Run projection | `test/projection.test.js` | phase from a skill command and from `egm_begin`, session-only overrides, child pairing through `subagent/catalog`, settlement notices, artifact bucketing, usage accumulation, stage and cost derivation, unpriced children |
| Skills | `test/skills.test.js` | seven skills, upstream names and descriptions preserved, the preamble states every harness mechanic, the phase follows the skill |
| Host integration | `test/integration.test.js` | activation with a simulated host: seven skills, three tools, `/egm`, projection; reviewer route + token cap; inherit path; workspace override; fail-closed and inherit policies; malformed workspace; `egm_begin`; guard probe safety; default-route backstop; single-use refusal; command text and JSON; profile write through the config editor; activation with no optional service at all |
| Browser package | `packages/ui/test/client.test.js` | every surface registers (overlay window, chip with its session, `/egm` command row, reviewer card, settings page), both dictionaries carry the same keys, no timer and exactly one command call site, the bundle is generated and current, and the pure run logic: status precedence, token and duration formatting, route precedence, the three-source merge, the depth cap and a cycle |
| Host: catalogue | `packages/core/test/integration.test.js` | `/egm catalogue --json` returns providers and models |

Current result: **137 tests in `packages/core`, 12 in `packages/ui`, all passing**, plus the vendor gate and the client-bundle freshness check.

## Verified beyond the suites

| Check | Result |
| --- | --- |
| Guard module against a real Cordis instance (`Context` + `isolate` + a fake `tools` service) | activates with `inject: ['tools']`, `bash`/`write`/`send_message` denied, `read`/`grep` allowed, `restrict({deny: …})` measured from the visible set |
| Guard mounted twice in the same scope | harmless: two guards, same verdicts |
| Profile composition (`dsh --profile dsh-tui --dump-config`, `dsh --profile web --dump-config`) | `egm`, `preset-egm-reviewer` and `egm-guard` rows present in both; `egm-ui` enabled only where a Web client host is composed |
| Bundle install (`plugin_manager` / `dsh plugin … add`) | both packages link into both profiles without an activation error |

## Not yet verified

- **A live reviewer on a routed model.** Three attempts from the process that was already running when the
  package was installed fail with `dsh-egm reviewer isolation failed: cannot get property "guard" without
  inject` — the exact text of the superseded guard probe, which no longer exists in the source. That is
  direct evidence the process is executing the module graph it loaded before the install, not the tree in
  this repository, and it is why the check below needs a restart. After a restart,
  run this and confirm the child log names the routed provider and model:

  ```text
  /egm model set zoom_out deepseek-official/deepseek-flash --session
  # then ask the Elephant for a single reviewer on a short document,
  # or call egm_reviewer with `route: {provider, model}` directly
  # then inspect ~/.dsh/sessions/<workspace>/<childId>/session.v4.jsonl.zstd
  #   -> request/header.data.header.config {provider, model, reasoningEffort}
  ```

- **The browser surfaces.** No browser is connected in this environment. The client bundle is exercised
  through a stand-in module loader, which proves registration and payload shape, not the rendered result.
  Open the Web profile, open a session, and check the composer chip, a reviewer card and Settings → EGM.
- **A full EGM review end to end** with a real model, which costs tokens and needs a real design document.
- **The terminal panel, footer field and settings section** in a restarted process.
