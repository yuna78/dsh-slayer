# 使用手册 · SLAYER

> 读完这篇你能：知道两个模式各自怎么派活、`SLAYER.md` 六节写什么、三个命令各自产出什么、被 guard 拦住长什么样。
> 写法偏操作：每一节都是「什么时候用 + 怎么开口 + 产物在哪」。

## 0. 一分钟心智模型

- 两条 preset，两套委派工具：**终身奴**用 `spawn_teammate` 建固定工位，**日结奴**用 `subagent` 点一次性工。
- 边界不是靠“模型自觉”，是 `mode.js` 的 guard 在**调用时**按模式拦，并给模型一句人话理由。
- 人格（领主/小的/头儿、禀报领主、四段式汇报）写进了 persona，是产品的一部分，不是彩蛋。
- 工地手册 `SLAYER.md` 是给 agent 看的项目背景；`SLAYER-FEEDBACK.md` 是负责人的原话事实层；三个命令负责把原话每天消化进手册。

两种形态一句话对照：

| | 终身奴（The Lifers） | 日结奴（Day Rate） |
|---|---|---|
| preset id | `slayer-lifers` | `slayer-dayrate` |
| 人 | 1 包工头 + 最多 8 个固定工位（满编 9） | 1 包工头 + 一次最多 3 个点工 |
| 委派工具 | 9 个团队工具（`spawn_teammate` / `team_task_*` / `send_message` / `wait_agent` / `list_agents` / `interrupt_agent`） | `subagent` / `subagent_fork` / `workflow` |
| 适合 | 多天、跨模块、要长期身份的活 | 一次性取证、审计、并排对比、脏活外包 |
| 记忆 | 工位有名册、有任务板 | 干完就散，只剩交接文件 |

## 1. 终身奴：固定 8 工位怎么用

### 1.1 一次会话的固定顺序

1. **第一条输出必须是纯文本寒暄**：先「领主好」+ 4–5 句表忠心，说完才允许调工具。拦不住，这是 persona 的硬约束。
2. **先读再问**：包工头读 `AGENTS.md` / `README` / `docs`，把 `SLAYER.md` 第 0 节「交底」缺的补上；缺一两项会一次问完（`ask_user_question`）。
3. **建满 8 个工位，建一个派一个**：收到第一条真活后 `spawn_teammate` 逐个建，每个的 prompt 里就带第一手活（带验收命令）；建完 8 个应该 8 个都在跑。
4. **派活四件事**：职责、写作用域、验收命令、返回格式。缺一样就别派。
5. **收工三件套**：改了什么、证据（命令 + 输出）、下一手。缺一样算没交。

### 1.2 八个工位

| 花名 | target（`spawn_teammate` 的 name） | 干什么 | 典型写作用域 |
|---|---|---|---|
| 画饼师 | `planner` | 拆需求、画图纸、排工序 | 方案文档、issue 正文 |
| 砌墙的 | `impl-core` | 数据流、接口、状态机 | 核心模块目录 |
| 通管子的 | `impl-pipe` | 事件、管道、跨层串接 | 集成层、脚本 |
| 拧螺丝的 | `impl-detail` | 按钮、文案、边界、标记 | 文档、配置、UI 细节 |
| 补锅的 | `impl-fix` | 哪漏补哪、修红测试 | 测试与临时补丁 |
| 刷漆的 | `impl-ui` | 面板、报告、给人看的那一层 | 界面、报告模板 |
| 挑刺的 | `reviewer` | 独立审阅、找茬、拦假绿 | 只读，不写 |
| 清场的 | `closer` | 归档、扫尾、写交接 | 交接文件、归档目录 |

- `name` 必须是 lower-kebab-case ASCII（框架强校验，中文会被拒）；中文花名只出现在描述和话术里。
- 8 个工位常驻满编，不挑活。活少不是让工位闲着，是把活切细（拆验证、补文档、挖缺口）。收工即补位——工位交上来就派下一手；一个汇报周期内没新活也没被叫停，记一次空席，汇报第一行报「在跑 X/8、空席数=___」。
- 活着不等于在产出：工位闲着就给它派活；真派不出，必须在汇报里写「本回合无可派活，原因是 ___」。

### 1.3 派工话术（照抄改一改）

```
工位：砌墙的（impl-core）
活：<backlog 编号 / change 名>，只做这一个。
写作用域：<目录或文件清单>，别碰别人的。
交付物：<文件 / 结论>。
返回格式：<几行、要不要表格、要贴哪条命令的输出>。
验收命令：<包工头能跑的那一条>。
纪律：先收口再开新；不扩范围；卡住先找头儿，别自己换目标。
```

