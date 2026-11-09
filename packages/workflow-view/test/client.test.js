import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'))
const patch = readFileSync(join(PACKAGE_ROOT, 'cordis.patch.yml'), 'utf8')

/** Load the generated client bundle through a stand-in module loader. */
function loadPlugin() {
  let captured
  globalThis.window = { __ModuleLoader__: { load: (definition) => { captured = definition } } }
  globalThis.document = {
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { appendChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { style: {} },
  }
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
  const resolve = (id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return ReactDOM
    throw new Error(`unexpected require(${id})`)
  }
  new Function('window', 'module', 'exports', 'require', source)(globalThis.window, module, module.exports, resolve)
  const plugin = captured.factory(resolve)

  const registrations = []
  const tabTypes = []
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
    sidebarRightTabs: {
      register: (definition) => {
        tabTypes.push(definition)
        return () => {}
      },
    },
    sessions: { list: { subscribe: () => () => {}, getSnapshot: () => ({ byId: {} }) } },
    effect: (fn) => fn(),
  }
  plugin.apply(ctx)
  return { plugin, registrations, tabTypes, injected }
}

test('the tab type, its body and the header action are registered', () => {
  const { plugin, registrations, tabTypes, injected } = loadPlugin()
  assert.deepEqual(plugin.inject, ['slots', 'locale'])

  assert.deepEqual(tabTypes.map((definition) => definition.id), ['workflow'])
  assert.equal(tabTypes[0].kind, 'workflow')
  assert.equal(tabTypes[0].canOpen('anything'), true)

  const byName = (name) => registrations.filter((entry) => entry.kind === 'slot' && entry.options.name === name)
  const pane = byName('sidebar.right.pane.tab')[0]
  assert.equal(pane.options.key, 'workflow')
  assert.equal(typeof pane.component, 'function')
  assert.equal(pane.options.inject('session-1').sessionId, 'session-1')

  const header = byName('conversation.session.header.actions')[0]
  assert.equal(header.options.id, 'workflow-view')
  assert.equal(header.options.inject('session-1').sessionId, 'session-1')

  assert.deepEqual(injected.sort(), ['conversation.session.header.actions', 'sidebar.right.pane.tab'])

  const locale = registrations.find((entry) => entry.kind === 'locale')
  assert.deepEqual(Object.keys(locale.dict.en).sort(), Object.keys(locale.dict.pt).sort())
})

test('the bundle never polls', () => {
  const source = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  assert.equal(source.includes('setInterval'), false)
  assert.equal(source.includes('setTimeout'), false)
  assert.equal(source.includes('remote.commands.execute'), false)
})

test('members get route, live status and tokens from the three views', () => {
  const { plugin } = loadPlugin()
  const { buildTab } = plugin.__test
  const view = {
    runs: [{
      runId: 'r1',
      name: 'fase0-etapa-a',
      startedAt: 100,
      endedAt: 900,
      stopReason: 'completed',
      status: 'completed',
      failed: 1,
      agents: [
        { seq: 1, label: 'esqueleto', phase: 'Etapa A', childId: 'c1', startedAt: 110, endedAt: 300, outcome: 'completed', status: 'completed' },
        { seq: 2, label: 'amostras-fontes', phase: 'Etapa A', childId: 'c2', startedAt: 120, endedAt: null, outcome: null, status: 'running' },
      ],
    }],
  }
  const catalog = [
    { id: 'c1', agentProvider: 'deepseek-official', agentModel: 'deepseek-flash', agentReasoningEffort: 'high' },
  ]
  const sessions = {
    byId: {
      c1: { running: false, createdAt: 105, projectionValues: { tokenUsage: { totals: { uncachedInputTokens: 900, outputTokens: 100 } } } },
      c2: { running: true, createdAt: 118 },
    },
  }
  const [run] = buildTab({ view, catalog, sessions, noPhaseLabel: 'sem fase' })
  assert.equal(run.members[0].route, 'deepseek-official/deepseek-flash#high')
  assert.equal(run.members[0].tokens, 1000)
  assert.equal(run.members[0].status, 'completed')
  assert.equal(run.members[0].durationMs, 190)
  assert.equal(run.members[1].status, 'running', 'the live flag wins over a stale record')
  assert.equal(run.members[1].route, null)
  assert.equal(run.members[1].durationMs, null, 'a running member has no duration yet')
  assert.deepEqual(run.groups.map((group) => group.label), ['Etapa A'])
  assert.equal(run.counts.running, 1)
})

test('members without a phase land in their own group, in order', () => {
  const { plugin } = loadPlugin()
  const { buildTab, groupByPhase } = plugin.__test
  const members = [
    { seq: 1, label: 'a', phase: null, status: 'completed' },
    { seq: 2, label: 'b', phase: 'Etapa B', status: 'completed' },
    { seq: 3, label: 'c', phase: null, status: 'failed' },
  ]
  const groups = groupByPhase(members, 'sem fase')
  assert.deepEqual(groups.map((group) => group.label), ['sem fase', 'Etapa B'])
  assert.equal(groups[0].members.length, 2)
  const tab = buildTab({ view: { runs: [] }, catalog: [], sessions: {}, noPhaseLabel: 'sem fase' })
  assert.deepEqual(tab, [])
})

