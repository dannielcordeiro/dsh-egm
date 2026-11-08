/**
 * Host half of `@local/dsh-egm-ui`.
 *
 * The browser half does all the work: it reads the `egmRun` projection and calls
 * `/egm …` commands through the remote command channel. This module exists
 * because the Harness client loader discovers a package's `dsh.client` entry
 * through one active host row, and because it gives the profile a place to log
 * that the surfaces loaded.
 */

export const name = 'dsh-egm-ui'

/** The Web shell provides the client host; nothing else is required here. */
export const inject = []

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx owning plugin context.
 */
export function apply(ctx) {
  ctx.logger?.info?.('dsh-egm-ui: browser surfaces registered (chip, reviewer card, settings section)')
}
