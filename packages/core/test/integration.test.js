/**
 * Integration test with a simulated Harness host.
 *
 * It activates the whole plugin the way the Loader would — `apply(ctx, config)` —
 * against a small set of fake services, then exercises the paths that matter:
 * skill registration, the three tools, the projection unit, the `/egm` command,
 * route resolution on a reviewer activation, the read-only guard and the
 * single-use refusal.
 *
 * The fake mirrors the real service shapes recorded from dsh 0.2.2-rc.1; when the
 * Harness changes an API this test is the first place that shows it.
 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply } from '../src/index.js'

function fakeLogger() {
  const lines = []
  const push = (level) => (message) => lines.push(`${level}: ${message}`)
  return { lines, info: push('info'), warn: push('warn'), error: push('error') }
}

function fakeLlm({ fail = [] } = {}) {
  return {
    listProviders: () => [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }],
    listModels: async (provider) => [{ provider, id: 'big', name: 'Big' }, { provider, id: 'small', name: 'Small' }],
    resolveModelInfo: async (provider, model) => {
      if (fail.includes(`${provider}/${model}`)) throw new Error('UNKNOWN_MODEL')
      return { provider, id: model, defaultMaxTokens: model === 'small' ? 4096 : 16384 }
    },
    resolveCallConfig: async (config) => {
      if (fail.includes(`${config.provider}/${config.model}`)) throw new Error('UNKNOWN_MODEL')
      return config
    },
  }
}

/**
 * A fake host context: registers everything the plugin touches and records it.
 */
function fakeHost({ config = {}, llm = fakeLlm(), editConfig } = {}) {
  const logger = fakeLogger()
  const skills = []
  const tools = new Map()
  const guards = []
  const commands = []
  const projections = []
  const listeners = new Map()
  const activations = []
  const preset = { id: 'egm-reviewer', name: 'EGM Goldfish reviewer' }
  const agents = []
  const childContexts = []

  const ctx = {
    logger,
    fiber: { entry: { id: 'egm' } },
    effect(fn) {
      const value = fn()
      return typeof value === 'function' ? value : () => {}
    },
    on(name, handler) {
      listeners.set(name, [...listeners.get(name) ?? [], handler])
      return () => {}
    },
    inject(names, callback) {
      for (const name of names) if (ctx.get(name) === undefined) return undefined
      return callback(ctx)
    },
    get(service) {
      return services[service]
    },
    async emit(name, payload) {
      for (const handler of listeners.get(name) ?? []) await handler(payload)
    },
  }

  const services = {
    skills: {
      register: (skill) => {
        skills.push(skill)
        return () => {}
      },
    },
    tools: {
      register: (definition) => {
        tools.set(definition.name, definition)
        return () => {}
      },
      guard: (fn) => {
        guards.push(fn)
        return () => {}
      },
      restrict: () => () => {},
      schemas: () => [...tools.keys()].map((name) => ({ name })),
    },
    commands: {
      register: (definition) => {
        commands.push(definition)
        return () => {}
      },
      list: () => commands,
    },
    sessionProjections: {
      register: (unit) => {
        projections.push(unit)
        return Promise.resolve({ stateOf: () => undefined })
      },
      stateOf: () => undefined,
    },
    agentPresets: {
      list: async () => [preset],
      composedPreset: (childCtx) => childCtx?.__preset,
    },
    subagents: {
      list: () => ['spawn', 'fork'],
      resolveMaxDepth: () => 1,
      startActivation: async (request) => {
        activations.push(request)
        return { childId: `child-${activations.length}`, result: Promise.resolve({ stopReason: 'completed' }) }
      },
      listChildren: () => [],
    },
    llm,
    configEditor: editConfig === undefined ? undefined : { edit: editConfig },
  }

  apply(ctx, config)

  return {
    ctx,
    logger,
    skills,
    tools,
    guards,
    commands,
    projections,
    activations,
    preset,
    agents,
    childContexts,
    /** Build a parent agent as the Harness would hand it to a tool. */
    /** Mount a service after activation, as the loader does. */
    provide(service, value) {
      services[service] = value
    },
    parentAgent(cwd) {
      const agent = {
        id: 'parent-1',
        session: {
          id: 'parent-session',
          header: { delegationDepth: 0 },
          requestHeader: () => ({ config: { provider: 'alpha', model: 'big', reasoningEffort: 'high' } }),
        },
        options: { provider: 'alpha', model: 'big', maxTokens: 2048 },
        model: { select: () => {}, current: () => ({ provider: 'alpha', model: 'big' }) },
        workingDirectory: { get: () => cwd ?? process.cwd() },
      }
      agents.push(agent)
      return agent
    },
    /** Build a child context as the Harness would for a reviewer. */
    childContext(presetId) {
      const child = {
        __preset: presetId,
        tools: {
          guard: (fn) => {
            guards.push(fn)
            return () => {}
          },
          restrict: () => () => {},
          schemas: () => [{ name: 'read' }, { name: 'bash' }, { name: 'write' }],
        },
        effect(fn) {
          const value = fn()
          return typeof value === 'function' ? value : () => {}
        },
        get: (service) => services[service],
        logger,
      }
      childContexts.push(child)
      return child
    },
  }
}

