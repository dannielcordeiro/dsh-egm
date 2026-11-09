/**
 * The durable run model.
 *
 * The Harness `workflow` tool writes only run and member lifecycle to the session
 * log — `tool-workflow/run-start`, `agent-start`, `agent-end`, `run-end`. The
 * script's narration (`workflow/phase`, `workflow/log`) is deliberately not
 * durable, so this projection never pretends to have it.
 *
 * The fold is pure and synchronous, returns the same reference for events it does
 * not track, and keeps only plain JSON so the registry can cache it and replay it
 * after a restart.
 */

/** Projection key the browser reads with `useProjection`. */
export const PROJECTION_KEY = 'workflowRuns'

/**
 * Bump when the state shape or the derived view changes. Version 2 derives
 * `open` for a lifecycle that never closed, so a checkpoint written under the
 * old `running` derivation is discarded instead of trusted.
 */
export const STATE_VERSION = 2

/** Initial state for an empty session. */
export function initState() {
  return { runs: {} }
}

/** Clone-on-write helper: replace one run, keep the rest identical. */
function withRun(state, runId, update) {
  const current = state.runs[runId]
  const next = update(current ?? { runId, name: null, startedAt: null, agents: {} })
  return { ...state, runs: { ...state.runs, [runId]: next } }
}

/** Replace one member of a run. */
function withAgent(run, seq, update) {
  const key = String(seq)
  const current = run.agents[key] ?? { seq, label: null, phase: null, childId: null, startedAt: null }
  return { ...run, agents: { ...run.agents, [key]: update(current) } }
}

/**
 * Fold one committed session event.
 * @param {object} state current state.
 * @param {{type: string, data?: object, time?: number}} event one session event.
 */
export function applyEvent(state, event) {
  const data = event?.data ?? {}
  const at = Number(event?.time ?? 0)
  switch (event?.type) {
    case 'tool-workflow/run-start': {
      const runId = String(data.runId ?? '')
      if (runId === '') return state
      return withRun(state, runId, (run) => ({
        ...run,
        name: typeof data.name === 'string' && data.name !== '' ? data.name : run.name,
        startedAt: run.startedAt ?? at,
      }))
    }
    case 'tool-workflow/agent-start': {
      const runId = String(data.runId ?? '')
      if (runId === '' || data.seq === undefined) return state
      return withRun(state, runId, (run) => withAgent(run, data.seq, (agent) => ({
        ...agent,
        label: typeof data.label === 'string' ? data.label : agent.label,
        phase: typeof data.phase === 'string' && data.phase !== '' ? data.phase : agent.phase,
        childId: typeof data.childId === 'string' ? data.childId : agent.childId,
        startedAt: agent.startedAt ?? at,
      })))
    }
    case 'tool-workflow/agent-end': {
      const runId = String(data.runId ?? '')
      if (runId === '' || data.seq === undefined) return state
      const run = state.runs[runId]
      if (run === undefined) return state
      return withRun(state, runId, (current) => withAgent(current, data.seq, (agent) => ({
        ...agent,
        outcome: typeof data.outcome === 'string' ? data.outcome : agent.outcome ?? 'completed',
        endedAt: at,
      })))
    }
    case 'tool-workflow/run-end': {
      const runId = String(data.runId ?? '')
      if (runId === '' || state.runs[runId] === undefined) return state
      return withRun(state, runId, (run) => ({
        ...run,
        stopReason: typeof data.stopReason === 'string' ? data.stopReason : 'completed',
        endedAt: at,
      }))
    }
    default:
      return state
  }
}

/**
 * Status of one member, from its own lifecycle only.
 *
 * A member with no `agent-end` is `open`, never `running`: the log cannot tell a
 * live worker from one killed by a crash or a reboot, and only the client's live
 * session flag may claim `running`.
 */
function agentStatus(agent) {
  if (agent.outcome === undefined) return 'open'
  if (agent.outcome === 'completed') return 'completed'
  if (agent.outcome === 'failed') return 'failed'
  return agent.outcome
}

/**
 * The wire view: runs newest first, members in `seq` order, statuses derived.
 * @param {object} state folded state.
 * @param {{maxRuns?: number}} [options]
 */
export function createView(state, options = {}) {
  const maxRuns = Number.isSafeInteger(options.maxRuns) && options.maxRuns > 0 ? options.maxRuns : 50
  const runs = Object.values(state.runs ?? {})
    .sort((left, right) => (right.startedAt ?? 0) - (left.startedAt ?? 0))
    .slice(0, maxRuns)
    .map((run) => {
      const agents = Object.values(run.agents ?? {})
        .sort((left, right) => left.seq - right.seq)
        .map((agent) => ({
          seq: agent.seq,
          label: agent.label ?? '',
          phase: agent.phase ?? null,
          childId: agent.childId ?? null,
          startedAt: agent.startedAt ?? null,
          endedAt: agent.endedAt ?? null,
          outcome: agent.outcome ?? null,
          status: agentStatus(agent),
        }))
      return {
        runId: run.runId,
        name: run.name ?? '',
        startedAt: run.startedAt ?? null,
        endedAt: run.endedAt ?? null,
        stopReason: run.stopReason ?? null,
        status: run.endedAt === null || run.endedAt === undefined ? 'open' : run.stopReason ?? 'completed',
        agents,
        failed: agents.filter((agent) => agent.status === 'failed').length,
      }
    })
  return { runs }
}

/** Plain-object schema for the persisted state. */
export const stateSchema = Object.freeze({
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('workflowRuns: invalid persisted state')
    }
    if (value.runs === null || typeof value.runs !== 'object') {
      throw new TypeError('workflowRuns: persisted state has no runs map')
    }
    return value
  },
})

/** Schema for the view that leaves the Host. */
export const viewSchema = Object.freeze({
  parse(value) {
    if (value === null || typeof value !== 'object' || !Array.isArray(value.runs)) {
      throw new TypeError('workflowRuns: invalid view')
    }
    return value
  },
})
