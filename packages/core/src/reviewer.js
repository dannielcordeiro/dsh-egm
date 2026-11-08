/**
 * The model-facing side of EGM: starting a Goldfish reviewer, starting a
 * bootstrap worker, and applying a phase route to the current agent.
 *
 * Every activation goes through one place so that four invariants hold:
 *   - a reviewer is a fresh `spawn` child in the read-only `egm-reviewer` preset,
 *     never a fork and never resumed;
 *   - its route is resolved, validated and applied before the child exists;
 *   - depth is checked against the host's configured cap;
 *   - the plugin knows which children are reviewers, for the single-use refusal
 *     and for the run view.
 */
import { formatRoute } from './config.js'
import { normalizeRole, roleFromPrompt } from './personas.js'
import { invalidRouteMessage } from './router.js'
import { service } from './services.js'
import { applyReviewerGuard } from './isolation.js'

export const REVIEWER_PRESET = 'egm-reviewer'

/** Rendered route value when a role inherits the caller's model. */
export const INHERIT = 'inherit'

/** Exact refusal a parent gets when it tries to continue a finished reviewer. */
export const REUSE_DENIED = 'EGM Goldfish reviewers are single-use: do not message or resume a reviewer. Start a fresh egm_reviewer with the full prompt instead.'

const ROUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    provider: { type: 'string' },
    model: { type: 'string' },
    reasoning_effort: { type: 'string' },
  },
  required: ['provider', 'model'],
}

const REVIEWER_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: {
      type: 'string',
      description: 'Short label for this reviewer activation, such as the reviewer role and the document under review.',
    },
    prompt: {
      type: 'string',
      description: 'The complete reviewer prompt: the envelope, including `Persona: <absolute path>`, plus every input path the fresh child needs. The child reads them itself and sees none of this conversation.',
    },
    role: {
      type: 'string',
      description: 'Reviewer role when the persona is not written in `prompt`, for example `design_critic` or `zoom_out`. Prefer the `Persona:` line; set this only when the prompt cannot carry it.',
    },
    stage: {
      type: 'string',
      enum: ['5', '6', '7', '8', '9'],
      description: 'Review stage this reviewer belongs to. Set it so the run view can group reviewers by stage.',
    },
    route: {
      ...ROUTE_SCHEMA,
      description: 'One-off route override for this reviewer. Omit it to use the configured route for the role.',
    },
  },
  required: ['description', 'prompt'],
}

const WORKER_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: { type: 'string', description: 'Short label for this worker activation.' },
    prompt: {
      type: 'string',
      description: 'The complete worker prompt, including the return contract the caller expects. The child sees none of this conversation.',
    },
    role: {
      type: 'string',
      description: 'Bootstrap role for routing, usually `bootstrap_orchestrator`. Defaults to `worker`.',
    },
    route: { ...ROUTE_SCHEMA, description: 'One-off route override for this worker.' },
  },
  required: ['description', 'prompt'],
}

const BEGIN_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    phase: {
      type: 'string',
      enum: ['brainstorm', 'draft', 'review', 'resolve', 'bootstrap', 'drift'],
      description: 'Phase that is starting.',
    },
  },
  required: ['phase'],
}

const ACTIVATION_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['activation'] },
    subagentId: { type: 'string' },
    role: { type: 'string' },
    route: { type: 'string', description: 'The route the child started on, or "inherit".' },
    source: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['kind', 'subagentId', 'role', 'route', 'source'],
}

const BEGIN_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    phase: { type: 'string' },
    route: { type: 'string', description: 'The route applied, or "inherit".' },
    source: { type: 'string' },
    applied: { type: 'boolean' },
    note: { type: 'string' },
  },
  required: ['phase', 'route', 'source', 'applied'],
}

