/**
 * The `/egm` command: the management surface for a run.
 *
 * It is the one entry point the browser UI and the terminal share — the browser
 * client reaches it through `ctx.remote.commands.execute` — so every action is
 * available as text and, with `--json`, as data for a screen.
 *
 * The command never decides a route by itself: it asks the router, which reads
 * the session overrides, the workspace file and the profile in that order.
 */
import { PHASES, allRoles, formatRoute } from './config.js'
import { EGM_USAGE, parseEgmCommand } from './commands-parse.js'
import { normalizeRole } from './personas.js'
import { runDoctor } from './doctor.js'
import { createView } from './projection.js'
import { roleLabel } from './tui.js'
import { workspaceSnippet } from './workspace.js'
import { service } from './services.js'

/**
 * Register `/egm` when the composition has a command registry.
 * @param {import('@deepseek-ai/cordis').Context} ctx owning plugin context.
 * @param {object} deps plugin dependencies.
 */
export function registerEgmCommand(ctx, deps) {
  if (deps.config.features.commands === false) return
  const commands = deps.commands ?? service(ctx, 'commands')
  if (commands === undefined) {
    ctx.logger?.warn?.('dsh-egm: no command registry is composed, so /egm is unavailable')
    return
  }
  {
    ctx.logger?.info?.('dsh-egm: registered /egm')
    commands.register({
      name: 'egm',
      description: 'Elephant-Goldfish Model run: status, model routes, artifacts and diagnostics',
      input: { hint: 'status | routes | model | phase | stage | artifacts | report | doctor | workspace' },
      handler: async (invocation) => handleEgmCommand(deps, invocation).catch((error) => ({
        kind: 'error',
        text: `egm: ${error instanceof Error ? error.message : String(error)}`,
      })),
    })
  }
}

/**
 * Run one `/egm` invocation.
 * @param {object} deps plugin dependencies.
 * @param {{agent: object, rawInput: string, signal?: AbortSignal}} invocation
 * @returns {Promise<{kind: string, text: string}>}
 */
export async function handleEgmCommand(deps, invocation) {
  const parsed = parseEgmCommand('egm', invocation.rawInput)
  const agent = invocation.agent
  // Reading the run is also a chance to repaint the terminal footer, which is
  // otherwise only repainted when something changes.
  deps.refresh?.(agent)
  switch (parsed.kind) {
    case 'help':
      return ok(EGM_USAGE)
    case 'status':
      return parsed.json ? ok(JSON.stringify(await statusData(deps, agent), null, 2)) : ok(await statusText(deps, agent))
    case 'routes':
      return parsed.json ? ok(JSON.stringify(await routesData(deps, agent), null, 2)) : ok(await routesText(deps, agent))
    case 'model-show':
      if (parsed.role === undefined && deps.tui?.pickRoute !== undefined) return pickAndSet(deps, agent)
      return parsed.json ? ok(JSON.stringify(await modelShowData(deps, agent, parsed.role), null, 2)) : ok(await modelShowText(deps, agent, parsed.role))
    case 'model-set':
      return setRoute(deps, agent, parsed)
    case 'model-reset':
      return resetRoute(deps, agent, parsed)
    case 'model-test':
      return testRoute(deps, agent, parsed)
    case 'model-pick':
      return pickAndSet(deps, agent)
    case 'phase':
      deps.refresh?.(agent)
      return ok(`EGM phase is now ${parsed.phase}. Start it with the matching skill, for example /egm-${parsed.phase}.`)
    case 'stage':
      deps.refresh?.(agent)
      return ok(`stage ${parsed.stage} marked ${parsed.status}.`)
    case 'review-preset':
      deps.refresh?.(agent)
      return ok(`review preset recorded: ${parsed.preset}.`)
    case 'artifacts':
      return parsed.json ? ok(JSON.stringify(artifactsData(deps, agent), null, 2)) : ok(artifactsText(deps, agent))
    case 'report':
      return parsed.json ? ok(JSON.stringify(await reportData(deps, agent), null, 2)) : ok(await reportText(deps, agent))
    case 'doctor':
      return doctor(deps, agent, parsed.json)
    case 'workspace':
      return workspaceInfo(deps, agent)
    case 'phase-start':
      return ok(`/egm-${parsed.phase} is a skill, not a subcommand. Run /egm phase ${parsed.phase} to record the phase, or invoke the skill directly.`)
    case 'error':
      return { kind: 'error', text: `${parsed.error}\n\n${EGM_USAGE}` }
    default:
      return { kind: 'error', text: `egm: unhandled request\n\n${EGM_USAGE}` }
  }
}

function ok(text) {
  return { kind: 'success', text }
}

