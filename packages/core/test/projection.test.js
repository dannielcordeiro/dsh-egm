import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createView, initState, applyEvent, PROJECTION_KEY, STATE_VERSION } from '../src/projection.js'

/** Fold a list of events from an empty state. */
function fold(events, state = initState()) {
  return events.reduce((current, event) => applyEvent(current, event), state)
}

const commandRun = (commandId, name, args) => ({ type: 'command/run', data: { commandId, name, args }, time: 1 })
const commandDone = (commandId, kind = 'success') => ({ type: 'command/done', data: { commandId, kind }, time: 2 })

test('the projection key and version are stable', () => {
  assert.equal(PROJECTION_KEY, 'egmRun')
  assert.equal(STATE_VERSION, 1)
})

test('an untracked event returns the same reference', () => {
  const state = initState()
  assert.equal(applyEvent(state, { type: 'step/start', data: {} }), state)
  assert.equal(applyEvent(state, { type: 'tool/call', data: { name: 'bash' } }), state)
})

test('a skill invocation recorded by the terminal starts the phase', () => {
  const state = fold([commandRun('c1', 'egm-review', ' design_draft.md'), commandDone('c1')])
  assert.equal(state.phase, 'review')
  assert.equal(state.designDoc, 'design_draft.md')
})

test('a failed command changes nothing', () => {
  const state = fold([commandRun('c1', 'egm-review', ''), commandDone('c1', 'error')])
  assert.equal(state.phase, null)
})

test('a session-scoped route edit becomes an override', () => {
  const state = fold([
    commandRun('c1', 'egm', 'model set zoom_out a/b#high --session'),
    commandDone('c1'),
  ])
  assert.deepEqual(state.overrides, { zoom_out: { provider: 'a', model: 'b', reasoningEffort: 'high' } })
})

test('a profile-scoped route edit does not shadow the profile in this session', () => {
  const state = fold([
    commandRun('c1', 'egm', 'model set zoom_out a/b'),
    commandDone('c1'),
  ])
  assert.deepEqual(state.overrides, {})
})

test('inherit is recorded as a deliberate null', () => {
  const state = fold([
    commandRun('c1', 'egm', 'model set zoom_out inherit --session'),
    commandDone('c1'),
  ])
  assert.deepEqual(state.overrides, { zoom_out: null })
})

test('resetting a session override removes it', () => {
  const state = fold([
    commandRun('c1', 'egm', 'model set zoom_out a/b --session'),
    commandDone('c1'),
    commandRun('c2', 'egm', 'model reset zoom_out --session'),
    commandDone('c2'),
  ])
  assert.deepEqual(state.overrides, {})
})

test('egm_begin records the phase when it succeeds', () => {
  const state = fold([
    { type: 'tool/call', data: { callId: 't1', name: 'egm_begin', arguments: '{"phase":"draft"}' } },
    { type: 'tool/result', data: { message: { toolCallId: 't1', isError: false } } },
  ])
  assert.equal(state.phase, 'draft')
})

test('a reviewer is paired with the catalogue entry that carries its label', () => {
  const state = fold([
    { type: 'tool/call', data: { callId: 't1', name: 'egm_reviewer', arguments: JSON.stringify({ description: 'Critic on draft', role: 'design_critic', stage: '7' }) } },
    { type: 'subagent/catalog', data: { childId: 'child-1', label: 'Critic on draft', childCreatedAt: 10 } },
    { type: 'tool/result', data: { message: { toolCallId: 't1', isError: false } } },
  ])
  assert.deepEqual(state.children['child-1'], {
    childId: 'child-1',
    kind: 'reviewer',
    role: 'design_critic',
    stage: '7',
    label: 'Critic on draft',
    startedAt: 10,
    status: 'started',
  })
})

test('the role is derived from the Persona line when the argument omits it', () => {
  const state = fold([
    { type: 'tool/call', data: { callId: 't1', name: 'egm_reviewer', arguments: JSON.stringify({ description: 'Zoom out', prompt: 'Persona: /pkg/vendor/agents/zoom_out.md\nMode: REVIEW' }) } },
    { type: 'subagent/catalog', data: { childId: 'child-1', label: 'Zoom out' } },
  ])
  assert.equal(state.children['child-1'].role, 'zoom_out')
})

