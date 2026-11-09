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
