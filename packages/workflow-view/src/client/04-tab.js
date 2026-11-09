/**
 * The Workflows tab body.
 *
 * Reading order, top to bottom: session totals → filters → run list → the
 * selected run (status, progress) → its phases, each member with a proportional
 * duration bar and an expandable detail. The toolbar is ALWAYS rendered, so a
 * filter that matches nothing can always be undone; empty states are distinct and
 * name themselves.
 */

/** Session the tab should show, published by the header action. */
let activeSession

/** Density preference, per browser. */
const DENSITY_KEY = 'dsh-workflow-view:density'

/** Filters in display order, with their dictionary key. */
const FILTERS = [
  { id: 'all', label: 'all' },
  { id: 'running', label: 'filterRunning' },
  { id: 'failed', label: 'filterFailed' },
]

/** Read the stored density, falling back when storage is unavailable. */
function readDensity() {
  try {
    return globalThis.localStorage?.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

/** Persist the density; a blocked storage must not break the tab. */
function writeDensity(value) {
  try {
    globalThis.localStorage?.setItem(DENSITY_KEY, value)
  } catch {
    // preference is a convenience, not state
  }
}

/** Inline icon used by the empty states. */
function emptyIcon() {
  return h('svg', { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true },
    h('path', { d: 'M4 6h6v5H4zM14 6h6v5h-6zM4 15h6v5H4z' }),
    h('path', { d: 'M14 17h6' }))
}

/** Status dot. */
function renderDot(status) {
  return h('span', { className: 'wfv-dot', 'data-s': status, 'aria-hidden': true })
}

/** Segmented progress bar for one run. */
function renderProgress(progress) {
  return h('div', { className: 'wfv-progress', role: 'img', 'aria-hidden': true },
    ...progress.segments.map((segment) => h('i', { key: segment.status, 'data-s': segment.status, style: { width: `${(segment.fraction * 100).toFixed(2)}%` } })))
}

/** Legend for the status colours, shown inside the run card. */
function renderLegend({ t, progress }) {
  const shown = progress.segments.filter((segment) => segment.status !== 'unknown')
  if (shown.length <= 1) return null
  return h('div', { className: 'wfv-legend', 'aria-label': t('legend') },
    ...shown.map((segment) => h('span', { key: segment.status },
      h('span', { className: 'wfv-dot', 'data-s': segment.status, 'aria-hidden': true }),
      `${t(segment.status)} ${segment.count}`)))
}

/** One member row: status, label, state, duration bar, actions and details. */
function renderMember(member, context) {
  const { t, navigate, toggleDetail, expanded, now, copied, copyId } = context
  const open = expanded[`${member.phase ?? '-'}:${member.seq}`] === true
  const barStyle = member.bar === null ? null : { left: `${(member.bar.left * 100).toFixed(2)}%`, width: `${(member.bar.width * 100).toFixed(2)}%` }
  return h('article', { key: `${member.phase ?? '-'}:${member.seq}`, className: 'wfv-member', 'data-s': member.status },
    h('div', { className: 'wfv-member-top' },
      renderDot(member.status),
      h('button', {
        type: 'button',
        className: 'wfv-label',
        'aria-expanded': open,
        title: t('details'),
        onClick: () => toggleDetail(member),
      }, member.label),
      h('span', { className: 'wfv-state', 'data-s': member.status }, t(member.status)),
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
        }, '⇥'))),
    member.bar === null ? null : h('span', { className: 'wfv-track', 'aria-hidden': true },
      h('i', { 'data-s': member.status, 'data-live': member.bar.live === true, style: barStyle })),
    h('div', { className: 'wfv-facts' }, memberFacts(member, t, { now })),
    open ? h('dl', { className: 'wfv-detail' },
      h('dt', null, t('seq')), h('dd', null, String(member.seq)),
      h('dt', null, t('child')), h('dd', { className: 'wfv-mono', title: member.childId ?? '' }, member.childId ?? '—'),
      h('dt', null, t('model')), h('dd', { className: 'wfv-mono', title: member.route ?? '' }, member.route ?? t('noRoute')),
      member.requestedRoute === null || member.requestedRoute === member.route ? null : h('dt', null, t('requested')),
      member.requestedRoute === null || member.requestedRoute === member.route ? null : h('dd', { className: 'wfv-mono' }, member.requestedRoute),
      h('dt', null, t('mode')), h('dd', null, member.mode),
      h('dt', null, t('start')), h('dd', { className: 'wfv-num' }, formatClock(member.startedAt) ?? '—'),
      h('dt', null, t('duration')), h('dd', { className: 'wfv-num' }, formatDuration(member.rawDurationMs) ?? '—'),
      h('dt', null, ''), h('dd', null, h('button', {
        type: 'button',
        className: 'wfv-btn',
        onClick: () => copyId(member.childId),
      }, copied === member.childId ? t('copied') : t('copy')))) : null)
}