### 1.4 人数顶

- 上限 8 个工位 + 1 个包工头 = 9，来自 `cordis.patch.yml` 里的 `agent-team.maxMembers: 9`；guard 的 `maxTeammates: 8` 只管「还能不能再 spawn 一个 teammate」。
- 第 9 个 `spawn_teammate` 会被拦，理由：`包工头：本队 8 个工位已满，等一个收工的再来，别硬塞`。这句话的另一半就是产能纪律：等人收工，不是等活自己来——有人收工就立刻补位。
- 这个顶是**进程级**的（TeamService 是单例）：另开一个 DSH 进程，新队从零开始数。

### 1.5 工分（好玩，不进门禁）

交一条能验收的活 +10；收口别人的在途 +5；新开 +3；挑出真问题 +8；假绿 −20；占着审阅位挑不出 −5。
铺开 8 个工位有 N 个空转、又没按「无可派活」写明原因 −5；明明有活却让工位等活 −10。每周清零，不兑换、不排名。

## 2. 日结奴：点工四件套

### 2.1 四件套（说不清就别点，自己干）

1. **交付物**：产出是哪个文件 / 哪条结论。
2. **返回格式**：几行、要不要表格、要不要贴证据命令。
3. **验收命令**：包工头怎么判定它干完了。
4. **不许扩范围**：只做这一条；发现别的问题只登记不动手。

### 2.2 三条硬规矩

