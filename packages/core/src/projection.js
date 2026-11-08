/**
 * The durable run state and the live view built on top of it.
 *
 * The session log is the source of truth: `/egm …` commands, the reviewer and
 * worker tool calls, the subagent catalogue the Harness appends when a child is
 * created, and the settlement notices that come back. This module folds those
 * events into plain JSON (pure, synchronous, same reference when nothing
 * changed) and folds in process-local facts — the route a child actually
 * started on, its status and its token usage — only when building the view.
 *
 * The Host's projection registry caches the state, ships the view to the
 * browser and replays it after a restart, so nothing here may hold a class
 * instance or a closure.
 */
import { parseEgmCommand } from './commands-parse.js'
import { routeKey } from './catalog.js'
import { normalizeRole, roleFromPrompt } from './personas.js'

/** Projection key: the Client reads `useProjection(PROJECTION_KEY)`. */
export const PROJECTION_KEY = 'egmRun'

/** Bump when the state shape or the fold semantics change. */
export const STATE_VERSION = 1

/** Review stages, in the order the upstream pipeline runs them. */
export const STAGES = Object.freeze(['5', '6', '7', '8', '9'])

/** Files an EGM run is expected to write; used to bucket artifacts. */
const ARTIFACT_PATTERNS = Object.freeze([
  { kind: 'brief', pattern: /(^|\/)concepts_brief\.md$/u },
  { kind: 'draft', pattern: /(^|\/)design_draft\.md$/u },
  { kind: 'design', pattern: /(^|\/)docs\/designs\/[^/]+\.md$/u },
  { kind: 'review', pattern: /(^|\/)(zoom_out|intermediate_zoom_out|comprehension|critic|implementation_readiness|consolidated_review|goldfish_review)_report\.md$/u },
  { kind: 'sitemap', pattern: /(^|\/)SITEMAP\.md$/u },
])

/** Tools that write a file, and where they put the path. */
const WRITE_TOOLS = Object.freeze({
  write: 'file_path',
  edit: 'file_path',
  apply_patch: 'file_path',
  str_replace_editor: 'path',
  create_file: 'path',
})

const SETTLED_PATTERNS = Object.freeze([
  /^Background subagent (\S+) finished/u,
  /^Subagent (\S+) finished/u,
  /^Sub-agent (\S+) finished/u,
])

/** Initial state for an empty session. */
export function initState() {
  return {
    phase: null,
    phaseAt: null,
    elephant: null,
    designDoc: null,
    reviewPreset: null,
    overrides: {},
    children: {},
    artifacts: [],
    stages: {},
    notes: [],
    budget: {},
  }
}

function textOf(message) {
  const content = message?.content
  if (!Array.isArray(content)) return ''
  return content.filter((block) => block?.type === 'text').map((block) => String(block.text ?? '')).join('\n')
}

