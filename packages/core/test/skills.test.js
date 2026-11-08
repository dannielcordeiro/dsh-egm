import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { PACKAGE_ROOT } from '../src/personas.js'
import { integrationPreamble, loadSkills, skillNames } from '../src/skills.js'

const skills = loadSkills({ userInvocable: true })

test('all seven vendored skills load', () => {
  assert.deepEqual(skillNames(), [
    'egm-bootstrap',
    'egm-brainstorm',
    'egm-draft',
    'egm-drift-report',
    'egm-resolve',
    'egm-review',
    'egm-review-loop',
  ])
  assert.equal(skills.length, 7)
})

test('each skill keeps its upstream name, description and body', () => {
  for (const skill of skills) {
    assert.match(skill.name, /^egm-[a-z-]+$/u)
    assert.ok(skill.description.length > 40, `${skill.name} has no description`)
    assert.ok(skill.content.includes('<dsh_integration>'))
    const upstream = readFileSync(join(PACKAGE_ROOT, 'skills', skill.name, 'SKILL.md'), 'utf8')
    assert.ok(upstream.includes(skill.description.split(' ').slice(0, 4).join(' ')))
    assert.equal(skill.source, 'bundled')
    assert.equal(skill.invocation.modelInvocable, true)
    assert.equal(skill.invocation.userInvocable, true)
    assert.deepEqual(skill.resourceBase, { kind: 'directory', path: PACKAGE_ROOT })
  }
})

test('the preamble states the harness mechanics the upstream text needs', () => {
  const preamble = integrationPreamble({ name: 'egm-review', directory: join(PACKAGE_ROOT, 'skills', 'egm-review') })
  for (const needle of [
    'Package root:',
    'This skill\'s directory:',
    'egm_begin({phase:"review"})',
    'egm_reviewer({description, prompt, role})',
    'egm_worker({description, prompt, role})',
    'Never use `subagent` or `subagent_fork`',
    'single-use',
    'GoldfishContext: []',
    'stages 5, 6, 7, 8 and 9',
    'ask_user_question',
    'EGM artifact directory:',
    '/egm doctor',
  ]) {
    assert.ok(preamble.includes(needle), `preamble is missing ${needle}`)
  }
})

test('the phase in the preamble follows the skill', () => {
  const phaseOf = (name) => /egm_begin\(\{phase:"([a-z]+)"\}\)/u.exec(integrationPreamble({ name, directory: '/x' }))[1]
  assert.equal(phaseOf('egm-brainstorm'), 'brainstorm')
  assert.equal(phaseOf('egm-review-loop'), 'review')
  assert.equal(phaseOf('egm-drift-report'), 'drift')
})

test('a skill can be registered as user-invocable when commands are disabled', () => {
  const [first] = loadSkills({ userInvocable: false })
  assert.equal(first.invocation.userInvocable, false)
  assert.equal(first.invocation.modelInvocable, true)
})
