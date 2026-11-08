import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { WorkspaceReader, findWorkspaceFile, parseWorkspaceFile, workspaceScope, workspaceSnippet } from '../src/workspace.js'

async function project(files) {
  const root = await mkdtemp(join(tmpdir(), 'egm-ws-'))
  await mkdir(join(root, '.git'), { recursive: true })
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    await mkdir(join(full, '..'), { recursive: true })
    await writeFile(full, content)
  }
  return root
}

test('dotted keys and comments parse', () => {
  const parsed = parseWorkspaceFile([
    '# routes for this project',
    'routing.elephant: anthropic/claude-sonnet-5-5#high',
    '',
    'routing.reviewers.design_critic: ollama/qwen3.5-64k:latest   # cheap',
  ].join('\n'), '.dsh/egm.yaml')
  assert.deepEqual(parsed.problems, [])
  assert.equal(parsed.values['routing.elephant'], 'anthropic/claude-sonnet-5-5#high')
  assert.equal(parsed.values['routing.reviewers.design_critic'], 'ollama/qwen3.5-64k:latest')
})

test('nested blocks and lists are rejected with a line number', () => {
  const parsed = parseWorkspaceFile('routing:\n  elephant: a/b\n- item\n', '.dsh/egm.yaml')
  const text = parsed.problems.join('\n')
  assert.match(text, /:1: routing has no value/u)
  assert.match(text, /:2: nested blocks/u)
  assert.match(text, /:3: lists/u)
})

test('an empty value is a problem', () => {
  const parsed = parseWorkspaceFile('routing.elephant:\n', '.dsh/egm.yaml')
  assert.match(parsed.problems[0], /has no value/u)
})

test('the file becomes the same scope shape as the profile routing block', () => {
  const { scope, problems } = workspaceScope({
    'routing.elephant': 'a/b#high',
    'routing.workers': 'w/m',
    'routing.phases.review': 'r/m',
    'routing.reviewers.default': 'd/m',
    'routing.reviewers.zoom-out': 'z/m',
    'maxTokens.policy': 'fixed',
    'maxTokens.fixed': '4096',
  }, '.dsh/egm.yaml')
  assert.deepEqual(problems, [])
  assert.equal(scope.elephant.provider, 'a')
  assert.equal(scope.workers.model, 'm')
  assert.equal(scope.phases.review.provider, 'r')
  assert.equal(scope.reviewers.default.provider, 'd')
  assert.equal(scope.reviewers.zoom_out.provider, 'z')
  assert.deepEqual(scope.maxTokens, { policy: 'fixed', fixed: 4096 })
})

test('unknown keys and roles are reported', () => {
  const { problems } = workspaceScope({ 'routing.reviewers.nobody': 'a/b', 'routing.nonsense': 'a/b', 'other.key': 'x' }, 'f')
  assert.equal(problems.length, 3)
  assert.match(problems.join('\n'), /unknown reviewer role/u)
  assert.match(problems.join('\n'), /unknown routing key/u)
  assert.match(problems.join('\n'), /unknown key/u)
})

test('discovery walks up from a subdirectory', async () => {
  const root = await project({ '.dsh/egm.yaml': 'routing.elephant: a/b\n' })
  try {
    await mkdir(join(root, 'src', 'deep'), { recursive: true })
    assert.equal(findWorkspaceFile(join(root, 'src', 'deep')), join(root, '.dsh', 'egm.yaml'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('discovery stops at the repository root', async () => {
  const outer = await mkdtemp(join(tmpdir(), 'egm-outer-'))
  const inner = join(outer, 'inner')
  await mkdir(join(outer, '.dsh'), { recursive: true })
  await writeFile(join(outer, '.dsh', 'egm.yaml'), 'routing.elephant: a/b\n')
  await mkdir(join(inner, '.git'), { recursive: true })
  try {
    assert.equal(findWorkspaceFile(inner), undefined)
  } finally {
    await rm(outer, { recursive: true, force: true })
  }
})

test('a project without the file has no scope', async () => {
  const root = await project({})
  try {
    const reader = new WorkspaceReader()
    assert.deepEqual(reader.read(root), { problems: [] })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the reader caches until the file changes', async () => {
  const root = await project({ '.dsh/egm.yaml': 'routing.elephant: a/b\n' })
  try {
    const reader = new WorkspaceReader()
    const first = reader.read(root)
    assert.equal(first.scope.elephant.provider, 'a')
    await writeFile(join(root, '.dsh', 'egm.yaml'), 'routing.elephant: other/model\n')
    const second = reader.read(root)
    assert.equal(second.scope.elephant.provider, 'other')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a snippet renders the keys the file accepts', () => {
  const text = workspaceSnippet({
    elephant: { provider: 'a', model: 'b', reasoningEffort: 'high' },
    phases: { review: { provider: 'r', model: 'm' } },
    reviewers: { default: { provider: 'd', model: 'm' } },
  })
  assert.equal(text, ['routing.elephant: a/b#high', 'routing.phases.review: r/m', 'routing.reviewers.default: d/m'].join('\n'))
})
