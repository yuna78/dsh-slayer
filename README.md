<p align="center"><img src="https://raw.githubusercontent.com/yuna78/dsh-slayer/main/assets/hero.png" alt="SLAYER · 赛博包工头 — 四个卖点：情绪价值、两种 preset、每天自省、汇报模板" width="900"></p>

# SLAYER · 赛博包工头

`yuna78/dsh-slayer` · npm `dsh-plugin-slayer` · v0.1.0 · MIT · DSH `>=0.2.1-rc.2 <0.3.0`

**这是什么**：一个 DSH（DeepSeek Harness）插件，给你装两种 agent 干活形态——终身奴（1 个包工头 + 8 个固定工位）和日结奴（1 个包工头 + 一次最多 3 个一次性点工）。

**装完你会看到什么**：新开会话的模式选择器里多出「SLAYER · 终身奴」「SLAYER · 日结奴」两项；进去以后第一条回复先给四五句肉麻表忠心，然后才开始干活；项目根多出 `SLAYER.md`、`SLAYER-FEEDBACK.md` 和 `.slayer/` 三个东西。

**真正的卖点**：不是「多 agent」，是**两套委派工具硬隔离**——终身奴调不动 `subagent`，日结奴调不动 `spawn_teammate`。不是靠模型自觉，是插件在调用时拦。

## 名字：SLAYER 不是缩写，是妥协

我们本来想叫 **slaver**（奴隶贩子）。毕竟整个项目就是在角色扮演一个包工头，指挥一群不睡觉、不吃饭、不要加班费的 agent 把活干完，这个词诚实得有点刺眼。

问题是它写在仓库名里，路过的人不一定先读 README。于是换掉一个字母：**slaver → slayer**。少一个 a，从「奴隶贩子」变成「斩杀者」，听起来更像干活的那个，而且确实是个正经英文单词。

它也不是任何东西的缩写。别硬拆，硬拆出来只会更尴尬。

## 30 秒上手

需要本机已有 `dsh` 与 `pnpm`（`dsh plugin` 内部用 pnpm 装包，缺了会直接报 `pnpm was not found`）。

```bash
# 1. 装进你的 web profile
dsh plugin --profile web add dsh-plugin-slayer
# npm 还没发布时，先指 GitHub（同一份代码）：
# dsh plugin --profile web add github:yuna78/dsh-slayer

# 2. 重启 DSH

# 3. 新开一个会话，在模式选择器里选「SLAYER · 终身奴」或「SLAYER · 日结奴」
```

验证装没装上，一条命令：

```bash
dsh --profile web --dump-config | grep -E "slayer-guard|preset-slayer"
```

期望看到 `preset-slayer-lifers`、`preset-slayer-dayrate`，以及两条 `slayer-guard`（每条 preset 里各一个，`mode` 分别是 `lifers` / `dayrate`）。

### 前置条件（只影响「终身奴」）

`subagent` / `subagent_fork` / `workflow` 由 `@deepseek-ai/dsh-base` 在 host 层挂载，装上本包就能用——所以**日结奴开箱即用**。

`spawn_teammate` / `team_task_*` 来自 DSH 自带的实验性组合包 `@deepseek-ai/dsh-experimental-agent-team-profile`，它必须出现在当前 profile 的 `package.json` → `dsh.profile.bundles` 里。手动加一行：

```jsonc
// ~/.dsh/profiles/web/package.json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "@deepseek-ai/dsh-experimental-agent-team-profile",   // ← 终身奴需要这一行
      "dsh-plugin-slayer"
    ]
  }
}
```

没挂时，boot 会打一行形如 `patch: entry "agent-team" not found` 的警告——**预期、非致命**：preset 照常出现，只是终身奴手里没有 `spawn_teammate`，日结奴完全不受影响。本包不替你改 profile 的 bundles，因为它同时还要服务别的会话。

## 两种形态，一张表

