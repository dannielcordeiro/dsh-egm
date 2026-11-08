/**
 * Chat row for one `/egm …` command: the line, the outcome and the text.
 *
 * Without this renderer the web shows the command lifecycle with no body at all,
 * which is why `/egm doctor` looked like it did nothing.
 */
function EgmCommandRow({ ctx, t, sessionId, node }) {
  const command = node?.command ?? node
  if (command === null || command === undefined) return null
  const outcome = command.outcome
  const args = typeof command.args === 'string' ? command.args.trim() : ''
  const kind = outcome?.kind ?? 'running'
  return h('div', { className: 'egm-cmd' },
    h('style', null, CSS),
    h('div', { className: 'egm-cmd-head' },
      h('span', { className: 'egm-cmd-name' }, `/${command.name ?? 'egm'}`),
      args === '' ? null : h('span', { className: 'egm-cmd-args' }, args),
      h('span', { className: 'egm-cmd-tag', 'data-kind': kind }, kind === 'running' ? t('loading') : kind),
      h('button', {
        type: 'button',
        className: 'egm-btn',
        onClick: () => windowStore.openFor(sessionId, 'runs'),
      }, t('details'))),
    typeof outcome?.text === 'string' && outcome.text !== ''
      ? h('pre', { className: 'egm-cmd-body' }, outcome.text)
      : null)
}
