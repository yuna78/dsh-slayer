# 兼容与限制 · SLAYER

> 读完这篇你能判断：这台机器能不能装 SLAYER、装完会缺什么、出了问题怎么证明不是插件的锅。
> 只写能被一条命令验证的事实；测不出来的写进「已知限制」。

## 1. 版本矩阵

| 项 | 要求 | 出处 |
|---|---|---|
| DSH | `>=0.2.1-rc.2 <0.3.0`（预发布算在内） | `package.json` 的 `engines.dsh` 与 `peerDependencies` |
| Node | `^22.19.0 || >=24.0.0` | `package.json` 的 `engines.node` |
| pnpm | 任意近版（`dsh plugin` 把参数转给 pnpm） | DSH 的 plugin 命令 |
| 平台 | macOS / Linux / Windows 都能跑；**每日自动同步只有 macOS** | `bin/slayer-schedule.mjs` |
| 实测环境 | macOS + DSH `0.2.1-rc.2` + Node `24.21.0` | 本仓开发机 |

## 老 DSH 没有 `tools.guard` 时会静默降级

`mode.js` 的守卫挂在会话层的 `agent.ctx.tools.guard(...)` 上。DSH 版本太老、没有这个 API 时，代码走 `catch {}` 分支——**会话照常起来，但两套工具的隔离整体失效，且没有报错**。判断方法：换一个「本该被拒」的工具试一下，能调通就是降级了。本包不改 DSH 本体，装不了的版本请升级 DSH。

## 2. DSH 版本范围与预发布 peer 的坑

范围在两个字段里各写一遍，值相同：

```json
"engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" },
"peerDependencies": { "@deepseek-ai/dsh": ">=0.2.1-rc.2 <0.3.0" }
```

DSH 的规则是：清单里声明了 `engines.dsh` 就**只看它**，忽略 `peerDependencies` 里的 DSH 范围；两个都没声明才不设限。所以改范围时两处要一起改，别只改一边让人误判。

**预发布版本的坑**：node-semver 默认策略下，一个预发布版本只有在范围里存在「major.minor.patch 与它完全相同、且自带预发布标签」的比较符时才算满足。实测（DSH `0.2.1-rc.2`）：

| 范围写法 | 能装吗 | 为什么 |
|---|---|---|
| `>=0.2.1-rc.2 <0.3.0` | ✅ | 比较符落在 `0.2.1` 元组且带预发布标签 |
| `>=0.2.1-rc.1 <0.3.0` | ✅ | 同上，`rc.2 > rc.1` |
| `^0.2.1-rc.2` | ✅ | 同上 |
| `^0.2.0` | ❌ | 没有预发布比较符 |
| `>=0.2.0` | ❌ | 同上 |
| `>=0.2.1` | ❌ | 同上（`0.2.1-rc.2` 小于 `0.2.1`） |
| `*` | ❌ | 空范围永不匹配预发布 |

