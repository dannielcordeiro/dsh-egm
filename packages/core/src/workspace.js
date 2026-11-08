/**
 * Per-workspace overrides, read from `.dsh/egm.yaml` inside the project.
 *
 * The file is deliberately a tiny, boring subset of YAML: dotted keys and
 * scalar values, one per line. That keeps the reader dependency-free and the
 * file reviewable in a pull request. Anything richer is rejected with a line
 * number, and `/egm doctor` shows the same message.
 *
 *   routing.elephant: anthropic/claude-sonnet-5-5#high
 *   routing.phases.review: deepseek-official/deepseek-v4-pro
 *   routing.reviewers.design_critic: ollama/qwen3.5-64k:latest
 *   routing.reviewers.default: ollama/lumi-4b
 *   maxTokens.policy: model-default
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { normalizeRole, reviewerRoles } from './personas.js'
import { PHASES, formatRoute, live, parseRoute } from './config.js'

/** File names looked up inside a project's `.dsh` directory, in order. */
export const WORKSPACE_FILE_NAMES = Object.freeze(['egm.yaml', 'egm.yml'])

/**
 * Find the nearest `.dsh/egm.yaml` at or above `cwd`.
 * The walk stops at the repository root (a directory containing `.git`) so a
 * project cannot inherit an unrelated file from above its checkout.
 * @param {string} cwd absolute working directory.
 * @returns {string | undefined} absolute file path.
 */
