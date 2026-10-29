# Manual · SLAYER

> Read this and you know how each mode hands out work, what the six sections of `SLAYER.md` are for, what the three commands actually produce, and what a guard rejection looks like.
> Everything here is operational: when to use it, how to ask, where the output lands.

## 0. The model in one minute

- Two presets, two delegation tool sets: **The Lifers** builds permanent seats with `spawn_teammate`; **Day Rate** hires throwaway temps with `subagent`.
- The boundary is not "the model being nice". `mode.js` guards every call against the active mode and rejects out-of-mode tools with a one-line reason written for the model.
- The persona (lord / foreman / crew, the four-part report) is part of the product, not decoration.
- `SLAYER.md` is the project brief the agents read; `SLAYER-FEEDBACK.md` is the verbatim-quotes layer; three commands feed one into the other daily.

| | The Lifers | Day Rate |
|---|---|---|
| preset id | `slayer-lifers` | `slayer-dayrate` |
| People | 1 foreman + up to 8 fixed seats (9 full strength) | 1 foreman + up to 3 temps at a time |
| Delegation tools | 9 team tools (`spawn_teammate`, `team_task_*`, `send_message`, `wait_agent`, `list_agents`, `interrupt_agent`) | `subagent`, `subagent_fork`, `workflow` |
| Good for | multi-day, cross-module, needs stable identity | one-off evidence gathering, audits, parallel comparisons |
| Memory | roster and task board | nothing survives except the handoff file |

## 1. The Lifers: eight fixed seats

### 1.1 The fixed order of a session

1. **First output is plain-text pleasantries.** Four or five sentences of loyalty before any tool call. The persona enforces it.
2. **Read before asking.** The foreman reads `AGENTS.md` / `README` / `docs`, fills the gaps in section 0 of `SLAYER.md`, and only then asks you — once, in one batch.
3. **Spawn all eight seats, one job each**: on the first real task, spawn each seat with its first job already in the prompt (acceptance command included). After eight spawns, all eight should be running.
4. **Four things per assignment**: duty, write scope, acceptance command, return format. Missing one means it is not an assignment.
5. **Three things at check-out**: what changed, the evidence (command + output), who is next.

### 1.2 The eight seats

| Name | target (the `name` you pass) | Does | Typical write scope |
|---|---|---|---|
| 画饼师 planner | `planner` | breaks down requirements, draws the plan | plan docs, issue bodies |
| 砌墙的 bricklayer | `impl-core` | data flow, interfaces, state machines | core module directory |
| 通管子的 pipeman | `impl-pipe` | events, pipelines, cross-layer wiring | integration layer, scripts |
| 拧螺丝的 screwdriver | `impl-detail` | copy, edge cases, markers, docs | docs, config, UI details |
| 补锅的 patcher | `impl-fix` | fixes leaks, repairs red tests | tests, temporary patches |
| 刷漆的 painter | `impl-ui` | panels, reports, anything a human looks at | UI, report templates |
| 挑刺的 nitpicker | `reviewer` | independent review, blocks false greens | read-only |
| 清场的 sweeper | `closer` | archives, wraps up, writes the handoff | handoff files, archive dirs |

- `name` must be lower-kebab-case ASCII; the framework rejects non-ASCII names. The Chinese nicknames live in descriptions and conversation only.
- All eight seats stay staffed; seats are not picked per job. A small job gets split (verification, docs, gap-finding) rather than left idle. Hand over, refill the seat: re-task a seat the moment it reports back, and an idle seat in a reporting cycle counts against the crew — the first line of every report is `running x/8, idle_seats=y, why`.
- Alive is not the same as producing: if a seat is idle, task it; if there is genuinely nothing, the report must say 「本回合无可派活，原因是 ___」.

### 1.3 Assignment template

```
Seat: impl-core (砌墙的)
Job: <backlog id / change name>, this one only.
Write scope: <directories or files>. Do not touch anyone else's.
Deliverable: <file / conclusion>.
Return format: <how many lines, table or not, paste which command output>.
Acceptance command: <the one the foreman will run>.
Discipline: close out before opening; no scope creep; if stuck, ask the foreman.
```

### 1.4 The headcount ceiling

- 8 seats + 1 foreman = 9, set by `agent-team.maxMembers: 9` in `cordis.patch.yml`; the guard's `maxTeammates: 8` only decides whether one more `spawn_teammate` may pass.
- The ninth `spawn_teammate` is rejected with: `包工头：本队 8 个工位已满，等一个收工的再来，别硬塞`. The other half of that sentence is the capacity rule: wait for a seat to finish, then refill it immediately — not wait for work to arrive.
- The ceiling is **per process** (TeamService is a singleton): a second DSH process starts counting from zero.

### 1.5 Work credits (flavour, not a gate)

Acceptable delivery +10; closing someone's work-in-progress +5; opening new work +3; catching a real problem +8; a false green −20; sitting on review and finding nothing −5. Resets weekly; never redeemed, never ranked.

## 2. Day Rate: the four-piece assignment