function parseArguments(raw) {
  if (raw === undefined || raw === null) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(String(raw))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function artifactOf(path) {
  if (typeof path !== 'string' || path === '') return undefined
  for (const { kind, pattern } of ARTIFACT_PATTERNS) if (pattern.test(path)) return { path, kind }
  return undefined
}

function addNote(state, note) {
  const notes = [String(note), ...(state.notes ?? []).filter((entry) => entry !== String(note))].slice(0, 5)
  return { ...state, notes }
}

/**
 * Fold one committed session event.
 * Returns the same reference for events this unit does not track.
 * @param {object} state current state.
 * @param {{type: string, data?: object}} event one session event.
 */
export function applyEvent(state, event) {
  const data = event?.data ?? {}
  switch (event?.type) {
    case 'command/run': {
      const name = String(data.name ?? '').toLowerCase()
      if (name !== 'egm' && !name.startsWith('egm-')) return state
      return { ...state, pendingCommand: { id: String(data.commandId ?? ''), name, args: String(data.args ?? '') } }
    }
    case 'command/done': {
      const pending = state.pendingCommand
      if (pending === undefined || pending.id !== String(data.commandId ?? '')) return state
      const { pendingCommand: _settled, ...rest } = state
      if (data.kind !== 'success') return rest
      return applyCommandEffect(rest, pending)
    }
    case 'tool/call': {
      const name = String(data.name ?? '')
      if (name === 'egm_reviewer' || name === 'egm_worker') {
        const args = parseArguments(data.arguments)
        // The role is usually named by the `Persona:` line rather than the
        // argument, so the log alone is enough to label the child.
        const declared = typeof args.role === 'string' ? normalizeRole(args.role) : undefined
        const role = declared ?? (typeof args.prompt === 'string' ? roleFromPrompt(args.prompt) : undefined)
        return {
          ...state,
          pendingActivation: [
            ...(state.pendingActivation ?? []),
            {
              callId: String(data.callId ?? ''),
              kind: name === 'egm_worker' ? 'worker' : 'reviewer',
              label: typeof args.description === 'string' ? args.description : undefined,
              role,
              stage: args.stage === undefined || args.stage === null ? undefined : String(args.stage),
            },
          ],
        }
      }
      if (name === 'egm_begin') {
        const args = parseArguments(data.arguments)
        return { ...state, pendingBegin: { callId: String(data.callId ?? ''), phase: String(args.phase ?? '').toLowerCase() } }
      }
      if (WRITE_TOOLS[name] !== undefined) {
        const args = parseArguments(data.arguments)
        const path = args[WRITE_TOOLS[name]] ?? args.file_path ?? args.path
        const artifact = artifactOf(path)
        if (artifact === undefined) return state
        return { ...state, pendingArtifact: { callId: String(data.callId ?? ''), ...artifact } }
      }
      if (name === 'bash' || name === 'pwsh') return state
      return state
    }
    case 'tool/result': {
      const callId = String(data.message?.toolCallId ?? data.message?.source?.callId ?? '')
      const failed = data.message?.isError === true
      const pendingActivation = state.pendingActivation ?? []
      if (pendingActivation.some((entry) => entry.callId === callId)) {
        // The child id arrives with the `subagent/catalog` event, not here.
        return failed ? { ...state, pendingActivation: pendingActivation.filter((entry) => entry.callId !== callId) } : state
      }
      if (state.pendingArtifact?.callId === callId) {
        const { pendingArtifact, ...rest } = state
        if (failed) return rest
        const artifacts = [...rest.artifacts.filter((entry) => entry.path !== pendingArtifact.path), { path: pendingArtifact.path, kind: pendingArtifact.kind, at: Number(event.time ?? 0) }]
        return { ...rest, artifacts }
      }
      if (state.pendingBegin?.callId === callId) {
        const { pendingBegin, ...rest } = state
        return failed ? rest : { ...rest, phase: pendingBegin.phase, phaseAt: Number(event.time ?? 0) }
      }
      return state
    }
    case 'subagent/catalog': {
      const childId = String(data.childId ?? '')
      if (childId === '') return state
      const pending = state.pendingActivation ?? []
      const label = typeof data.label === 'string' ? data.label : undefined
      const index = pending.findIndex((entry) => entry.label !== undefined && entry.label === label)
      const matched = index === -1 ? undefined : pending[index]
      const remaining = index === -1 ? pending : pending.filter((_entry, position) => position !== index)
      const child = {
        childId,
        kind: matched?.kind ?? 'subagent',
        role: matched?.role ?? null,
        stage: matched?.stage ?? null,
        label: label ?? null,
        startedAt: Number(data.childCreatedAt ?? event.time ?? 0),
        status: 'started',
      }
      return {
        ...state,
        pendingActivation: remaining,
        children: { ...state.children, [childId]: child },
      }
    }
    case 'user/message': {
      const text = textOf(data)
      for (const pattern of SETTLED_PATTERNS) {
        const match = pattern.exec(text)
        if (match === null) continue
        const childId = match[1]
        const child = state.children?.[childId]
        if (child === undefined) return state
        return { ...state, children: { ...state.children, [childId]: { ...child, status: 'settled' } } }
      }
      return state
    }
    case 'model/selection': {
      if (data.provider === undefined || data.model === undefined) return state
      return {
        ...state,
        elephant: {
          provider: String(data.provider),
          model: String(data.model),
          ...data.reasoningEffort === undefined || data.reasoningEffort === null ? {} : { reasoningEffort: String(data.reasoningEffort) },
        },
      }
    }
    case 'request/header': {
      const config = data.header?.config
      if (config?.provider === undefined || config?.model === undefined) return state
      const next = {
        provider: String(config.provider),
        model: String(config.model),
        ...config.reasoningEffort === undefined || config.reasoningEffort === null ? {} : { reasoningEffort: String(config.reasoningEffort) },
      }
      const current = state.elephant
      if (current !== null && current !== undefined && current.provider === next.provider && current.model === next.model && current.reasoningEffort === next.reasoningEffort) return state
      return { ...state, elephant: next }
    }
    case 'assistant/message': {
      // The Harness logs usage beside the message, not inside it.
      const usage = data.usage ?? data.message?.usage
      if (usage === undefined || usage === null) return state
      const budget = state.budget ?? {}
      return {
        ...state,
        budget: {
          input: (budget.input ?? 0) + (usage.inputTokens ?? 0),
          output: (budget.output ?? 0) + (usage.outputTokens ?? 0),
          cacheRead: (budget.cacheRead ?? 0) + (usage.cacheReadTokens ?? 0),
          cacheWrite: (budget.cacheWrite ?? 0) + (usage.cacheWriteTokens ?? 0),
        },
      }
    }
    default:
      return state
  }
}

/** Apply the durable effect of a successful `/egm` command. */
function applyCommandEffect(state, pending) {
  const parsed = parseEgmCommand(pending.name, pending.args)
  if (parsed.kind === 'phase-start') {
    return {
      ...state,
      phase: parsed.phase,
      phaseAt: Date.now(),
      designDoc: parsed.target ?? state.designDoc,
    }
  }
  if (parsed.kind === 'phase') return { ...state, phase: parsed.phase, phaseAt: Date.now() }
  if (parsed.kind === 'model-set') {
    // Only a session-scoped edit is a session fact. A profile edit is already
    // persisted in the profile layer, and recording it here too would make it
    // outlive its own removal from the profile.
    if (parsed.scope !== 'session') return state
    const overrides = { ...state.overrides }
    overrides[parsed.role] = parsed.route === null ? null : parsed.route
    return { ...state, overrides }
  }
  if (parsed.kind === 'model-reset') {
    if (parsed.scope !== 'session') return state
    const overrides = { ...state.overrides }
    delete overrides[parsed.role]
    return { ...state, overrides }
  }
  if (parsed.kind === 'review-preset') return { ...state, reviewPreset: parsed.preset }
  if (parsed.kind === 'stage') {
    return { ...state, stages: { ...state.stages, [parsed.stage]: parsed.status } }
  }
  return state
}

/**
 * The wire view: durable state plus process-local facts.
 * @param {object} state folded state.
 * @param {{children?: Record<string, object>, version?: number}} liveSnapshot live facts by child id.
 * @param {Record<string, object>} pricing price per million tokens by `provider/model`.
 */
export function createView(state, liveSnapshot = {}, pricing = {}) {
  const live = liveSnapshot.children ?? {}
  const children = Object.values(state.children ?? {}).map((child) => {
    const facts = live[child.childId] ?? {}
    const route = facts.route ?? null
    const usage = facts.tokens ?? {}
    return {
      childId: child.childId,
      kind: child.kind,
      role: child.role,
      stage: child.stage,
      label: child.label,
      startedAt: child.startedAt,
      status: facts.status ?? child.status,
      stopReason: facts.stopReason ?? null,
      route,
      routeKey: route === null ? null : routeKey(route),
      tokens: {
        input: usage.input ?? 0,
        output: usage.output ?? 0,
        cacheRead: usage.cacheRead ?? 0,
        cacheWrite: usage.cacheWrite ?? 0,
      },
    }
  })
  const childrenById = Object.fromEntries(children.map((child) => [child.childId, child]))

  let cost = 0
  let priced = 0
  let unpriced = 0
  for (const child of children) {
    const price = child.routeKey === null ? undefined : pricing[child.routeKey]
    if (price === undefined) {
      if (child.tokens.input + child.tokens.output > 0) unpriced += 1
      continue
    }
    priced += 1
    cost += ((child.tokens.input + child.tokens.cacheRead + child.tokens.cacheWrite) * (price.input ?? 0)
      + child.tokens.output * (price.output ?? 0)
      + child.tokens.cacheRead * (price.cacheRead ?? 0)
      + child.tokens.cacheWrite * (price.cacheWrite ?? 0)) / 1_000_000
  }

  const stages = STAGES.map((stage) => {
    const reviewers = children.filter((child) => child.kind === 'reviewer' && child.stage === stage)
    const explicit = state.stages?.[stage]
    const status = explicit ?? (reviewers.some((child) => child.status === 'running' || child.status === 'started')
      ? 'running'
      : reviewers.length > 0 ? 'done' : 'idle')
    return { stage, status, reviewers: reviewers.length }
  })

  return {
    version: STATE_VERSION,
    phase: state.phase,
    phaseAt: state.phaseAt,
    designDoc: state.designDoc,
    reviewPreset: state.reviewPreset,
    elephant: state.elephant,
    elephantKey: state.elephant === null || state.elephant === undefined ? null : routeKey(state.elephant),
    overrides: state.overrides,
    stages,
    children,
    childrenById,
    artifacts: state.artifacts ?? [],
    notes: state.notes ?? [],
    budget: state.budget ?? {},
    cost: priced > 0 ? Number(cost.toFixed(4)) : null,
    unpricedChildren: unpriced,
    sessions: Object.keys(childrenById).length,
  }
}

/**
 * Plain-object schema for the projection registry, which only calls `parse`.
 * Keeping it hand-written avoids a dependency and makes the snapshot format
 * explicitly forward-compatible.
 */
export const stateSchema = Object.freeze({
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('egmRun: invalid persisted state')
    }
    if (value.children === null || typeof value.children !== 'object') {
      throw new TypeError('egmRun: persisted state has no children map')
    }
    return value
  },
})

/** Schema for the view that leaves the Host. */
export const viewSchema = Object.freeze({
  parse(value) {
    if (value === null || typeof value !== 'object' || !Array.isArray(value.stages) || !Array.isArray(value.children)) {
      throw new TypeError('egmRun: invalid view')
    }
    return value
  },
})