export function findWorkspaceFile(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return undefined
  let directory = resolve(cwd)
  for (;;) {
    for (const name of WORKSPACE_FILE_NAMES) {
      const candidate = join(directory, '.dsh', name)
      try {
        if (statSync(candidate).isFile()) return candidate
      } catch {
        // keep looking
      }
    }
    if (existsSync(join(directory, '.git'))) return undefined
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}

function existsSync(path) {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}

/**
 * Parse the supported subset of YAML: `dotted.key: value`, comments, blanks.
 * @param {string} text file contents.
 * @param {string} path file path, for messages.
 * @returns {{values: Record<string, string>, problems: string[]}}
 */
export function parseWorkspaceFile(text, path = '.dsh/egm.yaml') {
  const values = {}
  const problems = []
  const lines = String(text).split(/\r?\n/u)
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/\s+$/u, '')
    const where = `${path}:${index + 1}`
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (/^\s/u.test(line)) {
      problems.push(`${where}: nested blocks are not supported; use dotted keys on one line`)
      continue
    }
    if (line.trimStart().startsWith('-')) {
      problems.push(`${where}: lists are not supported; use dotted keys, one per line`)
      continue
    }
    const match = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/u.exec(line)
    if (match === null) {
      problems.push(`${where}: expected "key: value"`)
      continue
    }
    const key = match[1]
    let value = match[2]
    const comment = /\s#/u.exec(value)
    if (comment !== null) value = value.slice(0, comment.index)
    value = value.trim().replace(/^["']|["']$/gu, '')
    if (value === '') {
      problems.push(`${where}: ${key} has no value`)
      continue
    }
    values[key] = value
  }
  return { values, problems }
}

/**
 * Turn the flat key/value file into the same shape as the profile routing block.
 * @param {Record<string, string>} values parsed values.
 * @param {string} path file path, for messages.
 * @returns {{scope: object, problems: string[]}}
 */
export function workspaceScope(values, path = '.dsh/egm.yaml') {
  const scope = { elephant: null, workers: null, phases: {}, reviewers: {} }
  const problems = []
  const maxTokens = {}
  const knownRoles = new Set(['default', ...reviewerRoles()])

  const setRoute = (target, key, value, where) => {
    const parsed = parseRoute(value)
    if (parsed.problems.length > 0) {
      problems.push(`${where}: ${parsed.problems.join('; ')}`)
      return
    }
    target[key] = parsed.route
  }

  for (const [key, value] of Object.entries(values)) {
    const where = `${path}: ${key}`
    if (key === 'routing.elephant') setRoute(scope, 'elephant', value, where)
    else if (key === 'routing.workers') setRoute(scope, 'workers', value, where)
    else if (key === 'routing.reviewers.default') setRoute(scope.reviewers, 'default', value, where)
    else if (key.startsWith('routing.reviewers.')) {
      const role = normalizeRole(key.slice('routing.reviewers.'.length))
      if (role === undefined || !knownRoles.has(role)) problems.push(`${where}: unknown reviewer role`)
      else setRoute(scope.reviewers, role, value, where)
    } else if (key.startsWith('routing.phases.')) {
      const phase = key.slice('routing.phases.'.length).trim().toLowerCase()
      if (!PHASES.includes(phase)) problems.push(`${where}: unknown phase; known phases are ${PHASES.join(', ')}`)
      else setRoute(scope.phases, phase, value, where)
    } else if (key === 'maxTokens.policy') {
      if (['model-default', 'inherit', 'fixed'].includes(value)) maxTokens.policy = value
      else problems.push(`${where}: expected model-default, inherit or fixed`)
    } else if (key === 'maxTokens.fixed') {
      const number = Number(value)
      if (Number.isSafeInteger(number) && number > 0) maxTokens.fixed = number
      else problems.push(`${where}: expected a positive integer`)
    } else if (key.startsWith('routing.')) {
      problems.push(`${where}: unknown routing key`)
    } else {
      problems.push(`${where}: unknown key; supported keys are routing.*, maxTokens.policy and maxTokens.fixed`)
    }
  }
  return { scope: { ...scope, ...Object.keys(maxTokens).length > 0 ? { maxTokens } : {} }, problems }
}

/**
 * Read and cache one workspace file.
 * The cache key is the path plus its mtime and size, so an edit is picked up on
 * the next reviewer start without watching the filesystem.
 */
export class WorkspaceReader {
  #cache = new Map()

  /**
   * @param {string} cwd absolute working directory.
   * @returns {{path?: string, scope?: object, problems: string[], error?: string}}
   */
  read(cwd) {
    const path = findWorkspaceFile(cwd)
    if (path === undefined) return { problems: [] }
    let stats
    try {
      stats = statSync(path)
    } catch (error) {
      return { path, problems: [`${path}: cannot be read (${error?.code ?? 'error'})`] }
    }
    const cached = this.#cache.get(path)
    if (cached !== undefined && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) return cached.result
    let result
    try {
      const parsed = parseWorkspaceFile(readFileSync(path, 'utf8'), path)
      const scoped = workspaceScope(parsed.values, path)
      result = { path, scope: scoped.scope, problems: [...parsed.problems, ...scoped.problems] }
    } catch (error) {
      result = { path, problems: [`${path}: cannot be read (${error instanceof Error ? error.message : String(error)})`] }
    }
    this.#cache.set(path, { mtimeMs: stats.mtimeMs, size: stats.size, result })
    return result
  }

  /** Drop cached parses; used by tests and by `/egm doctor`. */
  clear() {
    this.#cache.clear()
  }
}

/** Render the workspace scope as the keys the file accepts (for the UI snippet). */
export function workspaceSnippet(scope) {
  if (scope === undefined || scope === null) return ''
  const lines = []
  if (scope.elephant !== undefined && scope.elephant !== null) lines.push(`routing.elephant: ${formatRoute(scope.elephant)}`)
  if (scope.workers !== undefined && scope.workers !== null) lines.push(`routing.workers: ${formatRoute(scope.workers)}`)
  for (const [phase, route] of Object.entries(scope.phases ?? {})) lines.push(`routing.phases.${phase}: ${formatRoute(live(route))}`)
  for (const [role, route] of Object.entries(scope.reviewers ?? {})) lines.push(`routing.reviewers.${role}: ${formatRoute(live(route))}`)
  if (scope.maxTokens?.policy !== undefined) lines.push(`maxTokens.policy: ${scope.maxTokens.policy}`)
  if (scope.maxTokens?.fixed !== undefined) lines.push(`maxTokens.fixed: ${scope.maxTokens.fixed}`)
  return lines.join('\n')
}
