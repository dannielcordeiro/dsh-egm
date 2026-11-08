/**
 * Skill registration.
 *
 * The seven upstream `SKILL.md` files are registered with their text untouched;
 * the DeepSeek Harness mechanics live in a preamble built here and prepended at
 * registration time. Refreshing the vendored tree therefore cannot lose harness
 * behaviour, and reading a `SKILL.md` from disk still shows exactly what
 * upstream ships.
 *
 * Both surfaces already have a native way to invoke a user-invocable skill (the
 * terminal mirrors it into the command registry, the browser lists it in the
 * skill picker), so this package registers the skills as-is and uses `egm_begin`
 * for phase routing instead of shadowing the names with its own commands.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PACKAGE_ROOT } from './personas.js'

export const SKILLS_DIR = join(PACKAGE_ROOT, 'vendor', 'skills')

/** Skill directory name to the phase it starts. */
const PHASE_OF_SKILL = Object.freeze({
  'egm-brainstorm': 'brainstorm',
  'egm-draft': 'draft',
  'egm-review': 'review',
  'egm-review-loop': 'review',
  'egm-resolve': 'resolve',
  'egm-bootstrap': 'bootstrap',
  'egm-drift-report': 'drift',
})

/** Parse the small frontmatter subset the vendored skills use. */
export function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u.exec(source)
  if (match === null) return { meta: {}, body: source.trim() }
  const lines = match[1].split(/\r?\n/u)
  const meta = {}
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    const pair = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/u.exec(line)
    if (pair === null) throw new Error(`unsupported frontmatter line: ${JSON.stringify(line)}`)
    let value = pair[2].trim()
    if (/^[>|][+-]?$/u.test(value)) {
      const folded = value.startsWith('>')
      const block = []
      while (index + 1 < lines.length && (/^\s+/u.test(lines[index + 1]) || lines[index + 1].trim() === '')) {
        index += 1
        block.push(lines[index])
      }
      const meaningful = block.map((entry) => entry.trim()).filter((entry) => entry !== '')
      value = folded ? meaningful.join(' ') : meaningful.join('\n')
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[pair[1]] = value
  }
  return { meta, body: source.slice(match[0].length).trim() }
}

/**
 * The harness mapping prepended to every skill.
 * @param {{name: string, directory: string}} skill registered skill.
 */
export function integrationPreamble(skill) {
  const phase = PHASE_OF_SKILL[skill.name] ?? skill.name.replace(/^egm-/u, '')
  return [
    '<dsh_integration>',
    'This is an upstream Elephant-Goldfish Model skill running on DeepSeek Harness. These notes override any incompatible instruction below.',
    `Package root: ${PACKAGE_ROOT}`,
    `This skill's directory: ${skill.directory}`,
    'Resolve `agents/...`, `resources/...` and the upstream plugin-root placeholder against the package root; resolve `references/...` against this skill\'s directory.',
    'Ignore instructions written for another agent harness and its integration documents; those files are not shipped and do not apply here.',
    `Routing: unless the user started this phase with \`/egm-${phase}\`, call \`egm_begin({phase:${JSON.stringify(phase)}})\` once before your first action. It applies the model this deployment configured for the phase and returns it. Do not call it again in the same phase.`,
    'Goldfish reviewers: start each one with `egm_reviewer({description, prompt, role})`. Never use `subagent` or `subagent_fork` for a reviewer. Reviewers are single-use: do not message or resume one; if an answer is truncated or unusable, start a fresh reviewer with the full prompt.',
    'Every reviewer prompt begins with `Persona: <absolute path of the persona file under agents/>`, then Mode, ProjectRoot and GoldfishContext, and in REVIEW mode also TargetFile plus LineRange or SemanticTarget and TargetStandard when one applies. Tell the reviewer to read its Persona file first; do not paste the persona. The child sees none of this conversation.',
    'Bootstrap partition workers write contract files: start them with `egm_worker({description, prompt, role})` and put the return contract in the prompt.',
    'GoldfishContext is a reading list, not a permission grant. Pass it to stages 5, 7, 8 and 9; stage 6 reads the design alone and receives `GoldfishContext: []`. Resolve links relative to the design, strip fragments, skip missing files, and check real paths against the working directory including symlinks. Paths outside it and URLs need the user\'s approval; no child fetches a URL, so save an approved page in the project and pass its path. Omit what cannot be approved and say so.',
    'Review stages 5, 6, 7, 8 and 9 run in order. Parallelize only the reviewers inside the current stage; wait for all of them, write the report, finish the required remediation, then dispatch the next stage. Do not edit the document under review while a stage\'s reviewers run. Uninterrupted mode skips human checkpoints, not these dependencies.',
    'The reviewer guard restricts tool names, not paths: a reviewer can read what its read and search tools reach, and the host may inject project instructions. Reading lists and file boundaries are workflow instructions, not allowlists.',
    'Invoke EGM skills as `/egm-brainstorm`, `/egm-draft`, `/egm-review`, `/egm-review-loop`, `/egm-resolve`, `/egm-bootstrap` and `/egm-drift-report`, with arguments when needed, and use those forms for every handoff. `/egm status`, `/egm routes`, `/egm model` and `/egm doctor` report and change routing.',
    'Author identity: take it from the ingested brief, else the project\'s `git config user.name`, else `GIT_AUTHOR_NAME`; if none is available ask in chat. Never invent an identity or a maintainer decision. Unattended: leave it unresolved and stop at an author-dependent gate.',
    'Keep temporary code and worker status files in a private directory outside the project (host scratch or a newly created unique temporary directory); never use fixed shared filenames. If private scratch cannot be created, keep code in Markdown and omit worker status files.',
    'Interactive gates use `ask_user_question` with one question, `{label, description}` options, no `(Recommended)` prefix, and that call must be the only tool call in the turn.',
    'Write briefs, drafts and reports to the project working directory, or to the directory named by an `EGM artifact directory:` line in the project instructions. Never write them into this package.',
    '</dsh_integration>',
  ].join('\n')
}

/**
 * Load every vendored skill.
 * @param {{userInvocable: boolean}} options whether users reach skills through the registry.
 */
export function loadSkills({ userInvocable = true } = {}) {
  const directories = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  return directories.map((directoryName) => {
    const directory = join(SKILLS_DIR, directoryName)
    const path = join(directory, 'SKILL.md')
    const { meta, body } = parseFrontmatter(readFileSync(path, 'utf8'))
    const name = meta.name
    if (name === undefined || name !== directoryName) {
      throw new Error(`${path}: frontmatter name must be "${directoryName}"`)
    }
    if (body === '') throw new Error(`${path}: empty skill body`)
    const phase = PHASE_OF_SKILL[name]
    return {
      name,
      description: meta.description ?? '',
      content: `${integrationPreamble({ name, directory })}\n\n${body}`,
      invocation: { modelInvocable: true, userInvocable },
      source: 'bundled',
      path,
      resourceBase: { kind: 'directory', path: PACKAGE_ROOT },
      metadata: {
        license: meta.license ?? 'Apache-2.0',
        upstream: 'google/elephant-goldfish-model',
        ...phase === undefined ? {} : { phase },
      },
    }
  })
}

/** Skill names owned by this package, in registration order. */
export function skillNames() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => basename(name))
}
