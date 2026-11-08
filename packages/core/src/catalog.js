/**
 * The live model catalogue, as the routing UI and `/egm doctor` need to see it.
 *
 * The Harness `llm` service is the only source of truth for providers, models
 * and reasoning efforts. This module adds the two things a route editor needs on
 * top of it: a stable route key, and an availability verdict that distinguishes
 * "the provider is registered but has no credentials" from "the model id is not
 * in the catalogue".
 */

/** `provider/model`, the identity used by config keys and pricing. */
export function routeKey(route) {
  if (route === null || route === undefined) return ''
  return `${route.provider}/${route.model}`
}

/** Normalise the `reasoning` field of a resolved model into a list of efforts. */
function effortsOf(info) {
  const reasoning = info?.reasoning
  if (reasoning === undefined || reasoning === null || reasoning === false) return []
  if (reasoning === true) return []
  const efforts = reasoning.efforts
  const list = Array.isArray(efforts)
    ? efforts
    : Object.entries(efforts ?? {}).map(([id, entry]) => ({ id, ...typeof entry === 'object' && entry !== null ? entry : { name: String(entry) } }))
  return list
    .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.id === 'string')
    .map((entry) => ({ id: entry.id, name: typeof entry.name === 'string' ? entry.name : entry.id }))
}

/**
 * Enumerate every route this deployment can offer.
 * @param {object | undefined} llm the Harness `llm` service.
 * @returns {Promise<{providers: Array<{id: string, name: string, available: boolean, error?: string}>, models: Array<object>}>}
 */
export async function listRoutes(llm) {
  if (llm === undefined) return { providers: [], models: [] }
  const providers = []
  const models = []
  for (const provider of llm.listProviders()) {
    let catalog = []
    let error
    try {
      catalog = await llm.listModels(provider.id)
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure)
    }
    const available = Array.isArray(catalog) && catalog.length > 0
    providers.push({
      id: provider.id,
      name: provider.name ?? provider.id,
      available,
      ...error === undefined && available ? {} : { error: error ?? 'no models (missing credentials?)' },
    })
    for (const model of Array.isArray(catalog) ? catalog : []) {
      let info
      try {
        info = await llm.resolveModelInfo(provider.id, model.id)
      } catch {
        info = undefined
      }
      models.push({
        provider: provider.id,
        providerName: provider.name ?? provider.id,
        id: model.id,
        name: model.name ?? model.id,
        description: model.description,
        contextWindow: info?.context?.contextWindow,
        maxTokens: info?.defaultMaxTokens,
        efforts: effortsOf(info),
        defaultEffort: info?.reasoning?.defaultEffort,
        inputModalities: model.inputModalities,
        key: routeKey({ provider: provider.id, model: model.id }),
      })
    }
  }
  return { providers, models }
}

/**
 * Decide whether one configured route can actually be used, without making a
 * network call: the adapter must be registered, the model must resolve, and the
 * effort must be one the model declares (an empty effort list means "no
 * preference declared", which the adapter still accepts).
 * @param {object | undefined} llm the Harness `llm` service.
 * @param {{provider: string, model: string, reasoningEffort?: string}} route
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ok: boolean, reason?: string, info?: object}>}
 */
export async function checkRoute(llm, route, signal) {
  if (llm === undefined) return { ok: false, reason: 'the llm service is unavailable' }
  const registered = llm.listProviders().some((provider) => provider.id === route.provider)
  if (!registered) {
    const known = llm.listProviders().map((provider) => provider.id).join(', ')
    return { ok: false, reason: `provider "${route.provider}" is not registered (registered: ${known || 'none'})` }
  }
  let info
  try {
    info = await llm.resolveModelInfo(route.provider, route.model, signal)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  try {
    await llm.resolveCallConfig({
      provider: route.provider,
      model: route.model,
      ...route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort },
    }, signal)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error), info }
  }
  return { ok: true, info }
}

/**
 * Whether a provider has a usable catalogue. An empty catalogue is how the
 * pi-ai adapter reports missing credentials without touching the network.
 * @param {object | undefined} llm
 * @param {string} providerId
 */
export async function providerAvailability(llm, providerId) {
  if (llm === undefined) return { ok: false, reason: 'the llm service is unavailable' }
  if (!llm.listProviders().some((provider) => provider.id === providerId)) {
    return { ok: false, reason: `provider "${providerId}" is not registered` }
  }
  try {
    const models = await llm.listModels(providerId)
    if (!Array.isArray(models) || models.length === 0) return { ok: false, reason: `provider "${providerId}" exposes no models (missing credentials?)` }
    return { ok: true, models }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
