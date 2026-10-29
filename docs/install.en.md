# Install · SLAYER (`dsh-plugin-slayer`)

> Read this and you can put SLAYER into any DSH profile; after a restart, new sessions offer two modes: **SLAYER · The Lifers** and **SLAYER · Day Rate**.
> Three install paths, one prerequisite, a table of failure recipes, one rollback command.

## 0. Three checks first

```bash
dsh --version    # the plugin supports >=0.2.1-rc.2 <0.3.0
node -v          # ^22.19.0 || >=24.0.0
pnpm -v          # anything; dsh plugin forwards to pnpm
```

| Item | Requirement | If missing |
|---|---|---|
| DSH | `>=0.2.1-rc.2 <0.3.0` (prereleases included) | install is rejected up front (`incompatible-version`) |
| Node | `^22.19.0 || >=24.0.0` | on 23.x `dsh` prints nothing and exits 0 (see §5) |
| pnpm | on `PATH` | `dsh plugin` fails immediately |

**The Lifers mode has one extra prerequisite.** Its nine team tools (`spawn_teammate`, `team_task_create|list|get|update`, `send_message`, `wait_agent`, `list_agents`, `interrupt_agent`) come from DSH's experimental **Agent Teams** bundle `@deepseek-ai/dsh-experimental-agent-team-profile`.
Without it the mode still exists but `spawn_teammate` does not, and `--dump-config` prints `patch: entry "agent-team" not found`.
Enable it in **Plugins → Experimental → Agent Teams**. Day Rate does not need it.

What you get:

- two presets (new sessions only; running sessions keep what they started with)
- on session creation, `SLAYER.md`, `SLAYER-FEEDBACK.md` and `.slayer/history/` appear in the project root — only in directories that look like a project (`.git`, `AGENTS.md`, `CLAUDE.md` or `package.json` present), silently skipped when read-only
- three commands: `slayer-init`, `slayer-sync`, `slayer-schedule`

## 1. Three ways to install

### 1.1 npm registry (recommended)

```bash
dsh plugin --profile web add dsh-plugin-slayer
```

Pin a version, or use a mirror:

```bash
dsh plugin --profile web add dsh-plugin-slayer@0.1.0
dsh plugin --profile web add dsh-plugin-slayer --registry https://registry.npmmirror.com
```

### 1.2 From GitHub source

```bash
dsh plugin --profile web add github:yuna78/dsh-slayer
dsh plugin --profile web add github:yuna78/dsh-slayer#v0.1.0
dsh plugin --profile web add git+https://github.com/yuna78/dsh-slayer.git
```

One difference from npm: a git spec has to be fetched before its manifest can be read, so the compatibility check happens *after* the fetch. If it fails, the profile manifest and lockfile are restored — no half-installed package.

### 1.3 Local `link:` (development)

```bash
git clone https://github.com/yuna78/dsh-slayer.git ~/code/dsh-slayer
dsh plugin --profile web add "link:$HOME/code/dsh-slayer"
```

- Absolute paths only. `link:` writes a symlink: edit the code, restart DSH, done — no reinstall.
- Use a plain absolute path instead if you want the profile to hold a copy: `dsh plugin --profile web add "$HOME/code/dsh-slayer"`.
- Use this path if you intend to tune `cordis.patch.yml`; a registry copy is not editable in place.

## 2. What `--profile` means

A profile is an ordered stack of patch layers stored in `$DSH_HOME/profiles/<name>/` (`~/.dsh/profiles/<name>/` by default).

| Profile | What it is | When to use |
|---|---|---|
| `web` | the Web / Desktop app | everyday use |
| `headless` | one-shot `dsh headless "task"` | automation |
| your own (e.g. `slayer-test`) | initialised on first use | **testing installs**, not `web` |

- `--profile` is mandatory; `dsh plugin` without it errors out.
- The first `dsh plugin --profile <name> add ...` creates the profile. `--dump-config` on a non-existent profile fails with `profile "xxx" does not exist`.
- Plugins do not leak between profiles: installing into `web` does nothing for `headless`.

## 3. After installing, three steps

1. **Fully restart DSH.** Quit the Desktop app completely, or restart the process that serves the Web UI. A successful install is not an active one.
2. **Open a new session** and pick `SLAYER · 终身奴（The Lifers）` or `SLAYER · 日结奴（Day Rate）` in the mode selector. Settings lets you make one the default for new tasks.
3. **Check the composed config** (next section). Sessions already open are unaffected — that is DSH behaviour, not a failed install.

## 4. Verify

```bash
dsh --profile web --dump-config | grep -E "preset-slayer|slayer-guard|mode: "
```

Expect:

```
- id: preset-slayer-lifers
      - id: slayer-guard
          mode: lifers
          maxTeammates: 8
- id: preset-slayer-dayrate
      - id: slayer-guard
          mode: dayrate
```