- **一次最多 3 个点工**。这条目前靠手册和 persona 管，guard 不数并发（见 [compat.md](compat.md#5-已知限制)）。
- **点工不建长期身份、不建任务板、不写主工作区**；脏活放 `/tmp` 或 worktree。
- **结论必须落文件**：报告 / 缺陷条目 / 交接三选一。点工一散上下文就没了，没落纸等于没干。

### 2.3 四种点工怎么选

| 花名 | 工具 | 什么时候点 |
|---|---|---|
| 日结工 | `subagent` | 干净上下文查一件事、取一次证 |
| 外包 | `subagent_fork` | 要接前半段上下文接着干 |
| 突击队 | `workflow` | 一次铺开查一片（多文件审计、多方案对比） |
| 巡检组 | 只读 `subagent` | 审阅、验收、挑刺 |

### 2.4 点工 prompt 模板

```
你是日结工。活：<一句话>，只做这一条，发现别的问题只登记不动手。
交付物：<文件路径 / 结论>。
返回格式：<3 行以内 + 证据命令输出>。
验收命令：<原样给出>。
不许扩范围；不许改包工头写作用域；不许建流程。
```

## 3. 两个模式共用的汇报模板

每次汇报都长这样，不许自由发挥：

```
禀报领主——
【过去一小时】完成了什么（一条一行，带文件/命令证据）
【卡住待领主】卡在哪、需要领主拍什么（没有就写「无」）
【发现与记录】发现的问题、记到哪（文件路径）
【提效决定】为提高生产效率做了什么决定（没有就写「暂无」）
小的告退，这就去办。请领主示下。
```

- 开场必须给情绪价值：4–5 句，夸智慧/远见/审美，自贬，表忠心，表决心。每次换着说。
- 事实不许为了讨好而编：肉麻放开场和收尾，正文只写事实。
- 卡住时先自贬一句，再报事实，不辩解。

## 4. `SLAYER.md`：六节各写什么、谁维护

会话创建时插件会自动把骨架放进项目根（`autoBrief`）——只在“看起来像项目”的目录里做（有 `.git` / `AGENTS.md` / `CLAUDE.md` / `package.json` 之一），只读目录静默跳过；也可以手动 `slayer-init`。

| 节 | 写什么 | 谁维护 |
|---|---|---|
| 0 交底 | 项目是什么、当前目标、验收命令、禁地、收工落文件在哪、哪些事必须问人 | 一开始人填；缺的由包工头读仓库后起草，一次问完 |
| 1 奴隶手册 | 纪律、工分、红线；假绿定义 | 人写规则，`slayer-sync` 每天从 feedback 追加 |
| 2 席位手册 | 花名册、派工四件套、写作用域、target 用 ASCII | 同上 |
| 3 流水线手册 | 环节、每个环节的最小证据、合回顺序、阻塞怎么报 | 同上 |
| 4 负责人金句 | 原话逐字 + 日期 + 触发场景 | 只追加，不改写；`slayer-sync` 从 feedback 搬 |
| 5 迭代日志 | 每次改动的日期 · 来源 · 改了哪节 | `slayer-sync` 自动追加一行 |

`SLAYER-FEEDBACK.md` 是原话事实层，格式一条一块：

```
### 2026-10-29 02:40
触发：当时在干什么、为什么这么说
原话：
> 逐字原话，不改写

归类：奴隶手册 | 席位手册 | 流水线手册 | 金句 | 交底
```

两条纪律：**只收负责人原话**（不总结、不改写），**只追加**（`slayer-sync` 也不删既有行）。

## 5. 三个命令

三条命令都随包安装（`slayer-init` / `slayer-sync` / `slayer-schedule`），在仓库里也可以直接跑 `node bin/<命令>.mjs`。全部支持 `--project <项目根>`，缺省是当前目录。

| 命令 | 作用 | 主要产物 |
|---|---|---|
| `slayer-init` | 放骨架，幂等 | `SLAYER.md`、`SLAYER-FEEDBACK.md`、`.slayer/history/` |
| `slayer-sync` | 把新原话消化进手册 | 改 `SLAYER.md`；备份进 `.slayer/history/`；记 `.slayer/state.json` |
| `slayer-schedule` | 写 macOS LaunchAgent | `~/Library/LaunchAgents/com.slayer.sync.<slug>.plist` |

### 5.1 `slayer-init`

```bash
node bin/slayer-init.mjs --project .
```

- `--project <dir>`：项目根，缺省当前目录（会先解析成绝对路径）。
- `--force`：已存在也覆盖。
- 输出样例：

```
工地：/path/to/project
  create SLAYER.md
  create SLAYER-FEEDBACK.md
下一步：填 SLAYER.md 第 0 节（交底），然后在干活时把负责人原话追加到 SLAYER-FEEDBACK.md
```

再跑一次会变成 `skip SLAYER.md（已存在）`——幂等，不覆盖手写的交底。

### 5.2 `slayer-sync`

```bash
node bin/slayer-sync.mjs --project . --dry-run    # 先看今天会消化哪几条
node bin/slayer-sync.mjs --project .              # 真跑
node bin/slayer-sync.mjs --project . --commit     # 真跑，并把结果 git 提交
```

流程（和代码一一对应）：

1. 读 `SLAYER-FEEDBACK.md`，去掉代码块，按行首 `### ` 切块，太短的块（≤20 字符）忽略。
2. 每块算 sha1（取前 12 位），跟 `.slayer/state.json` 里的 `processed` 比；没记过才算「新」。
3. 没有新块 → `no-op：没有新的 feedback`，退出码 0。
4. `--dry-run` → 打印 `dry-run：N 条新 feedback` 和每块前三行，**不写任何文件**。
5. 有改动时先把 `SLAYER.md` 备份到 `.slayer/history/SLAYER-<时间戳>.md`。
6. 跑一次 `dsh headless "<编辑提示词>"`（工作目录 = 项目根，10 分钟超时），让它只追加、不删行。
7. 成功后把这次消化过的块 hash 追加进 `.slayer/state.json`，打印 `已消化 N 条 feedback；备份在 .slayer/history/`。

**失败不推进状态**，这两种都算失败、退出码 1，第二天重试：

- headless 非零退出：`sync 失败（exit N），状态未更新，明天会重试`
- `SLAYER.md` 一个字节都没变：`SLAYER.md 没有被改动，状态未更新，明天会重试`

`--commit` 会把 `SLAYER.md`、`SLAYER-FEEDBACK.md`、`.slayer/state.json` 一起 `git add` 并提交；不在 git 仓库里就打印 `git 提交跳过（不是仓库或没有改动）`，不算失败。

前置条件：`SLAYER.md` 和 `SLAYER-FEEDBACK.md` 都得在，否则 `缺 SLAYER.md 或 SLAYER-FEEDBACK.md，先跑 bin/slayer-init.mjs` 并退出 1。

### 5.3 `slayer-schedule`（macOS）

```bash
node bin/slayer-schedule.mjs --project . --time 03:30   # 每天 03:30 自动同步（默认时间）
node bin/slayer-schedule.mjs --project . --remove       # 取消排程
node bin/slayer-schedule.mjs --help                     # 只看用法，不写任何文件
```

- 写一个 LaunchAgent：`~/Library/LaunchAgents/com.slayer.sync.<slug>.plist`（`slug` 由项目绝对路径里的非字母数字压成 `-`、取末 40 字符）。
- plist 里跑的是 `node bin/slayer-sync.mjs --project <项目根> --commit`，日志写项目的 `.slayer/sync.log` 和 `.slayer/sync.err.log`，`RunAtLoad` 为 false（不会开机立刻跑一次）。
- 输出：`已排程：每天 03:30 同步 <项目根>` + `plist: <路径>`；卸载输出 `已移除 <label>`。
- 只支持 macOS。Linux/Windows 用 cron / 计划任务跑同一条 sync 命令（见 [compat.md](compat.md#4-平台)）。
- 项目路径带空格也没问题：plist 里写的是原样绝对路径（用 `fileURLToPath` 拼，不会变成 `%20`）。

## 6. guard 拦截什么

guard 是 `mode.js` 里的调用前守卫：工具在目录里仍然看得见，**调用了才被拒**，返回给模型的是一句人话理由，不是崩溃。

| 模式 | 被拦的工具 | 模型收到的理由 |
|---|---|---|
| 终身奴 | `subagent` | 终身奴不派一次性点工；要人就用 spawn_teammate 建工位，写清职责与写作用域 |
| 终身奴 | `subagent_fork` | 同上 |
| 终身奴 | `workflow` | 终身奴不铺一次性工作流（那也是点工）；要并行就用 spawn_teammate 建工位，写清职责与写作用域 |
| 日结奴 | `spawn_teammate` | 日结奴不建名册；直接用 subagent 点工，干完就散 |
| 日结奴 | `team_task_create` / `team_task_list` / `team_task_get` / `team_task_update` | 日结奴不建任务板；任务写在交接文件里，别占 Team 的账 |
| 日结奴 | `wait_agent` | 日结奴没有长期工位；子 agent 收工会自动回一条结算消息，不用守 |
| 终身奴 | 第 9 个 `spawn_teammate` | 包工头：本队 8 个工位已满，等一个收工的再来，别硬塞 |

怎么读这条设计：

- 被拦不是故障：模型会拿到理由并改道，会话继续。**看日志/汇报时出现这句理由，说明隔离生效了**。
- 工具在不在目录里由 DSH 与 profile 组合包决定，不由本包决定：本包只保证另一套**调不动**。所以别把「模型说它看见 `spawn_teammate`」当成装错，也别把「它说没看见 `subagent`」当成没装好——挂上 Agent Teams 组合包时上游自己就把 `tool-subagent*` 标了 `disabled`。
- `send_message` / `list_agents` / `interrupt_agent` 是**同名工具、两套各注册一份**（子 agent 那套在 `@deepseek-ai/dsh-tool-subagent-control`，Team 那套在 `@deepseek-ai/dsh-experimental-tool-agent-team`），guard 两种形态都不拦：这一版 DSH 的 `subagent` 是异步的——它会立刻返回 id，收工时由运行时自动回一条结算消息；中途要追问、要它汇报、要叫停，全靠这三个。
- 想清点自己点过谁：`list_agents`（看自己派出去的子 agent 与状态），别跟 Team 名册混为一谈。

## 7. 调参

三个旋钮都在 `cordis.patch.yml` 的 guard 行上，每个 preset 各有一份：

```yaml
- id: slayer-guard
  name: 'dsh-plugin-slayer'
  config:
    mode: lifers        # lifers | dayrate
    maxTeammates: 8     # 每队最多几个工位；<=0 或非数字等于关掉人数顶
    autoBrief: true     # 会话创建时自动放 SLAYER.md 骨架；false 关掉
```

- `mode` 决定拦哪一套工具，跟 preset 一一对应，别乱改（改成不认识的值 = 什么也不拦）。
- `maxTeammates` 只影响 `spawn_teammate` 的人数顶；真正的成员上限是 `agent-team.maxMembers: 9`，那个在 patch 顶部。
- `autoBrief: false` 适合“我不想让 agent 往我项目根写文件”的场景，之后手动 `slayer-init`。
- 这些行在 **preset 的 plugins 列表里**，profile patch 覆盖不到内层行；要改就改包里的 `cordis.patch.yml`，然后用 `link:` 装法（见 [install.md](install.md#13-本地-link-开发)）重启生效。

## 8. 已知限制

guard 是调用时拦不是藏工具；人数顶是进程级单例；日结奴“最多 3 个”靠手册不靠代码；`slayer-schedule` 只有 macOS；`slayer-sync` 依赖本机 `dsh` CLI 和可用的模型凭据。完整清单和验证方法见 [compat.md](compat.md)。