/** The projection state for one agent, or an empty stand-in. */
function stateOf(deps, agent) {
  return deps.projectionState(agent) ?? {
    phase: null,
    elephant: null,
    children: {},
    artifacts: [],
    stages: {},
    overrides: {},
    budget: {},
    notes: [],
  }
}

function viewOf(deps, agent) {
  return createView(stateOf(deps, agent), deps.live.snapshot(), deps.config.pricing)
}

async function statusData(deps, agent) {
  const view = viewOf(deps, agent)
  const routes = await routesData(deps, agent)
  return {
    phase: view.phase,
    designDoc: view.designDoc,
    elephant: view.elephantKey,
    stages: view.stages,
    children: view.children.map((child) => ({
      childId: child.childId,
      kind: child.kind,
      role: child.role,
      stage: child.stage,
      status: child.status,
      route: child.routeKey,
      tokens: child.tokens,
    })),
    running: deps.live.running(),
    artifacts: view.artifacts,
    budget: view.budget,
    cost: view.cost,
    unpricedChildren: view.unpricedChildren,
    routes,
    notes: view.notes,
    workspace: workspaceInfoData(deps, agent),
  }
}

async function statusText(deps, agent) {
  const data = await statusData(deps, agent)
  const lines = []
  lines.push(`EGM ${data.phase ?? 'not started'}${data.designDoc === null ? '' : ` · ${data.designDoc}`}`)
  lines.push(`Elephant: ${data.elephant ?? 'inherited'} · reviewers running: ${data.running}`)
  const configured = data.routes.roles.filter((role) => role.text !== 'inherit')
  lines.push(configured.length === 0
    ? 'Routes: every role inherits the session model (/egm model set <role> <provider/model> to change that)'
    : `Routes: ${configured.map((role) => `${role.role}=${role.text}`).join(' · ')}`)
  if (data.stages.some((stage) => stage.reviewers > 0)) {
    lines.push(`Stages: ${data.stages.map((stage) => `${stage.stage}:${stage.status}(${stage.reviewers})`).join(' ')}`)
  }
  if (data.children.length > 0) {
    lines.push('Children:')
    for (const child of data.children.slice(-10)) {
      const tokens = child.tokens.input + child.tokens.output
      lines.push(`  ${child.status === 'settled' ? '✓' : child.status === 'failed' ? '✗' : '◐'} ${child.role ?? child.kind}${child.stage === null ? '' : ` [${child.stage}]`} · ${child.route ?? 'inherit'} · ${tokens} tok · ${child.childId.slice(0, 8)}`)
    }
  }
  if (data.artifacts.length > 0) lines.push(`Artifacts: ${data.artifacts.map((artifact) => artifact.path).slice(-5).join(', ')}`)
  if (data.workspace.path !== undefined) lines.push(`Workspace: ${data.workspace.path}${data.workspace.problems.length === 0 ? '' : ` (${data.workspace.problems.length} problem(s): /egm doctor)`}`)
  if (data.notes.length > 0) lines.push(`Notes: ${data.notes.join(' · ')}`)
  return lines.join('\n')
}

async function routesData(deps, agent) {
  const cwd = deps.cwdOf(agent)
  const workspaceState = deps.workspace.read(cwd)
  return {
    roles: deps.router.describe({ roles: allRoles(), cwd, agent }),
    workspace: { path: workspaceState.path ?? null, problems: workspaceState.problems ?? [] },
    profile: {
      elephant: deps.config.routing.elephant,
      workers: deps.config.routing.workers,
      phases: deps.config.routing.phases,
      reviewers: deps.config.routing.reviewers,
      onInvalidRoute: deps.config.routing.onInvalidRoute,
      onMissingRole: deps.config.routing.onMissingRole,
    },
    maxTokens: deps.config.maxTokens,
    pricing: Object.keys(deps.config.pricing),
  }
}

async function routesText(deps, agent) {
  const data = await routesData(deps, agent)
  const lines = ['EGM routes (highest precedence first: session → workspace → profile → inherit)', '']
  for (const role of data.roles) {
    lines.push(`  ${roleLabel(role.role).padEnd(28)} ${role.text.padEnd(42)} ${role.source}`)
  }
  lines.push('')
  lines.push(data.workspace.path === null
    ? 'Workspace: no .dsh/egm.yaml in this project (profile routes apply)'
    : `Workspace: ${data.workspace.path}${data.workspace.problems.length === 0 ? '' : ` — ${data.workspace.problems.join('; ')}`}`)
  lines.push(`Invalid route policy: ${data.profile.onInvalidRoute} · missing role: ${data.profile.onMissingRole} · output tokens: ${data.maxTokens.policy}`)
  lines.push('Set: /egm model set <role> <provider/model#effort> [--session] · clear: /egm model reset <role>')
  return lines.join('\n')
}

