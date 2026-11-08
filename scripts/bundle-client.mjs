/**
 * Concatenate the browser client from its parts.
 *
 * The Harness Web module loader serves exactly one script per package, so the
 * delivered `src/client.js` must be a single file. It is generated from ordered
 * fragments instead of being hand-maintained: each part is a plain script
 * fragment (no imports, no exports) sharing one closure, so functions can call
 * each other and a test can reach the pure helpers through the plugin object.
 *
 *   node scripts/bundle-client.mjs           # write packages/ui/src/client.js
 *   node scripts/bundle-client.mjs --check   # fail when the file is stale
 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PARTS_DIR = join(ROOT, 'packages', 'ui', 'src', 'client')
const TARGET = join(ROOT, 'packages', 'ui', 'src', 'client.js')

const HEADER = `/**
 * Browser half of \`@local/dsh-egm-ui\` — GENERATED FILE, do not edit.
 *
 * Built from \`packages/ui/src/client/*.js\` by \`scripts/bundle-client.mjs\`
 * (\`npm run build:client\`). The Harness Web module loader serves one script per
 * package, so the parts are concatenated into one closure instead of imported.
 *
 * Surfaces: the EGM window (runs, configuration, artifacts, diagnostics), the
 * composer chip that opens it, the \`/egm\` command row, the reviewer card and the
 * settings page. The client never polls: every command it runs is a click.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-egm-ui',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

`

const FOOTER = `
    return { inject, apply, __test: { buildRuns, statusOf, routeTextOf, formatTokens, formatDuration, mergeChildren, routeCommand, testCommand, applyPlan } }
  },
})
`

/** Every fragment, in load order. */
async function parts() {
  const names = (await readdir(PARTS_DIR)).filter((name) => name.endsWith('.js')).sort()
  const rendered = []
  for (const name of names) {
    const source = await readFile(join(PARTS_DIR, name), 'utf8')
    rendered.push(`    // ---- ${name} ${'-'.repeat(Math.max(0, 66 - name.length))}\n${indent(source)}`)
  }
  return rendered
}

/** Indent a fragment into the loader closure. */
function indent(source) {
  return source
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `    ${line}`))
    .join('\n')
    .replace(/\n+$/u, '')
}

const body = (await parts()).join('\n\n')
const output = `${HEADER}${body}\n${FOOTER}`

if (process.argv.includes('--check')) {
  const current = await readFile(TARGET, 'utf8').catch(() => '')
  if (current !== output) {
    console.error(`packages/ui/src/client.js is stale: run npm run build:client`)
    process.exitCode = 1
  } else {
    console.log('client bundle is up to date')
  }
} else {
  await writeFile(TARGET, output)
  console.log(`wrote ${relative(ROOT, TARGET)} from ${(await readdir(PARTS_DIR)).length} parts`)
}
