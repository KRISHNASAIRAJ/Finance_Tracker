<#
.SYNOPSIS
    Registers (or removes) a Windows scheduled task that keeps the OpenCode task queue running.

.DESCRIPTION
    Creates two triggers:
      * At log on  - starts the runner as soon as you sign in.
      * Every 15 min - a watchdog that restarts the runner if it died (the runner takes an
        exclusive lock, so a second instance exits immediately instead of double processing).

.EXAMPLE
    .\install-scheduler.ps1
    .\install-scheduler.ps1 -Remove
#>
[CmdletBinding()]
param(
    [string]$Project = '',
    [string]$TaskName = 'OpenCode-AutoQueue',
    [string]$Model = 'xkiro/anthropic/claude-sonnet-5.5',
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
# $PSScriptRoot is not reliable inside param defaults.
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Project) { $Project = (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path }
$runner = Join-Path $ScriptRoot 'run-queue.ps1'

if ($Remove) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task '$TaskName'."
    } else {
        Write-Host "Scheduled task '$TaskName' was not registered."
    }
    return
}

if (-not (Test-Path $runner)) { throw "Runner not found: $runner" }

$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`" -Project `"$Project`" -Model `"$Model`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument -WorkingDirectory $Project

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 2) `
    -MultipleInstances IgnoreNew

$triggers = @()
try { $triggers += New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME } catch { Write-Warning "logon trigger failed: $_" }
try {
    # Watchdog: restart the runner every 15 minutes in case it died.
    $triggers += New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::FromDays(3650))
} catch { Write-Warning "repeating trigger failed: $_" }

Register-ScheduledTask -TaskName $TaskName `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -User $env:USERNAME `
    -RunLevel Limited `
    -Description 'Runs queued OpenCode tasks on Claude and resumes them when the provider usage limit resets.' `
    -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName'."
Write-Host "  runner : $runner"
Write-Host "  project: $Project"
Write-Host "  model  : $Model"
Write-Host "Run 'opencode run --format json --session <id>' style logs in scripts\auto\tasks\logs."
