/**
 * Browser half of `@local/dsh-workflow-view` — GENERATED FILE, do not edit.
 *
 * Built from `src/client/*.js` by `scripts/bundle-client.mjs`
 * (`npm run build:client`). The Harness Web module loader serves one script per
 * package, so the parts are concatenated into one closure instead of imported.
 */
window.__ModuleLoader__.load({
  id: "@local/dsh-workflow-view",
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    /** Pure helpers exposed to the test suite; assigned by the apply part. */
    let testApi

    // ---- 00-helpers.js -----------------------------------------------------
    /**
     * Small client helpers shared by the tab and the header action.
     *
     * Both are optional services here: the tab is still useful with only the
     * projection, and touching a service this plugin did not inject throws in Cordis,
     * so every lookup is guarded.
     */

    /** Resolve an optional client service without declaring it in `inject`. */
    function serviceOf(ctx, name) {
      if (ctx === undefined || ctx === null) return undefined
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

    /** Subscribe to the client session store when the shell composes one. */
    function useSessionSnapshot(ctx) {
      const store = serviceOf(ctx, 'sessions')?.list
      const subscribe = useCallback((listener) => (typeof store?.subscribe === 'function' ? store.subscribe(listener) : () => {}), [store])
      const getSnapshot = useCallback(() => (typeof store?.getSnapshot === 'function' ? store.getSnapshot() : undefined), [store])
      return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    }

    // ---- 01-css.js ---------------------------------------------------------
    /**
     * Styles for the Workflows tab.
     *
     * Layered so a change stays local: tokens → primitives (surface, chip, bar) →
     * components. Every colour is a `--dsw-alias-*` theme token or a `color-mix` of
     * one, so light/dark follow the host; a renamed token degrades an appearance but
     * never breaks rendering. No literal colours live here (a test enforces it).
     */

    /** Root and shared type. */
    const CSS_LAYOUT = `
    .wfv-root{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;padding:4px 2px 2px;font-family:var(--dsw-font-family);font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
    .wfv-root[data-density="compact"]{font-size:12px;line-height:18px;gap:6px}
    .wfv-num{font-variant-numeric:tabular-nums}
    .wfv-mono{font-family:var(--dsw-font-mono);font-size:11px}

    .wfv-bar-head{position:sticky;top:0;z-index:2;display:flex;flex-direction:column;gap:8px;padding:2px 0 8px;background:var(--dsw-alias-bg-base);border-bottom:.5px solid var(--dsw-alias-border-l1)}
    .wfv-head{display:flex;align-items:baseline;gap:8px;min-width:0}
    .wfv-title{font-weight:600;font-size:13px;letter-spacing:-.01em;flex:none}
    .wfv-spacer{flex:1}
    .wfv-totals{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .wfv-totals .wfv-sep{color:var(--dsw-alias-label-tertiary)}

    .wfv-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .wfv-pill{box-sizing:border-box;height:24px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;font-weight:500;cursor:pointer;transition:background .12s ease,color .12s ease,border-color .12s ease}
    .wfv-pill:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
    .wfv-pill[data-on="true"]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
    .wfv-pill:disabled{opacity:.45;cursor:default}
    .wfv-pill:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
    `

    /** Run list and the selected-run card. */
    const CSS_RUNS = `
    .wfv-runs{display:flex;flex-direction:column;gap:2px;max-height:196px;overflow:auto;overscroll-behavior:contain;padding:4px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}
    .wfv-run{position:relative;display:grid;grid-template-columns:8px 1fr auto;align-items:center;column-gap:8px;row-gap:2px;width:100%;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:inherit;font:inherit;text-align:left;padding:6px 8px;cursor:pointer;min-width:0;transition:background .12s ease}
    .wfv-run:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-run[aria-selected="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
    .wfv-run:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-2px}
    .wfv-run-name{grid-column:2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
    .wfv-run-when{grid-column:2;color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .wfv-run-facts{grid-column:3;grid-row:1 / span 2;display:flex;flex-direction:column;align-items:flex-end;gap:2px;color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums}
    .wfv-micro{grid-column:1 / -1;display:flex;gap:1px;height:3px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);margin-top:3px}
    .wfv-micro > i{display:block;height:100%}

    .wfv-card{display:flex;flex-direction:column;gap:6px;padding:10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}
    .wfv-card-top{display:flex;align-items:center;gap:8px;min-width:0}
    .wfv-card-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wfv-card-meta{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;display:flex;gap:6px;flex-wrap:wrap}
    .wfv-progress{display:flex;height:6px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
    .wfv-progress > i{display:block;height:100%}
    .wfv-progress > i[data-s="completed"],.wfv-micro > i[data-s="completed"]{background:var(--dsw-alias-state-success-primary)}
    .wfv-progress > i[data-s="running"],.wfv-micro > i[data-s="running"]{background:var(--dsw-alias-brand-primary)}
    .wfv-progress > i[data-s="failed"],.wfv-micro > i[data-s="failed"]{background:var(--dsw-alias-state-error-primary)}
    .wfv-progress > i[data-s="unknown"],.wfv-micro > i[data-s="unknown"]{background:var(--dsw-alias-label-tertiary)}
    .wfv-progress > i[data-s="cancelled"],.wfv-micro > i[data-s="cancelled"],
    .wfv-progress > i[data-s="interrupted"],.wfv-micro > i[data-s="interrupted"]{background:var(--dsw-alias-state-warn-primary)}
    .wfv-legend{display:flex;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:10px}
    .wfv-legend > span{display:inline-flex;align-items:center;gap:4px}
    `

    /** Timeline: phase rails, member cards, proportional bars. */
    const CSS_TIMELINE = `
    .wfv-timeline{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:14px;padding:2px 0}
    .wfv-phase{display:flex;flex-direction:column;gap:6px}
    .wfv-phase-head{display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:1;background:var(--dsw-alias-bg-base);padding:2px 0}
    .wfv-phase-pill{flex:none;font-size:10px;line-height:16px;padding:0 8px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.06em}
    .wfv-phase-count{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
    .wfv-phase-line{flex:1;height:1px;background:var(--dsw-alias-border-l1)}
    .wfv-phase-body{display:flex;flex-direction:column;gap:4px;margin-left:6px;padding-left:10px;border-left:1px solid var(--dsw-alias-border-l1)}

    .wfv-member{display:flex;flex-direction:column;gap:3px;padding:7px 8px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0;transition:border-color .12s ease,background .12s ease}
    .wfv-member:hover{border-color:var(--dsw-alias-border-l2)}
    .wfv-member[data-s="failed"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent)}
    .wfv-root[data-density="compact"] .wfv-member{padding:4px 8px;gap:2px}
    .wfv-member-top{display:flex;align-items:center;gap:8px;min-width:0}
    .wfv-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;cursor:pointer;background:none;border:none;padding:0;color:inherit;font:inherit;text-align:left}
    .wfv-label:hover{text-decoration:underline;text-underline-offset:2px}
    .wfv-label:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px;border-radius:var(--dsw-radius-xs)}
    .wfv-state{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-tertiary)}
    .wfv-state[data-s="completed"]{color:var(--dsw-alias-state-success-primary)}
    .wfv-state[data-s="running"]{color:var(--dsw-alias-brand-primary)}
    .wfv-state[data-s="failed"]{color:var(--dsw-alias-state-error-primary)}
    .wfv-state[data-s="unknown"]{color:var(--dsw-alias-label-tertiary)}

    .wfv-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
    .wfv-dot[data-s="completed"]{background:var(--dsw-alias-state-success-primary)}
    .wfv-dot[data-s="running"]{background:var(--dsw-alias-brand-primary);animation:wfv-pulse 1.6s ease-in-out infinite}
    .wfv-dot[data-s="failed"]{background:var(--dsw-alias-state-error-primary)}
    .wfv-dot[data-s="cancelled"],.wfv-dot[data-s="interrupted"]{background:var(--dsw-alias-state-warn-primary)}
    @keyframes wfv-pulse{0%,100%{opacity:1}50%{opacity:.35}}

    .wfv-track{position:relative;height:6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);overflow:hidden;margin-top:2px}
    .wfv-track > i{position:absolute;top:0;bottom:0;border-radius:999px;background:var(--dsw-alias-state-success-primary);min-width:6px}
    .wfv-track > i[data-s="failed"]{background:var(--dsw-alias-state-error-primary)}
    .wfv-track > i[data-s="running"]{background:var(--dsw-alias-brand-primary)}
    .wfv-track > i[data-s="unknown"]{background:var(--dsw-alias-label-tertiary)}
    .wfv-track > i[data-s="cancelled"],.wfv-track > i[data-s="interrupted"]{background:var(--dsw-alias-state-warn-primary)}
    .wfv-track > i[data-live="true"]{background-image:repeating-linear-gradient(45deg,color-mix(in srgb,var(--dsw-alias-bg-base) 45%,transparent) 0 4px,transparent 4px 8px)}

    .wfv-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wfv-root[data-density="compact"] .wfv-facts{display:none}
    .wfv-detail{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:6px 8px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);font-size:11px;color:var(--dsw-alias-label-secondary)}
    .wfv-detail dt{color:var(--dsw-alias-label-tertiary)}
    .wfv-detail dd{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wfv-actions{flex:none;display:flex;gap:4px;margin-left:auto}
    `

    /** Controls, states and the footer. */
    const CSS_CONTROLS = `
    .wfv-icon{box-sizing:border-box;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:.5px solid transparent;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;line-height:1;cursor:pointer;transition:color .12s ease,background .12s ease,border-color .12s ease}
    .wfv-icon:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-icon:disabled{opacity:.35;cursor:default}
    .wfv-icon:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px}
    .wfv-btn{box-sizing:border-box;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;margin-top:6px}
    .wfv-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
    .wfv-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
    .wfv-chip{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
    .wfv-chip[data-s="completed"]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}
    .wfv-chip[data-s="running"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
    .wfv-chip[data-s="failed"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}
    .wfv-empty{color:var(--dsw-alias-label-secondary);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px;text-align:center}
    .wfv-empty svg{opacity:.55}
    .wfv-empty-box{border:.5px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);align-items:center}
    .wfv-note{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px;border-top:.5px solid var(--dsw-alias-border-l1);padding-top:6px}
    .wfv-error{color:var(--dsw-alias-state-error-primary);font-size:12px}

    @media (prefers-reduced-motion: reduce){
      .wfv-dot[data-s="running"]{animation:none}
      .wfv-pill,.wfv-run,.wfv-member,.wfv-icon{transition:none}
    }
    `

    /** Session header button. */
    const HEADER_CSS = `
    .wfv-header-btn{box-sizing:border-box;height:26px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background .12s ease,color .12s ease}
    .wfv-header-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
    .wfv-header-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
    `

    /** Everything the tab needs, as one stylesheet. */
    const CSS = CSS_LAYOUT + CSS_RUNS + CSS_TIMELINE + CSS_CONTROLS

    // ---- 02-i18n.js --------------------------------------------------------
    /** Locale namespace and dictionaries. Both languages carry the same keys. */
    const NS = '@local/dsh-workflow-view'

    const DICT = {
      en: {
        tab: 'Workflows',
        header: 'Workflows',
        headerTitle: 'Runs started by the workflow tool in this session',
        runs: 'runs',
        members: 'members',
        failed: 'failed',
        running: 'running',
        completed: 'completed',
        cancelled: 'cancelled',
        interrupted: 'interrupted',
        unknown: 'unknown',
        all: 'All',
        filterRunning: 'Running',
        filterFailed: 'Failed',
        open: 'Open',
        openAside: 'Beside',
        route: 'route',
        tokens: 'tokens',
        noRoute: 'no route',
        phase: 'phase',
        noPhase: 'no phase',
        start: 'started',
        duration: 'duration',
        now: 'just now',
        ago: 'ago',
        seq: 'seq',
        child: 'session',
        mode: 'mode',
        copy: 'Copy id',
        copied: 'Copied',
        details: 'Details',
        density: 'Compact',
        densityTitle: 'Toggle row density',
        legend: 'Legend',
        noRuns: 'No workflow run in this session yet. The workflow tool records one run per execution.',
        noMatch: 'No run matches this filter.',
        showAll: 'Show all runs',
        noMembers: 'This run recorded no members.',
        logsNote: 'Script output is not durable: the log keeps run and member lifecycle only.',
      },
      pt: {
        tab: 'Workflows',
        header: 'Workflows',
        headerTitle: 'Execuções iniciadas pela tool workflow nesta sessão',
        runs: 'execuções',
        members: 'membros',
        failed: 'falhas',
        running: 'em execução',
        completed: 'concluída',
        cancelled: 'cancelada',
        interrupted: 'interrompida',
        unknown: 'desconhecido',
        all: 'Todas',
        filterRunning: 'Em execução',
        filterFailed: 'Com falha',
        open: 'Abrir',
        openAside: 'Ao lado',
        route: 'rota',
        tokens: 'tokens',
        noRoute: 'sem rota',
        phase: 'fase',
        noPhase: 'sem fase',
        start: 'início',
        duration: 'duração',
        now: 'agora',
        ago: 'atrás',
        seq: 'seq',
        child: 'sessão',
        mode: 'modo',
        copy: 'Copiar id',
        copied: 'Copiado',
        details: 'Detalhes',
        density: 'Compacta',
        densityTitle: 'Alternar densidade das linhas',
        legend: 'Legenda',
        noRuns: 'Nenhuma execução de workflow nesta sessão ainda. A tool grava uma execução por chamada.',
        noMatch: 'Nenhuma execução corresponde a este filtro.',
        showAll: 'Mostrar todas',
        noMembers: 'Esta execução não registrou membros.',
        logsNote: 'A saída do script não é durável: o log guarda só o ciclo de vida de execução e membros.',
      },
    }

    // ---- 03-model.js -------------------------------------------------------
    /**
     * Pure model of what the tab shows: the projection's runs, enriched with the
     * route each member was created with (subagent catalog) and its live status and
     * tokens (client session store), plus the geometry the timeline needs.
     *
     * Everything here is a function of plain data, so the browser and the tests
     * compute the same rows, bars and totals.
     */

    /** Glyph per member status. */
    const GLYPH = {
      running: '◐',
      completed: '✓',
      failed: '✗',
      cancelled: '⊘',
      interrupted: '⊘',
      unknown: '·',
    }

    /** Modes the subagent chat resource accepts. */
    const MODES = new Set(['one-shot', 'continuable', 'unknown'])

    /** Compact token count. */
    function formatTokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
      if (value < 1000) return String(Math.round(value))
      if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
      return `${(value / 1_000_000).toFixed(1)}M`
    }

    /** Compact duration. */
    function formatDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null
      const seconds = Math.round(ms / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
      return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
    }

    /** Compact age of a timestamp, without a preposition. */
    function formatRelative(at, now = Date.now()) {
      if (typeof at !== 'number' || !Number.isFinite(at)) return null
      const delta = Math.max(0, now - at)
      if (delta < 45_000) return 'now'
      const minutes = Math.round(delta / 60_000)
      if (minutes < 60) return `${minutes} min`
      const hours = Math.round(delta / 3_600_000)
      if (hours < 24) return `${hours} h`
      return `${Math.round(delta / 86_400_000)} d`
    }

    /** Local clock time, HH:MM:SS. */
    function formatClock(at) {
      if (typeof at !== 'number' || !Number.isFinite(at)) return null
      const date = new Date(at)
      return [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map((part) => String(part).padStart(2, '0'))
        .join(':')
    }

    /** Address the sidebar chat tab accepts; both `parent` and `mode` are required. */
    function chatAddress({ parentSessionId, childSessionId, mode }) {
      if (typeof childSessionId !== 'string' || childSessionId === '') throw new Error('a child session is required')
      const query = new URLSearchParams({ parent: parentSessionId ?? '', mode: MODES.has(mode) ? mode : 'continuable' })
      return `dsh-resource://subagentchat/session/${encodeURIComponent(childSessionId)}?${query}`
    }

    /** Payload `uiWorkspace.openSession` expects. */
    function openTarget({ parentSessionId, childSessionId, mode }) {
      if (typeof childSessionId !== 'string' || childSessionId === '') throw new Error('a child session is required')
      return { parentSessionId, childSessionId, mode: MODES.has(mode) ? mode : 'continuable' }
    }

    /**
     * Ask the sidebar to open the Workflows tab, using the most explicit API the
     * shell offers. Each of the three returns nothing, success or not, so this
     * reports which one it used instead of pretending to know it worked.
     */
    function openWorkflowTab(right, sessionId) {
      const address = `dsh-resource://workflow-view/session/${encodeURIComponent(sessionId ?? 'current')}`
      // Presence is checked explicitly: `right?.method?.()` returns undefined for a
      // method that does not exist, which would look like a successful call.
      const attempts = [
        ['openTabIn', typeof right?.openTabIn === 'function', () => right.openTabIn(sessionId, 'workflow')],
        ['openTab', typeof right?.openTab === 'function', () => right.openTab('workflow')],
        ['openResource', typeof right?.openResource === 'function', () => right.openResource(address, { kind: 'workflow', preferNewPane: true })],
      ]
      for (const [name, present, run] of attempts) {
        if (!present) continue
        try {
          run()
          return name
        } catch {
          // the next shape may exist in a different shell generation
        }
      }
      return 'none'
    }

    /** Route text of one catalog entry. */
    function routeOf(entry) {
      if (entry?.agentProvider === undefined || entry?.agentModel === undefined) return null
      const effort = entry.agentReasoningEffort
      return `${entry.agentProvider}/${entry.agentModel}${effort === undefined || effort === null ? '' : `#${effort}`}`
    }

    /** Token total of one session summary. */
    function tokensOf(summary) {
      const totals = summary?.projectionValues?.tokenUsage?.totals
      if (totals === undefined) return null
      const sum = (totals.uncachedInputTokens ?? 0) + (totals.outputTokens ?? 0)
      return sum > 0 ? sum : null
    }

    /** Member status: the live flag wins, then the recorded outcome. */
    function memberStatus(recorded, summary) {
      if (summary?.running === true) return 'running'
      return recorded ?? 'unknown'
    }

    /** Index catalog entries by child id. */
    function catalogIndex(catalog) {
      const index = new Map()
      for (const entry of Array.isArray(catalog) ? catalog : []) {
        if (typeof entry?.id === 'string') index.set(entry.id, entry)
      }
      return index
    }

    /** Group members by phase, preserving first appearance order. */
    function groupByPhase(members, noPhaseLabel) {
      const groups = []
      const index = new Map()
      for (const member of members) {
        const phase = member.phase ?? null
        if (!index.has(phase)) {
          const group = { phase, label: phase ?? noPhaseLabel, members: [] }
          index.set(phase, group)
          groups.push(group)
        }
        index.get(phase).members.push(member)
      }
      return groups
    }

    /** Span of one run: recorded when present, derived from members otherwise. */
    function runSpan(run, now = Date.now()) {
      const starts = run.agents.map((agent) => agent.startedAt).filter((value) => typeof value === 'number')
      const ends = run.agents.map((agent) => agent.endedAt).filter((value) => typeof value === 'number')
      const start = run.startedAt ?? (starts.length === 0 ? null : Math.min(...starts))
      const approximate = run.startedAt === null || run.startedAt === undefined
      const end = run.endedAt ?? (run.status === 'running' ? now : ends.length === 0 ? start : Math.max(...ends))
      const span = { start, end: end === null ? null : Math.max(end, start ?? 0), approximate }
      return { ...span, durationMs: start === null || span.end === null ? null : span.end - start }
    }

    /**
     * Geometry of one member's bar inside the run span, as fractions of the track.
     * A member with no start has no bar; a running member extends to `now` and is
     * flagged live so the view can hatch it.
     */
    function memberBar(member, span, now) {
      if (span.start === null || span.end === null || span.end <= span.start) {
        return typeof member.startedAt === 'number' ? { left: 0, width: 1, live: member.status === 'running' } : null
      }
      if (typeof member.startedAt !== 'number') return null
      const total = span.end - span.start
      const left = Math.min(1, Math.max(0, (member.startedAt - span.start) / total))
      const rawEnd = typeof member.endedAt === 'number' ? member.endedAt : member.status === 'running' ? now : member.startedAt
      const width = Math.min(1 - left, Math.max(0, (rawEnd - member.startedAt) / total))
      return { left, width: width <= 0 ? 0.01 : width, live: member.status === 'running' }
    }

    /** Completed / running / failed / unknown split, with fractions for the bar. */
    function runProgress(run) {
      const counts = { completed: 0, running: 0, failed: 0, unknown: 0 }
      for (const agent of run.agents ?? []) {
        const status = agent.status
        counts[status] = (counts[status] ?? 0) + 1
      }
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
      const segments = ['completed', 'running', 'failed', 'unknown']
        .map((status) => ({ status, count: counts[status] ?? 0, fraction: total === 0 ? 0 : (counts[status] ?? 0) / total }))
        .filter((segment) => segment.count > 0)
      return { counts, total, segments }
    }

    /** Duration and member count of each phase group. */
    function aggregatePhases(groups) {
      return groups.map((group) => {
        const starts = group.members.map((member) => member.startedAt).filter((value) => typeof value === 'number')
        const ends = group.members.map((member) => member.endedAt).filter((value) => typeof value === 'number')
        const durationMs = starts.length === 0 || ends.length === 0 ? null : Math.max(...ends) - Math.min(...starts)
        return { phase: group.phase, label: group.label, count: group.members.length, durationMs: durationMs !== null && durationMs > 0 ? durationMs : null }
      })
    }

    /** Totals across every run of the session. */
    function summarize(runs) {
      let members = 0
      let failed = 0
      let running = 0
      let tokens = 0
      for (const run of runs) {
        members += run.members.length
        failed += run.members.filter((member) => member.status === 'failed').length
        running += run.members.filter((member) => member.status === 'running').length
        for (const member of run.members) tokens += member.tokens ?? 0
      }
      return { runs: runs.length, members, failed, running, tokens }
    }

    /**
     * Build the tab's rows.
     * @param {object} input
     * @param {object|undefined} input.view the `workflowRuns` projection view.
     * @param {object[]|undefined} input.catalog the `subagentCatalog` view.
     * @param {object|undefined} input.sessions the client session store snapshot.
     * @param {'all'|'running'|'failed'} [input.filter] run filter.
     * @param {number} [input.now] render timestamp, for live bars and ages.
     * @param {string} input.noPhaseLabel label used for members without a phase.
     */
    function buildTab({ view, catalog, sessions, filter = 'all', now = Date.now(), noPhaseLabel = 'no phase' }) {
      const index = catalogIndex(catalog)
      const byId = sessions?.byId ?? {}
      return (view?.runs ?? [])
        .map((run) => {
          const members = (run.agents ?? []).map((agent) => {
            const entry = agent.childId === null ? undefined : index.get(agent.childId)
            const summary = agent.childId === null ? undefined : byId[agent.childId]
            const status = memberStatus(agent.status, summary)
            const started = agent.startedAt ?? summary?.createdAt ?? null
            const ended = agent.endedAt ?? null
            const durationMs = started === null ? null : (ended ?? (status === 'running' ? now : started)) - started
            return {
              seq: agent.seq,
              mode: MODES.has(entry?.mode) ? entry.mode : 'continuable',
              label: agent.label || entry?.label || (agent.childId ?? '').slice(0, 8) || `#${agent.seq}`,
              phase: agent.phase ?? null,
              childId: agent.childId ?? null,
              status,
              glyph: GLYPH[status] ?? '·',
              route: routeOf(entry),
              tokens: tokensOf(summary),
              durationMs: status === 'running' || status === 'unknown' ? null : durationMs,
              rawDurationMs: durationMs,
              startedAt: started,
              endedAt: ended,
            }
          })
          const span = runSpan({ ...run, agents: run.agents ?? [] }, now)
          const withBars = members.map((member) => ({ ...member, bar: memberBar(member, span, now) }))
          const groups = groupByPhase(withBars, noPhaseLabel)
          const progress = runProgress({ agents: withBars })
          return {
            ...run,
            members: withBars,
            groups,
            phases: aggregatePhases(groups),
            span,
            progress,
            counts: {
              total: members.length,
              running: progress.counts.running ?? 0,
              failed: progress.counts.failed ?? 0,
            },
          }
        })
        .filter((run) => (filter === 'running' ? run.status === 'running' || run.counts.running > 0 : filter === 'failed' ? run.counts.failed > 0 : true))
    }

    /** One-line fact string for a member row. */
    function memberFacts(member, t, { now = Date.now() } = {}) {
      return [
        member.route ?? t('noRoute'),
        formatTokens(member.tokens) === null ? null : `${formatTokens(member.tokens)} ${t('tokens')}`,
        formatDuration(member.durationMs),
        member.status === 'running' ? `${t('running')} ${formatRelative(member.startedAt, now) ?? ''}`.trim() : null,
      ].filter((fact) => fact !== null && fact !== undefined).join(' · ')
    }

    // ---- 04-tab.js ---------------------------------------------------------
    /**
     * The Workflows tab body.
     *
     * Reading order, top to bottom: session totals → filters → run list → the
     * selected run (status, progress) → its phases, each member with a proportional
     * duration bar and an expandable detail. The toolbar is ALWAYS rendered, so a
     * filter that matches nothing can always be undone; empty states are distinct and
     * name themselves.
     */

    /** Session the tab should show, published by the header action. */
    let activeSession

    /** Density preference, per browser. */
    const DENSITY_KEY = 'dsh-workflow-view:density'

    /** Filters in display order, with their dictionary key. */
    const FILTERS = [
      { id: 'all', label: 'all' },
      { id: 'running', label: 'filterRunning' },
      { id: 'failed', label: 'filterFailed' },
    ]

    /** Read the stored density, falling back when storage is unavailable. */
    function readDensity() {
      try {
        return globalThis.localStorage?.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
      } catch {
        return 'comfortable'
      }
    }

    /** Persist the density; a blocked storage must not break the tab. */
    function writeDensity(value) {
      try {
        globalThis.localStorage?.setItem(DENSITY_KEY, value)
      } catch {
        // preference is a convenience, not state
      }
    }

    /** Inline icon used by the empty states. */
    function emptyIcon() {
      return h('svg', { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true },
        h('path', { d: 'M4 6h6v5H4zM14 6h6v5h-6zM4 15h6v5H4z' }),
        h('path', { d: 'M14 17h6' }))
    }

    /** Status dot. */
    function renderDot(status) {
      return h('span', { className: 'wfv-dot', 'data-s': status, 'aria-hidden': true })
    }

    /** Segmented progress bar for one run. */
    function renderProgress(progress) {
      return h('div', { className: 'wfv-progress', role: 'img', 'aria-hidden': true },
        ...progress.segments.map((segment) => h('i', { key: segment.status, 'data-s': segment.status, style: { width: `${(segment.fraction * 100).toFixed(2)}%` } })))
    }

    /** Legend for the status colours, shown inside the run card. */
    function renderLegend({ t, progress }) {
      const shown = progress.segments.filter((segment) => segment.status !== 'unknown')
      if (shown.length <= 1) return null
      return h('div', { className: 'wfv-legend', 'aria-label': t('legend') },
        ...shown.map((segment) => h('span', { key: segment.status },
          h('span', { className: 'wfv-dot', 'data-s': segment.status, 'aria-hidden': true }),
          `${t(segment.status)} ${segment.count}`)))
    }

    /** One member row: status, label, state, duration bar, actions and details. */
    function renderMember(member, context) {
      const { t, navigate, toggleDetail, expanded, now, copied, copyId } = context
      const open = expanded[`${member.phase ?? '-'}:${member.seq}`] === true
      const barStyle = member.bar === null ? null : { left: `${(member.bar.left * 100).toFixed(2)}%`, width: `${(member.bar.width * 100).toFixed(2)}%` }
      return h('article', { key: `${member.phase ?? '-'}:${member.seq}`, className: 'wfv-member', 'data-s': member.status },
        h('div', { className: 'wfv-member-top' },
          renderDot(member.status),
          h('button', {
            type: 'button',
            className: 'wfv-label',
            'aria-expanded': open,
            title: t('details'),
            onClick: () => toggleDetail(member),
          }, member.label),
          h('span', { className: 'wfv-state', 'data-s': member.status }, t(member.status)),
          h('div', { className: 'wfv-actions' },
            h('button', {
              type: 'button',
              className: 'wfv-icon',
              title: t('open'),
              'aria-label': `${t('open')} ${member.label}`,
              disabled: member.childId === null,
              onClick: () => navigate(member, false),
            }, '↗'),
            h('button', {
              type: 'button',
              className: 'wfv-icon',
              title: t('openAside'),
              'aria-label': `${t('openAside')} ${member.label}`,
              disabled: member.childId === null,
              onClick: () => navigate(member, true),
            }, '⇥'))),
        member.bar === null ? null : h('span', { className: 'wfv-track', 'aria-hidden': true },
          h('i', { 'data-s': member.status, 'data-live': member.bar.live === true, style: barStyle })),
        h('div', { className: 'wfv-facts' }, memberFacts(member, t, { now })),
        open ? h('dl', { className: 'wfv-detail' },
          h('dt', null, t('seq')), h('dd', null, String(member.seq)),
          h('dt', null, t('child')), h('dd', { className: 'wfv-mono', title: member.childId ?? '' }, member.childId ?? '—'),
          h('dt', null, t('route')), h('dd', null, member.route ?? t('noRoute')),
          h('dt', null, t('mode')), h('dd', null, member.mode),
          h('dt', null, t('start')), h('dd', { className: 'wfv-num' }, formatClock(member.startedAt) ?? '—'),
          h('dt', null, t('duration')), h('dd', { className: 'wfv-num' }, formatDuration(member.rawDurationMs) ?? '—'),
          h('dt', null, ''), h('dd', null, h('button', {
            type: 'button',
            className: 'wfv-btn',
            onClick: () => copyId(member.childId),
          }, copied === member.childId ? t('copied') : t('copy')))) : null)
    }

    /** One phase section. */
    function renderGroup(group, context) {
      const phase = context.run.phases.find((entry) => entry.phase === group.phase)
      return h('section', { key: group.phase ?? '__none__', className: 'wfv-phase' },
        h('header', { className: 'wfv-phase-head' },
          h('span', { className: 'wfv-phase-pill' }, group.label),
          h('span', { className: 'wfv-phase-count' }, phase?.durationMs === null || phase?.durationMs === undefined
            ? String(group.members.length)
            : `${group.members.length} · ${formatDuration(phase.durationMs)}`),
          h('span', { className: 'wfv-phase-line' })),
        h('div', { className: 'wfv-phase-body' }, ...group.members.map((member) => renderMember(member, context))))
    }

    /** The selected run's header card. */
    function renderRunCard({ t, run, now }) {
      return h('div', { className: 'wfv-card' },
        h('div', { className: 'wfv-card-top' },
          h('span', { className: 'wfv-card-name', title: run.runId }, run.name || run.runId.slice(0, 8)),
          h('span', { className: 'wfv-chip', 'data-s': run.status }, t(run.status))),
        h('div', { className: 'wfv-card-meta' },
          `${t('start')} ${formatRelative(run.span.start, now) ?? '—'}`,
          h('span', { className: 'wfv-sep' }, '·'),
          `${t('duration')} ${formatDuration(run.span.durationMs) ?? '—'}`,
          h('span', { className: 'wfv-sep' }, '·'),
          `${run.counts.total} ${t('members')}`,
          run.counts.failed === 0 ? null : h('span', { className: 'wfv-sep' }, '·'),
          run.counts.failed === 0 ? null : h('span', { className: 'wfv-chip', 'data-s': 'failed' }, `${run.counts.failed} ${t('failed')}`)),
        renderProgress(run.progress),
        renderLegend({ t, progress: run.progress }))
    }

    /** The empty or filled body area. */
    function renderBody({ t, runs, allRuns, current, setFilter, context }) {
      if (runs.length === 0) {
        return h('div', { className: 'wfv-empty wfv-empty-box' },
          emptyIcon(),
          h('div', null, allRuns.length === 0 ? t('noRuns') : t('noMatch')),
          allRuns.length === 0 ? null : h('button', { type: 'button', className: 'wfv-btn', onClick: () => setFilter('all') }, t('showAll')))
      }
      if (current === null || current.groups.length === 0) {
        return h('div', { className: 'wfv-empty' }, emptyIcon(), h('div', null, t('noMembers')))
      }
      return h('div', { className: 'wfv-timeline' },
        renderRunCard({ t, run: current, now: context.now }),
        ...current.groups.map((group) => renderGroup(group, context)))
    }

    function WorkflowsTab({ ctx, t, sessionId, useProjection }) {
      const runsView = typeof useProjection === 'function' ? useProjection('workflowRuns') : undefined
      const catalog = typeof useProjection === 'function' ? useProjection('subagentCatalog') : undefined
      const sessions = useSessionSnapshot(ctx)
      const target = sessionId ?? activeSession
      const [filter, setFilter] = useState('all')
      const [selected, setSelected] = useState(null)
      const [expanded, setExpanded] = useState({})
      const [copied, setCopied] = useState(null)
      const [error, setError] = useState(null)
      const [density, setDensity] = useState(readDensity)
      const now = Date.now()

      const allRuns = useMemo(
        () => buildTab({ view: runsView, catalog, sessions, filter: 'all', now, noPhaseLabel: t('noPhase') }),
        [runsView, catalog, sessions, now, t],
      )
      const runs = useMemo(
        () => buildTab({ view: runsView, catalog, sessions, filter, now, noPhaseLabel: t('noPhase') }),
        [runsView, catalog, sessions, filter, now, t],
      )
      const current = runs.find((run) => run.runId === selected) ?? runs[0] ?? null
      const totals = useMemo(() => summarize(allRuns), [allRuns])
      const counts = {
        all: totals.runs,
        running: allRuns.filter((run) => run.status === 'running' || run.counts.running > 0).length,
        failed: allRuns.filter((run) => run.counts.failed > 0).length,
      }

      const navigate = (member, aside) => {
        if (member.childId === null) return
        setError(null)
        try {
          const payload = { parentSessionId: target, childSessionId: member.childId, mode: member.mode }
          if (aside === true) {
            serviceOf(ctx, 'sidebarRight')?.openResource?.(chatAddress(payload), { kind: 'subagentchat', preferNewPane: true })
          } else {
            serviceOf(ctx, 'uiWorkspace')?.openSession?.(openTarget(payload))
          }
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }

      const toggleDetail = (member) => {
        const key = `${member.phase ?? '-'}:${member.seq}`
        setExpanded({ ...expanded, [key]: expanded[key] !== true })
      }

      const copyId = (childId) => {
        if (childId === null) return
        try {
          void navigator.clipboard?.writeText?.(childId)
          setCopied(childId)
        } catch {
          setError(t('copy'))
        }
      }

      const toggleDensity = () => {
        const next = density === 'compact' ? 'comfortable' : 'compact'
        setDensity(next)
        writeDensity(next)
      }

      const toolbar = h('div', { className: 'wfv-bar-head' },
        h('div', { className: 'wfv-head' },
          h('span', { className: 'wfv-title' }, `⧉ ${t('tab')}`),
          h('span', { className: 'wfv-spacer' }),
          h('span', { className: 'wfv-totals', 'aria-live': 'polite' },
            `${totals.runs} ${t('runs')}`,
            h('span', { className: 'wfv-sep' }, '·'),
            `${totals.members} ${t('members')}`,
            totals.failed === 0 ? null : h('span', { className: 'wfv-sep' }, '·'),
            totals.failed === 0 ? null : h('span', null, `${totals.failed} ${t('failed')}`),
            totals.tokens === 0 ? null : h('span', { className: 'wfv-sep' }, '·'),
            totals.tokens === 0 ? null : h('span', { className: 'wfv-num' }, `${formatTokens(totals.tokens)} ${t('tokens')}`))),
        h('div', { className: 'wfv-filters', role: 'group', 'aria-label': t('tab') },
          ...FILTERS.map((entry) => h('button', {
            key: entry.id,
            type: 'button',
            className: 'wfv-pill',
            'data-on': filter === entry.id,
            'aria-pressed': filter === entry.id,
            disabled: entry.id !== 'all' && counts[entry.id] === 0 && filter !== entry.id,
            onClick: () => setFilter(entry.id),
          }, entry.id === 'all' || counts[entry.id] === 0 ? t(entry.label) : `${t(entry.label)} ${counts[entry.id]}`)),
          h('span', { className: 'wfv-spacer' }),
          h('button', {
            type: 'button',
            className: 'wfv-pill',
            'data-on': density === 'compact',
            'aria-pressed': density === 'compact',
            title: t('densityTitle'),
            onClick: toggleDensity,
          }, t('density'))))

      const context = { t, navigate, toggleDetail, expanded, now, copied, copyId, run: current }
      const body = renderBody({ t, runs, allRuns, current, setFilter, context })

      return h('div', { className: 'wfv-root', 'data-density': density },
        h('style', null, CSS),
        toolbar,
        error === null ? null : h('div', { className: 'wfv-error', role: 'alert' }, error),
        runs.length === 0 ? null : h('div', { className: 'wfv-runs', role: 'listbox', 'aria-label': t('runs') },
          ...runs.map((run) => h('button', {
            key: run.runId,
            type: 'button',
            role: 'option',
            'aria-selected': current?.runId === run.runId,
            className: 'wfv-run',
            title: run.name || run.runId,
            onClick: () => setSelected(run.runId),
          },
            renderDot(run.status),
            h('span', { className: 'wfv-run-name' }, run.name || run.runId.slice(0, 8)),
            h('span', { className: 'wfv-run-when' }, [formatRelative(run.span.start, now), formatDuration(run.span.durationMs)].filter(Boolean).join(' · ') || '—'),
            h('span', { className: 'wfv-run-facts' },
              `${run.counts.total} ${t('members')}`,
              run.counts.failed === 0 ? null : h('span', { className: 'wfv-chip', 'data-s': 'failed' }, String(run.counts.failed))),
            h('span', { className: 'wfv-micro', 'aria-hidden': true },
              ...run.progress.segments.map((segment) => h('i', { key: segment.status, 'data-s': segment.status, style: { width: `${(segment.fraction * 100).toFixed(2)}%` } })))))),
        body,
        h('div', { className: 'wfv-note' }, t('logsNote')))
    }

    /** Header action: count of runs, and the way into the tab. */
    function WorkflowsHeaderAction({ ctx, t, sessionId, useProjection }) {
      const view = typeof useProjection === 'function' ? useProjection('workflowRuns') : undefined
      const count = Array.isArray(view?.runs) ? view.runs.length : 0
      useEffect(() => {
        if (sessionId !== undefined) activeSession = sessionId
      }, [sessionId])

      const open = () => {
        if (sessionId !== undefined) activeSession = sessionId
        const used = openWorkflowTab(serviceOf(ctx, 'sidebarRight'), sessionId)
        if (used === 'none') console.warn('dsh-workflow-view: no sidebar API accepted the tab; open it from the right column tab strip')
      }

      return h('span', null,
        h('style', null, HEADER_CSS),
        h('button', {
          type: 'button',
          className: WFV_HEADER_CLASS,
          title: t('headerTitle'),
          onClick: open,
        }, `⧉ ${t('header')}${count === 0 ? '' : ` ${count}`}`))
    }

    // ---- 05-apply.js -------------------------------------------------------
    /** What the client half needs from the shell. */
    const inject = ['slots', 'locale']

    /** Width-stable button used in the session header. */
    const WFV_HEADER_CLASS = 'wfv-header-btn'

    /**
     * Register the header action, the sidebar tab type and its body.
     * @param {object} ctx client root context.
     */
    function apply(ctx) {
      const disposeLocale = ctx.locale.register(NS, DICT)
      if (typeof disposeLocale === 'function') ctx.effect(() => disposeLocale)

      // Styles live inside the components that use them (a <style> element in the
      // rendered tree), never in a DOM write of their own: the plugin contributes
      // through slots only, and its styles disappear with the slot entry.

      // Header action: the entry point, with a count.
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: 'workflow-view',
        order: 20,
        locale: NS,
        inject: (sessionId) => ({ sessionId }),
      }, (props) => h(WorkflowsHeaderAction, { ...props, ctx })))

      // The tab type, then its body keyed by the same id.
      //
      // Registered through `inject`, never by probing once: the sidebar's tab registry
      // is mounted by its own package, and a probe that runs first would leave the
      // type unregistered — the header button then opens a kind nobody claims and
      // nothing happens.
      ctx.inject(['sidebarRightTabs'], (scope) => {
        const tabs = serviceOf(scope, 'sidebarRightTabs')
        if (tabs === undefined) return
        ctx.effect(() => tabs.register({
          id: 'workflow',
          kind: 'workflow',
          priority: 'builtin',
          title: () => 'Workflows',
          canOpen: () => true,
        }))
      })

      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: 'workflow',
        locale: NS,
        inject: (sessionId) => ({ sessionId }),
      }, (props) => h(WorkflowsTab, { ...props, ctx })))
    }

    /** Helpers the test suite exercises without a browser. */
    testApi = {
      buildTab, formatTokens, formatDuration, formatRelative, formatClock, routeOf, groupByPhase, memberStatus,
      chatAddress, openTarget, openWorkflowTab, runSpan, memberBar, runProgress, aggregatePhases, summarize, memberFacts,
      WorkflowsTab, WorkflowsHeaderAction, renderBody, renderMember,
    }

    return { inject, apply, __test: testApi }
  },
})
