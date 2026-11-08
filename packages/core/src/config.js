/**
 * Configuration: schema, defaults, and the tiny route grammar shared by the
 * profile config, the workspace file, the commands and the two UIs.
 *
 * A route is always the same three-to-four fields as the Harness agent options:
 * `provider`, `model`, `reasoningEffort`, `maxTokens`. `effort` is accepted as an
 * alias for `reasoningEffort` because that is the word the terminal UI uses.
 */
import z from '@deepseek-ai/schemastery'
import { PHASE_ROLES, normalizeRole, reviewerRoles } from './personas.js'

/** The EGM phases a user can route independently. */
export const PHASES = PHASE_ROLES

/** Policies for the child's output-token limit when its route differs from the parent. */
export const MAX_TOKEN_POLICIES = Object.freeze(['model-default', 'inherit', 'fixed'])

/** Policies for an unusable or missing role route. */
export const ROUTE_POLICIES = Object.freeze(['fail', 'inherit'])

const Route = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  reasoningEffort: z.string(),
  /** Alias for `reasoningEffort`. */
  effort: z.string(),
  maxTokens: z.natural(),
})

const RouteOrNull = z.union([Route, z.const(null)])

/**
 * The published Config schema for the `egm` row.
 *
 * Deliberately not `volatile`: schemastery refuses a volatile node whose
 * defaults are functions, and nested defaults are what make an absent
 * `routing.reviewers` entry mean "inherit" instead of "invalid". A config edit
 * therefore restarts this plugin, which re-reads the file on activation — the
 * behaviour a route edit wants anyway.
 */
export const Config = z.object({
  routing: z.object({
    onInvalidRoute: z.union([z.const('fail'), z.const('inherit')]).default('fail'),
    onMissingRole: z.union([z.const('inherit'), z.const('fail')]).default('inherit'),
    elephant: RouteOrNull,
    phases: z.dict(Route),
    reviewers: z.dict(Route),
    workers: RouteOrNull,
  }),
  maxTokens: z.object({
    policy: z.union([z.const('model-default'), z.const('inherit'), z.const('fixed')]).default('model-default'),
    fixed: z.natural(),
  }),
  pricing: z.dict(z.object({
    input: z.natural(),
    output: z.natural(),
    cacheRead: z.natural(),
    cacheWrite: z.natural(),
  })),
  features: z.object({
    reviewerTool: z.boolean().default(true),
    workerTool: z.boolean().default(true),
    commands: z.boolean().default(true),
    tui: z.boolean().default(true),
  }),
}).description('Elephant-Goldfish Model: role routes and feature switches')

/** Unwrap a schemastery `Volatile` reference, which exposes `get()`. */
export function live(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function' && !Array.isArray(value)) {
    return value.get()
  }
  return value
}

/**
 * Normalise one route object to `{provider, model, reasoningEffort?, maxTokens?}`.
 * @returns {{route?: object, problems: string[]}}
 */
export function normalizeRoute(value, where) {
  const problems = []
  const source = live(value)
  if (source === undefined || source === null) return { problems: [] }
  if (typeof source !== 'object') return { problems: [`${where}: a route must be an object with provider and model`] }
  const provider = typeof source.provider === 'string' ? source.provider.trim() : ''
  const model = typeof source.model === 'string' ? source.model.trim() : ''
  if (provider === '') problems.push(`${where}: missing provider`)
  if (model === '') problems.push(`${where}: missing model`)
  const effortValue = live(source.reasoningEffort) ?? live(source.effort)
  const reasoningEffort = typeof effortValue === 'string' ? effortValue.trim() : undefined
  if (reasoningEffort !== undefined && reasoningEffort === '') problems.push(`${where}: reasoningEffort must not be empty`)
  const maxTokensValue = live(source.maxTokens)
  const maxTokens = maxTokensValue === undefined || maxTokensValue === null ? undefined : Number(maxTokensValue)
  if (maxTokens !== undefined && (!Number.isSafeInteger(maxTokens) || maxTokens < 1)) {
    problems.push(`${where}: maxTokens must be a positive integer`)
  }
  if (problems.length > 0) return { problems }
  return {
    route: {
      provider,
      model,
      ...reasoningEffort === undefined ? {} : { reasoningEffort },
      ...maxTokens === undefined ? {} : { maxTokens },
    },
    problems,
  }
}

/** Parse `provider/model` with an optional `#effort` suffix. */
export function parseRoute(text) {
  const raw = typeof text === 'string' ? text.trim() : ''
  if (raw === '') return { problems: ['a route needs a value like provider/model or provider/model#effort'] }
  const hash = raw.lastIndexOf('#')
  const routePart = hash === -1 ? raw : raw.slice(0, hash)
  const effort = hash === -1 ? undefined : raw.slice(hash + 1).trim()
  const slash = routePart.indexOf('/')
  if (slash <= 0 || slash === routePart.length - 1) {
    return { problems: [`"${raw}" is not a route; expected provider/model or provider/model#effort`] }
  }
  return normalizeRoute({
    provider: routePart.slice(0, slash),
    model: routePart.slice(slash + 1),
    ...effort === undefined || effort === '' ? {} : { reasoningEffort: effort },
  }, raw)
}