/** One phase section. */
function renderGroup(group, context) {
  const phase = context.run.phases.find((entry) => entry.phase === group.phase)
  return h('section', { key: group.phase ?? '__none__', className: 'wfv-phase' },
    h('header', { className: 'wfv-phase-head' },
      h('span', { className: 'wfv-phase-pill' }, group.label),
      h('span', { className: 'wfv-phase-count' }, phase?.durationMs === null || phase?.durationMs === undefined
        ? String(group.members.length)
        : `${group.members.length} · ${formatDuration(phase.durationMs)}`),
      h('span', { className: 'wfv-phase-line' })),
    h('div', { className: 'wfv-phase-body' }, ...group.members.map((member) => renderMember(member, context))))
}

/** The selected run's header card. */
function renderRunCard({ t, run, now }) {
  return h('div', { className: 'wfv-card' },
    h('div', { className: 'wfv-card-top' },
      h('span', { className: 'wfv-card-name', title: run.runId }, run.name || run.runId.slice(0, 8)),
      h('span', { className: 'wfv-chip', 'data-s': run.status }, t(run.status))),
    h('div', { className: 'wfv-card-meta' },
      `${t('start')} ${formatRelative(run.span.start, now) ?? '—'}`,
      h('span', { className: 'wfv-sep' }, '·'),
      `${t('duration')} ${formatDuration(run.span.durationMs) ?? '—'}`,
      h('span', { className: 'wfv-sep' }, '·'),
      `${run.counts.total} ${t('members')}`,
      run.counts.failed === 0 ? null : h('span', { className: 'wfv-sep' }, '·'),
      run.counts.failed === 0 ? null : h('span', { className: 'wfv-chip', 'data-s': 'failed' }, `${run.counts.failed} ${t('failed')}`)),
    renderProgress(run.progress),
    renderLegend({ t, progress: run.progress }))
}

/** The empty or filled body area. */
function renderBody({ t, runs, allRuns, current, setFilter, context }) {
  if (runs.length === 0) {
    return h('div', { className: 'wfv-empty wfv-empty-box' },
      emptyIcon(),
      h('div', null, allRuns.length === 0 ? t('noRuns') : t('noMatch')),
      allRuns.length === 0 ? null : h('button', { type: 'button', className: 'wfv-btn', onClick: () => setFilter('all') }, t('showAll')))
  }
  if (current === null || current.groups.length === 0) {
    return h('div', { className: 'wfv-empty' }, emptyIcon(), h('div', null, t('noMembers')))
  }
  return h('div', { className: 'wfv-timeline' },
    renderRunCard({ t, run: current, now: context.now }),
    ...current.groups.map((group) => renderGroup(group, context)))
}

