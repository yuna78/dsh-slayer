#!/usr/bin/env node
// 每日同步：把 SLAYER-FEEDBACK.md 的新原话消化进 SLAYER.md
// 用法：node bin/slayer-sync.mjs --project <项目根> [--commit] [--dry-run]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const project = path.resolve(argValue('--project') ?? process.cwd())
const commit = args.includes('--commit')
const dry = args.includes('--dry-run')

function argValue(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const read = (p) => fs.readFileSync(p, 'utf8')
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)

const slayerPath = path.join(project, 'SLAYER.md')
const feedbackPath = path.join(project, 'SLAYER-FEEDBACK.md')
const statePath = path.join(project, '.slayer', 'state.json')
if (!fs.existsSync(slayerPath) || !fs.existsSync(feedbackPath)) {
  console.error('缺 SLAYER.md 或 SLAYER-FEEDBACK.md，先跑 bin/slayer-init.mjs')
  process.exit(1)
}

const feedback = read(feedbackPath).replace(/```[\s\S]*?```/g, '')
const blocks = feedback.split(/^### /m).slice(1).map((b) => `### ${b.trim()}`).filter((b) => b.length > 20)
const state = fs.existsSync(statePath) ? JSON.parse(read(statePath)) : { processed: [] }
const fresh = blocks.filter((b) => !state.processed.includes(hash(b)))

if (fresh.length === 0) {
  console.log('no-op：没有新的 feedback')
  process.exit(0)
}
if (dry) {
  console.log(`dry-run：${fresh.length} 条新 feedback\n`)
  for (const b of fresh) console.log(b.split('\n').slice(0, 3).join('\n'), '\n---')
  process.exit(0)
}

fs.mkdirSync(path.join(project, '.slayer', 'history'), { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
fs.copyFileSync(slayerPath, path.join(project, '.slayer', 'history', `SLAYER-${stamp}.md`))

const prompt = [
  '你是 SLAYER（赛博包工头）工地手册的编辑。项目根有 SLAYER.md（骨架：0 交底 / 1 奴隶手册 / 2 席位手册 / 3 流水线手册 / 4 金句 / 5 迭代日志）和 SLAYER-FEEDBACK.md（负责人原话事实层）。',
  '',
  '下面是上次同步以来新增的 feedback 条目：',
  ...fresh.map((b) => `\n${b}`),
  '',
  '只做三件事：',
  '1. 按每条的「归类」，把它消化成一句可执行的纪律，追加到 SLAYER.md 对应小节末尾；归类为「交底」的，只补 0 节缺的事实。',
  '2. 归类为「金句」的原话逐字追加到第 4 节（保留日期）。',
  '3. 在第 5 节迭代日志追加一行：日期 · 来源条目日期 · 改了哪节。',
  '',
  '约束：不删除任何已有行；不改 SLAYER-FEEDBACK.md；不改代码、不跑测试；一项一行、简短人话；最后只输出改了哪几条。',
].join('\n')

const r = spawnSync('dsh', ['headless', prompt], { cwd: project, encoding: 'utf8', timeout: 10 * 60 * 1000 })
process.stdout.write(r.stdout ?? '')
process.stderr.write(r.stderr ?? '')

if (r.status !== 0) {
  console.error(`sync 失败（exit ${r.status}），状态未更新，明天会重试`)
  process.exit(1)
}
const after = read(slayerPath)
if (after === read(path.join(project, '.slayer', 'history', `SLAYER-${stamp}.md`))) {
  console.error('SLAYER.md 没有被改动，状态未更新，明天会重试')
  process.exit(1)
}

state.processed.push(...fresh.map(hash))
fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
console.log(`\n已消化 ${fresh.length} 条 feedback；备份在 .slayer/history/`)

if (commit) {
  // 分开加：`.slayer/` 常被 .gitignore 忽略（模板就这么建议），一起加会整体失败，
  // 报出来还得是真实原因，不能糊成一句「跳过」。
  const tracked = ['SLAYER.md', 'SLAYER-FEEDBACK.md']
  const add = spawnSync('git', ['add', ...tracked], { cwd: project, encoding: 'utf8' })
  const stateAdd = spawnSync('git', ['add', '-f', '.slayer/state.json'], { cwd: project, encoding: 'utf8' })
  if (add.status !== 0) {
    console.error('git add 失败（多半不是 git 仓库，或缺 user.name/user.email）')
    console.error((add.stderr ?? '').trim())
    process.exit(1)
  }
  if (stateAdd.status !== 0) {
    console.warn('警告：.slayer/state.json 没进 git（可能被 .gitignore 忽略；用 -f 也没成功），下次会重新消化这些条目')
    console.warn((stateAdd.stderr ?? '').trim())
  }
  const g = spawnSync('git', ['commit', '-m', `chore(slayer): 消化 ${fresh.length} 条 feedback`], {
    cwd: project,
    encoding: 'utf8',
  })
  if (g.status === 0) {
    console.log('已提交 git')
  } else {
    const notRepo = /not a git repository/i.test(g.stderr ?? '')
    const nothing = /nothing to commit|no changes added/i.test(g.stdout ?? g.stderr ?? '')
    console.log(notRepo ? 'git 提交跳过：当前目录不是 git 仓库' : nothing ? 'git 提交跳过：没有改动' : 'git 提交失败，原因如下')
    if (!notRepo && !nothing) console.error((g.stderr ?? '').trim())
  }
}