async function modelShowData(deps, agent, role) {
  const cwd = deps.cwdOf(agent)
  const roles = role === undefined ? allRoles() : [role]
  return { roles: deps.router.describe({ roles, cwd, agent }) }
}

async function modelShowText(deps, agent, role) {
  const data = await modelShowData(deps, agent, role)
  if (role !== undefined) {
    const entry = data.roles[0]
    return `${roleLabel(role)}: ${entry.text} (${entry.source})${entry.problems.length === 0 ? '' : `\n${entry.problems.join('\n')}`}`
  }
  return data.roles.map((entry) => `${roleLabel(entry.role).padEnd(28)} ${entry.text.padEnd(42)} ${entry.source}`).join('\n')
}

async function setRoute(deps, agent, parsed) {
  const role = parsed.role
  if (parsed.route !== null) {
    const verdict = await deps.router.validate(parsed.route)
    if (!verdict.ok) {
      return { kind: 'error', text: `${roleLabel(role)}: ${formatRoute(parsed.route)} cannot be used — ${verdict.reason ?? 'unknown reason'}\nNothing was written. Try /egm model test ${formatRoute(parsed.route)} or pick another model.` }
    }
  }
  if (parsed.scope === 'session') {
    deps.refresh?.(agent)
    return ok(`EGM ${roleLabel(role)} → ${parsed.route === null ? 'inherit' : formatRoute(parsed.route)} for this session.`)
  }
  if (deps.writer === undefined) return { kind: 'error', text: 'egm: no profile writer is available in this composition' }
  const written = await deps.writer.setRoute(role, parsed.route)
  if (!written.ok) return { kind: 'error', text: `egm: could not write the profile: ${written.reason}` }
  deps.refresh?.(agent)
  return ok(`EGM ${roleLabel(role)} → ${formatRoute(parsed.route)} in the profile (cordis.patch.yml). New activations use it immediately.`)
}

async function resetRoute(deps, agent, parsed) {
  if (parsed.scope === 'session') {
    deps.refresh?.(agent)
    return ok(`EGM ${roleLabel(parsed.role)} session override cleared.`)
  }
  if (deps.writer === undefined) return { kind: 'error', text: 'egm: no profile writer is available in this composition' }
  const written = await deps.writer.resetRoute(parsed.role)
  if (!written.ok) return { kind: 'error', text: `egm: could not write the profile: ${written.reason}` }
  deps.refresh?.(agent)
  return ok(`EGM ${roleLabel(parsed.role)}: profile route removed; it now inherits unless the workspace sets one.`)
}

async function testRoute(deps, agent, parsed) {
  if (parsed.route !== undefined) {
    const verdict = await deps.router.validate(parsed.route)
    return verdict.ok
      ? ok(`${formatRoute(parsed.route)} is usable.`)
      : { kind: 'error', text: `${formatRoute(parsed.route)} cannot be used: ${verdict.reason}` }
  }
  const cwd = deps.cwdOf(agent)
  const roles = parsed.role === undefined ? allRoles() : [parsed.role]
  const rows = []
  let failures = 0
  for (const role of roles) {
    const resolved = deps.router.resolve({ role, cwd, agent })
    if (resolved.route === null) {
      rows.push(`  ${roleLabel(role).padEnd(28)} inherited`)
      continue
    }
    const verdict = await deps.router.validate(resolved.route)
    if (!verdict.ok) failures += 1
    rows.push(`  ${roleLabel(role).padEnd(28)} ${formatRoute(resolved.route).padEnd(42)} ${verdict.ok ? 'ok' : `FAILED: ${verdict.reason}`}`)
  }
  const header = failures === 0 ? 'Every configured route is usable.' : `${failures} configured route(s) cannot be used.`
  return { kind: failures === 0 ? 'success' : 'error', text: [header, ...rows].join('\n') }
}

async function pickAndSet(deps, agent) {
  if (deps.tui === undefined || typeof deps.tui.pickRoute !== 'function') {
    return ok('Interactive picking needs the terminal UI. Use /egm model set <role> <provider/model#effort>.')
  }
  const role = (await deps.tui.selectRole?.()) ?? 'elephant'
  const route = await deps.tui.pickRoute(role)
  if (route === undefined) return ok('egm: no change.')
  return setRoute(deps, agent, { kind: 'model-set', role, route, scope: 'profile' })
}

function artifactsData(deps, agent) {
  const state = stateOf(deps, agent)
  return { phase: state.phase, artifacts: state.artifacts ?? [] }
}