/** Render a route the way the commands accept it back. */
export function formatRoute(route) {
  if (route === null || route === undefined) return 'inherit'
  const effort = route.reasoningEffort === undefined ? '' : `#${route.reasoningEffort}`
  return `${route.provider}/${route.model}${effort}`
}

/** Whether two routes name the same provider, model and effort. */
export function sameRoute(left, right) {
  if (left === undefined || right === undefined || left === null || right === null) return left === right
  return left.provider === right.provider && left.model === right.model
    && (left.reasoningEffort ?? undefined) === (right.reasoningEffort ?? undefined)
}

function normalizeRouting(value) {
  const source = live(value) ?? {}
  const problems = []
  const onInvalidRoute = ROUTE_POLICIES.includes(source.onInvalidRoute) ? source.onInvalidRoute : 'fail'
  const onMissingRole = ROUTE_POLICIES.includes(source.onMissingRole) ? source.onMissingRole : 'inherit'
  const routes = { phases: {}, reviewers: {}, elephant: null, workers: null }
  const elephant = normalizeRoute(source.elephant, 'routing.elephant')
  problems.push(...elephant.problems)
  routes.elephant = elephant.route ?? null
  const workers = normalizeRoute(source.workers, 'routing.workers')
  problems.push(...workers.problems)
  routes.workers = workers.route ?? null

  const knownRoles = new Set(['default', ...reviewerRoles()])
  for (const [key, raw] of Object.entries(live(source.reviewers) ?? {})) {
    const role = normalizeRole(key)
    if (role === undefined || !knownRoles.has(role)) {
      problems.push(`routing.reviewers.${key}: unknown reviewer role; known roles are ${[...knownRoles].join(', ')}`)
      continue
    }
    const normalized = normalizeRoute(raw, `routing.reviewers.${key}`)
    problems.push(...normalized.problems)
    if (normalized.route !== undefined) routes.reviewers[role] = normalized.route
  }
  for (const [key, raw] of Object.entries(live(source.phases) ?? {})) {
    const phase = key.trim().toLowerCase()
    if (!PHASES.includes(phase)) {
      problems.push(`routing.phases.${key}: unknown phase; known phases are ${PHASES.join(', ')}`)
      continue
    }
    const normalized = normalizeRoute(raw, `routing.phases.${key}`)
    problems.push(...normalized.problems)
    if (normalized.route !== undefined) routes.phases[phase] = normalized.route
  }
  return { routing: { onInvalidRoute, onMissingRole, ...routes }, problems }
}

/**
 * Validate and normalise the row config.
 * @param {object} raw config as composed by the profile patch.
 * @returns {{config: object, problems: string[]}}
 */
export function normalizeConfig(raw) {
  let validated
  try {
    validated = Config(raw ?? {})
  } catch (error) {
    throw new Error(`dsh-egm: invalid config: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  const problems = []
  const routing = normalizeRouting(validated.routing)
  problems.push(...routing.problems)

  const maxSource = live(validated.maxTokens) ?? {}
  const policy = MAX_TOKEN_POLICIES.includes(maxSource.policy) ? maxSource.policy : 'model-default'
  const fixedValue = live(maxSource.fixed)
  const fixed = Number.isSafeInteger(fixedValue) && fixedValue > 0 ? fixedValue : 8192
  if (policy === 'fixed' && fixedValue !== undefined && fixed !== fixedValue) problems.push('maxTokens.fixed must be a positive integer; using 8192')

  const pricing = {}
  for (const [key, value] of Object.entries(live(validated.pricing) ?? {})) {
    const source = live(value) ?? {}
    const entry = {}
    for (const field of ['input', 'output', 'cacheRead', 'cacheWrite']) {
      const number = live(source[field])
      if (Number.isFinite(number) && number >= 0) entry[field] = number
    }
    if (entry.input === undefined && entry.output === undefined) {
      problems.push(`pricing.${key}: needs at least input and output prices per million tokens`)
      continue
    }
    pricing[key] = entry
  }

  const featureSource = live(validated.features) ?? {}
  const features = {}
  for (const key of ['reviewerTool', 'workerTool', 'commands', 'tui']) {
    const value = live(featureSource[key])
    features[key] = value === undefined ? true : Boolean(value)
  }

  return { config: { routing: routing.routing, maxTokens: { policy, fixed }, pricing, features }, problems }
}

/** Every role a user can address, in the order the screens show them. */
export function allRoles() {
  return ['elephant', 'worker', ...PHASES, 'default', ...reviewerRoles()]
}

/**
 * A route a role should use, given one scope layer.
 * @param {object} scope `{routes, ...}` normalised routing for one layer.
 * @param {string} role canonical role id, a phase name, or an actor role.
 */
export function routeForRole(scope, role) {
  if (scope === undefined || scope === null) return undefined
  if (role === 'elephant') return scope.elephant ?? undefined
  if (role === 'worker') return scope.workers ?? undefined
  if (role === 'default') return scope.reviewers?.default
  if (PHASES.includes(role)) return scope.phases?.[role]
  return scope.reviewers?.[role]
}
