/**
 * Pure model of what the tab shows: the projection's runs, enriched with the
 * route each member was created with (subagent catalog) and its live status and
 * tokens (client session store), plus the geometry the timeline needs.
 *
 * Everything here is a function of plain data, so the browser and the tests
 * compute the same rows, bars and totals.
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

/** Modes the subagent chat resource accepts. */
const MODES = new Set(['one-shot', 'continuable', 'unknown'])

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

/** Compact age of a timestamp, without a preposition. */
function formatRelative(at, now = Date.now()) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  const delta = Math.max(0, now - at)
  if (delta < 45_000) return 'now'
  const minutes = Math.round(delta / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(delta / 3_600_000)
  if (hours < 24) return `${hours} h`
  return `${Math.round(delta / 86_400_000)} d`
}

/** Local clock time, HH:MM:SS. */
function formatClock(at) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  const date = new Date(at)
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

/** Address the sidebar chat tab accepts; both `parent` and `mode` are required. */
function chatAddress({ parentSessionId, childSessionId, mode }) {
  if (typeof childSessionId !== 'string' || childSessionId === '') throw new Error('a child session is required')
  const query = new URLSearchParams({ parent: parentSessionId ?? '', mode: MODES.has(mode) ? mode : 'continuable' })
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

/**
 * Token total of one session summary.
 *
 * `tokenUsage`'s wire view is the bucket object itself (`{uncachedInputTokens,
 * outputTokens, …}`), not `{totals}`; the older shape is still accepted so a
 * differing Host build cannot blank the number.
 */
function tokensOf(summary) {
  const wire = summary?.projectionValues?.tokenUsage
  if (wire === undefined || wire === null) return null
  const buckets = wire.totals ?? wire
  const sum = (buckets.uncachedInputTokens ?? 0) + (buckets.outputTokens ?? 0)
  return sum > 0 ? sum : null
}

/** Route text of one recorded model selection. */
function selectionRoute(selection) {
  if (selection?.provider === undefined || selection?.model === undefined) return null
  const effort = selection.reasoningEffort
  return `${selection.provider}/${selection.model}${effort === undefined || effort === null ? '' : `#${effort}`}`
}

/**
 * The model that actually ran this member: the child session's own
 * `modelSelection` fold (`lastUsed`, the last request header), not the route the
 * caller asked for.
 */
function effectiveRouteOf(summary) {
  const selection = summary?.projectionValues?.modelSelection
  return selectionRoute(selection?.lastUsed) ?? selectionRoute(selection?.next)
}

/**
 * Member status. Only the live session flag may say `running`; a durable
 * lifecycle that never closed means the worker was interrupted (a crash, a
 * reboot), and a member with no record at all stays `unknown`.
 */
function memberStatus(recorded, summary) {
  if (summary?.running === true) return 'running'
  if (recorded === 'running' || recorded === 'open' || recorded === null || recorded === undefined) {
    return summary === undefined ? 'unknown' : 'interrupted'
  }
  return recorded
}

/**
 * Run status. A recorded stop reason wins; a recorded `running` does not, because
 * it can only come from a stale Host projection (a run killed by a reboot keeps
 * it forever). A run is running when one of its members is live right now, and
 * otherwise, if its lifecycle never closed, it is interrupted.
 */
function runStatus(run, members) {
  const recorded = run.stopReason ?? run.status
  if (recorded !== null && recorded !== undefined && recorded !== 'open' && recorded !== 'running') return recorded
  if (members.some((member) => member.status === 'running')) return 'running'
  if (members.length === 0) return 'unknown'
  return 'interrupted'
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

/** Span of one run: recorded when present, derived from members otherwise. */
function runSpan(run, now = Date.now()) {
  const starts = run.agents.map((agent) => agent.startedAt).filter((value) => typeof value === 'number')
  const ends = run.agents.map((agent) => agent.endedAt).filter((value) => typeof value === 'number')
  const start = run.startedAt ?? (starts.length === 0 ? null : Math.min(...starts))
  const approximate = run.startedAt === null || run.startedAt === undefined
  const end = run.endedAt ?? (run.status === 'running' ? now : ends.length === 0 ? start : Math.max(...ends))
  const span = { start, end: end === null ? null : Math.max(end, start ?? 0), approximate }
  return { ...span, durationMs: start === null || span.end === null ? null : span.end - start }
}

/**
 * Geometry of one member's bar inside the run span, as fractions of the track.
 * A member with no start has no bar; a running member extends to `now` and is
 * flagged live so the view can hatch it.
 */
function memberBar(member, span, now) {
  if (span.start === null || span.end === null || span.end <= span.start) {
    return typeof member.startedAt === 'number' ? { left: 0, width: 1, live: member.status === 'running' } : null
  }
  if (typeof member.startedAt !== 'number') return null
  const total = span.end - span.start
  const left = Math.min(1, Math.max(0, (member.startedAt - span.start) / total))
  const rawEnd = typeof member.endedAt === 'number' ? member.endedAt : member.status === 'running' ? now : member.startedAt
  const width = Math.min(1 - left, Math.max(0, (rawEnd - member.startedAt) / total))
  return { left, width: width <= 0 ? 0.01 : width, live: member.status === 'running' }
}

/** Completed / running / failed / unknown split, with fractions for the bar. */
function runProgress(run) {
  const counts = { completed: 0, running: 0, failed: 0, unknown: 0 }
  for (const agent of run.agents ?? []) {
    const status = agent.status
    counts[status] = (counts[status] ?? 0) + 1
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const segments = ['completed', 'running', 'failed', 'unknown']
    .map((status) => ({ status, count: counts[status] ?? 0, fraction: total === 0 ? 0 : (counts[status] ?? 0) / total }))
    .filter((segment) => segment.count > 0)
  return { counts, total, segments }
}

/** Duration and member count of each phase group. */
function aggregatePhases(groups) {
  return groups.map((group) => {
    const starts = group.members.map((member) => member.startedAt).filter((value) => typeof value === 'number')
    const ends = group.members.map((member) => member.endedAt).filter((value) => typeof value === 'number')
    const durationMs = starts.length === 0 || ends.length === 0 ? null : Math.max(...ends) - Math.min(...starts)
    return { phase: group.phase, label: group.label, count: group.members.length, durationMs: durationMs !== null && durationMs > 0 ? durationMs : null }
  })
}

/** Totals across every run of the session. */
function summarize(runs) {
  let members = 0
  let failed = 0
  let running = 0
  let tokens = 0
  for (const run of runs) {
    members += run.members.length
    failed += run.members.filter((member) => member.status === 'failed').length
    running += run.members.filter((member) => member.status === 'running').length
    for (const member of run.members) tokens += member.tokens ?? 0
  }
  return { runs: runs.length, members, failed, running, tokens }
}

/**
 * Build the tab's rows.
 * @param {object} input
 * @param {object|undefined} input.view the `workflowRuns` projection view.
 * @param {object[]|undefined} input.catalog the `subagentCatalog` view.
 * @param {object|undefined} input.sessions the client session store snapshot.
 * @param {'all'|'running'|'failed'} [input.filter] run filter.
 * @param {number} [input.now] render timestamp, for live bars and ages.
 * @param {string} input.noPhaseLabel label used for members without a phase.
 */
function buildTab({ view, catalog, sessions, filter = 'all', now = Date.now(), noPhaseLabel = 'no phase' }) {
  const index = catalogIndex(catalog)
  const byId = sessions?.byId ?? {}
  return (view?.runs ?? [])
    .map((run) => {
      const members = (run.agents ?? []).map((agent) => {
        const entry = agent.childId === null ? undefined : index.get(agent.childId)
        const summary = agent.childId === null ? undefined : byId[agent.childId]
        const status = memberStatus(agent.status, summary)
        const started = agent.startedAt ?? summary?.createdAt ?? null
        const ended = agent.endedAt ?? null
        const durationMs = started === null ? null : (ended ?? (status === 'running' ? now : started)) - started
        const requestedRoute = routeOf(entry)
        const effectiveRoute = effectiveRouteOf(summary)
        return {
          seq: agent.seq,
          mode: MODES.has(entry?.mode) ? entry.mode : 'continuable',
          label: agent.label || entry?.label || (agent.childId ?? '').slice(0, 8) || `#${agent.seq}`,
          phase: agent.phase ?? null,
          childId: agent.childId ?? null,
          status,
          glyph: GLYPH[status] ?? '·',
          route: effectiveRoute ?? requestedRoute,
          requestedRoute,
          routeIsEffective: effectiveRoute !== null,
          tokens: tokensOf(summary),
          durationMs: status === 'running' || status === 'unknown' ? null : durationMs,
          rawDurationMs: durationMs,
          startedAt: started,
          endedAt: ended,
        }
      })
      const span = runSpan({ ...run, agents: run.agents ?? [] }, now)
      const withBars = members.map((member) => ({ ...member, bar: memberBar(member, span, now) }))
      const groups = groupByPhase(withBars, noPhaseLabel)
      const progress = runProgress({ agents: withBars })
      return {
        ...run,
        status: runStatus(run, withBars),
        members: withBars,
        groups,
        phases: aggregatePhases(groups),
        span,
        progress,
        counts: {
          total: members.length,
          running: progress.counts.running ?? 0,
          failed: progress.counts.failed ?? 0,
        },
      }
    })
    .filter((run) => (filter === 'running' ? run.status === 'running' || run.counts.running > 0 : filter === 'failed' ? run.counts.failed > 0 : true))
}

/** One-line fact string for a member row. */
function memberFacts(member, t, { now = Date.now() } = {}) {
  return [
    member.route === null ? t('noRoute') : member.routeIsEffective ? member.route : `${member.route} (${t('requested')})`,
    formatTokens(member.tokens) === null ? null : `${formatTokens(member.tokens)} ${t('tokens')}`,
    formatDuration(member.durationMs),
    member.status === 'running' ? `${t('running')} ${formatRelative(member.startedAt, now) ?? ''}`.trim() : null,
  ].filter((fact) => fact !== null && fact !== undefined).join(' · ')
}
