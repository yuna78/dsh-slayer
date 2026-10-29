# 安装 · SLAYER（`dsh-plugin-slayer`）

> 读完这篇你能：把 SLAYER 装进任意一个 DSH profile，重启后在新会话的模式选择器里看到「SLAYER · 终身奴（The Lifers）」和「SLAYER · 日结奴（Day Rate）」。
> 三种装法、一个前提、一张装不上的排查表、一条回退命令；命令都能直接复制。

## 0. 装之前：三行检查

```bash
dsh --version    # 需要 >=0.2.1-rc.2 且 <0.3.0
node -v          # 需要 ^22.19.0 || >=24.0.0
pnpm -v          # 有就行：dsh plugin 把参数转给 pnpm
```

| 项 | 要求 | 不满足会怎样 |
|---|---|---|
| DSH | 本插件支持 `>=0.2.1-rc.2 <0.3.0`（含预发布） | 装前就被拒：`installation rejected: ... incompatible with dsh ...` |
| Node | `^22.19.0 || >=24.0.0` | 23.x 会让 `dsh` 静默什么都不做（见 §5） |
| pnpm | 在 `PATH` 上 | `dsh plugin` 直接失败 |

**终身奴模式还有一个前提**：它的 9 个团队工具（`spawn_teammate` / `team_task_create|list|get|update` / `send_message` / `wait_agent` / `list_agents` / `interrupt_agent`）来自 DSH 的 **Agent Teams** 实验组合包 `@deepseek-ai/dsh-experimental-agent-team-profile`。
没启用它，模式还在、包工头还在，但 `spawn_teammate` 根本不存在，`--dump-config` 会打印 `patch: entry "agent-team" not found`。
启用方式：Web 侧栏 **插件 → 实验性插件 → Agent Teams（智能体团队）** 打开。日结奴模式不依赖它。

装完你会多出：

- 两条 preset（只对**新建**会话生效；已开着的会话不变）
- 会话创建时，项目根自动补 `SLAYER.md`、`SLAYER-FEEDBACK.md`、`.slayer/history/`（只在“看起来像项目”的目录里做：有 `.git` / `AGENTS.md` / `CLAUDE.md` / `package.json` 之一；只读目录静默跳过）
- 三个命令：`slayer-init` / `slayer-sync` / `slayer-schedule`

## 1. 三种装法

### 1.1 npm registry（推荐）

```bash
dsh plugin --profile web add dsh-plugin-slayer
```

钉死版本（发过新版后想复现问题）：

```bash
dsh plugin --profile web add dsh-plugin-slayer@0.1.0
```

国内镜像慢时换源：

```bash
dsh plugin --profile web add dsh-plugin-slayer --registry https://registry.npmmirror.com
```

### 1.2 GitHub 源码

```bash
# 主干
dsh plugin --profile web add github:yuna78/dsh-slayer
# 钉 tag
dsh plugin --profile web add github:yuna78/dsh-slayer#v0.1.0
# 或者用完整 git 地址
dsh plugin --profile web add git+https://github.com/yuna78/dsh-slayer.git
```

源码装和 npm 装的区别只有一个：git/tarball 必须先抓下来才知道清单长什么样，所以**兼容性检查发生在抓取之后**——不兼容时会回滚 profile 清单和锁文件，不会留下半个包。

### 1.3 本地 `link:` 开发

```bash
git clone https://github.com/yuna78/dsh-slayer.git ~/code/dsh-slayer
dsh plugin --profile web add "link:$HOME/code/dsh-slayer"
```

- 必须是绝对路径；`link:` 装的是「指过去」的软链，改完代码重启 DSH 就生效，不用重装。
- 想让 profile 复制一份（不跟工作区联动）：`dsh plugin --profile web add "$HOME/code/dsh-slayer"`。
- 要改 `cordis.patch.yml` 调参，用这种装法；装好的 registry 副本改不到。

## 2. `--profile` 是什么

