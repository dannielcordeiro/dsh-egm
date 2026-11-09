/**
 * `@local/dsh-workflow-view` — host half.
 *
 * Registers one session projection that folds the lifecycle events the Harness
 * `workflow` tool already writes, so the browser tab can render runs, phases and
 * members without polling a command and without reading the log itself.
 */
import { PROJECTION_KEY, STATE_VERSION, applyEvent, createView, initState, stateSchema, viewSchema } from './projection.js'

export { PROJECTION_KEY, STATE_VERSION, applyEvent, createView, initState, stateSchema, viewSchema }

export const name = 'dsh-workflow-view'

/** The projection registry is the only hard requirement of this half. */
export const inject = ['sessionProjections']

/**
 * @param {object} ctx owning plugin context.
 * @param {{maxRuns?: number}} config row config.
 */
export function apply(ctx, config) {
  const maxRuns = Number.isSafeInteger(config?.maxRuns) && config.maxRuns > 0 ? config.maxRuns : 50
  ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateSchema,
    stateVersion: STATE_VERSION,
    init: () => initState(),
    apply: (state, event) => applyEvent(state, event),
    wire: {
      viewSchema,
      view: (state) => createView(state, { maxRuns }),
    },
  })
  ctx.logger?.info?.(`dsh-workflow-view: folding workflow runs (max ${maxRuns})`)
}
