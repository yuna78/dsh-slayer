# SLAYER · Cyber Foreman

`yuna78/dsh-slayer` · npm `dsh-plugin-slayer` · v0.1.0 · MIT · DSH `>=0.2.1-rc.2 <0.3.0`

**What it is:** a plugin for DSH (DeepSeek Harness) that installs two ways of getting work done. The Lifers: one foreman, eight permanent seats. Day Rate: one foreman, up to three disposable temps.

**What you get:** two new entries in the mode picker, `SLAYER · 终身奴（The Lifers）` and `SLAYER · 日结奴（Day Rate）`. Pick one and the first reply opens with four or five lines of unearned flattery before any work starts. Your project root quietly gains `SLAYER.md`, `SLAYER-FEEDBACK.md` and a `.slayer/` directory.

**What it is actually about:** not "multi-agent". It is about drawing a line between two delegation toolchains. The Lifers cannot call `subagent`, `subagent_fork` or `workflow`. Day Rate cannot call `spawn_teammate` or `team_task_*`. This is enforced at call time, not by asking the model nicely — DSH mounts both at the host layer, so both remain visible.

## The name

We wanted to call it `slaver`. The project role-plays a foreman driving a crew of agents who do not sleep, eat, or invoice, and that word is uncomfortably accurate.

It is also the sort of word that gets a repository reported before anyone reads the README. So we changed one letter: `slaver` became `slayer`. Slave trader to killer, for the price of a vowel. It is also a real English word, which is more than can be said for most plugin names.

It is not an acronym. Do not try to expand it. Any expansion makes it worse.

## Thirty seconds

```bash
# 1. Install into your web profile
dsh plugin --profile web add dsh-plugin-slayer

# 2. Restart DSH

# 3. Open a new session and pick a mode: The Lifers or Day Rate
```

Check it actually landed:

```bash
dsh --profile web --dump-config | grep -E "slayer-guard|preset-slayer"
```

You should see `preset-slayer-lifers`, `preset-slayer-dayrate`, and two `slayer-guard` entries, one per preset, with `mode` set to `lifers` and `dayrate` respectively.

### Prerequisite (affects The Lifers only)

`subagent` / `subagent_fork` / `workflow` are mounted at the host layer by `@deepseek-ai/dsh-base`, so **Day Rate works out of the box**.

`spawn_teammate` / `team_task_*` come from DSH's own experimental bundle `@deepseek-ai/dsh-experimental-agent-team-profile`, which has to be listed in your profile's `package.json` → `dsh.profile.bundles`. Add one line:

```jsonc
// ~/.dsh/profiles/web/package.json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "@deepseek-ai/dsh-experimental-agent-team-profile",   // ← The Lifers needs this
      "dsh-plugin-slayer"
    ]
  }
}
```

Without it, boot prints one line: `[dsh-plugin-slayer] patch: entry "agent-team" not found`. That is **expected and non-fatal**: the presets still appear, The Lifers simply has no `spawn_teammate`, and Day Rate is unaffected. This package will not edit your profile's bundles for you — it has to keep working for your other sessions.

## Who this is for, and who it is not for

**For:** people with a task that genuinely splits into parallel pieces; people willing to spend ten minutes writing a brief; people who can tolerate an agent with an accent.

**Not for:** people who want one button labelled "do everything"; people who will not write `SLAYER.md`; people who find "the humble one withdraws" physically painful. If you install it and hate it, one command removes it. It does not hold your project hostage.

## Two shapes, one table

| | The Lifers | Day Rate |
|---|---|---|
| preset id | `slayer-lifers` | `slayer-dayrate` |
| Headcount | 1 foreman + 8 fixed seats, 9 in total; all eight stay staffed — a small job gets split, not parked | 1 foreman + at most 3 temps at a time; run all three in parallel when you can |
| Delegation tools | Team side: `spawn_teammate` / `team_task_*` / `wait_agent` | One-off side: `subagent` / `subagent_fork` / `workflow`; `spawn_teammate`, `team_task_*` and `wait_agent` are refused by the guard |
| Do workers have identities | Yes. Eight fixed targets that stay alive for the session and can message each other | No. They finish and evaporate. No roster, no task board |
| Hard cap on people | In code: `maxTeammates: 8`. The ninth worker is refused | In the rules: the manual and the persona say 3 |
| Nicknames | planner, impl-core, impl-pipe, impl-detail, impl-fix, impl-ui, reviewer, closer | day labourer, contractor, strike team, inspection crew |
| When to use it | One job that can be split finely and run in parallel with seats seeing each other's work: refactors, migrations, multi-module audits; if the job is small, split it rather than leave seats idle | One-off evidence gathering, independent review, comparing several approaches. You do not want to maintain a crew for a single errand |

**Capacity rule:** spawn and task in one motion, keep all eight seats staffed, and fill the crew before doing anything else. Hand over, refill the seat: re-task a seat the moment it reports back; an idle seat in a reporting cycle is counted. Every report opens with `running x/8, idle_seats=y, why`.