test('the run filter selects by status and by failed members', () => {
  const { plugin } = loadPlugin()
  const { buildTab } = plugin.__test
  const view = {
    runs: [
      { runId: 'r1', name: 'a', status: 'completed', agents: [{ seq: 1, label: 'x', phase: null, childId: null, status: 'failed' }] },
      { runId: 'r2', name: 'b', status: 'running', agents: [] },
      { runId: 'r3', name: 'c', status: 'completed', agents: [] },
    ],
  }
  const runs = buildTab({ view, catalog: [], sessions: {}, filter: 'all', noPhaseLabel: 'none' })
  assert.equal(runs.length, 3)
  assert.deepEqual(buildTab({ view, catalog: [], sessions: {}, filter: 'running', noPhaseLabel: 'none' }).map((run) => run.runId), ['r2'])
  assert.deepEqual(buildTab({ view, catalog: [], sessions: {}, filter: 'failed', noPhaseLabel: 'none' }).map((run) => run.runId), ['r1'])
})

test('an unknown member status is shown as unknown, never as completed', () => {
  const { plugin } = loadPlugin()
  const { memberStatus } = plugin.__test
  assert.equal(memberStatus(null, undefined), 'unknown')
  assert.equal(memberStatus(undefined, {}), 'unknown')
  assert.equal(memberStatus('failed', undefined), 'failed')
  assert.equal(memberStatus('completed', { running: true }), 'running')
})

test('the child link carries parent and mode, which the sidebar refuses without', () => {
  const { plugin } = loadPlugin()
  const { chatAddress, openTarget } = plugin.__test
  assert.equal(
    chatAddress({ parentSessionId: 'p1', childSessionId: 'c1', mode: 'continuable' }),
    'dsh-resource://subagentchat/session/c1?parent=p1&mode=continuable',
  )
  assert.equal(chatAddress({ parentSessionId: 'p1', childSessionId: 'c1' }), 'dsh-resource://subagentchat/session/c1?parent=p1&mode=continuable')
  assert.equal(chatAddress({ parentSessionId: 'p1', childSessionId: 'a/b', mode: 'one-shot' }), 'dsh-resource://subagentchat/session/a%2Fb?parent=p1&mode=one-shot')
  assert.throws(() => chatAddress({ parentSessionId: 'p1' }), /child session/u)
  assert.deepEqual(openTarget({ parentSessionId: 'p1', childSessionId: 'c1', mode: 'one-shot' }), { parentSessionId: 'p1', childSessionId: 'c1', mode: 'one-shot' })
  assert.equal(openTarget({ parentSessionId: 'p1', childSessionId: 'c1' }).mode, 'continuable')
  assert.throws(() => openTarget({ parentSessionId: 'p1' }), /child session/u)
})

test('the member carries the mode the catalog recorded', () => {
  const { plugin } = loadPlugin()
  const { buildTab } = plugin.__test
  const view = { runs: [{ runId: 'r1', name: 'a', status: 'completed', agents: [{ seq: 1, label: 'x', phase: null, childId: 'c1', status: 'completed' }] }] }
  const [run] = buildTab({ view, catalog: [{ id: 'c1', mode: 'one-shot' }], sessions: {}, noPhaseLabel: 'none' })
  assert.equal(run.members[0].mode, 'one-shot')
  const [fallback] = buildTab({ view, catalog: [], sessions: {}, noPhaseLabel: 'none' })
  assert.equal(fallback.members[0].mode, 'continuable')
})

test('the toolbar is rendered before any empty state', () => {
  const bundle = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  const body = bundle.slice(bundle.indexOf('function renderBody'), bundle.indexOf('function WorkflowsTab'))
  assert.ok(body.includes('noMatch'), 'an empty filter names its state')
  assert.ok(body.includes('showAll'), 'an empty filter offers the way back')

  const tab = bundle.slice(bundle.indexOf('function WorkflowsTab'), bundle.indexOf('function WorkflowsHeaderAction'))
  const toolbarAt = tab.indexOf('const toolbar =')
  const returnAt = tab.indexOf('return h(')
  assert.ok(toolbarAt > 0 && returnAt > toolbarAt, 'the toolbar is built once, before the return')
  assert.ok(tab.indexOf('toolbar,') > returnAt, 'the toolbar is always part of the tree')
  assert.equal(tab.includes('if (runsView === undefined) return'), false, 'no early return may skip the filters')
})

test('the manifest declares one web row and the client half', () => {
  assert.equal(manifest.name, '@local/dsh-workflow-view')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.exports['./client'], './src/client.js')
  assert.equal((patch.match(/name: '@local\/dsh-workflow-view'/gu) ?? []).length, 1)
  assert.match(patch, /maxRuns: 50/u)
  assert.match(patch, /dsh-client-modules/u)
})
