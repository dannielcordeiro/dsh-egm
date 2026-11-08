/**
 * Pure run aggregation: three independent sources become one tree.
 *
 *   egmRun            our durable fold: role, stage, kind, artifact, route
 *   subagentCatalog   the host's own child catalog: label and the route the
 *                     child was created with
 *   sessions          the client store: live `running`, timing and token usage
 *
 * None of the three is sufficient alone: a child started by the generic
 * `subagent` tool has no role in our fold, a running child has no status in the
 * log, and a cold session has no catalog. Merging them by id is what stops the
 * window from claiming "not started" while a reviewer is working.
 */

/** How many levels of grandchildren the tree shows. */
const MAX_DEPTH = 3

/** Glyph and label per status. */
const STATUS = {
  running: { glyph: '◐', tone: 'accent' },
  settled: { glyph: '✓', tone: 'dim' },
  failed: { glyph: '✗', tone: 'error' },
  unknown: { glyph: '·', tone: 'dim' },
}

/**
 * Derive the status of one child.
 * The live `running` flag wins; then the child's own timing projection; then the
 * durable status our fold recorded; otherwise `unknown`, which is honest about
 * not knowing rather than pretending the child never started.
 * @param {{running?: boolean, timing?: object, durable?: string}} input
 * @returns {'running'|'settled'|'failed'|'unknown'}
 */
function statusOf({ running, timing, durable }) {
  if (running === true || timing?.active !== undefined) return 'running'
  if (durable === 'failed') return 'failed'
  if (timing?.lastTurnCompleted === true) return 'settled'
  if (durable === 'settled') return 'settled'
  if (durable === 'started') return 'settled'
  return 'unknown'
}

