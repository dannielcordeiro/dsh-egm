# `@local/dsh-egm` — host half

Registers the vendored EGM skills, the `egm-reviewer` preset with its read-only guard, the three tools
(`egm_reviewer`, `egm_worker`, `egm_begin`), the `/egm` command, the `egmRun` projection and the terminal
surfaces. No browser code: the Web surfaces are `@local/dsh-egm-ui`.

Everything user-facing is in the repository README: install, routes, commands and limits. Implementation
notes are in `docs/architecture.md` at the repository root, and the file layout is described at the top of
`src/index.js`.
