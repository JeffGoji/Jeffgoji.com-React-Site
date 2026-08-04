# A Simple STRAP Walkthrough

This is the read-along narrative for a new CPO landing STRAP on their first project. Follow along on your own codebase; the steps assume nothing about your stack. By the end, you'll have onboarded STRAP, connected it to a DevOps host, filed a Requirement, driven it through to a Pull Request, and rendered your first DORA report.

The walkthrough uses a deliberately tiny example: adding a one-line comment block to a single file. Don't worry that the work is trivial -- the point is to feel the full pipeline end-to-end with the smallest possible payload.

Time budget: ~45-60 minutes for the first read-along. Most of it is reading the dev-lead's structured surfaces and confirming the choices; STRAP does the synthesis work.

## Before you start

You need:

- A real project on your machine. Any stack works -- TypeScript, Python, Go, C#, Rust, anything STRAP doesn't already know about. STRAP probes the stack live.
- A DevOps host wired up: Azure DevOps, GitHub, Jira+Bitbucket, or strap-agile (Local) if you don't have a remote tracker. Have your auth credentials available (env vars set; tokens in scope).
- A source-control host: Azure Repos, GitHub, Bitbucket, or Local Git.
- Claude Code installed and authenticated. Run `claude` in the project root.

Optional but recommended: a fresh feature branch in your repo, so this walkthrough's PR doesn't land on `main` accidentally.

## Step 1: `/strap-in`

Your first command. The dev-lead reads your codebase, infers your stack, dispatches relevant specialists in parallel for read-only discovery, and curates the persistence stack (project profile, per-agent memory, per-agent rules) for your project specifically.

```
/strap-in
```

What you'll see:

1. **Discovery phase.** The dev-lead surveys your repo -- file extensions, build configs, package manifests, existing CI yaml. It detects single-repo vs polyrepo. It probes for sub-repos. It infers active domains (frontend, backend, database, integration, devops, etc.).
2. **Approval gate.** The dev-lead surfaces what it inferred and asks you to confirm or correct. This is the first place to step in if the inference missed something -- maybe your TypeScript project has a Python script in `tools/` that the inference flagged as a second active domain when it shouldn't be.
3. **Specialist dispatch.** Once you confirm, the dev-lead dispatches active-domain specialists in parallel (backend-engineer, frontend-engineer, database-engineer, etc.) for deep read-only research. Each specialist reads its assigned domain and reports back; the dev-lead synthesizes.
4. **Persistence-stack curation.** The dev-lead writes:
   - `.claude/strap/contexts/project-profile.md` -- the curated record of THIS project (stack, conventions, commands, architecture)
   - `.claude/strap/memory/agents/<name>.md` per active specialist -- seed memory pre-populated with your project's patterns
   - `.claude/strap/rules/agents/<name>.md` per active specialist -- guardrails specific to your stack
5. **Project-docs phase.** The tech-writer writes `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` to your project's docs path (or the configured fallback). These are human-readable narratives derived from the same discovery.

When `/strap-in` finishes, your project has STRAP-aware persistence. Re-running `/strap-in` is safe and idempotent (re-discovery mode); use `/strap-refresh` for incremental updates.

## Step 2: `/connect-devops-project`

Wire up work-item tracking. The dev-lead asks which host (Azure DevOps / GitHub Issues / Jira / Local strap-agile / Other), probes the host's capabilities, models the logical-to-host mapping for the 7 STRAP work-item types (Requirement / Spec / Feature / Story / Task / Bug / Enhancement), and persists a connection profile.

```
/connect-devops-project
```

Key steps:

1. **Host pick.** Name the host. Each option's `AskUserQuestion` description tells you what auth is needed.
2. **Authenticate.** The dev-lead probes the host with a no-op call (e.g., `GET /projects?$top=1` for ADO). Failed auth surfaces inline with a remediation hint.
3. **Probe the host's work-item types + state machines.** v2.5 #39697: instead of assuming defaults, STRAP probes the host directly. It surfaces what it found (e.g., "Found work-item types: Epic, Feature, User Story, Task, Bug, Issue") + proposes a STRAP-logical mapping. You either Accept, Customize, or Reject.
4. **State-machine collapse confirmation.** Per work-item type, STRAP surfaces the probed states + its proposed STRAP-logical collapse. Most adopters accept; custom-template adopters use the Customize flow.
5. **Field probe + cross-version rename detection.** STRAP validates that every field declared in the connection profile actually exists on the host's process template. v2.5 #39702 also detects renames (e.g., `Custom.PullRequestUrl` -> `Custom.PRUrl`) and offers to update the mapping.
6. **Validation + persist.** STRAP surfaces the assembled profile, you confirm, profile lands at `.claude/strap/state/devops-connection.yaml`.

