import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseEgmCommand, tokenize } from '../src/commands-parse.js'

test('tokens keep quoted values together', () => {
  assert.deepEqual(tokenize('model set design "a/b#high" --session'), ['model', 'set', 'design', 'a/b#high', '--session'])
  assert.deepEqual(tokenize('   '), [])
})

test('no arguments is help', () => {
  assert.equal(parseEgmCommand('egm', '').kind, 'help')
  assert.equal(parseEgmCommand('egm', 'help').kind, 'help')
})

test('routes and report accept --json', () => {
  assert.deepEqual(parseEgmCommand('egm', 'routes --json'), { kind: 'routes', json: true })
  assert.deepEqual(parseEgmCommand('egm', 'report'), { kind: 'report', json: false })
})

test('a bare model opens the picker', () => {
  assert.equal(parseEgmCommand('egm', 'model').kind, 'model-pick')
  assert.equal(parseEgmCommand('egm', 'model show').kind, 'model-show')
})

test('model set normalises the role and records the scope', () => {
  const parsed = parseEgmCommand('egm', 'model set egm-zoom-out anthropic/claude-sonnet-5-5#high --session')
  assert.equal(parsed.kind, 'model-set')
  assert.equal(parsed.role, 'zoom_out')
  assert.equal(parsed.scope, 'session')
  assert.deepEqual(parsed.route, { provider: 'anthropic', model: 'claude-sonnet-5-5', reasoningEffort: 'high' })
})

test('model set without --session writes the profile', () => {
  const parsed = parseEgmCommand('egm', 'model set elephant a/b')
  assert.equal(parsed.scope, 'profile')
})

test('inherit is a session statement, a profile reset otherwise', () => {
  const session = parseEgmCommand('egm', 'model set elephant inherit --session')
  assert.equal(session.kind, 'model-set')
  assert.equal(session.route, null)
  const profile = parseEgmCommand('egm', 'model set elephant inherit')
  assert.equal(profile.kind, 'model-reset')
  assert.equal(profile.scope, 'profile')
})

test('the catch-all reviewer accepts the spellings people type', () => {
  for (const spelling of ['default', 'reviewer', 'reviewers', 'any', 'padrao']) {
    const parsed = parseEgmCommand('egm', `model set ${spelling} ollama/lumi-4b`)
    assert.equal(parsed.kind, 'model-set', spelling)
    assert.equal(parsed.role, 'default', spelling)
  }
})

test('a phase is addressable as a role', () => {
  for (const phase of ['brainstorm', 'draft', 'review', 'resolve', 'bootstrap', 'drift']) {
    const parsed = parseEgmCommand('egm', `model set ${phase} ollama/lumi-4b`)
    assert.equal(parsed.kind, 'model-set', phase)
    assert.equal(parsed.role, phase, phase)
  }
})

test('unknown roles and bad routes are errors', () => {
  const unknown = parseEgmCommand('egm', 'model set nobody a/b')
  assert.equal(unknown.kind, 'error')
  assert.match(unknown.error, /try elephant, default/u)
  assert.equal(parseEgmCommand('egm', 'model set elephant nonsense').kind, 'error')
  assert.equal(parseEgmCommand('egm', 'model set elephant').kind, 'error')
})

test('model reset accepts a scope', () => {
  const parsed = parseEgmCommand('egm', 'model reset style --session')
  assert.equal(parsed.kind, 'model-reset')
  assert.equal(parsed.role, 'style')
  assert.equal(parsed.scope, 'session')
})

test('model test accepts a role or an explicit route', () => {
  assert.equal(parseEgmCommand('egm', 'model test').kind, 'model-test')
  assert.equal(parseEgmCommand('egm', 'model test design_critic').role, 'design_critic')
  const explicit = parseEgmCommand('egm', 'model test a/b#high')
  assert.deepEqual(explicit.route, { provider: 'a', model: 'b', reasoningEffort: 'high' })
})

test('phase, stage and review preset are validated', () => {
  assert.deepEqual(parseEgmCommand('egm', 'phase review'), { kind: 'phase', phase: 'review' })
  assert.equal(parseEgmCommand('egm', 'phase deploy').kind, 'error')
  assert.deepEqual(parseEgmCommand('egm', 'stage 7 done'), { kind: 'stage', stage: '7', status: 'done' })
  assert.equal(parseEgmCommand('egm', 'stage 4 done').kind, 'error')
  assert.equal(parseEgmCommand('egm', 'stage 7 finished').kind, 'error')
  assert.equal(parseEgmCommand('egm', 'review preset consolidated').kind, 'review-preset')
  assert.equal(parseEgmCommand('egm', 'review preset whatever').kind, 'error')
})

test('an unknown subcommand explains itself', () => {
  const parsed = parseEgmCommand('egm', 'fly')
  assert.equal(parsed.kind, 'error')
  assert.match(parsed.error, /unknown subcommand/u)
})

test('an egm-<phase> invocation is recognised as a skill start', () => {
  const parsed = parseEgmCommand('egm-review', ' docs/designs/x.md ')
  assert.equal(parsed.kind, 'phase-start')
  assert.equal(parsed.phase, 'review')
  assert.equal(parsed.target, 'docs/designs/x.md')
})
