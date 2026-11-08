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