DSH 的 profile 是「一层层 patch 叠出来的运行配置」，存在 `$DSH_HOME/profiles/<name>/`（默认 `~/.dsh/profiles/<name>/`）。

| profile | 是什么 | 什么时候用 |
|---|---|---|
| `web` | Web / Desktop 应用 | 日常用；装这里就等于“给我这个 App 装上” |
| `headless` | `dsh headless "任务"` 一次性跑 | 想给自动化用 |
| 自建（如 `slayer-test`） | 你没写过就自动初始化 | **验证安装**，别拿 `web` 当试验田 |

- 每条命令都必须带 `--profile`，`dsh plugin` 少了它会直接报错。
- 首次 `dsh plugin --profile <name> add ...` 会自动创建这个 profile；没创建过的 profile 跑 `--dump-config` 会报 `profile "xxx" does not exist`。
- `web` 里装了插件，`headless` 不会跟着有——每个 profile 各管各的。

## 3. 装完三步，别跳

1. **完全重启 DSH**：Desktop 要退干净再开；命令行起的 Web 就重启进程。装成功不等于已激活。
2. **新建一个会话**，在模式选择器里选 `SLAYER · 终身奴（The Lifers）` 或 `SLAYER · 日结奴（Day Rate）`。设置页可以把其中一个设为新任务默认值。
3. **验一眼配置**（下一节）。已经开着的会话不会变，这是 DSH 的设计，不是装失败。

## 4. 验证

```bash
dsh --profile web --dump-config | grep -E "preset-slayer|slayer-guard|mode: "
```

期望看到（缩进按 dump 输出）：

```
- id: preset-slayer-lifers
      - id: slayer-guard
          mode: lifers
          maxTeammates: 8
- id: preset-slayer-dayrate
      - id: slayer-guard
          mode: dayrate
```

- 两条 preset 都在 → 配置层 OK。
- 顺带一行 `dsh: [dsh-plugin-slayer] patch: entry "agent-team" not found` → 插件装好了，但 Agent Teams 组合包没启用（见 §0 前提）。
- 版本豁免清单：`dsh plugin --profile web version-exemptions`（没有豁免时输出 `{}`）。

真会话验证（最靠谱）：新开两个会话各选一个模式，问「列出你当前可用的工具名」。

- **guard 是「调用时拦」，不是「藏工具」**：工具在不在目录里不归本包管，归 DSH 与 profile 组合包管；本包只保证**调不动**。**看得见是预期，调得动才是装错。**
- 终身奴：让模型 `spawn_teammate` 建一个工位 → 应该成功；让它 `workflow` → 应该被拒并回一句「终身奴不铺一次性工作流……」。
  注意 `subagent` / `subagent_fork` 在终身奴里**可能整个不在工具目录**——挂上实验性 Team 组合包时，上游组合包自己把 `tool-subagent*` 标了 `disabled`。所以这两条**验的是「调不动」，不是「被本包拒绝」**：目录里没有 = 没得调，也算通过。
