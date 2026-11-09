import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'))
const patch = readFileSync(join(PACKAGE_ROOT, 'cordis.patch.yml'), 'utf8')

/**
 * Load the generated client bundle through a stand-in module loader and apply it
 * to a fake client context, returning everything the registrations produced.
 */
function loadPlugin() {
  let captured
  const window = { __ModuleLoader__: { load: (definition) => { captured = definition } } }
  globalThis.window = window
  globalThis.document = { addEventListener() {}, removeEventListener() {}, body: { style: {} } }
  const React = {
    createElement: (...args) => ({ type: 'element', args }),
    Fragment: 'fragment',
    Component: class {
      constructor(props) {
        this.props = props
        this.state = {}
      }
    },
    useState: (initial) => [initial, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useSyncExternalStore: (_subscribe, getSnapshot) => {
      try {
        return getSnapshot()
      } catch {
        return undefined
      }
    },
  }
  const ReactDOM = { createPortal: () => null }
  const source = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  const module = { exports: {} }
  new Function('window', 'module', 'exports', 'require', source)(window, module, module.exports, (id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return ReactDOM
    throw new Error(`unexpected require(${id})`)
  })
  const plugin = captured.factory((id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return ReactDOM
    throw new Error(`unexpected require(${id})`)
  })

  const registrations = []
  const injected = []
  const ctx = {
    locale: { register: (ns, dict) => { registrations.push({ kind: 'locale', ns, dict }) } },
    slots: {
      inject: (name, callback) => {
        injected.push(name)
        callback()
      },
      register: (options, component) => {
        registrations.push({ kind: 'slot', options, component })
        return () => {}
      },
    },
    remote: { commands: { execute: async () => ({ ok: true, value: { result: { kind: 'success', text: '{}' } } }) } },
    sessions: { list: { subscribe: () => () => {}, getSnapshot: () => ({ byId: {} }) } },
    effect: (fn) => fn(),
  }
  plugin.apply(ctx)
  return { plugin, registrations, injected, ctx }
}

test('every surface is registered', () => {
  const { plugin, registrations, injected } = loadPlugin()
  assert.deepEqual(plugin.inject, ['slots', 'locale', 'remote', 'remote.commands'])

  const byName = (name) => registrations.filter((entry) => entry.kind === 'slot' && entry.options.name === name)
  assert.equal(byName('shell.overlay').length, 0, 'the window is portalled from the chip, not registered on a root slot')

  const chip = byName('conversation.input.right')[0]
  assert.equal(chip.options.id, 'egm-run')
  assert.equal(chip.options.inject('session-1').sessionId, 'session-1')

  const row = byName('conversation.chat.commandview')[0]
  assert.equal(row.options.key, 'egm', 'the /egm row needs its own body or it renders no text')
  assert.equal(row.options.inject('session-1').sessionId, 'session-1')

  assert.equal(byName('tool.call.toolview')[0].options.key, 'egm_reviewer')
  assert.equal(byName('settings.section')[0].options.id, 'egm')
  assert.deepEqual(injected.sort(), ['conversation.chat.commandview', 'conversation.input.right'])

  const locale = registrations.find((entry) => entry.kind === 'locale')
  assert.equal(locale.ns, '@local/dsh-egm-ui')
  assert.deepEqual(Object.keys(locale.dict.en).sort(), Object.keys(locale.dict.pt).sort(), 'both dictionaries must have the same keys')
})

test('the browser half never polls and runs a command only on a click', () => {
  const source = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  assert.equal(source.includes('setInterval'), false)
  assert.equal(source.includes('setTimeout'), false)
  const executions = source.split('remote.commands.execute').length - 1
  assert.equal(executions, 1, 'exactly one call site, inside the explicit action helper')
})

test('the generated bundle matches its parts', () => {
  const bundle = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  assert.ok(bundle.includes('GENERATED FILE, do not edit'))
  assert.ok(bundle.includes('"@local/dsh-egm-ui"'))
})

test('status prefers live facts over the durable fold', () => {
  const { plugin } = loadPlugin()
  const { statusOf } = plugin.__test
  assert.equal(statusOf({ running: true }), 'running')
  assert.equal(statusOf({ timing: { active: { since: 1, through: 2 } } }), 'running')
  assert.equal(statusOf({ durable: 'started', timing: { lastTurnCompleted: true } }), 'settled')
  assert.equal(statusOf({ durable: 'started' }), 'settled')
  assert.equal(statusOf({ durable: 'failed' }), 'failed')
  assert.equal(statusOf({}), 'unknown')
})

test('tokens and duration format compactly', () => {
  const { plugin } = loadPlugin()
  const { formatTokens, formatDuration } = plugin.__test
  assert.equal(formatTokens(980), '980')
  assert.equal(formatTokens(12_400), '12k')
  assert.equal(formatTokens(1_500_000), '1.5M')
  assert.equal(formatTokens(0), null)
  assert.equal(formatDuration(8_000), '8s')
  assert.equal(formatDuration(62_000), '1m02s')
  assert.equal(formatDuration(0), null)
})

test('a route comes from the catalog first, then from the durable fold', () => {
  const { plugin } = loadPlugin()
  const { routeTextOf } = plugin.__test
  assert.equal(routeTextOf({ agentProvider: 'a', agentModel: 'b', agentReasoningEffort: 'high' }, 'x/y'), 'a/b#high')
  assert.equal(routeTextOf(undefined, 'x/y'), 'x/y')
  assert.equal(routeTextOf(undefined, null), 'inherit')
})

test('a route command names the role, never the row object', () => {
  const { plugin } = loadPlugin()
  const { routeCommand } = plugin.__test
  const row = { role: 'default', text: 'inherit' }
  assert.equal(routeCommand(row, 'ollama/lumi-4b', 'profile'), '/egm model set default ollama/lumi-4b')
  assert.equal(routeCommand(row, 'ollama/lumi-4b', 'session'), '/egm model set default ollama/lumi-4b --session')
  assert.equal(routeCommand('design_critic', ' a/b#high '), '/egm model set design_critic a/b#high')
  assert.equal(routeCommand(row, 'x/y').includes('[object Object]'), false)
  assert.throws(() => routeCommand({}, 'a/b'), /role name/u)
  assert.throws(() => routeCommand(row, '   '), /route is required/u)
})

test('the test command targets the typed route when there is one', () => {
  const { plugin } = loadPlugin()
  const { testCommand } = plugin.__test
  assert.equal(testCommand({ role: 'resolve' }, ''), '/egm model test resolve')
  assert.equal(testCommand({ role: 'resolve' }, 'inherit'), '/egm model test resolve')
  assert.equal(testCommand({ role: 'resolve' }, 'anthropic/sonnet#high'), '/egm model test anthropic/sonnet#high')
  assert.throws(() => testCommand(undefined, ''), /role name/u)
})

test('an Apply click always produces a command or a reason', () => {
  const { plugin } = loadPlugin()
  const { applyPlan } = plugin.__test
  const configured = { role: 'resolve', text: 'anthropic/sonnet#high' }
  const inherited = { role: 'default', text: 'inherit' }

  assert.deepEqual(applyPlan(configured, 'ollama/lumi-4b', 'profile'), { command: '/egm model set resolve ollama/lumi-4b' })
  assert.deepEqual(applyPlan(configured, '', 'profile'), { command: '/egm model set resolve anthropic/sonnet#high' }, 'an untouched row applies what it shows')
  assert.deepEqual(applyPlan(configured, 'x/y', 'session'), { command: '/egm model set resolve x/y --session' })
  assert.match(applyPlan(inherited, '', 'profile').error, /route is required/u)
  assert.match(applyPlan({ role: 'default', text: 'inherit' }, '   ').error, /route is required/u)
})

test('the tree merges the fold, the catalog and the session store', () => {
  const { plugin } = loadPlugin()
  const { mergeChildren } = plugin.__test
  const egmRun = {
    children: [
      { childId: 'c1', kind: 'reviewer', role: 'zoom_out', stage: '5', label: 'Zoom out', status: 'started', routeKey: 'a/b' },
      { childId: 'c2', kind: 'worker', role: 'worker', stage: null, label: 'Worker', status: 'failed' },
      { childId: 'c3', kind: 'subagent', role: null, stage: null, label: 'Plain child', status: 'started' },
    ],
  }
  const catalogs = {
    root: [{ id: 'c1', label: 'Stage 5 zoom out', agentProvider: 'anthropic', agentModel: 'sonnet', agentReasoningEffort: 'high', createdAt: 10 }],
    c1: [{ id: 'g1', label: 'Nested reviewer' }],
  }
  const sessions = {
    byId: {
      c1: { running: true, parentSessionId: 'root', projectionValues: { tokenUsage: { totals: { uncachedInputTokens: 100, outputTokens: 20 } } } },
      c2: { parentSessionId: 'root', projectionValues: { subagentTiming: { lastTurnCompleted: true, settledMs: 4000 } } },
      c3: { parentSessionId: 'root', projectionValues: { subagentTiming: { lastTurnCompleted: true, settledMs: 1500 } } },
      g1: { parentSessionId: 'c1', running: true },
    },
  }
  const rows = mergeChildren({ egmRun, catalogs, sessions, rootSessionId: 'root' })
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]))
  assert.deepEqual(rows.map((row) => row.id), ['c1', 'g1', 'c2', 'c3'])
  assert.equal(byId.c1.role, 'zoom_out')
  assert.equal(byId.c1.stage, '5')
  assert.equal(byId.c1.route, 'anthropic/sonnet#high')
  assert.equal(byId.c1.status, 'running')
  assert.equal(byId.c1.tokens, 120)
  assert.equal(byId.g1.depth, 1)
  assert.equal(byId.g1.status, 'running')
  assert.equal(byId.c2.status, 'failed', 'a failed activation stays failed even after a turn ended')
  assert.equal(byId.c2.durationMs, 4000)
  assert.equal(byId.c3.status, 'settled')
})

