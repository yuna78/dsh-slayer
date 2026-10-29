#!/usr/bin/env node
/**
 * dsh-plugin-slayer · 冒烟自检（零依赖、不联网、不开浏览器、秒级）
 *
 *   node verify/smoke.mjs
 *
 * 10 项，任何一项 FAIL → exit 1：
 *   1) package.json 契约（名字 / 版本 / 许可 / dsh.bundle / 预发布范围 / repository / files / bin）
 *   2) cordis.patch.yml（两条 preset、两处 guard、两个 mode、maxMembers: 9、无旧标识符）
 *   3) mode.js（guard id、BLOCKED 两个键、拦的是哪套工具、语法）
 *   4) bin/ 三个脚本（语法 + 空格路径坑：fileURLToPath 而不是 URL.pathname）
 *   5) 文档齐不齐 + README 里每个相对链接是不是真文件（死链 = FAIL）
 *   6) 隐私：白名单文本文件跑构建脚本同款规则，0 命中
 *   7) 版本一致：README 顶栏 / CHANGELOG 首节 / release/0.1.0.md 都是 0.1.0
 *   8) 可选：dist/public/package.json 存在就确认 private=false
 *   9) 产能纪律在 persona 里、位置对、两句逐字口径跨文件一致（改软/漏改会红）
 *  10) 全仓「鼓励空转」的旧原话清零（删不干净会红）
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  DIRS,
  FILES,
  SKIP_TREE,
  isTextFile,
  scanText,
} from '../scripts/build-public-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const exists = (path) => existsSync(join(ROOT, path));

// 旧开发仓标识符拆开拼：本文件也在公开包里，会被自己的扫描规则扫到。
const OLD_ID = ['baogong', 'tou'].join('');

// 装在用户项目里的 npm 包没有仓库专属目录（market/、release/、.github/、docs/dev/），
// 那几项检查要能优雅跳过——否则用户装完 `npm run verify` 反而看到红，等于门禁自伤。
const IN_REPO = existsSync(join(ROOT, '.github')) || existsSync(join(ROOT, 'market'));

const results = [];
let failed = 0;

/** 跑一项检查；fn 返回失败原因数组（空 = 通过）。抛错也算失败。 */
function check(id, title, fn) {
  let problems;
  try {
    problems = fn() ?? [];
  } catch (error) {
    problems = [`检查本身炸了：${error.message}`];
  }
  if (problems.length === 0) {
    results.push({ id, title, problems });
    console.log(`✓ ${id} ${title}`);
    return;
  }
  failed += 1;
  results.push({ id, title, problems });
  console.log(`✗ ${id} ${title}`);
  for (const problem of problems) console.log(`    - ${problem}`);
}

function walkAll(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full, out);
    else out.push(full);
  }
  return out;
}