- 日结奴：让它 `subagent` 点一个不落盘的小活 → 应该成功并收到子 agent 的结算消息；让它 `spawn_teammate` / `team_task_create` / `wait_agent` → 应该被拒并回一句「日结奴不建名册……」。
- 理由文案的完整表在 [manual.md](manual.md#6-guard-拦截什么)。

## 5. 装不上怎么查

| 症状 | 原因 | 处理 |
|---|---|---|
| 「Add plugin」弹窗搜不到 | 搜的是品牌名 `SLAYER` 或仓库名 `dsh-slayer`，不是 npm 包名 | 用 **`dsh-plugin-slayer`** 搜 |
| 同上 | 「发现」页没有索引源；或条目还没进夜间 probe 构建；或 App 缓存了旧索引 | 见下面「搜不到的四步」 |
| preset 不出现 | 没重启；或只看老会话；或插件没进 profile 的 bundle 列表 | 重启 + 新建会话；`dsh plugin --profile web list \| grep slayer`；再看 §4 的 grep |
| 终身奴没有 `spawn_teammate` | 没启用 Agent Teams 组合包 | 插件页启用 `@deepseek-ai/dsh-experimental-agent-team-profile` 后重启 |
| 装到一半被拒：`installation rejected: ... incompatible with dsh 0.2.1-rc.2` | `engines.dsh` / peer 范围没覆盖当前 DSH | 装兼容版本；或按提示做精确版本豁免（有风险，见 [compat.md](compat.md#2-dsh-版本范围与预发布-peer-的坑)） |
| `dsh` 什么也不输出、退出码 0 | Node 版本不对（23.x 没有 `import.meta.main`，DSH 入口直接不跑） | 换 Node 24.x（或 22.19+），见 [compat.md](compat.md#3-node-版本) |
| `dsh plugin` 报找不到 pnpm | 没装 pnpm / 不在 `PATH` | `npm i -g pnpm`，或 `dsh plugin` 用的环境里补上 |
| 装成功但功能没出现 | 没重启；或装进了别的 profile | 重启；`dsh --profile web --dump-config \| grep slayer` |
| pnpm 拦下依赖构建脚本（`pendingBuilds`） | 本包没有依赖构建脚本；若出现，说明是别的包 | 插件页点「允许这些脚本并重试」，或换干净 profile 重装 |

**「Add plugin」搜不到的四步**（按顺序，别跳）：

1. 包名打对：npm 包名是 `dsh-plugin-slayer`。搜不到就**换成直接安装**——对话框接受包名、Git 地址、本地绝对路径三种输入。
2. 市场索引还没带上：awesome-dsh-plugin 的条目要在合并后等**每天夜间**的 probe 构建（约 1.5–2 小时）才会进索引。当天搜不到是正常的。
3. 本机没有索引源：「发现」标签页要先启用实验性的**自定义插件市场**组合包，再加索引源 `https://awesome-dsh-plugin.com/index.json`。
4. 缓存/镜像：关弹窗重开、重启 DSH；镜像没同步就切官方 registry。

绕过搜索的两条直装命令（和「Add plugin」等价）：

```bash
dsh plugin --profile web add dsh-plugin-slayer
dsh plugin --profile web add "link:$HOME/code/dsh-slayer"
```

装失败时 `dsh plugin` 会打印一行 `dsh: nothing was installed.` 加一份诊断日志路径（`.plugin-manager/logs/...`）。先看那份 pnpm 日志，比猜快。

## 6. 回退

```bash
dsh plugin --profile web remove dsh-plugin-slayer
```

然后：

1. **完全重启 DSH**。
2. 确认配置层干净：`dsh --profile web --dump-config | grep -c preset-slayer` → `0`。
3. 项目里留下的文件**不会**自动删，按需手动处理：
   - `SLAYER.md`、`SLAYER-FEEDBACK.md`（想留就留，纯 markdown）
   - `.slayer/`（`history/` 备份、`state.json`、`sync.log`）
   - 排过每日同步的，先取消排程：`node bin/slayer-schedule.mjs --project . --remove`（`bin/` 在插件包里，卸载前跑，或者直接用仓库副本跑）
4. 做过版本豁免的，清掉：`dsh plugin --profile web revoke-version dsh-plugin-slayer@0.1.0 --dsh-version 0.2.1-rc.2`。

回退是安全的：插件只在**会话创建时**往项目根补骨架文件，不接管已有文件，不改项目代码。

## 7. 验证安装时别污染日常 profile

```bash
dsh plugin --profile slayer-test add "link:$HOME/code/dsh-slayer"
dsh --profile slayer-test --dump-config | grep -E "preset-slayer|slayer-guard"
dsh plugin --profile slayer-test remove dsh-plugin-slayer
```

自建 profile 和 `web` 完全隔离；验完删掉 `$DSH_HOME/profiles/slayer-test/` 也不会影响日常环境。