function artifactsText(deps, agent) {
  const data = artifactsData(deps, agent)
  if (data.artifacts.length === 0) return `No EGM artifact recorded in this session${data.phase === null ? '' : ` (phase ${data.phase})`}.`
  return ['EGM artifacts in this session:', ...data.artifacts.map((artifact) => `  ${artifact.kind.padEnd(9)} ${artifact.path}`)].join('\n')
}

async function reportData(deps, agent) {
  const view = viewOf(deps, agent)
  return {
    report: {
      phase: view.phase,
      designDoc: view.designDoc,
      reviewPreset: view.reviewPreset,
      elephant: view.elephant,
      stages: view.stages,
      children: view.children,
      artifacts: view.artifacts,
      budget: view.budget,
      cost: view.cost,
      unpricedChildren: view.unpricedChildren,
      notes: view.notes,
    },
    routes: await routesData(deps, agent),
    workspace: workspaceInfoData(deps, agent),
  }
}

async function reportText(deps, agent) {
  const data = await reportData(deps, agent)
  const report = data.report
  const lines = [`# EGM run — ${report.phase ?? 'not started'}`, '']
  if (report.designDoc !== null) lines.push(`Design: ${report.designDoc}`)
  if (report.reviewPreset !== null) lines.push(`Review preset: ${report.reviewPreset}`)
  lines.push(`Elephant: ${report.elephant === null ? 'inherited' : formatRoute(report.elephant)}`, '')
  if (report.children.length > 0) {
    lines.push('| child | role | stage | status | route | tokens |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const child of report.children) {
      const tokens = child.tokens.input + child.tokens.output
      lines.push(`| ${child.childId.slice(0, 8)} | ${child.role ?? child.kind} | ${child.stage ?? '—'} | ${child.status} | ${child.routeKey ?? 'inherit'} | ${tokens} |`)
    }
    lines.push('')
  }
  if (report.artifacts.length > 0) {
    lines.push('Artifacts:')
    for (const artifact of report.artifacts) lines.push(`- ${artifact.kind}: ${artifact.path}`)
    lines.push('')
  }
  const total = (report.budget.input ?? 0) + (report.budget.output ?? 0)
  lines.push(`Tokens: ${total} (input ${report.budget.input ?? 0}, output ${report.budget.output ?? 0}${report.budget.cacheRead === undefined ? '' : `, cache read ${report.budget.cacheRead}`})`)
  if (report.cost !== null) lines.push(`Estimated cost: ${report.cost} (from the configured pricing table)`)
  if (report.unpricedChildren > 0) lines.push(`${report.unpricedChildren} child(ren) have tokens but no price; add them under pricing.<provider>/<model>`)
  lines.push('', 'Routes:', ...data.routes.roles.filter((role) => role.text !== 'inherit').map((role) => `- ${role.role}: ${role.text} (${role.source})`))
  return lines.join('\n')
}

async function doctor(deps, agent, asJson) {
  const result = await runDoctor(deps, { agent, cwd: deps.cwdOf(agent) })
  if (asJson) return ok(JSON.stringify(result, null, 2))
  const lines = [result.ok ? 'EGM doctor: everything needed for a review is in place.' : 'EGM doctor found problems:' ]
  for (const check of result.checks) {
    lines.push(`  ${check.ok ? '✓' : '✗'} ${check.id.padEnd(24)} ${check.detail}${check.action === undefined ? '' : `\n      → ${check.action}`}`)
  }
  return { kind: result.ok ? 'success' : 'error', text: lines.join('\n') }
}

function workspaceInfoData(deps, agent) {
  const state = deps.workspace.read(deps.cwdOf(agent))
  return {
    path: state.path ?? null,
    problems: state.problems ?? [],
    scope: state.scope ?? null,
    snippet: workspaceSnippet(state.scope),
  }
}

function workspaceInfo(deps, agent) {
  const data = workspaceInfoData(deps, agent)
  if (data.path === null) {
    const example = ['routing.elephant: anthropic/claude-sonnet-5-5#high', 'routing.reviewers.design_critic: ollama/qwen3.5-64k:latest', 'routing.reviewers.default: ollama/lumi-4b'].join('\n')
    return ok(`No .dsh/egm.yaml in this project; the profile routes apply.\n\nCreate .dsh/egm.yaml with, for example:\n${example}`)
  }
  const lines = [`Workspace file: ${data.path}`]
  if (data.problems.length > 0) lines.push('Problems:', ...data.problems.map((problem) => `  ✗ ${problem}`))
  lines.push('', data.snippet === '' ? 'It sets no route yet.' : data.snippet)
  return { kind: data.problems.length === 0 ? 'success' : 'error', text: lines.join('\n') }
}

/** Resolve a role name from a UI payload. */
export function resolveRole(value) {
  return normalizeRole(value)
}
