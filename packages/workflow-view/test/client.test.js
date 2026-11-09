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
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
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
    inject: (names, callback) => {
      if (names.every((name) => ctx[name] !== undefined)) callback(ctx)
    },
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

test('a member killed by a restart is interrupted, not running', () => {
  const { plugin } = loadPlugin()
  const { memberStatus } = plugin.__test
  assert.equal(memberStatus(null, undefined), 'unknown', 'no record and no session')
  assert.equal(memberStatus('open', { running: false }), 'interrupted', 'never closed and not live')
  assert.equal(memberStatus('open', {}), 'interrupted')
  assert.equal(memberStatus('open', { running: true }), 'running', 'the live flag still wins')
  assert.equal(memberStatus('failed', undefined), 'failed')
  assert.equal(memberStatus('completed', { running: true }), 'running')
})

test('runs follow the same rule: no stop reason, no live member, interrupted', () => {
  const { plugin } = loadPlugin()
  const { buildTab } = plugin.__test
  const build = (run, sessions = {}) => buildTab({ view: { runs: [run] }, catalog: [], sessions, noPhaseLabel: 'none' })[0]
  assert.equal(build({ runId: 'r', status: 'open', stopReason: null, agents: [{ seq: 1, status: 'open', childId: null }] }).status, 'interrupted')
  const live = build({ runId: 'r', status: 'open', stopReason: null, agents: [{ seq: 1, status: 'open', childId: 'c1' }] }, { byId: { c1: { running: true } } })
  assert.equal(live.status, 'running', 'a member the shell reports live makes the run live')
  assert.equal(live.members[0].status, 'running')
  assert.equal(build({ runId: 'r', status: 'completed', stopReason: 'completed', agents: [] }).status, 'completed')
})