The eight seat targets are fixed ASCII names: `planner`, `impl-core`, `impl-pipe`, `impl-detail`, `impl-fix`, `impl-ui`, `reviewer`, `closer`. The Chinese nicknames live in prose only, because the framework rejects non-ASCII seat names outright. See "Scars" below.

## Why the two toolchains have to be separated

DSH mounts the Team tools at the host layer. Without this plugin, every session holds both `subagent` and `spawn_teammate` at the same time. "Mode" is therefore a verbal agreement. The model has both sets of keys and may use either.

This is not tidiness for its own sake. The two toolchains keep different books. Team has permanent seats, a task board, and badges. A subagent is disposable, and when it evaporates nothing remains. Mix them and you get a subagent doing a permanent seat's job, or a task board created for a single lookup. Context, files, and handovers all end up in the wrong ledger.

So there are three layers:

| Layer | What happens | Where |
|---|---|---|
| Assembly | Raises the host-layer Team headcount cap (`maxMembers: 9`; needs the experimental Team bundle from Prerequisite) and decides which delegation tools go into which preset | `cordis.patch.yml` |
| Preset | Day Rate's preset mounts only `subagent` / `subagent_fork` / `workflow`; The Lifers' preset mounts none of them. The Team tools stay on the host layer | `cordis.patch.yml` |
| Call time | `mode.js` guards every tool call against `config.mode`, and enforces the headcount cap | `mode.js` |

The clean solution would be to switch off the host-layer `tool-agent-team` entirely and let each preset mount its own. We tried it. Tools mounted inside a preset scope do not register (see Scar One below). So the real boundary lives at call time: assembly fixes the headcount and the catalogue, the guard does the refusing. If you want the host to carry no Team tools at all, switch that off at the profile layer. This plugin will not do it for you, because The Lifers still needs it.

The important detail is that the guard refuses with a reason rather than failing silently. The strings the model actually receives are Chinese, because the whole persona speaks Chinese; translated:

```
The Lifers do not hire one-off labour. Use spawn_teammate, and write down the job, the write scope, and the acceptance command.
Day Rate does not keep a roster. Use subagent, and let it go when it is done.
Foreman: all 8 seats are taken. Wait for one to finish instead of squeezing another in.
```

A silent failure makes a model retry the same forbidden tool, which burns tokens for nothing. One sentence of explanation and it takes a different route next turn.

## Scars: three things that did not work

**One: Team tools do not register inside a preset scope.** The first design was satisfyingly clean. Give The Lifers a preset containing `tool-agent-team`, give Day Rate a preset containing `tool-subagent`, and let physics do the isolation. In practice the model could not see `spawn_teammate` at all, because the tool does not register inside preset scope. So the tools went back to the host layer and the boundary moved to the guard. A full circle, and the boundary ended up at call time anyway.

**Two: seat names must be lower-kebab-case ASCII.** The first attempt used the Chinese nickname directly as `name`. The framework rejected it during validation. Nicknames now live in descriptions and dialogue; the `name` field is always something like `impl-core`.

**Three: `maxMembers` is a process-level singleton.** There is one TeamService per process. `maxMembers` can only be set at deployment time, and a preset cannot express "eight seats here, zero seats there". So the eight-worker cap is enforced by counting members when `spawn_teammate` is called. Run two DSH processes and they count independently.

## The site handbook: `SLAYER.md`, six sections

On the first session in a project, the plugin drops a skeleton into the project root. It only does this if the directory looks like a project: `.git`, `AGENTS.md`, `CLAUDE.md` or `package.json`. On a read-only directory it gives up silently. You can also run it yourself:

```bash
node bin/slayer-init.mjs --project .        # idempotent; refuses to overwrite unless --force
```

> How you installed decides how you call it: with `dsh plugin add`, the three commands land in the plugin's `node_modules/.bin/` (**not on PATH**) — use `npx --package dsh-plugin-slayer slayer-init --project .`. From a source checkout, use `node bin/...` as shown.

| Section | Contents | Maintained by |
|---|---|---|
| 0 Brief | What the project is, the current goal, acceptance commands, no-go areas, where work is filed, what needs a human decision | Filled once, rarely touched |
| 1 Discipline | Rules, work points, red lines, the definition of a fake green, the capacity rule (refill on handover / what counts as idling) | Digested from feedback daily |
| 2 Seats | Roster, the four-part work order, write scopes | Same |
| 3 Pipeline | Stages, the minimum evidence per stage, merge order, how to report a blocker | Same |
| 4 Quotes | The owner's exact words, with date and trigger | Appended only, never rewritten |
| 5 Log | Date, source, which section changed | Automatic |

Why this file exists: an agent boots up amnesiac every time. Writing down "this project's taste and no-go areas" in a file that is loaded every session is much cheaper than repeating it in conversation. It covers the layer `AGENTS.md` does not: project-specific background, not general engineering hygiene.

