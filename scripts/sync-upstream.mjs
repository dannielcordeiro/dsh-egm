/**
 * Vendor the upstream Elephant-Goldfish Model content this package ships.
 *
 * The skills, reviewer personas and document standards are redistributed
 * VERBATIM from google/elephant-goldfish-model at a pinned commit. This script
 * never edits their text: it downloads the pinned revision, writes the runtime
 * subset under `packages/core/vendor/` and records one SHA-256 per file in
 * `upstream.lock.json`.
 *
 *   node scripts/sync-upstream.mjs            # fetch the pin, write vendor + lock
 *   node scripts/sync-upstream.mjs --check    # verify vendor against the lock (offline)
 *
 * `--check` is what CI runs: it fails when a vendored byte drifts, when a file
 * is missing, or when an unexpected file appears under the runtime roots.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VENDOR_DIR = join(ROOT, 'packages', 'core', 'vendor')
const LOCK_PATH = join(ROOT, 'packages', 'core', 'upstream.lock.json')

/** Upstream repository and the revision this package redistributes. */
export const UPSTREAM = Object.freeze({
  repository: 'google/elephant-goldfish-model',
  branch: 'main',
  commit: 'e9e1f06aa4e26e95cd4ed37210a0632202c429e9',
})

/**
 * Runtime paths this package vendors. Everything else upstream ships (test
 * fixtures, per-harness manifests, site sources, screenshots) stays upstream:
 * the vendored set is what a running EGM workflow reads.
 */
const RUNTIME_PREFIXES = Object.freeze(['agents/', 'resources/'])
const RUNTIME_SKILL_FILES = Object.freeze([
  /^skills\/[^/]+\/SKILL\.md$/u,
  /^skills\/[^/]+\/references\/[^/]+$/u,
])

/** Whether one upstream path belongs to the runtime set. */
export function isRuntimePath(path) {
  if (RUNTIME_PREFIXES.some((prefix) => path.startsWith(prefix) && !path.endsWith('/'))) return true
  return RUNTIME_SKILL_FILES.some((pattern) => pattern.test(path))
}

/** SHA-256 of an exact byte sequence. */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Deterministic JSON so the lock diff is readable. */
function serializeLock(lock) {
  const files = [...lock.files].sort((left, right) => left.path.localeCompare(right.path))
  return `${JSON.stringify({ ...lock, files }, null, 2)}\n`
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsh-egm-sync' } })
  if (!response.ok) throw new Error(`${url} responded ${response.status} ${response.statusText}`)
  return response.json()
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'dsh-egm-sync' } })
  if (!response.ok) throw new Error(`${url} responded ${response.status} ${response.statusText}`)
  return Buffer.from(await response.arrayBuffer())
}

/** List the pinned revision's runtime paths through the GitHub tree API. */
async function remoteRuntimePaths(commit) {
  const tree = await fetchJson(`https://api.github.com/repos/${UPSTREAM.repository}/git/trees/${commit}?recursive=1`)
  if (tree.truncated === true) throw new Error('the GitHub tree response was truncated; refusing to sync a partial set')
  return tree.tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter(isRuntimePath)
    .sort()
}

/** Walk the vendored tree and return every file path, relative to `vendor/`. */
async function localRuntimePaths() {
  const found = []
  async function walk(directory) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const full = join(directory, entry.name)
      if (entry.isDirectory()) await walk(full)
      else found.push(relative(VENDOR_DIR, full).split(sep).join('/'))
    }
  }
  await walk(VENDOR_DIR)
  return found.sort()
}

/** Whether a path under the vendor root is one the runtime set expects. */
export function isVendoredRuntimePath(path) {
  return isRuntimePath(path)
}

/** Download the pin and rewrite both the vendor tree and the lock. */
export async function sync({ write = console.log } = {}) {
  const paths = await remoteRuntimePaths(UPSTREAM.commit)
  if (paths.length === 0) throw new Error('the pinned revision exposed no runtime files')
  const files = []
  for (const path of paths) {
    const bytes = await fetchBytes(`https://raw.githubusercontent.com/${UPSTREAM.repository}/${UPSTREAM.commit}/${path}`)
    const target = join(VENDOR_DIR, ...path.split('/'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
    files.push({ path, bytes: bytes.byteLength, sha256: sha256(bytes) })
    write(`vendored ${path}`)
  }
  const lock = {
    schemaVersion: 1,
    repository: UPSTREAM.repository,
    branch: UPSTREAM.branch,
    commit: UPSTREAM.commit,
    license: 'Apache-2.0',
    copyright: 'Copyright Google LLC',
    files,
  }
  await writeFile(LOCK_PATH, serializeLock(lock))
  write(`wrote ${relative(ROOT, LOCK_PATH)} with ${files.length} files`)
  return lock
}

/** Verify the vendored tree against the lock without network access. */
export async function verify() {
  const lock = JSON.parse(await readFile(LOCK_PATH, 'utf8'))
  const problems = []
  const expected = new Set(lock.files.map((entry) => entry.path))
  for (const entry of lock.files) {
    const bytes = await readFile(join(VENDOR_DIR, ...entry.path.split('/')))
    const actual = sha256(bytes)
    if (actual !== entry.sha256) problems.push(`drift: ${entry.path} (lock ${entry.sha256.slice(0, 12)}, file ${actual.slice(0, 12)})`)
    if (bytes.byteLength !== entry.bytes) problems.push(`size: ${entry.path} (lock ${entry.bytes}, file ${bytes.byteLength})`)
  }
  for (const path of await localRuntimePaths()) {
    if (!expected.has(path)) problems.push(`unexpected vendored file: ${path}`)
  }
  for (const entry of lock.files) {
    if (!isVendoredRuntimePath(entry.path)) problems.push(`lock lists a non-runtime path: ${entry.path}`)
  }
  return { ok: problems.length === 0, problems, commit: lock.commit, count: lock.files.length }
}

const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  if (process.argv.includes('--check')) {
    const result = await verify()
    if (!result.ok) {
      console.error(`vendor check failed at ${result.commit}:`)
      for (const problem of result.problems) console.error(`  - ${problem}`)
      process.exitCode = 1
    } else {
      console.log(`vendor ok: ${result.count} files match ${result.commit}`)
    }
  } else {
    await sync()
  }
}