function WorkflowsTab({ ctx, t, sessionId, useProjection }) {
  const runsView = typeof useProjection === 'function' ? useProjection('workflowRuns') : undefined
  const catalog = typeof useProjection === 'function' ? useProjection('subagentCatalog') : undefined
  const sessions = useSessionSnapshot(ctx)
  const target = sessionId ?? activeSession
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [copied, setCopied] = useState(null)
  const [error, setError] = useState(null)
  const [density, setDensity] = useState(readDensity)
  const now = Date.now()

  const allRuns = useMemo(
    () => buildTab({ view: runsView, catalog, sessions, filter: 'all', now, noPhaseLabel: t('noPhase') }),
    [runsView, catalog, sessions, now, t],
  )
  const runs = useMemo(
    () => buildTab({ view: runsView, catalog, sessions, filter, now, noPhaseLabel: t('noPhase') }),
    [runsView, catalog, sessions, filter, now, t],
  )
  const current = runs.find((run) => run.runId === selected) ?? runs[0] ?? null
  const totals = useMemo(() => summarize(allRuns), [allRuns])
  const counts = {
    all: totals.runs,
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

  const toggleDetail = (member) => {
    const key = `${member.phase ?? '-'}:${member.seq}`
    setExpanded({ ...expanded, [key]: expanded[key] !== true })
  }

  const copyId = (childId) => {
    if (childId === null) return
    try {
      void navigator.clipboard?.writeText?.(childId)
      setCopied(childId)
    } catch {
      setError(t('copy'))
    }
  }

  const toggleDensity = () => {
    const next = density === 'compact' ? 'comfortable' : 'compact'
    setDensity(next)
    writeDensity(next)
  }

  const toolbar = h('div', { className: 'wfv-bar-head' },
    h('div', { className: 'wfv-head' },
      h('span', { className: 'wfv-title' }, `⧉ ${t('tab')}`),
      h('span', { className: 'wfv-spacer' }),
      h('span', { className: 'wfv-totals', 'aria-live': 'polite' },
        `${totals.runs} ${t('runs')}`,
        h('span', { className: 'wfv-sep' }, '·'),
        `${totals.members} ${t('members')}`,
        totals.failed === 0 ? null : h('span', { className: 'wfv-sep' }, '·'),
        totals.failed === 0 ? null : h('span', null, `${totals.failed} ${t('failed')}`),
        totals.tokens === 0 ? null : h('span', { className: 'wfv-sep' }, '·'),
        totals.tokens === 0 ? null : h('span', { className: 'wfv-num' }, `${formatTokens(totals.tokens)} ${t('tokens')}`))),
    h('div', { className: 'wfv-filters', role: 'group', 'aria-label': t('tab') },
      ...FILTERS.map((entry) => h('button', {
        key: entry.id,
        type: 'button',
        className: 'wfv-pill',
        'data-on': filter === entry.id,
        'aria-pressed': filter === entry.id,
        disabled: entry.id !== 'all' && counts[entry.id] === 0 && filter !== entry.id,
        onClick: () => setFilter(entry.id),
      }, entry.id === 'all' || counts[entry.id] === 0 ? t(entry.label) : `${t(entry.label)} ${counts[entry.id]}`)),
      h('span', { className: 'wfv-spacer' }),
      h('button', {
        type: 'button',
        className: 'wfv-pill',
        'data-on': density === 'compact',
        'aria-pressed': density === 'compact',
        title: t('densityTitle'),
        onClick: toggleDensity,
      }, t('density'))))

  const context = { t, navigate, toggleDetail, expanded, now, copied, copyId, run: current }
  const body = renderBody({ t, runs, allRuns, current, setFilter, context })

  return h('div', { className: 'wfv-root', 'data-density': density },
    h('style', null, CSS),
    toolbar,
    error === null ? null : h('div', { className: 'wfv-error', role: 'alert' }, error),
    runs.length === 0 ? null : h('div', { className: 'wfv-runs', role: 'listbox', 'aria-label': t('runs') },
      ...runs.map((run) => h('button', {
        key: run.runId,
        type: 'button',
        role: 'option',
        'aria-selected': current?.runId === run.runId,
        className: 'wfv-run',
        title: run.name || run.runId,
        onClick: () => setSelected(run.runId),
      },
        renderDot(run.status),
        h('span', { className: 'wfv-run-name' }, run.name || run.runId.slice(0, 8)),
        h('span', { className: 'wfv-run-when' }, run.status === 'running'
          ? [formatRelative(run.span.start, now), formatDuration(run.span.durationMs)].filter(Boolean).join(' · ') || '—'
          : formatDuration(run.span.durationMs) ?? '—'),
        h('span', { className: 'wfv-run-facts' },
          `${run.counts.total} ${t('members')}`,
          run.counts.failed === 0 ? null : h('span', { className: 'wfv-chip', 'data-s': 'failed' }, String(run.counts.failed))),
        h('span', { className: 'wfv-micro', 'aria-hidden': true },
          ...run.progress.segments.map((segment) => h('i', { key: segment.status, 'data-s': segment.status, style: { width: `${(segment.fraction * 100).toFixed(2)}%` } })))))),
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

  return h('span', null,
    h('style', null, HEADER_CSS),
    h('button', {
      type: 'button',
      className: WFV_HEADER_CLASS,
      title: t('headerTitle'),
      onClick: open,
    }, `⧉ ${t('header')}${count === 0 ? '' : ` ${count}`}`))
}
