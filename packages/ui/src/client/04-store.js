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
