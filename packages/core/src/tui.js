/**
 * Terminal surfaces for the dsh-tui profile.
 *
 * Every service here is optional: the same plugin runs in a browser profile and
 * in a headless one, where none of these exist. Each registration is probed with
 * `ctx.get(name, false)` and skipped when absent, and a refusal is logged rather
 * than thrown, so a terminal that rejects one surface never takes the plugin
 * down with it.
 *
 * Surfaces: a footer field with the current phase and route, a side panel with
 * the run, a command tree for `/egm` completion, a settings section that edits
 * the profile routes, and the dialog chain used by the `/egm model` picker.
 */
import { PHASES, allRoles, formatRoute, parseRoute } from './config.js'
import { whenService } from './services.js'
import { reviewerRoles } from './personas.js'
import { STAGES } from './projection.js'

/** Show a short route: drop the provider when it is already obvious. */
function shortRoute(route) {
  if (route === null || route === undefined) return 'inherit'
  const effort = route.reasoningEffort === undefined ? '' : `#${route.reasoningEffort}`
  return `${route.model}${effort}`
}

/** One glyph per phase, so the footer reads at a glance. */
const PHASE_GLYPH = Object.freeze({
  brainstorm: '🐘',
  draft: '📝',
  review: '🐟',
  resolve: '🛠',
  bootstrap: '📚',
  drift: '🧭',
})

/**
 * Register every terminal surface that this composition offers.
 * @param {import('@deepseek-ai/cordis').Context} ctx owning plugin context.
 * @param {object} deps plugin dependencies.
 * @returns {{refresh: () => void, pickRoute: (role: string) => Promise<object | undefined>}}
 */
