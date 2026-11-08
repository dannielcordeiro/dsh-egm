# Migration from `dsh-egm` 0.3.1

`dsh-egm` 0.3.1 (npm) registered the same seven skills, the same `egm-reviewer` preset and a tool also
called `egm_reviewer`. Two bundles that both register those names cannot coexist: the loader keeps one of
each and warns about the other, and the preset id collides outright. Migrating means removing the old
bundle, installing the two new packages, and restarting.

## Steps

```bash
# 0. record the current state
cp ~/.dsh/profiles/<profile>/package.json       ~/.dsh/profiles/<profile>/package.json.bak-egm
cp ~/.dsh/profiles/<profile>/cordis.patch.yml   ~/.dsh/profiles/<profile>/cordis.patch.yml.bak-egm

# 1. remove the old bundle (repeat per profile: dsh-tui, web)
dsh plugin --profile dsh-tui remove dsh-egm

# 2. install the new packages
dsh plugin --profile dsh-tui add /path/to/dsh-egm/packages/core
dsh plugin --profile dsh-tui add /path/to/dsh-egm/packages/ui

# 3. restart the profile, then check
#    in the session:
/egm doctor
/egm routes
```

For a profile seeded from `headless` or `sdk`, also launch with the prerequisite overlay:

```bash
dsh headless --patch <installed package>/adapters/prereqs/agent-presets.patch.yml
```

## What changes for the user

| Before (0.3.1) | After (1.0) |
| --- | --- |
| `egm_reviewer({description, prompt})` | `egm_reviewer({description, prompt, role, stage, route})` — the first two still work |
| reviewers always inherit the session model | a role route may send a reviewer to another model; nothing configured behaves as before |
| no phase routing | `egm_begin({phase})`, called once per phase, applies the phase route |
| bootstrap workers use `subagent` | bootstrap workers use `egm_worker`; the injected preamble says so |
| nine personas (pin `113a3af`) | ten personas (pin `e9e1f06`) — `inventive_catalyst` joins the brainstorm lenses and Stage 5 |
| `/egm-*` skills as before | unchanged; the skills are still the same files |
| no run view | `/egm status`, `/egm report`, a terminal footer/panel and a browser chip |

Reviewer isolation is unchanged in kind and stronger in one respect: the guard now also lives inside the
preset as its own row, so it applies to a reviewer started by any path, not only by `egm_reviewer`.

## Rolling back

```bash
dsh plugin --profile <profile> remove @local/dsh-egm
dsh plugin --profile <profile> remove @local/dsh-egm-ui
dsh plugin --profile <profile> add dsh-egm
cp ~/.dsh/profiles/<profile>/cordis.patch.yml.bak-egm ~/.dsh/profiles/<profile>/cordis.patch.yml
```

## Conflicts to expect

- A route configured for the same role in both the workspace file and the profile is not an error: the
  workspace wins and `/egm routes` says so.
- A profile patch that still disables the old `egm` row is harmless — the ids are the same as this
  package's, so remove those stale disable entries when you migrate.
- The old bundle's `preset-egm-reviewer` row id is also reused. That is intentional: the migration is a
  replacement, not a parallel install.
