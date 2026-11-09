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
