/** Styles for the Workflows tab. Theme tokens only. */
const CSS = `
.wfv-root{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.wfv-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wfv-title{font-weight:600}
.wfv-meta{color:var(--dsw-alias-label-secondary);font-size:12px}
.wfv-runs{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:4px;background:var(--dsw-alias-bg-layer-1)}
.wfv-run{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;text-align:left;padding:4px 8px;cursor:pointer;min-width:0}
.wfv-run:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.wfv-run[aria-selected="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.wfv-run:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.wfv-run-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfv-run-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;flex:none}
.wfv-chip{flex:none;font-size:11px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-secondary)}
.wfv-chip[data-s="running"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
.wfv-chip[data-s="failed"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 14%,transparent);color:var(--dsw-alias-state-error-primary,#dc2626)}
.wfv-chip[data-s="completed"]{background:color-mix(in srgb,var(--dsw-alias-success,#22c55e) 14%,transparent);color:var(--dsw-alias-success,#22c55e)}
.wfv-filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.wfv-btn{box-sizing:border-box;height:24px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer}
.wfv-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.wfv-btn[data-on="true"]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.wfv-timeline{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}
.wfv-phase{display:flex;flex-direction:column;gap:4px}
.wfv-phase-head{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.wfv-phase-line{flex:1;height:1px;background:var(--dsw-alias-border-l1)}
.wfv-member{display:flex;align-items:flex-start;gap:8px;padding:5px 6px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0}
.wfv-member[data-s="failed"]{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#dc2626) 40%,transparent)}
.wfv-glyph{flex:none;width:14px;text-align:center}
.wfv-member-main{flex:1;min-width:0;display:flex;flex-direction:column}
.wfv-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfv-facts{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wfv-actions{flex:none;display:flex;gap:4px}
.wfv-empty{color:var(--dsw-alias-label-secondary);font-size:12px;padding:12px 4px}
.wfv-error{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:12px}
`