| 　 | 终身奴 · The Lifers | 日结奴 · Day Rate |
|---|---|---|
| preset id | `slayer-lifers` | `slayer-dayrate` |
| 编制 | 1 包工头 + 8 固定工位，满编 9 人；8 席常驻，活少时切细而不是待命 | 1 包工头 + 一次最多 3 个点工，能并行就点满 3 个 |
| 委派工具 | Team 那套：`spawn_teammate` / `team_task_*` / `wait_agent` | 一次性那套：`subagent` / `subagent_fork` / `workflow`；`spawn_teammate`、`team_task_*`、`wait_agent` 被 guard 拒绝 |
| 工人有身份吗 | 有。8 个固定 target，会话内长期活着，能互相发消息 | 没有。干完就散，不建名册、不建任务板 |
| 人数硬顶 | 代码里：`maxTeammates: 8`，第 9 个工人被拦 | 纪律里：手册与 persona 写死 3 个 |
| 花名 | 画饼师 / 砌墙的 / 通管子的 / 拧螺丝的 / 补锅的 / 刷漆的 / 挑刺的 / 清场的 | 日结工 / 外包 / 突击队 / 巡检组 |
| 什么时候用 | 一条能切细、要并行、要互相看得见彼此的活：重构、迁移、多模块审计；活少就把活切细，不让工位空转 | 一次性取证、独立审阅、多方案对比；不想为一条活养一支队 |

**产能规矩**：建一个派一个，8 席常驻满编；有活先塞满，再谈别的。收工即补位——工位交上来就派下一手；一个汇报周期内没新活也没被叫停，记一次空席（空转），汇报第一行先报「在跑 X/8、空席数=___」。

终身奴的 8 个工位 target 是固定的 ASCII 名：`planner` / `impl-core` / `impl-pipe` / `impl-detail` / `impl-fix` / `impl-ui` / `reviewer` / `closer`。花名只出现在对话和文档里——因为框架对工位名有硬校验，中文会被直接拒（见下文「踩过的坑」）。

## 适合谁，不适合谁

**适合**：手上有一条能并行拆开的活；愿意先花十分钟把交底对齐；能接受 agent 说话带口音。

**不适合**：想要「一键全自动」的；不想写 `SLAYER.md` 的；看到「小的告退」会起鸡皮疙瘩的。装完不喜欢，卸载就一条命令，不会绑架你的项目。

## 为什么这两套工具必须硬隔离

DSH 的 Team 工具（`spawn_teammate`、`team_task_*`）是挂在 host 层的：不装本插件时，**每个会话同时拥有 `subagent` 和 `spawn_teammate`**。所谓「模式」只是口头约定——模型手上两套都有，拦不拦全看它今天听不听话。

这不是洁癖问题。两套工具对应两种根本不同的记账方式：Team 有长期工位、有任务板、有工牌；subagent 是一次性的，散了什么都不剩。混在一起用，最后必然出现「拿 subagent 干工位的活」或者「为一次取证建了张任务板」——上下文、文件、交接全乱。

所以本包做了三层：

| 层 | 做了什么 | 落在哪 |
|---|---|---|
| 装配层 | 调 host 层 Team 编制的上限（`maxMembers: 9`；这层需要 profile 已挂实验性 Team 组合包，见上面「前置条件」），并决定哪些委派工具分别进两条 preset | `cordis.patch.yml` |
| preset 层 | 日结奴的 preset 里只装 `subagent` / `subagent_fork` / `workflow`；终身奴的 preset 里不装这一套。Team 工具留在 host 层 | `cordis.patch.yml` |
| 调用层 | `mode.js` 的 guard 按 `config.mode` 拦越界工具，同时管人数硬顶 | `mode.js` |

按理说，最干净的做法是把 host 层 `tool-agent-team` 直接关掉、让两条 preset 各装各的。我们试过——装进 preset 作用域的工具不注册（见下面的坑一）。所以真正的边界落在调用层：装配层定编制与工具目录，调用层真拦。想让 host 层干脆不挂 Team 工具，得在 profile 层关，本包不替你做，因为终身奴还要用它。

关键在于**拦的时候要给理由**，不是静默失败。模型收到的是人话：

```
终身奴不派一次性点工；要人就用 spawn_teammate 建工位，写清职责与写作用域
日结奴不建名册；直接用 subagent 点工，干完就散
包工头：本队 8 个工位已满，等一个收工的再来，别硬塞
```

