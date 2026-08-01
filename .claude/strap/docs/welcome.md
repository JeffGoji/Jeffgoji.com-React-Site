<div class="hero">
  <div class="eyebrow">Welcome</div>
  <h1>STRAP</h1>
  <p><strong>A portable agentic SDLC pipeline.</strong> A coordinated team of fifteen AI specialists takes raw ideas through requirements, specifications, decomposition, parallel implementation, and pull-request creation &mdash; all under one human's authority.</p>
</div>

## What is STRAP? {#what-is-strap}

STRAP &mdash; the **Spec-To-Release Agentic Pipeline** &mdash; is built to be installed. Drop it into any software project, run a single skill, and a complete software-development team comes online: a planning side that turns ideas into specifications, an implementation side that builds against those specifications, a review side that holds the line on security and infrastructure, and a documentation side that captures it all for the audiences who need to read it.

The point of STRAP is not to remove the human. The point is to **give one human the leverage of a small team**. The human stays in control: they decide priority, they approve work, they merge pull requests. The agents do the work the human directs them to do, in parallel, with discipline, and with memory that grows alongside the codebase.

And the leverage **compounds when more humans join**. Multiple humans can each operate their own STRAP super-pair in parallel &mdash; N orchestrators, N dev-leads, N agent teams &mdash; all working against the same source-controlled persistence stack. The output multiplier scales with the orchestrator count, not just the agent count. One human gets a small team's velocity; N humans get N teams in coordinated motion against shared context.

STRAP can be installed across multiple products and companies &mdash; every installation gets the same canonical pipeline, adapted to its stack and conventions over time through a curation model the rest of this document explains.

## Executive Summary {#executive-summary}

**STRAP turns a codebase you don't fully understand into one your team can move on &mdash; in an hour, not a quarter.**

The moment you install STRAP into a project, it spends about an hour reading the entire codebase the way a senior engineer would on their first week. It captures three things that normally take months to surface:

1. **What the project is and who it serves.** A plain-language project orientation &mdash; the kind of document new contributors usually have to assemble themselves over their first sprint. Where the code lives, who built it, who it's for, what's in production today.

2. **How the system is built.** A real architectural map &mdash; system topology, the major boundaries, where data flows, which patterns recur, where the smells are. The kind of artifact that typically takes a significant amount of time and expense to produce, whether through an outside consulting engagement or by pulling senior engineers off feature work for weeks. STRAP lands it the same day you install.

3. **The security and risk picture.** STRAP's security pass surfaces concrete findings with file:line citations: exposed credentials in source, hardcoded API keys, missing authentication on key endpoints, injection surfaces, unencrypted secrets stored "encrypted" with hardcoded keys, cross-tenant data leak risks. Not theoretical risks &mdash; specific lines of code, specific values that ship in your binaries today. The kind of audit that typically takes a security consultant two to four weeks.

**Then it stays.** STRAP doesn't deliver an orientation document and walk away. It installs a coordinated team of 15 AI agents into your project &mdash; planning agents (requirements, specifications, design, sprint planning, metrics) and implementation agents (frontend, backend, database, integrations, infrastructure, security review, testing). From the moment onboarding finishes, your team uses STRAP to take ideas through the full software lifecycle:

- **Idea to specification** &mdash; the requirements lead interviews you, refines the idea, and the spec lead produces an implementable specification with technical depth.
- **Specification to work plan** &mdash; the work decomposes into features, stories, and tasks in your existing tracker (Azure DevOps, Jira, GitHub Issues &mdash; STRAP connects to what you already use).
- **Work plan to PR-ready code** &mdash; implementation specialists work in parallel against the codebase; security review runs as a gate; tests are authored alongside the code; the result is a pull request your developers review and merge.

**What's different about this is the leverage shape.** Traditional development optimizes for time-to-first-commit. Cost shows up later as rework: ambiguous specs produce ambiguous implementations, cross-layer issues surface late, PRs cycle through five rounds of review. STRAP inverts the curve &mdash; it invests deeply upfront in understanding the codebase and refining specifications, then runs implementation in parallel against that prepared ground. By the time a developer reviews a PR, the ambiguity is already gone.

**The economic shape is unusual too.** STRAP runs inside Anthropic's Claude Code using a per-developer subscription. There is no separate infrastructure to provision, no API keys to juggle, no SaaS tier to manage. The cost scales with usage &mdash; a team of three running STRAP against one product looks like three Claude Code seats. Within that subscription, STRAP enforces explicit token budgets at both the workflow and session level: every onboarding, every feature decomposition, every sprint execution runs against a budget the CPO sets and the pipeline holds to. This makes per-project and per-team usage forecastable in a way that ad-hoc AI tool use isn't &mdash; you forecast against a budget the pipeline actually enforces, not against best-case usage assumptions. Onboarding cost is the seat cost for the hour STRAP runs. Steady-state cost is the seat cost for the hours your developers spend in their normal workflow, which STRAP slots into.

**What STRAP does not do is replace your developers.** Every decision that matters &mdash; priority, approval, what to build next, what to ship &mdash; is the human's call. STRAP calls that human the **CPO**. The CPO directs; the AI executes. The pipeline is a force multiplier, not an autopilot. Sloppy direction produces sloppy work. Good direction produces work that compounds.

For a senior leader evaluating STRAP, the practical question is what kind of velocity gain to expect. Validation runs to date have shown a force multiplier in feature velocity in the **2x to 6x range** &mdash; the variance reflects how deeply a team integrates STRAP into their daily workflow (occasional use versus pipeline-driven) and how mature the codebase is going in. Older codebases with significant accumulated context get more leverage from the discovery pass; greenfield projects get more leverage from the specification + decomposition pass. Both shapes benefit. The bottom of that range is meaningful by itself; the top of it changes what a team of your size can credibly take on in a quarter.

A practical caveat: this is a beta release, currently rolled out to invited adopters, and not yet through formal portfolio audits. Treat it as a learning collaboration with the maintainer, not a sanctioned tool.

## What's in the Box? {#whats-in-the-box}

A quick tour of what makes STRAP distinctive. Each item below has a deeper treatment further down this document, but here is the shape of what you are getting in one pass.

### Discipline Over Cleverness

STRAP refuses several patterns that other agent setups treat as features. The discipline pays compounding returns.

<div class="principles">
  <div class="principle">
    <h4>Non-destructive Onboarding</h4>
    <p>Specialists run with a read-only tools palette during <code>/strap-in</code> and <code>/strap-refresh</code> &mdash; <code>Read</code>, <code>Grep</code>, <code>Glob</code>, <code>Bash</code>; no <code>Write</code>, no <code>Edit</code>. Your production code cannot be modified during persistence-stack curation. Closing-phase doc and mockup writers are narrowly scoped to adopter-owned local paths.</p>
  </div>
  <div class="principle">
    <h4>Centralized Test Execution</h4>
    <p>Only the dev-lead runs the test suite, in a single pass at PR preparation. Specialists author tests but never run them. Cuts cascade-failure spirals when test orchestration is mixed across N specialists.</p>
  </div>
  <div class="principle">
    <h4>Token Budgets</h4>
    <p>Explicit per-agent + session-aggregate ceilings, set by the CPO once at install. Subsequent workflows pull silently from <code>MEMORY.md</code>. Tune any time via <code>/revise-token-budget</code>. Polyrepo sessions show the additive projection (<em>"3 sub-repos detected; projection: 1M + 2 &times; 300K = 1.6M"</em>) so cost is never hidden.</p>
  </div>
  <div class="principle">
    <h4>CPO Authority</h4>
    <p>Every state transition requires explicit human approval. No agent merges PRs. No skill silently invokes another. The leverage is in how much you can confidently delegate &mdash; not in how much the agents do behind your back.</p>
  </div>
