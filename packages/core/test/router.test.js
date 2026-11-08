import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { normalizeConfig } from '../src/config.js'
import { Router } from '../src/router.js'
import { WorkspaceReader } from '../src/workspace.js'

/** A minimal stand-in for the Harness llm service. */
function fakeLlm({ fail = [], empty = [], cap = 4096 } = {}) {
  return {
    listProviders: () => [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }],
    listModels: async (provider) => (empty.includes(provider) ? [] : [{ provider, id: 'big', name: 'Big' }, { provider, id: 'small', name: 'Small' }]),
    resolveModelInfo: async (provider, model) => {
      if (fail.includes(`${provider}/${model}`)) throw new Error('UNKNOWN_MODEL')
      return { provider, id: model, defaultMaxTokens: model === 'small' ? cap : 16384, reasoning: { efforts: [{ id: 'high', name: 'High' }] } }
    },
    resolveCallConfig: async (config) => {
      if (fail.includes(`${config.provider}/${config.model}`)) throw new Error('UNKNOWN_MODEL')
      if (config.reasoningEffort === 'bogus') throw new Error('UNSUPPORTED_REASONING_EFFORT')
      return config
    },
  }
}

function router(config = {}, { llm = fakeLlm(), workspace = new WorkspaceReader(), overrides = () => ({ roles: {} }) } = {}) {
  const { config: normalized } = normalizeConfig(config)
  return new Router({ config: normalized, workspace, llm: () => llm, sessionOverrides: overrides })
}

async function project(files) {
  const root = await mkdtemp(join(tmpdir(), 'egm-router-'))
  await mkdir(join(root, '.git'), { recursive: true })
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), content)
  }
  return root
}

const agent = { session: { requestHeader: () => ({ config: { provider: 'alpha', model: 'big', reasoningEffort: 'high' } }) }, options: { maxTokens: 2048 } }

test('with no configuration every role inherits', () => {
  const resolved = router().resolve({ role: 'zoom_out' })
  assert.equal(resolved.route, null)
  assert.equal(resolved.source, 'inherit')
  assert.equal(resolved.inherited, true)
})

test('the profile layer applies', () => {
  const r = router({ routing: { reviewers: { zoom_out: { provider: 'beta', model: 'small' } } } })
  const resolved = r.resolve({ role: 'zoom_out' })
  assert.equal(resolved.route.provider, 'beta')
  assert.equal(resolved.source, 'profile')
})