Both presets present means the config layer is fine. A line like `dsh: [dsh-plugin-slayer] patch: entry "agent-team" not found` means the plugin is installed but Agent Teams is not enabled (§0). `dsh plugin --profile web version-exemptions` prints the exemption list (`{}` if empty).

The real test is a session: open two, pick a mode in each, and ask it to list its available tool names.

- **The guard blocks at call time; it does not hide tools.** Whether a tool appears in the catalogue is decided by DSH and the profile bundles, not by this package (with the Agent Teams bundle enabled, upstream already marks `tool-subagent*` as `disabled`). What this package guarantees is that the other shape's tools cannot be called. **Seeing a tool is expected; being able to call it is the bug.**
- Lifers: asking for `subagent` / `subagent_fork` may simply find nothing to call — that counts as passing, because it was never callable.
- The Lifers: ask it to `spawn_teammate` a seat — that should work. Ask it for `subagent` / `subagent_fork` / `workflow` — that should be refused with a one-line reason.
- Day Rate: ask it for `subagent` on a small read-only job — that should work and the settlement message should come back. Ask it for `spawn_teammate` / `team_task_create` / `wait_agent` — that should be refused.
- The full reason table is in [manual.en.md](manual.en.md#6-what-the-guard-blocks).

## 5. When it does not work

| Symptom | Cause | Fix |
|---|---|---|
| Not found in the Add plugin dialog | searched `SLAYER` or `dsh-slayer`, not the npm name | search **`dsh-plugin-slayer`** |
| Same | no index source, or the entry has not passed the nightly probe yet, or a stale cached index | see the four steps below |
| Presets do not appear | no restart, old session, or the bundle is not in the profile | restart, open a new session, check `dsh plugin --profile web list \| grep slayer` |
| No `spawn_teammate` in The Lifers | Agent Teams bundle not enabled | enable `@deepseek-ai/dsh-experimental-agent-team-profile`, restart |
| `installation rejected: ... incompatible with dsh 0.2.1-rc.2` | `engines.dsh` / peer range does not cover your DSH | install a compatible version, or use the exact-version exemption (risky — see [compat.md](compat.md), §2) |
| `dsh` prints nothing, exits 0 | wrong Node (23.x lacks `import.meta.main`, so DSH's entry never runs) | use Node 24.x (or 22.19+) |
| `dsh plugin` cannot find pnpm | pnpm missing or not on `PATH` | install pnpm, or fix the environment `dsh plugin` runs in |
| Installed, still nothing | no restart, or installed into another profile | restart; `dsh --profile web --dump-config \| grep slayer` |
| pnpm blocks dependency build scripts | this package has none; the block comes from another package | approve them in the plugin page, or reinstall in a clean profile |

**Not found in the Add plugin dialog — four steps, in order:**

1. Get the name right: the npm package is `dsh-plugin-slayer`. Better, skip search entirely — the dialog accepts a package name, a Git URL, or a local absolute path.
2. The index has not caught up: awesome-dsh-plugin entries only enter the index after the **nightly** probe (about 1.5–2 hours). Not being searchable on merge day is normal.
3. No index source configured: enable the experimental **custom plugin market** bundle and add `https://awesome-dsh-plugin.com/index.json`.
4. Caching or mirror: reopen the dialog, restart DSH, or switch to the official registry.

Two direct-install commands, equivalent to the dialog:

```bash
dsh plugin --profile web add dsh-plugin-slayer
dsh plugin --profile web add "link:$HOME/code/dsh-slayer"
```

On failure `dsh plugin` prints `dsh: nothing was installed.` and a diagnostics log path (`.plugin-manager/logs/...`). Read that log first.

## 6. Rollback

```bash
dsh plugin --profile web remove dsh-plugin-slayer
```

Then:

1. **Fully restart DSH.**
2. Confirm the config is clean: `dsh --profile web --dump-config | grep -c preset-slayer` → `0`.
3. Files in your projects are untouched and stay behind, clean up as you like:
   - `SLAYER.md`, `SLAYER-FEEDBACK.md` (plain markdown)
   - `.slayer/` (`history/`, `state.json`, `sync.log`)
   - if you scheduled the daily sync, unschedule it first: `node bin/slayer-schedule.mjs --project . --remove`
4. If you granted a version exemption: `dsh plugin --profile web revoke-version dsh-plugin-slayer@0.1.0 --dsh-version 0.2.1-rc.2`.

Rollback is safe: the plugin only writes skeleton files into the project root at session creation, never takes over existing files, never touches your code.

## 7. Test in a throwaway profile

```bash
dsh plugin --profile slayer-test add "link:$HOME/code/dsh-slayer"
dsh --profile slayer-test --dump-config | grep -E "preset-slayer|slayer-guard"
dsh plugin --profile slayer-test remove dsh-plugin-slayer
```

A self-made profile is fully isolated from `web`; deleting `$DSH_HOME/profiles/slayer-test/` afterwards touches nothing you use daily.