/** The effective route of the calling agent, as the child would inherit it. */
export function parentRoute(agent) {
  const header = typeof agent?.session?.requestHeader === 'function' ? agent.session.requestHeader() : undefined
  const config = header?.config
  const options = agent?.options ?? {}
  return {
    provider: config?.provider ?? options.provider,
    model: config?.model ?? options.model,
    reasoningEffort: config?.reasoningEffort ?? options.reasoningEffort,
    maxTokens: options.maxTokens,
  }
}

/**
 * Read the optional one-off route from a tool call.
 *
 * The schema declares `route: {provider, model, reasoning_effort}`, so that object
 * is the canonical shape; a caller that flattens the fields onto the arguments is
 * accepted too. A half-supplied route is an error rather than a silent fallback.
 * @param {object} args tool arguments.
 * @returns {{route?: object, problems: string[]}}
 */
export function routeArg(args) {
  const source = args?.route !== null && typeof args?.route === 'object' ? args.route : args ?? {}
  const provider = typeof source.provider === 'string' ? source.provider.trim() : ''
  const model = typeof source.model === 'string' ? source.model.trim() : ''
  if (provider === '' && model === '') return { problems: [] }
  if (provider === '' || model === '') return { problems: ['a route needs both provider and model'] }
  const effortValue = source.reasoning_effort ?? source.reasoningEffort ?? source.effort
  const effort = typeof effortValue === 'string' && effortValue.trim() !== '' ? effortValue.trim() : undefined
  return { route: { provider, model, ...effort === undefined ? {} : { reasoningEffort: effort } }, problems: [] }
}

/**
 * Register the three tools and the reviewer lifecycle hooks.
 * @param {import('@deepseek-ai/cordis').Context} ctx owning plugin context.
 * @param {object} deps plugin dependencies.
 */
