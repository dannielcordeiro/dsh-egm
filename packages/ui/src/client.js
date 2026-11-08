/**
 * Browser half of `@local/dsh-egm-ui` — GENERATED FILE, do not edit.
 *
 * Built from `packages/ui/src/client/*.js` by `scripts/bundle-client.mjs`
 * (`npm run build:client`). The Harness Web module loader serves one script per
 * package, so the parts are concatenated into one closure instead of imported.
 *
 * Surfaces: the EGM window (runs, configuration, artifacts, diagnostics), the
 * composer chip that opens it, the `/egm` command row, the reviewer card and the
 * settings page. The client never polls: every command it runs is a click.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-egm-ui',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    // ---- 01-css.js ---------------------------------------------------------
    /** Styles for every surface this package draws. Theme tokens only. */
    const CSS = `
    .egm-chip{box-sizing:border-box;height:28px;padding:0 9px;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer;color:var(--dsw-alias-label-secondary)}
    .egm-chip:hover:not(:disabled),.egm-chip[aria-expanded="true"]{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
    .egm-chip[data-running="true"]{color:var(--dsw-alias-brand-primary)}
    .egm-chip:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
    .egm-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary,#9ca3af)}
    .egm-dot[data-running="true"]{background:var(--dsw-alias-brand-primary);animation:egm-pulse 1.6s ease-in-out infinite}
    @keyframes egm-pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .egm-pop{position:absolute;bottom:calc(100% + 8px);right:0;z-index:40;box-sizing:border-box;width:380px;max-height:60vh;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 8px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);font-size:13px;line-height:20px;text-align:left}
    .egm-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:600}
    .egm-sub{color:var(--dsw-alias-label-secondary);font-size:12px}
    .egm-section{display:flex;flex-direction:column;gap:4px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1)}
    .egm-label{color:var(--dsw-alias-label-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
    .egm-row{display:flex;align-items:center;gap:8px;min-width:0}
    .egm-row > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .egm-role{flex:none;width:118px;color:var(--dsw-alias-label-secondary)}
    .egm-route{flex:1;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px}
    .egm-src{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
    .egm-badge{flex:none;font-size:11px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
    .egm-actions{display:flex;gap:6px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1);align-items:center;flex-wrap:wrap}
    .egm-btn{box-sizing:border-box;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
    .egm-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .egm-btn.primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
    .egm-btn:disabled{opacity:.6;cursor:default}
    .egm-error{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:12px}
    .egm-empty{color:var(--dsw-alias-label-secondary);font-size:12px}
    .egm-tool{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
    .egm-tool code{font-family:var(--dsw-font-mono,ui-monospace,monospace)}
    .egm-cmd{display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:20px}
    .egm-cmd-head{display:flex;align-items:center;gap:8px;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px;flex-wrap:wrap}
    .egm-cmd-name{color:var(--dsw-alias-label-primary)}
    .egm-cmd-args{color:var(--dsw-alias-label-secondary)}
    .egm-cmd-tag{font-size:11px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-secondary)}
    .egm-cmd-tag[data-kind="error"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 14%,transparent);color:var(--dsw-alias-state-error-primary,#dc2626)}
    .egm-cmd-tag[data-kind="success"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary)}
    .egm-cmd-body,.egm-pre{margin:0;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}
    .egm-win{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 32%,transparent)}
    .egm-win-box{box-sizing:border-box;width:min(760px,100%);height:min(80vh,720px);display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 16px 48px color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent);overflow:hidden;font-size:13px;line-height:20px}
    .egm-win-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
    .egm-win-title{font-weight:600;font-size:14px}
    .egm-win-meta{color:var(--dsw-alias-label-secondary);font-size:12px}
    .egm-win-close{margin-left:auto}
    .egm-tabs{display:flex;gap:4px;padding:8px 16px 0;border-bottom:.5px solid var(--dsw-alias-border-l1)}
    .egm-tab{border:none;background:transparent;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);padding:6px 10px;border-radius:var(--dsw-radius-sm,6px) var(--dsw-radius-sm,6px) 0 0;cursor:pointer}
    .egm-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
    .egm-tab:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
    .egm-win-body{flex:1;min-height:0;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
    .egm-run{display:flex;align-items:center;gap:8px;min-width:0;padding:4px 0}
    .egm-run[data-depth="1"]{padding-left:18px}
    .egm-run[data-depth="2"]{padding-left:36px}
    .egm-run[data-depth="3"]{padding-left:54px}
    .egm-run-role{flex:none;width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .egm-run-main{flex:1;min-width:0;display:flex;flex-direction:column}
    .egm-run-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .egm-run-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums}
    .egm-run-actions{flex:none;display:flex;gap:4px}
    .egm-input{box-sizing:border-box;height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-family:var(--dsw-font-mono,ui-monospace,monospace);flex:1;min-width:0}
    .egm-input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
    .egm-filter{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .egm-page{display:flex;flex-direction:column;gap:14px;max-width:720px;font-size:13px;line-height:21px}
    .egm-page h3{margin:0;font-size:15px}
    .egm-page p{margin:0;color:var(--dsw-alias-label-secondary)}
    .egm-page pre{margin:0;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1);font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12px;overflow:auto}
    .egm-page ol{margin:0;padding-left:18px;color:var(--dsw-alias-label-secondary)}
    `

    // ---- 02-i18n.js --------------------------------------------------------
    /** Locale namespace and dictionaries. Every key must exist in both languages. */
    const NS = '@local/dsh-egm-ui'

    const DICT = {
      en: {
        label: 'EGM',
        chipTitle: 'EGM run',
        phase: 'phase',
        noPhase: 'not started',
        elephant: 'Elephant',
        reviewers: 'Reviewers',
        running: 'running',
        none: 'no reviewer started yet',
        artifacts: 'Artifacts',
        tokens: 'tokens',
        close: 'Close',
        details: 'Details',
        open: 'Open',
        inherited: 'inherited',
        noProjection: 'This session publishes no EGM run projection.',
        typeForActions: 'Use /egm in the composer to change anything.',
        winTitle: 'Elephant-Goldfish Model',
        tabRuns: 'Runs',
        tabConfig: 'Configuration',
        tabArtifacts: 'Artifacts',
        tabDoctor: 'Diagnostics',
        runsEmpty: 'No reviewer has run in this session yet. Start one with /egm-review or /egm-brainstorm.',
        runsRunning: 'running',
        stage: 'stage',
        openSession: 'Open session',
        openAside: 'Open beside',
        filterAll: 'All',
        configIntro: 'Each role may use its own provider, model and effort. Empty means "inherit the session model".',
        configLoad: 'Load catalog',
        configApply: 'Apply to profile',
        configApplySession: 'This session',
        configClear: 'Clear',
        configTest: 'Test',
        source: 'source',
        artifactsEmpty: 'No EGM artifact in this session.',
        copyPath: 'Copy path',
        doctorRun: 'Run doctor',
        doctorIntro: 'Checks the composition, the reviewer preset, the spawn provider, delegation depth, provider credentials, the workspace file and every configured route.',
        routesTitle: 'Routes in effect',
        loading: 'loading…',
        failed: 'failed',
        settled: 'finished',
        unknown: 'unknown',
      },
      pt: {
        label: 'EGM',
        chipTitle: 'Run EGM',
        phase: 'fase',
        noPhase: 'não iniciada',
        elephant: 'Elefante',
        reviewers: 'Revisores',
        running: 'em execução',
        none: 'nenhum revisor iniciado ainda',
        artifacts: 'Artefatos',
        tokens: 'tokens',
        close: 'Fechar',
        details: 'Ver detalhes',
        open: 'Abrir',
        inherited: 'herdada',
        noProjection: 'Esta sessão não publica a projeção da run EGM.',
        typeForActions: 'Use /egm no compositor para alterar algo.',
        winTitle: 'Elephant-Goldfish Model',
        tabRuns: 'Execuções',
        tabConfig: 'Configuração',
        tabArtifacts: 'Artefatos',
        tabDoctor: 'Diagnóstico',
        runsEmpty: 'Nenhum revisor rodou nesta sessão ainda. Comece com /egm-review ou /egm-brainstorm.',
        runsRunning: 'em execução',
        stage: 'estágio',
        openSession: 'Abrir sessão',
        openAside: 'Abrir ao lado',
        filterAll: 'Todos',
        configIntro: 'Cada papel pode usar provedor, modelo e effort próprios. Vazio significa "herdar o modelo da sessão".',
        configLoad: 'Carregar catálogo',
        configApply: 'Aplicar no perfil',
        configApplySession: 'Nesta sessão',
        configClear: 'Limpar',
        configTest: 'Testar',
        source: 'origem',
        artifactsEmpty: 'Nenhum artefato EGM nesta sessão.',
        copyPath: 'Copiar caminho',
        doctorRun: 'Rodar doctor',
        doctorIntro: 'Verifica a composição, o preset do revisor, o provedor de spawn, a profundidade de delegação, credenciais dos provedores, o arquivo de workspace e cada rota configurada.',
        routesTitle: 'Rotas em vigor',
        loading: 'carregando…',
        failed: 'falhou',
        settled: 'concluído',
        unknown: 'desconhecido',
      },
    }

    // ---- 03-runs.js --------------------------------------------------------
    /**
     * Pure run aggregation: three independent sources become one tree.
     *
     *   egmRun            our durable fold: role, stage, kind, artifact, route
     *   subagentCatalog   the host's own child catalog: label and the route the
     *                     child was created with
     *   sessions          the client store: live `running`, timing and token usage
     *
     * None of the three is sufficient alone: a child started by the generic
     * `subagent` tool has no role in our fold, a running child has no status in the
     * log, and a cold session has no catalog. Merging them by id is what stops the
     * window from claiming "not started" while a reviewer is working.
     */

    /** How many levels of grandchildren the tree shows. */
    const MAX_DEPTH = 3

    /** Glyph and label per status. */
    const STATUS = {
      running: { glyph: '◐', tone: 'accent' },
      settled: { glyph: '✓', tone: 'dim' },
      failed: { glyph: '✗', tone: 'error' },
      unknown: { glyph: '·', tone: 'dim' },
    }

    /**
     * Derive the status of one child.
     * The live `running` flag wins; then the child's own timing projection; then the
     * durable status our fold recorded; otherwise `unknown`, which is honest about
     * not knowing rather than pretending the child never started.
     * @param {{running?: boolean, timing?: object, durable?: string}} input
     * @returns {'running'|'settled'|'failed'|'unknown'}
     */
    function statusOf({ running, timing, durable }) {
      if (running === true || timing?.active !== undefined) return 'running'
      if (durable === 'failed') return 'failed'
      if (timing?.lastTurnCompleted === true) return 'settled'
      if (durable === 'settled') return 'settled'
      if (durable === 'started') return 'settled'
      return 'unknown'
    }

    /** Compact token count: `980`, `12.4k`, `1.3M`. */
    function formatTokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
      if (value < 1000) return String(Math.round(value))
      if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
      return `${(value / 1_000_000).toFixed(1)}M`
    }

    /** Compact duration: `8s`, `1m02s`, `1h04m`. */
    function formatDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null
      const seconds = Math.round(ms / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
      return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
    }

    /** Sum the four buckets of a token-usage projection. */
    function tokensOf(projection) {
      const totals = projection?.totals ?? projection
      if (totals === undefined || totals === null) return null
      const sum = (totals.uncachedInputTokens ?? 0) + (totals.outputTokens ?? 0)
      return sum > 0 ? sum : null
    }

    /** Elapsed milliseconds from a timing projection. */
    function durationOf(timing) {
      if (timing === undefined || timing === null) return null
      const settled = typeof timing.settledMs === 'number' ? timing.settledMs : 0
      const active = timing.active
      if (active !== undefined && active.through !== undefined) return settled + Math.max(0, active.through - active.since)
      return settled > 0 ? settled : null
    }

    /**
     * Route text for one child: the catalog's creation route when it has one, else
     * the route our fold recorded, else `inherit`.
     */
    function routeTextOf(catalogEntry, durableRouteKey) {
      if (catalogEntry?.agentProvider !== undefined && catalogEntry?.agentModel !== undefined) {
        const effort = catalogEntry.agentReasoningEffort
        return `${catalogEntry.agentProvider}/${catalogEntry.agentModel}${effort === undefined || effort === null ? '' : `#${effort}`}`
      }
      if (typeof durableRouteKey === 'string' && durableRouteKey !== '') return durableRouteKey
      return 'inherit'
    }

    /**
     * Build the `/egm model set` line for one role row.
     *
     * The row is an object, so interpolating it directly produced
     * `/egm model set [object Object] …` and the host answered "unknown role".
     * @param {string|{role: string}} role role name or row.
     * @param {string} value route text as typed.
     * @param {'profile'|'session'} [scope] where to write.
     */
    function routeCommand(role, value, scope) {
      const name = typeof role === 'string' ? role : role?.role
      if (typeof name !== 'string' || name === '') throw new Error('a role name is required')
      const route = String(value ?? '').trim()
      if (route === '') throw new Error('a route is required')
      return `/egm model set ${name} ${route}${scope === 'session' ? ' --session' : ''}`
    }

    /**
     * Build the `/egm model test` line for one row.
     *
     * When the field holds a route (it contains a slash) the test targets that exact
     * route, so a value can be checked before it is written; otherwise it tests
     * whatever the role resolves to now.
     * @param {string|{role: string}} role role name or row.
     * @param {string} [value] route text currently shown in the row.
     */
    function testCommand(role, value) {
      const name = typeof role === 'string' ? role : role?.role
      if (typeof name !== 'string' || name === '') throw new Error('a role name is required')
      const route = String(value ?? '').trim()
      return route.includes('/') ? `/egm model test ${route}` : `/egm model test ${name}`
    }

    /**
     * Decide what an Apply click does for one row.
     *
     * The field shows the effective route until the user types over it, so an
     * untouched row still applies what the screen shows. A row with nothing to apply
     * returns a reason instead of doing nothing silently.
     * @param {{role: string, text: string}} entry the route row.
     * @param {string|undefined} draft what the user typed, if anything.
     * @param {'profile'|'session'} [scope] where to write.
     * @returns {{command: string}|{error: string}}
     */
    function applyPlan(entry, draft, scope) {
      const typed = String(draft ?? '').trim()
      const value = typed !== '' ? typed : (entry?.text === 'inherit' ? '' : String(entry?.text ?? '').trim())
      if (value === '') return { error: 'a route is required: type provider/model#effort' }
      try {
        return { command: routeCommand(entry, value, scope) }
      } catch (failure) {
        return { error: failure instanceof Error ? failure.message : String(failure) }
      }
    }

    /** Display name for the merge, used by the tests and the window. */
    const buildRuns = mergeChildren

    /** Entries of one catalog, tolerating a missing or malformed snapshot. */
    function catalogOf(catalogs, sessionId) {
      const entries = catalogs?.[sessionId]
      return Array.isArray(entries) ? entries : []
    }

    /**
     * Merge the three sources into one tree of rows.
     * @param {object} input
     * @param {object|undefined} input.egmRun our durable view.
     * @param {Record<string, object[]>} [input.catalogs] catalog entries by parent session id.
     * @param {object|undefined} input.sessions the client session store snapshot (`byId`).
     * @param {string} [input.rootSessionId] the session the window belongs to.
     * @param {number} [input.maxDepth] levels of descendants to show.
     * @returns {Array<object>} rows in display order.
     */
    function mergeChildren({ egmRun, catalogs = {}, sessions, rootSessionId, maxDepth = MAX_DEPTH }) {
      const byId = sessions?.byId ?? {}
      const durable = new Map()
      for (const child of egmRun?.children ?? []) durable.set(child.childId, child)

      const rows = []
      const seen = new Set()
      const walk = (parentId, depth) => {
        if (depth > maxDepth) return
        const ids = []
        const push = (id) => {
          if (typeof id !== 'string' || id === '' || ids.includes(id)) return
          ids.push(id)
        }
        for (const entry of catalogOf(catalogs, parentId)) push(entry.id)
        for (const [id, child] of durable) {
          if (child.kind === 'subagent' && depth === 0) push(id)
          else if (depth > 0) push(id)
        }
        for (const [id, summary] of Object.entries(byId)) {
          if (summary?.parentSessionId === parentId || summary?.parentSession === parentId) push(id)
        }
        for (const id of ids) {
          if (seen.has(id)) continue
          seen.add(id)
          const entry = catalogOf(catalogs, parentId).find((candidate) => candidate.id === id)
          const summary = byId[id]
          const child = durable.get(id)
          const timing = summary?.projectionValues?.subagentTiming
          const tokens = tokensOf(summary?.projectionValues?.tokenUsage)
          const duration = durationOf(timing)
          rows.push({
            id,
            parentId,
            depth,
            label: entry?.label ?? child?.label ?? summary?.projectionValues?.subagent?.label ?? id.slice(0, 8),
            role: child?.role ?? null,
            kind: child?.kind ?? (entry === undefined ? 'session' : 'subagent'),
            stage: child?.stage ?? null,
            route: routeTextOf(entry, child?.routeKey),
            status: statusOf({ running: summary?.running, timing, durable: child?.status }),
            tokens,
            durationMs: duration,
            startedAt: entry?.createdAt ?? child?.startedAt ?? null,
          })
          walk(id, depth + 1)
        }
      }
      walk(rootSessionId, 0)
      return rows
    }

    // ---- 04-store.js -------------------------------------------------------
    /**
     * One tiny client store for the window: who opened it, which tab, and the latest
     * run data the chip observed.
     *
     * The window lives in `shell.overlay` (root scope) and therefore receives none of
     * the session props the composer slots get. Rather than guessing a session, the
     * chip — which does receive them — publishes what it sees here.
     */
    const windowStore = (() => {
      let state = { sessionId: undefined, open: false, tab: 'runs', data: null }
      const listeners = new Set()
      const commit = (next) => {
        state = next
        for (const listener of [...listeners]) listener()
      }
      return {
        get: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        publish(sessionId, data) {
          if (state.sessionId !== sessionId || state.data !== data) commit({ ...state, sessionId, data })
        },
        /**
         * Open the window for a session.
         * A surface that has no session of its own (the chat row, whose slot may omit
         * it) falls back to the session the chip published last.
         */
        openFor(sessionId, tab = 'runs') {
          const target = sessionId ?? state.sessionId
          if (target === undefined) return false
          commit({ ...state, sessionId: target, open: true, tab })
          return true
        },
        setTab(tab) {
          commit({ ...state, tab })
        },
        close() {
          commit({ ...state, open: false })
        },
      }
    })()

    /**
     * Resolve an optional client service without declaring it in `inject`.
     *
     * Touching a service property this plugin did not inject throws in Cordis, so
     * every optional surface is read through `ctx.get` first and the property second,
     * inside a guard: a shell that composes less must not break the whole bundle.
     */
    function serviceOf(ctx, name) {
      if (ctx === undefined) return undefined
      try {
        const found = typeof ctx.get === 'function' ? ctx.get(name) : undefined
        if (found !== undefined) return found
      } catch {
        // fall through to the property
      }
      try {
        return ctx[name]
      } catch {
        return undefined
      }
    }

    const useWindowState = () => useSyncExternalStore(windowStore.subscribe, windowStore.get, windowStore.get)

    /**
     * Subscribe to the client session store when the shell composes one.
     * @returns {object|undefined} the store snapshot (`byId`, ...).
     */
    function useSessionSnapshot(ctx) {
      const store = serviceOf(ctx, 'sessions')?.list
      const subscribe = useCallback((listener) => (typeof store?.subscribe === 'function' ? store.subscribe(listener) : () => {}), [store])
      const getSnapshot = useCallback(() => (typeof store?.getSnapshot === 'function' ? store.getSnapshot() : undefined), [store])
      return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    }

    /**
     * Run one `/egm …` line and return its text.
     * Called only from an explicit user action: a command result is appended to the
     * session transcript, so this must never be reached by a timer or a render.
     */
    async function runEgmCommand(ctx, sessionId, line) {
      if (sessionId === undefined) throw new Error('no session to address')
      const result = await ctx.remote.commands.execute(sessionId, line, [])
      if (!result.ok) throw new Error(result.error?.message ?? result.error?.code ?? 'command failed')
      const value = result.value?.result
      if (value === undefined) throw new Error('the host returned no result')
      if (value.kind === 'error') throw new Error(value.text)
      return value.text
    }

    /** Parse a JSON payload a command returned, with a readable failure. */
    function parsePayload(text) {
      try {
        return JSON.parse(text)
      } catch {
        throw new Error('the host returned a non-JSON payload')
      }
    }

    // ---- 05-window.js ------------------------------------------------------
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
        body = h(ConfigTab, { t, routes, drafts, setDrafts, busy, act, loadRoutes, catalogue, setCatalogue, onError: setError })
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
    function ConfigTab({ t, routes, drafts, setDrafts, busy, act, loadRoutes, catalogue, setCatalogue, onError }) {
      if (routes === null) return h('div', { className: 'egm-empty' }, t('loading'))
      const roles = routes.roles ?? []
      const providerModels = catalogue?.models ?? []
      // The field shows the effective route until the user types over it, so an
      // Apply on an untouched row sends what the screen shows instead of nothing.
      const draftOf = (role) => drafts[role] ?? ''
      const visibleOf = (entry) => draftOf(entry.role) || (entry.text === 'inherit' ? '' : entry.text)
      const setDraft = (role, value) => setDrafts({ ...drafts, [role]: value })
      const apply = async (entry, scope) => {
        const plan = applyPlan(entry, visibleOf(entry), scope)
        if (plan.error !== undefined) {
          onError(plan.error)
          return
        }
        await act(plan.command, () => {
          setDrafts({ ...drafts, [entry.role]: '' })
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
            value: visibleOf(role),
            placeholder: 'provider/model#effort',
            title: visibleOf(role) === '' ? t('inherited') : visibleOf(role),
            onChange: (event) => setDraft(role.role, event.target.value),
            'aria-label': `${role.role} route`,
            list: providerModels.length === 0 ? undefined : 'egm-route-list',
          }),
          h('span', { className: 'egm-src', title: `${t('source')}: ${role.source}` }, role.text),
          h('button', { type: 'button', className: 'egm-btn primary', disabled: busy, onClick: () => void apply(role, 'profile').catch((failure) => onError(String(failure?.message ?? failure))) }, t('configApply')),
          h('button', { type: 'button', className: 'egm-btn', disabled: busy, onClick: () => void apply(role, 'session').catch((failure) => onError(String(failure?.message ?? failure))) }, t('configApplySession')),
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
            onClick: () => void act(testCommand(role, visibleOf(role))),
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

    // ---- 06-chip.js --------------------------------------------------------
    /**
     * Composer chip: phase, running count, and the way into the window.
     *
     * It publishes what it sees to the window store, so the modal never has to guess
     * a session: this slot is the only composer surface that receives one.
     */
    function EgmChip({ ctx, t, sessionId, useProjection }) {
      const [open, setOpen] = useState(false)
      const windowState = useWindowState()
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

      // The window is portalled from this slot rather than registered on a root
      // overlay: the composer slot is always mounted for the active session and knows
      // its id, and `shell.overlay` proved unreliable for a third-party package.
      const wantsWindow = windowState.open && (sessionId === undefined || windowState.sessionId === sessionId)
      const windowNode = wantsWindow ? h(EgmBoundary, { t, children: h(EgmWindow, { ctx, t }) }) : null
      // Portal when the shell exposes react-dom (it does); otherwise render in place,
      // so "Details" always shows something instead of silently doing nothing.
      const portal = windowNode === null
        ? null
        : typeof ReactDOM?.createPortal === 'function'
          ? ReactDOM.createPortal(windowNode, document.body)
          : windowNode

      return h(React.Fragment, null,
        portal,
        h('div', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center' }, ref: wrapRef },
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
          : null))
    }

    // ---- 07-command-row.js -------------------------------------------------
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

    // ---- 08-cards.js -------------------------------------------------------
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

    // ---- 09-apply.js -------------------------------------------------------
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

    return { inject, apply, __test: { buildRuns, statusOf, routeTextOf, formatTokens, formatDuration, mergeChildren, routeCommand, testCommand, applyPlan } }
  },
})
