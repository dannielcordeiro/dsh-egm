/**
 * Browser half of `@local/dsh-workflow-view` — GENERATED FILE, do not edit.
 *
 * Built from `src/client/*.js` by `scripts/bundle-client.mjs`
 * (`npm run build:client`). The Harness Web module loader serves one script per
 * package, so the parts are concatenated into one closure instead of imported.
 */
window.__ModuleLoader__.load({
  id: "@local/dsh-workflow-view",
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    /** Pure helpers exposed to the test suite; assigned by the apply part. */
    let testApi

    // ---- 00-helpers.js -----------------------------------------------------
    /**
     * Small client helpers shared by the tab and the header action.
     *
     * Both are optional services here: the tab is still useful with only the
     * projection, and touching a service this plugin did not inject throws in Cordis,
     * so every lookup is guarded.
     */

    /** Resolve an optional client service without declaring it in `inject`. */
    function serviceOf(ctx, name) {
      if (ctx === undefined || ctx === null) return undefined
      try {
        const found = typeof ctx.get === 'function' ? ctx.get(name) : undefined
        if (found !== undefined) return found
      } catch {
        // fall through to the property
      }
      try {
        return ctx[name]
      } catch {
        return undefined
      }
    }

    /** Subscribe to the client session store when the shell composes one. */
    function useSessionSnapshot(ctx) {
      const store = serviceOf(ctx, 'sessions')?.list
      const subscribe = useCallback((listener) => (typeof store?.subscribe === 'function' ? store.subscribe(listener) : () => {}), [store])
      const getSnapshot = useCallback(() => (typeof store?.getSnapshot === 'function' ? store.getSnapshot() : undefined), [store])
      return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    }

    // ---- 01-css.js ---------------------------------------------------------
    /** Styles for the Workflows tab. Theme tokens only, no hardcoded colours. */
    const CSS = `
    .wfv-root{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);padding:2px}
    .wfv-bar{position:sticky;top:0;z-index:1;display:flex;flex-direction:column;gap:8px;padding-bottom:8px;background:var(--dsw-alias-bg-base);border-bottom:.5px solid var(--dsw-alias-border-l1)}
    .wfv-bar-row{display:flex;align-items:center;gap:8px;min-width:0}
    .wfv-title{font-weight:600;font-size:13px;letter-spacing:-.01em}
    .wfv-spacer{flex:1}
    .wfv-count,.wfv-meta{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;flex:none}
    .wfv-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .wfv-pill{box-sizing:border-box;height:24px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;font-weight:500;cursor:pointer;transition:background .12s,color .12s,border-color .12s}
    .wfv-pill:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
    .wfv-pill[data-on="true"]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
    .wfv-pill:disabled{opacity:.45;cursor:default}
    .wfv-pill:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
    .wfv-runs{display:flex;flex-direction:column;gap:1px;max-height:168px;overflow:auto;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:4px;background:var(--dsw-alias-bg-layer-1)}
    .wfv-run{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;text-align:left;padding:5px 8px;cursor:pointer;min-width:0}
    .wfv-run:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-run[aria-selected="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
    .wfv-run:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
    .wfv-run-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
    .wfv-run-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;flex:none;min-width:14px;text-align:right}
    .wfv-chip{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
    .wfv-chip[data-s="running"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
    .wfv-chip[data-s="failed"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 14%,transparent);color:var(--dsw-alias-state-error-primary,#dc2626)}
    .wfv-chip[data-s="completed"]{background:color-mix(in srgb,var(--dsw-alias-success,#22c55e) 14%,transparent);color:var(--dsw-alias-success,#22c55e)}
    .wfv-timeline{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:2px 0}
    .wfv-phase{display:flex;flex-direction:column;gap:6px}
    .wfv-phase-head{display:flex;align-items:center;gap:8px;position:sticky;top:0;background:var(--dsw-alias-bg-base);padding:2px 0}
    .wfv-phase-pill{flex:none;font-size:10px;line-height:16px;padding:0 8px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.06em}
    .wfv-phase-count{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
    .wfv-phase-line{flex:1;height:1px;background:var(--dsw-alias-border-l1)}
    .wfv-phase-body{display:flex;flex-direction:column;gap:4px;padding-left:2px;border-left:1px solid var(--dsw-alias-border-l1);margin-left:6px;padding-left:10px}
    .wfv-member{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0}
    .wfv-member:hover{border-color:var(--dsw-alias-border-l2)}
    .wfv-member[data-s="failed"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 40%,transparent)}
    .wfv-dot{flex:none;width:7px;height:7px;margin-top:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#9ca3af)}
    .wfv-dot[data-s="running"]{background:var(--dsw-alias-brand-primary);animation:wfv-pulse 1.6s ease-in-out infinite}
    .wfv-dot[data-s="completed"]{background:var(--dsw-alias-success,#22c55e)}
    .wfv-dot[data-s="failed"]{background:var(--dsw-alias-state-error-primary,#dc2626)}
    @keyframes wfv-pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .wfv-member-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .wfv-member-title{display:flex;align-items:center;gap:8px;min-width:0}
    .wfv-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
    .wfv-state{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-tertiary)}
    .wfv-state[data-s="running"]{color:var(--dsw-alias-brand-primary)}
    .wfv-state[data-s="failed"]{color:var(--dsw-alias-state-error-primary,#dc2626)}
    .wfv-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wfv-actions{flex:none;display:flex;gap:4px}
    .wfv-icon{box-sizing:border-box;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:.5px solid transparent;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;line-height:1;cursor:pointer}
    .wfv-icon:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-icon:disabled{opacity:.35;cursor:default}
    .wfv-icon:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
    .wfv-btn{box-sizing:border-box;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;margin-top:8px}
    .wfv-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-empty{color:var(--dsw-alias-label-secondary);font-size:12px;padding:10px 2px}
    .wfv-empty-box{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px;border:.5px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1)}
    .wfv-note{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px;border-top:.5px solid var(--dsw-alias-border-l1);padding-top:6px}
    .wfv-error{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:12px}
    `

    // ---- 02-i18n.js --------------------------------------------------------
    /** Locale namespace and dictionaries. Both languages carry the same keys. */
    const NS = '@local/dsh-workflow-view'

    const DICT = {
      en: {
        tab: 'Workflows',
        header: 'Workflows',
        headerTitle: 'Runs started by the workflow tool in this session',
        runs: 'runs',
        noRuns: 'No workflow run in this session yet. The workflow tool records one run per execution.',
        noMatch: 'No run matches this filter.',
        showAll: 'Show all runs',
        noMembers: 'This run recorded no members.',
        noPhase: 'no phase',
        phase: 'phase',
        members: 'members',
        failed: 'failed',
        running: 'running',
        completed: 'completed',
        cancelled: 'cancelled',
        interrupted: 'interrupted',
        unknown: 'unknown',
        all: 'All',
        filterRunning: 'Running',
        filterFailed: 'Failed',
        open: 'Open',
        openAside: 'Beside',
        route: 'route',
        tokens: 'tokens',
        noRoute: 'no route',
        logsNote: 'Script output is not durable: the log keeps run and member lifecycle only.',
      },
      pt: {
        tab: 'Workflows',
        header: 'Workflows',
        headerTitle: 'Execuções iniciadas pela tool workflow nesta sessão',
        runs: 'execuções',
        noRuns: 'Nenhuma execução de workflow nesta sessão ainda. A tool grava uma execução por chamada.',
        noMatch: 'Nenhuma execução corresponde a este filtro.',
        showAll: 'Mostrar todas',
        noMembers: 'Esta execução não registrou membros.',
        noPhase: 'sem fase',
        phase: 'fase',
        members: 'membros',
        failed: 'falhas',
        running: 'em execução',
        completed: 'concluída',
        cancelled: 'cancelada',
        interrupted: 'interrompida',
        unknown: 'desconhecido',
        all: 'Todas',
        filterRunning: 'Em execução',
        filterFailed: 'Com falha',
        open: 'Abrir',
        openAside: 'Ao lado',
        route: 'rota',
        tokens: 'tokens',
        noRoute: 'sem rota',
        logsNote: 'A saída do script não é durável: o log guarda só o ciclo de vida de execução e membros.',
      },
    }

    // ---- 03-model.js -------------------------------------------------------
    /**
     * Pure model of what the tab shows: the projection's runs, enriched with the
     * route each member was created with (subagent catalog) and its live status and
     * tokens (client session store).
     *
     * Everything here is a function of plain data, so the browser and the tests
     * compute the same rows.
     */

    /** Glyph per member status. */
    const GLYPH = {
      running: '◐',
      completed: '✓',
      failed: '✗',
      cancelled: '⊘',
      interrupted: '⊘',
      unknown: '·',
    }

    /** Compact token count. */
    function formatTokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
      if (value < 1000) return String(Math.round(value))
      if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
      return `${(value / 1_000_000).toFixed(1)}M`
    }

    /** Compact duration. */
    function formatDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null
      const seconds = Math.round(ms / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
      return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
    }

    /** Modes the subagent chat resource accepts. */
    const MODES = new Set(['one-shot', 'continuable', 'unknown'])

    /** Address the sidebar chat tab accepts; both `parent` and `mode` are required. */
    function chatAddress({ parentSessionId, childSessionId, mode }) {
      if (typeof childSessionId !== 'string' || childSessionId === '') throw new Error('a child session is required')
      const effective = MODES.has(mode) ? mode : 'continuable'
      const query = new URLSearchParams({ parent: parentSessionId ?? '', mode: effective })
      return `dsh-resource://subagentchat/session/${encodeURIComponent(childSessionId)}?${query}`
    }

    /** Payload `uiWorkspace.openSession` expects. */
    function openTarget({ parentSessionId, childSessionId, mode }) {
      if (typeof childSessionId !== 'string' || childSessionId === '') throw new Error('a child session is required')
      return { parentSessionId, childSessionId, mode: MODES.has(mode) ? mode : 'continuable' }
    }

    /**
     * Ask the sidebar to open the Workflows tab, using the most explicit API the
     * shell offers. Each of the three returns nothing, success or not, so this
     * reports which one it used instead of pretending to know it worked.
     * @param {object} right the `sidebarRight` service, when composed.
     * @param {string} [sessionId] the session the action was clicked in.
     * @returns {'openTabIn'|'openTab'|'openResource'|'none'}
     */
    function openWorkflowTab(right, sessionId) {
      const address = `dsh-resource://workflow-view/session/${encodeURIComponent(sessionId ?? 'current')}`
      // Presence is checked explicitly: `right?.method?.()` returns undefined for a
      // method that does not exist, which would look like a successful call.
      const attempts = [
        ['openTabIn', typeof right?.openTabIn === 'function', () => right.openTabIn(sessionId, 'workflow')],
        ['openTab', typeof right?.openTab === 'function', () => right.openTab('workflow')],
        ['openResource', typeof right?.openResource === 'function', () => right.openResource(address, { kind: 'workflow', preferNewPane: true })],
      ]
      for (const [name, present, run] of attempts) {
        if (!present) continue
        try {
          run()
          return name
        } catch {
          // the next shape may exist in a different shell generation
        }
      }
      return 'none'
    }

    /** Route text of one catalog entry. */
    function routeOf(entry) {
      if (entry?.agentProvider === undefined || entry?.agentModel === undefined) return null
      const effort = entry.agentReasoningEffort
      return `${entry.agentProvider}/${entry.agentModel}${effort === undefined || effort === null ? '' : `#${effort}`}`
    }

    /** Token total of one session summary. */
    function tokensOf(summary) {
      const totals = summary?.projectionValues?.tokenUsage?.totals
      if (totals === undefined) return null
      const sum = (totals.uncachedInputTokens ?? 0) + (totals.outputTokens ?? 0)
      return sum > 0 ? sum : null
    }

    /**
     * Member status: the live flag wins, then the recorded outcome. A member with
     * neither is `unknown`, never a fabricated completion.
     */
    function memberStatus(recorded, summary) {
      if (summary?.running === true) return 'running'
      return recorded ?? 'unknown'
    }

    /** Index catalog entries by child id. */
    function catalogIndex(catalog) {
      const index = new Map()
      for (const entry of Array.isArray(catalog) ? catalog : []) {
        if (typeof entry?.id === 'string') index.set(entry.id, entry)
      }
      return index
    }

    /** Group members by phase, preserving first appearance order. */
    function groupByPhase(members, noPhaseLabel) {
      const groups = []
      const index = new Map()
      for (const member of members) {
        const phase = member.phase ?? null
        if (!index.has(phase)) {
          const group = { phase, label: phase ?? noPhaseLabel, members: [] }
          index.set(phase, group)
          groups.push(group)
        }
        index.get(phase).members.push(member)
      }
      return groups
    }

    /**
     * Build the tab's rows.
     * @param {object} input
     * @param {object|undefined} input.view the `workflowRuns` projection view.
     * @param {object[]|undefined} input.catalog the `subagentCatalog` view.
     * @param {object|undefined} input.sessions the client session store snapshot.
     * @param {'all'|'running'|'failed'} [input.filter] run filter.
     * @param {number} [input.now] render timestamp, for durations of running members.
     * @param {string} input.noPhaseLabel label used for members without a phase.
     */
    function buildTab({ view, catalog, sessions, filter = 'all', now = Date.now(), noPhaseLabel = 'no phase' }) {
      const index = catalogIndex(catalog)
      const byId = sessions?.byId ?? {}
      const runs = (view?.runs ?? [])
        .map((run) => {
          const members = (run.agents ?? []).map((agent) => {
            const entry = agent.childId === null ? undefined : index.get(agent.childId)
            const summary = agent.childId === null ? undefined : byId[agent.childId]
            const status = memberStatus(agent.status, summary)
            const started = agent.startedAt ?? summary?.createdAt ?? null
            const ended = agent.endedAt ?? null
            const durationMs = started === null ? null : (ended ?? now) - started
            return {
              seq: agent.seq,
              mode: MODES.has(entry?.mode) ? entry.mode : 'continuable',
              label: agent.label || entry?.label || (agent.childId ?? '').slice(0, 8) || `#${agent.seq}`,
              phase: agent.phase ?? null,
              childId: agent.childId ?? null,
              status,
              glyph: GLYPH[status] ?? '·',
              route: routeOf(entry),
              tokens: tokensOf(summary),
              durationMs: status === 'running' || status === 'unknown' ? null : durationMs,
              startedAt: started,
            }
          })
          return {
            ...run,
            members,
            groups: groupByPhase(members, noPhaseLabel),
            counts: {
              total: members.length,
              running: members.filter((member) => member.status === 'running').length,
              failed: members.filter((member) => member.status === 'failed').length,
            },
          }
        })
        .filter((run) => (filter === 'running' ? run.status === 'running' || run.counts.running > 0 : filter === 'failed' ? run.counts.failed > 0 : true))
      return runs
    }

    /** One-line fact string for a member row. */
    function memberFacts(member, t) {
      return [
        member.phase === null ? null : `${t('phase')} ${member.phase}`,
        member.route ?? t('noRoute'),
        formatTokens(member.tokens) === null ? null : `${formatTokens(member.tokens)} ${t('tokens')}`,
        formatDuration(member.durationMs),
      ].filter((fact) => fact !== null && fact !== undefined).join(' · ')
    }

    // ---- 04-tab.js ---------------------------------------------------------
    /**
     * The Workflows tab body.
     *
     * Layout rules learned the hard way:
     *   - the toolbar (runs + filters) is ALWAYS rendered, so a filter that matches
     *     nothing never traps the user in an empty state;
     *   - empty states are distinct: no run at all, filter matched nothing (with a
     *     "show all" escape), and a run with no members;
     *   - every action has an accessible name, and the child link carries the `mode`
     *     the subagent chat resource requires.
     *
     * Rendering is split into small functions so the tree stays readable and no JSX
     * nesting has to be counted by hand.
     */

    /** Session the tab should show, published by the header action. */
    let activeSession

    /** Filters in display order, with their dictionary key. */
    const FILTERS = [
      { id: 'all', label: 'all' },
      { id: 'running', label: 'filterRunning' },
      { id: 'failed', label: 'filterFailed' },
    ]

    /** One member row: status dot, label, facts and the two navigation actions. */
    function renderMember(member, { t, navigate }) {
      return h('article', { key: `${member.phase ?? '-'}:${member.seq}`, className: 'wfv-member', 'data-s': member.status },
        h('span', { className: 'wfv-dot', 'data-s': member.status, 'aria-hidden': true }),
        h('div', { className: 'wfv-member-main' },
          h('div', { className: 'wfv-member-title' },
            h('span', { className: 'wfv-label' }, member.label),
            h('span', { className: 'wfv-state', 'data-s': member.status }, t(member.status))),
          h('div', { className: 'wfv-facts' }, memberFacts(member, t))),
        h('div', { className: 'wfv-actions' },
          h('button', {
            type: 'button',
            className: 'wfv-icon',
            title: t('open'),
            'aria-label': `${t('open')} ${member.label}`,
            disabled: member.childId === null,
            onClick: () => navigate(member, false),
          }, '↗'),
          h('button', {
            type: 'button',
            className: 'wfv-icon',
            title: t('openAside'),
            'aria-label': `${t('openAside')} ${member.label}`,
            disabled: member.childId === null,
            onClick: () => navigate(member, true),
          }, '⇥')))
    }

    /** One phase section. */
    function renderGroup(group, context) {
      return h('section', { key: group.phase ?? '__none__', className: 'wfv-phase' },
        h('header', { className: 'wfv-phase-head' },
          h('span', { className: 'wfv-phase-pill' }, group.label),
          h('span', { className: 'wfv-phase-count' }, String(group.members.length)),
          h('span', { className: 'wfv-phase-line' })),
        h('div', { className: 'wfv-phase-body' }, ...group.members.map((member) => renderMember(member, context))))
    }

    /** The empty or filled body area. */
    function renderBody({ t, runs, allRuns, current, filter, setFilter, navigate }) {
      if (runs.length === 0) {
        return h('div', { className: 'wfv-empty-box' },
          h('div', null, allRuns.length === 0 ? t('noRuns') : t('noMatch')),
          allRuns.length === 0 ? null : h('button', { type: 'button', className: 'wfv-btn', onClick: () => setFilter('all') }, t('showAll')))
      }
      if (current === null || current.groups.length === 0) return h('div', { className: 'wfv-empty' }, t('noMembers'))
      return h('div', { className: 'wfv-timeline' }, ...current.groups.map((group) => renderGroup(group, { t, navigate })))
    }

    function WorkflowsTab({ ctx, t, sessionId, useProjection }) {
      const runsView = typeof useProjection === 'function' ? useProjection('workflowRuns') : undefined
      const catalog = typeof useProjection === 'function' ? useProjection('subagentCatalog') : undefined
      const sessions = useSessionSnapshot(ctx)
      const target = sessionId ?? activeSession
      const [filter, setFilter] = useState('all')
      const [selected, setSelected] = useState(null)
      const [error, setError] = useState(null)

      const allRuns = useMemo(
        () => buildTab({ view: runsView, catalog, sessions, filter: 'all', noPhaseLabel: t('noPhase') }),
        [runsView, catalog, sessions, t],
      )
      const runs = useMemo(
        () => buildTab({ view: runsView, catalog, sessions, filter, noPhaseLabel: t('noPhase') }),
        [runsView, catalog, sessions, filter, t],
      )
      const current = runs.find((run) => run.runId === selected) ?? runs[0] ?? null
      const counts = {
        all: allRuns.length,
        running: allRuns.filter((run) => run.status === 'running' || run.counts.running > 0).length,
        failed: allRuns.filter((run) => run.counts.failed > 0).length,
      }

      const navigate = (member, aside) => {
        if (member.childId === null) return
        setError(null)
        try {
          const payload = { parentSessionId: target, childSessionId: member.childId, mode: member.mode }
          if (aside === true) {
            serviceOf(ctx, 'sidebarRight')?.openResource?.(chatAddress(payload), { kind: 'subagentchat', preferNewPane: true })
          } else {
            serviceOf(ctx, 'uiWorkspace')?.openSession?.(openTarget(payload))
          }
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }

      const toolbar = h('div', { className: 'wfv-bar' },
        h('div', { className: 'wfv-bar-row' },
          h('span', { className: 'wfv-title' }, `⧉ ${t('tab')}`),
          h('span', { className: 'wfv-spacer' }),
          h('span', { className: 'wfv-count' }, `${counts.all} ${t('runs')}`)),
        h('div', { className: 'wfv-filters', role: 'group', 'aria-label': t('tab') },
          ...FILTERS.map((entry) => h('button', {
            key: entry.id,
            type: 'button',
            className: 'wfv-pill',
            'data-on': filter === entry.id,
            'aria-pressed': filter === entry.id,
            disabled: entry.id !== 'all' && counts[entry.id] === 0 && filter !== entry.id,
            onClick: () => setFilter(entry.id),
          }, entry.id === 'all' || counts[entry.id] === 0 ? t(entry.label) : `${t(entry.label)} ${counts[entry.id]}`))))

      const body = renderBody({ t, runs, allRuns, current, filter, setFilter, navigate })

      return h('div', { className: 'wfv-root' },
        h('style', null, CSS),
        toolbar,
        error === null ? null : h('div', { className: 'wfv-error', role: 'alert' }, error),
        counts.all === 0 ? null : h('div', { className: 'wfv-runs', role: 'listbox', 'aria-label': t('runs') },
          ...runs.map((run) => h('button', {
            key: run.runId,
            type: 'button',
            role: 'option',
            'aria-selected': current?.runId === run.runId,
            className: 'wfv-run',
            title: run.name || run.runId,
            onClick: () => setSelected(run.runId),
          },
            h('span', { className: 'wfv-run-name' }, run.name || run.runId.slice(0, 8)),
            run.counts.failed === 0 ? null : h('span', { className: 'wfv-chip', 'data-s': 'failed' }, String(run.counts.failed)),
            h('span', { className: 'wfv-chip', 'data-s': run.status }, t(run.status)),
            h('span', { className: 'wfv-run-facts' }, String(run.counts.total))))),
        body,
        h('div', { className: 'wfv-note' }, t('logsNote')))
    }

    /** Header action: count of runs, and the way into the tab. */
    function WorkflowsHeaderAction({ ctx, t, sessionId, useProjection }) {
      const view = typeof useProjection === 'function' ? useProjection('workflowRuns') : undefined
      const count = Array.isArray(view?.runs) ? view.runs.length : 0
      useEffect(() => {
        if (sessionId !== undefined) activeSession = sessionId
      }, [sessionId])

      const open = () => {
        if (sessionId !== undefined) activeSession = sessionId
        const used = openWorkflowTab(serviceOf(ctx, 'sidebarRight'), sessionId)
        if (used === 'none') console.warn('dsh-workflow-view: no sidebar API accepted the tab; open it from the right column tab strip')
      }

      return h('button', {
        type: 'button',
        className: WFV_HEADER_CLASS,
        title: t('headerTitle'),
        onClick: open,
      }, `⧉ ${t('header')}${count === 0 ? '' : ` ${count}`}`)
    }

    // ---- 05-apply.js -------------------------------------------------------
    /** What the client half needs from the shell. */
    const inject = ['slots', 'locale']

    /** Width-stable button used in the session header. */
    const WFV_HEADER_CLASS = 'wfv-header-btn'

    /**
     * Register the header action, the sidebar tab type and its body.
     * @param {object} ctx client root context.
     */
    function apply(ctx) {
      const disposeLocale = ctx.locale.register(NS, DICT)
      if (typeof disposeLocale === 'function') ctx.effect(() => disposeLocale)

      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.plugin = NS
        style.textContent = `.${WFV_HEADER_CLASS}{box-sizing:border-box;height:26px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
    .${WFV_HEADER_CLASS}:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
    .${WFV_HEADER_CLASS}:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}`
        document.head.appendChild(style)
        return () => style.remove()
      })

      // Header action: the entry point, with a count.
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: 'workflow-view',
        order: 20,
        locale: NS,
        inject: (sessionId) => ({ sessionId }),
      }, (props) => h(WorkflowsHeaderAction, { ...props, ctx })))

      // The tab type, then its body keyed by the same id.
      //
      // Registered through `inject`, never by probing once: the sidebar's tab registry
      // is mounted by its own package, and a probe that runs first would leave the
      // type unregistered — the header button then opens a kind nobody claims and
      // nothing happens.
      ctx.inject(['sidebarRightTabs'], (scope) => {
        const tabs = serviceOf(scope, 'sidebarRightTabs')
        if (tabs === undefined) return
        ctx.effect(() => tabs.register({
          id: 'workflow',
          kind: 'workflow',
          priority: 'builtin',
          title: () => 'Workflows',
          canOpen: () => true,
        }))
      })

      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: 'workflow',
        locale: NS,
        inject: (sessionId) => ({ sessionId }),
      }, (props) => h(WorkflowsTab, { ...props, ctx })))
    }

    /** Helpers the test suite exercises without a browser. */
    testApi = { buildTab, formatTokens, formatDuration, routeOf, groupByPhase, memberStatus, chatAddress, openTarget, openWorkflowTab }

    return { inject, apply, __test: testApi }
  },
})
