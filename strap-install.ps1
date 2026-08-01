<#
.SYNOPSIS
    STRAP installer for Windows.

.DESCRIPTION
    Downloads a versioned STRAP package, verifies its SHA-256 checksum,
    extracts to <Target>\.claude\, and reports the next /strap-in or
    /strap-upgrade step depending on whether the install is fresh or
    an upgrade.

    Compatible with Windows PowerShell 5.1 (Win10+ built-in) and
    PowerShell 7+.

.PARAMETER Version
    Specific semver to install. Optional leading 'v' tolerated. When set,
    overrides the channel-resolved version. Must exist in the published
    manifest or installation aborts.

.PARAMETER Channel
    Release channel pointer when -Version is not given. 'stable' or 'rc'.
    Defaults to 'stable'.

.PARAMETER Target
    Directory to install into. Defaults to the current location. STRAP
    installs as <Target>\.claude\. The target directory must already exist.

.PARAMETER NoPrompt
    Skip interactive confirmations. Required for non-interactive contexts
    such as CI agents and headless provisioning scripts.

.PARAMETER VerifyOnly
    Verify the acquired tarball (downloaded or locally built) but do not
    extract. Useful for confirming a published artifact in CI without
    modifying the target.

.PARAMETER FromSource
    Install from a local source directory containing .claude/ instead of
    downloading a published tarball. Used for development and sandbox
    smoke-testing. All install steps after acquisition (extract, profile
    prep, settings reconcile, completion banner) run identically to a
    remote install. Ignores -Version and -Channel when set.

.EXAMPLE
    irm https://lmgstrapdist.blob.core.windows.net/releases/install.ps1 | iex

    Defaults: latest stable, current directory, prompts enabled.