function nodeCheck(relPath) {
  const result = spawnSync(process.execPath, ['--check', relPath], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? null : `${relPath} 语法错误：${(result.stderr || '').trim().split('\n').slice(0, 3).join(' ')}`;
}

function section(text, from, to) {
  const start = text.indexOf(from);
  if (start < 0) return '';
  const end = to ? text.indexOf(to, start + from.length) : -1;
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

// ───────────────────────────────────────────── 1. package.json 契约
check(1, 'package.json 契约', () => {
  const problems = [];
  const pkg = JSON.parse(read('package.json'));

  if (pkg.name !== 'dsh-plugin-slayer') problems.push(`name 应为 dsh-plugin-slayer，实际 ${pkg.name}`);
  if (pkg.version !== '0.1.0') problems.push(`version 应为 0.1.0，实际 ${pkg.version}`);
  if (pkg.license !== 'MIT') problems.push(`license 应为 MIT，实际 ${pkg.license}`);

  const patch = pkg.dsh?.bundle?.patch;
  if (!patch) problems.push('缺 dsh.bundle.patch（市场会判「不可安装」）');
  else if (!exists(patch)) problems.push(`dsh.bundle.patch 指向的文件不存在：${patch}`);

  for (const [label, range] of [
    ['engines.dsh', pkg.engines?.dsh],
    ['peerDependencies["@deepseek-ai/dsh"]', pkg.peerDependencies?.['@deepseek-ai/dsh']],
  ]) {
    if (!range) problems.push(`缺 ${label}`);
    else if (!range.includes('-rc.')) problems.push(`${label} 不含预发布比较符 -rc.：${range}`);
  }

  const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (!repoUrl || !/github\.com[/:]yuna78\/dsh-slayer(\.git)?$/.test(repoUrl.replace(/^git\+/, ''))) {
    problems.push(`repository.url 必须指向 github.com/yuna78/dsh-slayer（市场靠它认 npm 归属）：${repoUrl}`);
  }

  const files = pkg.files;
  if (!Array.isArray(files) || files.length === 0) problems.push('缺 files 白名单');
  else {
    // 门禁随包发：早先为了「包要轻」把 verify/test/scripts 排除在 npm 包外，
    // 结果装完 `npm run verify` 直接 MODULE_NOT_FOUND、`npm test` 0 测试还 exit 0（假绿）。
    // 现在它们必须进包，`npm run verify` / `npm test` 装完就能跑。
    for (const needed of ['verify/', 'test/', 'scripts/']) {
      if (!files.includes(needed)) problems.push(`files 白名单必须含 ${needed}（否则装完 npm run verify / npm test 是坏的或假绿）`);
    }
    for (const entry of files) {
      if (!exists(entry.replace(/\/$/, ''))) problems.push(`files 白名单里的 ${entry} 不存在`);
    }
  }

  const bin = pkg.bin ?? {};
  const bins = ['slayer-init', 'slayer-sync', 'slayer-schedule'];
  for (const name of bins) {
    if (!bin[name]) problems.push(`bin 缺命令 ${name}`);
    else if (!exists(bin[name])) problems.push(`bin.${name} 指向的 ${bin[name]} 不存在`);
  }

  if (!pkg.scripts?.test || !pkg.scripts?.verify) problems.push('缺 scripts.test / scripts.verify（CI 靠它两个）');

  return problems;
});

// ────────────────────────────────────── 2. cordis.patch.yml 装配契约
check(2, 'cordis.patch.yml 两条 preset + guard', () => {
  const problems = [];
  const patch = read('cordis.patch.yml');

  for (const marker of ['preset-slayer-lifers', 'preset-slayer-dayrate', 'mode: lifers', 'mode: dayrate', 'maxMembers: 9']) {
    if (!patch.includes(marker)) problems.push(`缺 ${marker}`);
  }
  if (!/name:\s*'dsh-plugin-slayer'/.test(patch)) problems.push("缺 name: 'dsh-plugin-slayer'（guard 模块要靠它加载 mode.js）");

  const guards = patch.match(/- id: slayer-guard/g) ?? [];
  if (guards.length !== 2) problems.push(`slayer-guard 应出现 2 次（两条 preset 各一），实际 ${guards.length}`);

  if (patch.includes(OLD_ID)) problems.push(`还残留旧标识符 ${OLD_ID}（改名没改干净）`);

  return problems;
});

// ─────────────────────────────────────────────────── 3. mode.js guard
check(3, 'mode.js guard 拦截映射', () => {
  const problems = [];
  const source = read('mode.js');

  if (!/export const name = 'slayer-guard'/.test(source)) problems.push("导出 name 必须是 'slayer-guard'");

  const lifers = section(source, 'lifers:', 'dayrate:');
  const dayrate = section(source, 'dayrate:', '\n}');
  if (!lifers) problems.push('BLOCKED 缺 lifers 键');
  if (!dayrate) problems.push('BLOCKED 缺 dayrate 键');

  // 看的是「这个键在不在拦截表里」，不是文本里提没提到（拒绝理由里会写工具名当引导语）。
  const keyRe = (tool) => new RegExp(`^\\s+['"]?${tool}['"]?\\s*:`, 'm'); // 键可能带引号（subagent_fork 这种）
  if (keyRe('spawn_teammate').test(lifers)) problems.push('lifers 里不该拦 spawn_teammate（终身奴就靠它建工位）');
  for (const tool of ['subagent', 'subagent_fork', 'workflow']) {
    if (!keyRe(tool).test(lifers)) {
      problems.push(`lifers 应拦 ${tool}（终身奴不派一次性点工，workflow 也是点工）`);
    }
  }
  for (const tool of ['spawn_teammate', 'team_task_create']) {
    if (!keyRe(tool).test(dayrate)) {
      problems.push(`dayrate 应拦 ${tool}（日结奴不建名册 / 任务板）`);
    }
  }
  // 子 agent 工具（subagent-control 提供）：两种形态都要用，谁都不许拦。
  // 子 agent 是异步的——收中途汇报、追问、叫停全靠这三个。拦了日结奴就收不了工。
  for (const tool of ['send_message', 'list_agents', 'interrupt_agent']) {
    const re = keyRe(tool);
    if (re.test(dayrate)) problems.push(`dayrate 不该拦 ${tool}（子 agent 工具，日结奴要靠它收回工与追问）`);
    if (re.test(lifers)) problems.push(`lifers 不该拦 ${tool}（子 agent 工具，工位之间要靠它对话）`);
  }
  if (!/agent\/created/.test(source)) problems.push('没挂 agent/created，会话起来时不会装 guard');

  const syntax = nodeCheck('mode.js');
  if (syntax) problems.push(syntax);

  return problems;
});

// ─────────────────────────────────────────────── 4. bin/ 三个 CLI 脚本
check(4, 'bin/ 三个脚本可执行 + 空格路径', () => {
  const problems = [];
  for (const file of ['bin/slayer-init.mjs', 'bin/slayer-sync.mjs', 'bin/slayer-schedule.mjs']) {
    const syntax = nodeCheck(file);
    if (syntax) problems.push(syntax);
  }
  const schedule = read('bin/slayer-schedule.mjs');
  if (!schedule.includes('fileURLToPath')) {
    problems.push('slayer-schedule.mjs 没用 fileURLToPath（路径含空格时 LaunchAgent 会找不到脚本）');
  }
  if (/new URL\([^)]*\)\.pathname/.test(schedule)) {
    problems.push('slayer-schedule.mjs 还在用 new URL(...).pathname（空格会被编码成 %20）');
  }
  return problems;
});

// ──────────────────────────────────────────────────── 5. 文档与死链
check(5, '文档齐全 + README 无死链', () => {
  const problems = [];
  const required = [
    'README.md',
    'README.en.md',
    'CHANGELOG.md',
    'LICENSE',
    'docs/install.md',
    'docs/install.en.md',
    'docs/manual.md',
    'docs/manual.en.md',
    'docs/compat.md',
  ];
  if (IN_REPO) required.push('market/yuna78__dsh-slayer.yml');
  for (const file of required) {
    if (!exists(file)) problems.push(`缺 ${file}`);
  }

  for (const readme of ['README.md', 'README.en.md']) {
    if (!exists(readme)) continue;
    const text = read(readme);
    const targets = new Set();
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1].split('#')[0].trim();
      if (!target || /^(https?:|mailto:|#|\/)/.test(target)) continue;
      targets.add(target.replace(/^\.\//, ''));
    }
    for (const match of text.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/gi)) {
      const target = match[1].split('#')[0].trim();
      if (!target || /^(https?:|data:)/.test(target)) continue;
      targets.add(target.replace(/^\.\//, ''));
    }
    for (const target of targets) {
      if (!exists(target)) problems.push(`${readme} 链接指向不存在的文件：${target}`);
    }
  }

  return problems;
});

// ──────────────────────────────────────────────────── 6. 隐私硬门禁
check(6, '隐私扫描 0 命中', () => {
  const problems = [];
  const targets = [];
  for (const file of [...FILES, 'package.json']) if (exists(file)) targets.push(file);
  for (const dir of DIRS) {
    if (!exists(dir)) continue;
    for (const full of walkAll(join(ROOT, dir))) {
      const rel = relative(ROOT, full).split('\\').join('/');
      if ([...SKIP_TREE].some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue;
      if (statSync(full).size > 512 * 1024) continue;
      targets.push(rel);
    }
  }

  let scanned = 0;
  for (const file of targets) {
    if (!isTextFile(file)) continue;
    scanned += 1;
    for (const hit of scanText(read(file))) {
      problems.push(`${file} 命中「${hit.label}」：${hit.match}`);
    }
  }
  console.log(`    扫了 ${scanned} 个文本文件`);
  return problems;
});

// ──────────────────────────────────────────────────── 7. 版本一致性
check(7, '版本一致：README / CHANGELOG / release', () => {
  const problems = [];
  const version = JSON.parse(read('package.json')).version;

  if (exists('README.md')) {
    const top = read('README.md').split('\n').slice(0, 6).join('\n');
    if (!top.includes(version)) problems.push(`README.md 顶栏（前 6 行）没有 ${version}`);
  }
  if (exists('CHANGELOG.md')) {
    const changelog = read('CHANGELOG.md');
    const firstSection = changelog.slice(0, changelog.indexOf('## ', changelog.indexOf('## ') + 1));
    if (!firstSection.includes(version)) problems.push(`CHANGELOG.md 首节没有 ${version}`);
  }
  const notes = `release/${version}.md`;
  if (IN_REPO) {
    if (!exists(notes)) problems.push(`缺 ${notes}`);
    else if (!read(notes).includes(version)) problems.push(`${notes} 里没有 ${version}`);
  } else {
    console.log('    装在 npm 包里（无 release/ 与 market/），跳过仓库专属文件');
  }

  return problems;
});

// ────────────────────────── 9. 产能纪律（结构 / 机制 / 契约，不验口音）
// 断言分层：接口层锁「不可改的接口名」；机制层锁工具名 / 分母 / 账目字段；口音层永不进断言。
// 换口气（改形容词、改口号、改比喻）不该红；删机制必红。
check(9, '产能纪律：结构标记、机制锚点、账目契约', () => {
  const problems = [];
  const patch = read('cordis.patch.yml');
  const lifers = section(patch, 'preset-slayer-lifers', 'preset-slayer-dayrate');
  const dayrate = section(patch, 'preset-slayer-dayrate', '\n}');
  if (!lifers) return ['切不出终身奴 preset 段落（preset-slayer-lifers → preset-slayer-dayrate）'];
  if (!dayrate) problems.push('切不出日结奴 preset 段落（preset-slayer-dayrate → 末尾）');

  const TARGETS = ['planner', 'impl-core', 'impl-pipe', 'impl-detail', 'impl-fix', 'impl-ui', 'reviewer', 'closer'];
  const TEMPLATE_FIELDS = ['【过去一小时】', '【卡住待领主】', '【发现与记录】', '【提效决定】'];
  const SYNC_ZH = '空席数=';
  const SYNC_EN = 'idle_seats=';

  // 9.1 结构标记：只锁前缀，后缀（·硬性 / ·日结奴 / 换腔调后的新后缀）随便改
  for (const marker of ['【产能纪律', '【产能账']) {
    if (!new RegExp(`^\\s*-\\s*${marker}`, 'm').test(lifers)) {
      problems.push(`终身奴 persona 缺独立一条「- ${marker}…」——被删了，或写成了散文`);
    }
  }
  // 顺序判据只用结构标记，不用会被改写的标题
  const capAt = lifers.indexOf('【产能纪律');
  const ledgerAt = lifers.indexOf('【产能账');
  const firstReportAt = lifers.indexOf('【过去一小时】');
  if (!(capAt >= 0 && ledgerAt > capAt)) problems.push('【产能账 应该在【产能纪律 之后（账是纪律的落点）');
  if (!(firstReportAt > ledgerAt)) problems.push('汇报模板应该在【产能账 之后（账必须落进模板）');

  // 日结奴：有自己的产能纪律段；不许出现 Team 层工具（guard 会拦，写进去只会教模型硬试）
  if (!/【产能纪律/.test(dayrate)) problems.push('日结奴 persona 缺「【产能纪律」段');
  if (/spawn_teammate/.test(dayrate)) problems.push('日结奴 persona 里出现 spawn_teammate——guard 会拦，写进去只会教模型硬试');
  if (/工位名字固定/.test(dayrate)) problems.push('日结奴 persona 里不该有「工位名字固定」——日结奴没有工位');
  if (/impl-core/.test(dayrate)) problems.push('日结奴 persona 里不该出现工位 target（impl-core 之类）');

  // 9.1b 工位定义归终身奴独有（绑 target 机制，不绑文案）
  for (const target of TARGETS) if (!lifers.includes(target)) problems.push(`终身奴 persona 缺工位 target「${target}」`);

  // 9.2 机制锚点：工具名 / 分母 / 账目字段——换口气不会动这些
  for (const [label, re] of [
    ['建工位工具 spawn_teammate', /spawn_teammate/],
    ['任务板 team_task_create', /team_task_create/],
    ['交接口 send_message', /send_message/],
    ['等待工具 wait_agent', /wait_agent/],
    ['账目字段 空席数=', /空席数\s*=/],
    ['工位分母 /8', /\/\s*8(?!\d)/],
    ['只读工位豁免（reviewer 不算空席）', /(reviewer|挑刺的)[^\n]{0,40}(只读|不动笔|不落文件)/],
  ]) if (!re.test(lifers)) problems.push(`终身奴 persona 缺机制锚点「${label}」`);

  for (const [label, re] of [
    ['一次性点工 subagent', /\bsubagent\b/],
    ['点工分母 /3', /\/\s*3(?!\d)/],
    ['账目字段 空席数=', /空席数\s*=/],
  ]) if (!re.test(dayrate)) problems.push(`日结奴 persona 缺机制锚点「${label}」`);

  // 9.2b 汇报模板字段是硬接口，账必须落进【过去一小时】
  for (const field of TEMPLATE_FIELDS) if (!patch.includes(field)) problems.push(`persona 缺汇报模板字段「${field}」`);
  const heads = [...patch.matchAll(/【过去一小时】/g)].map((m) => m.index);
  if (heads.length < 2) problems.push('两个 preset 都应该有【过去一小时】汇报模板');
  for (const at of heads) {
    const tail = patch.slice(at, at + 400);
    if (!/空席数\s*=/.test(tail)) problems.push('【过去一小时】后 400 字内没有账目字段（空席数=）——账没进模板');
    if (!/\/\s*\d/.test(tail)) problems.push('【过去一小时】后 400 字内没有「在跑 x/y」的分母');
  }

  // 9.3 契约 token 跨文件同源（只锁 token，不锁句子）
  for (const file of ['cordis.patch.yml', 'manuals/SLAYER-LIFERS.md', 'docs/manual.md', 'SEATS.md', 'template/SLAYER.md', 'README.md']) {
    if (!exists(file)) { problems.push(`缺 ${file}`); continue; }
    if (!read(file).includes(SYNC_ZH)) problems.push(`${file} 缺产能契约 token「${SYNC_ZH}」——同源口径漂了`);
  }
  for (const file of ['docs/manual.en.md', 'README.en.md']) {
    if (!exists(file)) { problems.push(`缺 ${file}`); continue; }
    if (!read(file).includes(SYNC_EN)) problems.push(`${file} 缺英文契约 token「${SYNC_EN}」`);
  }
  return problems;
});

// ──────────────────────────────────── 10. 「鼓励空转」的旧原话清零
check(10, '旧空转授权清零（不许待命/按活挑/不许自己找活）', () => {
  const problems = [];
  // 这些句子本身就是「让工位闲着」的授权，留着等于把新纪律对冲掉。
  // 用正则而不是逐字：换腔调后会写出「让它待命」「先歇着」「等活上门」这类变体，逐字匹配会漏。
  const banned = [
    [/叫它待命|让它待命|让工位待命|叫工位待命/, '叫它待命'],
    [/不用自己找活|不必自己找活|不许自己找活/, '不许自己找活'],
    [/按活挑|挑活派|挑着派/, '按活挑'],
    [/不是每个都在/, '不是每个都在'],
    [/单人能干(得)?完的活别砌墙/, '单人能干完的活别砌墙'],
    [/stand by and not to find work/i, 'stand by and not to find work'],
    [/Pick seats per job/i, 'Pick seats per job'],
    [/清场的不算产能/, '清场的不算产能'],
    // 新腔调特有陷阱：奴隶主味儿不等于允许空闲，这三句等于放羊
    [/先歇着|歇着也(行|没事)/, '先歇着'],
    [/等活(来|上门)/, '等活上门'],
    [/(闲|空)着也(行|没事|不算错)/, '闲着也行'],
  ];
  // 否定句豁免：「不许让它待命」「不准等活上门」是合规写法
  const negated = /不许|不准|禁止|严禁|别再|不能|别拿/;
  // CHANGELOG / release 是历史记录，允许引用旧口径（讲"修了什么"）。
  const targets = [];
  for (const file of [...FILES, 'package.json']) if (exists(file) && file !== '.gitignore' && !file.endsWith('.gitignore')) targets.push(file);
  for (const dir of DIRS) {
    if (!exists(dir)) continue;
    for (const full of walkAll(join(ROOT, dir))) {
      const rel = relative(ROOT, full).split('\\').join('/');
      if ([...SKIP_TREE].some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue;
      if (rel === 'CHANGELOG.md' || rel.startsWith('release/') || rel.startsWith('docs/log/')) continue;
      if (rel === 'verify/smoke.mjs') continue; // 禁用短语表就写在本文件里，跳过自己（自指）
      if (statSync(full).size > 512 * 1024) continue;
      targets.push(rel);
    }
  }
  for (const file of targets) {
    if (!isTextFile(file)) continue;
    const text = read(file);
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      for (const [re, phrase] of banned) {
        if (re.test(line) && !negated.test(line)) problems.push(`${file}:${index + 1} 还留着「${phrase}」——模型会照着这句让工位待命`);
      }
    });
  }
  return problems;
});

// ──────────────────────────────────────── 8. 公开包产物（可选，不算失败）
check(8, '公开包产物 private=false（可选）', () => {
  const publicPkg = join(ROOT, 'dist', 'public', 'package.json');
  if (!existsSync(publicPkg)) {
    console.log('    未构建 dist/public，跳过');
    return [];
  }
  const pkg = JSON.parse(readFileSync(publicPkg, 'utf8'));
  if (pkg.private !== false) return [`dist/public/package.json 的 private 应为 false，实际 ${pkg.private}`];
  console.log('    public bundle: private=false ✓');
  return [];
});

// ────────────────────────── 11. 图标：DSH 插件卡片与市场索引都要能读到
// DSH 的插件卡片读 package.json 根 icon（相对路径、≤256 KiB、需导出 ./package.json），
// 市场索引读 awesome-dsh-plugin 条目的 icon（GitHub 托管的 180×180 位图）。
check(11, '图标：插件卡片 icon + 市场条目 icon', () => {
  const problems = [];
  const pkg = JSON.parse(read('package.json'));
  const icon = pkg.icon;
  const ICON_MAX = 256 * 1024;

  if (typeof icon !== 'string' || icon === '') problems.push('package.json 缺 icon 字段（DSH 插件卡片会退化成默认图）');
  else {
    if (isAbsolute(icon)) problems.push(`icon 必须是相对路径（DSH 要求相对 manifest 目录）：${icon}`);
    if (!/\.(svg|png|jpe?g|webp)$/i.test(icon)) problems.push(`icon 只认 svg/png/jpeg/webp：${icon}`);
    if (!exists(icon)) problems.push(`icon 指向的文件不存在：${icon}`);
    else {
      const size = statSync(join(ROOT, icon)).size;
      if (size > ICON_MAX) problems.push(`icon 超过 256 KiB（${size} 字节），DSH 会拒收并退化成默认图`);
      console.log(`    icon: ${icon}（${size} 字节）`);
    }
  }
  const iconInFiles = (pkg.files ?? []).some((entry) => entry.replace(/^\.\//, '') === icon.replace(/^\.\//, ''));
  if (!iconInFiles) problems.push(`files 白名单必须含 ${icon}，否则 npm 包里没图`);
  if (!pkg.exports?.['./package.json']) problems.push('exports 必须导出 ./package.json，否则 DSH 读不到 icon（静默失效）');
  // npm 包只带矢量图标与市场用的 180 位图：banner / 社交预览体积大，只在仓库里给 GitHub 用
  if (!pkg.files?.includes('assets/icon-180.png')) problems.push('files 白名单必须含 assets/icon-180.png（市场条目 icon 指它）');
  if ((pkg.files ?? []).some((entry) => /^assets\/(banner|social-preview|icon-1024)/.test(entry))) {
    problems.push('大图（banner / social-preview / icon-1024）不该进 npm 包，仓库里给 GitHub 用即可');
  }

  // 市场条目：icon 必须是 GitHub 托管的绝对网址，指到 180×180 位图
  const marketYml = 'market/yuna78__dsh-slayer.yml';
  if (exists(marketYml)) {
    const text = read(marketYml);
    const m = /^icon:\s*(\S+)\s*$/m.exec(text);
    if (!m) problems.push(`${marketYml} 缺 icon:（市场卡片会没有图）`);
    else if (!/^https:\/\/raw\.githubusercontent\.com\/yuna78\/dsh-slayer\//.test(m[1])) {
      problems.push(`市场 icon 必须指向本仓托管的绝对网址：${m[1]}`);
    } else if (!/180/.test(m[1])) problems.push(`市场 icon 建议 180×180 位图：${m[1]}`);
    if (/icon/i.test(text) && /^\s*icon:.*\n.*\n.*icon:/m.test(text)) problems.push(`${marketYml} 里 icon 只能出现一次`);
  }

  return problems;
});

// ─────────────────────────────────────────────────────────────── 汇总
const total = results.length;
console.log('─'.repeat(64));
if (failed > 0) {
  console.log(`smoke: ${total - failed}/${total} 通过（FAIL ${failed}）`);
  process.exit(1);
}
console.log(`smoke: ${total}/${total} 通过`);
