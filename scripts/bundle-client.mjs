/**
 * Concatenate each browser client from its parts.
 *
 * The Harness Web module loader serves exactly one script per package, so the
 * delivered `src/client.js` of every package must be a single file. It is
 * generated from ordered fragments instead of being hand-maintained: each part is
 * a plain script fragment (no imports, no exports) sharing one closure, so
 * functions can call each other and a test can reach the pure helpers through the
 * plugin object's `__test`.
 *
 *   node scripts/bundle-client.mjs           # write every packages/<name>/src/client.js
 *   node scripts/bundle-client.mjs --check   # fail when any generated file is stale
 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGES_DIR = join(ROOT, 'packages')

const HEADER = (id) => `/**
 * Browser half of \`${id}\` — GENERATED FILE, do not edit.
 *
 * Built from \`src/client/*.js\` by \`scripts/bundle-client.mjs\`
 * (\`npm run build:client\`). The Harness Web module loader serves one script per
 * package, so the parts are concatenated into one closure instead of imported.
 */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(id)},
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    /** Pure helpers exposed to the test suite; assigned by the apply part. */
    let testApi

`

const FOOTER = `
    return { inject, apply, __test: testApi }
  },
})
`

/** Every package that ships browser parts. */
async function discover() {
  const entries = await readdir(PACKAGES_DIR, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const partsDir = join(PACKAGES_DIR, entry.name, 'src', 'client')
    try {
      const files = (await readdir(partsDir)).filter((name) => name.endsWith('.js')).sort()
      if (files.length === 0) continue
      const manifest = JSON.parse(await readFile(join(PACKAGES_DIR, entry.name, 'package.json'), 'utf8'))
      found.push({ name: entry.name, partsDir, files, manifest, target: join(PACKAGES_DIR, entry.name, 'src', 'client.js') })
    } catch {
      // not a browser package
    }
  }
  return found
}

/** Indent a fragment into the loader closure. */
function indent(source) {
  return source
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `    ${line}`))
    .join('\n')
    .replace(/\n+$/u, '')
}

/** Render one package's bundle. */
async function render(pkg) {
  const parts = []
  for (const name of pkg.files) {
    const source = await readFile(join(pkg.partsDir, name), 'utf8')
    parts.push(`    // ---- ${name} ${'-'.repeat(Math.max(0, 66 - name.length))}\n${indent(source)}`)
  }
  return `${HEADER(pkg.manifest.name)}${parts.join('\n\n')}\n${FOOTER}`
}

const packages = await discover()
if (packages.length === 0) {
  console.error('no package with src/client parts was found')
  process.exitCode = 1
} else if (process.argv.includes('--check')) {
  let stale = 0
  for (const pkg of packages) {
    const expected = await render(pkg)
    const current = await readFile(pkg.target, 'utf8').catch(() => '')
    if (current !== expected) {
      console.error(`${relative(ROOT, pkg.target)} is stale: run npm run build:client`)
      stale += 1
    }
  }
  if (stale === 0) console.log(`client bundles are up to date (${packages.length})`)
  else process.exitCode = 1
} else {
  for (const pkg of packages) {
    await writeFile(pkg.target, await render(pkg))
    console.log(`wrote ${relative(ROOT, pkg.target)} from ${pkg.files.length} parts`)
  }
}
