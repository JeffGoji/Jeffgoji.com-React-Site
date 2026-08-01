# Skills

STRAP skills are slash-command workflows the dev-lead and CPO invoke. Each skill is a folder containing a `SKILL.md` definition plus any supporting templates or scripts the workflow needs.

Skills are organized by lifecycle stage in the v2.2 pipeline:

- **Onboarding** -- `/strap-in`, `/connect-devops-project`, `/connect-code-repo`, `/strap-refresh`, `/strap-upgrade`
- **Authoring chain** -- `/new-requirement`, `/refine-requirement`, `/create-spec`, `/refine-spec`, `/generate-features`, `/decompose-feature`
- **Mockup tier** -- `/create-mockups`, `/analyze-mockups`
- **Execution** -- `/plan-sprint`, `/rebalance-sprint`, `/execute-sprint`, `/fix-bugs`, `/quick`, `/refine-pr`
- **Close** -- `/close-ceremony`
- **DORA governance** -- `/dora-reconcile`, `/dora-collect`, `/dora-report`
- **Memory + context** -- `/memory-show`, `/memory-refine`, `/context-prep`, `/context-fetch`
- **Diagnostic + utility** -- `/test-parallel`, `/team-cleanup`, `/reset-feature`, `/file-bugs`

Skills are tech-agnostic. Concrete host operations (work-item creation, PR management, etc.) are resolved through the per-project connection profiles at `.claude/strap/state/{devops,code}-connection.yaml`, written by the `/connect-*` skills during onboarding. See [`../strap/contexts/onboarding-design.md`](../strap/contexts/onboarding-design.md) for the v2 connection-discovery model.