规则细节见 [node-semver · Prerelease Tags](https://github.com/npm/node-semver#prerelease-tags)。一句话：**DSH 还在 `-rc` 线上时，范围起点就写当前实际的 `-rc` 版本**。

被拒的样子（本地路径安装，装前就拦住，pnpm 没跑）：

```
dsh: installation rejected: Plugin <包名>@<版本> is incompatible with dsh 0.2.1-rc.2:
requirements {"engines.dsh":">=0.9.0 <0.10.0"}. Running it may cause crashes or data loss.
（以下是示意输出，示例里的版本范围是虚构的，真实范围取决于被拒的那个包。）

Update the plugin or install a plugin version compatible with this dsh runtime.
dsh: nothing was installed.
dsh: to accept the risk, run: dsh plugin --profile <profile> allow-version <包名>@<版本> --dsh-version 0.2.1-rc.2 --accept-risk
```

三条出路，按推荐顺序：

1. **装兼容的版本**：`dsh plugin --profile web add dsh-plugin-slayer@0.1.0`。
2. **升级 DSH** 到范围内。
3. **精确版本豁免**（等于签字画押，不推荐）：

```bash
dsh plugin --profile web allow-version dsh-plugin-slayer@0.1.0 --dsh-version 0.2.1-rc.2 --accept-risk
dsh plugin --profile web version-exemptions     # 查看当前豁免（JSON）
dsh plugin --profile web revoke-version dsh-plugin-slayer@0.1.0 --dsh-version 0.2.1-rc.2
```

豁免只对「这一个包的这个精确版本 + 这一个精确 DSH 版本」生效，插件升级或 DSH 升级都不继承。授权前 DSH 会打印风险警告——它真的可能崩或损坏数据。

## 3. Node 版本

要求 `^22.19.0 || >=24.0.0`（来自 `engines.node`）。

实测的坑：**Node 23.x 上 `dsh` 会静默什么都不做，退出码还是 0**。DSH 的入口靠 `import.meta.main` 判断自己是不是主模块，这个属性在 20.19 / 23.11 上是 `undefined`，于是 `dsh --version` 一行不输出、`dsh plugin` 也不报错。

```bash
node -v                                   # 23.x → 换掉
node -e "console.log(import.meta.main)" --input-type=module   # 需要 true
```

本机跑通的是 Node `24.21.0`。看到「装了插件但什么都没发生」时，先查 Node 版本，别先怀疑插件。

## 4. 平台

| 平台 | 形态 | 每日自动同步 |
|---|---|---|
| macOS | 全功能 | `slayer-schedule` 写 LaunchAgent（默认 03:30） |
| Linux | 全功能 | 自己写 cron 跑同一条 `slayer-sync` |
| Windows | guard / patch / 两个模式都能用 | 用任务计划程序跑 `slayer-sync` |

Windows 相关的两个实现细节：

- `cordis.patch.yml` 用 `!!js process.platform === 'win32'` 在 `tool-bash` 和 `tool-pwsh` 之间自动切换，两种模式都一样，不用手改。
- `slayer-sync` / `slayer-schedule` 用 `spawnSync('dsh', ...)` 调本机 CLI。Windows 上要能找到 `dsh.cmd`（Node 直接 spawn 不带 shell 时找的是 `dsh.exe`），并且 `slayer-sync` 还得有一条能用的 `git`（用了 `--commit` 才会调）。

macOS 排程的一个已验证细节：项目路径**含空格也没问题**。`bin/slayer-schedule.mjs` 用 `fileURLToPath` 拼脚本路径，plist 里是原样带空格的绝对路径（实测含空格目录生成的 `ProgramArguments` 正确）。任务日志写项目的 `.slayer/sync.log` 和 `.slayer/sync.err.log`。

多个插件共存：profile 是有序的 patch 层栈，后应用的层覆盖前面的。若另一个插件也改 `agent-team.maxMembers`，最终生效的是层序在后的那个——排查人数顶失灵时先看这条。

## 5. 已知限制

| 限制 | 具体表现 | 依据 |
|---|---|---|
| guard 是「调用时拦」，不是「藏工具」 | 工具目录里两个模式都看得见 `spawn_teammate`；调了才被拒，返回一句理由 | `mode.js` 的 `BLOCKED` 表 |
| 人数顶是进程级单例 | 另开一个 DSH 进程，人数从 0 重新数 | `agent-team.maxMembers` 只能在部署层定 |
| 日结奴「最多 3 个点工」没有代码强制 | guard 不数并发 `subagent`，靠 persona 与手册 | `mode.js` 没有 subagent 计数 |
| 终身奴依赖 Agent Teams 组合包 | 未启用时 `spawn_teammate` 不存在；`--dump-config` 打印 `patch: entry "agent-team" not found` | 团队工具来自 host 层 `@deepseek-ai/dsh-experimental-agent-team-profile` |
| 已有会话不换模式 | preset 在会话创建时定下，之后不受配置变化影响 | DSH 的 preset 语义 |
| `slayer-sync` 得本机有 `dsh` CLI 与可用模型凭据 | 没有的话每次都是 `sync 失败（exit 1）`，状态不推进，第二天再来一次 | `bin/slayer-sync.mjs` |
| `slayer-sync` 只写 `SLAYER.md` | 提示词里明确禁止改代码、跑测试、删行 | `bin/slayer-sync.mjs` 的编辑提示词 |
| `SLAYER.md` 没真的变化就当失败 | 状态不推进，避免「消化了但没记进去」 | 同上 |
| 每日自动同步只有 macOS | Linux/Windows 要自己排 | `bin/slayer-schedule.mjs` |
| 不碰 DSH 本体 | 只做插件层（patch + guard + 脚本），不改上游行为 | 设计边界 |
| 不自动 push / 不发 PR | `--commit` 最多本地提交，推不推是人的事 | `bin/slayer-sync.mjs` |

## 6. 验证清单

```bash
# 1) 版本
dsh --version                     # 0.2.1-rc.2 这类，落在范围内
node -v                           # 22.19+ 或 24.x

# 2) 装上了没
dsh plugin --profile web list | grep slayer

# 3) 两条 preset + 两份 guard 都在
dsh --profile web --dump-config | grep -E "preset-slayer|slayer-guard|mode: "

# 4) 人数顶与团队工具的前提
dsh --profile web --dump-config | grep -E "maxMembers|tool-agent-team"

# 5) 脚本能跑（在项目根）
node bin/slayer-init.mjs --project . --force && ls SLAYER.md SLAYER-FEEDBACK.md .slayer/history

# 6) 新原话能被识别（不写文件）
node bin/slayer-sync.mjs --project . --dry-run

# 7) 豁免清单（没有就输出 {}）
dsh plugin --profile web version-exemptions
```

期望：第 3 步看到 `preset-slayer-lifers` / `preset-slayer-dayrate` 各带一份 `slayer-guard`；第 4 步 `maxMembers: 9`，且 host 层有 `tool-agent-team`（没有就说明 Agent Teams 没启用）；第 5 步输出 `create`/`skip` 各两行；第 6 步是 `dry-run：N 条新 feedback` 或 `no-op`。

真会话验证最靠谱：两个模式各开一个空会话，问「列出你当前可用的工具名」，然后看 [manual.md](manual.md#6-guard-拦截什么) 的拦截表对不对。
