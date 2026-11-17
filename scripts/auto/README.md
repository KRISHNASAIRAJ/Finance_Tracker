# Auto queue — run tasks on Claude, resume when the limit resets

Runs queued tasks with OpenCode against a Claude model and keeps them alive across provider
usage limits. When the router/provider starts rejecting requests, the task is **parked**, and the
moment the limit resets the **same session** picks up where it left off — full context preserved,
no work redone.

```
scripts/auto/
├── run-queue.ps1             the worker
├── install-scheduler.ps1     registers the Windows scheduled task
└── tasks/
    ├── pending/              drop task files here (this is the queue)
    ├── running/              claimed by the worker
    ├── done/                 finished (+ <name>.result.txt with the summary)
    ├── failed/               gave up (provider down too long, or a hard error)
    ├── logs/                 queue-YYYYMMDD.log
    └── templates/example.md  a ready made task file
```

## 1. Queue a task

Copy `tasks/templates/example.md` into `tasks/pending/` and edit it:

```md
---
title: Fix the sync queue backoff
model: xkiro/anthropic/claude-opus-5.5   # optional, overrides the runner default
agent: build                              # optional
---

Do the thing. Then the other thing. Verify before you stop.
```

`model` and `agent` are optional — the runner's defaults are used otherwise.

## 2. Run it

```powershell
# one task, then exit (good for a first check)
.\scripts\auto\run-queue.ps1 -Once

# keep the queue running
.\scripts\auto\run-queue.ps1

# a different model / poll interval
.\scripts\auto\run-queue.ps1 -Model xkiro/anthropic/claude-sonnet-5.5 -PollSeconds 60
```

Useful switches:

| Switch | Default | Meaning |
|---|---|---|
| `-Project` | repo root | directory that owns `opencode.json` |
| `-Model` | `xkiro/anthropic/claude-sonnet-5.5` | model used when a task has no `model:` |
| `-Agent` | `build` | agent used when a task has no `agent:` |
| `-PollSeconds` | `60` | seconds between retries of a parked task |
| `-MaxWaitMinutes` | `720` | give up on a task after this much provider downtime |
| `-Once` | off | process a single task and exit |

## 3. Let it run unattended

```powershell
.\scripts\auto\install-scheduler.ps1          # register
.\scripts\auto\install-scheduler.ps1 -Remove  # unregister
```

Registers a Windows scheduled task `OpenCode-AutoQueue` with two triggers:

* **At log on** — the runner starts as soon as you sign in.
* **Every 15 minutes** — a watchdog that restarts the runner if it died.

The runner holds an exclusive mutex per queue, so a second instance exits immediately instead of
processing a task twice.

## How the limit handling works

1. The worker runs `opencode run --format json --session <stable-id> --model <model> --agent <agent> --auto "<prompt>"`.
2. `--format json` emits one JSON event per line. The worker reads the `retry` / `error` events and
   classifies them:
   * **LIMIT** — HTTP 429, or a body matching `rate limit`, `usage limit`, `quota`, `credit balance`.
   * **TRANSIENT** — HTTP 5xx, `overloaded`, `server error`.
   * **ERROR** — anything else (auth, bad request). The task is moved to `failed/` immediately.
3. For LIMIT / TRANSIENT the worker waits (`-PollSeconds`, doubling for transient failures, or the
   reset time the provider itself reports) and **re-runs the same session id**. The model sees its
   previous turns, checks the current state of the repo and continues.
4. When the run succeeds, the task file moves to `done/` and a `<name>.result.txt` is written with
   the session id, the model and the agent's final summary.

Inspect a parked task at any time:

```powershell
opencode --session ses-auto-fix-the-sync-queue-backoff
```

Session ids are derived from the task file name, so a restart always re-attaches to the same
session and its context.

## Models configured in this repo

`opencode.json` (git-ignored) defines the `xkiro` provider with:

| Model | Use |
|---|---|
| `xkiro/anthropic/claude-sonnet-5.5` | default worker model |
| `xkiro/anthropic/claude-opus-5.5` | heavier reasoning tasks |
| `xkiro/anthropic/claude-haiku-5.5` | cheap / short tasks |
| `xkiro/stealth/big-pickle` | free fallback while Claude is limited |
| `xkiro/google/gemini-2.5-flash` | cheap fallback (needs wallet balance on xkiro) |

If the router returns `403 permission_error` ("This is a paid model. The Free plan only allows
free models"), the model needs a top-up or a paid plan — the runner cannot work around that.

## Notes

* The runner never re-runs a *successful* task: files move to `done/`, and only `pending/` is
  picked up.
* A task that keeps failing for `-MaxWaitMinutes` lands in `failed/` with the provider error
  appended, so nothing is lost.
* Everything is logged to `tasks/logs/queue-YYYYMMDD.log`.
* One runner per queue. Two different queues (different `-Queue` paths) can run side by side.