.EXAMPLE
    & ([scriptblock]::Create((irm https://lmgstrapdist.blob.core.windows.net/releases/install.ps1))) -Channel rc -Target C:\src\my-project

    With explicit flags. The scriptblock-create form is required because
    the bare 'irm | iex' pipe does not bind script parameters.

.EXAMPLE
    $env:STRAP_CHANNEL = 'rc'; $env:STRAP_NO_PROMPT = '1'; irm https://lmgstrapdist.blob.core.windows.net/releases/install.ps1 | iex

    Environment-variable overrides for the bare pipe pattern.
    STRAP_VERSION, STRAP_CHANNEL, STRAP_TARGET, STRAP_NO_PROMPT,
    STRAP_VERIFY_ONLY are all honored.

.NOTES
    The installer will refuse to overwrite an existing .claude\ directory
    that lacks a .strap-version.json metadata file. This protects non-STRAP
    .claude\ directories from accidental overwrite. Move or delete the
    existing directory first if you intended to install over it.
#>
[CmdletBinding()]
param(
    [string]$Version = '',
    [ValidateSet('stable', 'rc')]
    [string]$Channel = 'stable',
    [string]$Target = '',
    [string]$FromSource = '',
    [switch]$NoPrompt,
    [switch]$VerifyOnly
)

function Invoke-StrapInstall {
    [CmdletBinding()]
    param(
        [string]$Version,
        [string]$Channel,
        [string]$Target,
        [string]$FromSource,
        [bool]$NoPrompt,
        [bool]$VerifyOnly,
        [hashtable]$BoundParameters
    )

    Set-StrictMode -Version Latest
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'

    if ($PSVersionTable.PSVersion.Major -lt 5) {
        throw "STRAP installer requires PowerShell 5.1 or newer. Current: $($PSVersionTable.PSVersion)"
    }

    if ([string]::IsNullOrWhiteSpace($Version) -and $env:STRAP_VERSION) {
        $Version = $env:STRAP_VERSION
    }
    if (-not $BoundParameters.ContainsKey('Channel') -and $env:STRAP_CHANNEL) {
        if ($env:STRAP_CHANNEL -in @('stable', 'rc')) {
            $Channel = $env:STRAP_CHANNEL
        } else {
            throw "STRAP_CHANNEL='$($env:STRAP_CHANNEL)' is invalid. Must be 'stable' or 'rc'."
        }
    }
    if ([string]::IsNullOrWhiteSpace($Target)) {
        $Target = if ($env:STRAP_TARGET) { $env:STRAP_TARGET } else { (Get-Location).Path }
    }
    if (-not $NoPrompt -and $env:STRAP_NO_PROMPT -eq '1') { $NoPrompt = $true }
    if (-not $VerifyOnly -and $env:STRAP_VERIFY_ONLY -eq '1') { $VerifyOnly = $true }

    if ($FromSource) {
        $claudeUnderSource = Join-Path $FromSource '.claude'
        if (-not (Test-Path -LiteralPath $claudeUnderSource)) {
            throw "-FromSource path '$FromSource' does not contain a .claude/ directory"
        }
        $FromSource = (Resolve-Path -LiteralPath $FromSource).Path
        if ($Version) {
            Write-Warning '-Version ignored when -FromSource is set'
            $Version = ''
        }
        $Channel = 'source'
    }

    $BaseUrl = 'https://lmgstrapdist.blob.core.windows.net/releases'

    Write-Host '=== STRAP Installer ==='
    if ($FromSource) {
        Write-Host '  mode    : LOCAL SOURCE (-FromSource)'
        Write-Host "  source  : $FromSource"
        Write-Host "  target  : $Target"
    } else {
        Write-Host "  channel : $Channel"
        if ($Version) { Write-Host "  version : $Version (explicit override)" }
        Write-Host "  target  : $Target"
        if ($VerifyOnly) { Write-Host '  mode    : verify-only (no extract)' }
    }
    Write-Host ''

    if (-not $FromSource) {
        $manifestUrl = "$BaseUrl/manifest.json"
        Write-Host "[1/7] Fetching manifest"
        Write-Host "  $manifestUrl"
        try {
            $manifest = Invoke-RestMethod -Uri $manifestUrl -UseBasicParsing
        } catch {
            throw "Failed to fetch manifest from $manifestUrl. Underlying error: $($_.Exception.Message)"
        }

        if ($manifest.schemaVersion -ne 1) {
            throw "Manifest schemaVersion $($manifest.schemaVersion) is not supported by this installer. Upgrade install.ps1."
        }

        if ($Version) {
            $resolved = $Version -replace '^v', ''
        } else {
            $channelProp = $manifest.channels.PSObject.Properties[$Channel]
            if (-not $channelProp -or -not $channelProp.Value) {
                throw "Channel '$Channel' has no published version yet. Try -Channel rc, or pass -Version <ver>."
            }
            $resolved = $channelProp.Value
        }

        $versionProp = $manifest.versions.PSObject.Properties[$resolved]
        if (-not $versionProp) {
            $available = ($manifest.versions.PSObject.Properties | ForEach-Object { $_.Name }) -join ', '
            throw "Version '$resolved' is not in the manifest. Available versions: $available"
        }
        $versionEntry = $versionProp.Value
        $tarballPath = $versionEntry.tarball.path
        $expectedSha256 = $versionEntry.tarball.sha256
        Write-Host "  resolved version : $resolved"
        Write-Host "  tarball          : $tarballPath"
        Write-Host "  sha256 (expected): $expectedSha256"
        Write-Host ''
    } else {
        Write-Host '[1/7] Preparing local source'
        Write-Host "  source path : $FromSource"
        $sourceSha = 'unknown'
        $sourceBranch = 'unknown'
        $dirty = ''
        $gitDir = Join-Path $FromSource '.git'
        $gitCmd = Get-Command git -ErrorAction SilentlyContinue
        if ((Test-Path -LiteralPath $gitDir) -and $gitCmd) {
            $sourceSha = (& git -C $FromSource rev-parse --short HEAD 2>$null)
            if ($LASTEXITCODE -ne 0 -or -not $sourceSha) { $sourceSha = 'unknown' }
            $sourceBranch = (& git -C $FromSource rev-parse --abbrev-ref HEAD 2>$null)
            if ($LASTEXITCODE -ne 0 -or -not $sourceBranch) { $sourceBranch = 'unknown' }
            & git -C $FromSource diff --quiet 2>$null
            if ($LASTEXITCODE -ne 0) { $dirty = '-dirty' }
            if (-not $dirty) {
                & git -C $FromSource diff --cached --quiet 2>$null
                if ($LASTEXITCODE -ne 0) { $dirty = '-dirty' }
            }
            $resolved = "source-$sourceSha$dirty"
            Write-Host "  git branch  : $sourceBranch"
            Write-Host "  git sha     : $sourceSha$dirty"
        } else {
            $resolved = "source-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))"
        }
        Write-Host "  resolved version : $resolved"
        Write-Host ''
    }

    if (-not (Test-Path -LiteralPath $Target)) {
        throw "Target directory '$Target' does not exist. Create it or pass an existing path via -Target."
    }
    $claudeDir = Join-Path $Target '.claude'
    $versionMetaPath = Join-Path $claudeDir '.strap-version.json'

    $isUpgrade = $false
    $isMergeInstall = $false
    $existingVersion = $null
    if (Test-Path -LiteralPath $claudeDir) {
        if (Test-Path -LiteralPath $versionMetaPath) {
            try {
                $existing = Get-Content -Raw -LiteralPath $versionMetaPath | ConvertFrom-Json
                $existingVersion = $existing.version
                $isUpgrade = $true
                Write-Host "Existing STRAP install detected: version $existingVersion"
            } catch {
                throw "$claudeDir has an unreadable .strap-version.json (parse error: $($_.Exception.Message)). Repair or remove it before installing."
            }
        } else {
            $isMergeInstall = $true
        }
    }

    if ($isMergeInstall -and -not $VerifyOnly) {
        Write-Host ''
        Write-Host 'Existing .claude/ detected without STRAP metadata.'
        Write-Host 'STRAP will be installed alongside your existing artifacts (merge install).'
        Write-Host ''
        Write-Host '  STRAP-managed paths (created or overwritten on collision):'
        Write-Host '    .claude/strap/templates/, .claude/strap/contexts/,'
        Write-Host '    .claude/strap/rules/, .claude/strap/wikis/, .claude/strap/docs/,'
        Write-Host '    .claude/agents/agent-ops/, .claude/agents/agent-devs/,'
        Write-Host '    .claude/skills/<STRAP skills>/, .claude/strap/config/'
        Write-Host ''
        Write-Host '  STRAP env + permissions merged (non-destructive) into:'
        Write-Host '    .claude/settings.json -- env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1'
        Write-Host '                              env.CLAUDE_CODE_SPAWN_BACKEND=auto'
        Write-Host '                              permissions.allow += Edit(.claude/**), Write(.claude/**),'
        Write-Host '                                                   Bash(mkdir:*), Bash(git log:*),'
        Write-Host '                                                   Bash(git status:*), Bash(git diff:*),'
        Write-Host '                                                   Bash(git rev-parse:*), Bash(git branch:*),'
        Write-Host '                                                   Bash(git ls-files:*), Bash(git show:*),'
        Write-Host '                                                   Bash(ls:*), Bash(find:*), Bash(wc:*),'
        Write-Host '                                                   Bash(head:*), Bash(tail:*), Bash(cat:*),'
        Write-Host '                                                   Bash(basename:*), Bash(dirname:*)'
        Write-Host '                              other top-level keys preserved'
        Write-Host ''
        Write-Host '  Adopter-owned paths (untouched):'
        Write-Host '    .claude/settings.local.json (per-developer overrides),'
        Write-Host '    .claude/CLAUDE.md, your custom .claude/agents/<*>.md,'
        Write-Host '    your custom .claude/skills/<*>/, .claude/commands/, MCP configs'
        Write-Host ''
        Write-Host 'Actual file collisions are rare because STRAP namespaces every'
        Write-Host 'shipped artifact under specific subdirs (agent-ops/, agent-devs/)'
        Write-Host 'and STRAP-specific skill names (/strap-in, /strap-refresh, /connect-*, /strap-upgrade, etc).'
        Write-Host ''
        if (-not $NoPrompt) {
            $answer = Read-Host 'Proceed with merge install? (y/N)'
            if ($answer -notmatch '^[yY]') {
                throw 'Merge install declined by user.'
            }
        } else {
            Write-Host '  --no-prompt set; proceeding without confirmation.'
            Write-Host ''
        }
    }

    if ($isUpgrade -and -not $NoPrompt -and -not $VerifyOnly) {
        Write-Host ''
        Write-Host "Upgrading STRAP: $existingVersion -> $resolved"
        Write-Host 'Existing .claude/ files will be overwritten in place.'
        Write-Host 'Recommended: commit any pending changes in this repo first.'
        $answer = Read-Host 'Proceed? (y/N)'
        if ($answer -notmatch '^[yY]') {
            throw 'Upgrade declined by user.'
        }
    }

    $tempDir = Join-Path $env:TEMP "strap-install-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    if (-not $FromSource) {
        $tarballUrl = "$BaseUrl/$tarballPath"
        $tempTarball = Join-Path $tempDir (Split-Path $tarballPath -Leaf)
        Write-Host "[2/7] Downloading tarball"
        Write-Host "  $tarballUrl"
        try {
            Invoke-WebRequest -Uri $tarballUrl -OutFile $tempTarball -UseBasicParsing
        } catch {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
            throw "Failed to download tarball from $tarballUrl. Underlying error: $($_.Exception.Message)"
        }
        $size = (Get-Item -LiteralPath $tempTarball).Length
        Write-Host "  saved : $tempTarball ($size bytes)"
        Write-Host ''

        Write-Host '[3/7] Verifying SHA-256'
        $actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $tempTarball).Hash.ToLower()
        if ($actualSha256 -ne $expectedSha256.ToLower()) {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
            throw @"
SHA-256 mismatch for downloaded tarball. Refusing to install.
  expected: $expectedSha256
  actual  : $actualSha256
"@
        }
        Write-Host "  verified ($actualSha256)"
        Write-Host ''
    } else {
        $tempTarball = Join-Path $tempDir "strap-$resolved.tar.gz"
        Write-Host '[2/7] Building local tarball'

        $tarExe = Get-Command tar.exe -ErrorAction SilentlyContinue
        if (-not $tarExe) {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
            throw 'tar.exe not found on PATH. Required for -FromSource mode. Windows 10 (1803+) and Windows 11 ship bsdtar built-in.'
        }

        Push-Location -LiteralPath $FromSource
        $tarExitCode = 0
        try {
            # INSTALL-TIME EXCLUDES: STRAP-source state that should NOT
            # propagate to adopter installs because either (a) the installer
            # writes a fresh per-install .strap-version.json, (b) the
            # installer copies a separate scaffold for project-profile.md
            # from .claude/strap/templates/project-profile.scaffold.md, or
            # (c) continuations are STRAP-source session bookkeeping.
            #
            # Memory paths (MEMORY.md + dev-lead/) DO ship: STRAP source
            # curates them with universal operating learnings that apply to
            # every adopter dev-lead. /strap-upgrade's "seeded-then-curated"
            # category preserves adopter customizations on upgrade while still
            # applying package-only adds.
            #
            # If you add or remove an entry, mirror it in:
            #   - infra/install/install.sh             (tar --exclude=)
            #   - infra/pipeline/scripts/package.sh    (both TAR_FLAGS and zip)
            #
            # STRAP-source-only authoring content (docs/source-design/,
            # docs/wikis/, .work-items/) lives outside .claude/ so it never
            # enters the tarball.
            & tar.exe -czf $tempTarball `
                --exclude='.strap-version.json' `
                --exclude='.claude/strap/contexts/project-profile.md' `
                --exclude='.claude/strap/contexts/continuations' `
                --exclude='node_modules' `
                --exclude='package-lock.json' `
                .claude
            $tarExitCode = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        if ($tarExitCode -ne 0) {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
            throw "tar.exe exited with code $tarExitCode while building tarball from $FromSource"
        }
        $size = (Get-Item -LiteralPath $tempTarball).Length
        Write-Host "  built : $tempTarball ($size bytes)"
        Write-Host ''

        Write-Host '[3/7] Verifying local tarball'
        & tar.exe -tzf $tempTarball | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
            throw 'locally-built tarball failed integrity check'
        }
        $actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $tempTarball).Hash.ToLower()
        Write-Host "  ok (computed sha256: $actualSha256; no remote SHA to compare against in source mode)"
        Write-Host ''
    }

    if ($VerifyOnly) {
        Write-Host '=== Verify-only complete; not extracting ==='
        Write-Host "  tarball remains at: $tempTarball"
        return
    }

    $tarExe = Get-Command tar.exe -ErrorAction SilentlyContinue
    if (-not $tarExe) {
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        throw 'tar.exe not found on PATH. Windows 10 (1803+) and Windows 11 ship with bsdtar; use a supported OS or install bsdtar manually.'
    }

    Write-Host "[4/7] Extracting to $Target"
    Push-Location -LiteralPath $Target
    try {
        & tar.exe -xzf $tempTarball
        if ($LASTEXITCODE -ne 0) {
            throw "tar.exe exited with code $LASTEXITCODE while extracting $tempTarball"
        }
    } finally {
        Pop-Location
    }
    Write-Host "  extracted .claude/ into $Target"
    Write-Host ''

    # Record the distribution URL so /strap-upgrade can fetch the manifest and
    # tarballs at upgrade time without requiring a source clone. For -FromSource
    # installs (STRAP-on-STRAP development, sandbox smoke), distributionUrl is
    # $null; /strap-upgrade falls back to -FromSource mode in that case.
    if ($FromSource) {
        $distributionUrl = $null
    } else {
        $distributionUrl = $BaseUrl
    }

    $meta = [pscustomobject]@{
        version         = $resolved
        channel         = $Channel
        distributionUrl = $distributionUrl
        installedAt     = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        tarballSha256   = $actualSha256
        installedBy     = 'install.ps1'
    }
    $meta | ConvertTo-Json | Set-Content -LiteralPath $versionMetaPath -Encoding UTF8

    Write-Host '[5/7] Preparing project profile and state'
    $stateDir = Join-Path $claudeDir 'strap\state'
    if (-not (Test-Path -LiteralPath $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }
    Write-Host "  ensured: $stateDir\"

    $scaffoldSrc = Join-Path $claudeDir 'strap\templates\project-profile.scaffold.md'
    $profileDst  = Join-Path $claudeDir 'strap\contexts\project-profile.md'
    $sentinel    = '<!-- STRAP_SCAFFOLD -->'
    $adopterCurated = $false
    if ((Test-Path -LiteralPath $profileDst) -and -not $isUpgrade) {
        $existingContent = Get-Content -Raw -LiteralPath $profileDst -ErrorAction SilentlyContinue
        if ($existingContent -and ($existingContent -notmatch [regex]::Escape($sentinel))) {
            $adopterCurated = $true
        }
    }
    if ($isUpgrade) {
        Write-Host '  upgrade: project-profile.md preserved (adopter-curated)'
    } elseif ($adopterCurated) {
        # Adopter content present (sentinel absent) -- never overwrite curated work.
        # This fires when a prior STRAP install lost .strap-version.json and the
        # merge-install path re-enters against a curated tree.
        Write-Host '  merge: existing project-profile.md is past its scaffold state; preserved'
    } elseif (Test-Path -LiteralPath $scaffoldSrc) {
        $profileDir = Split-Path -Parent $profileDst
        if (-not (Test-Path -LiteralPath $profileDir)) {
            New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $scaffoldSrc -Destination $profileDst -Force
        Write-Host "  wrote scaffold $profileDst"
        Write-Host '  (sentinel marked; /strap-in will populate and strip it)'
    } else {
        Write-Host "  WARNING: scaffold template missing at $scaffoldSrc"
        Write-Host '           /strap-in pre-flight will fail until the file is restored manually'
    }
    Write-Host ''

    Write-Host '[6/7] Reconciling harness settings'
    $settingsPath = Join-Path $claudeDir 'settings.json'
    $settings = $null
    if (Test-Path -LiteralPath $settingsPath) {
        try {
            $settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
            Write-Host "  existing settings.json read; merging STRAP env keys"
        } catch {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
            throw "$settingsPath is malformed JSON: $($_.Exception.Message). Repair or remove it before re-running install.ps1."
        }
    } else {
        $settings = [pscustomobject]@{}
        Write-Host "  no settings.json found; creating with STRAP env block"
    }
    if (-not ($settings.PSObject.Properties['env'])) {
        $settings | Add-Member -NotePropertyName 'env' -NotePropertyValue ([pscustomobject]@{})
    }
    $settings.env | Add-Member -NotePropertyName 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS' -NotePropertyValue '1' -Force
    $validBackends = @('auto', 'tmux', 'in-process')
    $existingBackend = $null
    if ($settings.env.PSObject.Properties['CLAUDE_CODE_SPAWN_BACKEND']) {
        $existingBackend = $settings.env.CLAUDE_CODE_SPAWN_BACKEND
    }
    if (-not $existingBackend -or $existingBackend -notin $validBackends) {
        $settings.env | Add-Member -NotePropertyName 'CLAUDE_CODE_SPAWN_BACKEND' -NotePropertyValue 'auto' -Force
        Write-Host "  CLAUDE_CODE_SPAWN_BACKEND set to 'auto'"
    } else {
        Write-Host "  CLAUDE_CODE_SPAWN_BACKEND already set to '$existingBackend' (preserved)"
    }
    if (-not ($settings.PSObject.Properties['permissions'])) {
        $settings | Add-Member -NotePropertyName 'permissions' -NotePropertyValue ([pscustomobject]@{})
    }
    if (-not ($settings.permissions.PSObject.Properties['allow'])) {
        $settings.permissions | Add-Member -NotePropertyName 'allow' -NotePropertyValue @() -Force
    }
    $strapGrants = @(
        'Edit(.claude/**)',
        'Write(.claude/**)',
        'Bash(mkdir:*)',
        'Bash(git log:*)',
        'Bash(git status:*)',
        'Bash(git diff:*)',
        'Bash(git rev-parse:*)',
        'Bash(git branch:*)',
        'Bash(git ls-files:*)',
        'Bash(git show:*)',
        'Bash(ls:*)',
        'Bash(find:*)',
        'Bash(wc:*)',
        'Bash(head:*)',
        'Bash(tail:*)',
        'Bash(cat:*)',
        'Bash(basename:*)',
        'Bash(dirname:*)'
    )
    $currentAllow = @($settings.permissions.allow)
    $grantsAdded = @()
    foreach ($grant in $strapGrants) {
        if ($currentAllow -notcontains $grant) {
            $currentAllow += $grant
            $grantsAdded += $grant
        }
    }
    $settings.permissions.allow = $currentAllow
    if ($grantsAdded.Count -gt 0) {
        Write-Host "  permissions.allow seeded with STRAP grants: $($grantsAdded -join ', ')"
    } else {
        Write-Host "  permissions.allow already carries STRAP grants (preserved)"
    }
    $settingsTempPath = "$settingsPath.tmp"
    $settings | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $settingsTempPath -Encoding UTF8
    Move-Item -Force -LiteralPath $settingsTempPath -Destination $settingsPath
    Write-Host "  wrote $settingsPath"
    Write-Host ''

    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

    Write-Host '[7/7] Done.'
    Write-Host ''
    if ($FromSource) {
        Write-Host '=== Install complete (source mode) ==='
    } else {
        Write-Host '=== Install complete ==='
    }
    if ($isUpgrade) {
        Write-Host "  Upgraded $existingVersion -> $resolved"
        Write-Host '  Open Claude Code in this directory and run:  /strap-upgrade'
    } elseif ($isMergeInstall) {
        Write-Host "  Installed $resolved alongside existing .claude/ artifacts"
        Write-Host '  Open Claude Code in this directory and run:  /strap-in'
        Write-Host '    (if Claude Code was already open here, /exit and restart it first --'
        Write-Host '     the new .claude/skills/ has to exist at session start to be watched)'
    } else {
        Write-Host "  Installed $resolved"
        Write-Host '  Open Claude Code in this directory and run:  /strap-in'
        Write-Host '    (if Claude Code was already open here, /exit and restart it first --'
        Write-Host '     the new .claude/skills/ has to exist at session start to be watched)'
    }
}

Invoke-StrapInstall `
    -Version $Version `
    -Channel $Channel `
    -Target $Target `
    -FromSource $FromSource `
    -NoPrompt:$NoPrompt.IsPresent `
    -VerifyOnly:$VerifyOnly.IsPresent `
    -BoundParameters $PSBoundParameters
