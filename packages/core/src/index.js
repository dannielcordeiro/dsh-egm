/**
 * `@local/dsh-egm` — the Elephant-Goldfish Model on DeepSeek Harness.
 *
 * This module only wires the parts together; every rule lives in its own file:
 *
 *   config.js     schema, defaults, route grammar, role table
 *   personas.js   the reviewer catalogue, read from the vendored personas
 *   workspace.js  `.dsh/egm.yaml` discovery, parsing and caching
 *   router.js     precedence, validation, output-token policy, live switching
 *   catalog.js    providers, models, efforts and availability
 *   skills.js     vendored skills plus the injected harness preamble
 *   reviewer.js   `egm_reviewer`, `egm_worker`, `egm_begin`, reviewer lifecycle
 *   isolation.js  the read-only tool guard
 *   projection.js durable run state and its wire view
 *   live.js       route, status and tokens of the children this process started
 *   commands.js   `/egm`, shared by both surfaces
 *   persist.js    writing the profile layer through the configuration editor
 *   doctor.js     the checks behind `/egm doctor`
 *   tui.js        the terminal surfaces, all optional
 *
 * Nothing here throws because an optional service is absent: a headless profile
 * still gets skills, tools and commands.
 */
import { Config, normalizeConfig } from './config.js'
import { WorkspaceReader } from './workspace.js'
import { Router } from './router.js'
import { LiveFacts } from './live.js'
import { PROJECTION_KEY, createView, initState, applyEvent, stateSchema, viewSchema, STATE_VERSION } from './projection.js'
import { loadSkills } from './skills.js'
import { registerEgmTools, cwdOf } from './reviewer.js'
import { registerEgmCommand } from './commands.js'
import { ProfileWriter } from './persist.js'
import { registerTui } from './tui.js'
import { listRoutes } from './catalog.js'
import { service, whenService } from './services.js'

export { Config }

export const name = 'dsh-egm'

/** Skills need a registry; everything else is probed at use time. */
export const inject = []

/**
 * Activate the plugin.
 * @param {import('@deepseek-ai/cordis').Context} ctx owning plugin context.
 * @param {object} raw row config.
 */
export function apply(ctx, raw) {
  const { config, problems } = normalizeConfig(raw)
  for (const problem of problems) ctx.logger?.warn?.(`dsh-egm: ${problem}`)

  const workspace = new WorkspaceReader()
  const live = new LiveFacts()
  let tui

  /** Durable run state for one agent, or `undefined` when no registry is composed. */
  const projectionState = (agent) => {
    if (agent?.session === undefined) return undefined
    try {
      return service(ctx, 'sessionProjections')?.stateOf(agent.session, PROJECTION_KEY)
    } catch {
      return undefined
    }
  }

  const overridesOf = (agent) => ({ roles: projectionState(agent)?.overrides ?? {} })

  const router = new Router({
    config,
    workspace,
    llm: () => service(ctx, 'llm'),
    sessionOverrides: overridesOf,
  })

  const deps = {
    ctx,
    config,
    configProblems: problems,
    workspace,
    router,
    live,
    projectionState,
    cwdOf,
    catalogue: () => listRoutes(service(ctx, 'llm')),
    get tui() {
      return tui
    },
    refresh: (agent) => tui?.refresh?.(agent),
  }

  // ---- skills ---------------------------------------------------------------
  if (service(ctx, 'skills') === undefined) {
    ctx.logger?.info?.('dsh-egm: waiting for the skill registry to register the EGM skills')
  }
  whenService(ctx, 'skills', (skills) => {
    let count = 0
    for (const skill of loadSkills()) {
      ctx.effect(() => skills.register(skill))
      count += 1
    }
    ctx.logger?.info?.(`dsh-egm: registered ${count} EGM skill(s) from the vendored upstream snapshot`)
  })

  // ---- tools ----------------------------------------------------------------
  if (service(ctx, 'tools') === undefined) {
    ctx.logger?.info?.('dsh-egm: waiting for the tool registry to add egm_reviewer, egm_worker and egm_begin')
  }
  whenService(ctx, 'tools', (tools) => {
    registerEgmTools(ctx, { ...deps, tools })
  })

  // ---- durable run state ----------------------------------------------------
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    service(projectionCtx, 'sessionProjections')?.register({
      key: PROJECTION_KEY,
      stateSchema,
      init: () => initState(),
      apply: (state, event) => applyEvent(state, event),
      stateVersion: STATE_VERSION,
      wire: {
        viewSchema,
        view: (state) => createView(state, live.snapshot(), config.pricing),
      },
    })
  })

  // ---- commands -------------------------------------------------------------
  const writer = new ProfileWriter(ctx)
  deps.writer = writer.available() ? writer : undefined
  whenService(ctx, 'commands', (commands) => {
    deps.commands = commands
    registerEgmCommand(ctx, deps)
  })

  // ---- terminal surfaces ----------------------------------------------------
  tui = registerTui(ctx, deps)

  // ---- live observation -----------------------------------------------------
  const refreshSoon = (() => {
    let last = 0
    return (agent) => {
      const now = Date.now()
      if (now - last < 250) return
      last = now
      tui?.refresh?.(agent)
    }
  })()

  ctx.effect(() => ctx.on('session/event', (session, event) => {
    const sessionId = session?.id ?? session?.header?.id
    if (sessionId === undefined) return
    live.observeChildSession(String(sessionId), event)
    if (event?.type === 'tool/result' || event?.type === 'command/done') refreshSoon(undefined)
  }))

  ctx.effect(() => ctx.on('agent/created', ({ agent }) => {
    if (agent?.session === undefined) return
    if (agent.session.header?.origin === 'subagent') {
      refreshSoon(undefined)
      return
    }
    // The first top-level agent is the Elephant: paint the footer for it now,
    // instead of waiting for the first /egm command.
    tui?.refresh?.(agent)
  }))

  ctx.effect(() => ctx.on('subagent/end', () => tui?.refresh?.(undefined)))

  ctx.logger?.info?.(`dsh-egm: ready — ${problems.length === 0 ? 'config ok' : `${problems.length} config problem(s), run /egm doctor`}`)
}
