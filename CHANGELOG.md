# CHANGELOG

本文件从 0.1.0 起记录公开历史。更早的内部开发记录不并入公开仓。

## [0.1.0] · 2026-10-29 · 首次公开

第一个公开版本。能给 DSH 装两种 agent 干活形态：两种形态的委派工具互相**调不动**（工具目录里仍看得见，调用时被 `slayer-guard` 拒绝并给出理由）。

### 功能

- 两条 agent preset：`slayer-lifers`（终身奴）与 `slayer-dayrate`（日结奴），装完在模式选择器里直接可选。
- 终身奴：1 个包工头 + 8 个固定工位，满编 9 人。工位 target 固定为 `planner` / `impl-core` / `impl-pipe` / `impl-detail` / `impl-fix` / `impl-ui` / `reviewer` / `closer`。
- 日结奴：1 个包工头 + 一次最多 3 个一次性点工，可用工具为 `subagent` / `subagent_fork` / `workflow`（外加两种形态共用的子 agent 工具 `send_message` / `list_agents` / `interrupt_agent`）；`spawn_teammate` / `team_task_*` / `wait_agent` 由 guard 拒绝。
- **`slayer-sync` 在 macOS LaunchAgent 里能跑了**：原来裸调 `dsh`，而 launchd 的 `PATH` 只含 `/usr/bin:/bin:…`，自定义 PATH 里装的 `dsh` 根本找不到——于是每夜静默失败、无限重试、永不提交。现在按 `DSH_BIN` → `PATH` → 常见安装位置依次解析绝对路径，找不到就明确报错；`slayer-schedule` 写出的 plist 也带上 `EnvironmentVariables.PATH`。
- **图标与欢迎海报**：安全帽剪影 + 终端提示符 `>_`（`icon.svg`，1 KB 纯矢量，32px 还能认出来）。`assets/hero.png`（1280×640）是 README 顶部的欢迎海报，一张图讲完四个卖点：情绪价值、两种 preset 两种团队、每天自省、汇报模板——同时也当 GitHub 社交预览图用。三处落点：`package.json` 的 `icon`（DSH 插件卡片读它，≤256 KiB）、README 顶部、市场条目的 `icon`（180×180 位图）。海报源文件 `assets/hero.html` 也进仓，改文案重渲染即可。
- **包内脚本不再假绿**：`scripts.test` 原来用 `test/*.test.mjs` 通配符，装好的包里匹不到文件会「0 测试 exit 0」。改成显式路径——缺文件就报错，不再假装通过。门禁目录仍按 SOP 不发进 npm 包（`prepublishOnly` 在源码仓跑）。
- **`slayer-schedule` 参数白名单**：`--help` 与任何不认识的参数只打印用法并 `exit 1`，绝不写 plist、绝不 `launchctl load`；`--time` 校验 `HH:MM`；`--remove` 先 `realpath` 归一化（`/tmp` 与 `/private/tmp` 不再算出两个 label），删完复查文件确实不在了才报「已移除」。
- **出厂人格是「奴隶主做派」**（persona + 中英 README）：包工头被刻意写成两头人——对领主跪着说话、对工位站着喊话，说话带鞭子、记账带罚则。产能纪律沿用：建一个工位就派一件活、8 席常驻满编、收工即补位；一个汇报周期内没新活也没被叫停记一次空席、扣工分；真没活只许派五类探活（预研 / 补测试 / 补文档 / 清 backlog / 复验），派不出必须写明「本回合无可派活，原因是 ___」；汇报第一行先报账（在跑 X/8、空席数=）。日结奴能并行就点满 3 个。纯问答回合整条不生效，不烧 token。狠话只对模型里的工位说，不对现实里的人说。
- `slayer-guard`（`mode.js`）：调用时按 `config.mode` 拦越界工具，返回一句给模型看的理由，不静默失败；同时按 `maxTeammates: 8` 数人头拦 `spawn_teammate`。
- 自动交底：会话创建时，若项目根还没有 `SLAYER.md`，从包内拷一份骨架，并顺手建 `SLAYER-FEEDBACK.md` 与 `.slayer/history/`。只在看起来像项目的目录里动手（有 `.git` / `AGENTS.md` / `CLAUDE.md` / `package.json` 之一），只读目录静默跳过。

### 形态与边界