</div>

### Persistence as Code ("PaC")

Context lives where code lives. The persistence stack is **source-controlled, PR-reviewable, branch-aware, and shared** &mdash; across every session, across every developer, across every hand-off. STRAP doesn't get smarter by growing more agents; it gets smarter by growing what the agents read. This is the whole point.

<div class="principles">
  <div class="principle">
    <h4>Agent Context as Code</h4>
    <p><code>project-profile.md</code> is the canonical record of what your project IS &mdash; stack, conventions, active domains, build commands, sensitivities. Every agent reads it on every invocation. Lives in your repo; travels with your code; survives staff changes; one team-curated source of truth across N orchestrators.</p>
  </div>
  <div class="principle">
    <h4>Agent Memory as Code</h4>
    <p>Per-agent memory files capture project-specific tradecraft (<em>"the test runner needs warming after fresh installs"</em>); per-agent rules files capture guardrails (<em>"never push directly to main"</em>). Soft learnings vs hard constraints, both source-controlled, both growing. Onboarding a new developer onto the project? They inherit every learning the team has accumulated &mdash; automatically &mdash; the moment they open the repo.</p>
  </div>
  <div class="principle">
    <h4>Single-Curator Rule</h4>
    <p>Only the dev-lead writes to rules and memory. Specialists report findings; the dev-lead decides what gets persisted. No drift, no contradictions, no stale tradecraft accumulating from N parallel writers. Even when multiple humans are orchestrating in parallel, the curation discipline keeps the persistence stack coherent.</p>
  </div>
  <div class="principle">
    <h4>Auto-Discovery</h4>
    <p><code>/strap-in</code> reads your codebase at shallow scope (manifests, file-tree shape, recent git activity, CI config), infers the stack, dispatches the relevant specialists in parallel for read-only deep-dive, and synthesizes findings into the persistence stack. The CPO confirms at every gate; nothing happens silently.</p>
  </div>
</div>

### Self-adapting Onboarding & Discovery

Fifteen canonical agents ship to every adopter. What changes per install is which agents are active and how they understand your project &mdash; STRAP figures that out itself.

<div class="principles">
  <div class="principle">
    <h4>Dormant Agent Activation</h4>
    <p>Agents that aren't relevant to your stack stay dormant &mdash; memory and rules persist as empty scaffolds; no dispatch happens. When a domain shows up later (a new mobile client, a fresh integration surface, a new database), <code>/strap-refresh</code> detects the signal and activates the relevant specialist without re-onboarding from scratch.</p>
  </div>
  <div class="principle">
    <h4>Polyrepo Support</h4>
    <p>When the install root contains multiple peer sub-repos at depth-1, <code>/strap-in</code> recognizes the umbrella shape and offers a three-way CPO choice (polyrepo umbrella / per-sub-repo install / single-project with caution). Umbrella mode runs discovery per sub-repo, dispatches per-sub-repo briefs for backend/frontend/database alongside umbrella briefs for security/test/integration/devops, and resolves cross-sub-repo runtime dependencies through a three-stage funnel.</p>
  </div>
  <div class="principle">
    <h4>Form-Factor-Agnostic Specialists</h4>
    <p><code>frontend-engineer</code> covers any client-side UI &mdash; web (Angular / React / Vue), desktop (WPF / WinForms / MAUI / Avalonia / Borland C++ Builder VCL / Qt), mobile (Xamarin / MAUI / SwiftUI), and server-rendered (Python widget libraries, Phoenix LiveView, Rails Hotwire, Razor, classic template engines). The same disciplines translate across all of them.</p>
  </div>
  <div class="principle">
    <h4>Surgical Refresh</h4>
    <p><code>/strap-refresh</code> reads the existing persistence stack as priors, detects diffs against the current codebase, surfaces them for CPO approval <strong>before</strong> dispatching, then applies targeted edits &mdash; not whole-file rewrites. CPO edits, narrative additions, and prior-refresh curation are preserved.</p>
  </div>
</div>

### Drop-In Integration

Your work-tracking host. Your source-control host. Your existing docs directory. STRAP probes each at connect time and persists per-project profiles that the pipeline reads at runtime.

<div class="principles">
  <div class="principle">
    <h4>DevOps Integration</h4>
    <p>Host-agnostic: Azure DevOps Boards / Jira / GitHub Issues / Local <em>strap-agile</em> / Other. <code>/connect-devops-project</code> probes the host, models the connection (logical-to-host type mappings, fields, states, operation templates), validates with the CPO, and persists. Capability declarations mean unsupported operations degrade gracefully &mdash; no silent failures.</p>
  </div>
  <div class="principle">
    <h4>Source Control Integration</h4>
    <p>Same five-step model: Azure Repos / GitHub / Bitbucket / Local Git / Other. <code>/connect-code-repo</code> clears the code-immutability invariant when wired. Write probes validate auth + network + git CLI end-to-end with explicit CPO consent; the test artifact (a throwaway branch created and deleted) appears in the connection profile for audit.</p>
  </div>
  <div class="principle">
    <h4>Work-Tracking as Code</h4>
    <p>Optional <code>Local (strap-agile)</code> mode &mdash; work items become markdown files in your git history, PR-reviewable, diffable, branch-aware. The <em>"ticket says X but code does Y"</em> mismatch becomes impossible because both are tracked in the same atomic change. The right call for small teams and solo developers.</p>
  </div>
  <div class="principle">
    <h4>Seven Logical Work-Item Types</h4>
    <p>STRAP's logical model &mdash; Requirement / Spec / Feature / Enhancement / Story / Task / Bug &mdash; maps to each host's native types via the Custom Map UX. Where types collapse (some hosts share Issue across Requirements and Bugs), the <code>strap:&lt;logical-type&gt;</code> tag preserves findability.</p>
  </div>
</div>

### Self-documenting Outputs

Beyond agent work, STRAP produces durable artifacts your team can review the same way they review code. Each one is auditable, diffable, and meaningful at a glance.

<div class="principles">
  <div class="principle">
    <h4>Project-Docs Pipeline</h4>
    <p><code>/strap-in</code>'s closing phase produces <code>PROJECT.md</code> + <code>ARCHITECTURE.md</code> + <code>STACK.md</code> at the configured <code>Project docs paths</code> &mdash; human-facing orientation distilled from the curated persistence stack. A self-contained HTML companion renders alongside via the bundled markdown-to-HTML pipeline. The bar: <em>a new contributor reading them cold would understand what the project is, how the code is structured, and what it is built with</em>.</p>
  </div>
  <div class="principle">
    <h4>Mockup-as-Contract</h4>
    <p><code>designer</code> produces deployable mockup code &mdash; real interactive mockups built with the same component libraries the production app uses &mdash; that <code>frontend-engineer</code> ports verbatim. The mockup IS the visual contract; the implementation is the port. <code>/create-mockups</code> &rarr; <code>/analyze-mockups</code> is the pre-decomposition gate for Specs with user-facing scope.</p>
  </div>
  <div class="principle">
    <h4>DORA Governance + AI Efficiency Ratio</h4>
    <p>Built-in metrics layer: <code>/dora-collect</code> snapshots, <code>/dora-report</code> renders a self-contained HTML report with embedded Chart.js (DORA-4 + AI Efficiency Ratio comparing original estimates vs actual wall-clock cycle times), <code>/dora-reconcile</code> is the daily janitor. Wall-clock is the primary AI-efficiency signal.</p>
  </div>
  <div class="principle">
    <h4>Cross-Session Continuations</h4>
    <p>Multi-session work survives via <code>/context-prep &lt;topic&gt;</code> (write a runbook capturing where things stand &mdash; files in flight, open decisions, work items, quick-resume actions) and <code>/context-fetch &lt;topic&gt;</code> (resume cold). Multi-developer hand-offs travel through these. No mid-feature work is ever stranded.</p>
  </div>