async function project(files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'egm-it-'))
  await mkdir(join(root, '.git'), { recursive: true })
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), content)
  }
  return root
}

test('activation registers seven skills, three tools, the command and the projection', () => {
  const host = fakeHost()
  assert.equal(host.skills.length, 7)
  assert.deepEqual([...host.tools.keys()].sort(), ['egm_begin', 'egm_reviewer', 'egm_worker'])
  assert.deepEqual(host.commands.map((command) => command.name), ['egm'])
  assert.equal(host.projections.length, 1)
  assert.equal(host.projections[0].key, 'egmRun')
  assert.equal(typeof host.projections[0].wire.view, 'function')
})

test('config problems are logged rather than thrown', () => {
  const host = fakeHost({ config: { routing: { reviewers: { nobody: { provider: 'a', model: 'b' } } } } })
  assert.ok(host.logger.lines.some((line) => line.includes('unknown reviewer role')))
  assert.equal(host.skills.length, 7)
})

test('a feature switch removes a tool', () => {
  const host = fakeHost({ config: { features: { workerTool: false } } })
  assert.equal(host.tools.has('egm_worker'), false)
  assert.equal(host.tools.has('egm_reviewer'), true)
})

test('a reviewer starts on the configured route with a model-default token cap', async () => {
  const root = await project()
  try {
    const host = fakeHost({ config: { routing: { reviewers: { zoom_out: { provider: 'beta', model: 'small', reasoningEffort: 'high' } } } } })
    const agent = host.parentAgent(root)
    const result = await host.tools.get('egm_reviewer').execute({
      description: 'Zoom out',
      prompt: 'Persona: /x/vendor/agents/zoom_out.md\nMode: REVIEW\nProjectRoot: /x',
      stage: '5',
    }, { agent, signal: undefined })

    assert.equal(host.activations.length, 1)
    const request = host.activations[0]
    assert.equal(request.provider, 'spawn')
    assert.equal(request.request.agentPreset, 'egm-reviewer')
    assert.equal(request.request.maxDepth, 1)
    assert.deepEqual(request.request.agentOptions, { provider: 'beta', model: 'small', reasoningEffort: 'high', maxTokens: 4096 })
    assert.equal(result.route, 'beta/small#high')
    assert.equal(result.source, 'profile')
    assert.equal(result.role, 'zoom_out')
    assert.equal(result.kind, 'activation')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a one-off route on the tool call beats every scope layer', async () => {
  const root = await project({ '.dsh/egm.yaml': 'routing.reviewers.zoom_out: alpha/big\n' })
  try {
    const host = fakeHost({ config: { routing: { reviewers: { zoom_out: { provider: 'alpha', model: 'small' } } } } })
    const agent = host.parentAgent(root)
    const result = await host.tools.get('egm_reviewer').execute({
      description: 'Zoom out',
      prompt: 'Persona: /x/vendor/agents/zoom_out.md',
      route: { provider: 'beta', model: 'small', reasoning_effort: 'high' },
    }, { agent })
    assert.equal(result.source, 'call')
    assert.equal(result.route, 'beta/small#high')
    assert.deepEqual(host.activations[0].request.agentOptions, { provider: 'beta', model: 'small', reasoningEffort: 'high', maxTokens: 4096 })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('routeArg accepts the nested and the flattened shape, and rejects half a route', async () => {
  const { routeArg } = await import('../src/reviewer.js')
  assert.deepEqual(routeArg({}), { problems: [] })
  assert.deepEqual(routeArg({ route: { provider: 'a', model: 'b', reasoning_effort: 'high' } }).route, { provider: 'a', model: 'b', reasoningEffort: 'high' })
  assert.deepEqual(routeArg({ provider: 'a', model: 'b' }).route, { provider: 'a', model: 'b' })
  assert.deepEqual(routeArg({ route: { provider: 'a' } }).problems, ['a route needs both provider and model'])
  assert.deepEqual(routeArg(undefined), { problems: [] })
})

test('an unconfigured role inherits and passes no agentOptions', async () => {
  const root = await project()
  try {
    const host = fakeHost()
    const agent = host.parentAgent(root)
    const result = await host.tools.get('egm_reviewer').execute({
      description: 'Style',
      prompt: 'Persona: /x/vendor/agents/style.md',
    }, { agent })
    assert.equal(host.activations[0].request.agentOptions, undefined)
    assert.equal(result.route, 'inherit')
    assert.equal(result.source, 'inherit')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the workspace file overrides the profile for a reviewer', async () => {
  const root = await project({ '.dsh/egm.yaml': 'routing.reviewers.design_critic: alpha/small\n' })
  try {
    const host = fakeHost({ config: { routing: { reviewers: { design_critic: { provider: 'beta', model: 'big' } } } } })
    const agent = host.parentAgent(root)
    await host.tools.get('egm_reviewer').execute({
      description: 'Critic',
      prompt: 'Persona: /x/vendor/agents/design_critic.md',
    }, { agent })
    assert.equal(host.activations[0].request.agentOptions.provider, 'alpha')
    assert.equal(host.activations[0].request.agentOptions.model, 'small')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an invalid route fails closed with an actionable message', async () => {
  const root = await project()
  try {
    const host = fakeHost({
      config: { routing: { reviewers: { style: { provider: 'beta', model: 'ghost' } } } },
      llm: fakeLlm({ fail: ['beta/ghost'] }),
    })
    const agent = host.parentAgent(root)
    await assert.rejects(host.tools.get('egm_reviewer').execute({
      description: 'Style',
      prompt: 'Persona: /x/vendor/agents/style.md',
    }, { agent }), /cannot be used.*\/egm model set style/su)
    assert.equal(host.activations.length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the inherit policy falls back with a note instead of failing', async () => {
  const root = await project()
  try {
    const host = fakeHost({
      config: { routing: { onInvalidRoute: 'inherit', reviewers: { style: { provider: 'beta', model: 'ghost' } } } },
      llm: fakeLlm({ fail: ['beta/ghost'] }),
    })
    const agent = host.parentAgent(root)
    const result = await host.tools.get('egm_reviewer').execute({
      description: 'Style',
      prompt: 'Persona: /x/vendor/agents/style.md',
    }, { agent })
    assert.equal(result.route, 'inherit')
    assert.match(result.note, /cannot be used/u)
    assert.equal(host.activations[0].request.agentOptions, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a malformed workspace file fails closed', async () => {
  const root = await project({ '.dsh/egm.yaml': 'not a pair\n' })
  try {
    const host = fakeHost()
    const agent = host.parentAgent(root)
    await assert.rejects(host.tools.get('egm_reviewer').execute({
      description: 'Style',
      prompt: 'Persona: /x/vendor/agents/style.md',
    }, { agent }), /expected "key: value"/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('egm_begin applies the phase route to the calling agent', async () => {
  const root = await project()
  try {
    const host = fakeHost({ config: { routing: { phases: { review: { provider: 'beta', model: 'small' } } } } })
    const agent = host.parentAgent(root)
    const selected = []
    agent.model.select = (route) => selected.push(route)
    const result = await host.tools.get('egm_begin').execute({ phase: 'review' }, { agent })
    assert.equal(result.applied, true)
    assert.equal(result.route, 'beta/small')
    assert.deepEqual(selected, [{ provider: 'beta', model: 'small' }])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('egm_begin reports inheritance when no phase route is configured', async () => {
  const root = await project()
  try {
    const host = fakeHost()
    const result = await host.tools.get('egm_begin').execute({ phase: 'draft' }, { agent: host.parentAgent(root) })
    assert.equal(result.applied, false)
    assert.equal(result.route, 'inherit')
    assert.equal(result.source, 'inherit')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the guard module blocks everything outside the read-only allowlist', async () => {
  const { apply: applyGuard, inject, name } = await import('../src/guard.js')
  assert.equal(name, 'dsh-egm-guard')
  assert.deepEqual(inject, ['tools'])
  const guards = []
  const restricted = []
  const ctx = {
    effect: (fn) => fn(),
    tools: {
      guard: (fn) => {
        guards.push(fn)
        return () => {}
      },
      restrict: (filter) => {
        restricted.push(filter)
        return () => {}
      },
      schemas: () => [{ name: 'read' }, { name: 'bash' }, { name: 'write' }],
    },
  }
  applyGuard(ctx)
  assert.equal(guards.length, 1)
  assert.match(String(guards[0]({ name: 'bash' })), /read-only/u)
  assert.equal(guards[0]({ name: 'read' }), undefined)
  assert.deepEqual(restricted, [{ deny: ['bash', 'write'] }])
})

test('the guard probe never touches an un-injected service property', async () => {
  const { applyReviewerGuard } = await import('../src/isolation.js')
  const registry = {
    guard: () => () => {},
    restrict: () => () => {},
    schemas: () => [{ name: 'read' }],
  }
  // A Cordis context throws on a service it did not inject; the probe must
  // swallow that and use `get()` instead.
  const ctx = {
    get: (name) => (name === 'tools' ? registry : undefined),
    effect: (fn) => fn(),
  }
  Object.defineProperty(ctx, 'guard', {
    get() {
      throw new Error('cannot get property "guard" without inject')
    },
  })
  const disposers = applyReviewerGuard(ctx)
  assert.equal(disposers.length, 2)
  for (const dispose of disposers) assert.equal(typeof dispose, 'function')
})

test('a context with no tool registry fails closed with our own message', async () => {
  const { applyReviewerGuard } = await import('../src/isolation.js')
  const ctx = { get: () => undefined }
  assert.throws(() => applyReviewerGuard(ctx), /exposes no tool registry/u)
})

test('a reviewer preset child with no EGM route is left on the inherited model', async () => {
  const host = fakeHost()
  const childModel = { selected: [], select(route) { this.selected.push(route) } }
  await host.ctx.emit('agent/created', {
    agent: { ctx: host.childContext('egm-reviewer'), session: { id: 'child-z' }, options: {}, model: childModel },
  })
  assert.deepEqual(childModel.selected, [])
})

test('a reviewer preset child receives the default reviewer route when one is configured', async () => {
  const host = fakeHost({ config: { routing: { reviewers: { default: { provider: 'beta', model: 'small' } } } } })
  const childModel = { selected: [], select(route) { this.selected.push(route) } }
  await host.ctx.emit('agent/created', {
    agent: { ctx: host.childContext('egm-reviewer'), session: { id: 'child-w' }, options: {}, model: childModel },
  })
  assert.deepEqual(childModel.selected, [{ provider: 'beta', model: 'small' }])
})

test('the single-use refusal targets reviewer children only', async () => {
  const root = await project()
  try {
    const host = fakeHost()
    const agent = host.parentAgent(root)
    await host.tools.get('egm_reviewer').execute({ description: 'r', prompt: 'Persona: /x/vendor/agents/style.md' }, { agent })
    const guard = host.guards.find((fn) => fn({ name: 'send_message', arguments: { agent_id: 'child-1' } }) !== undefined)
    const denial = guard === undefined ? undefined : guard({ name: 'send_message', arguments: { agent_id: 'child-1' } })
    assert.match(String(denial), /single-use/u)
    const allowed = guard === undefined ? undefined : guard({ name: 'send_message', arguments: { agent_id: 'someone-else' } })
    assert.equal(allowed, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the /egm command answers routes, status and doctor as text and JSON', async () => {
  const root = await project()
  try {
    const host = fakeHost({ config: { routing: { elephant: { provider: 'beta', model: 'big' } } } })
    const command = host.commands[0]
    const agent = host.parentAgent(root)

    const routes = await command.handler({ agent, rawInput: ' routes', signal: undefined })
    assert.equal(routes.kind, 'success')
    assert.match(routes.text, /Elephant/u)
    assert.match(routes.text, /beta\/big/u)

    const routesJson = await command.handler({ agent, rawInput: ' routes --json' })
    const parsed = JSON.parse(routesJson.text)
    assert.ok(Array.isArray(parsed.roles))
    assert.ok(parsed.roles.some((role) => role.role === 'elephant' && role.text === 'beta/big'))

    const status = await command.handler({ agent, rawInput: 'status' })
    assert.equal(status.kind, 'success')

    const doctor = await command.handler({ agent, rawInput: 'doctor' })
    assert.match(doctor.text, /EGM doctor/u)

    const catalogue = await command.handler({ agent, rawInput: 'catalogue --json' })
    const parsedCatalogue = JSON.parse(catalogue.text)
    assert.ok(Array.isArray(parsedCatalogue.models) && parsedCatalogue.models.length > 0)
    assert.equal(parsedCatalogue.models[0].key, 'alpha/big')
    assert.ok(Array.isArray(parsedCatalogue.providers))

    const help = await command.handler({ agent, rawInput: '' })
    assert.match(help.text, /Usage:/u)

    const bad = await command.handler({ agent, rawInput: 'nonsense' })
    assert.equal(bad.kind, 'error')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the command writes the profile through the configuration editor', async () => {
  const root = await project()
  try {
    const writes = []
    const host = fakeHost({
      editConfig: async (entry, mutate) => {
        writes.push(mutate({ routing: {} }))
        return {}
      },
    })
    const agent = host.parentAgent(root)
    const result = await host.commands[0].handler({ agent, rawInput: 'model set design_critic beta/small#high' })
    assert.equal(result.kind, 'success')
    assert.equal(writes.length, 1)
    assert.deepEqual(writes[0].routing.reviewers.design_critic, { provider: 'beta', model: 'small', reasoningEffort: 'high' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the command refuses to write an invalid route', async () => {
  const root = await project()
  try {
    const host = fakeHost({ llm: fakeLlm({ fail: ['beta/ghost'] }), editConfig: async () => ({}) })
    const agent = host.parentAgent(root)
    const result = await host.commands[0].handler({ agent, rawInput: 'model set style beta/ghost' })
    assert.equal(result.kind, 'error')
    assert.match(result.text, /cannot be used/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a profile without a configuration editor says why, and offers the session scope', async () => {
  const root = await project()
  try {
    const host = fakeHost()
    const result = await host.commands[0].handler({ agent: host.parentAgent(root), rawInput: 'model set style beta/small' })
    assert.equal(result.kind, 'error')
    assert.match(result.text, /composes no configuration editor/u)
    assert.match(result.text, /--session/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a configuration editor mounted after activation is still used', async () => {
  const root = await project()
  try {
    // The fake host starts with no editor, like a plugin that activated before
    // dsh-config-editor was mounted.
    let editor
    const host = fakeHost({ editConfig: undefined })
    host.provide('configEditor', { edit: async (entry, mutate) => { editor = mutate({ routing: {} }); return {} } })
    const agent = host.parentAgent(root)
    const result = await host.commands[0].handler({ agent, rawInput: 'model set style beta/small' })
    assert.equal(result.kind, 'success')
    assert.deepEqual(editor.routing.reviewers.style, { provider: 'beta', model: 'small' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the projection wire view folds live facts into the run', () => {
  const host = fakeHost()
  const view = host.projections[0].wire.view(host.projections[0].init())
  assert.equal(view.phase, null)
  assert.deepEqual(view.children, [])
  assert.equal(view.stages.length, 5)
  assert.equal(host.projections[0].wire.viewSchema.parse(view), view)
})

test('activation succeeds with no optional service at all', () => {
  const logger = fakeLogger()
  const ctx = {
    logger,
    fiber: { entry: { id: 'egm' } },
    effect: (fn) => {
      const value = fn()
      return typeof value === 'function' ? value : () => {}
    },
    on: () => () => {},
    inject: () => undefined,
    get: () => undefined,
  }
  assert.doesNotThrow(() => apply(ctx, {}))
  assert.ok(logger.lines.some((line) => line.includes('waiting for the skill registry')))
  assert.ok(logger.lines.some((line) => line.includes('waiting for the tool registry')))
})


test('registration waits for a service that mounts after the plugin', async () => {
  const logger = fakeLogger()
  const services = {}
  const pending = []
  const commands = []
  const tools = []
  const skills = []
  const ctx = {
    logger,
    fiber: { entry: { id: 'egm' } },
    effect: (fn) => {
      const value = fn()
      return typeof value === 'function' ? value : () => {}
    },
    on: () => () => {},
    get: (name) => services[name],
    inject: (names, callback) => {
      pending.push({ names, callback })
    },
    emit: async () => {},
  }
  const provide = (name, value) => {
    services[name] = value
    for (const entry of [...pending]) {
      if (!entry.names.every((wanted) => services[wanted] !== undefined)) continue
      pending.splice(pending.indexOf(entry), 1)
      entry.callback(ctx)
    }
  }

  apply(ctx, {})
  assert.equal(commands.length, 0, 'nothing registers before the registry exists')
  assert.equal(tools.length, 0)
  assert.equal(skills.length, 0)

  provide('commands', { register: (definition) => { commands.push(definition); return () => {} }, list: () => [], find: () => undefined })
  assert.deepEqual(commands.map((command) => command.name), ['egm'])

  provide('tools', {
    register: (definition) => { tools.push(definition); return () => {} },
    guard: () => () => {},
    restrict: () => () => {},
    schemas: () => [],
  })
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['egm_begin', 'egm_reviewer', 'egm_worker'])

  provide('skills', { register: (skill) => { skills.push(skill); return () => {} } })
  assert.equal(skills.length, 7)
  assert.ok(logger.lines.some((line) => line.includes('registered /egm')))
})