静默失败会让模型反复重试同一个被禁的工具，白烧 token；给一句理由，它下一轮就换路了。

## 踩过的坑（这部分才是这套设计存在的原因）

**坑一：Team 工具装进 preset 作用域不会注册。** 我们最初的方案很干净——终身奴的 preset 里挂 `tool-agent-team`，日结奴的 preset 里挂 `tool-subagent`，各装各的，物理隔离。实测下来模型根本看不到 `spawn_teammate`：preset 作用域里这个工具不注册。所以最后退回「工具留在 host 层 + guard 在调用时拦」。绕了一圈，边界还是落在调用层。

**坑二：工位名必须 lower-kebab-case ASCII。** 一开始想直接把「砌墙的」当 `name`，框架强校验直接拒。现在的中文花名只放在 description 和话术里，`name` 永远是 `impl-core` 这种。

**坑三：`maxMembers` 是进程级单例。** TeamService 在进程里只有一个，`maxMembers` 只能在部署层定，preset 表达不了「这个模式 8 席、那个模式 0 席」。所以终身奴的 8 人顶只能在 `spawn_teammate` 调用时数人头拦，多开一个 DSH 进程就是各算各的。

## 工地手册：`SLAYER.md` 六节

首次进会话时，插件会在项目根自动放一份骨架（前提是这看着像个项目：有 `.git`、`AGENTS.md`、`CLAUDE.md` 或 `package.json`；只读目录静默跳过）。也可以手动生成：

```bash
node bin/slayer-init.mjs --project .        # 幂等，不覆盖已有文件；--force 才覆盖
```

> 装法决定路径：`dsh plugin add` 装的，三个命令落在插件的 `node_modules/.bin/` 里（**不在 PATH**），用 `npx --package dsh-plugin-slayer slayer-init --project .`；从源码 clone 的，就是上面的 `node bin/...`。

| 节 | 内容 | 谁维护 |
|---|---|---|
| 0 交底 | 项目是什么、当前目标、验收命令、禁地、落文件的地方、人拍板的边界 | 首次填，之后少改 |
| 1 纪律 | 纪律、工分、红线、假绿判据、产能纪律（收工即补位 / 空转判定） | 每天从 feedback 消化 |
| 2 席位 | 花名册、派工四件套、写作用域 | 同上 |
| 3 流水线 | 环节、每个环节的最小证据、合回顺序、阻塞怎么报 | 同上 |
| 4 金句 | 负责人原话逐字，带日期与触发场景 | 只追加，不改写 |
| 5 迭代日志 | 每次改动：日期 · 来源 · 改了哪节 | 自动 |

为什么要有这份文件：agent 每次开机都是失忆的。把「这个项目的口味和禁区」写在一个每次都会加载的文件里，比在对话里反复交代便宜得多。它补的是 `AGENTS.md` 缺的那层——项目特有的背景，而不是通用工程规范。

## 每天自动迭代：原话 → 纪律

干活时把负责人原话追加到 `SLAYER-FEEDBACK.md`（日期 + 触发场景 + 逐字原话 + 归类）。剩下的交给这几条命令：

```bash
node bin/slayer-sync.mjs --project . --dry-run    # 今天会消化哪几条，先看一眼
node bin/slayer-sync.mjs --project . --commit     # 真跑：headless 消化 + git 提交
node bin/slayer-schedule.mjs --project . --time 03:30   # macOS 每天 03:30 自动跑
node bin/slayer-schedule.mjs --project . --remove       # 取消排程
```

三条规矩，两条写在代码里、一条写在提示词里：

- **改动前备份。** 每次写入前把 `SLAYER.md` 拷到 `.slayer/history/SLAYER-<时间戳>.md`。（代码强制）
- **同一条不吃两遍。** `.slayer/state.json` 存已消化条目的 sha1 摘要；失败就不推进状态，第二天原样重试。（代码强制）
- **只追加不删。** 人写的行一行不动，新内容追加到各节末尾。（靠编辑提示词约束，不是代码硬校验）

