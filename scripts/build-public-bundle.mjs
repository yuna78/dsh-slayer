#!/usr/bin/env node
/**
 * dsh-plugin-slayer · 公开包构建（白名单 + 隐私硬门禁）
 *
 *   node scripts/build-public-bundle.mjs                  → dist/public
 *   node scripts/build-public-bundle.mjs --out /tmp/x     → 指定目录（CI 用）
 *
 * 产物是公开仓 yuna78/dsh-slayer 的内容，根目录就是 npm 包本体：
 *   cd dist/public && git status --short
 *
 * 规矩：
 *   1) 只复制白名单里的东西，缺一个就整体失败（防止「悄悄少了个文件」）。
 *   2) package.json 不直接复制，读本仓那份、把 private 翻成 false 再写（其余字段原样）。
 *   3) 重建时保留 dist/public/.git（发布历史在里面），先挪到 dist/.public-git-backup 再搬回。
 *   4) 复制完做隐私扫描，命中即 exit 1，列出文件 + 规则。
 *
 * 零依赖：只用 node 内置的 fs / path / url / os / child_process。
 */
import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 逐字复制的文件（package.json 例外，见 GENERATED）。 */
export const FILES = [
  'cordis.patch.yml',
  'mode.js',
  'README.md',
  'README.en.md',
  'CHANGELOG.md',
  'LICENSE',
  'SEATS.md',
  'SLAYER.template.md',
  '.gitignore',
];

/** 生成后写入的文件（不复制原件）。 */
export const GENERATED = ['package.json'];

/** 整棵复制的目录。 */
export const DIRS = ['bin', 'template', 'manuals', 'docs', 'market', 'release', 'verify', 'test', 'scripts', '.github'];

/** 目录里要整棵掐掉的子树（内部台账 / 开发过程记录，绝不进公开包）。 */
export const SKIP_TREE = new Set(['docs/dev', 'docs/log']);

/** 任何层级都不复制的目录名。 */
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git', '.cache', '__pycache__', 'coverage']);

/** 系统垃圾 / 本地临时文件。 */
const SKIP_FILE_NAMES = new Set(['.DS_Store']);
const SKIP_FILE_PATTERN = /(\.log|\.tmp|\.tgz|\.bak|\.swp|~)$/;

/** 扫的文本类型（含无后缀，如 bin/ 下的旧脚本）。 */
export const TEXT_EXTENSIONS = new Set(['.md', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.txt', '']);

// 本机身份（用户名 / 邮箱）运行时取，**不在源码里留明文**：
// 这个文件本身也会进公开仓，写死就等于把本机用户名直接公开；运行时取还能让任何
// 二次构建的人自动扫到「他自己的」身份。取不到就跳过那一条（规则表长度会变，测试按标签断言）。
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const IDENTITY = (() => {
  let user = '';
  try {
    user = (userInfo?.().username ?? '').trim();
  } catch {}
  let email = '';
  try {
    email = execFileSync('git', ['config', 'user.email'], {
      cwd: ROOT, // 注意：别用 new URL().pathname 取路径，含空格的目录会被编码成 %20
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {}
  return { user, email };
})();

/**
 * 公开产物里绝不允许出现的内容。
 * 注意：`slaver` 故意不做全仓硬拦 —— README 讲命名梗时会合法出现这个词。
 * `.slayer` 是合法目录名，也不拦；只拦旧开发仓标识符。
 */
export const FORBIDDEN = [
  [/\/Users\/(?!x\/|example\/)/, '本机绝对路径'],
  [/ghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/sk-[A-Za-z0-9_-]{20,}/, 'API key'],
  ...(IDENTITY.email ? [[new RegExp(escapeRe(IDENTITY.email), 'i'), '个人邮箱']] : []),
  ...(IDENTITY.user ? [[new RegExp(escapeRe(IDENTITY.user), 'i'), '本机用户名']] : []),
  // 拆开拼：这条规则本身也在公开包里，写全了就成「规则自己泄露自己」，而且行内的词边界会自屏蔽。
  [new RegExp(`\\b${['baogong', 'tou'].join('')}\\b`, 'i'), '旧开发仓标识符'],
  [/(?<![\d.])192\.168\.\d{1,3}\.\d{1,3}/, '内网地址 192.168.x.x'],
  [/(?<![\d.])10\.\d{1,3}\.\d{1,3}\.\d{1,3}/, '内网地址 10.x.x.x'],
  [/(?<![\d.])172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/, '内网地址 172.16-31.x.x'],
];

/** 对一段文本跑全部规则，返回命中列表（供 smoke / test 复用同一套口径）。 */
export function scanText(text) {
  const hits = [];
  for (const [pattern, label] of FORBIDDEN) {
    const match = pattern.exec(text);
    if (match) hits.push({ label, pattern: String(pattern), match: match[0] });
  }
  return hits;
}

/** 是不是可以直接跑的文本文件。 */
export function isTextFile(file) {
  return TEXT_EXTENSIONS.has(extname(file).toLowerCase());
}

function toPosix(path) {
  return path.split(sep).join('/');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function skippedTree(rel) {
  for (const skip of SKIP_TREE) {
    if (rel === skip || rel.startsWith(`${skip}/`)) return true;
  }
  return false;
}

function copyFile(src, dest, stats, rel) {
  if (SKIP_FILE_NAMES.has(relative(ROOT, src).split(sep).pop()) || SKIP_FILE_PATTERN.test(src)) return;
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  stats.files += 1;
  stats.bytes += statSync(src).size;
  stats.list.push(rel);
}

function copyTree(src, dest, stats, relBase) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const full = join(src, entry.name);
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name) || skippedTree(rel)) continue;
      copyTree(full, join(dest, entry.name), stats, rel);
      continue;
    }
    if (SKIP_FILE_NAMES.has(entry.name) || SKIP_FILE_PATTERN.test(entry.name)) continue;
    copyFile(full, join(dest, entry.name), stats, rel);
  }
}

/** 公开仓的 package.json：private 翻 false，其余字段原样（repository.url 是市场认领归属的依据）。 */
export function publicPackageJson(root = ROOT) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  pkg.private = false;
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/** 缺东西就一次列全，别让人一个个试。 */
function missingEntries(root) {
  const missing = [];
  for (const file of [...FILES, ...GENERATED]) {
    if (!existsSync(join(root, file))) missing.push(file);
  }
  for (const dir of DIRS) {
    if (!existsSync(join(root, dir))) missing.push(`${dir}/`);
  }
  return missing;
}

/** 两级目录树：顶层按名字排序，目录下列出孩子（子目录带斜杠）。 */
function printTree(outDir) {
  const levels = readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.name !== '.git')
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
  for (const entry of levels) {
    console.log(`    ${entry.name}${entry.isDirectory() ? '/' : ''}`);
    if (!entry.isDirectory()) continue;
    const children = readdirSync(join(outDir, entry.name), { withFileTypes: true })
      .filter((child) => child.name !== '.git')
      .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    const shown = children.map((child) => `${child.name}${child.isDirectory() ? '/' : ''}`);
    console.log(`      ${shown.join('  ')}`);
  }
}

