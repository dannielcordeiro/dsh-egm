/**
 * Reviewer isolation.
 *
 * A Goldfish reviewer runs in the `egm-reviewer` preset, which composes only a
 * persona, read-only file tools, file search and compaction. That preset is the
 * first layer; this module adds the second and third:
 *
 *   1. hide every visible tool outside the read-only allowlist, so the model
 *      never sees a write, shell, job, schedule, goal, todo, question,
 *      presentation, delegation or session-reading tool;
 *   2. deny any call that is not allowlisted, which also covers a tool published
 *      later or scoped by another plugin after the child started.
 *
 * The guard restricts tool NAMES, not filesystem paths: a reviewer can read and
 * search whatever its tools reach. Reading lists and file boundaries in the
 * upstream skills are workflow instructions, not host allowlists.
 */

import { service } from './services.js'

/** Tool names a Goldfish reviewer may use. */
export const ALLOWED_TOOLS = Object.freeze([
  /^read$/u,
  /^read_image$/u,
  /^glob$/u,
  /^grep$/u,
  /^ops_read_files$/u,
  /^ops_read_pdf$/u,
  /^ops_read_docx$/u,
  /^ops_read_table$/u,
  /^ops_glob$/u,
  /^ops_grep$/u,
  /^ops_inspect_local_file$/u,
  /^ops_result$/u,
])

/** Refusal text a reviewer sees when it reaches for anything else. */
export const READ_ONLY_DENIED = (name) => `EGM Goldfish reviewers are read-only: the "${name}" tool is not available in this reviewer context.`

/**
 * Resolve the tool registry from either a registry (a test double, or a scope
 * handed one) or a Cordis context.
 *
 * Every property probe is guarded: on a Cordis context, touching a service it did
 * not inject throws instead of returning `undefined`.
 * @param {object} scope a tool registry, or a context that exposes one.
 */
function toolRegistryOf(scope) {
  try {
    if (scope !== null && typeof scope === 'object' && typeof scope.guard === 'function' && typeof scope.restrict === 'function') return scope
  } catch {
    // not a registry: fall through to the service lookup
  }
  return service(scope, 'tools')
}

/** Whether one tool name is allowed in a reviewer context. */
export function isAllowed(name) {
  return ALLOWED_TOOLS.some((pattern) => pattern.test(name))
}

/**
 * Hide every non-read-only tool this scope can see.
 *
 * A deny list is used rather than an allow list because it is measured from the
 * visible set: the names it denies always exist, even when a read-only tool is
 * absent from this composition.
 * @param {{schemas: () => Array<{name: string}>, restrict: (filter: {deny: string[]}) => () => void}} tools
 * @returns {() => void} disposer.
 */
export function hideNonReviewerTools(tools) {
  const denied = tools.schemas().map((schema) => schema.name).filter((name) => !isAllowed(name))
  return denied.length === 0 ? () => {} : tools.restrict({ deny: denied })
}

/**
 * Install the reviewer guard in an agent scope.
 * @param {object} ctx the reviewer's own plugin context, or its tool registry.
 * @returns {Array<() => void>} disposers, owned by the caller's effect.
 */
export function applyReviewerGuard(ctx) {
  const tools = toolRegistryOf(ctx)
  if (tools === undefined) throw new Error('the reviewer context exposes no tool registry')
  const disposers = []
  disposers.push(tools.guard((exec) => (isAllowed(exec.name) ? undefined : READ_ONLY_DENIED(exec.name))))
  disposers.push(hideNonReviewerTools(tools))
  return disposers
}