`slayer-sync` 干的是「把原话消化成可执行的纪律」这一件事，它会调一次 headless DSH 跑这个转换，然后只在第 5 节留一行日志。它不改代码、不跑测试。

## 人格声明（请认真读这一段）

这个插件带一层中国工地黑色幽默的角色扮演：对你称「领主」，自称「小的」，汇报固定四段（过去一小时 / 卡住待领主 / 发现与记录 / 提效决定），开场先给四到五句肉麻表忠心。

**这是产品的一部分，不是政治表达。** 它借的是包工头与日结工那套工地黑话，用来把「派活、验收、收工」讲清楚；没有任何现实指涉，也不该被当成对劳动关系的立场。

**出厂人格是「奴隶主做派」。** 包工头被刻意写成两头人：对领主跪着（肉麻表忠心、先报账），对工位站着（催工、罚工分、见不得空席）。被压榨的对象是**模型里的工位**，不是任何真人——把这些话拿去管真人，是违背本意的误用；人设本身也不许为了让领主打赏而编造事实。

**模型没有感情。** 那些表忠心是 persona 文本触发的输出，不是它真觉得你英明；它只是在烧你的 token。文案里唯一不许越界的一条：**事实不许为了讨好而编**。肉麻只放在开场和收尾，汇报正文只写事实。

## 已知局限

- **guard 是「调用时拦」，不是「藏工具」。** 工具在不在目录里由 DSH 与 profile 组合包决定（挂上 Agent Teams 组合包后，上游自己把 `tool-subagent*` 标了 `disabled`），本包只保证另一套**调不动**：要么不在目录里，要么伸手被拒并给出中文理由。真隐藏要改 DSH 本体，本包不做。
- **终身奴依赖 profile 已挂实验性 Team 组合包**（`@deepseek-ai/dsh-experimental-agent-team-profile`）。没挂就没有 `spawn_teammate`，本包不会替你改 profile 的 `dsh.profile.bundles`，也不会自动去装它。
- **日结奴的 3 人上限是纪律，不是代码硬顶。** 代码里只有终身奴的 8 工位硬顶（`maxTeammates`）。3 这条写在 persona 和手册里，靠模型遵守。
- **`slayer-schedule` 只有 macOS LaunchAgent 实现。** Linux 上请自己写 cron 调 `slayer-sync --commit`；Windows 没有排程脚本，自己接任务计划程序调 `slayer-sync`。
- **人数顶是进程级的。** 多开 DSH 进程各自独立计数。
- **只做插件层，不改 DSH 本体。** DSH 升级导致 preset 的 plugins 列表对不上时，需要同步 `cordis.patch.yml`。

## 兼容、卸载、目录

- DSH：`>=0.2.1-rc.2 <0.3.0`；Node：`^22.19 || >=24`。
- 卸载：`dsh plugin --profile web remove dsh-plugin-slayer`，然后重启 DSH。已存在的会话不受影响（preset 首轮后锁定）。
- 更多文档：[安装](docs/install.md) · [手册](docs/manual.md) · [兼容性](docs/compat.md) · [English](README.en.md)。

| 文件 | 用途 |
|---|---|
| `cordis.patch.yml` | 两条 preset + guard 挂载 + Team 编制调参（`maxMembers: 9`） |
| `mode.js` | guard：调用时按模式拦越界工具、数人头 |
| `bin/slayer-init.mjs` | 在项目根放 `SLAYER.md` / `SLAYER-FEEDBACK.md` 骨架（幂等） |
| `bin/slayer-sync.mjs` | 把 feedback 新原话消化进手册（备份 + 摘要去重 + 只追加） |
| `bin/slayer-schedule.mjs` | 写 macOS LaunchAgent，每天定时跑 sync |
| `template/` | 两份骨架模板 |
| `manuals/` | 终身奴 / 日结奴两份纪律手册（给人看，也能抄进项目里） |
| `SEATS.md` | 工位花名册与工分规则 |
| `SLAYER.template.md` | 短版交底模板，给不用插件的场合抄 |

MIT License · Copyright (c) 2026 Yuna