/**
 * 构建。不打印、不 exit，方便测试直接调；CLI 外壳负责输出与退出码。
 * @returns {{out:string, files:number, bytes:number, violations:Array<{file:string,label:string,pattern:string,match:string}>}}
 */
export function buildPublicBundle({ root = ROOT, out = join(root, 'dist', 'public') } = {}) {
  const missing = missingEntries(root);
  if (missing.length > 0) {
    const error = new Error(`白名单里有 ${missing.length} 项不存在：${missing.join(', ')}`);
    error.missing = missing;
    throw error;
  }

  // 公开仓的 .git 是发布历史，重建时必须活下来。
  const gitDir = join(out, '.git');
  const gitBackup = join(dirname(out), '.public-git-backup');
  if (existsSync(gitDir)) {
    rmSync(gitBackup, { recursive: true, force: true });
    renameSync(gitDir, gitBackup);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const stats = { files: 0, bytes: 0, list: [] };
  try {
    for (const file of FILES) copyFile(join(root, file), join(out, file), stats, file);
    for (const dir of DIRS) copyTree(join(root, dir), join(out, dir), stats, dir);

    const pkgJson = publicPackageJson(root);
    writeFileSync(join(out, 'package.json'), pkgJson, 'utf8');
    stats.files += 1;
    stats.bytes += Buffer.byteLength(pkgJson);
    stats.list.push('package.json');
  } finally {
    if (existsSync(gitBackup)) renameSync(gitBackup, gitDir);
  }

  const violations = [];
  for (const full of walk(out)) {
    if (!isTextFile(full)) continue;
    const rel = toPosix(relative(out, full));
    for (const hit of scanText(readFileSync(full, 'utf8'))) violations.push({ file: rel, ...hit });
  }

  stats.list.sort((a, b) => a.localeCompare(b));
  return { out, files: stats.files, bytes: stats.bytes, list: stats.list, violations };
}

function main() {
  const outArg = process.argv.indexOf('--out');
  const out = outArg > 0 && process.argv[outArg + 1] ? resolve(process.argv[outArg + 1]) : join(ROOT, 'dist', 'public');
  const rel = toPosix(relative(ROOT, out));
  // 产物在仓外（CI 的 /tmp）就显绝对路径，别打一串 ../.. 让人猜。
  const shown = rel && !rel.startsWith('..') ? rel : out;

  let result;
  try {
    result = buildPublicBundle({ out });
  } catch (error) {
    console.error(`\n✗ 公开包构建失败：${error.message}`);
    if (error.missing) {
      console.error('  这些要么还没落盘，要么白名单写错了；公开包不补齐就不许发。');
    }
    process.exit(1);
  }

  const { files, bytes, list, violations } = result;
  console.log(`\n公开包：${shown}`);
  console.log('─'.repeat(64));
  console.log(`  文件 ${files} 个 / ${(bytes / 1024).toFixed(1)} KB`);
  console.log('  内容清单：');
  for (const rel of list) console.log(`    ${rel}`);

  if (violations.length > 0) {
    console.log('─'.repeat(64));
    console.log(`  隐私扫描：${violations.length} 处命中 ✗`);
    for (const violation of violations) {
      console.log(`  ✗ ${violation.file} ← ${violation.label}（${violation.pattern}）`);
    }
    console.log('\n先修掉再发布。');
    process.exit(1);
  }

  console.log('─'.repeat(64));
  console.log('  隐私扫描：0 命中 ✓');
  console.log('  目录树（两级）：');
  printTree(out);
  console.log(`\n下一步：cd ${shown} && git status --short`);
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
  } catch {
    return false;
  }
}

if (isMain()) main();
