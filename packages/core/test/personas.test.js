import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { AGENTS_DIR, PACKAGE_ROOT, normalizeRole, persona, personas, reviewerRoles, roleFromPrompt } from '../src/personas.js'

test('every vendored persona is in the catalogue', () => {
  const roles = reviewerRoles()
  assert.equal(roles.length, 10)
  for (const role of ['zoom_out', 'comprehension', 'design_critic', 'structural', 'style', 'implementation_readiness', 'codebase_details', 'inventive_catalyst', 'synthesizer', 'bootstrap_orchestrator']) {
    assert.ok(roles.includes(role), `${role} missing`)
  }
})

test('persona metadata comes from the vendored frontmatter', () => {
  const zoom = persona('zoom_out')
  assert.equal(zoom.name, 'egm-zoom-out')
  assert.match(zoom.description, /Simplicity|Skeptical/u)
  assert.equal(zoom.file, 'zoom_out.md')
  assert.equal(zoom.path, join(AGENTS_DIR, 'zoom_out.md'))
  assert.ok(readFileSync(zoom.path, 'utf8').startsWith('---'))
})

test('the catalogue is loaded once', () => {
  assert.equal(personas(), personas())
})

test('role spellings collapse to the persona stem', () => {
  assert.equal(normalizeRole('zoom_out'), 'zoom_out')
  assert.equal(normalizeRole('zoom-out'), 'zoom_out')
  assert.equal(normalizeRole('egm-zoom-out'), 'zoom_out')
  assert.equal(normalizeRole('ZOOM'), 'zoom_out')
  assert.equal(normalizeRole('design'), 'design_critic')
  assert.equal(normalizeRole('critic'), 'design_critic')
  assert.equal(normalizeRole('readiness'), 'implementation_readiness')
  assert.equal(normalizeRole('elephant'), 'elephant')
  assert.equal(normalizeRole('default'), 'default')
  assert.equal(normalizeRole('reviewer'), 'default')
  assert.equal(normalizeRole('reviewers'), 'default')
  assert.equal(normalizeRole('any'), 'default')
  assert.equal(normalizeRole('padrao'), 'default')
  assert.equal(normalizeRole('nobody'), undefined)
  assert.equal(normalizeRole(42), undefined)
})

test('the role is read from the upstream Persona line', () => {
  assert.equal(roleFromPrompt('Persona: /pkg/vendor/agents/design_critic.md\nMode: REVIEW'), 'design_critic')
  assert.equal(roleFromPrompt('  Persona: /pkg/vendor/agents/egm-zoom-out.md  '), 'zoom_out')
  assert.equal(roleFromPrompt('Persona: "zoom_out"'), 'zoom_out')
  assert.equal(roleFromPrompt('no envelope here'), undefined)
  assert.equal(roleFromPrompt(undefined), undefined)
})

test('the package root resolves above src/', () => {
  assert.ok(PACKAGE_ROOT.endsWith('/'))
  assert.ok(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8').includes('@local/dsh-egm'))
})
