/**
 * Service lookup.
 *
 * Cordis exposes a service as `ctx.get('name')` and, only for a context that
 * declared it in `inject`, as a property. Touching the property without the
 * declaration throws, so this helper never lets a probe throw: an absent or
 * unreachable service is simply `undefined`.
 *
 * @param {object} ctx a Cordis context (or a test double).
 * @param {string} name service name.
 * @returns {any} the service, or `undefined`.
 */
export function service(ctx, name) {
  if (ctx === undefined || ctx === null) return undefined
  if (typeof ctx.get === 'function') {
    try {
      const value = ctx.get(name)
      if (value !== undefined) return value
    } catch {
      // a throwing lookup is treated as absent
    }
  }
  try {
    return ctx[name]
  } catch {
    // the property exists but this context did not inject it
    return undefined
  }
}

/**
 * Run `callback` once a service is reachable, now or later.
 *
 * Loader order is not a contract: a plugin may activate before the service it
 * wants is mounted (`ctx.get` then returns `undefined`, while the property access
 * that needs `inject` throws). `ctx.inject` gives a dependent scope that waits,
 * which is what makes registration independent of boot order.
 *
 * @param {object} ctx owning plugin context.
 * @param {string} name service name.
 * @param {(service: any) => void} callback runs once, with the resolved service.
 */
export function whenService(ctx, name, callback) {
  const now = service(ctx, name)
  if (now !== undefined) {
    callback(now)
    return
  }
  if (typeof ctx.inject !== 'function') return
  try {
    ctx.inject([name], (childCtx) => {
      const later = service(childCtx, name)
      if (later !== undefined) callback(later)
    })
  } catch {
    // the name is not part of this composition at all: stay inactive, which is
    // what an absent optional service means
  }
}

/** Whether a service is reachable. */
export function has(ctx, name) {
  return service(ctx, name) !== undefined
}