test('tokens come from the flat tokenUsage view and the model from modelSelection', () => {
  const { plugin } = loadPlugin()
  const { buildTab } = plugin.__test
  const view = { runs: [{ runId: 'r1', name: 'a', status: 'completed', stopReason: 'completed', agents: [
    { seq: 1, label: 'w', phase: null, childId: 'c1', status: 'completed' },
  ] }] }
  const catalog = [{ id: 'c1', mode: 'continuable', agentProvider: 'deepseek-official', agentModel: 'deepseek-flash' }]
  const sessions = { byId: { c1: {
    running: false,
    projectionValues: {
      tokenUsage: { uncachedInputTokens: 1_200, outputTokens: 300, cacheReadTokens: 5_000, cacheWriteTokens: 0 },
      modelSelection: { lastUsed: { provider: 'anthropic', model: 'claude-sonnet-5-5', reasoningEffort: 'high' }, next: null },
    },
  } } }
  const [run] = buildTab({ view, catalog, sessions, noPhaseLabel: 'none' })
  const member = run.members[0]
  assert.equal(member.tokens, 1_500, 'input plus output, from the flat bucket object')
  assert.equal(member.route, 'anthropic/claude-sonnet-5-5#high', 'the model that actually ran')
  assert.equal(member.requestedRoute, 'deepseek-official/deepseek-flash')
  assert.equal(member.routeIsEffective, true)

  const noUsage = buildTab({ view, catalog, sessions: { byId: { c1: { running: false, projectionValues: {} } } }, noPhaseLabel: 'none' })[0].members[0]
  assert.equal(noUsage.tokens, null)
  assert.equal(noUsage.route, 'deepseek-official/deepseek-flash', 'falls back to the requested route')
  assert.equal(noUsage.routeIsEffective, false)
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

test('the header action uses the most explicit sidebar API available', () => {
  const { plugin } = loadPlugin()
  const { openWorkflowTab } = plugin.__test
  const calls = []
  const all = {
    openTabIn: (sessionId, kind) => calls.push(['openTabIn', sessionId, kind]),
    openTab: (kind) => calls.push(['openTab', kind]),
    openResource: (address, options) => calls.push(['openResource', address, options.kind]),
  }
  assert.equal(openWorkflowTab(all, 's1'), 'openTabIn')
  assert.deepEqual(calls, [['openTabIn', 's1', 'workflow']], 'only the best API is called, never all three')

  const legacy = { openTab: (kind) => calls.push(['openTab', kind]) }
  assert.equal(openWorkflowTab(legacy, 's1'), 'openTab')

  const resourceOnly = { openResource: (address, options) => calls.push(['openResource', address, options.kind]) }
  assert.equal(openWorkflowTab(resourceOnly, 's1'), 'openResource')

  const throwing = {
    openTabIn: () => { throw new Error('no adoption') },
    openTab: () => calls.push(['openTab', 'fallback']),
  }
  assert.equal(openWorkflowTab(throwing, 's1'), 'openTab', 'a throwing shape falls through')
  assert.deepEqual(calls.at(-1), ['openTab', 'fallback'])

  assert.equal(openWorkflowTab(undefined, 's1'), 'none')
})

test('the tab type is registered through inject, not a one-shot probe', () => {
  const bundle = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  assert.ok(bundle.includes("ctx.inject(['sidebarRightTabs']"), 'a probe that runs before the sidebar mounts leaves the type unregistered')
})

test('a member bar is placed inside the run span', () => {
  const { plugin } = loadPlugin()
  const { memberBar, runSpan } = plugin.__test
  const span = { start: 1_000, end: 2_000, approximate: false, durationMs: 1_000 }
  const finished = memberBar({ startedAt: 1_200, endedAt: 1_400, status: 'completed' }, span, 2_500)
  assert.ok(Math.abs(finished.left - 0.2) < 1e-9)
  assert.ok(Math.abs(finished.width - 0.2) < 1e-9)
  assert.equal(finished.live, false)

  const live = memberBar({ startedAt: 1_500, endedAt: null, status: 'running' }, span, 1_800)
  assert.ok(Math.abs(live.left - 0.5) < 1e-9)
  assert.ok(Math.abs(live.width - 0.3) < 1e-9, 'a running member extends to now')
  assert.equal(live.live, true)

  assert.equal(memberBar({ startedAt: null, status: 'unknown' }, span, 1_800), null, 'no start, no bar')
  assert.deepEqual(memberBar({ startedAt: 5, status: 'completed' }, { start: 5, end: 5 }, 6), { left: 0, width: 1, live: false })

  const derived = runSpan({ startedAt: null, endedAt: null, status: 'completed', agents: [
    { startedAt: 10, endedAt: 20 }, { startedAt: 30, endedAt: 60 },
  ] }, 100)
  assert.equal(derived.start, 10)
  assert.equal(derived.end, 60)
  assert.equal(derived.approximate, true)
  assert.equal(derived.durationMs, 50)
})

test('a run progress bar splits every status and sums to the whole', () => {
  const { plugin } = loadPlugin()
  const { runProgress } = plugin.__test
  const progress = runProgress({ agents: [
    { status: 'completed' }, { status: 'completed' }, { status: 'running' }, { status: 'failed' },
  ] })
  assert.deepEqual(progress.counts, { completed: 2, running: 1, failed: 1, unknown: 0 })
  assert.equal(progress.segments.reduce((sum, segment) => sum + segment.fraction, 0), 1)
  assert.deepEqual(progress.segments.map((segment) => segment.status), ['completed', 'running', 'failed'])
  assert.deepEqual(runProgress({ agents: [] }).segments, [])
})

test('ages and clock times read compactly', () => {
  const { plugin } = loadPlugin()
  const { formatRelative, formatClock, formatDuration } = plugin.__test
  const now = 1_700_000_000_000
  assert.equal(formatRelative(now - 1_000, now), 'now')
  assert.equal(formatRelative(now - 12 * 60_000, now), '12 min')
  assert.equal(formatRelative(now - 3 * 3_600_000, now), '3 h')
  assert.equal(formatRelative(now - 2 * 86_400_000, now), '2 d')
  assert.equal(formatRelative(now + 60_000, now), 'now', 'a future stamp never reads negative')
  assert.equal(formatRelative(null, now), null)
  assert.equal(formatClock(1_700_000_000_000).length, 8)
  assert.equal(formatClock(undefined), null)
  assert.equal(formatDuration(0), null)
})

test('phase aggregates and session totals are computed once', () => {
  const { plugin } = loadPlugin()
  const { aggregatePhases, summarize } = plugin.__test
  const phases = aggregatePhases([
    { phase: 'A', label: 'A', members: [{ startedAt: 100, endedAt: 200 }, { startedAt: 150, endedAt: 400 }] },
    { phase: null, label: 'sem fase', members: [{ startedAt: null, endedAt: null }] },
  ])
  assert.deepEqual(phases[0], { phase: 'A', label: 'A', count: 2, durationMs: 300 })
  assert.deepEqual(phases[1], { phase: null, label: 'sem fase', count: 1, durationMs: null })

  const totals = summarize([
    { members: [{ status: 'completed', tokens: 100 }, { status: 'failed', tokens: 50 }] },
    { members: [{ status: 'running', tokens: null }] },
  ])
  assert.deepEqual(totals, { runs: 2, members: 3, failed: 1, running: 1, tokens: 150 })
})

test('styles use theme tokens only, and every class used exists', () => {
  const css = readFileSync(join(PACKAGE_ROOT, 'src', 'client', '01-css.js'), 'utf8')
  assert.equal(/#[0-9a-fA-F]{3,8}\b/u.test(css), false, 'no literal hex colours')
  assert.equal(/\brgba?\(/u.test(css), false, 'no literal rgb colours')
  const declared = new Set([...css.matchAll(/\.(wfv-[a-z0-9-]+)/gu)].map((match) => match[1]))
  const used = new Set([...readFileSync(join(PACKAGE_ROOT, 'src', 'client', '04-tab.js'), 'utf8').matchAll(/className: '([^']+)'/gu)].map((match) => match[1]))
  for (const name of used) {
    for (const part of name.split(/\s+/u)) assert.ok(declared.has(part), `class ${part} has no rule`)
  }
})

test('the whole tab renders from the three views without throwing', () => {
  const { plugin } = loadPlugin()
  const { WorkflowsTab } = plugin.__test
  const view = {
    runs: [{
      runId: 'r1',
      name: 'fase0-etapa-b',
      startedAt: 1_000,
      endedAt: 4_000,
      stopReason: 'completed',
      status: 'completed',
      failed: 1,
      agents: [
        { seq: 1, label: 'B1-schema', phase: 'Etapa B', childId: 'c1', startedAt: 1_100, endedAt: 2_000, outcome: 'completed', status: 'completed' },
        { seq: 2, label: 'B2-models', phase: 'Etapa B', childId: 'c2', startedAt: 1_200, endedAt: 3_000, outcome: 'failed', status: 'failed' },
        { seq: 3, label: 'sem-fase', phase: null, childId: 'c3', startedAt: 3_100, endedAt: null, outcome: null, status: 'running' },
      ],
    }],
  }
  const catalog = [{ id: 'c1', mode: 'continuable', agentProvider: 'deepseek-official', agentModel: 'deepseek-flash', agentReasoningEffort: 'high' }]
  const sessions = { byId: { c2: { running: false, projectionValues: { tokenUsage: { totals: { uncachedInputTokens: 800, outputTokens: 200 } } } } } }
  const tree = WorkflowsTab({
    ctx: { sessions: { list: { subscribe: () => () => {}, getSnapshot: () => sessions } } },
    t: (key) => key,
    sessionId: 's1',
    useProjection: (key) => (key === 'workflowRuns' ? view : catalog),
  })
  const text = JSON.stringify(tree, (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.match(text, /wfv-root/u)
  assert.match(text, /fase0-etapa-b/u)
  assert.match(text, /Etapa B/u)
  assert.match(text, /wfv-track/u, 'every member draws its duration bar')
  assert.match(text, /deepseek-official\/deepseek-flash#high/u, 'the route survives the render')
  assert.match(text, /"data-density":"comfortable"/u)
})

test('an empty projection and empty filters still render the toolbar', () => {
  const { plugin } = loadPlugin()
  const { WorkflowsTab } = plugin.__test
  const base = {
    ctx: {},
    t: (key) => key,
    sessionId: 's1',
    useProjection: () => ({ runs: [] }),
  }
  const empty = JSON.stringify(WorkflowsTab(base), (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.match(empty, /wfv-bar-head/u, 'the toolbar exists even with no run')
  assert.match(empty, /noRuns/u)

  const noMatch = JSON.stringify(WorkflowsTab({
    ...base,
    useProjection: (key) => (key === 'workflowRuns'
      ? { runs: [{ runId: 'r1', name: 'only', status: 'completed', failed: 0, agents: [] }] }
      : []),
  }), (key, value) => (typeof value === 'function' ? '[fn]' : value))
  assert.match(noMatch, /wfv-bar-head/u)
  assert.match(noMatch, /noMembers/u)
})

test('the manifest declares one web row and the client half', () => {
  assert.equal(manifest.name, '@local/dsh-workflow-view')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.exports['./client'], './src/client.js')
  assert.equal((patch.match(/name: '@local\/dsh-workflow-view'/gu) ?? []).length, 1)
  assert.match(patch, /maxRuns: 50/u)
  assert.match(patch, /dsh-client-modules/u)
})