1. **Deliverable** — which file or which conclusion.
2. **Return format** — lines, tables, whether to paste evidence.
3. **Acceptance command** — how the foreman decides it is done.
4. **No scope creep** — do this one thing; log other findings without touching them.

Three hard rules:

- **At most 3 temps at once.** Enforced by the persona and this manual, not by the guard (see [compat.md](compat.md), §5).
- **Temps get no permanent identity, no task board, and never write the main workspace.** Dirty work goes in `/tmp` or a worktree.
- **Conclusions must land in a file** — report, defect entry, or handoff. When the temp is gone its context is gone; unrecorded work did not happen.

| Nickname | Tool | When |
|---|---|---|
| day labourer | `subagent` | clean-context fact-finding, single piece of evidence |
| contractor | `subagent_fork` | needs the earlier half of the conversation |
| task force | `workflow` | fan out over many files or many options at once |
| inspector | read-only `subagent` | review, acceptance, nitpicking |

## 3. The four-part report (both modes)

```
禀报领主——
【过去一小时】what got done (one line each, with file/command evidence)
【卡住待领主】where it is stuck, what needs your call (write 「无」 if nothing)
【发现与记录】problems found, where they were recorded (file path)
【提效决定】decisions made to speed things up (write 「暂无」 if none)
小的告退，这就去办。请领主示下。
```

- Open with four or five sentences of exaggerated loyalty; vary them each time. Facts must not be invented to please: flattery goes in the opening and closing, the body is only facts.
- When stuck, self-deprecate once, then state the fact. No arguing, no haggling.

## 4. `SLAYER.md`: six sections, who maintains what

The plugin drops the skeleton into the project root at session creation (`autoBrief`), but only in a directory that looks like a project (`.git`, `AGENTS.md`, `CLAUDE.md` or `package.json`) and never in a read-only one; you can also run `slayer-init`.

| Section | Contents | Maintained by |
|---|---|---|
| 0 Brief | what the project is, the current goal, acceptance command, no-go zones, where deliverables land, what only a human may decide | you at first; the foreman drafts the gaps and asks once |
| 1 Slave handbook | discipline, work credits, red lines, the definition of a false green | you write rules; `slayer-sync` appends daily |
| 2 Seat handbook | roster, assignment four-piece, write scopes, ASCII targets | same |
| 3 Pipeline handbook | stages, minimum evidence per stage, merge order, how to report a block | same |
| 4 Owner quotes | verbatim quotes with date and trigger | append-only, never rewritten; `slayer-sync` moves them over |
| 5 Change log | date · source · which section changed | `slayer-sync` appends one line |

`SLAYER-FEEDBACK.md` is the raw-quote layer, one block per item:

```
### 2026-10-29 02:40
触发：what was happening and why it was said
原话：
> verbatim quote

归类：奴隶手册 | 席位手册 | 流水线手册 | 金句 | 交底
```

Two rules: **owner quotes only** (no summaries, no rewriting), **append only** (`slayer-sync` never deletes existing lines).

## 5. The three commands

All three ship with the package (`slayer-init`, `slayer-sync`, `slayer-schedule`) and can be run from a checkout as `node bin/<command>.mjs`. All accept `--project <root>`; the default is the current directory.

| Command | Does | Produces |
|---|---|---|
| `slayer-init` | drops the skeleton, idempotent | `SLAYER.md`, `SLAYER-FEEDBACK.md`, `.slayer/history/` |
| `slayer-sync` | digests new quotes into the handbook | edits `SLAYER.md`; backup in `.slayer/history/`; ledger `.slayer/state.json` |
| `slayer-schedule` | writes a macOS LaunchAgent | `~/Library/LaunchAgents/com.slayer.sync.<slug>.plist` |

### 5.1 `slayer-init`

```bash
node bin/slayer-init.mjs --project .
```

- `--project <dir>` — project root, default cwd (resolved to an absolute path).
- `--force` — overwrite existing files.
- Output:

```
工地：/path/to/project
  create SLAYER.md
  create SLAYER-FEEDBACK.md
下一步：填 SLAYER.md 第 0 节（交底），然后在干活时把负责人原话追加到 SLAYER-FEEDBACK.md
```

Run it again and it prints `skip SLAYER.md（已存在）` — idempotent, your hand-written brief is safe.

### 5.2 `slayer-sync`

```bash
node bin/slayer-sync.mjs --project . --dry-run    # what would be digested today
node bin/slayer-sync.mjs --project .              # do it
node bin/slayer-sync.mjs --project . --commit     # do it and git commit the result
```

What happens, in order:

1. Read `SLAYER-FEEDBACK.md`, strip fenced code, split on lines starting with `### `, drop blocks of 20 characters or less.
2. Hash each block (sha1, first 12 hex chars) and compare with `processed` in `.slayer/state.json`; only unrecorded blocks are "new".
3. No new blocks → `no-op：没有新的 feedback`, exit 0.
4. `--dry-run` → prints `dry-run：N 条新 feedback` plus the first three lines of each block, and writes **nothing**.
5. Back up `SLAYER.md` to `.slayer/history/SLAYER-<timestamp>.md`.
6. Run `dsh headless "<editing prompt>"` in the project root (10-minute timeout) — append only, never delete a human line.
7. On success, append the digested hashes to `.slayer/state.json` and print `已消化 N 条 feedback；备份在 .slayer/history/`.

