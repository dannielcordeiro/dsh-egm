/**
 * What this installation actually is.
 *
 * A plugin installed by `link:` is re-read only when the Host process boots, so a
 * stale process keeps running old code while the repository is ahead. Reporting the
 * version and the vendored pin in `/egm doctor` turns that into a fact the user can
 * see instead of a mystery.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACKAGE_ROOT } from './personas.js'

let cached

/** `package.json` version plus the upstream commit this tree vendors. */
export function buildInfo() {
  if (cached !== undefined) return cached
  let version = 'unknown'
  let upstream = 'unknown'
  try {
    version = String(JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version ?? 'unknown')
  } catch {
    // a broken manifest is reported elsewhere; the version is informational
  }
  try {
    const lock = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'upstream.lock.json'), 'utf8'))
    upstream = String(lock.commit ?? 'unknown')
  } catch {
    // same
  }
  cached = { version, upstream }
  return cached
}
