/** What the client half needs from the shell. */
const inject = ['slots', 'locale', 'remote', 'remote.commands']

/**
 * Register the surfaces.
 * @param {object} ctx client root context.
 */
function apply(ctx) {
  const disposeLocale = ctx.locale.register(NS, DICT)
  if (typeof disposeLocale === 'function') ctx.effect(() => disposeLocale)

  // The window is not a slot of its own: the chip portals it to the body, so it
  // cannot be lost to a slot the shell does not mount for third-party packages.

  // Composer chip: the only surface that knows the session, so it feeds the window.
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'egm-run',
    order: 25,
    locale: NS,
    label: () => 'EGM',
    inject: (sessionId) => ({ sessionId }),
  }, (props) => h(EgmChip, { ...props, ctx })))

  // Body of the `/egm …` row: without it the command text is invisible.
  try {
    ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
      name: 'conversation.chat.commandview',
      key: 'egm',
      locale: NS,
      inject: (sessionId) => ({ sessionId }),
    }, (props) => h(EgmCommandRow, { ...props, ctx })))
  } catch (error) {
    console.warn(`dsh-egm-ui: command row not registered: ${String(error?.message ?? error)}`)
  }

  // Compact card for a reviewer activation.
  try {
    ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'egm_reviewer',
      locale: NS,
    }, EgmReviewerCard)
  } catch (error) {
    console.warn(`dsh-egm-ui: reviewer card not registered: ${String(error?.message ?? error)}`)
  }

  // Settings page: where routes live and how to change them.
  try {
    ctx.slots.register({
      name: 'settings.section',
      id: 'egm',
      order: 60,
      locale: NS,
      label: () => 'EGM',
    }, EgmSettingsPage)
  } catch (error) {
    console.warn(`dsh-egm-ui: settings section not registered: ${String(error?.message ?? error)}`)
  }
}
