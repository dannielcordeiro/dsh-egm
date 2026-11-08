import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeConfig } from '../src/config.js'
import { Router } from '../src/router.js'
import { WorkspaceReader } from '../src/workspace.js'
import { installPhaseRouting, phaseFromEvent } from '../src/phase-router.js'

const llm = {
  listProviders: () => [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }],
  listModels: async (provider) => [{ provider, id: 'big' }],
  resolveModelInfo: async (provider, model) => ({ provider, id: model, defaultMaxTokens: 4096 }),
  resolveCallConfig: async (config) => config,
}

test('a phase is read from the terminal command the skill mirror registers', () => {
  assert.equal(phaseFromEvent({ type: 'command/run', data: { name: 'egm-review' } }), 'review')
  assert.equal(phaseFromEvent({ type: 'command/run', data: { name: 'egm-review-loop' } }), 'review')
  assert.equal(phaseFromEvent({ type: 'command/run', data: { name: 'egm-brainstorm' } }), 'brainstorm')
  assert.equal(phaseFromEvent({ type: 'command/run', data: { name: 'egm-drift-report' } }), 'drift')
  assert.equal(phaseFromEvent({ type: 'command/run', data: { name: 'egm' } }), undefined)
  assert.equal(phaseFromEvent({ type: 'command/run', data: { name: 'other' } }), undefined)
})

test('a phase is read from a browser skill invocation', () => {
  assert.equal(phaseFromEvent({ type: 'user/message', data: { source: { kind: 'skill-invocation', name: 'egm-bootstrap' } } }), 'bootstrap')
  assert.equal(phaseFromEvent({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '/egm-draft docs/x.md' }] } }), 'draft')
  assert.equal(phaseFromEvent({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] } }), undefined)
  assert.equal(phaseFromEvent({ type: 'session/title', data: {} }), undefined)
})

/** A host stand-in with one agent whose model selection is recorded. */
function harness(config = { routing: { phases: { review: { provider: 'beta', model: 'small' } } } }) {
  const selected = []
  const agent = {
    id: 'agent-1',
    session: { id: 'session-1', header: { origin: 'user' }, requestHeader: () => ({ config: { provider: 'alpha', model: 'big' } }) },
    options: { provider: 'alpha', model: 'big' },
    model: { select: (route) => selected.push(route), current: () => ({ provider: 'alpha', model: 'big' }) },
    workingDirectory: { get: () => process.cwd() },
  }
  const listeners = []
  const logs = []
  const ctx = {
    logger: { info: (line) => logs.push(`info: ${line}`), warn: (line) => logs.push(`warn: ${line}`) },
    effect: (fn) => {
      fn()
      return () => {}
    },
    on: (name, handler) => {
      if (name === 'session/event') listeners.push(handler)
      return () => {}
    },
    get: (name) => (name === 'agents' ? { get: (id) => (id === 'session-1' ? agent : undefined) } : undefined),
    inject: () => undefined,
  }
  const { config: normalized } = normalizeConfig(config)
  const router = new Router({ config: normalized, workspace: new WorkspaceReader(), llm: () => llm })
  installPhaseRouting(ctx, { ctx, config: normalized, router })
  return { selected, listeners, logs, agent }
}

test('an EGM skill starting applies the phase route without the model asking', async () => {
  const host = harness()
  host.listeners[0]({ id: 'session-1' }, { type: 'command/run', data: { name: 'egm-review' } })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(host.selected, [{ provider: 'beta', model: 'small' }])
})

test('the same phase is applied once per session', async () => {
  const host = harness()
  const event = { type: 'command/run', data: { name: 'egm-review' } }
  host.listeners[0]({ id: 'session-1' }, event)
  host.listeners[0]({ id: 'session-1' }, event)
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(host.selected.length, 1)
})

test('a phase with no configured route leaves the session alone', async () => {
  const host = harness({})
  host.listeners[0]({ id: 'session-1' }, { type: 'command/run', data: { name: 'egm-draft' } })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(host.selected, [])
})

test('an event for an unknown session is ignored', async () => {
  const host = harness()
  host.listeners[0]({ id: 'other-session' }, { type: 'command/run', data: { name: 'egm-review' } })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(host.selected, [])
})
