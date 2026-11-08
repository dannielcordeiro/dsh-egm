import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'))
const patch = readFileSync(join(PACKAGE_ROOT, 'cordis.patch.yml'), 'utf8')

/** Load the client bundle through a stand-in module loader. */
function loadClient() {
  let captured
  const window = {
    __ModuleLoader__: {
      load(definition) {
        captured = definition
      },
    },
  }
  return { window, get captured() { return captured } }
}

/** A React stand-in: the client only builds elements at render time. */
const React = {
  createElement: (...args) => ({ type: 'element', args }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
}

test('the client bundle registers itself under the package name', async () => {
  const loader = loadClient()
  globalThis.window = loader.window
  globalThis.document = { addEventListener() {}, removeEventListener() {} }
  const source = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  const module = { exports: {} }
  const factory = new Function('window', 'module', 'exports', 'require', source)
  factory(loader.window, module, module.exports, (id) => {
    assert.equal(id, 'react')
    return React
  })
  assert.equal(loader.captured.id, '@local/dsh-egm-ui')
  const plugin = loader.captured.factory((id) => {
    if (id === 'react') return React
    throw new Error(`unexpected require(${id})`)
  })
  assert.deepEqual(plugin.inject, ['slots', 'locale'])

  const registrations = []
  const injected = []
  const ctx = {
    locale: { register: (ns, dict) => { registrations.push({ kind: 'locale', ns, dict }) } },
    slots: {
      inject: (name, callback) => {
        injected.push(name)
        callback()
      },
      register: (options, component) => {
        registrations.push({ kind: 'slot', options, component })
        return () => {}
      },
    },
    effect: (fn) => fn(),
  }
  plugin.apply(ctx)

  const locale = registrations.find((entry) => entry.kind === 'locale')
  assert.equal(locale.ns, '@local/dsh-egm-ui')
  assert.equal(typeof locale.dict.en.settingsTitle, 'string')
  assert.equal(typeof locale.dict.pt.settingsTitle, 'string')
  assert.deepEqual(Object.keys(locale.dict.en).sort(), Object.keys(locale.dict.pt).sort(), 'both dictionaries must have the same keys')

  const chip = registrations.find((entry) => entry.kind === 'slot' && entry.options.name === 'conversation.input.right')
  assert.equal(chip.options.id, 'egm-run')
  assert.equal(typeof chip.component, 'function')
  assert.equal(chip.options.inject, undefined, 'the chip needs no session: it reads the projection')

  const card = registrations.find((entry) => entry.kind === 'slot' && entry.options.name === 'tool.call.toolview')
  assert.equal(card.options.key, 'egm_reviewer')

  const section = registrations.find((entry) => entry.kind === 'slot' && entry.options.name === 'settings.section')
  assert.equal(section.options.id, 'egm')
  assert.deepEqual(injected, ['conversation.input.right'])

  // The browser half must never poll a command: a command result is appended to
  // the session transcript, and polling one floods the chat and the host log.
  const bundle = readFileSync(join(PACKAGE_ROOT, 'src', 'client.js'), 'utf8')
  assert.equal(bundle.includes('remote.commands.execute'), false)
  assert.equal(bundle.includes('setInterval'), false)
  assert.ok(bundle.includes('useProjection'))
})

test('the manifest declares a web-only client half with one host entry', () => {
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.exports['./client'], './src/client.js')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal((patch.match(/name: '@local\/dsh-egm-ui'/gu) ?? []).length, 1)
})

test('the host row disables itself when no client host is composed', () => {
  assert.match(patch, /disabled: !!js "!\[\.\.\.ctx\.loader\.entries\(\)\]/u)
  assert.match(patch, /dsh-client-modules/u)
})

test('locales are valid JSON with display metadata', () => {
  for (const language of ['en', 'pt']) {
    const locale = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'locale', `${language}.json`), 'utf8'))
    assert.equal(typeof locale.meta.title, 'string')
    assert.equal(typeof locale.meta.description, 'string')
  }
})