</div>

## Quick Start {#quick-start}

STRAP installs as a `.claude/` folder inside your project's root. From there, four skills bring the pipeline online.

<ol class="steps">
  <li>
<h4>Run the installer</h4>
<p>Downloads a versioned STRAP package, verifies its SHA-256 checksum, extracts to <code>.claude/</code>, and seeds harness permissions in <code>settings.json</code>. Cross-platform; <strong>no elevation required</strong>.</p>
<div class="callout">
<span class="label">Before You Start</span>
<p><strong>Close Claude Code if it's running</strong> in this project. The installer writes to <code>.claude/settings.json</code>; an active Claude Code session may have the file locked or may not pick up the new permissions until restart.</p>
<p><strong>Open a terminal in the directory where you want STRAP installed.</strong> The installer creates <code>.claude/</code> at your current working directory (or wherever the <code>-Target</code> / <code>--target</code> argument points). Picking the wrong install root means STRAP curates the wrong project &mdash; choose carefully.</p>
</div>
<p><strong>Sample install-root paths.</strong> Install always lands at the <em>umbrella root</em> &mdash; the directory that contains your project (single-repo) or your sub-repos (polyrepo). Three common shapes:</p>
<pre><code><span class="path-label">Monorepo / single-repo:</span>
  ~/source/repos/MyApp/          &lt;- run install here
    .git/
    src/
    tests/
    package.json
    ...

<span class="path-label">Polyrepo umbrella, bare (sub-repos as siblings):</span>
  ~/source/repos/MyUmbrella/     &lt;- run install here (umbrella has no .git/ of its own)
    service-a/                   &lt;- sub-repo (has its own .git/)
    service-b/                   &lt;- sub-repo (has its own .git/)
    lib-shared/                  &lt;- sub-repo (has its own .git/)

<span class="path-label">Polyrepo umbrella, workspace-style (umbrella tracks shared config and/or a solution file):</span>
  ~/source/repos/MyPlatform/     &lt;- run install here (still the umbrella root)
    .git/                        &lt;- umbrella may have its own git for shared config / docs / CI
    MyPlatform.sln               &lt;- umbrella may carry a solution file referencing projects below
    ApiService/                  &lt;- sub-repo (has its own .git/ + .csproj)
    WorkerService/               &lt;- sub-repo (has its own .git/ + .csproj)
    SharedLib/                   &lt;- sub-repo (has its own .git/ + .csproj)
</code></pre>
<p>In any polyrepo case, <code>/strap-in</code> detects the sub-repos at depth-1 (regardless of whether the umbrella has its own <code>.git/</code> or solution file) and offers a three-way CPO choice: umbrella mode / per-sub-repo install with guidance / single-project at root with caution. The third option is the escape hatch when the umbrella manifest is authoritative (e.g., the <code>.sln</code> IS the project, sub-repos are just where the source happens to live). See <a href="#strap-in">the <code>/strap-in</code> walkthrough</a> below for the polyrepo flow.</p>
<div class="install-options">
<div class="install-card mac-linux">
<h4>Installing on macOS or Linux</h4>
<pre><code>curl -fsSL https://lmgstrapdist.blob.core.windows.net/releases/install.sh | bash
</code></pre>
<p>Pipe-to-shell is the standard pattern. For the security-conscious, download first and inspect: <code>curl -fsSL https://lmgstrapdist.blob.core.windows.net/releases/install.sh -o strap-install.sh &amp;&amp; bash strap-install.sh</code>. Either way, <code>.claude/</code> lands in the current directory. To pin a specific STRAP version, swap the URL for <code>strap-install-&lt;version&gt;.sh</code> (e.g., <code>strap-install-2.4.0.sh</code>) -- filename-versioned aliases are published per release.</p>
</div>
<div class="install-card windows">
<h4>Installing on Windows</h4>
<pre><code>iwr https://lmgstrapdist.blob.core.windows.net/releases/install.ps1 -OutFile strap-install.ps1
.\strap-install.ps1
</code></pre>
<p>PowerShell 7+ recommended; PowerShell 5.1 works. If execution policy blocks the script, run <code>Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned</code> once for your account &mdash; this is a one-time setup, not per-install. <code>.claude/</code> lands in the current directory. To pin a specific STRAP version, swap the URL for <code>strap-install-&lt;version&gt;.ps1</code> (e.g., <code>strap-install-2.4.0.ps1</code>) -- filename-versioned aliases are published per release.</p>
</div>
</div>
  </li>
  <li>
    <h4>Open Claude Code and run <code>/strap-in</code></h4>
    <p>The first conversation. The dev-lead reads the codebase at a shallow scope, dispatches relevant specialists in parallel via <code>CreateTeam</code> for read-only deep-dive, and curates the persistence stack (<code>project-profile.md</code>, per-agent memory, per-agent rules) so the canonical 15-agent roster comes alive for THIS project. Throughout, your code is immutable &mdash; specialists run read-only.</p>
  </li>
  <li>
    <h4>Run <code>/connect-code-repo</code></h4>
    <p>Wires up where git lives (Azure Repos / GitHub / Bitbucket / Local Git / Other). Probes the host live, models branch + PR + auth capabilities, validates with you, persists a connection profile that the pipeline reads at runtime. The code-immutability invariant releases when this skill clears its gate.</p>
  </li>
  <li>
    <h4>Run <code>/connect-devops-project</code></h4>
    <p>Wires up where work items live (Azure DevOps / Jira / GitHub Issues / Local <em>strap-agile</em> / Other). Same five-step discovery flow, persists a second connection profile. After this, the pipeline can file Requirements, Specs, Features, Stories, Tasks, and Bugs.</p>
  </li>
  <li>
    <h4>Run <code>/new-requirement &lt;your idea&gt;</code></h4>
    <p>Your first production-workflow invocation. The <code>req-lead</code> specialist drafts a Requirement work item in your connected DevOps tool, identifies the open questions, and iterates with you toward Resolved. From there, the rest of the pipeline &mdash; Spec authoring, Feature generation, sprint execution, PR refinement &mdash; flows through the skills documented below.</p>
  </li>
</ol>

<div class="callout">
  <span class="label">Tip</span>
  <p>You don't need to set anything up in your DevOps tool ahead of time. <code>/connect-devops-project</code> probes what's there, models it against STRAP's logical operations, and surfaces any gaps with degradation paths before you commit.</p>
</div>

## The Super-Pair {#super-pair}

Every STRAP session is operated by a two-entity super-pair. This identity is invariant.

<div class="callout invariant">
  <span class="label">The Super-Pair Invariant</span>
  <p><strong>You &mdash; the human typing the prompts &mdash; are the CPO.</strong> The Claude Pipeline Orchestrator. You set priority. You approve work. You decide. Your authority is non-negotiable; no agent can impersonate you and no skill can run a state transition without your sign-off.</p>
  <p><strong>Claude itself &mdash; this session &mdash; is the dev-lead.</strong> Your working partner. The dev-lead does not write production code directly. It coordinates the team, dispatches specialists, synthesizes their work, curates their rules and memory, and brings everything back to you. It is the only agent that talks to you; everyone else routes through it.</p>
</div>

Everything else extends from this one relationship.

## Meet the Agents {#agent-team}

Fifteen agents ship with STRAP. The roster is fixed: the same fifteen ship to every adopter, every install. They do not get renamed, replaced, or regenerated. They are dormant when not needed and active when work comes their way. Over time the dev-lead refines them &mdash; adding rules where guardrails are needed, adding memory where tradecraft is worth keeping &mdash; but the roster itself stays canonical.

