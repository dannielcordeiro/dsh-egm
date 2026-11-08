/**
 * Offline vendor gate for CI and `npm run verify`.
 *
 * Kept separate from `sync-upstream.mjs` so the checked-in lock is always the
 * authority: this entry point never touches the network and never writes.
 */
import { verify } from './sync-upstream.mjs'

const result = await verify()
if (result.ok) {
  console.log(`vendor ok: ${result.count} files match ${result.commit}`)
} else {
  console.error(`vendor check failed at ${result.commit}:`)
  for (const problem of result.problems) console.error(`  - ${problem}`)
  process.exitCode = 1
}
