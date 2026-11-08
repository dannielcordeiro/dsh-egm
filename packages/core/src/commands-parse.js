/**
 * One parser for the `/egm` command line, shared by the command handler, the
 * session projection (which replays the same arguments from the log) and the
 * tests. Keeping it pure is what lets the fold reproduce the handler's effect
 * without duplicating the grammar.
 */
import { PHASES, parseRoute } from './config.js'
import { normalizeRole } from './personas.js'

export const EGM_USAGE = [
  'Usage:',
  '  /egm status                        this session\'s run, roles and problems',
  '  /egm routes [--json]               effective route per role, with provenance',
  '  /egm model                         interactive picker (terminal) or summary',
  '  /egm model show <role>             one role',
  '  /egm model set <role> <route> [--session|--profile]',
  '  /egm model set <role> inherit [--session]',
  '  /egm model reset <role> [--workspace|--profile]',
  '  /egm model test [role|provider/model]  validate a route against the live catalogue',
  '  /egm phase <brainstorm|draft|review|resolve|bootstrap|drift>',
  '  /egm stage <5-9> <running|done|idle>',
  '  /egm review preset <interactive|consolidated|feature_spec|implementation>',
  '  /egm catalogue [--json]            providers, models and efforts the llm service offers',
  '  /egm artifacts                     files this run produced',
  '  /egm report [--json]               the whole run as a report',
  '  /egm doctor                        check the composition, credentials and files',
  '  /egm workspace                     which .dsh/egm.yaml is in effect',
  '',
  'A route is provider/model with an optional #effort, e.g. anthropic/claude-sonnet-5-5#high.',
  'Roles: elephant, worker, default, a phase name, or any reviewer persona',
  '(zoom_out, design_critic, comprehension, structural, style,',
  ' implementation_readiness, codebase_details, inventive_catalyst, synthesizer…).',
].join('\n')

/** Where a route edit should be written. */
const SCOPES = Object.freeze(['session', 'profile'])

/**
 * Split the raw command text into a verb and its positional arguments.
 * @param {string} rawInput text after the command name.
 */