export function registerEgmTools(ctx, deps) {
  const { config, router, live, workspace, tools } = deps
  const features = config.features
  const reviewers = new Set()

  const presetService = () => service(ctx, 'agentPresets')
  const subagents = () => service(ctx, 'subagents')

  /** Fail closed with the reason a reviewer cannot start here. */
  async function reviewerSupport() {
    if (presetService() === undefined) return 'the agent-presets service is not composed, so the read-only egm-reviewer preset cannot be selected'
    if (subagents() === undefined || !subagents().list().includes('spawn')) return 'no in-process "spawn" subagent provider is composed'
    const presets = await presetService().list()
    const preset = presets.find((entry) => entry.id === REVIEWER_PRESET)
    if (preset === undefined) return `the "${REVIEWER_PRESET}" agent preset is not installed; reinstall @local/dsh-egm`
    if (preset.broken !== undefined) return `the reviewer preset is broken: ${String(preset.broken)}`
    return undefined
  }

  /**
   * Resolve and validate the route for a role, honouring the failure policy.
   * @returns {Promise<{route: object | null, source: string, note?: string, error?: string}>}
   */
  async function decideRoute({ role, agent, cwd, override, signal }) {
    if (override !== undefined) return { route: override, source: 'call' }
    const resolved = router.resolve({ role, agent, cwd })
    if (resolved.problems.length > 0 && config.routing.onInvalidRoute === 'fail') {
      return { route: null, source: resolved.source, error: `${role}: ${resolved.problems.join('; ')}` }
    }
    const missing = resolved.route === null && !resolved.inherited && config.routing.onMissingRole === 'fail'
    if (missing) return { route: null, source: resolved.source, error: `no route configured for ${role} and routing.onMissingRole is fail` }
    if (resolved.route === null) return { route: null, source: resolved.source }
    const verdict = await router.validate(resolved.route, signal)
    if (verdict.ok) return { route: resolved.route, source: resolved.source }
    if (config.routing.onInvalidRoute === 'inherit') {
      return { route: null, source: 'inherit', note: invalidRouteMessage(role, resolved.route, verdict.reason ?? 'unusable') }
    }
    return { route: null, source: resolved.source, error: invalidRouteMessage(role, resolved.route, verdict.reason ?? 'unusable') }
  }

  /** Start one child and remember it. */
  async function start({ kind, label, prompt, role, stage, route, agent, signal }) {
    const provider = subagents()
    const maxDepth = typeof provider.resolveMaxDepth === 'function' ? provider.resolveMaxDepth() : undefined
    const parentOptions = parentRoute(agent)
    const workspaceScope = workspace.read(cwdOf(agent)).scope
    const agentOptions = await router.agentOptions({ route, parentOptions, workspaceScope, signal })
    const request = {
      prompt: [{ type: 'text', text: prompt }],
      parent: agent,
      ...kind === 'reviewer' ? { agentPreset: REVIEWER_PRESET } : {},
      ...agentOptions === undefined ? {} : { agentOptions },
      ...maxDepth === undefined ? {} : { maxDepth },
    }
    const activation = await provider.startActivation({
      provider: 'spawn',
      label,
      request,
      signal,
      delivery: 'parent',
    })
    live.track(activation.childId, { kind, role, stage, label, route: agentOptions ?? route })
    if (kind === 'reviewer') reviewers.add(activation.childId)
    if (typeof activation.result?.then === 'function') {
      activation.result.then(
        (result) => live.settle(activation.childId, result?.stopReason),
        (error) => live.fail(activation.childId, error instanceof Error ? error.message : String(error)),
      )
    }
    return activation
  }

  if (features.reviewerTool) {
    tools.register({
      name: 'egm_reviewer',
      description:
        'Start a fresh-context, read-only Goldfish reviewer for an Elephant-Goldfish Model design review. '
        + 'The child runs in the read-only `egm-reviewer` preset: it can read and search files but cannot write, edit, run commands, ask the user, read this conversation, or delegate. '
        + 'It is single-use: you cannot message or resume it. '
        + 'Name the persona file and every input path in `prompt`; the child reads them itself and sees none of this conversation.',
      parameters: REVIEWER_PARAMETERS,
      output: {
        schema: ACTIVATION_OUTPUT,
        render(_args, value) {
          return [{ type: 'text', text: `started read-only EGM reviewer ${value.subagentId} (${value.role} on ${value.route === INHERIT ? 'the inherited model' : value.route})${value.note === undefined ? '' : `\n${value.note}`}` }]
        },
      },
      async execute(args, exec) {
        const support = await reviewerSupport()
        if (support !== undefined) throw new Error(`egm_reviewer unavailable: ${support}`)
        const agent = exec.agent
        if (agent === undefined) throw new Error('egm_reviewer requires a calling agent')
        const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : ''
        if (prompt === '') throw new Error('egm_reviewer requires a non-empty prompt')
        const declared = args.role === undefined ? undefined : normalizeRole(args.role)
        if (args.role !== undefined && declared === undefined) throw new Error(`egm_reviewer: unknown role "${args.role}"`)
        const role = declared ?? roleFromPrompt(prompt) ?? 'default'
        const explicit = routeArg(args)
        if (explicit.problems.length > 0) throw new Error(`egm_reviewer: ${explicit.problems.join('; ')}`)
        const decision = await decideRoute({ role, agent, cwd: cwdOf(agent), override: explicit.route, signal: exec.signal })
        if (decision.error !== undefined) throw new Error(`egm_reviewer unavailable: ${decision.error}`)
        const label = typeof args.description === 'string' && args.description.trim() !== '' ? args.description.trim() : `EGM Goldfish reviewer (${role})`
        const activation = await start({
          kind: 'reviewer',
          label,
          prompt,
          role,
          stage: typeof args.stage === 'string' ? args.stage : undefined,
          route: decision.route,
          agent,
          signal: exec.signal,
        })
        return {
          kind: 'activation',
          subagentId: activation.childId,
          role,
          route: decision.route === null ? INHERIT : formatRoute(decision.route),
          source: decision.source,
          ...decision.note === undefined ? {} : { note: decision.note },
        }
      },
    })
  }

  if (features.workerTool) {
    tools.register({
      name: 'egm_worker',
      description:
        'Start a bootstrap partition worker for the Elephant-Goldfish Model. '
        + 'Unlike a reviewer, the worker inherits the calling composition and can write the contract files its prompt asks for. '
        + 'Put the return contract in `prompt`; the child sees none of this conversation.',
      parameters: WORKER_PARAMETERS,
      output: {
        schema: ACTIVATION_OUTPUT,
        render(_args, value) {
          return [{ type: 'text', text: `started EGM bootstrap worker ${value.subagentId} (${value.route === INHERIT ? 'the inherited model' : value.route})${value.note === undefined ? '' : `\n${value.note}`}` }]
        },
      },
      async execute(args, exec) {
        const agent = exec.agent
        if (agent === undefined) throw new Error('egm_worker requires a calling agent')
        const provider = subagents()
        if (provider === undefined || !provider.list().includes('spawn')) throw new Error('egm_worker unavailable: no in-process "spawn" subagent provider is composed')
        const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : ''
        if (prompt === '') throw new Error('egm_worker requires a non-empty prompt')
        const role = args.role === undefined ? 'worker' : normalizeRole(args.role) ?? 'worker'
        const explicit = routeArg(args)
        if (explicit.problems.length > 0) throw new Error(`egm_reviewer: ${explicit.problems.join('; ')}`)
        const decision = await decideRoute({ role, agent, cwd: cwdOf(agent), override: explicit.route, signal: exec.signal })
        if (decision.error !== undefined) throw new Error(`egm_worker unavailable: ${decision.error}`)
        const label = typeof args.description === 'string' && args.description.trim() !== '' ? args.description.trim() : 'EGM bootstrap worker'
        const activation = await start({ kind: 'worker', label, prompt, role, route: decision.route, agent, signal: exec.signal })
        return {
          kind: 'activation',
          subagentId: activation.childId,
          role,
          route: decision.route === null ? INHERIT : formatRoute(decision.route),
          source: decision.source,
          ...decision.note === undefined ? {} : { note: decision.note },
        }
      },
    })
  }

  tools.register({
    name: 'egm_begin',
    description:
      'Apply the model this deployment configured for an EGM phase to the current agent, and report it. '
      + 'Call it once at the start of a phase unless the user started that phase with `/egm-<phase>`, which already applied it. '
      + 'With no configured route the agent keeps its model and the result says so.',
    parameters: BEGIN_PARAMETERS,
    output: {
      schema: BEGIN_OUTPUT,
      render(_args, value) {
        return [{ type: 'text', text: value.route === INHERIT ? `EGM ${value.phase}: using the current model (${value.source})` : `EGM ${value.phase}: ${value.route} (${value.source})${value.note === undefined ? '' : `\n${value.note}`}` }]
      },
    },
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('egm_begin requires a calling agent')
      const phase = String(args.phase ?? '').toLowerCase()
      return applyPhaseRoute(deps, { phase, agent, signal: exec.signal })
    },
  })

  // Single-use reviewers: refuse a follow-up message to any child we started.
  ctx.effect(() => tools.guard((exec) => (exec.name === 'send_message' && reviewers.has(exec.arguments?.agent_id) ? REUSE_DENIED : undefined)))

  // Reviewer lifecycle backstop: the preset's own guard row does the isolation,
  // and this hook adds the default reviewer route for a child started by a path
  // that did not come through `egm_reviewer`. It never throws: a child the hook
  // cannot reach keeps the inherited model and is still guarded by the preset.
  ctx.effect(() => ctx.on('agent/created', async ({ agent }) => {
    const presets = presetService()
    if (presets === undefined) return
    let composed
    try {
      composed = presets.composedPreset(agent.ctx)
    } catch {
      return
    }
    if (composed !== REVIEWER_PRESET) return
    // Layer two of the isolation: the preset row installs the same guard, and
    // this hook covers a child mounted from a preset revision that predates it.
    // The preset row is the guarantee; this is belt and braces for a preset
    // revision mounted before it, so a failure here is a warning, never a
    // reason to abort a reviewer that the preset already isolated.
    try {
      const scoped = service(agent.ctx, 'tools')
      if (scoped !== undefined) {
        for (const dispose of applyReviewerGuard(scoped)) agent.ctx.effect?.(() => dispose)
      } else {
        agent.ctx.inject(['tools'], (childCtx) => {
          try {
            for (const dispose of applyReviewerGuard(childCtx)) childCtx.effect(() => dispose)
          } catch (error) {
            ctx.logger?.warn?.(`dsh-egm: extra reviewer guard not installed: ${error instanceof Error ? error.message : String(error)}`)
          }
        })
      }
    } catch (error) {
      ctx.logger?.warn?.(`dsh-egm: extra reviewer guard not installed: ${error instanceof Error ? error.message : String(error)}`)
    }
    const childId = agent.session?.id ?? agent.id
    if (childId !== undefined && live.has(String(childId))) return
    try {
      const resolved = router.resolve({ role: 'default', agent })
      if (resolved.route === null) return
      const applied = await router.applyToAgent(agent, resolved.route)
      if (!applied.ok) ctx.logger?.warn?.(`dsh-egm: reviewer ${String(childId)} kept the inherited model: ${applied.reason}`)
    } catch (error) {
      ctx.logger?.warn?.(`dsh-egm: could not apply the default reviewer route: ${error instanceof Error ? error.message : String(error)}`)
    }
  }))

  return { reviewers }
}

