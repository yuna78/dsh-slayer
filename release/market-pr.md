# 市场投稿 PR 说明草稿

目标仓：`awesome-dsh-plugin/awesome-dsh-plugin`（站点 <https://awesome-dsh-plugin.com> 与 npm 包 `dsh-plugin-catalog` 的数据源）。
这次只加**一个文件**，不碰 README（README 是构建生成物）。

## 一、改哪个文件

新增：`data/plugins/yuna78__dsh-slayer.yml`

```yaml
url: https://github.com/yuna78/dsh-slayer
name: yuna78/dsh-slayer
category: workflow
description:
  en: 'Two DSH delegation presets — a fixed 8-seat crew, or up to 3 day-rate temps by convention — with call-time guards that refuse the other shape''s delegation tools.'
  zh: 给 DSH 装两条干活形态——8 个固定工位的终身奴，或按约定一次最多点 3 个的日结奴；跨形态调用会在调用时被 guard 拒绝。
```

要点：

- 投稿文件**只留这四个键**，不加注释——对照 `data/plugins/` 里的真实条目，没人带注释；解释全写在本 PR 正文里。
- `description.en` 只写功能与事实：**不写营销词、不写「互相看不见」**（实际是调用时拦，仓库里看得见）。市场维护者会对着源码核这一行。
- `description.en` 里有 `: ` 时整行**必须加引号**，否则 YAML 会解析成嵌套键（本例用单引号，句内的 `'` 写成 `''`）。
- 「一次最多 3 个」代码里没有硬顶（终身奴的 8 工位才有 `maxTeammates` 硬顶），所以写 "by convention"。
- 内容与本仓 `market/yuna78__dsh-slayer.yml` 保持一致，改一处记得改另一处。
- 该包不是 monorepo 子包，`url` / `name` 不需要 `#subname` 或 `/tree/main/...`。
- 可选 `icon:`，暂不提供。

## 二、为什么归 `workflow`

`category` 枚举里没有「多 agent」「委派」这类选项，最贴近的是 `workflow`，理由是：

- 它不改模型、不改工具本体、不加 UI，装完改变的是**一个会话怎么拆活、怎么派人、怎么验收、怎么收工**——这是工作流层面的东西。
- 两条 preset 是把「团队制」与「外包制」两种编排形态固化下来，本质上是在选工作流，不是在选模型或界面。
- 它自带 `SLAYER.md` 六节手册与每日迭代（feedback → 纪律），属于流程资产，不是运行时能力。

如果维护者认为该归 `tools` 或 `dev`，按维护者的判断改，不争。

## 三、合并后：当天搜不到是正常的

- 合并触发的是 push 构建：**立刻部署站点，但不探测 npm**。
- npm 关联由夜间构建（cron `23 2 * * *` = 每天 **02:23 UTC**）全量重探，历史耗时约 1.5–2 小时。
- 在那一轮跑完之前：站点卡片显示 `npm: 0`、`stars: null`，条目**不进 `index.json`**，所以 DSH 的「Add plugin」弹窗搜不到，只能贴仓库地址安装。
- 结论：**合并后当天不算数，第二天再看**。

前置条件（缺一条就会被判「未发 npm」）：

1. npm 上已有 `dsh-plugin-slayer@0.1.0`。
2. `package.json` 的 `repository.url` 含 `yuna78/dsh-slayer`——这是市场判定 npm 归属的唯一凭证。
3. 根包声明了 `dsh.bundle`（本包指向 `./cordis.patch.yml`）。

## 四、PR 标题与正文

标题：

```
Add yuna78/dsh-slayer (workflow)
```

正文：

```markdown
Adds SLAYER, a workflow plugin that installs two delegation presets into DSH:
The Lifers (one foreman + eight fixed seats, Team tools) and Day Rate (one
foreman + up to three disposable temps, subagent/workflow tools).

The two shapes share one tool catalogue — DSH mounts both at the host layer —
so a guard refuses out-of-mode calls at call time and explains why. Ships with
a six-section project handbook (`SLAYER.md`), an init/sync/schedule CLI, and
an MIT license. The Lifers additionally needs DSH's experimental Agent Teams
bundle enabled on the profile.

- npm: https://www.npmjs.com/package/dsh-plugin-slayer
- repo: https://github.com/yuna78/dsh-slayer
- category: workflow (it changes how a session splits, delegates and signs off
  work, not what the model or the UI can do)
```

## 五、验证（夜间构建跑完之后）

```bash
# 1. 站点 catalog：期望 npm=1，cmd 是 npm 安装命令
curl -s https://awesome-dsh-plugin.com/catalog.json | grep -o '"cmd":"[^"]*dsh-plugin-slayer[^"]*"' | head -1

# 2. 市场索引：期望 1
curl -s https://awesome-dsh-plugin.com/index.json | grep -c dsh-plugin-slayer

# 3. 市场索引包在涨版本 + 镜像同步
npm view dsh-plugin-catalog version
curl -s https://registry.npmmirror.com/dsh-plugin-slayer | grep -o '"latest":"[^"]*"' | head -1
```

三条都对上，才算真进了市场。若 `index.json` 仍是 0：先确认 npm 上包已发布、`repository.url` 没写错，再等下一轮夜间构建（或请维护者手动 dispatch `build-site.yml` 跑 `probe_all`）。