test('the tree stops at the depth cap and survives a cycle', () => {
  const { plugin } = loadPlugin()
  const { mergeChildren } = plugin.__test
  const catalogs = {
    root: [{ id: 'a' }],
    a: [{ id: 'b' }],
    b: [{ id: 'c' }],
    c: [{ id: 'd' }],
    d: [{ id: 'root' }],
  }
  const rows = mergeChildren({ egmRun: { children: [] }, catalogs, sessions: { byId: {} }, rootSessionId: 'root', maxDepth: 2 })
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b', 'c'])
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
})

test('an empty run produces no rows, not a placeholder', () => {
  const { plugin } = loadPlugin()
  const { mergeChildren } = plugin.__test
  assert.deepEqual(mergeChildren({ egmRun: undefined, catalogs: {}, sessions: undefined, rootSessionId: 'root' }), [])
})

test('the manifest declares a web-only client half with one host entry', () => {
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.exports['./client'], './src/client.js')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal((patch.match(/name: '@local\/dsh-egm-ui'/gu) ?? []).length, 1)
})

test('the host row disables itself when no client host is composed', () => {
  assert.match(patch, /disabled: !!js "!\[\.\.\.ctx\.loader\.entries\(\)\]/u)
  assert.match(patch, /dsh-client-modules/u)
})

test('locales are valid JSON with display metadata', () => {
  for (const language of ['en', 'pt']) {
    const locale = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'locale', `${language}.json`), 'utf8'))
    assert.equal(typeof locale.meta.title, 'string')
    assert.equal(typeof locale.meta.description, 'string')
  }
})
