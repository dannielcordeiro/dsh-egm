/**
 * Browser half of `@local/dsh-egm-ui`.
 *
 * Loaded by the Harness Web module loader as a lazy CommonJS module: React comes
 * from the shell's module table, no build step is involved, and nothing here
 * reaches the network directly — every read and write goes through the `/egm`
 * command the host owns, so the browser and the terminal share one source of
 * truth.
 *
 * One file on purpose: the client loader serves exactly one entry script per
 * package, so the sections below are the module boundaries (helpers, chip,
 * reviewer card, settings page) rather than separate files.
 *
 * Surfaces:
 *   - a composer chip with the phase, the routes and the children of this run,
 *     refreshed from `/egm report --json` while something is running;
 *   - a compact card for every `egm_reviewer` result;
 *   - an EGM page under Settings that explains where routes live and how to
 *     change them without leaving the keyboard.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-egm-ui',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = '@local/dsh-egm-ui'

    const CSS = `
.egm-chip{box-sizing:border-box;height:28px;padding:0 9px;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer;color:var(--dsw-alias-label-secondary)}
.egm-chip:hover:not(:disabled),.egm-chip[aria-expanded="true"]{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
.egm-chip[data-running="true"]{color:var(--dsw-alias-brand-primary)}
.egm-chip:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.egm-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary,#9ca3af)}
.egm-dot[data-running="true"]{background:var(--dsw-alias-brand-primary);animation:egm-pulse 1.6s ease-in-out infinite}
@keyframes egm-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.egm-pop{position:absolute;bottom:calc(100% + 8px);right:0;z-index:40;box-sizing:border-box;width:360px;max-height:60vh;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 8px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);font-size:13px;line-height:20px;text-align:left}
.egm-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600}
.egm-sub{color:var(--dsw-alias-label-secondary);font-size:12px}
.egm-section{display:flex;flex-direction:column;gap:4px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1)}
.egm-label{color:var(--dsw-alias-label-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.egm-row{display:flex;align-items:center;gap:8px;min-width:0}
.egm-row > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.egm-role{flex:none;width:104px;color:var(--dsw-alias-label-secondary)}
.egm-route{flex:1;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px}
.egm-src{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.egm-badge{flex:none;font-size:11px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
.egm-actions{display:flex;gap:6px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1)}
.egm-btn{box-sizing:border-box;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.egm-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.egm-btn.primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.egm-btn:disabled{opacity:.6;cursor:default}
.egm-error{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:12px}
.egm-empty{color:var(--dsw-alias-label-secondary);font-size:12px}
.egm-tool{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.egm-tool code{font-family:var(--dsw-font-mono,ui-monospace,monospace)}
.egm-page{display:flex;flex-direction:column;gap:14px;max-width:720px;font-size:13px;line-height:21px}
.egm-page h3{margin:0;font-size:15px}
.egm-page p{margin:0;color:var(--dsw-alias-label-secondary)}
.egm-page pre{margin:0;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px;overflow:auto}
.egm-page ol{margin:0;padding-left:18px;color:var(--dsw-alias-label-secondary)}
`

    const STAGE_IDS = ['5', '6', '7', '8', '9']

    const DICT = {
      en: {
        chipTitle: 'EGM run',
        label: 'EGM',
        phase: 'phase',
        noPhase: 'not started',
        elephant: 'Elephant',
        reviewers: 'Reviewers',
        running: 'running',
        none: 'no reviewer started yet',
        routes: 'Routes',
        artifacts: 'Artifacts',
        tokens: 'tokens',
        refresh: 'Refresh',
        doctor: 'Doctor',
        close: 'Close',
        open: 'Open',
        inherited: 'inherited',
        error: 'Could not read the run',
        settingsTitle: 'Elephant-Goldfish Model',
        settingsIntro: 'Routes decide which model each EGM role uses. Nothing is required: a role with no route inherits the session model, exactly as the upstream model expects.',
        settingsWhere: 'Where a route lives',
        settingsProfile: 'Profile: the `egm` row in your profile cordis.patch.yml, written by `/egm model set` and shown by `/egm routes`.',
        settingsWorkspace: 'Workspace: .dsh/egm.yaml in the project, versioned with the code and applied to whoever works there.',
        settingsTable: 'Routes are per role: the Elephant, a phase, or any reviewer persona (zoom_out, design_critic, comprehension, structural, style, implementation_readiness, codebase_details, inventive_catalyst).',
        settingsExample: 'Example .dsh/egm.yaml',
        settingsCommands: 'Day to day',
        settingsCmd1: '/egm status — the run, the routes in effect and the problems',
        settingsCmd2: '/egm model — pick a role, then a provider, model and effort',
        settingsCmd3: '/egm doctor — composition, credentials, delegation depth and files',
        settingsInSession: 'The composer chip shows the phase and the children; open it to see each reviewer\'s route and tokens.',
        stage: 'stage',
      },
      pt: {
        chipTitle: 'Run EGM',
        label: 'EGM',
        phase: 'fase',
        noPhase: 'não iniciada',
        elephant: 'Elefante',
        reviewers: 'Revisores',
        running: 'em execução',
        none: 'nenhum revisor iniciado ainda',
        routes: 'Rotas',
        artifacts: 'Artefatos',
        tokens: 'tokens',
        refresh: 'Atualizar',
        doctor: 'Doctor',
        close: 'Fechar',
        open: 'Abrir',
        inherited: 'herdada',
        error: 'Não foi possível ler a run',
        settingsTitle: 'Elephant-Goldfish Model',
        settingsIntro: 'As rotas decidem qual modelo cada papel do EGM usa. Nada é obrigatório: um papel sem rota herda o modelo da sessão, exatamente como o modelo upstream espera.',
        settingsWhere: 'Onde a rota mora',
        settingsProfile: 'Perfil: a linha `egm` do cordis.patch.yml do perfil, escrita por `/egm model set` e mostrada por `/egm routes`.',
        settingsWorkspace: 'Workspace: .dsh/egm.yaml no projeto, versionado com o código e aplicado a quem trabalhar nele.',
        settingsTable: 'As rotas são por papel: o Elefante, uma fase, ou qualquer persona de revisor (zoom_out, design_critic, comprehension, structural, style, implementation_readiness, codebase_details, inventive_catalyst).',
        settingsExample: 'Exemplo de .dsh/egm.yaml',
        settingsCommands: 'No dia a dia',
        settingsCmd1: '/egm status — a run, as rotas em vigor e os problemas',
        settingsCmd2: '/egm model — escolha um papel, depois provedor, modelo e effort',
        settingsCmd3: '/egm doctor — composição, credenciais, profundidade de delegação e arquivos',
        settingsInSession: 'O chip no compositor mostra a fase e os filhos; abra para ver a rota e os tokens de cada revisor.',
        stage: 'estágio',
      },
    }

    const EXAMPLE = [
      '# .dsh/egm.yaml — routes for this project',
      'routing.elephant: anthropic/claude-sonnet-5-5#high',
      'routing.reviewers.design_critic: anthropic/claude-sonnet-5-5#high',
      'routing.reviewers.default: ollama/lumi-4b',
      'maxTokens.policy: model-default',
    ].join('\n')

    // ---- helpers ------------------------------------------------------------

    /** Run one `/egm …` line in this session and return the parsed JSON payload. */
    async function runCommand(remote, sessionId, line) {
      const result = await remote.commands.execute(sessionId, line, [])
      if (!result.ok) throw new Error(result.error?.message ?? result.error?.code ?? 'command failed')
      const value = result.value?.result
      if (value === undefined) throw new Error('command returned nothing')
      if (value.kind === 'error') throw new Error(value.text)
      return value.text
    }

    async function runJson(remote, sessionId, line) {
      const text = await runCommand(remote, sessionId, line)
      try {
        return JSON.parse(text)
      } catch {
        throw new Error('the host returned a non-JSON payload')
      }
    }

    const STAGE_GLYPH = { done: '✓', running: '◐', idle: '·' }
    const STATUS_GLYPH = { settled: '✓', failed: '✗', running: '◐', started: '◐' }

    const ROLE_LABEL = {
      elephant: 'Elephant',
      worker: 'Worker',
      default: 'Any reviewer',
      review: 'Phase review',
      draft: 'Phase draft',
      brainstorm: 'Phase brainstorm',
      resolve: 'Phase resolve',
      bootstrap: 'Phase bootstrap',
      drift: 'Phase drift',
    }

    function roleLabel(role) {
      return ROLE_LABEL[role] ?? role
    }

    function shortRoute(route) {
      if (route === null || route === undefined) return 'inherit'
      const effort = route.reasoningEffort === undefined ? '' : `#${route.reasoningEffort}`
      return `${route.model}${effort}`
    }

    function tokenCount(child) {
      return (child.tokens?.input ?? 0) + (child.tokens?.output ?? 0)
    }

    // ---- chip ---------------------------------------------------------------

    function Chip({ t, run }) {
      const [open, setOpen] = useState(false)
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const wrapRef = useRef(null)
      const alive = useRef(true)
      const refresh = useRef(async () => {})

      useEffect(() => () => {
        alive.current = false
      }, [])

      const load = useCallback(async () => {
        try {
          const payload = await runJson(run.remote, run.sessionId, '/egm report --json')
          if (!alive.current) return
          setData(payload)
          setError(null)
        } catch (failure) {
          if (!alive.current) return
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }, [run.remote, run.sessionId])

      refresh.current = load

      useEffect(() => {
        void load()
        const timer = setInterval(() => {
          const busyNow = (data?.report?.children ?? []).some((child) => child.status === 'running')
          if (open || busyNow) void load()
        }, open ? 2500 : 8000)
        return () => clearInterval(timer)
      }, [load, open, data])

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

      const act = useCallback(async (line) => {
        setBusy(true)
        try {
          await runCommand(run.remote, run.sessionId, line)
          await load()
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        } finally {
          if (alive.current) setBusy(false)
        }
      }, [run.remote, run.sessionId, load])

      const report = data?.report
      const roles = data?.routes?.roles ?? []
      const children = report?.children ?? []
      const running = children.filter((child) => child.status === 'running').length
      const phase = report?.phase ?? null
      const elephant = roles.find((role) => role.role === 'elephant')
      const configured = roles.filter((role) => role.text !== 'inherit')

      return h('div', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center' } },
        h('style', null, CSS),
        h('button', {
          type: 'button',
          className: 'egm-chip',
          'data-running': running > 0,
          'aria-expanded': open,
          'aria-label': `${t('chipTitle')}: ${phase ?? t('noPhase')}`,
          title: `${t('chipTitle')} · ${phase ?? t('noPhase')} · ${elephant === undefined ? t('inherited') : shortRoute(elephant.route)}`,
          onClick: () => setOpen((value) => !value),
        },
          h('span', { className: 'egm-dot', 'data-running': running > 0, 'aria-hidden': true }),
          h('span', null, `${phase ?? 'EGM'}${running > 0 ? ` · ${running}` : ''}`)),
        open ? h('div', { className: 'egm-pop', role: 'dialog', 'aria-label': t('chipTitle') },
          h('div', { className: 'egm-head' },
            h('span', null, `🐘 ${t('chipTitle')}`),
            h('span', { className: 'egm-sub' }, phase === null ? t('noPhase') : `${t('phase')}: ${phase}`)),
          error === null ? null : h('div', { className: 'egm-error', role: 'alert' }, `${t('error')}: ${error}`),

          h('div', { className: 'egm-section' },
            h('div', { className: 'egm-label' }, t('elephant')),
            h('div', { className: 'egm-row' },
              h('span', { className: 'egm-route' }, elephant === undefined ? '—' : elephant.text),
              h('span', { className: 'egm-src' }, elephant?.source ?? t('inherited')))),
            configured.length === 0 ? null : h('div', { className: 'egm-label' }, `${t('routes')} (${configured.length})`),

          h('div', { className: 'egm-section' },
            h('div', { className: 'egm-label' }, t('reviewers')),
            children.length === 0 ? h('div', { className: 'egm-empty' }, t('none')) : null,
            ...children.slice(-8).map((child) => h('div', { className: 'egm-row', key: child.childId },
              h('span', { className: 'egm-role' }, `${STATUS_GLYPH[child.status] ?? '◐'} ${child.role ?? child.kind}`),
              h('span', { className: 'egm-route' }, child.routeKey ?? 'inherit'),
              h('span', { className: 'egm-src' }, `${tokenCount(child)} ${t('tokens')}`)))),
            children.length === 0 ? null : h('div', { className: 'egm-sub' },
              `${children.filter((child) => child.status === 'settled').length}/${children.length} ✓ · ${running} ${t('running')}`),

          (report?.artifacts ?? []).length === 0 ? null : h('div', { className: 'egm-section' },
            h('div', { className: 'egm-label' }, t('artifacts')),
            ...report.artifacts.slice(-4).map((artifact) => h('div', { className: 'egm-row', key: artifact.path },
              h('span', { className: 'egm-role' }, artifact.kind),
              h('span', { className: 'egm-route', title: artifact.path }, artifact.path.split('/').slice(-2).join('/'))))),

          h('div', { className: 'egm-row', style: { gap: '6px', flexWrap: 'wrap' } },
            ...STAGE_IDS.map((stage) => {
              const entry = (report?.stages ?? []).find((item) => item.stage === stage) ?? { status: 'idle', reviewers: 0 }
              return h('span', { className: 'egm-badge', key: stage, title: `${t('stage')} ${stage}: ${entry.status}` },
                `${STAGE_GLYPH[entry.status] ?? '·'} ${stage}${entry.reviewers === 0 ? '' : `·${entry.reviewers}`}`)
            })),

          (data?.workspace?.problems ?? []).length === 0 ? null : h('div', { className: 'egm-error' },
            ...data.workspace.problems.map((problem) => h('div', { key: problem }, problem))),

          h('div', { className: 'egm-actions' },
            h('button', { type: 'button', className: 'egm-btn primary', disabled: busy, onClick: () => void act('/egm doctor') }, t('doctor')),
            h('button', { type: 'button', className: 'egm-btn', disabled: busy, onClick: () => void load() }, t('refresh')),
            h('button', { type: 'button', className: 'egm-btn', onClick: () => setOpen(false) }, t('close'))))
          : null)
    }

    // ---- reviewer card ------------------------------------------------------

    function ReviewerCard({ phase, block }) {
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

    // ---- settings page ------------------------------------------------------

    function SettingsPage({ t }) {
      return h('div', { className: 'egm-page' },
        h('style', null, CSS),
        h('h3', null, t('settingsTitle')),
        h('p', null, t('settingsIntro')),
        h('h3', null, t('settingsWhere')),
        h('ol', null,
          h('li', null, t('settingsProfile')),
          h('li', null, t('settingsWorkspace'))),
        h('p', null, t('settingsTable')),
        h('h3', null, t('settingsExample')),
        h('pre', null, EXAMPLE),
        h('h3', null, t('settingsCommands')),
        h('ol', null,
          h('li', null, t('settingsCmd1')),
          h('li', null, t('settingsCmd2')),
          h('li', null, t('settingsCmd3'))),
        h('p', null, t('settingsInSession')))
    }

    function SettingsIcon() {
      return h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor', 'aria-hidden': true },
        h('path', { d: 'M4 5h16v2H4zm0 6h10v2H4zm0 6h7v2H4zm12.5-6.5 2.5 4.5h-5z' }))
    }

    return {
      inject: ['slots', 'remote', 'remote.commands', 'locale'],
      apply(ctx) {
        const disposeLocale = ctx.locale.register(NS, DICT)
        if (typeof disposeLocale === 'function') ctx.effect(() => disposeLocale)

        // Composer chip: the run at a glance, with the routes behind it.
        ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'egm-run',
          order: 25,
          locale: NS,
          label: () => 'EGM',
          inject: (sessionId) => ({ run: { remote: ctx.remote, sessionId } }),
        }, Chip))

        // Compact card for a reviewer activation.
        try {
          ctx.slots.register({
            name: 'tool.call.toolview',
            key: 'egm_reviewer',
            locale: NS,
          }, ReviewerCard)
        } catch (error) {
          console.warn(`dsh-egm-ui: reviewer card not registered: ${String(error?.message ?? error)}`)
        }

        // Settings page: where routes live and the commands that change them.
        try {
          ctx.slots.register({
            name: 'settings.section',
            id: 'egm',
            order: 60,
            locale: NS,
            label: () => 'EGM',
          }, SettingsPage)
          ctx.slots.register({
            name: 'settings.section.icon',
            id: 'egm',
          }, SettingsIcon)
        } catch (error) {
          console.warn(`dsh-egm-ui: settings section not registered: ${String(error?.message ?? error)}`)
        }
      },
    }
  },
})
