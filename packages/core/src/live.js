/**
 * Process-local facts about the children this plugin started.
 *
 * The session log records that a child exists and later that it settled, but it
 * does not carry the route the child started on, its live status or its token
 * usage. Those live only here, in the host process, and are folded into the
 * projection view when the surfaces ask for it.
 *
 * Nothing in this module writes to the session: the durable half of the story is
 * the projection, this is only the enrichment.
 */
import { routeKey } from './catalog.js'

export class LiveFacts {
  #children = new Map()
  #version = 0

  /** A child started by an EGM tool. */
  track(childId, facts) {
    this.#children.set(childId, {
      kind: facts.kind ?? 'reviewer',
      role: facts.role ?? null,
      stage: facts.stage ?? null,
      label: facts.label ?? null,
      route: facts.route ?? null,
      routeKey: facts.route === null || facts.route === undefined ? null : routeKey(facts.route),
      status: 'running',
      stopReason: null,
      startedAt: Date.now(),
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      steps: 0,
    })
    this.#touch()
  }

  /** The activation settled. */
  settle(childId, stopReason) {
    const child = this.#children.get(childId)
    if (child === undefined) return
    child.status = 'settled'
    child.stopReason = stopReason ?? null
    child.settledAt = Date.now()
    this.#touch()
  }

  /** The activation failed before a child was published. */
  fail(childId, reason) {
    const child = this.#children.get(childId)
    if (child === undefined) return
    child.status = 'failed'
    child.stopReason = 'error'
    child.error = reason ?? null
    this.#touch()
  }

  /** Whether a child id belongs to this plugin. */
  has(childId) {
    return this.#children.has(childId)
  }

  /** Facts for one child, or `undefined`. */
  get(childId) {
    return this.#children.get(childId)
  }

  /**
   * Fold one event from a child session.
   * @param {string} sessionId the child session id, which is the child id.
   * @param {{type: string, data?: object}} event one session event.
   */
  observeChildSession(sessionId, event) {
    const child = this.#children.get(sessionId)
    if (child === undefined) return
    const data = event?.data ?? {}
    switch (event?.type) {
      case 'request/header': {
        const config = data.header?.config
        if (config?.provider === undefined || config?.model === undefined) return
        child.route = {
          provider: String(config.provider),
          model: String(config.model),
          ...config.reasoningEffort === undefined || config.reasoningEffort === null ? {} : { reasoningEffort: String(config.reasoningEffort) },
        }
        child.routeKey = routeKey(child.route)
        this.#touch()
        return
      }
      case 'assistant/message': {
        // The Harness logs usage beside the message, not inside it.
        const usage = data.usage ?? data.message?.usage
        if (usage === undefined || usage === null) return
        child.tokens.input += usage.inputTokens ?? 0
        child.tokens.output += usage.outputTokens ?? 0
        child.tokens.cacheRead += usage.cacheReadTokens ?? 0
        child.tokens.cacheWrite += usage.cacheWriteTokens ?? 0
        this.#touch()
        return
      }
      case 'step/end': {
        child.steps += 1
        this.#touch()
        return
      }
      case 'turn/end': {
        const error = data.reason?.error ?? data.error
        if (error !== undefined) {
          child.status = 'failed'
          child.error = typeof error?.message === 'string' ? error.message : String(error)
          this.#touch()
        }
        return
      }
      default:
    }
  }

  /** Detached snapshot for a view build. */
  snapshot() {
    return {
      version: this.#version,
      children: Object.fromEntries([...this.#children].map(([id, child]) => [id, { ...child, tokens: { ...child.tokens } }])),
    }
  }

  /** Number of children currently running. */
  running() {
    let count = 0
    for (const child of this.#children.values()) if (child.status === 'running') count += 1
    return count
  }

  #touch() {
    this.#version += 1
  }
}