For polyrepo umbrellas, Step 6 walks each non-primary sub-repo for its own work-tracking config (Same as primary / Different project / etc.).

## Step 3: `/connect-code-repo`

Wire up source control. Similar shape to `/connect-devops-project` -- pick the host, authenticate, probe, model, validate, persist.

```
/connect-code-repo
```

Key auth recipes (v2.5 #39698):

- **Azure Repos**: bearer token via `az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798`
- **GitHub**: fine-grained PAT preferred (Contents/Pull requests/Actions scopes) OR `gh auth login`
- **Bitbucket Cloud**: app password from your Atlassian account
- **Local Git**: no remote auth; branch_push / branch_delete_remote are unsupported

The connection profile lands at `.claude/strap/state/code-connection.yaml`. The "satisfied" gate -- the deliberate transition from onboarding mode to operational mode -- releases when this skill clears.

## Step 4: `/new-requirement`

Time to create work. A Requirement is the entry point for any new piece of intent. The dev-lead dispatches `req-lead` to author the initial Requirement body + probe questions, persists with v2.2 lifecycle metadata, and drives the first refinement pass conversationally.

For our toy example, run:

```
/new-requirement
```

When STRAP asks "What is the requirement?", paste:

> Add a one-line comment block at the top of `<pick any file in your repo>` documenting what the file is for.

STRAP creates the Requirement work item in your DevOps host, tags it with `strap:requirement`, marks it `Authored By: AI` (or your account, depending on the connection profile), and surfaces the initial body + a list of clarifying questions.

## Step 5: `/refine-requirement <id>`

Drive the Requirement toward Resolved. The dev-lead probes for ambiguity and walks you through clarifying questions until the requirement is implementable.

```
/refine-requirement <the-id-you-got-from-step-4>
```

For the toy example, the refinement is trivial -- the dev-lead might ask:
- "What file specifically?" → answer with the path
- "What style of comment block?" → JSDoc / docstring / structured / whatever your language uses
- "Anything else?" → no

After a round or two, the dev-lead surfaces a Resolved-ready summary + `AskUserQuestion` for the approval gate. You confirm; the Requirement transitions to Resolved.

## Step 6: `/create-spec <requirement-id>`

A Resolved Requirement isn't yet implementable. The Spec phase translates the Requirement into a detailed technical specification: which Constituent Parts (frontend / backend / database / etc.) get touched, what changes per CP, how they interact, what acceptance criteria look like.

```
/create-spec <requirement-id>
```

For our toy example, the Spec is small -- one CP (the file you named), one change (add a comment block at top), zero cross-CP coordination. Larger requirements decompose into multi-CP Specs.

The dev-lead dispatches `spec-lead` to author the initial Spec outline, links it back to the source Requirement, and surfaces the body for your review.

## Step 7: `/refine-spec <id>`

Similar to `/refine-requirement` but at Spec depth. Walks section-by-section: research the codebase, surface gaps, populate Constituent Parts with technical depth, drive to Resolved.

```
/refine-spec <spec-id>
```

For the toy, this is also fast. The dev-lead might confirm:
- The file's current state (no comment block exists OR an existing one needs replacing).
- The comment block contents (Description / Author / Last-modified / etc.).
- Acceptance criteria (file builds with the new block; existing tests still pass).

Resolved Spec.

## Step 8: `/generate-features <spec-id>`

A Spec produces Features. For our toy, one Feature is enough. Larger Specs decompose into multiple Features that can be parallelized across sprints.

```
/generate-features <spec-id>
```

The dev-lead dispatches `spec-lead` to author Feature briefs, applies v2.2 lifecycle metadata + tags, persists the Features in your work-tracker.

## Step 9: `/decompose-feature <feature-id>`

A Feature decomposes into Stories + Tasks. For our toy, one Story + one Task is plenty.

```
/decompose-feature <feature-id>
```

The dev-lead reads the linked Spec, activates any required domains (CPO-gated structural precondition), dispatches active-domain specialists in parallel for read-only planning, reconciles their output, and persists work items.

When `/decompose-feature` finishes, the Feature has a child Story has a child Task. The Task carries `OriginalEstimate` (e.g., 0.5 hours for a one-line comment block).

## Step 10: `/execute-sprint <feature-id>`

Now execute. The dev-lead creates a feature branch, sequences Tasks by dependency, dispatches active-domain specialists in worktrees (one specialist per Task, isolated from each other), reviews each task branch, runs the integration audit, sets v2.2 completion metadata at resolution, and prepares the PR.

```
/execute-sprint <feature-id>
```

For the toy: one Task → one specialist → one tiny code change → one git commit → one PR. You'll see the dev-lead orchestrate this conversationally; specialists work in isolated worktrees so you can observe progress without context-switching pain.

When `/execute-sprint` finishes, you have:
- A feature branch with the implementation committed
- The Task marked Resolved with `CompletedWork` set
- A PR opened against the integration branch

## Step 11: PR review + merge

This is your moment to review. STRAP doesn't merge for you -- the CPO is the deliberate gatekeeper. Walk the PR diff in your DevOps host, confirm the change matches the Spec, request changes if needed (via `/refine-pr <pr-id>` from STRAP), and merge.

## Step 12: `/dora-collect` + `/dora-report`

Now see how it looked.

```
/dora-collect
```

The dev-lead queries work items + revisions, pipeline runs (bucketed by your project profile's Layers), pull requests (split by integration target vs intermediate per your code-connection), and writes a structured JSON snapshot at `.claude/strap/state/dora-snapshots/`.

Then:

```
/dora-report
```

The dev-lead builds a PAYLOAD from the snapshot, assembles head + render + tail via the html-render pipeline, runs the verify-then-write quality gates, and writes a self-contained HTML report. Open it in a browser.

For our toy walkthrough you'll see a single-PR sprint -- not much to compare against. After a few real sprints the report becomes rich: sprint-over-sprint comparison, per-developer trend lines, the DORA-4 strip at the top, the methodology section explaining how each metric was computed.

See [`./dora-tuning.md`](./dora-tuning.md) for getting the most out of the report over time.

## What you've done

In ~45 minutes you went from `claude` prompt to a STRAP-onboarded project with a real work item driven end-to-end and a DORA report rendered. The pipeline did not invent files in your codebase, did not modify production code during onboarding, and did not act without your approval at any of the gates.

This is the operational shape of STRAP. The toy example is trivial; real Requirements get richer treatment at each step. The same skills handle:

- A bug a customer reported: `/file-bugs` → `/fix-bugs <bug-id>` → PR.
- A 12-Task Feature that touches frontend, backend, and database: `/decompose-feature` produces a parallel-safe Task graph; `/execute-sprint` runs specialists concurrently in isolated worktrees.
- A polyrepo umbrella with three sub-repos and different deployment targets: STRAP's polyrepo model gives per-sub-repo connection-profile overrides + per-layer DORA metrics.

## Next steps

- **Add more Requirements + drive a real sprint.** Use the toy walkthrough's flow on actual work; the muscle memory builds quickly.
- **Run `/dora-reconcile --auto-fix` weekly.** Keeps the data layer clean (state transitions, AI tags, CompletedWork).
- **Run `/close-ceremony` per sprint.** The deliberate value-acceptance ritual for Resolved work items.
- **Read [`./dora-tuning.md`](./dora-tuning.md)** for getting the most from the DORA report over time.
- **Read [`./architecture.md`](./architecture.md)** for the contributor-depth mental model of why STRAP is built this way.
- **Read [`./customization-guide.md`](./customization-guide.md)** if you want to extend STRAP with a project-specific specialist (e.g., a stack-tier specialist STRAP doesn't ship by default).

## A note on the future

`/strap-tour` (interactive walkthrough that uses real STRAP skills against a sandboxed example) is on the v2.6 roadmap. This document is the v2.5 read-along surrogate; the v2.6 interactive variant will sit alongside it for adopters who prefer a guided experience over a read-along.

## References

- [`./strap-in.md`](./strap-in.md) -- the operational walk-through of installing STRAP
- [`./architecture.md`](./architecture.md) -- contributor-depth architecture
- [`./customization-guide.md`](./customization-guide.md) -- extending STRAP with custom specialists
- [`./upgrade-guide.md`](./upgrade-guide.md) -- moving an installed STRAP forward across releases
- [`./dora-tuning.md`](./dora-tuning.md) -- getting the most from DORA reports
- [`../../../CLAUDE.md`](../../../CLAUDE.md) -- canonical session-startup orientation
