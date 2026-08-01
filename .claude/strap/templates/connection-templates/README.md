# Connection-template starters

Starter `operation_templates` blocks per host. Shipped in v2.5 (#39698) to give adopters a working baseline rather than hand-authoring 12-15 templates per host during onboarding.

## What ships here

| File | Host | Coverage |
|---|---|---|
| `azure-devops.yaml` | Azure DevOps (Boards + Repos) | Full -- the canonical reference. Used as the model when adapting to other hosts. |
| `github.yaml` | GitHub Issues + GitHub Actions + Git refs | Most-common operations via `gh` CLI + REST. Adopter extends as needed. |
| `jira.yaml` | Jira Cloud (Jira Software / Service Management) | Most-common operations via REST + API token. Adopter extends as needed. |
| `bitbucket.yaml` | Bitbucket Cloud (Repos + Pipelines) | Most-common operations via REST + app password. Adopter extends as needed. |
| `strap-agile.yaml` | Local YAML schema (no remote host) | Minimal reference; local file operations are dev-lead-direct, not template-driven. |

## How `/connect-devops-project` and `/connect-code-repo` use these

When the CPO selects a host at Step 1, the connect skill copies the corresponding starter file's `operation_templates` block into the draft `devops-connection.yaml` or `code-connection.yaml`. The adopter confirms (or revises) field mappings + auth env-var names; the operation_templates ride along.

The starter is a strong default, not a contract. Adopters who need custom REST paths, additional headers, or alternative CLI patterns override individual entries inline -- the persisted profile is always the source of truth.

## Schema

Each top-level key under `operation_templates:` is a logical operation declared in the host's `capabilities` block. Each value is one of:

- `type: cli` -- a CLI invocation with `{{placeholder}}` substitution. Carries `command:` (multi-line string).
- `type: rest` -- a single HTTP request. Carries `method:`, `path:`, `headers:` (optional), `body_template:` (optional, for POST/PATCH).
- `type: rest-recipe` -- a sequence of REST steps with captured state between them. Used for operations that require optimistic-concurrency anchors (e.g., ADO Repos `branch_delete_remote` requires `ref_get` first to capture the current `objectId`).

Placeholders use `{{name}}` syntax. Optional placeholders use `{{name?}}` -- when the caller omits the value, the consumer strips that field from the request body.

## Adopter customization

The starter files are reference content owned by the package. They live under `.claude/strap/templates/` and are package-managed in the diff/apply rules. Adopter customizations belong in the persisted connection profiles at `.claude/strap/state/{devops,code}-connection.yaml`, NOT in the starter files. The starter files are intentionally pristine so adopters can re-copy the canonical reference cleanly if they want to.

## Authoring conventions

- All examples assume token authentication via env var references; the values never appear in YAML.
- REST examples assume the host's primary domain (no on-prem variations).
- Mustache-style `{{placeholder}}` for substitution; literal `{` / `}` are double-escaped where needed.
- Comments call out gotchas inline (e.g., "POST is correct, not PATCH"; "this endpoint requires a specific Accept header on server-side filtering").

See [`onboarding-design.md`](../../contexts/onboarding-design.md#operation-templates) for the connection-template doctrine. See [`connect-devops-project/SKILL.md`](../../../skills/connect-devops-project/SKILL.md) and [`connect-code-repo/SKILL.md`](../../../skills/connect-code-repo/SKILL.md) for the auth recipes per host.
