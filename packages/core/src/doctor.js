/**
 * `/egm doctor`: everything that has to be true for an EGM review to work,
 * checked in one pass and reported with the fix next to the failure.
 *
 * The checks are ordered from the composition outward, so the first failure is
 * usually the cause of the ones after it.
 */
import { PHASES, formatRoute } from './config.js'
import { reviewerRoles } from './personas.js'
import { listRoutes } from './catalog.js'
import { service } from './services.js'

/** Roles checked when the caller does not name one. */
function rolesToCheck() {
  return ['elephant', ...PHASES, 'default', ...reviewerRoles()]
}

/**
 * Run every check.
 * @param {object} deps plugin dependencies plus the calling agent.
 * @param {{agent?: object, cwd?: string}} options
 * @returns {Promise<{ok: boolean, checks: Array<object>}>}
 */
export async function runDoctor(deps, { agent, cwd } = {}) {
  const { ctx, config, router, workspace, live } = deps
  const checks = []
  const add = (id, ok, detail, action) => checks.push({ id, ok, detail, ...action === undefined ? {} : { action } })

  const skills = service(ctx, 'skills')
  add('skills', skills !== undefined, skills === undefined ? 'no skill registry is composed' : 'skill registry present', skills === undefined ? 'compose @deepseek-ai/dsh-skill' : undefined)

  const commands = service(ctx, 'commands')
  add('commands', commands !== undefined, commands === undefined ? 'no command registry is composed' : 'command registry present', commands === undefined ? 'compose @deepseek-ai/dsh-commands' : undefined)

  const projections = service(ctx, 'sessionProjections')
  add('projection', projections !== undefined, projections === undefined ? 'no session projection registry: the run will not be tracked' : 'run projection registered', projections === undefined ? 'compose @deepseek-ai/dsh-session-projection' : undefined)

  const presets = service(ctx, 'agentPresets')
  if (presets === undefined) {
    add('agent-presets', false, 'the agent-presets service is not composed, so reviewers cannot start', 'compose @deepseek-ai/dsh-agent-preset-registry, or launch with adapters/prereqs/agent-presets.patch.yml')
  } else {
    add('agent-presets', true, 'agent-presets service present')
    try {
      const list = await presets.list()
      const reviewer = list.find((entry) => entry.id === 'egm-reviewer')
      if (reviewer === undefined) add('preset', false, 'the egm-reviewer preset is not installed', 'reinstall @local/dsh-egm')
      else if (reviewer.broken !== undefined) add('preset', false, `the egm-reviewer preset is broken: ${String(reviewer.broken)}`, 'inspect the preset row in cordis.patch.yml')
      else add('preset', true, 'egm-reviewer preset is installed')
    } catch (error) {
      add('preset', false, `presets could not be listed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const subagents = service(ctx, 'subagents')
  if (subagents === undefined) add('spawn', false, 'no subagent service: reviewers cannot start', 'compose @deepseek-ai/dsh-subagent and @deepseek-ai/dsh-subagent-spawn-in-process')
  else if (!subagents.list().includes('spawn')) add('spawn', false, 'no in-process "spawn" provider', 'compose @deepseek-ai/dsh-subagent-spawn-in-process')
  else add('spawn', true, 'in-process spawn provider present')

  const depth = typeof subagents?.resolveMaxDepth === 'function' ? subagents.resolveMaxDepth() : undefined
  const callingDepth = agent?.session?.header?.delegationDepth ?? agent?.options?.subagentDepth ?? 0
  if (depth === undefined) add('depth', true, 'no depth cap configured')
  else if (callingDepth >= depth) add('depth', false, `this agent is at delegation depth ${callingDepth} and the cap is ${depth}, so a reviewer cannot start here`, 'start EGM from a top-level session')
  else add('depth', true, `delegation depth available (${callingDepth} of ${depth})`)

  const llm = service(ctx, 'llm')
  const { providers } = await listRoutes(llm)
  if (providers.length === 0) add('llm', false, 'no LLM provider is registered', 'compose an LLM adapter such as @deepseek-ai/dsh-llm-pi-ai')
  for (const provider of providers) {
    add(`provider:${provider.id}`, provider.available, provider.available ? 'catalogue available' : provider.error ?? 'no models', provider.available ? undefined : 'add credentials for this provider')
  }

  const workspaceState = cwd === undefined ? { problems: [] } : workspace.read(cwd)
  if (workspaceState.path === undefined) add('workspace', true, 'no .dsh/egm.yaml in this project; the profile routes apply')
  else if (workspaceState.problems.length > 0) add('workspace', false, `${workspaceState.path}: ${workspaceState.problems.join('; ')}`, 'fix the file, or delete it to use the profile routes')
  else add('workspace', true, `${workspaceState.path} is in effect`)

  for (const role of rolesToCheck()) {
    const resolved = router.resolve({ role, agent, cwd })
    if (resolved.route === null) {
      add(`route:${role}`, true, 'inherited from the calling agent')
      continue
    }
    const verdict = await router.validate(resolved.route)
    add(`route:${role}`, verdict.ok, `${formatRoute(resolved.route)} from ${resolved.source}`, verdict.ok ? undefined : `${verdict.reason ?? 'unusable'}; fix with /egm model set ${role} <provider/model#effort>`)
  }

  const configProblems = deps.configProblems ?? []
  add('config', configProblems.length === 0, configProblems.length === 0 ? 'row config is valid' : configProblems.join('; '), configProblems.length === 0 ? undefined : 'fix the `egm` row config in cordis.patch.yml')

  if (live !== undefined) add('live', true, `${live.running()} child(ren) running in this process`)

  return { ok: checks.every((check) => check.ok), checks }
}