export function tokenize(rawInput) {
  const text = typeof rawInput === 'string' ? rawInput.trim() : ''
  if (text === '') return []
  const tokens = []
  let current = ''
  let quote
  for (const character of text) {
    if (quote !== undefined) {
      if (character === quote) quote = undefined
      else current += character
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (/\s/u.test(character)) {
      if (current !== '') tokens.push(current)
      current = ''
      continue
    }
    current += character
  }
  if (current !== '') tokens.push(current)
  return tokens
}

/** Extract `--flag` options from a token list. */
function splitFlags(tokens) {
  const flags = new Set()
  const rest = []
  for (const token of tokens) {
    if (token.startsWith('--')) flags.add(token.slice(2).toLowerCase())
    else rest.push(token)
  }
  return { flags, rest }
}

/**
 * Parse one `/egm …` invocation.
 * @param {string} name command name (`egm` or `egm-<phase>`).
 * @param {string} rawInput text after the name.
 * @returns {object} a discriminated result; `kind: 'help'` carries the usage text.
 */
export function parseEgmCommand(name, rawInput) {
  const command = String(name ?? 'egm').toLowerCase()
  if (command.startsWith('egm-')) {
    const phase = command.slice(4)
    if (!PHASES.includes(phase)) return { kind: 'error', error: `unknown phase command ${name}` }
    const target = typeof rawInput === 'string' ? rawInput.trim() : ''
    return { kind: 'phase-start', phase, target: target === '' ? undefined : target, args: target }
  }
  const { flags, rest } = splitFlags(tokenize(rawInput))
  const [verb, ...positional] = rest
  if (verb === undefined) return { kind: 'help' }

  switch (verb.toLowerCase()) {
    case 'help':
    case '?':
      return { kind: 'help' }
    case 'status':
      return { kind: 'status', json: flags.has('json') }
    case 'routes':
      return { kind: 'routes', json: flags.has('json') }
    case 'artifacts':
      return { kind: 'artifacts', json: flags.has('json') }
    case 'catalogue':
    case 'catalog':
      return { kind: 'catalogue', json: flags.has('json') }
    case 'report':
      return { kind: 'report', json: flags.has('json') }
    case 'doctor':
      return { kind: 'doctor', json: flags.has('json') }
    case 'workspace':
      return { kind: 'workspace' }
    case 'phase': {
      const phase = (positional[0] ?? '').toLowerCase()
      if (!PHASES.includes(phase)) return { kind: 'error', error: `phase must be one of ${PHASES.join(', ')}` }
      return { kind: 'phase', phase }
    }
    case 'stage': {
      const stage = String(positional[0] ?? '')
      const status = (positional[1] ?? '').toLowerCase()
      if (!['5', '6', '7', '8', '9'].includes(stage)) return { kind: 'error', error: 'stage must be 5, 6, 7, 8 or 9' }
      if (!['running', 'done', 'idle'].includes(status)) return { kind: 'error', error: 'stage status must be running, done or idle' }
      return { kind: 'stage', stage, status }
    }
    case 'review': {
      if ((positional[0] ?? '').toLowerCase() !== 'preset') return { kind: 'error', error: 'usage: /egm review preset <name>' }
      const preset = (positional[1] ?? '').toLowerCase()
      const allowed = ['interactive', 'consolidated', 'feature_spec', 'implementation']
      if (!allowed.includes(preset)) return { kind: 'error', error: `review preset must be one of ${allowed.join(', ')}` }
      return { kind: 'review-preset', preset }
    }
    case 'model':
      return parseModel(positional, flags)
    default:
      return { kind: 'error', error: `unknown subcommand "${verb}"; run /egm help` }
  }
}

function parseModel(positional, flags) {
  const [sub, ...rest] = positional
  if (sub === undefined) return { kind: 'model-pick' }
  switch (sub.toLowerCase()) {
    case 'show': {
      const role = rest[0] === undefined ? undefined : normalizeRole(rest[0])
      if (rest[0] !== undefined && role === undefined) return { kind: 'error', error: `unknown role "${rest[0]}"` }
      return { kind: 'model-show', role, json: flags.has('json') }
    }
    case 'set': {
      const role = normalizeRole(rest[0] ?? '')
      if (role === undefined) return { kind: 'error', error: `unknown role "${rest[0] ?? ''}"` }
      const value = rest[1]
      if (value === undefined) return { kind: 'error', error: 'usage: /egm model set <role> <provider/model#effort|inherit>' }
      const scope = flags.has('session') ? 'session' : 'profile'
      if (value.toLowerCase() === 'inherit') {
        // Inheriting is a session-scoped statement; in the profile it means
        // "remove the entry", which is what `reset` does.
        return scope === 'session' ? { kind: 'model-set', role, route: null, scope } : { kind: 'model-reset', role, scope: 'profile' }
      }
      const parsed = parseRoute(value)
      if (parsed.problems.length > 0) return { kind: 'error', error: parsed.problems.join('; ') }
      return { kind: 'model-set', role, route: parsed.route, scope }
    }
    case 'reset': {
      const role = normalizeRole(rest[0] ?? '')
      if (role === undefined) return { kind: 'error', error: `unknown role "${rest[0] ?? ''}"` }
      const scope = flags.has('session') ? 'session' : 'profile'
      return { kind: 'model-reset', role, scope }
    }
    case 'test': {
      const target = rest[0]
      if (target === undefined) return { kind: 'model-test' }
      if (target.includes('/')) {
        const parsed = parseRoute(target)
        if (parsed.problems.length > 0) return { kind: 'error', error: parsed.problems.join('; ') }
        return { kind: 'model-test', route: parsed.route }
      }
      const role = normalizeRole(target)
      if (role === undefined) return { kind: 'error', error: `unknown role "${target}"` }
      return { kind: 'model-test', role }
    }
    default:
      return { kind: 'error', error: `unknown model subcommand "${sub}"; run /egm help` }
  }
}

/** Validate a scope token; exported for the command handler's messages. */
export function isScope(value) {
  return SCOPES.includes(value)
}
