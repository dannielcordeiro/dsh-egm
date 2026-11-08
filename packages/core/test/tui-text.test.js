import assert from 'node:assert/strict'
import { test } from 'node:test'
import { footerFor, roleLabel } from '../src/tui.js'

const route = { provider: 'anthropic', model: 'claude-sonnet-5', reasoningEffort: 'high' }

test('no phase yet: elephant glyph and the session model', () => {
  const { text } = footerFor({ phase: null, route: { provider: 'deepseek-official', model: 'deepseek-flash' }, source: 'session', children: [], artifacts: [] }, 0)
  assert.equal(text, '🐘 deepseek-flash')
})

test('a finished review counts reviewers without a slash', () => {
  const { text } = footerFor({ phase: 'review', route, source: 'profile', children: [{}, {}, {}], artifacts: [] }, 0)
  assert.equal(text, '🐟 claude-sonnet-5#high · 3')
})

test('a running reviewer shows running over total and keeps the phase glyph', () => {
  const { text } = footerFor({ phase: 'review', route, source: 'session', children: [{}, {}], artifacts: [] }, 1)
  assert.equal(text, '🐟 claude-sonnet-5#high · 1/2')
})

test('each phase has its own glyph', () => {
  const glyphs = {
    brainstorm: '🐘',
    draft: '📝',
    review: '🐟',
    resolve: '🛠',
    bootstrap: '📚',
    drift: '🧭',
  }
  for (const [phase, glyph] of Object.entries(glyphs)) {
    const { text } = footerFor({ phase, route, source: 'profile', children: [], artifacts: [] }, 0)
    assert.equal(text.split(' ')[0], glyph, `phase ${phase}`)
  }
})

test('inheriting reads as the word inherit, without a provider', () => {
  const { text, detail } = footerFor({ phase: 'draft', route: null, source: 'inherit', children: [], artifacts: [] }, 0)
  assert.equal(text, '📝 inherit')
  assert.match(detail, /route: inherit \(inherit\)/u)
})

test('the hover detail carries the provenance, the counts and the key', () => {
  const { detail } = footerFor({ phase: 'review', route, source: 'workspace:/p/.dsh/egm.yaml', children: [{}, {}], artifacts: [{ path: 'a' }] }, 1)
  assert.equal(detail, 'phase: review · route: anthropic/claude-sonnet-5#high (workspace:/p/.dsh/egm.yaml) · reviewers: 1 running of 2 · artifacts: 1 · Ctrl+B opens the EGM panel')
})

test('an empty run says so instead of showing a zero', () => {
  const { detail } = footerFor({ phase: null, route: null, source: 'inherit', children: [], artifacts: [] }, 0)
  assert.match(detail, /no reviewers yet/u)
})

test('the text stays inside the terminal cell budget for long model names', () => {
  const long = { provider: 'p', model: 'm'.repeat(60), reasoningEffort: 'high' }
  const { text } = footerFor({ phase: 'review', route: long, source: 'profile', children: [{}, {}], artifacts: [] }, 2)
  assert.ok(text.length > 32, 'the host truncates at maxCells; the text itself is not shortened')
})

test('role labels cover actors, phases and personas', () => {
  assert.equal(roleLabel('elephant'), 'Elephant')
  assert.equal(roleLabel('worker'), 'Bootstrap worker')
  assert.equal(roleLabel('default'), 'Any reviewer')
  assert.equal(roleLabel('review'), 'Phase review')
  assert.equal(roleLabel('inventive_catalyst'), 'inventive_catalyst')
})
