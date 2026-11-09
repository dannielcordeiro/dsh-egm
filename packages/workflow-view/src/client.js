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
    /** Styles for the Workflows tab. Theme tokens only. */
    const CSS = `
    .wfv-root{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
    .wfv-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .wfv-title{font-weight:600}
    .wfv-meta{color:var(--dsw-alias-label-secondary);font-size:12px}
    .wfv-runs{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:4px;background:var(--dsw-alias-bg-layer-1)}
    .wfv-run{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;text-align:left;padding:4px 8px;cursor:pointer;min-width:0}
    .wfv-run:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-run[aria-selected="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
    .wfv-run:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
    .wfv-run-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wfv-run-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;flex:none}
    .wfv-chip{flex:none;font-size:11px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-secondary)}
    .wfv-chip[data-s="running"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
    .wfv-chip[data-s="failed"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 14%,transparent);color:var(--dsw-alias-state-error-primary,#dc2626)}
    .wfv-chip[data-s="completed"]{background:color-mix(in srgb,var(--dsw-alias-success,#22c55e) 14%,transparent);color:var(--dsw-alias-success,#22c55e)}
    .wfv-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .wfv-btn{box-sizing:border-box;height:24px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer}
    .wfv-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-btn[data-on="true"]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
    .wfv-timeline{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}
    .wfv-phase{display:flex;flex-direction:column;gap:4px}
    .wfv-phase-head{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
    .wfv-phase-line{flex:1;height:1px;background:var(--dsw-alias-border-l1)}
    .wfv-member{display:flex;align-items:flex-start;gap:8px;padding:5px 6px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0}
    .wfv-member[data-s="failed"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 40%,transparent)}
    .wfv-glyph{flex:none;width:14px;text-align:center}
    .wfv-member-main{flex:1;min-width:0;display:flex;flex-direction:column}
    .wfv-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wfv-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wfv-actions{flex:none;display:flex;gap:4px}
    .wfv-empty{color:var(--dsw-alias-label-secondary);font-size:12px;padding:12px 4px}
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
     * Reads three views of the same session — our `workflowRuns` projection, the
     * host's `subagentCatalog` and the client session store — and renders a run
     * selector plus a phase-grouped timeline. No timer, no command: opening the tab
     * costs nothing to the transcript.
     */

    /** Session the tab should show, published by the header action. */
    let activeSession

    function WorkflowsTab({ ctx, t, sessionId, useProjection }) {
      const runsView = typeof useProjection === 'function' ? useProjection('workflowRuns') : undefined
      const catalog = typeof useProjection === 'function' ? useProjection('subagentCatalog') : undefined
      const sessions = useSessionSnapshot(ctx)
      const target = sessionId ?? activeSession
      const [filter, setFilter] = useState('all')
      const [selected, setSelected] = useState(null)
      const [error, setError] = useState(null)

      const runs = useMemo(
        () => buildTab({ view: runsView, catalog, sessions, filter, noPhaseLabel: t('noPhase') }),
        [runsView, catalog, sessions, filter, t],
      )

      const current = runs.find((run) => run.runId === selected) ?? runs[0] ?? null

      const openMember = (childId, aside) => {
        if (childId === null || childId === undefined) return
        try {
          if (aside === true) {
            serviceOf(ctx, 'sidebarRight')?.openResource?.(`dsh-resource://subagentchat/session/${encodeURIComponent(childId)}?parent=${encodeURIComponent(target ?? '')}`, { kind: 'subagentchat', preferNewPane: true })
          } else {
            serviceOf(ctx, 'uiWorkspace')?.openSession?.({ parentSessionId: target, childSessionId: childId })
          }
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }

      if (runsView === undefined) return h('div', { className: 'wfv-root' }, h('style', null, CSS), h('div', { className: 'wfv-empty' }, t('noRuns')))
      if (runs.length === 0) {
        return h('div', { className: 'wfv-root' },
          h('style', null, CSS),
          h('div', { className: 'wfv-head' }, h('span', { className: 'wfv-title' }, t('tab'))),
          h('div', { className: 'wfv-empty' }, t('noRuns')))
      }

      return h('div', { className: 'wfv-root' },
        h('style', null, CSS),
        h('div', { className: 'wfv-head' },
          h('span', { className: 'wfv-title' }, t('tab')),
          h('span', { className: 'wfv-meta' }, `${runs.length} ${t('runs')}`)),
        error === null ? null : h('div', { className: 'wfv-error', role: 'alert' }, error),

        h('div', { className: 'wfv-runs', role: 'listbox', 'aria-label': t('runs') },
          ...runs.map((run) => h('button', {
            key: run.runId,
            type: 'button',
            role: 'option',
            'aria-selected': current?.runId === run.runId,
            className: 'wfv-run',
            onClick: () => setSelected(run.runId),
          },
            h('span', { className: 'wfv-run-name', title: run.runId }, run.name || run.runId.slice(0, 8)),
            run.counts.failed === 0 ? null : h('span', { className: 'wfv-chip', 'data-s': 'failed' }, `${run.counts.failed} ${t('failed')}`),
            h('span', { className: 'wfv-chip', 'data-s': run.status }, t(run.status === 'running' ? 'running' : run.status)),
            h('span', { className: 'wfv-run-facts' }, `${run.counts.total} ${t('members')}`)))),

        h('div', { className: 'wfv-filters' },
          ...[['all', t('all')], ['running', t('filterRunning')], ['failed', t('filterFailed')]].map(([value, label]) => h('button', {
            key: value,
            type: 'button',
            className: 'wfv-btn',
            'data-on': filter === value,
            onClick: () => setFilter(value),
          }, label)),
          h('span', { className: 'wfv-meta' }, t('logsNote'))),

        h('div', { className: 'wfv-timeline' },
          current === null ? null : current.groups.map((group) => h('div', { key: group.phase ?? '__none__', className: 'wfv-phase' },
            h('div', { className: 'wfv-phase-head' },
              h('span', null, group.label),
              h('span', { className: 'wfv-phase-line' })),
            ...group.members.map((member) => h('div', { key: `${member.phase ?? '-'}:${member.seq}`, className: 'wfv-member', 'data-s': member.status },
              h('span', { className: 'wfv-glyph', 'aria-hidden': true }, member.glyph),
              h('span', { className: 'wfv-member-main' },
                h('span', { className: 'wfv-label' }, member.label),
                h('span', { className: 'wfv-facts' }, memberFacts(member, t))),
              h('span', { className: 'wfv-actions' },
                h('button', { type: 'button', className: 'wfv-btn', title: t('open'), disabled: member.childId === null, onClick: () => openMember(member.childId, false) }, t('open')),
                h('button', { type: 'button', className: 'wfv-btn', title: t('openAside'), disabled: member.childId === null, onClick: () => openMember(member.childId, true) }, '⇥')))))),
          current === null ? h('div', { className: 'wfv-empty' }, t('noMembers')) : null))
    }

    /** Header action: count of runs, and the way into the tab. */
    function WorkflowsHeaderAction({ ctx, t, sessionId, useProjection }) {
      const view = typeof useProjection === 'function' ? useProjection('workflowRuns') : undefined
      const count = Array.isArray(view?.runs) ? view.runs.length : 0
      useEffect(() => {
        if (sessionId !== undefined) activeSession = sessionId
      }, [sessionId])

      const open = () => {
        try {
          if (sessionId !== undefined) activeSession = sessionId
          const right = serviceOf(ctx, 'sidebarRight')
          if (typeof right?.openTab === 'function') right.openTab('workflow')
          else right?.openResource?.(`dsh-resource://workflow-view/session/${encodeURIComponent(sessionId ?? 'current')}`, { kind: 'workflow', preferNewPane: true })
        } catch (failure) {
          console.warn(`dsh-workflow-view: could not open the tab: ${String(failure?.message ?? failure)}`)
        }
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
      ctx.effect(() => {
        const tabs = serviceOf(ctx, 'sidebarRightTabs')
        if (tabs === undefined) return () => {}
        return tabs.register({
          id: 'workflow',
          kind: 'workflow',
          priority: 'builtin',
          title: () => 'Workflows',
          canOpen: () => true,
        })
      })

      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: 'workflow',
        locale: NS,
        inject: (sessionId) => ({ sessionId }),
      }, (props) => h(WorkflowsTab, { ...props, ctx })))
    }

    /** Helpers the test suite exercises without a browser. */
    testApi = { buildTab, formatTokens, formatDuration, routeOf, groupByPhase, memberStatus }

    return { inject, apply, __test: testApi }
  },
})
