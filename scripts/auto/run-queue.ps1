<#
.SYNOPSIS
    OpenCode task queue runner.

.DESCRIPTION
    Picks the oldest queued task, runs it with OpenCode on a Claude model, and parks the
    task when the provider is rate limited. When the limit resets the task resumes in the
    SAME session, so the model keeps its full context and continues from where it stopped.

    Task files live in  <Queue>\pending\*.md
    Optional front matter:
        ---
        title: Short title
        model: xkiro/anthropic/claude-opus-5.5   # overrides -Model for this task
        agent: build                              # overrides -Agent for this task
        ---
        <the instruction for Claude>

.EXAMPLE
    .\run-queue.ps1 -Once
    Runs exactly one pending task (or exits immediately if the queue is empty).

.EXAMPLE
    .\run-queue.ps1 -Model xkiro/anthropic/claude-sonnet-5.5
    Runs the queue loop, retrying rate limited tasks every 60 seconds.
#>
[CmdletBinding()]
param(
    # Directory that owns opencode.json (the project the task runs against).
    [string]$Project = '',

    # Queue root. Sub folders pending/running/done/failed/logs are created on demand.
    [string]$Queue = '',

    # Default model. Per task front matter wins over this.
    [string]$Model = 'xkiro/anthropic/claude-sonnet-5.5',

    # Default agent for the run.
    [string]$Agent = 'build',

    # Seconds to wait before retrying a task that was rate limited.
    [int]$PollSeconds = 60,

    # Give up on a task after this many minutes of waiting for the provider to recover.
    [int]$MaxWaitMinutes = 720,

    # Hard cap on attempts per task.
    [int]$MaxAttempts = 500,

    # Process a single task and exit instead of looping forever.
    [switch]$Once
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

# Resolve the script directory here: $PSScriptRoot is not reliable inside param defaults.
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Project) { $Project = (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path }
if (-not $Queue) { $Queue = Join-Path $ScriptRoot 'tasks' }

# --------------------------------------------------------------------------- paths
$PendingDir = Join-Path $Queue 'pending'
$RunningDir = Join-Path $Queue 'running'
$DoneDir = Join-Path $Queue 'done'
$FailedDir = Join-Path $Queue 'failed'
$LogDir = Join-Path $Queue 'logs'

foreach ($d in @($PendingDir, $RunningDir, $DoneDir, $FailedDir, $LogDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

$LogFile = Join-Path $LogDir ("queue-{0}.log" -f (Get-Date -Format 'yyyyMM-dd'))

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO', [string]$Task = '')
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $prefix = if ($Task) { "[$Task] " } else { '' }
    $line = "{0} {1,-5} {2}{3}" -f $stamp, $Level, $prefix, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# --------------------------------------------------------------------------- lock
# Only one runner may own a queue at a time.
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes((Resolve-Path $Queue).Path))
$mutexName = 'OpenCodeAutoQueue-' + ([System.BitConverter]::ToString($hash).Replace('-', '').Substring(0, 16))
$mutex = New-Object System.Threading.Mutex($false, "Local\$mutexName")
$ownsLock = $false
try {
    $ownsLock = $mutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
    $ownsLock = $true
}
if (-not $ownsLock) {
    Write-Log 'Another runner instance already owns this queue. Exiting.' 'WARN'
    exit 0
}

# --------------------------------------------------------------------------- helpers
function ConvertTo-SessionId {
    param([string]$Name)
    $slug = ($Name -replace '[^A-Za-z0-9]+', '-').Trim('-').ToLowerInvariant()
    if (-not $slug) { $slug = 'task' }
    if ($slug.Length -gt 48) { $slug = $slug.Substring(0, 48) }
    return "ses-auto-$slug"
}

function Read-TaskFile {
    param([string]$Path)
    $raw = Get-Content $Path -Raw
    $meta = @{}
    $body = $raw
    if ($raw -match '(?s)^﻿?---\s*\r?\n(.*?)\r?\n---\s*\r?\n(.*)$') {
        $front = $Matches[1]
        $body = $Matches[2]
        foreach ($line in ($front -split '\r?\n')) {
            if ($line -match '^\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$') {
                $meta[$Matches[1].ToLowerInvariant()] = $Matches[2].Trim('"', ' ')
            }
        }
    }
    return [pscustomobject]@{ Meta = $meta; Body = $body.Trim() }
}

function Invoke-OpenCodeRun {
    <#
        Runs `opencode run` in the project directory and returns the parsed event stream.
        stdout is JSON events (--format json), stderr keeps the human readable output.
    #>
    param(
        [string]$SessionId,
        [string]$RunModel,
        [string]$RunAgent,
        [string]$Prompt,
        [string]$WorkDir
    )
    $outFile = [IO.Path]::GetTempFileName()
    $errFile = "$outFile.err"
    $code = 0
    Push-Location $WorkDir
    try {
        & opencode run --format json --session $SessionId --model $RunModel --agent $RunAgent --auto $Prompt 1> $outFile 2> $errFile
        $code = $LASTEXITCODE
    } catch {
        Write-Log "opencode run failed to start: $($_.Exception.Message)" 'ERROR'
    } finally {
        Pop-Location
    }

    $events = @()
    foreach ($line in (Get-Content $outFile -ErrorAction SilentlyContinue)) {
        $t = "$line".Trim()
        if (-not $t) { continue }
        try { $events += ($t | ConvertFrom-Json) } catch { }
    }
    $stderr = (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
    Remove-Item $outFile, $errFile -Force -ErrorAction SilentlyContinue

    return [pscustomobject]@{
        ExitCode = $code
        Events = $events
        Stderr = $stderr
    }
}

function Get-RunError {
    param($Events)
    $err = $null
    foreach ($e in $Events) {
        if ($e.type -eq 'error') { $err = $e.error }
    }
    if (-not $err) { return $null }
    $status = $null
    $body = ''
    $msg = ''
    $type = ''
    try { $type = "$($err.type)" } catch { }
    try { $msg = "$($err.message)" } catch { }
    try { $status = $err.status } catch { }
    try { $body = "$($err.response.body)" } catch { }
    return [pscustomobject]@{ Type = $type; Status = $status; Message = $msg; Body = $body }
}

function Test-IsLimit {
    param($Err)
    if (-not $Err) { return $false }
    if ($Err.Status -eq 429) { return $true }
    $blob = ("{0} {1} {2}" -f $Err.Message, $Err.Body, $Err.Type).ToLowerInvariant()
    if ($blob -match 'rate.?limit|too many requests|usage limit|quota|credit balance|insufficient_quota|\b429\b') { return $true }
    return $false
}

function Test-IsTransient {
    param($Err)
    if (-not $Err) { return $false }
    if ($Err.Status -ge 500) { return $true }
    $blob = ("{0} {1} {2}" -f $Err.Message, $Err.Body, $Err.Type).ToLowerInvariant()
    if ($blob -match 'server error|overloaded|service_unavailable|try again') { return $true }
    return $false
}

function Get-ResetHint {
    <#
        Best effort extraction of a provider supplied reset time.
        Returns seconds until reset, or $null.
    #>
    param($Err)
    if (-not $Err) { return $null }
    $blob = "{0} {1}" -f $Err.Message, $Err.Body

    if ($blob -match '(?i)retryAfterMs"?\s*[:=]\s*(\d+)') {
        $ms = [double]$Matches[1]
        if ($ms -gt 0) { return [int]([Math]::Ceiling($ms / 1000)) }
    }
    if ($blob -match '(?i)(?:retry|reset|resets|available)[^0-9]{0,20}(\d+)\s*(ms|milliseconds|millisecond|s|sec|secs|seconds|second|m|min|mins|minutes|minute|h|hours|hour)') {
        $value = [double]$Matches[1]
        $unit = $Matches[2].ToLowerInvariant()
        $seconds = switch -Regex ($unit) {
            '^ms|^millisecond' { $value / 1000; break }
            '^m(in)?' { $value * 60; break }
            '^h' { $value * 3600; break }
            default { $value }
        }
        if ($seconds -gt 0) { return [int][Math]::Ceiling($seconds) }
    }
    if ($blob -match '\b(1[6-9]\d{11})\b') {
        $ms = [double]$Matches[1]
        $delta = [Math]::Round(([DateTimeOffset]::FromUnixTimeMilliseconds([int64]$ms) - [DateTimeOffset]::UtcNow).TotalSeconds)
        if ($delta -gt 0) { return [int]$delta }
    }
    if ($blob -match '(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z?)') {
        try {
            $when = [DateTimeOffset]::Parse($Matches[1])
            $delta = [Math]::Round(($when - [DateTimeOffset]::UtcNow).TotalSeconds)
            if ($delta -gt 0) { return [int]$delta }
        } catch { }
    }
    return $null
}

function Invoke-Task {
    param([System.IO.FileInfo]$File)

    $task = Read-TaskFile $File.FullName
    $title = if ($task.Meta.ContainsKey('title')) { $task.Meta['title'] } else { $File.BaseName }
    $runModel = if ($task.Meta.ContainsKey('model')) { $task.Meta['model'] } else { $Model }
    $runAgent = if ($task.Meta.ContainsKey('agent')) { $task.Meta['agent'] } else { $Agent }
    $sessionId = ConvertTo-SessionId $File.BaseName

    $runningFile = Join-Path $RunningDir $File.Name
    Move-Item -Path $File.FullName -Destination $runningFile -Force

    Write-Log "START '$title' model=$runModel agent=$runAgent session=$sessionId" 'INFO' $File.BaseName

    $attempt = 0
    $waitedMinutes = 0
    $firstPrompt = @"
You are working in the repository at $Project.

$($task.Body)

Work autonomously until the task is complete. Verify your own work before you stop.
"@

    $resumePrompt = @"
Your previous turn was interrupted by a provider usage limit, not by a task error. The limit has now reset.

Re-read the current state of the repository, do not redo work that is already finished, and continue the task from where it stopped. When the task is complete, verify the result and give a short summary.
"@

    while ($attempt -lt $MaxAttempts) {
        $attempt++
        $prompt = if ($attempt -eq 1) { $firstPrompt } else { $resumePrompt }

        $result = Invoke-OpenCodeRun -SessionId $sessionId -RunModel $runModel -RunAgent $runAgent -Prompt $prompt -WorkDir $Project
        $err = Get-RunError $result.Events
        $texts = @($result.Events | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.part.text })
        Write-Log ("exit={0} events={1} types={2} texts={3}" -f $result.ExitCode, @($result.Events).Count, ((@($result.Events) | ForEach-Object { $_.type }) -join ','), ($texts -join ' ').Length) 'INFO' $File.BaseName

        if (-not $err -and $result.ExitCode -eq 0) {
            $summary = ($texts -join ' ').Trim()
            if ($summary.Length -gt 4000) { $summary = $summary.Substring(0, 4000) }
            $doneFile = Join-Path $DoneDir $File.Name
            Set-Content -Path $doneFile -Value $task.Body -Encoding UTF8
            $resultFile = Join-Path $DoneDir ($File.BaseName + '.result.txt')
            Set-Content -Path $resultFile -Value ("session: $sessionId`nmodel: $runModel`nattempts: $attempt`n`n$summary") -Encoding UTF8
            Write-Log "DONE after $attempt attempt(s), waited ${waitedMinutes}m -> $doneFile" 'INFO' $File.BaseName
            return $true
        }

        $isLimit = Test-IsLimit $err
        $isTransient = Test-IsTransient $err
        $kind = if ($isLimit) { 'LIMIT' } elseif ($isTransient) { 'TRANSIENT' } else { 'ERROR' }
        $detail = if ($err) { "{0} status={1} {2}" -f $err.Type, $err.Status, $err.Message } else { "exit=$($result.ExitCode) $($result.Stderr)" }
        Write-Log "$kind on attempt $attempt -> $detail" 'WARN' $File.BaseName

        if ($kind -eq 'ERROR') {
            $failFile = Join-Path $FailedDir $File.Name
            Set-Content -Path $failFile -Value ("{0}`n`n--- failure ---`n{1}" -f $task.Body, $detail) -Encoding UTF8
            Write-Log "FAILED (non recoverable) -> $failFile" 'ERROR' $File.BaseName
            return $false
        }

        $wait = $PollSeconds
        $hint = Get-ResetHint $err
        if ($hint -and $hint -gt 0) {
            $wait = [Math]::Min($hint, $MaxWaitMinutes * 60)
            Write-Log "provider reported a reset in ~$([int]($hint / 60))m $([int]($hint % 60))s" 'INFO' $File.BaseName
        } elseif ($kind -eq 'TRANSIENT') {
            $wait = [Math]::Min($PollSeconds * [Math]::Pow(2, [Math]::Min($attempt - 1, 5)), $MaxWaitMinutes * 60)
        }

        if (($waitedMinutes + ($wait / 60)) -gt $MaxWaitMinutes) {
            $failFile = Join-Path $FailedDir $File.Name
            Set-Content -Path $failFile -Value ("{0}`n`n--- gave up after {1}m of provider downtime ---`n{2}" -f $task.Body, $waitedMinutes, $detail) -Encoding UTF8
            Write-Log "GAVE UP after ${waitedMinutes}m of provider downtime -> $failFile" 'ERROR' $File.BaseName
            return $false
        }

        $waitedMinutes += [Math]::Round($wait / 60, 2)
        Write-Log "waiting $wait s before resuming the same session ($sessionId)" 'INFO' $File.BaseName
        Start-Sleep -Seconds $wait
    }

    $failFile = Join-Path $FailedDir $File.Name
    Set-Content -Path $failFile -Value ("{0}`n`n--- attempt limit reached ---" -f $task.Body) -Encoding UTF8
    Write-Log "GAVE UP after $MaxAttempts attempts -> $failFile" 'ERROR' $File.BaseName
    return $false
}

function Get-NextTask {
    if (-not (Test-Path $PendingDir)) { return $null }
    $files = Get-ChildItem -Path $PendingDir -Filter '*.md' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime, Name
    foreach ($f in $files) {
        if ($f.Name -like '_*') { continue }
        if ($f.Name -like 'README*') { continue }
        return $f
    }
    return $null
}

# --------------------------------------------------------------------------- main
Write-Log "runner start | project=$Project | model=$Model | agent=$Agent | poll=${PollSeconds}s" 'INFO'
try {
    while ($true) {
        $task = Get-NextTask
        if (-not $task) {
            if ($Once) { Write-Log 'queue empty, nothing to do' 'INFO'; break }
            Start-Sleep -Seconds $PollSeconds
            continue
        }
        $null = Invoke-Task -File $task
        if ($Once) { break }
    }
} finally {
    if ($ownsLock) { try { $mutex.ReleaseMutex() } catch { } }
    $mutex.Dispose()
}