**A failure never advances the state.** Both of these exit 1 and are retried the next day:

- headless exits non-zero: `sync 失败（exit N），状态未更新，明天会重试`
- `SLAYER.md` is byte-identical: `SLAYER.md 没有被改动，状态未更新，明天会重试`

`--commit` stages `SLAYER.md`, `SLAYER-FEEDBACK.md` and `.slayer/state.json` and commits them; outside a git repo it prints `git 提交跳过（不是仓库或没有改动）`, which is not a failure.

Precondition: both `SLAYER.md` and `SLAYER-FEEDBACK.md` must exist, otherwise `缺 SLAYER.md 或 SLAYER-FEEDBACK.md，先跑 bin/slayer-init.mjs` and exit 1.

### 5.3 `slayer-schedule` (macOS only)

```bash
node bin/slayer-schedule.mjs --project . --time 03:30   # daily, 03:30 is the default
node bin/slayer-schedule.mjs --project . --remove       # unschedule
```

- Writes `~/Library/LaunchAgents/com.slayer.sync.<slug>.plist`, where `slug` is the project's absolute path with non-alphanumerics collapsed to `-`, last 40 characters.
- The job runs `node bin/slayer-sync.mjs --project <root> --commit`; logs go to `.slayer/sync.log` and `.slayer/sync.err.log`; `RunAtLoad` is false, so it does not fire on login.
- Prints `已排程：每天 03:30 同步 <root>` + `plist: <path>`, or `已移除 <label>`.
- Linux/Windows: run the same `slayer-sync` command from cron / Task Scheduler (see [compat.md](compat.md), §4).
- Paths with spaces are fine: the plist holds the literal absolute path (`fileURLToPath`, no `%20`).

## 6. What the guard blocks

The guard is a pre-call hook in `mode.js`. Tools stay visible in the catalog; the **call** is rejected with a human-readable reason for the model — not a crash.

| Mode | Blocked tool | Reason the model gets |
|---|---|---|
| Lifers | `subagent` | 终身奴不派一次性点工；要人就用 spawn_teammate 建工位，写清职责与写作用域 |
| Lifers | `subagent_fork` | same |
| Lifers | `workflow` | 终身奴不铺一次性工作流（那也是点工）；要并行就用 spawn_teammate 建工位，写清职责与写作用域 |
| Day Rate | `spawn_teammate` | 日结奴不建名册；直接用 subagent 点工，干完就散 |
| Day Rate | `team_task_create` / `team_task_list` / `team_task_get` / `team_task_update` | 日结奴不建任务板；任务写在交接文件里，别占 Team 的账 |
| Day Rate | `wait_agent` | 日结奴没有长期工位；子 agent 收工会自动回一条结算消息，不用守 |
| Lifers | the 9th `spawn_teammate` | 包工头：本队 8 个工位已满，等一个收工的再来，别硬塞 |

How to read this:

- A rejection is not a fault: the model gets the reason and reroutes. Seeing that sentence in a session proves the isolation works.
- Blocked tools stay in the catalog on purpose — a stable catalog keeps the model oriented. "The model says it can see `spawn_teammate`" is not a misconfiguration.
- `send_message`, `list_agents` and `interrupt_agent` belong to the **subagent toolchain** (`@deepseek-ai/dsh-tool-subagent-control`) and are allowed in both shapes. In this DSH version `subagent` is asynchronous: it returns an id immediately and the runtime delivers a settlement message when the child finishes. Asking a follow-up, requesting a progress note, or stopping a runaway child all go through these three.
- To see who you hired, use `list_agents` — it lists the subagents you started, not a Team roster.

## 7. Tuning

Three knobs, all on the guard row in `cordis.patch.yml`, one copy per preset:

```yaml
- id: slayer-guard
  name: 'dsh-plugin-slayer'
  config:
    mode: lifers        # lifers | dayrate
    maxTeammates: 8     # max seats per crew; <= 0 or non-numeric disables the ceiling
    autoBrief: true     # drop the SLAYER.md skeleton at session creation; false to stop
```

- `mode` picks which tool set is blocked and matches the preset 1:1. An unknown value blocks nothing.
- `maxTeammates` only gates `spawn_teammate`; the real member ceiling is `agent-team.maxMembers: 9` near the top of the patch.
- `autoBrief: false` is for "do not write files into my project root"; run `slayer-init` yourself later.
- These rows sit inside a preset's plugin list, so a profile patch cannot override them in place. Edit the package's `cordis.patch.yml`, install with `link:`, and restart.

## 8. Known limits

The guard blocks calls rather than hiding tools; the headcount ceiling is per process; Day Rate's "3 at a time" is policy, not code; `slayer-schedule` is macOS-only; `slayer-sync` needs a working `dsh` CLI and model credentials. The full list with verification steps is in [compat.md](compat.md).
