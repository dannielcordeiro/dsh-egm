/**
 * Composer chip: phase, running count, and the way into the window.
 *
 * It publishes what it sees to the window store, so the modal never has to guess
 * a session: this slot is the only composer surface that receives one.
 */
function EgmChip({ ctx, t, sessionId, useProjection }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const view = typeof useProjection === 'function' ? useProjection('egmRun') : undefined
  const catalog = typeof useProjection === 'function' ? useProjection('subagentCatalog') : undefined
  const sessions = useSessionSnapshot(ctx)
  const runs = useMemo(
    () => mergeChildren({ egmRun: view, catalogs: { [sessionId]: catalog }, sessions, rootSessionId: sessionId }),
    [view, catalog, sessions, sessionId],
  )
  const running = runs.filter((run) => run.status === 'running').length
  const phase = view?.phase ?? null

  useEffect(() => {
    if (sessionId === undefined) return
    windowStore.publish(sessionId, { view, runs })
  }, [sessionId, view, runs])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event) => {
      if (wrapRef.current !== null && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  const openWindow = () => {
    setOpen(false)
    windowStore.openFor(sessionId, 'runs')
  }

  const preview = runs.slice(-3).reverse()

  return h('div', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center' }, ref: wrapRef },
    h('style', null, CSS),
    h('button', {
      type: 'button',
      className: 'egm-chip',
      'data-running': running > 0,
      'aria-expanded': open,
      'aria-label': `${t('chipTitle')}: ${phase ?? t('noPhase')}`,
      title: `${t('chipTitle')} · ${t('phase')}: ${phase ?? t('noPhase')} · ${running} ${t('runsRunning')}`,
      onClick: () => setOpen((value) => !value),
    },
      h('span', { className: 'egm-dot', 'data-running': running > 0, 'aria-hidden': true }),
      h('span', null, `${phase ?? 'EGM'}${running > 0 ? ` · ${running}` : ''}`)),

    open ? h('div', { className: 'egm-pop', role: 'dialog', 'aria-label': t('chipTitle') },
      h('div', { className: 'egm-head' },
        h('span', null, `🐘 ${t('chipTitle')}`),
        h('span', { className: 'egm-sub' }, `${t('phase')}: ${phase ?? t('noPhase')}`)),
      typeof useProjection !== 'function' ? h('div', { className: 'egm-empty' }, t('noProjection')) : null,

      h('div', { className: 'egm-section' },
        h('div', { className: 'egm-label' }, t('elephant')),
        h('div', { className: 'egm-row' }, h('span', { className: 'egm-route' }, view?.elephantKey ?? t('inherited')))),

      h('div', { className: 'egm-section' },
        h('div', { className: 'egm-label' }, `${t('reviewers')}${runs.length === 0 ? '' : ` · ${runs.length}`}`),
        runs.length === 0 ? h('div', { className: 'egm-empty' }, t('none')) : null,
        ...preview.map((run) => {
          const status = STATUS[run.status] ?? STATUS.unknown
          return h('div', { className: 'egm-row', key: run.id },
            h('span', { className: 'egm-role' }, `${status.glyph} ${run.role ?? run.kind}`),
            h('span', { className: 'egm-route' }, run.route),
            h('span', { className: 'egm-src' }, formatTokens(run.tokens) === null ? '' : `${formatTokens(run.tokens)} ${t('tokens')}`))
        })),
      runs.length > 3 ? h('div', { className: 'egm-src' }, `+${runs.length - 3}`) : null,

      h('div', { className: 'egm-actions' },
        h('button', { type: 'button', className: 'egm-btn primary', onClick: openWindow }, t('details')),
        h('button', { type: 'button', className: 'egm-btn', onClick: () => setOpen(false) }, t('close'))))
      : null)
}
