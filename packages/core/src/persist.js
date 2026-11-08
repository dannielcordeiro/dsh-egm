/**
 * Writing the profile layer.
 *
 * `/egm model set …` and the settings screens both go through here. The Harness
 * configuration editor owns the profile patch: it keeps comments and `!!js`
 * expressions, validates the result and rejects a write when a higher patch
 * layer overrides the same field. That is why this module never edits
 * `cordis.patch.yml` itself.
 */
import { PHASES } from './config.js'
import { reviewerRoles } from './personas.js'

/** Which routing key a role writes to. */
export function routingPath(role) {
  if (role === 'elephant') return ['elephant']
  if (role === 'worker') return ['workers']
  if (role === 'default') return ['reviewers', 'default']
  if (PHASES.includes(role)) return ['phases', role]
  if (reviewerRoles().includes(role)) return ['reviewers', role]
  return undefined
}

const NO_EDITOR = 'this profile has no configuration editor, so the profile layer cannot be written from here; add the route under `routing` in the `egm` row of cordis.patch.yml'

export class ProfileWriter {
  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx owning plugin context.
   */
  constructor(ctx) {
    this.ctx = ctx
    this.queue = Promise.resolve()
  }

  /** Whether a write is possible in this composition. */
  available() {
    return this.ctx.get('configEditor') !== undefined && this.ctx.fiber?.entry !== undefined
  }

  /**
   * Write one route into the profile layer.
   * @param {string} role canonical role id.
   * @param {{provider: string, model: string, reasoningEffort?: string, maxTokens?: number}} route
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  setRoute(role, route) {
    return this.#edit(role, (routing) => {
      const path = routingPath(role)
      if (path === undefined) return undefined
      if (path.length === 1) routing[path[0]] = sanitize(route)
      else {
        routing[path[0]] = { ...routing[path[0]] ?? {}, [path[1]]: sanitize(route) }
      }
      return routing
    })
  }

  /**
   * Remove one route from the profile layer.
   * @param {string} role canonical role id.
   */
  resetRoute(role) {
    return this.#edit(role, (routing) => {
      const path = routingPath(role)
      if (path === undefined) return undefined
      if (path.length === 1) routing[path[0]] = null
      else {
        const next = { ...routing[path[0]] ?? {} }
        delete next[path[1]]
        routing[path[0]] = next
      }
      return routing
    })
  }

  /** Serialise writes so two quick edits cannot lose one another. */
  #edit(role, mutate) {
    const editor = this.ctx.get('configEditor')
    const entry = this.ctx.fiber?.entry
    if (editor === undefined || entry === undefined) return Promise.resolve({ ok: false, reason: NO_EDITOR })
    if (routingPath(role) === undefined) return Promise.resolve({ ok: false, reason: `unknown role "${role}"` })
    const run = async () => {
      try {
        await editor.edit(entry, (current) => {
          const routing = { ...current?.routing ?? {} }
          const next = mutate(routing)
          if (next === undefined) return current
          return { ...current, routing: next }
        })
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) }
      }
    }
    const result = this.queue.then(run, run)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}

/** Keep only the fields a route owns, so an edit cannot smuggle anything else. */
function sanitize(route) {
  return {
    provider: route.provider,
    model: route.model,
    ...route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort },
    ...route.maxTokens === undefined ? {} : { maxTokens: route.maxTokens },
  }
}
