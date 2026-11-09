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

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = NS
    style.textContent = `.${WFV_HEADER_CLASS}{box-sizing:border-box;height:26px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.${WFV_HEADER_CLASS}:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);color:var(--dsw-alias-label-primary)}
.${WFV_HEADER_CLASS}:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}`
    document.head.appendChild(style)
    return () => style.remove()
  })

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
testApi = { buildTab, formatTokens, formatDuration, routeOf, groupByPhase, memberStatus, chatAddress, openTarget, openWorkflowTab }
