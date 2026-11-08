/**
 * Route resolution: which model a role uses, why, and what to do when the
 * configured route cannot work.
 *
 * Precedence, highest first:
 *   1. the session  (`/egm model … --session`, recorded in the session log)
 *   2. the workspace (`.dsh/egm.yaml`)
 *   3. the profile (`egm` row config)
 *   4. inherit from the calling agent
 *
 * Nothing here starts an agent or writes config: it answers one question and
 * reports its reasoning so `/egm routes` and the UIs can show the same answer.
 */
import { formatRoute, routeForRole, sameRoute } from './config.js'
import { checkRoute, routeKey } from './catalog.js'

/** Roles that are resolved per phase rather than per persona. */
const PHASE_SCOPED = new Set(['brainstorm', 'draft', 'review', 'resolve', 'bootstrap', 'drift'])

export class Router {
  /**
   * @param {object} deps
   * @param {object} deps.config normalised config.
   * @param {import('./workspace.js').WorkspaceReader} deps.workspace workspace reader.
   * @param {() => object | undefined} deps.llm accessor for the Harness llm service.
   * @param {(agent: object) => object} [deps.sessionOverrides] reader for the durable per-session choices.
   */
  constructor(deps) {
    this.config = deps.config
    this.workspace = deps.workspace
    this.llm = deps.llm
    this.sessionOverrides = deps.sessionOverrides ?? (() => ({ roles: {} }))
  }

  /** Effective max-token policy: the workspace may narrow the profile's choice. */
  maxTokensPolicy(workspaceScope) {
    const policy = workspaceScope?.maxTokens?.policy ?? this.config.maxTokens.policy
    const fixed = workspaceScope?.maxTokens?.fixed ?? this.config.maxTokens.fixed
    return { policy, fixed }
  }

  /**
   * Resolve a role to a route plus its provenance.
   * @param {object} options
   * @param {string} options.role canonical role id, phase name, `elephant`, `worker` or `default`.
   * @param {string} [options.cwd] working directory used to find `.dsh/egm.yaml`.
   * @param {object} [options.agent] the calling agent, for session overrides.
   * @returns {{route: object | null, source: string, problems: string[], inherited: boolean}}
   */
  resolve({ role, cwd, agent }) {
    const problems = []
    const overrides = agent === undefined ? { roles: {} } : this.sessionOverrides(agent) ?? { roles: {} }
    const workspace = cwd === undefined ? { problems: [] } : this.workspace.read(cwd)
    problems.push(...(workspace.problems ?? []))

    const override = overrides.roles?.[role]
    if (override !== undefined) {
      // `null` is a deliberate "inherit" recorded in the session.
      return override === null
        ? { route: null, source: 'session:inherit', problems, inherited: true }
        : { route: override, source: 'session', problems, inherited: false }
    }

    const fromWorkspace = routeForRole(workspace.scope, role)
    if (fromWorkspace !== undefined) return { route: fromWorkspace, source: `workspace:${workspace.path ?? '.dsh/egm.yaml'}`, problems, inherited: false }

    const fromProfile = routeForRole(this.config.routing, role)
    if (fromProfile !== undefined) return { route: fromProfile, source: 'profile', problems, inherited: false }

    // A phase with no route of its own may still have an Elephant route: the
    // phase route is about the model the Elephant uses for that phase.
    if (PHASE_SCOPED.has(role) && this.config.routing.elephant !== null) {
      return { route: this.config.routing.elephant, source: 'profile:elephant', problems, inherited: false }
    }
    if (role === 'default' && this.config.routing.reviewers.default !== undefined) {
      return { route: this.config.routing.reviewers.default, source: 'profile', problems, inherited: false }
    }
    return { route: null, source: 'inherit', problems, inherited: true }
  }

  /**
   * Validate a resolved route before any child is created.
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async validate(route, signal) {
    if (route === null) return { ok: true }
    return checkRoute(this.llm(), route, signal)
  }

  /**
   * Output-token limit for a child created on `route` while the parent uses
   * `parentOptions`. A different model on the parent's `maxTokens` can truncate
   * replies, so `model-default` asks the target model for its own cap.
   * @returns {Promise<number | undefined>} `undefined` leaves the inherited value.
   */
  async maxTokensFor(route, parentOptions, workspaceScope, signal) {
    if (route === null) return undefined
    if (route.maxTokens !== undefined) return route.maxTokens
    const { policy, fixed } = this.maxTokensPolicy(workspaceScope)
    if (policy === 'fixed') return fixed
    if (policy === 'inherit') return undefined
    const sameAsParent = parentOptions?.provider === route.provider && parentOptions?.model === route.model
    if (sameAsParent) return undefined
    const llm = this.llm()
    if (llm === undefined) return undefined
    try {
      const info = await this.llm().resolveModelInfo(route.provider, route.model, signal)
      const cap = info?.defaultMaxTokens
      return Number.isSafeInteger(cap) && cap > 0 ? cap : undefined
    } catch {
      return undefined
    }
  }

  /**
   * The agent options a child should start with, or `undefined` to inherit.
   * @param {object} options
   * @param {object} options.route resolved route.
   * @param {object} [options.parentOptions] effective parent route and limits.
   * @param {object} [options.workspaceScope] workspace layer, for the token policy.
   * @param {AbortSignal} [options.signal]
   */
  async agentOptions({ route, parentOptions, workspaceScope, signal }) {
    if (route === null) return undefined
    const maxTokens = await this.maxTokensFor(route, parentOptions, workspaceScope, signal)
    return {
      provider: route.provider,
      model: route.model,
      ...route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort },
      ...maxTokens === undefined ? {} : { maxTokens },
    }
  }

  /**
   * Apply a route to a live agent (the Elephant, or a child created elsewhere).
   * @returns {Promise<{ok: boolean, reason?: string, applied?: object}>}
   */
  async applyToAgent(agent, route, signal) {
    if (route === null) return { ok: true }
    if (typeof agent?.model?.select !== 'function') return { ok: false, reason: 'this agent exposes no model selection seam' }
    const verdict = await this.validate(route, signal)
    if (!verdict.ok) return { ok: false, reason: verdict.reason }
    agent.model.select({
      provider: route.provider,
      model: route.model,
      ...route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort },
    })
    return { ok: true, applied: route }
  }

  /**
   * Rows for `/egm routes`, the settings screen and the terminal panel.
   * @param {object} options
   * @param {string[]} options.roles roles to describe, in order.
   * @param {string} [options.cwd]
   * @param {object} [options.agent]
   */
  describe({ roles, cwd, agent }) {
    return roles.map((role) => {
      const resolved = this.resolve({ role, cwd, agent })
      return {
        role,
        route: resolved.route,
        text: formatRoute(resolved.route),
        key: resolved.route === null ? null : routeKey(resolved.route),
        source: resolved.source,
        inherited: resolved.inherited,
        problems: resolved.problems,
        scoped: PHASE_SCOPED.has(role),
      }
    })
  }

  /** Whether a route is already the agent's current one. */
  static isCurrent(agent, route) {
    const current = typeof agent?.model?.current === 'function' ? agent.model.current() : undefined
    return sameRoute(current, route)
  }
}

/**
 * Human-readable reason a route was rejected, with the next action.
 * @param {string} role
 * @param {object} route
 * @param {string} reason
 */
export function invalidRouteMessage(role, route, reason) {
  return `the configured route for ${role} (${formatRoute(route)}) cannot be used: ${reason}. `
    + `Fix it with /egm model set ${role} <provider/model#effort>, or set routing.onInvalidRoute: inherit to fall back to the parent model.`
}
