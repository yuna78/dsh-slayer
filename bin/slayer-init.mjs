#!/usr/bin/env node
// 工地初始化：把 SLAYER.md / SLAYER-FEEDBACK.md 骨架放进项目根（幂等，不覆盖已有文件）
// 用法：node bin/slayer-init.mjs --project <项目根> [--force]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const project = path.resolve(argValue('--project') ?? process.cwd())
const force = args.includes('--force')

function argValue(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

function copyTemplate(from, to) {
  if (fs.existsSync(to) && !force) return `skip ${path.basename(to)}（已存在）`
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  return `create ${path.basename(to)}`
}

fs.mkdirSync(path.join(project, '.slayer', 'history'), { recursive: true })
const lines = [
  copyTemplate(path.join(here, '..', 'template', 'SLAYER.md'), path.join(project, 'SLAYER.md')),
  copyTemplate(path.join(here, '..', 'template', 'SLAYER-FEEDBACK.md'), path.join(project, 'SLAYER-FEEDBACK.md')),
]
console.log(`工地：${project}`)
for (const l of lines) console.log(`  ${l}`)
console.log('下一步：填 SLAYER.md 第 0 节（交底），然后在干活时把负责人原话追加到 SLAYER-FEEDBACK.md')
