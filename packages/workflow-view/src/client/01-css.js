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
.wfv-chip[data-s="interrupted"],.wfv-chip[data-s="cancelled"]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary)}
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
