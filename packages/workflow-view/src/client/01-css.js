/** Styles for the Workflows tab. Theme tokens only, no hardcoded colours. */
const CSS = `
.wfv-root{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);padding:2px}
.wfv-bar{position:sticky;top:0;z-index:1;display:flex;flex-direction:column;gap:8px;padding-bottom:8px;background:var(--dsw-alias-bg-base);border-bottom:.5px solid var(--dsw-alias-border-l1)}
.wfv-bar-row{display:flex;align-items:center;gap:8px;min-width:0}
.wfv-title{font-weight:600;font-size:13px;letter-spacing:-.01em}
.wfv-spacer{flex:1}
.wfv-count,.wfv-meta{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;flex:none}
.wfv-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.wfv-pill{box-sizing:border-box;height:24px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;font-weight:500;cursor:pointer;transition:background .12s,color .12s,border-color .12s}
.wfv-pill:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
.wfv-pill[data-on="true"]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.wfv-pill:disabled{opacity:.45;cursor:default}
.wfv-pill:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.wfv-runs{display:flex;flex-direction:column;gap:1px;max-height:168px;overflow:auto;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:4px;background:var(--dsw-alias-bg-layer-1)}
.wfv-run{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;text-align:left;padding:5px 8px;cursor:pointer;min-width:0}
.wfv-run:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.wfv-run[aria-selected="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.wfv-run:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.wfv-run-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.wfv-run-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;flex:none;min-width:14px;text-align:right}
.wfv-chip{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.wfv-chip[data-s="running"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
.wfv-chip[data-s="failed"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 14%,transparent);color:var(--dsw-alias-state-error-primary,#dc2626)}
.wfv-chip[data-s="completed"]{background:color-mix(in srgb,var(--dsw-alias-success,#22c55e) 14%,transparent);color:var(--dsw-alias-success,#22c55e)}
.wfv-timeline{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:2px 0}
.wfv-phase{display:flex;flex-direction:column;gap:6px}
.wfv-phase-head{display:flex;align-items:center;gap:8px;position:sticky;top:0;background:var(--dsw-alias-bg-base);padding:2px 0}
.wfv-phase-pill{flex:none;font-size:10px;line-height:16px;padding:0 8px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.06em}
.wfv-phase-count{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.wfv-phase-line{flex:1;height:1px;background:var(--dsw-alias-border-l1)}
.wfv-phase-body{display:flex;flex-direction:column;gap:4px;padding-left:2px;border-left:1px solid var(--dsw-alias-border-l1);margin-left:6px;padding-left:10px}
.wfv-member{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0}
.wfv-member:hover{border-color:var(--dsw-alias-border-l2)}
.wfv-member[data-s="failed"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 40%,transparent)}
.wfv-dot{flex:none;width:7px;height:7px;margin-top:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#9ca3af)}
.wfv-dot[data-s="running"]{background:var(--dsw-alias-brand-primary);animation:wfv-pulse 1.6s ease-in-out infinite}
.wfv-dot[data-s="completed"]{background:var(--dsw-alias-success,#22c55e)}
.wfv-dot[data-s="failed"]{background:var(--dsw-alias-state-error-primary,#dc2626)}
@keyframes wfv-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.wfv-member-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.wfv-member-title{display:flex;align-items:center;gap:8px;min-width:0}
.wfv-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.wfv-state{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-tertiary)}
.wfv-state[data-s="running"]{color:var(--dsw-alias-brand-primary)}
.wfv-state[data-s="failed"]{color:var(--dsw-alias-state-error-primary,#dc2626)}
.wfv-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfv-actions{flex:none;display:flex;gap:4px}
.wfv-icon{box-sizing:border-box;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:.5px solid transparent;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;line-height:1;cursor:pointer}
.wfv-icon:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.wfv-icon:disabled{opacity:.35;cursor:default}
.wfv-icon:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.wfv-btn{box-sizing:border-box;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;margin-top:8px}
.wfv-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.wfv-empty{color:var(--dsw-alias-label-secondary);font-size:12px;padding:10px 2px}
.wfv-empty-box{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px;border:.5px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1)}
.wfv-note{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px;border-top:.5px solid var(--dsw-alias-border-l1);padding-top:6px}
.wfv-error{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:12px}
`
