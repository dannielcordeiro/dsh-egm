/**
 * Read-only guard, mounted inside the `egm-reviewer` preset.
 *
 * This is a plugin of its own because the guard needs the tool registry of the
 * reviewer's own scope, and a Cordis context only exposes a service it declared.
 * Mounted as a preset row, `inject: ['tools']` gives exactly that scope, which is
 * how the reviewer ends up unable to see, let alone call, anything outside the
 * read-only allowlist.
 *
 * The parent-side hook in `reviewer.js` stays as the second line of defence and
 * adds the default-route backstop, but the isolation itself belongs here.
 */
import { applyReviewerGuard } from './isolation.js'

export const name = 'dsh-egm-guard'

/** The reviewer scope must expose a tool registry before this activates. */
export const inject = ['tools']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx the reviewer's scope.
 */
export function apply(ctx) {
  for (const dispose of applyReviewerGuard(ctx)) {
    ctx.effect(() => dispose)
  }
}