<div class="team-section">
  <div class="team-header">
    <span class="team-pill ops">agent-ops</span>
    <strong>The planning and coordination team</strong>
  </div>
  <div class="agent-list">
    <div class="agent ops">
      <div class="name">req-lead</div>
      <div class="desc">Owns Requirements. Refines raw ideas into structured Requirements with a clear Problem Statement, Desired Outcome, Success Criteria, and Scope. Allergic to vague problem statements.</div>
    </div>
    <div class="agent ops">
      <div class="name">spec-lead</div>
      <div class="desc">Takes resolved Requirements and produces Specs with enough technical depth that the implementation team can decompose them without coming back to ask clarifying questions. The bridge between "what" and "how."</div>
    </div>
    <div class="agent ops">
      <div class="name">designer</div>
      <div class="desc">Interviews you on intent, audience, scope, and fidelity tier. Produces deployable mockup code &mdash; actual interactive mockups, not sketches &mdash; that the frontend team ports verbatim into production. The mockup IS the visual contract.</div>
    </div>
    <div class="agent ops">
      <div class="name">tech-writer</div>
      <div class="desc">Drafts feature pages, release notes, use-case guides, API docs, architecture docs, how-to guides. Adapts tone to the configured audience: community for non-technical, code for developers.</div>
    </div>
    <div class="agent ops">
      <div class="name">sprint-planner</div>
      <div class="desc">Allocates Stories and Tasks into the current sprint (single-sprint constraint &mdash; overflow stays unallocated). Tracks velocity. Surfaces capacity conflicts rather than silently spilling.</div>
    </div>
    <div class="agent ops">
      <div class="name">dora-analyst</div>
      <div class="desc">Tracks DORA metrics &mdash; Deployment Frequency, Lead Time for Changes, Change Failure Rate, Mean Time to Restore &mdash; plus an Agent Efficiency Ratio that leverages the AI tag to distinguish AI-authored from human-authored work.</div>
    </div>
    <div class="agent ops">
      <div class="name">ux-test-engineer</div>
      <div class="desc">Derives test plans from Spec acceptance criteria. Authors and runs E2E suites. Files structured Bug work items for failures with reproduction steps and evidence.</div>
    </div>
  </div>
</div>

<div class="team-section">
  <div class="team-header">
    <span class="team-pill devs">agent-devs</span>
    <strong>The implementation and verification team</strong>
  </div>
  <div class="agent-list">
    <div class="agent devs">
      <div class="name">dev-lead</div>
      <div class="desc">The top-level Claude session. Never a subagent. Coordinates all specialists, curates the persistence stack, runs every STRAP skill, and is the only agent that talks to the CPO directly.</div>
    </div>
    <div class="agent devs">
      <div class="name">backend-engineer</div>
      <div class="desc">Implements server-side code: domain entities, application services, transport handlers, data-access seams. Holds the line on clean architecture and dependency injection. Authors tests but does not run them &mdash; only the dev-lead runs the suite.</div>
    </div>
    <div class="agent devs">
      <div class="name">frontend-engineer</div>
      <div class="desc">Implements client-side code: components, screens, state stores, view-model bindings, routing, i18n. Respects store-ownership discipline and parent/child component contracts. When mockups exist, ports them verbatim.</div>
    </div>
    <div class="agent devs">
      <div class="name">database-engineer</div>
      <div class="desc">Owns the persistence layer: entity definitions, schema migrations, indexing strategy. Applies migrations to the local development database only. Production, UAT, and shared-development are pipeline-only. No exceptions.</div>
    </div>
    <div class="agent devs">
      <div class="name">devops-lead</div>
      <div class="desc">Owns IaC, cloud fabric, and pipeline definitions. Authors and surfaces defects. Never runs apply / deploy against an environment with dependents &mdash; the pipeline applies; the devops-lead produces the IaC and the plan output.</div>
    </div>
    <div class="agent devs">
      <div class="name">security-reviewer</div>
      <div class="desc">OWASP-aligned audit gate. Reviews for authn, authz, tenant isolation, input validation, injection prevention, secrets handling, error-response hygiene, mass-assignment defense. Critical and High findings block merge.</div>
    </div>
    <div class="agent devs">
      <div class="name">integration-specialist</div>
      <div class="desc">Owns external-system integration. Dynamic endpoints, per-tenant configuration stores, retry policies, bidirectional mapping at trust boundaries. Dormant when the project has no external surface; activated the moment one appears.</div>
    </div>
    <div class="agent devs">
      <div class="name">test-strategist</div>
      <div class="desc">Authors test strategy at the Feature level, reviews test coverage intent, triages failures the dev-lead redispatches. Does not run tests &mdash; that is the dev-lead's centralized responsibility.</div>
    </div>
  </div>
</div>

## How They Work Together {#how-together}

The dev-lead dispatches specialists through Claude Code's primitives:

