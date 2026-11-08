/** Compact card for one reviewer activation, read from the tool result text. */
function EgmReviewerCard({ phase, block }) {
  if (phase !== 'result') return null
  const text = Array.isArray(block?.content)
    ? block.content.filter((part) => part?.type === 'text').map((part) => part.text).join('\n')
    : ''
  const match = /started read-only EGM reviewer ([0-9a-f-]{8,}) \(([^)]*)\)/u.exec(text)
  if (match === null) return null
  const detail = match[2] ?? ''
  const separator = detail.lastIndexOf(' on ')
  const role = separator === -1 ? detail : detail.slice(0, separator)
  const route = separator === -1 ? '' : detail.slice(separator + 4)
  return h('span', { className: 'egm-tool', title: text },
    h('span', null, '🐟'),
    h('code', null, role || 'reviewer'),
    route === '' ? null : h('span', { className: 'egm-src' }, route),
    h('span', { className: 'egm-src' }, match[1].slice(0, 8)))
}

/** Settings page: where routes live and the commands that change them. */
function EgmSettingsPage({ t }) {
  const example = [
    '# .dsh/egm.yaml — routes for this project',
    'routing.elephant: anthropic/claude-sonnet-5-5#high',
    'routing.reviewers.design_critic: anthropic/claude-sonnet-5-5#high',
    'routing.reviewers.default: ollama/lumi-4b',
    'maxTokens.policy: model-default',
  ].join('\n')
  return h('div', { className: 'egm-page' },
    h('style', null, CSS),
    h('h3', null, t('winTitle')),
    h('p', null, t('configIntro')),
    h('h3', null, t('tabConfig')),
    h('ol', null,
      h('li', null, 'Profile: the `egm` row in your profile cordis.patch.yml, written by `/egm model set` and shown by `/egm routes`.'),
      h('li', null, 'Workspace: .dsh/egm.yaml in the project, versioned with the code and applied to whoever works there.')),
    h('h3', null, '.dsh/egm.yaml'),
    h('pre', null, example),
    h('h3', null, t('tabDoctor')),
    h('p', null, t('doctorIntro')),
    h('p', null, t('typeForActions')))
}