test('the workspace layer beats the profile', async () => {
  const root = await project({ '.dsh/egm.yaml': 'routing.reviewers.zoom_out: alpha/small\n' })
  try {
    const r = router({ routing: { reviewers: { zoom_out: { provider: 'beta', model: 'small' } } } })
    const resolved = r.resolve({ role: 'zoom_out', cwd: root })
    assert.equal(resolved.route.provider, 'alpha')
    assert.match(resolved.source, /^workspace:/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the session layer beats the workspace', async () => {
  const root = await project({ '.dsh/egm.yaml': 'routing.reviewers.zoom_out: alpha/small\n' })
  try {
    const r = router({}, { overrides: () => ({ roles: { zoom_out: { provider: 'beta', model: 'big' } } }) })
    const resolved = r.resolve({ role: 'zoom_out', cwd: root, agent })
    assert.equal(resolved.source, 'session')
    assert.equal(resolved.route.provider, 'beta')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a session "inherit" suppresses the lower layers', async () => {
  const root = await project({ '.dsh/egm.yaml': 'routing.reviewers.zoom_out: alpha/small\n' })
  try {
    const r = router({ routing: { reviewers: { zoom_out: { provider: 'beta', model: 'small' } } } }, { overrides: () => ({ roles: { zoom_out: null } }) })
    const resolved = r.resolve({ role: 'zoom_out', cwd: root, agent })
    assert.equal(resolved.route, null)
    assert.equal(resolved.source, 'session:inherit')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a phase falls back to the Elephant route', () => {
  const r = router({ routing: { elephant: { provider: 'beta', model: 'big' } } })
  const resolved = r.resolve({ role: 'review' })
  assert.equal(resolved.route.provider, 'beta')
  assert.equal(resolved.source, 'profile:elephant')
})

test('a phase route beats the Elephant route', () => {
  const r = router({ routing: { elephant: { provider: 'beta', model: 'big' }, phases: { review: { provider: 'alpha', model: 'small' } } } })
  assert.equal(r.resolve({ role: 'review' }).route.provider, 'alpha')
})

test('a workspace parse problem is reported with the resolution', async () => {
  const root = await project({ '.dsh/egm.yaml': 'nonsense\n' })
  try {
    const resolved = router().resolve({ role: 'zoom_out', cwd: root })
    assert.equal(resolved.problems.length, 1)
    assert.match(resolved.problems[0], /expected "key: value"/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('validate rejects an unknown model and accepts a known one', async () => {
  const r = router({}, { llm: fakeLlm({ fail: ['beta/ghost'] }) })
  assert.equal((await r.validate({ provider: 'alpha', model: 'big' })).ok, true)
  const bad = await r.validate({ provider: 'beta', model: 'ghost' })
  assert.equal(bad.ok, false)
  assert.match(bad.reason, /UNKNOWN_MODEL/u)
})

test('validate rejects an unsupported effort', async () => {
  const r = router()
  const verdict = await r.validate({ provider: 'alpha', model: 'big', reasoningEffort: 'bogus' })
  assert.equal(verdict.ok, false)
})

test('validate reports an unregistered provider', async () => {
  const verdict = await router().validate({ provider: 'nope', model: 'big' })
  assert.equal(verdict.ok, false)
  assert.match(verdict.reason, /not registered/u)
})

test('output tokens follow the model-default policy', async () => {
  const r = router()
  const changed = await r.maxTokensFor({ provider: 'alpha', model: 'small' }, { provider: 'alpha', model: 'big' })
  assert.equal(changed, 4096)
  const same = await r.maxTokensFor({ provider: 'alpha', model: 'big' }, { provider: 'alpha', model: 'big' })
  assert.equal(same, undefined)
})

test('the inherit and fixed policies are honoured', async () => {
  const inherit = router({ maxTokens: { policy: 'inherit' } })
  assert.equal(await inherit.maxTokensFor({ provider: 'alpha', model: 'small' }, { provider: 'alpha', model: 'big' }), undefined)
  const fixed = router({ maxTokens: { policy: 'fixed', fixed: 777 } })
  assert.equal(await fixed.maxTokensFor({ provider: 'alpha', model: 'small' }, { provider: 'alpha', model: 'big' }), 777)
})

test('an explicit route maxTokens wins over the policy', async () => {
  const r = router({ maxTokens: { policy: 'fixed', fixed: 777 } })
  assert.equal(await r.maxTokensFor({ provider: 'alpha', model: 'small', maxTokens: 100 }, undefined), 100)
})

test('the workspace may narrow the token policy', async () => {
  const root = await project({ '.dsh/egm.yaml': 'maxTokens.policy: fixed\nmaxTokens.fixed: 999\n' })
  try {
    const r = router()
    const scope = new WorkspaceReader().read(root).scope
    assert.equal(await r.maxTokensFor({ provider: 'alpha', model: 'small' }, undefined, scope), 999)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('agentOptions carries the route and the resolved limit', async () => {
  const r = router()
  const options = await r.agentOptions({ route: { provider: 'beta', model: 'small', reasoningEffort: 'high' }, parentOptions: { provider: 'alpha', model: 'big' } })
  assert.deepEqual(options, { provider: 'beta', model: 'small', reasoningEffort: 'high', maxTokens: 4096 })
  assert.equal(await r.agentOptions({ route: null }), undefined)
})

test('applyToAgent selects a validated route and refuses an invalid one', async () => {
  const selected = []
  const target = { model: { select: (route) => selected.push(route) } }
  const r = router({}, { llm: fakeLlm({ fail: ['beta/ghost'] }) })
  assert.equal((await r.applyToAgent(target, { provider: 'alpha', model: 'big', reasoningEffort: 'high' })).ok, true)
  assert.deepEqual(selected, [{ provider: 'alpha', model: 'big', reasoningEffort: 'high' }])
  const refused = await r.applyToAgent(target, { provider: 'beta', model: 'ghost' })
  assert.equal(refused.ok, false)
  assert.equal(selected.length, 1)
})

test('describe reports provenance for the screens', () => {
  const r = router({ routing: { reviewers: { style: { provider: 'beta', model: 'big' } } } })
  const rows = r.describe({ roles: ['style', 'zoom_out'] })
  assert.equal(rows[0].text, 'beta/big')
  assert.equal(rows[0].source, 'profile')
  assert.equal(rows[1].text, 'inherit')
  assert.equal(rows[1].inherited, true)
})