## The daily loop: exact words become rules

While working, append the owner's exact words to `SLAYER-FEEDBACK.md`: date, trigger, verbatim quote, and a category. Then:

```bash
node bin/slayer-sync.mjs --project . --dry-run    # see what would be digested today
node bin/slayer-sync.mjs --project . --commit     # do it: headless pass, then git commit
node bin/slayer-schedule.mjs --project . --time 03:30   # macOS LaunchAgent, daily at 03:30
node bin/slayer-schedule.mjs --project . --remove       # remove the schedule
```

Three rules: two are enforced in code, one lives in the editing prompt.

- **Back up first.** Before writing, `SLAYER.md` is copied to `.slayer/history/SLAYER-<timestamp>.md`. (code)
- **Never eat the same item twice.** `.slayer/state.json` stores a sha1 digest of every digested block. If the run fails, the state is not advanced, and the next day retries the same items. (code)
- **Append only.** Not one human-written line is removed; new material goes at the end of the relevant section. (prompt-enforced, not validated)

`slayer-sync` does exactly one thing: turn exact words into enforceable rules. It calls a headless DSH session to do the conversion, then leaves a single line in section 5. It does not touch code and does not run tests.

## On the persona

The plugin ships with a role-play layer: Chinese construction-site black humour, a foreman who addresses you as the landowner, workers who refer to themselves as the humble one, and a fixed four-part report format.

**It is a product feature, not a political statement.** The register is borrowed from construction-site slang because it makes delegation, acceptance, and sign-off concrete. It refers to nothing in the real world and should not be read as a position on labour relations.

**The shipped persona is deliberately a slave driver.** The foreman is two-faced on purpose: obsequious to you (flattery, a capacity ledger before anything else) and ruthless to the seats (cracking the whip, docking work points, unable to stand an idle seat). The crew being squeezed is made of model agents, never real people — aiming this at real colleagues is misuse against the plugin's intent, and the role-play still may not invent facts to please the user.

**The model has no feelings.** The flattery is output triggered by persona text. It does not admire you. It is spending your tokens. The one rule that cannot be broken for the sake of flattery: **never invent facts to please the user.** The syrup goes in the opening and the closing. The report body contains facts only.

## Known limits

- **The guard intercepts calls; it does not hide tools.** Whether a tool shows up in the catalogue is decided by DSH and the profile bundles (with the Agent Teams bundle enabled, upstream already marks `tool-subagent*` as `disabled`). What this plugin guarantees is that the other shape's tools **cannot be called**: either they are absent, or the call is refused with a reason. Proper hiding would require changing DSH itself, which this plugin does not do.
- **The Lifers needs the experimental Team bundle on the profile** (`@deepseek-ai/dsh-experimental-agent-team-profile`). Without it there is no `spawn_teammate`. This package will not edit `dsh.profile.bundles` for you, and will not install it automatically.
- **The three-person Day Rate cap is a rule, not a code limit.** Only the eight-seat cap is enforced in code. The three is written in the persona and the manual, and relies on the model complying.
- **`slayer-schedule` is macOS LaunchAgent only.** On Linux, wire `slayer-sync --commit` into cron yourself. On Windows there is no scheduler script — drive `slayer-sync` from Task Scheduler by hand.
- **The headcount cap is per process.** Two DSH processes count independently.
- **Plugin layer only.** When a DSH upgrade changes the preset plugin list, `cordis.patch.yml` has to be updated to match.

## Compatibility, uninstall, layout

- DSH: `>=0.2.1-rc.2 <0.3.0`. Node: `^22.19 || >=24`.
- Uninstall: `dsh plugin --profile web remove dsh-plugin-slayer`, then restart DSH. Existing sessions are unaffected, because the preset locks after the first turn.
- More reading: [install](docs/install.en.md) · [manual](docs/manual.en.md) · [compatibility](docs/compat.md) · [Chinese version](README.md).

| File | Purpose |
|---|---|
| `cordis.patch.yml` | Two presets, guard mounts, and the Team headcount cap (`maxMembers: 9`) |
| `mode.js` | The guard: blocks out-of-mode tools at call time, counts heads |
| `bin/slayer-init.mjs` | Drops `SLAYER.md` and `SLAYER-FEEDBACK.md` skeletons, idempotently |
| `bin/slayer-sync.mjs` | Digests new feedback into the handbook: backup, digest dedupe, append only |
| `bin/slayer-schedule.mjs` | Writes a macOS LaunchAgent that runs sync on a schedule |
| `template/` | The two skeleton templates |
| `manuals/` | One discipline manual per shape. Written for humans, and copyable into a project |
| `SEATS.md` | Roster and the work-point rules |
| `SLAYER.template.md` | Short brief template, for people not using the plugin |

MIT License · Copyright (c) 2026 Yuna
