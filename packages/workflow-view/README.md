# `@local/dsh-workflow-view`

A side-panel view of the runs the DeepSeek Harness `workflow` tool starts: one row per run, its
phases, and every member agent — live status, the route each member was created with, tokens, and a
link into each member's session.

It is an independent package: nothing here depends on `dsh-egm`, and installing one does not install
the other.

## What it reads

The Harness already writes the lifecycle of every run to the session log:

```
tool-workflow/run-start    { runId, name }
tool-workflow/agent-start  { runId, seq, label, phase?, childId }
tool-workflow/agent-end    { runId, seq, outcome }
tool-workflow/run-end      { runId, stopReason }
```

The host half folds those into the `workflowRuns` session projection. The browser tab merges that view
with the host's `subagentCatalog` (route per member) and the client session store (live `running` and
tokens). Nothing polls and no command is executed, so opening the tab costs nothing to the transcript.

**Not durable, by design:** `workflow/log` and `workflow/phase` — the script's narration — never reach
the session log. The tab therefore shows runs, members, phases (from members), status and usage, and
never pretends to have the script output.

## The screen

- **Session totals** in the header: runs, members, failures, tokens.
- **Run list** with a status dot, age, duration, member count and a micro bar of the run's
  completed/running/failed split.
- **Selected run card**: status, start (relative), duration, member and failure counts, a segmented
  progress bar and a colour legend.
- **Phase timeline**: each member gets a proportional **duration bar** placed inside the run's span, so
  parallel members are visible; a running member extends to now with a hatched bar.
- **Member detail** (click the label): seq, child session id with copy, route, mode, start clock and
  duration.
- **Density** toggle (comfortable/compact), remembered per browser.
- Every colour is a `--dsw-alias-*` theme token or a mix of one, so light and dark follow the host.

## Use

1. Install into the profile and restart:

   ```bash
   dsh plugin --profile web add /path/to/dsh-egm/packages/workflow-view
   ```

2. In a session, click **⧉ Workflows** in the session header (it carries the run count) to open the
   tab in the right column.
3. Pick a run at the top; the timeline groups members by phase. **Open** jumps to the member session,
   **⇥** opens it beside the chat.

Runs with no `run-end` stay visible as running/unknown instead of disappearing, and a `failed` member
inside a completed run is reported as such.

## Configuration

| Row field | Default | Meaning |
| --- | --- | --- |
| `maxRuns` | `50` | Runs the projection keeps and ships to the browser |

## Limits

- One session's runs only; a workflow started inside a child session is not shown here.
- Members are identified by `childId`; a member with no catalog entry shows `no route` but stays
  openable.
- Script output and live job logs are out of scope (see above).
- The tab needs the Web shell; in the terminal profile the row disables itself.
