import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { PACKAGE_ROOT } from '../src/personas.js'

const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'))
const patch = readFileSync(join(PACKAGE_ROOT, 'cordis.patch.yml'), 'utf8')

test('the manifest exposes exactly what the loader needs', () => {
  assert.equal(manifest.name, '@local/dsh-egm')
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.exports['.'], './src/index.js')
  assert.equal(manifest.exports['./package.json'], './package.json')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.match(manifest.engines.dsh, /<0\.3\.0/u)
  for (const root of ['agents', 'resources', 'skills']) assert.ok(manifest.files.includes(root), `${root} must be packed`)
})

test('the core package declares no browser half', () => {
  assert.equal(manifest.dsh.client, undefined)
})

test('the patch inserts the host row, the reviewer preset and its guard', () => {
  assert.match(patch, /- id: egm\n\s+name: '@local\/dsh-egm'/u)
  assert.match(patch, /- id: preset-egm-reviewer\n\s+name: '@deepseek-ai\/dsh-agent-preset'/u)
  assert.match(patch, /- id: egm-guard\n\s+name: '@local\/dsh-egm\/guard'/u)
  assert.match(patch, /id: egm-reviewer/u)
  assert.match(patch, /write: false/u)
  assert.match(patch, /edit: false/u)
  assert.match(patch, /onInvalidRoute: fail/u)
  assert.match(patch, /policy: model-default/u)
})

test('the guard module is exported for the preset row', () => {
  assert.equal(manifest.exports['./guard'], './src/guard.js')
})

test('the reviewer preset composes no write, shell or delegation surface', () => {
  const preset = patch.slice(patch.indexOf('preset-egm-reviewer'))
  for (const forbidden of ['tool-bash', 'tool-fs-search: { write', 'tool-subagent', 'tool-ask-user', 'tool-job', 'tool-goal']) {
    assert.equal(preset.includes(forbidden), false, `preset must not compose ${forbidden}`)
  }
})

test('the opt-in prerequisite patch exists for bare profiles', () => {
  const prereq = readFileSync(join(PACKAGE_ROOT, 'adapters', 'prereqs', 'agent-presets.patch.yml'), 'utf8')
  assert.match(prereq, /id: agent-preset-registry/u)
  assert.match(prereq, /default: standard/u)
})

test('the upstream lock covers the vendored runtime set', () => {
  const lock = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'upstream.lock.json'), 'utf8'))
  assert.equal(lock.commit, 'e9e1f06aa4e26e95cd4ed37210a0632202c429e9')
  assert.equal(lock.files.length, 27)
  for (const entry of lock.files) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/u)
    assert.ok(entry.bytes > 0)
  }
  const paths = lock.files.map((entry) => entry.path)
  assert.ok(paths.includes('agents/inventive_catalyst.md'), 'the seventh persona must be vendored')
  assert.ok(paths.includes('skills/egm-review/SKILL.md'))
  assert.ok(paths.includes('resources/document_standards/zoom-out-standard.md'))
})