export function registerTui(ctx, deps) {
  const { config, router, live, workspace, projectionState } = deps
  // The terminal mounts its services in its own layer; this plugin may activate
  // before them, so each surface waits for its service instead of probing once.
  let status = false
  let panels = false
  let trees = false
  let sections = false
  let dialogs = false
  let lastAgent
  const enabled = config.features.tui !== false
  const noop = () => {}

  if (!enabled) return { refresh: noop, pickRoute: async () => undefined }

  /** Current view-ish snapshot for the surfaces, without touching the projection cache. */
  function snapshot(agent) {
    const state = projectionState(agent) ?? { phase: null, children: {}, stages: {}, artifacts: [] }
    const phase = state.phase
    const role = phase ?? 'elephant'
    const resolved = router.resolve({ role, agent, cwd: cwdOfAgent(agent) })
    return {
      phase,
      route: resolved.route,
      source: resolved.source,
      children: Object.values(state.children ?? {}),
      live: live.snapshot().children,
      stages: state.stages ?? {},
      artifacts: state.artifacts ?? [],
      budget: state.budget ?? {},
    }
  }

  // ---- footer field ---------------------------------------------------------
  let disposeStatus
  function refresh(agent) {
    // Keep the Elephant: event listeners fire without an agent, and the footer
    // must describe the session, never a reviewer child.
    if (agent?.session !== undefined && agent.session.header?.origin !== 'subagent') lastAgent = agent
    const target = agent?.session !== undefined ? agent : lastAgent
    if (status === false || target === undefined) return
    const view = snapshot(target)
    const running = live.running()
    const total = view.children.length
    const glyph = PHASE_GLYPH[view.phase] ?? '🐘'
    const text = `${glyph} ${shortRoute(view.route)}${total === 0 ? '' : ` · ${running > 0 ? `${running}/${total}` : total}`}`
    const detail = [
      `phase: ${view.phase ?? 'not started'}`,
      `route: ${formatRoute(view.route)} (${view.source})`,
      total === 0 ? 'no reviewers yet' : `reviewers: ${running} running of ${total}`,
      view.artifacts.length === 0 ? '' : `artifacts: ${view.artifacts.length}`,
      'click or press the EGM panel for the run',
    ].filter((line) => line !== '').join(' · ')
    try {
      disposeStatus?.()
      disposeStatus = status.setField('egm', text, {
        slot: 'right-tail',
        tone: running > 0 ? 'accent' : 'dim',
        maxCells: 32,
        detail,
        onClick: () => {
          try {
            panels.open?.('run')
          } catch (error) {
            ctx.logger?.warn?.(`dsh-egm: could not open the EGM panel: ${String(error?.message ?? error)}`)
          }
        },
      }, ctx)
    } catch (error) {
      ctx.logger?.warn?.(`dsh-egm: footer field refused: ${String(error?.message ?? error)}`)
    }
  }

  whenService(ctx, 'tuiStatus', (resolved) => {
    status = resolved
    refresh(lastAgent)
  })

  // ---- side panel -----------------------------------------------------------
  whenService(ctx, 'tuiPanels', (resolved) => {
    panels = resolved
    try {
      const disposer = panels.register({
        apiVersion: 1,
        id: 'run',
        title: 'EGM',
        order: 40,
        minColumns: 28,
        component: ({ React, ui, host }) => {
          const { Box, Text, Divider } = ui
          const tick = ui.useAnimationTime(live.running() > 0 ? 1000 : null)
          const agent = host?.snapshot?.()?.agent
          const view = snapshot(agent)
          const rows = []
          rows.push(React.createElement(Text, { key: 'phase', bold: true },
            `${PHASE_GLYPH[view.phase] ?? '🐘'} ${view.phase ?? 'no phase yet'} · ${shortRoute(view.route)} (${view.source})`))
          if (view.artifacts.length > 0) {
            rows.push(React.createElement(Text, { key: 'artifacts', dimColor: true },
              `${view.artifacts.length} artifact(s) · ${view.artifacts[view.artifacts.length - 1].path.split('/').pop()}`))
          }
          rows.push(React.createElement(Divider, { key: 'd1' }))
          for (const stage of STAGES) {
            const status = view.stages[stage] ?? 'idle'
            const reviewers = view.children.filter((child) => child.stage === stage)
            const mark = status === 'done' ? '✓' : status === 'running' ? '◐' : '·'
            rows.push(React.createElement(Text, { key: `stage-${stage}` },
              `${mark} stage ${stage}  ${reviewers.length} reviewer(s)  ${status}`))
          }
          const active = view.children.filter((child) => child.kind === 'reviewer' || child.kind === 'worker')
          if (active.length > 0) {
            rows.push(React.createElement(Divider, { key: 'd2' }))
            for (const child of active.slice(-8)) {
              const facts = view.live[child.childId] ?? {}
              const route = facts.routeKey ?? (child.route === null ? 'inherit' : undefined) ?? 'inherit'
              const tokens = facts.tokens === undefined ? '' : ` ${facts.tokens.input + facts.tokens.output} tok`
              const mark = facts.status === 'settled' ? '✓' : facts.status === 'failed' ? '✗' : '◐'
              rows.push(React.createElement(Text, { key: child.childId, dimColor: facts.status === 'settled' },
                `${mark} ${child.role ?? child.kind}${child.stage === null || child.stage === undefined ? '' : ` [${child.stage}]`} ${route}${tokens}`))
            }
          }
          rows.push(React.createElement(Divider, { key: 'd3' }))
          rows.push(React.createElement(Text, { key: 'hint', dimColor: true },
            '/egm routes · /egm model · /egm doctor'))
          return React.createElement(Box, { flexDirection: 'column', gap: 0 }, ...rows)
        },
      }, ctx)
      if (disposer === undefined) ctx.logger?.warn?.('dsh-egm: the terminal refused the EGM panel')
    } catch (error) {
      ctx.logger?.warn?.(`dsh-egm: panel registration failed: ${String(error?.message ?? error)}`)
    }
  })

  // ---- command completion ---------------------------------------------------
  whenService(ctx, 'tuiCommandTrees', (resolved) => {
    trees = resolved
    try {
      trees.register({
        root: 'egm',
        descriptions: { subcommands: 'EGM run, routes and diagnostics' },
        children: (path) => {
          const [, sub, third] = path
          if (sub === undefined) {
            return [
              { name: 'status', description: 'this session\'s run and routes' },
              { name: 'routes', description: 'effective route per role' },
              { name: 'model', description: 'show, set, reset or test a role route' },
              { name: 'phase', description: 'mark the current phase', children: PHASES.map((phase) => ({ name: phase, description: `phase ${phase}` })) },
              { name: 'stage', description: 'mark a review stage', children: STAGES.map((stage) => ({ name: stage, description: `stage ${stage}` })) },
              { name: 'review', description: 'review preset', children: ['interactive', 'consolidated', 'feature_spec', 'implementation'].map((name) => ({ name, description: `preset ${name}` })) },
              { name: 'artifacts', description: 'files this run produced' },
              { name: 'report', description: 'the run as a report' },
              { name: 'doctor', description: 'check the composition and routes' },
              { name: 'workspace', description: 'which .dsh/egm.yaml is in effect' },
              { name: 'help', description: 'usage' },
            ]
          }
          if (sub === 'model' && third === undefined) {
            return [
              { name: 'show', description: 'one role or all' },
              { name: 'set', description: 'write a route' },
              { name: 'reset', description: 'remove a route' },
              { name: 'test', description: 'validate against the live catalogue' },
            ]
          }
          if (sub === 'model' && (third === 'set' || third === 'reset' || third === 'show')) {
            return ['elephant', 'worker', 'default', ...PHASES, ...reviewerRoles()].map((name) => ({ name, description: roleDescription(name) }))
          }
          return []
        },
      }, ctx)
    } catch (error) {
      ctx.logger?.warn?.(`dsh-egm: command tree refused: ${String(error?.message ?? error)}`)
    }
  })

  // ---- settings section -----------------------------------------------------
  whenService(ctx, 'tuiSettingsSections', (resolved) => {
    sections = resolved
    const routeField = (path, label, hint, group) => ({
      path,
      label,
      hint,
      group,
      kind: 'text',
      placeholder: 'provider/model#effort, empty to inherit',
      format: (value) => (value === undefined || value === null ? '' : formatRoute(value)),
      parse: (text) => {
        const trimmed = String(text ?? '').trim()
        if (trimmed === '') return { kind: 'clear' }
        const parsed = parseRoute(trimmed)
        if (parsed.problems.length > 0) throw new Error(parsed.problems.join('; '))
        return { kind: 'set', value: parsed.route }
      },
    })
    try {
      sections.register({
        ns: 'egm',
        title: 'EGM routes',
        descriptions: {
          en: 'Model per EGM role. Empty means "inherit the session model".',
          pt: 'Modelo por papel do EGM. Vazio significa "herdar o modelo da sessão".',
        },
        fields: [
          routeField(['routing', 'elephant'], 'Elephant route', 'Used by brainstorm, draft, resolve and drift.', 'routes'),
          routeField(['routing', 'reviewers', 'default'], 'Default reviewer route', 'Used by reviewers with no route of their own.', 'routes'),
          {
            path: ['maxTokens', 'policy'],
            group: 'tokens',
            label: 'Output-token policy',
            hint: 'model-default asks the target model for its own cap when the route changes.',
            kind: 'select',
            options: [
              { value: 'model-default', label: 'Model default' },
              { value: 'inherit', label: 'Inherit from the caller' },
              { value: 'fixed', label: 'Fixed value' },
            ],
          },
          {
            path: ['maxTokens', 'fixed'],
            group: 'tokens',
            label: 'Fixed output tokens',
            hint: 'Only used when the policy is "Fixed value".',
            kind: 'number',
          },
        ],
        groups: [{ id: 'routes', title: 'Routes', mode: 'inline' }, { id: 'tokens', title: 'Limits', mode: 'inline' }],
      }, ctx)
    } catch (error) {
      ctx.logger?.warn?.(`dsh-egm: settings section refused: ${String(error?.message ?? error)}`)
    }
  })

  whenService(ctx, 'tuiDialogs', (resolved) => {
    dialogs = resolved
  })

  // ---- route picker ---------------------------------------------------------
  /**
   * Ask which role to edit, then its provider, model and effort.
   * @returns {Promise<string | undefined>} the chosen role.
   */
  async function selectRole() {
    if (dialogs === false) return undefined
    return dialogs.select({
      title: 'EGM · which role?',
      options: allRoles().map((role) => ({ id: role, label: roleLabel(role), description: roleDescription(role) })),
      timeoutMs: 120_000,
    })
  }

  /**
   * Ask for provider, model and effort, one dialog at a time.
   * @param {string} role role being edited, for the dialog titles.
   * @returns {Promise<object | undefined>} the chosen route, or `undefined`.
   */
  async function pickRoute(role) {
    if (dialogs === false) return undefined
    const catalogue = deps.catalogue
    const { providers, models } = await catalogue()
    const usable = providers.filter((provider) => provider.available)
    if (usable.length === 0) return undefined
    const providerId = await dialogs.select({
      title: `EGM · ${roleLabel(role)} · provider`,
      options: usable.map((provider) => ({ id: provider.id, label: provider.name, description: `${models.filter((model) => model.provider === provider.id).length} model(s)` })),
      timeoutMs: 120_000,
    })
    if (providerId === undefined) return undefined
    const candidates = models.filter((model) => model.provider === providerId)
    const modelId = await dialogs.select({
      title: `EGM · ${roleLabel(role)} · model`,
      options: candidates.map((model) => ({
        id: model.id,
        label: model.name,
        description: [model.contextWindow === undefined ? undefined : `${Math.round(model.contextWindow / 1000)}k context`, model.maxTokens === undefined ? undefined : `${model.maxTokens} max tokens`].filter(Boolean).join(' · '),
      })),
      timeoutMs: 120_000,
    })
    if (modelId === undefined) return undefined
    const model = candidates.find((entry) => entry.id === modelId)
    let reasoningEffort
    if (model !== undefined && model.efforts.length > 0) {
      const effortId = await dialogs.select({
        title: `EGM · ${roleLabel(role)} · effort`,
        options: [{ id: '', label: 'Model default', description: 'No explicit effort' }, ...model.efforts.map((effort) => ({ id: effort.id, label: effort.name, description: effort.description }))],
        timeoutMs: 120_000,
      })
      if (effortId === undefined) return undefined
      if (effortId !== '') reasoningEffort = effortId
    }
    return { provider: providerId, model: modelId, ...reasoningEffort === undefined ? {} : { reasoningEffort } }
  }

  return { refresh, pickRoute, selectRole, enabled: true }
}

/** Human label for a role. */
export function roleLabel(role) {
  if (role === 'elephant') return 'Elephant'
  if (role === 'worker') return 'Bootstrap worker'
  if (role === 'default') return 'Any reviewer'
  if (PHASES.includes(role)) return `Phase ${role}`
  return role
}

/** One-line description used by completion. */
function roleDescription(role) {
  if (role === 'elephant') return 'the Elephant session model'
  if (role === 'worker') return 'bootstrap partition workers'
  if (role === 'default') return 'reviewers with no route of their own'
  if (PHASES.includes(role)) return `phase ${role}`
  return 'reviewer persona'
}

/** The calling agent's working directory. */
function cwdOfAgent(agent) {
  const fromAgent = typeof agent?.workingDirectory?.get === 'function' ? agent.workingDirectory.get() : undefined
  return typeof fromAgent === 'string' && fromAgent !== '' ? fromAgent : process.cwd()
}