/**
 * Apply a phase route to the agent that is about to run that phase.
 * Shared by `egm_begin` and the `/egm-<phase>` commands so both behave alike.
 * @param {object} deps plugin dependencies.
 * @param {{phase: string, agent: object, signal?: AbortSignal, scope?: object}} options
 */
export async function applyPhaseRoute(deps, { phase, agent, signal, override }) {
  const { config, router } = deps
  const resolved = override === undefined ? router.resolve({ role: phase, agent, cwd: cwdOf(agent) }) : { route: override, source: 'call', problems: [] }
  if (resolved.route === null) {
    const exhausted = config.routing.onMissingRole === 'fail' && override === undefined
    return { phase, route: INHERIT, source: resolved.source, applied: false, ...exhausted ? { note: `no route configured for ${phase}` } : {} }
  }
  const verdict = await router.validate(resolved.route, signal)
  if (!verdict.ok) {
    if (config.routing.onInvalidRoute === 'inherit') {
      return { phase, route: INHERIT, source: 'inherit', applied: false, note: invalidRouteMessage(phase, resolved.route, verdict.reason ?? 'unusable') }
    }
    throw new Error(`egm_begin unavailable: ${invalidRouteMessage(phase, resolved.route, verdict.reason ?? 'unusable')}`)
  }
  const applied = await router.applyToAgent(agent, resolved.route, signal)
  if (!applied.ok) {
    return { phase, route: INHERIT, source: resolved.source, applied: false, note: applied.reason }
  }
  return { phase, route: formatRoute(resolved.route), source: resolved.source, applied: true }
}

/**
 * The calling agent's working directory, used to find `.dsh/egm.yaml`.
 * @param {object} agent
 */
export function cwdOf(agent) {
  const direct = typeof agent?.workingDirectory?.get === 'function' ? agent.workingDirectory.get() : undefined
  if (typeof direct === 'string' && direct !== '') return direct
  if (typeof agent?.options?.cwd === 'string' && agent.options.cwd !== '') return agent.options.cwd
  const fromSession = agent?.session?.header?.cwd
  if (typeof fromSession === 'string' && fromSession !== '') return fromSession
  return process.cwd()
}
