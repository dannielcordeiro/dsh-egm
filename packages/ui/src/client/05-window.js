/**
 * The EGM window: runs, configuration, artifacts and diagnostics in one modal.
 *
 * It is registered on `shell.overlay`, so it floats above the chat and can be
 * opened from any surface that knows the session. Live facts come from the
 * session store the chip publishes; the two command-backed tabs (configuration
 * and diagnostics) run a command only when the user clicks.
 */
/**
 * Keeps a defect in the window from tearing down the composer it portals from.
 * React class components are the only way to catch a render error.
 */
class EgmBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.warn(`dsh-egm-ui: the EGM window failed to render: ${String(error?.message ?? error)}`)
  }

  render() {
    if (this.state.error !== null) {
      return h('div', { className: 'egm-win', role: 'presentation' },
        h('style', null, CSS),
        h('div', { className: 'egm-win-box', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'egm-win-head' },
            h('span', { className: 'egm-win-title' }, '🐘 EGM'),
            h('button', { type: 'button', className: 'egm-btn egm-win-close', onClick: () => windowStore.close() }, this.props.t('close'))),
          h('div', { className: 'egm-win-body' },
            h('div', { className: 'egm-error', role: 'alert' }, String(this.state.error?.message ?? this.state.error)))))
    }
    return this.props.children
  }
}

