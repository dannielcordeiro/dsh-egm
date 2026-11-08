/**
 * Phase routing, enforced by the host.
 *
 * The injected preamble asks the Elephant to call `egm_begin` at the start of a
 * phase, and that is the visible, documented path. A model may not follow it —
 * a small or local model often does not — so this module makes the phase route a
 * property of the session instead of a promise from the model: when the session
 * log shows an EGM skill starting, the host applies that phase's route itself.
 *
 * Both delivery shapes are recognised: the terminal mirrors user-invocable skills
 * into a command (`command/run` named `egm-review`), while the browser delivers
 * the skill body as a user message whose source is `skill-invocation`.
 */
import { applyPhaseRoute, cwdOf } from './reviewer.js'
import { service } from './services.js'

/** Skill name to phase. */
const PHASE_OF_SKILL = Object.freeze({
  'egm-brainstorm': 'brainstorm',
  'egm-draft': 'draft',
  'egm-review': 'review',
  'egm-review-loop': 'review',
  'egm-resolve': 'resolve',
  'egm-bootstrap': 'bootstrap',
  'egm-drift-report': 'drift',
})

/**
 * The phase a session event starts, if any.
 * @param {{type: string, data?: object}} event one committed session event.
 * @returns {string | undefined} the phase name.
 */
export function phaseFromEvent(event) {
  const data = event?.data ?? {}
  if (event?.type === 'command/run') {
    return PHASE_OF_SKILL[String(data.name ?? '').toLowerCase()]
  }
  if (event?.type === 'user/message') {
    const source = data.source ?? {}
    if (source.kind === 'skill-invocation' && typeof source.name === 'string') {
      return PHASE_OF_SKILL[source.name.toLowerCase()]
    }
    const text = Array.isArray(data.content)
      ? data.content.filter((block) => block?.type === 'text').map((block) => String(block.text ?? '')).join('')
      : ''
    const gesture = /^\s*\/(egm-[a-z-]+)/u.exec(text)
    if (gesture !== null) return PHASE_OF_SKILL[gesture[1]]
  }
  return undefined
}

/**
 * Watch the session log and apply the phase route when an EGM skill starts.
 * @param {import('@deepseek-ai/cordis').Context} ctx owning plugin context.
 * @param {object} deps plugin dependencies.
 */
export function installPhaseRouting(ctx, deps) {
  /** `${sessionId}:${phase}` already applied in this process. */
  const applied = new Set()

  ctx.effect(() => ctx.on('session/event', (session, event) => {
    const phase = phaseFromEvent(event)
    if (phase === undefined) return
    const sessionId = session?.id ?? session?.header?.id
    if (sessionId === undefined) return
    const key = `${sessionId}:${phase}`
    if (applied.has(key)) return
    applied.add(key)
    const agent = service(ctx, 'agents')?.get?.(sessionId)
    if (agent === undefined) return
    // Fire and forget: a listener must never delay the commit that produced it.
    void applyPhaseRoute(deps, { phase, agent, cwd: cwdOf(agent) }).then(
      (result) => {
        if (result.applied !== true) ctx.logger?.info?.(`dsh-egm: phase ${phase} kept the session model (${result.note ?? result.source})`)
      },
      (error) => ctx.logger?.warn?.(`dsh-egm: phase ${phase} routing failed: ${error instanceof Error ? error.message : String(error)}`),
    )
  }))
}