test('a child with no matching call is kept as a generic subagent', () => {
  const state = fold([
    { type: 'subagent/catalog', data: { childId: 'child-2', label: 'Research task' } },
  ])
  assert.equal(state.children['child-2'].kind, 'subagent')
  assert.equal(state.children['child-2'].role, null)
})

test('a settlement notice marks the child settled', () => {
  const state = fold([
    { type: 'subagent/catalog', data: { childId: 'child-3', label: 'x' } },
    { type: 'user/message', data: { content: [{ type: 'text', text: 'Background subagent child-3 finished and will do no further work unless you send it more.' }] } },
  ])
  assert.equal(state.children['child-3'].status, 'settled')
})

test('artifacts are recorded only after a successful write', () => {
  const call = (callId, path) => ({ type: 'tool/call', data: { callId, name: 'write', arguments: JSON.stringify({ file_path: path }) } })
  const ok = fold([
    call('w1', '/p/design_draft.md'),
    { type: 'tool/result', data: { message: { toolCallId: 'w1', isError: false } } },
  ])
  assert.deepEqual(ok.artifacts.map((artifact) => artifact.kind), ['draft'])
  const failed = fold([
    call('w2', '/p/critic_report.md'),
    { type: 'tool/result', data: { message: { toolCallId: 'w2', isError: true } } },
  ])
  assert.deepEqual(failed.artifacts, [])
})

test('unrelated files are not artifacts', () => {
  const state = fold([
    { type: 'tool/call', data: { callId: 'w1', name: 'write', arguments: JSON.stringify({ file_path: '/p/src/index.js' }) } },
    { type: 'tool/result', data: { message: { toolCallId: 'w1', isError: false } } },
  ])
  assert.deepEqual(state.artifacts, [])
})

test('usage accumulates across turns', () => {
  const state = fold([
    { type: 'assistant/message', data: { usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2 } } },
    { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } } },
  ])
  assert.deepEqual(state.budget, { input: 11, output: 6, cacheRead: 2, cacheWrite: 0 })
})

test('usage inside the message is still read, for older logs', () => {
  const state = fold([{ type: 'assistant/message', data: { message: { usage: { inputTokens: 4, outputTokens: 2 } } } }])
  assert.equal(state.budget.input, 4)
})

test('a message with no usage is ignored', () => {
  const state = fold([{ type: 'assistant/message', data: { message: {}, usage: null } }])
  assert.deepEqual(state.budget, {})
})

test('the view reports stages, children and cost', () => {
  const state = fold([
    commandRun('c1', 'egm', 'phase review'),
    commandDone('c1'),
    { type: 'tool/call', data: { callId: 't1', name: 'egm_reviewer', arguments: JSON.stringify({ description: 'r5', stage: '5' }) } },
    { type: 'subagent/catalog', data: { childId: 'c-5', label: 'r5', childCreatedAt: 5 } },
  ])
  const live = {
    children: {
      'c-5': {
        status: 'settled',
        stopReason: 'completed',
        route: { provider: 'a', model: 'b' },
        tokens: { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 },
      },
    },
  }
  const view = createView(state, live, { 'a/b': { input: 3, output: 15 } })
  assert.equal(view.phase, 'review')
  assert.equal(view.stages.find((stage) => stage.stage === '5').status, 'done')
  assert.equal(view.stages.find((stage) => stage.stage === '9').status, 'idle')
  assert.equal(view.children[0].status, 'settled')
  assert.equal(view.children[0].routeKey, 'a/b')
  assert.equal(view.cost, 18)
  assert.equal(view.unpricedChildren, 0)
})

test('unpriced children are counted, not priced at zero silently', () => {
  const state = fold([
    { type: 'tool/call', data: { callId: 't1', name: 'egm_reviewer', arguments: JSON.stringify({ description: 'r' }) } },
    { type: 'subagent/catalog', data: { childId: 'x', label: 'r' } },
  ])
  const view = createView(state, { children: { x: { route: { provider: 'p', model: 'm' }, tokens: { input: 10, output: 10 } } } }, {})
  assert.equal(view.cost, null)
  assert.equal(view.unpricedChildren, 1)
})