function EgmWindow({ ctx, t }) {
  const state = useWindowState()
  const sessionId = state.sessionId
  const data = state.data
  const [routes, setRoutes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [doctor, setDoctor] = useState(null)
  const [catalogue, setCatalogue] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [stageFilter, setStageFilter] = useState('all')
  const boxRef = useRef(null)

  const close = useCallback(() => windowStore.close(), [])

  useEffect(() => {
    if (!state.open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    boxRef.current?.focus?.()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [state.open, close])

  const act = useCallback(async (line, apply) => {
    setBusy(true)
    setError(null)
    try {
      const text = await runEgmCommand(ctx, sessionId, line)
      if (apply !== undefined) apply(text)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }, [ctx, sessionId])

  const loadRoutes = useCallback(async () => {
    await act('/egm routes --json', (text) => setRoutes(parsePayload(text)))
  }, [act])

  useEffect(() => {
    if (!state.open || state.tab !== 'config' || routes !== null) return
    void loadRoutes()
  }, [state.open, state.tab, routes, loadRoutes])

  if (!state.open) return null

  const view = data?.view
  const runs = data?.runs ?? []
  const filtered = stageFilter === 'all' ? runs : runs.filter((run) => run.stage === stageFilter)
  const running = runs.filter((run) => run.status === 'running').length
  const phase = view?.phase ?? null
  const elephant = view?.elephantKey ?? null

  const tabs = [
    ['runs', t('tabRuns')],
    ['config', t('tabConfig')],
    ['artifacts', t('tabArtifacts')],
    ['doctor', t('tabDoctor')],
  ]

  let body = null
  if (state.tab === 'runs') {
    body = h(RunsTab, { t, runs: filtered, all: runs, phase, elephant, sessionId, stageFilter, setStageFilter, ctx })
  } else if (state.tab === 'config') {
    body = h(ConfigTab, { t, routes, drafts, setDrafts, busy, act, loadRoutes, catalogue, setCatalogue })
  } else if (state.tab === 'artifacts') {
    body = h(ArtifactsTab, { t, artifacts: view?.artifacts ?? [] })
  } else {
    body = h(DoctorTab, { t, doctor, busy, act, setDoctor })
  }

  return h('div', { className: 'egm-win', role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) close() } },
    h('style', null, CSS),
    h('div', {
      className: 'egm-win-box',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': t('winTitle'),
      tabIndex: -1,
      ref: boxRef,
    },
      h('div', { className: 'egm-win-head' },
        h('span', { className: 'egm-win-title' }, `🐘 ${t('winTitle')}`),
        h('span', { className: 'egm-win-meta' },
          `${t('phase')}: ${phase ?? t('noPhase')} · ${t('elephant')}: ${elephant ?? t('inherited')}`),
        running === 0 ? null : h('span', { className: 'egm-badge' }, `${running} ${t('runsRunning')}`),
        h('button', { type: 'button', className: 'egm-btn egm-win-close', onClick: close }, t('close'))),

      h('div', { className: 'egm-tabs', role: 'tablist' },
        ...tabs.map(([id, label]) => h('button', {
          key: id,
          type: 'button',
          role: 'tab',
          className: 'egm-tab',
          'aria-selected': state.tab === id,
          onClick: () => windowStore.setTab(id),
        }, label))),

      h('div', { className: 'egm-win-body', role: 'tabpanel' },
        error === null ? null : h('div', { className: 'egm-error', role: 'alert' }, error),
        body)))
}

/** Runs tab: the tree, its filters and the per-row actions. */
function RunsTab({ t, runs, all, phase, elephant, sessionId, stageFilter, setStageFilter, ctx }) {
  const stages = ['all', '5', '6', '7', '8', '9']
  return h(React.Fragment, null,
    h('div', { className: 'egm-filter' },
      h('span', { className: 'egm-label' }, t('stage')),
      ...stages.map((stage) => h('button', {
        key: stage,
        type: 'button',
        className: 'egm-btn' + (stageFilter === stage ? ' primary' : ''),
        onClick: () => setStageFilter(stage),
      }, stage === 'all' ? t('filterAll') : stage)),
      h('span', { className: 'egm-src' }, `${all.filter((run) => run.status === 'running').length} ${t('runsRunning')} · ${all.length}`)),
    runs.length === 0 ? h('div', { className: 'egm-empty' }, t('runsEmpty')) : null,
    ...runs.map((run) => {
      const status = STATUS[run.status] ?? STATUS.unknown
      const facts = [
        run.role ?? run.kind,
        run.stage === null ? null : `${t('stage')} ${run.stage}`,
        run.route,
        formatTokens(run.tokens) === null ? null : `${formatTokens(run.tokens)} ${t('tokens')}`,
        formatDuration(run.durationMs),
      ].filter((fact) => fact !== null && fact !== undefined).join(' · ')
      return h('div', { className: 'egm-run', key: run.id, 'data-depth': Math.min(run.depth, 3) },
        h('span', { className: 'egm-role', title: run.id }, `${status.glyph} ${run.label}`),
        h('span', { className: 'egm-run-main' },
          h('span', { className: 'egm-run-label' }, run.label),
          h('span', { className: 'egm-run-facts' }, facts)),
        h('span', { className: 'egm-run-actions' },
          h('button', {
            type: 'button',
            className: 'egm-btn',
            title: t('openSession'),
            onClick: () => {
              try {
                serviceOf(ctx, 'uiWorkspace')?.openSession?.({ parentSessionId: sessionId, childSessionId: run.id })
              } catch (failure) {
                console.warn(`dsh-egm-ui: could not open ${run.id}: ${String(failure?.message ?? failure)}`)
              }
            },
          }, t('open')),
          h('button', {
            type: 'button',
            className: 'egm-btn',
            title: t('openAside'),
            onClick: () => {
              try {
                serviceOf(ctx, 'sidebarRight')?.openResource?.(`dsh-resource://subagentchat/session/${encodeURIComponent(run.id)}?parent=${encodeURIComponent(sessionId ?? '')}`, { kind: 'subagentchat', preferNewPane: true })
              } catch (failure) {
                console.warn(`dsh-egm-ui: could not open ${run.id} aside: ${String(failure?.message ?? failure)}`)
              }
            },
          }, '⇥')))
    }))
}

/** Configuration tab: one row per role, edits sent as commands on click. */
function ConfigTab({ t, routes, drafts, setDrafts, busy, act, loadRoutes, catalogue, setCatalogue }) {
  if (routes === null) return h('div', { className: 'egm-empty' }, t('loading'))
  const roles = routes.roles ?? []
  const providerModels = catalogue?.models ?? []
  const draftOf = (role) => drafts[role] ?? ''
  const setDraft = (role, value) => setDrafts({ ...drafts, [role]: value })
  const apply = async (role, scope) => {
    const value = draftOf(role).trim()
    if (value === '') return
    await act(`/egm model set ${role} ${value}${scope === 'session' ? ' --session' : ''}`, () => {
      setDrafts({ ...drafts, [role]: '' })
      void loadRoutes()
    })
  }
  return h(React.Fragment, null,
    h('div', { className: 'egm-sub' }, t('configIntro')),
    h('div', { className: 'egm-filter' },
      h('button', {
        type: 'button',
        className: 'egm-btn',
        disabled: busy,
        onClick: () => void act('/egm catalogue --json', (text) => setCatalogue(parsePayload(text))),
      }, t('configLoad')),
      h('button', { type: 'button', className: 'egm-btn', disabled: busy, onClick: () => void loadRoutes() }, '↻')),
    h('div', { className: 'egm-label' }, t('routesTitle')),
    ...roles.map((role) => h('div', { key: role.role, className: 'egm-row', style: { gap: '6px' } },
      h('span', { className: 'egm-role', title: role.role }, role.role),
      h('input', {
        className: 'egm-input',
        value: role.text === 'inherit' ? draftOf(role.role) : draftOf(role.role) || role.text,
        placeholder: role.text === 'inherit' ? 'provider/model#effort' : role.text,
        onChange: (event) => setDraft(role.role, event.target.value),
        'aria-label': `${role.role} route`,
        list: providerModels.length === 0 ? undefined : 'egm-route-list',
      }),
      h('span', { className: 'egm-src', title: `${t('source')}: ${role.source}` }, role.text),
      h('button', { type: 'button', className: 'egm-btn primary', disabled: busy, onClick: () => void apply(role.role, 'profile') }, t('configApply')),
      h('button', { type: 'button', className: 'egm-btn', disabled: busy, onClick: () => void apply(role.role, 'session') }, t('configApplySession')),
      h('button', {
        type: 'button',
        className: 'egm-btn',
        disabled: busy,
        onClick: () => void act(`/egm model reset ${role.role}`, () => void loadRoutes()),
      }, t('configClear')),
      h('button', {
        type: 'button',
        className: 'egm-btn',
        disabled: busy,
        onClick: () => void act(`/egm model test ${role.role}`),
      }, t('configTest')))),
    providerModels.length === 0 ? null : h('datalist', { id: 'egm-route-list' },
      ...providerModels.map((model) => h('option', { key: model.key, value: model.key }))),
    routes.workspace?.path === null || routes.workspace === undefined ? null : h('div', { className: 'egm-sub' },
      `${routes.workspace.path}${(routes.workspace.problems ?? []).length === 0 ? '' : ` — ${routes.workspace.problems.join('; ')}`}`))
}

/** Artifacts tab: what the run wrote, with a copy action as the portable one. */
function ArtifactsTab({ t, artifacts }) {
  if (artifacts.length === 0) return h('div', { className: 'egm-empty' }, t('artifactsEmpty'))
  return h(React.Fragment, null,
    ...artifacts.map((artifact) => h('div', { className: 'egm-row', key: artifact.path },
      h('span', { className: 'egm-role' }, artifact.kind),
      h('span', { className: 'egm-route', title: artifact.path }, artifact.path),
      h('button', {
        type: 'button',
        className: 'egm-btn',
        onClick: () => {
          try {
            void navigator.clipboard?.writeText?.(artifact.path)
          } catch {
            // clipboard is optional; the path stays visible either way
          }
        },
      }, t('copyPath')))))
}

/** Diagnostics tab: the doctor report, read only when the button is pressed. */
function DoctorTab({ t, doctor, busy, act, setDoctor }) {
  return h(React.Fragment, null,
    h('div', { className: 'egm-sub' }, t('doctorIntro')),
    h('div', { className: 'egm-filter' },
      h('button', {
        type: 'button',
        className: 'egm-btn primary',
        disabled: busy,
        onClick: () => void act('/egm doctor', (text) => setDoctor(text)),
      }, t('doctorRun'))),
    doctor === null ? null : h('pre', { className: 'egm-pre' }, doctor))
}
