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

/** Whether a service is reachable. */
export function has(ctx, name) {
  return service(ctx, name) !== undefined
}
