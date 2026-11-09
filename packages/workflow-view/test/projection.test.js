import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECTION_KEY, STATE_VERSION, applyEvent, createView, initState, stateSchema, viewSchema } from '../src/projection.js'

/**
 * The fixture is the real run set recorded in the `to-lexml-converter` workspace
 * (session 6e46e30c…): four runs, seven members, one failed member inside a
 * completed run, and one run that never ended.
 */
const FIXTURE = [
  { type: 'tool-workflow/run-start', time: 1_000, data: { runId: 'r-smoke', name: 'smoke-deepseek-route' } },
  { type: 'tool-workflow/agent-start', time: 1_010, data: { runId: 'r-smoke', seq: 1, label: 'smoke', childId: 'c-smoke' } },
  { type: 'tool-workflow/agent-end', time: 1_500, data: { runId: 'r-smoke', seq: 1, outcome: 'completed' } },
  { type: 'tool-workflow/run-end', time: 1_600, data: { runId: 'r-smoke', stopReason: 'completed' } },

  { type: 'tool-workflow/run-start', time: 2_000, data: { runId: 'r-a', name: 'fase0-etapa-a' } },
  { type: 'tool-workflow/agent-start', time: 2_010, data: { runId: 'r-a', seq: 1, label: 'esqueleto', phase: 'Etapa A', childId: 'c-esq' } },
  { type: 'tool-workflow/agent-start', time: 2_020, data: { runId: 'r-a', seq: 2, label: 'amostras-fontes', phase: 'Etapa A', childId: 'c-amo' } },
  { type: 'tool-workflow/agent-end', time: 2_400, data: { runId: 'r-a', seq: 1, outcome: 'completed' } },
  { type: 'tool-workflow/agent-end', time: 2_500, data: { runId: 'r-a', seq: 2, outcome: 'failed' } },
  { type: 'tool-workflow/run-end', time: 2_600, data: { runId: 'r-a', stopReason: 'completed' } },

  { type: 'tool-workflow/run-start', time: 3_000, data: { runId: 'r-b', name: 'fase0-etapa-b' } },
  { type: 'tool-workflow/agent-start', time: 3_010, data: { runId: 'r-b', seq: 1, label: 'B1-schema', phase: 'Etapa B', childId: 'c-b1' } },
  { type: 'tool-workflow/agent-start', time: 3_020, data: { runId: 'r-b', seq: 2, label: 'B2-models-texto', phase: 'Etapa B', childId: 'c-b2' } },
  { type: 'tool-workflow/agent-start', time: 3_030, data: { runId: 'r-b', seq: 3, label: 'A2-notas-fontes', phase: 'Etapa B', childId: 'c-a2' } },
  { type: 'tool-workflow/agent-end', time: 3_500, data: { runId: 'r-b', seq: 1, outcome: 'completed' } },
  { type: 'tool-workflow/agent-end', time: 3_600, data: { runId: 'r-b', seq: 2, outcome: 'completed' } },
  { type: 'tool-workflow/agent-end', time: 3_700, data: { runId: 'r-b', seq: 3, outcome: 'completed' } },
  { type: 'tool-workflow/run-end', time: 3_800, data: { runId: 'r-b', stopReason: 'completed' } },

  { type: 'tool-workflow/run-start', time: 4_000, data: { runId: 'r-doc', name: 'regras-do-time' } },
  { type: 'tool-workflow/agent-start', time: 4_010, data: { runId: 'r-doc', seq: 1, label: 'regras-do-time', phase: 'Documento', childId: 'c-doc' } },
]

const fold = (events) => events.reduce((state, event) => applyEvent(state, event), initState())

test('the projection key and version are stable', () => {
  assert.equal(PROJECTION_KEY, 'workflowRuns')
  assert.equal(STATE_VERSION, 2)
})

test('the real fixture folds into four runs with their members', () => {
  const view = createView(fold(FIXTURE))
  assert.deepEqual(view.runs.map((run) => run.name), ['regras-do-time', 'fase0-etapa-b', 'fase0-etapa-a', 'smoke-deepseek-route'])
  const byName = Object.fromEntries(view.runs.map((run) => [run.name, run]))
  assert.equal(byName['fase0-etapa-a'].agents.length, 2)
  assert.equal(byName['fase0-etapa-a'].failed, 1)
  assert.equal(byName['fase0-etapa-a'].status, 'completed')
  assert.equal(byName['fase0-etapa-b'].agents.length, 3)
  assert.deepEqual(byName['fase0-etapa-b'].agents.map((agent) => agent.seq), [1, 2, 3])
})

test('a run with no run-end stays visible and open, never running', () => {
  const view = createView(fold(FIXTURE))
  const doc = view.runs.find((run) => run.runId === 'r-doc')
  assert.equal(doc.status, 'open', 'the log cannot tell a live run from a killed one')
  assert.equal(doc.endedAt, null)
  assert.equal(doc.agents[0].status, 'open')
})

test('a failed member keeps its outcome inside a completed run', () => {
  const view = createView(fold(FIXTURE))
  const run = view.runs.find((candidate) => candidate.runId === 'r-a')
  const failed = run.agents.find((agent) => agent.label === 'amostras-fontes')
  assert.equal(failed.status, 'failed')
  assert.equal(failed.outcome, 'failed')
  assert.equal(run.status, 'completed', 'the run completed even though a member failed')
})

test('phases and child ids survive the fold', () => {
  const view = createView(fold(FIXTURE))
  const run = view.runs.find((candidate) => candidate.runId === 'r-b')
  assert.deepEqual(run.agents.map((agent) => agent.phase), ['Etapa B', 'Etapa B', 'Etapa B'])
  assert.equal(run.agents[0].childId, 'c-b1')
})

test('an untracked event returns the same reference', () => {
  const state = fold(FIXTURE)
  assert.equal(applyEvent(state, { type: 'assistant/message', data: {} }), state)
  assert.equal(applyEvent(state, { type: 'tool-workflow/agent-end', data: { runId: 'nope', seq: 1 } }), state)
})

test('events are idempotent by run and seq', () => {
  const once = fold(FIXTURE)
  const twice = fold([...FIXTURE, ...FIXTURE])
  assert.deepEqual(createView(twice), createView(once))
})

test('the view is capped at maxRuns, newest first', () => {
  const view = createView(fold(FIXTURE), { maxRuns: 2 })
  assert.deepEqual(view.runs.map((run) => run.name), ['regras-do-time', 'fase0-etapa-b'])
})

test('both schemas accept what the fold produces', () => {
  const state = fold(FIXTURE)
  assert.equal(stateSchema.parse(state), state)
  const view = createView(state)
  assert.equal(viewSchema.parse(view), view)
  assert.throws(() => stateSchema.parse({}), /runs map/u)
  assert.throws(() => viewSchema.parse({}), /invalid view/u)
})
