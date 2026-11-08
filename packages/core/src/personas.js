/**
 * The reviewer catalogue, read from the vendored upstream personas.
 *
 * A "role" is what the user configures a model for. It is the persona file stem
 * (`zoom_out`, `design_critic`, …), because that is exactly what the upstream
 * EGM skills name in their `Persona:` envelope and in `Reviewers:` lists. No
 * role list is hard-coded here beyond the aliases: adding an upstream persona
 * makes it configurable without touching this file.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Package root: `src/` is one level below it. */
export const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))
export const AGENTS_DIR = join(PACKAGE_ROOT, 'agents')

/**
 * Convenience spellings people actually type, mapped to the persona stem.
 * The stems themselves, `egm-<stem>` and the hyphenated form always work.
 */
const ROLE_ALIASES = Object.freeze({
  design: 'design_critic',
  critic: 'design_critic',
  'design-critic': 'design_critic',
  readiness: 'implementation_readiness',
  implementation: 'implementation_readiness',
  codebase: 'codebase_details',
  details: 'codebase_details',
  zoom: 'zoom_out',
  'zoom-out': 'zoom_out',
  inventive: 'inventive_catalyst',
  catalyst: 'inventive_catalyst',
  orchestrator: 'bootstrap_orchestrator',
  bootstrap: 'bootstrap_orchestrator',
  structure: 'structural',
  copy: 'style',
  editor: 'style',
  naive: 'comprehension',
  reader: 'comprehension',
  // The catch-all reviewer: people type all of these.
  reviewer: 'default',
  reviewers: 'default',
  'any-reviewer': 'default',
  any: 'default',
  todos: 'default',
  padrao: 'default',
})

/** Roles that are not personas: they name a phase or a non-reviewer actor. */
export const ACTOR_ROLES = Object.freeze(['elephant', 'worker', 'default'])

/**
 * The EGM phases a model can be configured for.
 *
 * Kept here, next to the role vocabulary, so `normalizeRole` recognises a phase
 * name: a configuration row for `resolve` used to be rejected as an unknown role.
 */
export const PHASE_ROLES = Object.freeze(['brainstorm', 'draft', 'review', 'resolve', 'bootstrap', 'drift'])

let cache

/** Parse the two frontmatter keys a persona needs. */
function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(source)
  const meta = {}
  if (match === null) return meta
  for (const line of match[1].split(/\r?\n/u)) {
    const pair = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/u.exec(line)
    if (pair === null) continue
    let value = pair[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[pair[1]] = value
  }
  return meta
}

/**
 * Load the persona catalogue once.
 * @returns {Map<string, {role: string, name: string, description: string, file: string, path: string}>}
 */
export function personas() {
  if (cache !== undefined) return cache
  const catalogue = new Map()
  for (const entry of readdirSync(AGENTS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const path = join(AGENTS_DIR, entry.name)
    const role = basename(entry.name, '.md')
    const meta = parseFrontmatter(readFileSync(path, 'utf8'))
    catalogue.set(role, {
      role,
      name: meta.name ?? `egm-${role.replaceAll('_', '-')}`,
      description: meta.description ?? '',
      file: entry.name,
      path,
    })
  }
  return (cache = catalogue)
}

/** Every configurable reviewer role, in a stable order. */
export function reviewerRoles() {
  return [...personas().keys()].sort()
}

/**
 * Normalise a user-supplied role spelling to a persona stem, or to one of the
 * actor roles. Returns `undefined` when the value names nothing at all.
 * @param {string} value role as typed or as named by the upstream text.
 */
export function normalizeRole(value) {
  if (typeof value !== 'string') return undefined
  const raw = value.trim().toLowerCase()
  if (raw === '') return undefined
  if (ACTOR_ROLES.includes(raw)) return raw
  if (PHASE_ROLES.includes(raw)) return raw
  const hyphenated = raw.replaceAll('_', '-')
  const candidates = [raw, hyphenated]
  for (const candidate of candidates) {
    const stripped = candidate.startsWith('egm-') ? candidate.slice(4) : candidate
    if (ROLE_ALIASES[stripped] !== undefined) return ROLE_ALIASES[stripped]
    for (const role of personas().keys()) {
      if (role === stripped || role.replaceAll('_', '-') === stripped) return role
    }
  }
  return undefined
}

/**
 * Role named by an upstream `Persona:` line. The envelope names an absolute
 * path (`…/agents/zoom_out.md`), but a bare persona name is accepted too.
 * @param {string} prompt reviewer prompt text.
 */
export function roleFromPrompt(prompt) {
  if (typeof prompt !== 'string') return undefined
  const match = /^\s*Persona:\s*(\S+)\s*$/mu.exec(prompt)
  if (match === null) return undefined
  const value = match[1].replace(/^["'`]|["'`]$/gu, '')
  const fromFile = basename(value).replace(/\.md$/u, '')
  return normalizeRole(fromFile) ?? normalizeRole(value)
}

/**
 * Persona metadata for a role, or `undefined` for actor roles.
 * @param {string} role canonical role id.
 */
export function persona(role) {
  return personas().get(role)
}
