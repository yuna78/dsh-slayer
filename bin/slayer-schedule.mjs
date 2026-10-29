#!/usr/bin/env node
// 每天自动跑 slayer-sync：写一个 macOS LaunchAgent（默认 03:30）
// 用法：slayer-schedule [--project <项目根>] [--time HH:MM] [--remove] [--help]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const USAGE = `用法：slayer-schedule [选项]

  --project <dir>   要排程的项目根（默认：当前目录）
  --time HH:MM      每天几点跑（默认 03:30，24 小时制）
  --remove          移除本项目的排程
  -h, --help        只打印这段用法，不写任何文件

作用：在 ~/Library/LaunchAgents/ 写一个 LaunchAgent，每天定时跑
      slayer-sync --project <dir> --commit（把 SLAYER.md 的变化提交/落到 feedback）。
注意：只支持 macOS；Windows 请自己交给任务计划程序。`

function fail(message) {
  console.error(`slayer-schedule: ${message}`)
  console.error('')
  console.error(USAGE)
  process.exit(1)
}

// ── 参数白名单：先全量校验，再动手 ──
// 陌生人敲 `--help`、敲错旗标，都必须只看到用法然后退出，绝不落盘、绝不 launchctl load。
const argv = process.argv.slice(2)
const KNOWN = new Set(['--project', '--time', '--remove', '-h', '--help'])
const opts = { remove: false }
let wantsHelp = false

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (arg === '-h' || arg === '--help') {
    wantsHelp = true
    continue
  }
  const eq = arg.indexOf('=')
  const flag = eq > 0 ? arg.slice(0, eq) : arg
  if (!KNOWN.has(flag)) fail(`不认识的参数「${arg}」`)
  if (flag === '--remove') {
    opts.remove = true
    continue
  }
  const value = eq > 0 ? arg.slice(eq + 1) : argv[(i += 1)]
  if (value === undefined || value === '' || value.startsWith('-')) fail(`${flag} 需要一个值`)
  opts[flag.slice(2)] = value
}

if (wantsHelp) {
  console.log(USAGE)
  process.exit(0)
}
if (process.platform !== 'darwin') fail('只支持 macOS；Windows / Linux 请用系统自带的任务计划')

// ── 校验时间格式，再算路径 ──
const time = opts.time ?? '03:30'
const match = /^(\d{1,2}):(\d{2})$/.exec(time)
if (!match) fail(`--time 格式应为 HH:MM，收到「${time}」`)
const hour = Number(match[1])
const minute = Number(match[2])
if (hour > 23 || minute > 59) fail(`--time 超出范围，收到「${time}」`)

// realpath 再算 slug：/tmp/x 与 /private/tmp/x 是同一个目录，不归一化会生成两个 label，
// 于是 --remove 找不到自己排的那条（这就是上一版「报已移除、文件还在」的原因）。
const projectRaw = path.resolve(opts.project ?? process.cwd())
const project = fs.existsSync(projectRaw) ? fs.realpathSync(projectRaw) : projectRaw
const slug = project.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(-40)
const label = `com.slayer.sync.${slug}`
const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`)

if (opts.remove) {
  const existed = fs.existsSync(plistPath)
  const unload = spawnSync('launchctl', ['unload', plistPath], { encoding: 'utf8' })
  fs.rmSync(plistPath, { force: true })
  if (fs.existsSync(plistPath)) fail(`移除失败：${plistPath} 还在，请手动删除`)
  if (!existed) {
    console.log(`本项目没有排程（${plistPath} 不存在），无需移除`)
    process.exit(0)
  }
  if (unload.status !== 0) console.log(`提示：launchctl unload 返回非 0（${(unload.stderr || '').trim() || '无输出'}），文件已删，如需彻底卸掉可重启登录会话`)
  console.log(`已移除 ${label}`)
  console.log(`plist: ${plistPath}`)
  process.exit(0)
}

// 用 fileURLToPath 而不是 URL.pathname：后者会把路径里的空格编码成 %20，LaunchAgent 找不到脚本
const sync = path.join(path.dirname(fileURLToPath(import.meta.url)), 'slayer-sync.mjs')
if (!fs.existsSync(sync)) fail(`找不到 ${sync}（包不完整，请重装）`)
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${sync}</string>
    <string>--project</string><string>${project}</string>
    <string>--commit</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>
  <key>StandardOutPath</key><string>${path.join(project, '.slayer', 'sync.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(project, '.slayer', 'sync.err.log')}</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>`

fs.mkdirSync(path.join(os.homedir(), 'Library', 'LaunchAgents'), { recursive: true })
fs.mkdirSync(path.join(project, '.slayer'), { recursive: true })
fs.writeFileSync(plistPath, plist)
spawnSync('launchctl', ['unload', plistPath])
const r = spawnSync('launchctl', ['load', plistPath], { encoding: 'utf8' })
if (r.status !== 0) fail(`plist 已写入但 launchctl load 失败：${(r.stderr || r.stdout || '').trim()}`)
console.log(`已排程：每天 ${time} 同步 ${project}`)
console.log(`plist: ${plistPath}`)
