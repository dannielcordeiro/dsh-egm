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