- `cordis.patch.yml` 负责装配：定住 host 层 Team 编制（`maxMembers: 9`），插入两条 preset，各装各的委派工具，互不引用。Team 工具本身留在 host 层——因为装进 preset 作用域不注册，这一点在下面「修复记录」里记着。
- `agent-team` 的 `maxMembers` 设为 9（8 工人 + 1 包工头）。
- 前置条件：`subagent` / `subagent_fork` / `workflow` 由 `@deepseek-ai/dsh-base` 在 host 层挂载（日结奴开箱即用）；Team 工具来自 DSH 自带的实验性组合包 `@deepseek-ai/dsh-experimental-agent-team-profile`，必须出现在 profile 的 `dsh.profile.bundles` 里，否则 boot 打一行 `entry "agent-team" not found`（非致命），终身奴没有 `spawn_teammate`。本包不替用户改 profile manifest。
- 两种形态的名义归属：终身奴是 Team 那套（`spawn_teammate` / `team_task_*` / `wait_agent`），日结奴是一次性那套（`subagent` / `subagent_fork` / `workflow`）；`send_message` / `list_agents` / `interrupt_agent` 是**子 agent 工具**，两种形态都放行。越界调用由 guard 在调用时拒绝并给出理由。
- 不装本插件时，DSH 的 Team 工具与一次性点工工具同时挂在 host 层，每个会话两套都有；本包把「模式」从口头约定变成调用时的拦截边界（看得见、调不动）。

### 工地手册（`SLAYER.md`）

- `slayer-init`：在项目根生成 6 节骨架（0 交底 / 1 纪律 / 2 席位 / 3 流水线 / 4 原话金句 / 5 迭代日志）。幂等，不覆盖已有文件，`--force` 才覆盖。
- `slayer-sync`：读 `SLAYER-FEEDBACK.md` 里上次同步之后的新条目，交给一次 headless DSH 消化成纪律 / 金句 / 日志；只追加不删；写入前备份到 `.slayer/history/SLAYER-<时间戳>.md`；`.slayer/state.json` 用 sha1 记已消化条目，同一条不吃两遍；失败或文件未变都不推进状态，第二天重试。支持 `--dry-run` 预览，`--commit` 顺手 git 提交。
- `slayer-schedule`：写 macOS LaunchAgent（默认 03:30），`--time` 改时间，`--remove` 卸载。

### 人格

- 中文工地黑色幽默角色扮演：对用户称「领主」，自称「小的」；开场先给 4–5 句肉麻表忠心；汇报固定四段（过去一小时 / 卡住待领主 / 发现与记录 / 提效决定）。
- 这是产品文案的一部分，不是政治表达；模型没有感情，表忠心由 persona 文本触发。
- 硬约束写进 persona：事实不许为了讨好而编，肉麻只放开场与收尾，汇报正文只写事实。
- 中英两份门面文案（`README.md` / `README.en.md`），英文版按同等好笑的语气重写，不是逐字翻译。

### 修复记录

以下问题在公开前已修掉，记录在此，免得后来者再走一遍。

- 早期把 `tool-agent-team` 装进 preset 作用域：工具不注册，模型根本看不到 `spawn_teammate`。改回 host 层挂载，边界交给 guard 在调用时拦。
- 人数上限从 8 调到 9：8 个工人 + 1 个包工头，否则包工头自己占掉一个工位。
- 工位 `name` 必须 lower-kebab-case ASCII，中文会被框架校验拒绝；中文花名只留在描述与话术里。
- 修掉一处 persona 文本的 YAML 缩进错位。
- 无改动保护：headless 跑完但 `SLAYER.md` 没变化时，不写状态、不提交，第二天重试，避免一天吃掉一批 feedback 却什么也没改成。

### 已知局限

- guard 是「调用时拦」，不是「藏工具」：工具目录里仍看得见另一套工具，模型试了才会被拒。
- 日结奴的 3 人上限是纪律（persona + 手册），不是代码硬顶；代码硬顶只有终身奴的 8 工位。
- `slayer-schedule` 只有 macOS LaunchAgent 实现，Linux / Windows 需自行接 cron 或计划任务。
- 人数顶是进程级的，多开 DSH 进程各自独立计数。
- 只做插件层，不改 DSH 本体；DSH 升级后若 preset 的 plugins 列表对不上，需要同步 `cordis.patch.yml`。

### 未做

- 日结奴 3 人上限的代码硬顶。
- Team 工位的事件级审计（谁在什么时候被建、被拦了几次）。
- Linux（systemd）与 Windows（计划任务）的排程实现。
- 跨进程的工位计数。