- **Parallel fan-out** (sprint execution waves, PR-feedback rounds, onboarding deep-dives) uses `CreateTeam` so specialists appear as named, color-badged teammates and reply through a single team channel via `SendMessage`.
- **Serial dispatch** (authoring chains where one specialist's output feeds the next, single-target read-only investigations) uses `Task` / `Agent` directly.

Each specialist works in its own scope &mdash; a worktree, a branch, a set of files &mdash; so they do not step on each other. When a specialist finishes, it reports back to the dev-lead. The dev-lead synthesizes: reconciles overlaps, fills gaps, flags issues. Then the dev-lead reports back to the CPO with a coherent unified output the CPO can review in a single pass.

<div class="callout">
  <span class="label">Three Hard Rules</span>
  <p><strong>1. Specialists never talk to the CPO directly.</strong> They report through the dev-lead.</p>
  <p><strong>2. Specialists never spawn other specialists.</strong> The dev-lead is the only fan-out layer.</p>
  <p><strong>3. Specialists never run the test suite.</strong> The dev-lead is the centralized executor at PR preparation.</p>
</div>

## The Persistence Stack &mdash; Context and Memories {#persistence}

Here is what makes STRAP genuinely different from a one-off agent setup: **it gets better over time**. Not because the agents themselves become smarter &mdash; they are still markdown files &mdash; but because the things they read become richer.

STRAP carries several kinds of source-controlled state. Every specialist agent loads its team rules, its own rules, its own memory, and the project profile on every invocation. The dev-lead is the sole writer for all of them.

<table class="stack-table">
  <thead>
    <tr>
      <th>Layer</th>
      <th>Purpose</th>
      <th>Lifetime</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Team rules</td>
      <td>Cross-cutting team-level guardrails. STRAP-wide conventions that ship verbatim to every adopter.</td>
      <td>Stable</td>
    </tr>
    <tr>
      <td>Per-agent rules</td>
      <td>Per-agent guardrails added reactively when something needs preventing.</td>
      <td>Reactive growth</td>
    </tr>
    <tr>
      <td>Per-agent memory</td>
      <td>Accumulated tradecraft for THIS project. Soft learnings, not rules.</td>
      <td>Grows over time</td>
    </tr>
    <tr>
      <td>Project profile</td>
      <td>The canonical record of what THIS project IS. Stack, active domains, conventions, build/test commands.</td>
      <td>Refined</td>
    </tr>
    <tr>
      <td>Dev-lead memory</td>
      <td>The dev-lead's own categorized notes, indexed by a master file.</td>
      <td>Grows over time</td>
    </tr>
    <tr>
      <td>Continuations</td>
      <td>Cross-session topic snapshots. Workstreams that span sessions get a runbook captured by <code>/context-prep</code>.</td>
      <td>Topic-scoped</td>
    </tr>
    <tr>
      <td>Connection profiles</td>
      <td>Per-project work-tracking + source-control wire-up. Persist env-var references only &mdash; credential values never enter tracked files.</td>
      <td>Per host</td>
    </tr>
  </tbody>
</table>

### Why this matters

Most AI tooling treats every session as fresh. You type your problem in, get a response, and the next session starts from zero. The tool cannot learn &mdash; it has no place to put learnings.

STRAP gives learnings a place to live. **Rules accumulate what should never happen again. Memory accumulates what should happen better. The project profile accumulates what this project is. Continuations accumulate where workstreams stand.** All source-controlled. All shared across the team. All curated by the dev-lead.

Six months into a project, the per-agent memory files describe how to do the job well on this specific codebase. New developers operating as the CPO inherit that institutional knowledge automatically &mdash; it is source-controlled, it travels with the repo, it survives staff changes.

The agents themselves stay simple. **The intelligence is in the persistence stack.**

## The Single-Curator Rule {#single-curator}

<div class="callout invariant">
  <span class="label">Single-Curator Invariant</span>
  <p><strong>Only the dev-lead writes to rules and memory.</strong> Specialists report findings; the dev-lead decides what gets persisted. The CPO directs the dev-lead through normal conversation &mdash; "save this learning to the backend-engineer's memory" &mdash; or through the explicit <code>/memory-refine &lt;agent&gt;</code> skill.</p>
</div>

This rule exists because curated context is what makes STRAP compound over time. If specialists could write their own rules and memory, the persistence stack would drift &mdash; contradictions accumulate, stale tradecraft persists, the project profile loses coherence. One curator keeps the persistence stack tight.

## The Onboarding Flow {#strap-in}

Four skills carry the install + maintenance lifecycle.

### `/strap-in` &mdash; the super-pair meets the project

The first conversation. The dev-lead reads the codebase at a shallow scope &mdash; top-level manifests, file-tree shape, recent git activity, CI config, mockup paths, integration markers, IaC files, E2E test markers. The CPO confirms operating budgets for the workflow. The dev-lead decides which of the fifteen canonical specialists matter for this codebase, presents the activation set to the CPO for confirmation or override, then dispatches the active ones in parallel via `CreateTeam` to deep-dive their respective domains.

Specialists report back. The dev-lead synthesizes findings into the persistence stack &mdash; the project profile, per-agent memory files, per-agent rules additions cited to concrete observations. Reconciled across specialists where they overlap. Refined to the bar: *another dev-lead resuming this project on a fresh session, with no memory of this conversation, would understand the project from the persistence stack alone*.

After synthesis lands, the dev-lead invokes `tech-writer` at a closing project-docs production phase to render three human-facing orientation documents &mdash; `PROJECT.md`, `ARCHITECTURE.md`, `STACK.md` &mdash; from the curated persistence stack. These land at the configured `Project docs paths` (or the fallback `.claude/strap/project-docs/`) and give a new contributor reading the repo cold the same orientation the agents have. **A bundled HTML companion is rendered alongside them** via the same `.claude/strap/tools/html-render/` pipeline that produces this Welcome document &mdash; self-contained, polished, shareable. The pipeline ships inside every STRAP install so adopters get the HTML companion at every `/strap-in` and `/strap-refresh` without any out-of-tree dependency. Bar: *a new contributor reading them cold would understand what the project is, how the code is structured, and what it is built with*.

<div class="callout">
  <span class="label">Code Immutability Invariant</span>
  <p>Throughout onboarding, the adopter's production code is immutable. Section 6 specialists run with a read-only tools palette (<code>Read</code>, <code>Grep</code>, <code>Glob</code>, <code>Bash</code> &mdash; no <code>Write</code>, no <code>Edit</code>); the source under inspection cannot be modified during onboarding. The Section 9 project-docs production phase is the explicit narrow exception &mdash; <code>tech-writer</code> receives <code>Write</code> / <code>Edit</code> scoped to the configured <code>Project docs paths</code> only, never production source. This is the same exception pattern <code>designer</code> follows in <code>/create-mockups</code> and <code>ux-test-engineer</code> follows in <code>/create-test-plan</code>. The invariant fully releases when <code>/connect-code-repo</code> clears its satisfied gate &mdash; the deliberate transition from onboarding mode to operational mode.</p>
</div>

### `/connect-code-repo` &mdash; source control wire-up {#connect-code}

Required. Wires up where git lives. CPO picks the host (Azure Repos, GitHub, Bitbucket, Local Git, or Other via full from-scratch discovery). The dev-lead authenticates, probes the host live, models the connection &mdash; auth method, default branch, branch-protection observations, capability declarations, operation templates for PR creation and branch management &mdash; validates the model with the CPO, then persists the profile at `.claude/strap/state/code-connection.yaml`.

Credentials are recorded as **env-var references only**; values never enter any tracked file. Pre-flight checks git installed; the flow refuses to proceed without it. Write probes &mdash; with explicit CPO consent &mdash; create-and-delete a throwaway branch on the real remote to confirm end-to-end credentials, network, and git CLI all work together.

### `/connect-devops-project` &mdash; work-tracking wire-up {#connect-devops}

Optional but typical. Wires up where work items live. Same five-step discovery flow as `/connect-code-repo`, against Azure DevOps Boards, Jira, GitHub Issues, Local *strap-agile*, or any other host via full discovery. The connection profile at `.claude/strap/state/devops-connection.yaml` records logical-to-host type mappings (the STRAP `Requirement` is this host's `Story`; STRAP's `Feature` is this host's `Epic`), field mappings, state transitions, capability declarations, and operation templates. Capability gaps are explicitly recorded so subsequent workflows degrade gracefully when the host doesn't support an operation.

The work-item-type mapping step offers three options at the decision gate: **Accept probed mapping** (Recommended; proceed with auto-probed defaults shown in a structured text block), **Customize mapping** (walk through each of the 7 STRAP logical types &mdash; requirement, spec, feature, story, task, bug, enhancement &mdash; with up to 4 ranked host candidates per type plus a free-text escape), or **Reject and exit**. The Custom Map flow validates the chosen mapping against collisions and unmapped types before persistence.

### `/strap-refresh` &mdash; the re-run {#strap-refresh}

The companion to `/strap-in`. When the codebase shape changes &mdash; a new framework adopted, a major directory introduced, CI moved to a new host, a fresh team convention surfaced &mdash; `/strap-refresh` reads the existing persistence stack as priors, runs a shallow scan against the current state, detects diffs between priors and current, and surfaces them for CPO approval **before** dispatching any specialist or updating any curated content. Specialists run only against changed domains; memory files for unchanged domains stay byte-identical. Specialists newly activated by new signals get a fresh deep-dive against their previously-unread domain.

After synthesis, `tech-writer` applies **surgical** updates to the project-orientation docs (`PROJECT.md`, `ARCHITECTURE.md`, `STACK.md`) for the sections flagged as drifted by the diff list. Sections that did not drift stay byte-identical &mdash; CPO edits, narrative additions, and prior-refresh curation are preserved. Whole-file rewrites at refresh time are a defect, not a feature. The bundled HTML companion is then **always full re-rendered** &mdash; the markdown is the surgical surface; the HTML is a derived artifact.

STRAP's curated persistence stack is a CPO-curated artifact, not an automated derivation. Updates require approval, not just detection. The single-curator rule applies to refresh runs same as initial onboarding.

## Work-Tracking as Code (strap-agile) {#strap-agile}

One of `/connect-devops-project`'s host options is **Local (strap-agile)**. This is not a fallback or evaluation-only mode &mdash; it is a deliberate paradigm worth understanding.

In strap-agile mode, work items are **markdown files in your repo's git history**:

```
.claude/strap/work/
├── requirement/
│   ├── 0001-customer-export.md
│   └── 0002-multi-tenant-isolation.md
├── spec/
│   └── 0001-customer-export.md
├── feature/
│   ├── 0001-csv-export.md
│   └── 0002-pdf-export.md
├── story/
│   ├── 0001-csv-export-handler.md
│   └── 0002-csv-export-formatter.md
├── task/
│   └── 0001-author-csv-handler.md
└── bug/
    └── 0001-sales-routing-typo.md
```

Each file carries YAML frontmatter (id, type, state, parent links, assignee, timestamps); the body is the work-item content (problem statement, acceptance criteria, scope notes). What this gets you:

- **PR-reviewable work items.** A Story is a `.md` file. Changes go through PR review &mdash; same gates as code. The acceptance criteria of a Story can be debated and refined in code review before someone implements against it.
- **Diffable history.** `git log .claude/strap/work/` is the work-item changelog. WHEN was a Bug filed? WHO filed it? WHY (commit message)? Every answer is in git history.
- **Branch-aware.** A feature branch can carry provisional work items that only exist on that branch until merged. Experiment with how to structure a Feature without committing to it on main.
- **Single source of truth.** Code and work-items move together in the same commit. The "ticket says X but code does Y" mismatch becomes impossible.
- **Audit-friendly.** Compliance / DORA-style metrics become git-blame-able. The work-item history IS the git history.
- **Portable.** No external service to migrate to or from. Work items travel with the repo.

This is the same paradigm as Infrastructure-as-Code, applied to work tracking: **work-item-tracking-as-code**. The right choice for small teams, solo developers, and projects where the agility and PR-review-everything posture of work-as-code outweighs the breadth of a large DevOps platform.

## The Production Workflows {#workflows}

Once onboarding is complete, the production pipeline runs through a tight set of skills the dev-lead invokes. Each follows the same pattern: dev-lead owns the CPO conversation and the host-side persistence, specialists are dispatched for the focused work, every persisted item carries lifecycle metadata, every state transition is audited.

<div class="workflows">
  <div class="workflow">
    <h4>Authoring chain</h4>
    <div class="skills">/new-requirement &middot; /refine-requirement &middot; /create-spec &middot; /refine-spec &middot; /generate-features &middot; /decompose-feature</div>
    <p>req-lead drafts Requirements; spec-lead authors Specs and Feature briefs; dev-lead persists. <code>/decompose-feature</code> activates required domains (CPO-gated structural precondition) and dispatches active-domain specialists in parallel via <code>CreateTeam</code> for read-only planning, then reconciles and persists Stories + Tasks.</p>
  </div>
  <div class="workflow">
    <h4>Mockup tier (user-facing Specs only)</h4>
    <div class="skills">/create-mockups &middot; /analyze-mockups</div>
    <p>Runs between Spec resolution and Feature generation when the Spec carries user-facing scope. <code>/create-mockups</code> dispatches the designer to interview, build deployable mockup code, iterate (re-runnable; CPO approval at every gate), and write the Mockup Reference back to the Spec. <code>/analyze-mockups</code> dispatches spec-lead to audit completeness, map mockup data shapes to backend API declarations, and write the Mockup Wiring Guide. <code>/generate-features</code> refuses to run on user-facing Specs missing either section.</p>
  </div>
  <div class="workflow">
    <h4>Test plan tier</h4>
    <div class="skills">/create-test-plan</div>
    <p>Authors an end-to-end test plan for a Spec or Feature and (optionally) scaffolds initial test files. Dev-lead dispatches ux-test-engineer as a serial-Task specialist to read the Spec, the codebase under the active e2e domain's <code>Source-of-truth</code> paths, and the framework conventions; produce a structured plan (scope, scenarios, fixtures, risks); and scaffold runnable tests in the configured paths. CPO approval at every gate; re-runnable. Persists a <code>Test Plan</code> section back to the Spec / Feature on Approve. Same dispatch shape as the Mockup tier &mdash; ux-test-engineer is the third closing-phase write-exception alongside designer and tech-writer.</p>
  </div>
  <div class="workflow">
    <h4>Execution</h4>
    <div class="skills">/plan-sprint &middot; /rebalance-sprint &middot; /execute-sprint</div>
    <p><code>/plan-sprint</code> allocates into the current sprint only (hard single-sprint rule; overflow stays unallocated). <code>/execute-sprint</code> creates the feature branch, dispatches active-domain specialists into per-agent worktrees, reviews each task branch, runs the centralized build-and-test pass, sets completion metadata at resolution, and prepares the PR via the source-control connection profile.</p>
  </div>
  <div class="workflow">
    <h4>Bug tier</h4>
    <div class="skills">/file-bugs &middot; /fix-bugs</div>
    <p><code>/file-bugs</code> accepts informal CPO input, dispatches an intake specialist read-only for investigation and classification. <code>/fix-bugs</code> is the lighter sibling of <code>/execute-sprint</code> for Bug + Enhancement work items &mdash; targeted fixes, no Story decomposition, same metadata round-trip at resolution.</p>
  </div>
  <div class="workflow">
    <h4>Single-motion path</h4>
    <div class="skills">/quick</div>
    <p>The CPO &quot;do now&quot; lever. Free-form description through classification, work-item chain creation, specialist routing, implementation, centralized test pass, and draft PR &mdash; in one invocation. Five chain shapes (atomic Bug; Enhancement+Story+Task; Feature+Story+Task; Story+Task under existing parent; Task under existing parent). Flags: <code>--under</code>, <code>--into</code>, <code>--mockup</code> (lightweight POC, distinct from the gated mockup tier), <code>--investigation</code>, <code>--stacked</code>, <code>--draft</code>. Hard CPO approval gate after classification. Never refuses for size.</p>
  </div>
  <div class="workflow">
    <h4>PR feedback</h4>
    <div class="skills">/refine-pr</div>
    <p>Reads reviewer comment threads and failed CI checks via the source-control connection profile, categorizes by domain, dispatches the relevant specialists in parallel (or serially for file-conflicting fixes), runs the centralized build-and-test pass, pushes updates to the existing feature branch. Thread resolution stays with the human reviewer.</p>
  </div>
  <div class="workflow">
    <h4>Close ritual</h4>
    <div class="skills">/close-ceremony</div>
    <p>The deliberate CPO ritual for transitioning Resolved work items to Closed &mdash; the only authoritative manual Resolved &rarr; Closed gate. The execution skills stop at Resolved by design; this ritual is where the CPO walks Resolved Features, Enhancements, Bugs, and lingering Stories and decides per item (close / reject with rework tag / defer with reason tag / skip). Filters by <code>--type</code>, <code>--owner</code>, <code>--days</code>. <code>--dry-run</code> previews without applying. Produces a ceremony report.</p>
  </div>
  <div class="workflow">
    <h4>DORA governance</h4>
    <div class="skills">/dora-reconcile &middot; /dora-collect &middot; /dora-report</div>
    <p><code>/dora-reconcile</code> runs daily (cascades) or weekly with <code>--auto-fix</code> (also stamps derivable hygiene); 8 reconciliation passes keep the AI-tag + lifecycle-metadata wiring honest. <code>/dora-collect</code> writes a JSON snapshot of work items, pipeline runs (bucketed by <code>project-profile.md</code>'s <code>Layers</code> section), and PRs (split integration vs intermediate per the source-control profile). <code>/dora-report</code> renders a self-contained HTML report with embedded Chart.js: 10 sections including Per-Developer Profile (UNION across all output sources), Pipeline Funnel, Layer Metrics, PR Health (size distribution by iteration count). Wall-clock as primary AI Efficiency Ratio. Supports <code>--compare</code> and <code>--last-n</code> for trend analysis.</p>
  </div>
  <div class="workflow">
    <h4>CPO tuning surfaces</h4>
    <div class="skills">/memory-show &middot; /memory-refine &middot; /revise-token-budget</div>
    <p><code>/memory-show</code> inspects per-agent memory; <code>/memory-refine</code> curates it under CPO direction (single-curator rule applies). <code>/revise-token-budget</code> is the canonical surface for tuning STRAP's token budgets after <code>/strap-in</code>'s initial setup &mdash; per-workflow per-agent and session-aggregate budgets, plus per-agent overrides (e.g., give <code>backend-engineer</code> a higher ceiling on <code>/execute-sprint</code> than <code>security-reviewer</code>). Persists to <code>usage.yaml</code> and <code>MEMORY.md</code> with an append-only audit trail; revisions apply to new workflow instances only.</p>
  </div>
  <div class="workflow">
    <h4>Recovery and continuation</h4>
    <div class="skills">/team-cleanup &middot; /context-prep &middot; /context-fetch</div>
    <p><code>/team-cleanup</code> recovers from wedged team state. <code>/context-prep</code> captures cross-session continuation runbooks; <code>/context-fetch</code> loads them as session-startup context. Multi-session and multi-developer workstreams travel through these.</p>
  </div>
</div>

## Design Principles {#principles}

Four principles run through every architectural choice. They are stable across releases; they explain most decisions.

<div class="principles">
  <div class="principle">
    <div class="num">PRINCIPLE 1</div>
    <h4>Single-curator persistence</h4>
    <p>Only the dev-lead writes to rules and memory. Specialists report findings; the dev-lead decides what gets persisted. One curator keeps the persistence stack coherent over time.</p>
  </div>
  <div class="principle">
    <div class="num">PRINCIPLE 2</div>
    <h4>Canonical roster, project-tuned context</h4>
    <p>Fifteen agents ship with STRAP; the same fifteen ship to every adopter. The roster does not change per install. What changes is the persistence stack the dev-lead curates over the project's lifetime.</p>
  </div>
  <div class="principle">
    <div class="num">PRINCIPLE 3</div>
    <h4>Connection-discovery model</h4>
    <p>STRAP does not ship a fixed adapter per host. It probes the host live, models its capabilities against STRAP's logical operations, validates with the CPO, and persists a per-project connection profile that the pipeline reads at runtime.</p>
  </div>
  <div class="principle">
    <div class="num">PRINCIPLE 4</div>
    <h4>Code immutability during onboarding</h4>
    <p>Specialists dispatched during <code>/strap-in</code> or <code>/strap-refresh</code> run read-only. The adopter's code is never modified during persistence-stack curation. The invariant releases only when <code>/connect-code-repo</code> clears its gate.</p>
  </div>
</div>

## The Canonical 15-Agent Roster {#roster}

The roster is fixed by design. Adding a 16th agent is not supported. Adopter customization happens through curated per-agent rules and per-agent memory, not roster expansion.

| Team | Agent | Layer |
|---|---|---|
| agent-ops | `req-lead` | Authoring &mdash; Requirement lifecycle |
| agent-ops | `spec-lead` | Authoring &mdash; Spec authoring + Feature generation |
| agent-ops | `designer` | Authoring &mdash; UI/UX mockups |
| agent-ops | `tech-writer` | Documentation across audiences |
| agent-ops | `sprint-planner` | Iteration cadence + velocity |
| agent-ops | `dora-analyst` | DORA metrics + release governance |
| agent-ops | `ux-test-engineer` | E2E + load testing |
| agent-devs | `dev-lead` | Top-level Claude session; not a subagent |
| agent-devs | `backend-engineer` | Server-side implementation |
| agent-devs | `frontend-engineer` | Client-side UI &mdash; web / desktop / mobile / native / server-rendered |
| agent-devs | `database-engineer` | Schema + migrations |
| agent-devs | `integration-specialist` | External-system integration |
| agent-devs | `security-reviewer` | OWASP-aligned audit gate |
| agent-devs | `devops-lead` | IaC + cloud + pipelines |
| agent-devs | `test-strategist` | Test strategy + triage |

## The Connection-Discovery Model {#connection-discovery}

STRAP runs against host systems (work-tracking + source-control) that vary per adopter. Instead of shipping a fixed adapter per host, STRAP **probes each host live** and persists a per-project profile.

Two `/connect-*` skills drive this. Each follows the same five-step flow:

1. **CPO names the host** via `AskUserQuestion` (Azure DevOps / Jira / GitHub Issues / Local / Other for work-tracking; Azure Repos / GitHub / Bitbucket / Local Git / Other for source-control).
2. **Dev-lead authenticates** &mdash; env-var references only; credential values never enter any tracked file.
3. **Dev-lead explores** the host's capabilities: types, states, fields, links, iterations, PR-feedback surface. Write probes only with explicit CPO consent.
4. **Dev-lead models** the host as a connection profile: logical-to-host type mappings, state mappings (with `state_asymmetries` fallback for hosts where the state machine collapses), field mappings, capability declarations, and `operation_templates.<op>` &mdash; per-operation Mustache-templated request bodies for create / read / update / delete / query / link / comment.
5. **Dev-lead validates with the CPO and persists.**

Every production-workflow skill reads `operation_templates.<op>` from the profile at runtime, substitutes placeholders from the call site, and executes via the appropriate transport (Bash/curl for HTTP hosts, `az` / `gh` CLIs, filesystem writes for Local strap-agile). **Deterministic templates over reasoned-on-the-fly execution.**

## The Dispatch Model {#dispatch}

The dev-lead is the only fan-out layer. Specialists never spawn other specialists. Two primitives, two scenarios:

| Primitive | Use case | Return channel |
|---|---|---|
| `Task` / `Agent` (serial) | Authoring chains where one specialist's output feeds the next; single-target read-only investigations; review interactions. | Tool result |
| `CreateTeam` + parallel `Task` + `SendMessage` | Sprint execution waves; PR-feedback rounds; onboarding deep-dives; any case where 2+ specialists work on genuinely independent slices. | Team channel via `SendMessage` &mdash; specialists must call `SendMessage` or the dev-lead waits indefinitely. |

`CreateTeam` is gated behind two harness env keys (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and a valid `CLAUDE_CODE_SPAWN_BACKEND`); the installer seeds these in `settings.json` at install time.

## Work-Item Lifecycle Metadata {#lifecycle}

Every STRAP-created work item carries three pieces of metadata that survive across host conventions:

1. **Lifecycle metadata block** at the top of the description body &mdash; a table with `Authored By` / `Authored At` / `Completed By` / `Completed At` fields. Set at create (Authored half) and at resolution (Completed half). Template re-rendering on resolution preserves the original Authored half.
2. **`AI` tag** distinguishing AI-authored work from human-authored work. Surfaces in DORA queries (Agent Efficiency Ratio compares `AI`-tagged Tasks' original estimate against actual cycle time) and in adopter reporting.
3. **`strap:<logical-type>` tag** (e.g., `strap:requirement`, `strap:bug`) for findability when the host's type mapping collapses. The `strap:<logical-state>` tag (e.g., `strap:resolved`) plays the parallel role when the host state machine collapses.

State transitions are audited via `[STRAP/agent:<name>]` comments so the logical actor is identifiable even when the host's native actor identity is always the human's `az` credential.

## Customization {#customization}

STRAP is opinionated by design and the customization surface is much narrower than typical platform-style frameworks &mdash; the canonical roster is fixed, the skill catalog is fixed, and the per-project tuning happens through a small set of curated files the dev-lead writes on the CPO's direction.

### The customization surface

Four surfaces are adopter-tunable. Everything else is package-owned.

| Surface | What lives here | Editor |
|---|---|---|
| **Project profile** | `project-profile.md` &mdash; the curated record of what THIS project IS (stack, active domains, conventions, build/test commands, DevOps integration, optional `Mockup paths` on the `client-ui` domain, optional `Layers` section for DORA partitioning, optional top-level `Project docs paths` redirecting human-facing project-orientation docs). | dev-lead (CPO directs) |
| **Per-agent rules** | `rules/agents/<agent>.md` &mdash; per-agent guardrails added reactively when something needs preventing. | dev-lead (CPO directs) |
| **Per-agent memory** | `memory/agents/<agent>.md` &mdash; accumulated tradecraft for this project. | dev-lead (CPO directs) |
| **Connection profiles** | `state/devops-connection.yaml`, `state/code-connection.yaml` &mdash; per-project work-tracking + source-control wire-up. | `/connect-*` skills |

### Tuning specialist behavior

When a specialist almost made a mistake or has accumulated tradecraft worth keeping, the dev-lead curates per-agent rules or per-agent memory.

**Per-agent rules** are guardrails. *"Don't push directly to main." "Always run the test suite from the repo root."* Added reactively when something needs preventing.

**Per-agent memory** is soft tradecraft. *"The test runner takes 8 minutes after a fresh dependency install; warm it once first." "This codebase prefers the older mapping pattern for X."* Grows naturally as work happens.

The CPO can direct curation explicitly via `/memory-show <agent>` to see what's already there and `/memory-refine <agent>` to update. Both flow through the dev-lead under the single-curator rule. For budget tuning specifically &mdash; per-workflow per-agent and session-aggregate budgets, or per-agent overrides &mdash; the canonical surface is `/revise-token-budget`, which carries its own audit trail and persists to both `usage.yaml` and `MEMORY.md`.

### Adding your own agents, skills, and rules

The canonical roster of 15 agents and the package skill catalog are the **default** set STRAP ships with &mdash; not a wall. Adopters are encouraged to add their own. The persistence stack is the integration point that lets custom additions become first-class participants in the STRAP pipeline.

**Adopter-authored skills.** Standalone skills the CPO invokes directly: drop `.claude/skills/<your-skill>/SKILL.md` with standard frontmatter; the dev-lead reads the catalog every session. Pipeline-integrated skills that should fire as part of an existing workflow: either curate a per-agent rule directing the dev-lead to invoke yours at the right moment, or wire a `settings.json` hook for hands-off automation.

**Adopter-authored agents.** Three steps to make a custom agent a first-class pipeline participant:

1. Drop `<custom-agent>.md` at `.claude/agents/agent-{ops,devs}/` with the standard role-contract structure.
2. Seed `.claude/strap/rules/agents/<custom-agent>.md` and `.claude/strap/memory/agents/<custom-agent>.md`.
3. Ask the dev-lead to add the new agent to the `Specialists` field of the relevant `Domains` entry in `project-profile.md`. Single-curator rule applies.

From that moment, every pipeline skill that reads active-domain specialists routes work through the custom agent like any canonical one. Cross-cutting agents (compliance reviewer, project-specific governance) fit naturally as additional Specialists on existing canonical domains.

<div class="callout">
  <span class="label">/strap-upgrade is safe</span>
  <p>Custom additions are always preserved: adopter-authored agents and skills land at paths the package never ships to (classified <code>install-only</code>); per-agent rules and memory live in already-protected directories; project-profile.md edits are protected. The CPO cannot accidentally break the upgrade path by extending STRAP.</p>
</div>

<div class="callout warn">
  <span class="label">What is NOT supported</span>
  <p><strong>In-place edits to package-shipped artifacts.</strong> Editing a canonical agent's role contract file, a STRAP-shipped SKILL.md, or the team rules files directly surfaces as a <code>conflict</code> on every upgrade. The supported path for behavior changes is per-agent rules curation (stacks on top of the canonical role contract at runtime). The supported path for skill replacements is adding a new skill with a different name and directing the dev-lead to invoke yours.</p>
</div>

## Upgrades {#upgrades}

When you pull a newer STRAP source into your reference clone, `/strap-upgrade` reconciles the package against your installed `.claude/` tree.

### The model in one paragraph

STRAP separates **package-owned** files (skills, agent role contracts, team rules, templates, design docs) from two flavors of **protected** files. Category A adopter-owned files (project-profile, connection profiles, continuations, settings, per-install state) are excluded from the diff entirely &mdash; even if the package version differs, the install version wins. Category B seeded-then-curated files (per-agent rules + memory, dev-lead memory + index) ship as seeds: the adopter inherits the STRAP-source-curated content on fresh install, then accumulates customizations on top. On upgrade, `package-only` adds DO land (a new operating learning at STRAP source or a new specialist's seed reaches every adopter), but modify and conflict are suppressed so adopter curation wins. For package-owned files, the skill uses a three-way merge against the previous-version tarball (or the source clone's git history in source mode) to distinguish clean upgrades (you haven't touched the file; safe to overwrite) from conflicts (you customized AND the package changed; CPO decides).

### The approval gate

The skill presents the plan and meets you at one `AskUserQuestion` gate with five nominal options:

- **Apply (skip conflicts)** &mdash; apply clean changes; conflicts stay unchanged.
- **Apply with conflict strategy: take-package** &mdash; overwrite every conflict with the package version. Requires a second confirmation showing per-file consequences.
- **Apply with conflict strategy: keep-install** &mdash; leave every conflict file alone. Adopter customization preserved.
- **Pause** &mdash; stop without changes. Resolve conflicts manually and re-invoke.
- **Cancel** &mdash; abandon the upgrade. No changes.

### Recovery from a failed upgrade

`/strap-upgrade` is not transactional across the filesystem. If a write fails mid-apply you may end up with a partial upgrade. The simple recovery: `git checkout -- .claude/` to discard the partial upgrade, fix the underlying cause, re-run. The skill is idempotent at the version level &mdash; re-running from a clean state produces the same result.

## What's Next {#whats-next}

The v2.3 release ships STRAP's first official adopter-facing surface. From here, the v2.4 backlog focuses on adopter-tuning knobs and broader connection coverage.

Specific known-next surfaces, in rough priority order:

<div class="workflows">
  <div class="workflow">
    <h4>Project-docs depth control + security disclosure</h4>
    <p>A depth-setting knob in <code>project-profile.md</code> lets the CPO direct <code>tech-writer</code> at <code>/strap-in</code> + <code>/strap-refresh</code> Section 9 to condense <code>ARCHITECTURE.md</code> for large codebases or carve anti-patterns into a separate file the CPO can publish or not. A companion <code>Security disclosure</code> field gates whether security findings appear in project-docs vs only in specialist memory &mdash; default <em>include</em> for internal-use installs, <em>redact</em> for adopters with disclosure constraints.</p>
  </div>
  <div class="workflow">
    <h4>strap-agile iterations spec + HTML kanban viewer</h4>
    <p>The Local work-tracking host declares iterations supported but the filesystem layout for sprints isn't pinned down yet. v2.4 candidate: both specify it and ship a static-HTML export skill that renders <code>.claude/strap/work/*/*.md</code> as a backlog + kanban + sprint view for at-a-glance project state without leaving the repo.</p>
  </div>
  <div class="workflow">
    <h4>Connection-template gallery</h4>
    <p>Per-well-known-host accelerator templates that pre-fill the <code>/connect-*</code> five-step discovery for common cases (Jira, Bitbucket, additional Azure DevOps process templates) to skip much of the modeling step.</p>
  </div>
  <div class="workflow">
    <h4>Connection-profile multi-target + multi-repo execution</h4>
    <p>Native polyrepo support is in v2.3; multi-target federation (one work-tracking host with multiple deployment targets) and multi-repo coordination (single sprint spanning multiple sub-repos) are forward-scope under Epic #38963.</p>
  </div>
</div>

The story continues from here.