/** Compact token count: `980`, `12.4k`, `1.3M`. */
function formatTokens(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  if (value < 1000) return String(Math.round(value))
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(1)}M`
}

/** Compact duration: `8s`, `1m02s`, `1h04m`. */
function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

/** Sum the four buckets of a token-usage projection. */
function tokensOf(projection) {
  const totals = projection?.totals ?? projection
  if (totals === undefined || totals === null) return null
  const sum = (totals.uncachedInputTokens ?? 0) + (totals.outputTokens ?? 0)
  return sum > 0 ? sum : null
}

/** Elapsed milliseconds from a timing projection. */
function durationOf(timing) {
  if (timing === undefined || timing === null) return null
  const settled = typeof timing.settledMs === 'number' ? timing.settledMs : 0
  const active = timing.active
  if (active !== undefined && active.through !== undefined) return settled + Math.max(0, active.through - active.since)
  return settled > 0 ? settled : null
}

/**
 * Route text for one child: the catalog's creation route when it has one, else
 * the route our fold recorded, else `inherit`.
 */
function routeTextOf(catalogEntry, durableRouteKey) {
  if (catalogEntry?.agentProvider !== undefined && catalogEntry?.agentModel !== undefined) {
    const effort = catalogEntry.agentReasoningEffort
    return `${catalogEntry.agentProvider}/${catalogEntry.agentModel}${effort === undefined || effort === null ? '' : `#${effort}`}`
  }
  if (typeof durableRouteKey === 'string' && durableRouteKey !== '') return durableRouteKey
  return 'inherit'
}

/**
 * Build the `/egm model set` line for one role row.
 *
 * The row is an object, so interpolating it directly produced
 * `/egm model set [object Object] …` and the host answered "unknown role".
 * @param {string|{role: string}} role role name or row.
 * @param {string} value route text as typed.
 * @param {'profile'|'session'} [scope] where to write.
 */
function routeCommand(role, value, scope) {
  const name = typeof role === 'string' ? role : role?.role
  if (typeof name !== 'string' || name === '') throw new Error('a role name is required')
  const route = String(value ?? '').trim()
  if (route === '') throw new Error('a route is required')
  return `/egm model set ${name} ${route}${scope === 'session' ? ' --session' : ''}`
}

/**
 * Build the `/egm model test` line for one row.
 *
 * When the field holds a route (it contains a slash) the test targets that exact
 * route, so a value can be checked before it is written; otherwise it tests
 * whatever the role resolves to now.
 * @param {string|{role: string}} role role name or row.
 * @param {string} [value] route text currently shown in the row.
 */
function testCommand(role, value) {
  const name = typeof role === 'string' ? role : role?.role
  if (typeof name !== 'string' || name === '') throw new Error('a role name is required')
  const route = String(value ?? '').trim()
  return route.includes('/') ? `/egm model test ${route}` : `/egm model test ${name}`
}

/**
 * Decide what an Apply click does for one row.
 *
 * The field shows the effective route until the user types over it, so an
 * untouched row still applies what the screen shows. A row with nothing to apply
 * returns a reason instead of doing nothing silently.
 * @param {{role: string, text: string}} entry the route row.
 * @param {string|undefined} draft what the user typed, if anything.
 * @param {'profile'|'session'} [scope] where to write.
 * @returns {{command: string}|{error: string}}
 */
function applyPlan(entry, draft, scope) {
  const typed = String(draft ?? '').trim()
  const value = typed !== '' ? typed : (entry?.text === 'inherit' ? '' : String(entry?.text ?? '').trim())
  if (value === '') return { error: 'a route is required: type provider/model#effort' }
  try {
    return { command: routeCommand(entry, value, scope) }
  } catch (failure) {
    return { error: failure instanceof Error ? failure.message : String(failure) }
  }
}

/** Display name for the merge, used by the tests and the window. */
const buildRuns = mergeChildren

/** Entries of one catalog, tolerating a missing or malformed snapshot. */
function catalogOf(catalogs, sessionId) {
  const entries = catalogs?.[sessionId]
  return Array.isArray(entries) ? entries : []
}

/**
 * Merge the three sources into one tree of rows.
 * @param {object} input
 * @param {object|undefined} input.egmRun our durable view.
 * @param {Record<string, object[]>} [input.catalogs] catalog entries by parent session id.
 * @param {object|undefined} input.sessions the client session store snapshot (`byId`).
 * @param {string} [input.rootSessionId] the session the window belongs to.
 * @param {number} [input.maxDepth] levels of descendants to show.
 * @returns {Array<object>} rows in display order.
 */
function mergeChildren({ egmRun, catalogs = {}, sessions, rootSessionId, maxDepth = MAX_DEPTH }) {
  const byId = sessions?.byId ?? {}
  const durable = new Map()
  for (const child of egmRun?.children ?? []) durable.set(child.childId, child)

  const rows = []
  const seen = new Set()
  const walk = (parentId, depth) => {
    if (depth > maxDepth) return
    const ids = []
    const push = (id) => {
      if (typeof id !== 'string' || id === '' || ids.includes(id)) return
      ids.push(id)
    }
    for (const entry of catalogOf(catalogs, parentId)) push(entry.id)
    for (const [id, child] of durable) {
      if (child.kind === 'subagent' && depth === 0) push(id)
      else if (depth > 0) push(id)
    }
    for (const [id, summary] of Object.entries(byId)) {
      if (summary?.parentSessionId === parentId || summary?.parentSession === parentId) push(id)
    }
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const entry = catalogOf(catalogs, parentId).find((candidate) => candidate.id === id)
      const summary = byId[id]
      const child = durable.get(id)
      const timing = summary?.projectionValues?.subagentTiming
      const tokens = tokensOf(summary?.projectionValues?.tokenUsage)
      const duration = durationOf(timing)
      rows.push({
        id,
        parentId,
        depth,
        label: entry?.label ?? child?.label ?? summary?.projectionValues?.subagent?.label ?? id.slice(0, 8),
        role: child?.role ?? null,
        kind: child?.kind ?? (entry === undefined ? 'session' : 'subagent'),
        stage: child?.stage ?? null,
        route: routeTextOf(entry, child?.routeKey),
        status: statusOf({ running: summary?.running, timing, durable: child?.status }),
        tokens,
        durationMs: duration,
        startedAt: entry?.createdAt ?? child?.startedAt ?? null,
      })
      walk(id, depth + 1)
    }
  }
  walk(rootSessionId, 0)
  return rows
}
