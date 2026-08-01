# Templates

Generated artifacts and starting points the STRAP pipeline reads or adopters can copy.

- `connection-templates/` -- per-host accelerator YAML for `/connect-devops-project` and `/connect-code-repo` (Azure DevOps, GitHub, Jira, Bitbucket, Local Git, Local strap-agile).
- `docs/` -- installer-rendered templates (e.g., the install summary written into the adopter's `.claude/strap/docs/install-summary.md`).
- `project-docs/` -- templates rendered by `tech-writer` at the closing phases of `/strap-in` and `/strap-refresh` (`PROJECT.md.template.md`, `ARCHITECTURE.md.template.md`, `STACK.md.template.md`).
- `work-items/` -- work-item description templates (specification, feature, story, task, bug, requirement) consumed by the authoring chain (`/create-spec`, `/refine-spec`, `/generate-features`, `/decompose-feature`, `/file-bugs`, etc.).
- `project-profile.scaffold.md` -- the install-time scaffold the dev-lead populates during `/strap-in` to produce the curated `.claude/strap/contexts/project-profile.md`.

Templates use Mustache placeholder substitution. Values that vary per installation come from the curated `project-profile.md` or the connection-profile YAMLs at `.claude/strap/state/`. The v1 `project.yaml` substitution model is replaced by these v2 sources.
