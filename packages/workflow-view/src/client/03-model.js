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
