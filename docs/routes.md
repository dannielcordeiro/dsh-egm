# Routes reference

A route is always the same four fields, matching the harness agent options:

```yaml
provider: anthropic          # a registered llm provider id
model: claude-sonnet-5-5     # an id the provider accepts
reasoningEffort: high        # optional; `effort` is accepted as an alias
maxTokens: 8192              # optional; overrides the output-token policy
```

In commands and in `.dsh/egm.yaml` the same route is written `provider/model#effort`.

## Roles

| Role key | Means |
| --- | --- |
| `elephant` | the model the session uses for the EGM phases unless a phase overrides it |
| `worker` | bootstrap partition workers started with `egm_worker` |
| `brainstorm`, `draft`, `review`, `resolve`, `bootstrap`, `drift` | one phase, applied by `egm_begin` |
| `default` | any reviewer with no route of its own |
| `zoom_out`, `comprehension`, `design_critic`, `structural`, `style`, `implementation_readiness`, `codebase_details`, `inventive_catalyst`, `synthesizer`, `bootstrap_orchestrator` | one reviewer persona |

Aliases are accepted wherever a role is typed: `egm-zoom-out`, `zoom-out`, `zoom_out` are the same role;
`design` and `critic` mean `design_critic`; `readiness` means `implementation_readiness`.

## Precedence

```
session override  →  .dsh/egm.yaml  →  profile `egm` row  →  inherit from the caller
```

`/egm routes` prints the winner and its source for every role. `/egm model set <role> inherit --session`
is a deliberate "stop looking", distinct from removing an override.

## Policies

```yaml
routing:
  onInvalidRoute: fail      # fail | inherit
  onMissingRole: inherit    # inherit | fail
maxTokens:
  policy: model-default     # model-default | inherit | fixed
  fixed: 8192
```

- **onInvalidRoute** — the route was configured but cannot be used (unknown provider or model, unsupported
  effort, missing credentials discovered at preflight).
- **onMissingRole** — nothing was configured for the role at all.
- **maxTokens.policy** — `model-default` asks the target model for its own `defaultMaxTokens` when the
  child's route differs from the caller's; `inherit` keeps the caller's value; `fixed` uses `maxTokens.fixed`.
  An explicit `maxTokens` on a route always wins.

The workspace file may narrow the token policy (`maxTokens.policy` and `maxTokens.fixed`); it cannot change
`onInvalidRoute` or `onMissingRole`, which are deployment decisions.

## `.dsh/egm.yaml`

A deliberately small YAML subset: `dotted.key: value`, one per line, `#` comments, no nesting, no lists.
The reader walks up from the working directory and stops at the directory containing `.git`, so a project
cannot inherit a file from above its own checkout. Errors name the file and the line, and `/egm doctor`
prints the same message.

```yaml
routing.elephant: anthropic/claude-sonnet-5-5#high
routing.phases.review: deepseek-official/deepseek-v4-pro
routing.reviewers.design_critic: anthropic/claude-sonnet-5-5#high
routing.reviewers.default: ollama/lumi-4b
maxTokens.policy: model-default
```

## Pricing

```yaml
pricing:
  anthropic/claude-sonnet-5-5:
    input: 3
    output: 15
    cacheRead: 0.3
    cacheWrite: 3.75
```

Prices are per million tokens, in whatever currency you want to read them in. The run view reports an
estimate from the tokens it observed and counts unpriced children separately.
