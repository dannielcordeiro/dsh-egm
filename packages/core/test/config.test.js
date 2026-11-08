import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  Config,
  allRoles,
  formatRoute,
  normalizeConfig,
  normalizeRoute,
  parseRoute,
  routeForRole,
  sameRoute,
} from '../src/config.js'
import { reviewerRoles } from '../src/personas.js'

test('defaults keep every role inheriting', () => {
  const { config, problems } = normalizeConfig({})
  assert.deepEqual(problems, [])
  assert.equal(config.routing.onInvalidRoute, 'fail')
  assert.equal(config.routing.onMissingRole, 'inherit')
  assert.equal(config.routing.elephant, null)
  assert.equal(config.routing.workers, null)
  assert.deepEqual(config.routing.reviewers, {})
  assert.equal(config.maxTokens.policy, 'model-default')
  assert.equal(config.features.reviewerTool, true)
})

test('the published schema accepts an empty config', () => {
  assert.doesNotThrow(() => Config({}))
})

test('effort is accepted as an alias for reasoningEffort', () => {
  const { config, problems } = normalizeConfig({ routing: { elephant: { provider: 'p', model: 'm', effort: 'high' } } })
  assert.deepEqual(problems, [])
  assert.deepEqual(config.routing.elephant, { provider: 'p', model: 'm', reasoningEffort: 'high' })
})

test('a reviewer key is normalised to the persona stem', () => {
  const { config, problems } = normalizeConfig({ routing: { reviewers: { 'egm-zoom-out': { provider: 'p', model: 'm' }, design: { provider: 'p', model: 'm' } } } })
  assert.deepEqual(problems, [])
  assert.deepEqual(Object.keys(config.routing.reviewers).sort(), ['design_critic', 'zoom_out'])
})

test('an unknown reviewer role is reported, not silently kept', () => {
  const { config, problems } = normalizeConfig({ routing: { reviewers: { wrong_name: { provider: 'p', model: 'm' } } } })
  assert.equal(Object.keys(config.routing.reviewers).length, 0)
  assert.match(problems.join('\n'), /unknown reviewer role/u)
})

test('an incomplete route is rejected by the schema with a field path', () => {
  assert.throws(() => normalizeConfig({ routing: { elephant: { provider: 'p' } } }), /invalid config: .*model/u)
})

test('a route with an empty provider is reported', () => {
  const { problems } = normalizeConfig({ routing: { elephant: { provider: '   ', model: 'm' } } })
  assert.match(problems.join('\n'), /missing provider/u)
})

test('an unknown phase is reported', () => {
  const { problems } = normalizeConfig({ routing: { phases: { deploy: { provider: 'p', model: 'm' } } } })
  assert.match(problems.join('\n'), /unknown phase/u)
})

test('a malformed config fails with an actionable message', () => {
  assert.throws(() => normalizeConfig({ routing: { reviewers: { design: 'not-an-object' } } }), /invalid config/u)
})

test('route text round-trips', () => {
  const parsed = parseRoute('anthropic/claude-sonnet-5-5#high')
  assert.deepEqual(parsed.problems, [])
  assert.equal(formatRoute(parsed.route), 'anthropic/claude-sonnet-5-5#high')
  assert.equal(formatRoute(null), 'inherit')
})

test('a model id may contain a slash', () => {
  const parsed = parseRoute('gateway/org/model#low')
  assert.equal(parsed.route.provider, 'gateway')
  assert.equal(parsed.route.model, 'org/model')
  assert.equal(parsed.route.reasoningEffort, 'low')
})

test('route text without a provider or model is rejected', () => {
  assert.match(parseRoute('modelonly').problems.join(' '), /not a route/u)
  assert.match(parseRoute('provider/').problems.join(' '), /not a route/u)
  assert.match(parseRoute('').problems.join(' '), /needs a value/u)
})

test('normalizeRoute ignores null so absent optional routes stay absent', () => {
  assert.deepEqual(normalizeRoute(null, 'x'), { problems: [] })
  assert.deepEqual(normalizeRoute(undefined, 'x'), { problems: [] })
})

test('sameRoute compares effort too', () => {
  assert.equal(sameRoute({ provider: 'p', model: 'm' }, { provider: 'p', model: 'm' }), true)
  assert.equal(sameRoute({ provider: 'p', model: 'm', reasoningEffort: 'high' }, { provider: 'p', model: 'm' }), false)
})

test('routeForRole covers actors, phases and personas', () => {
  const scope = {
    elephant: { provider: 'e', model: 'm' },
    workers: { provider: 'w', model: 'm' },
    phases: { review: { provider: 'r', model: 'm' } },
    reviewers: { default: { provider: 'd', model: 'm' }, zoom_out: { provider: 'z', model: 'm' } },
  }
  assert.equal(routeForRole(scope, 'elephant').provider, 'e')
  assert.equal(routeForRole(scope, 'worker').provider, 'w')
  assert.equal(routeForRole(scope, 'review').provider, 'r')
  assert.equal(routeForRole(scope, 'default').provider, 'd')
  assert.equal(routeForRole(scope, 'zoom_out').provider, 'z')
  assert.equal(routeForRole(scope, 'style'), undefined)
})

test('every role list includes the Elephant, the phases and the personas', () => {
  const roles = allRoles()
  assert.ok(roles.includes('elephant'))
  assert.ok(roles.includes('review'))
  assert.ok(roles.includes('default'))
  for (const role of reviewerRoles()) assert.ok(roles.includes(role), `${role} missing`)
  assert.equal(new Set(roles).size, roles.length)
})
