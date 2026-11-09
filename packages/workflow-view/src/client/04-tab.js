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
