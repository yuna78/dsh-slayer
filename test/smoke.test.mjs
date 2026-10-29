import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { apply, name as guardName } from '../mode.js';
import { FORBIDDEN, IDENTITY, publicPackageJson, scanText } from '../scripts/build-public-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const OLD_ID = ['baogong', 'tou'].join(''); // 旧标识符拆开拼，免得扫描自己
const patch = read('cordis.patch.yml');

/** 起一个假会话，把 mode.js 装进来的 guard 函数抓出来。 */
function grabGuard(config) {
  let created;
  const ctx = {
    on: (event, handler) => {
      if (event === 'agent/created') created = handler;
    },
    get: () => undefined,
  };
  apply(ctx, { autoBrief: false, ...config });

  const guards = [];
  const agent = { ctx: { tools: { guard: (fn) => guards.push(fn) }, get: () => undefined } };
  created({ agent });
  assert.equal(guards.length, 1, '会话创建时应装一个 guard');
  return guards[0];
}

test('mode.js 导出 guard 名 = slayer-guard', () => {
  assert.equal(guardName, 'slayer-guard');
  assert.equal(typeof apply, 'function');
});

test('dayrate：拦 spawn_teammate / team_task_*，并给出给模型看的理由', () => {
  const guard = grabGuard({ mode: 'dayrate' });
  for (const tool of ['spawn_teammate', 'team_task_create', 'team_task_list', 'wait_agent']) {
    const reason = guard({ name: tool });
    assert.equal(typeof reason, 'string', `${tool} 应该被拦`);
    assert.ok(reason.length > 4, `${tool} 的拒绝理由不能是空话`);
  }
  assert.equal(guard({ name: 'subagent' }), undefined, '日结奴的看家工具不能被拦');
  assert.equal(guard({ name: 'workflow' }), undefined);
  // 子 agent 工具：子 agent 是异步的，收中途汇报 / 追问 / 叫停都靠它们，日结奴必须能用。
  for (const tool of ['send_message', 'list_agents', 'interrupt_agent']) {
    assert.equal(guard({ name: tool }), undefined, `${tool} 是子 agent 工具，不该拦`);
  }
});

test('lifers：拦一次性点工，但放行 spawn_teammate', () => {
  const guard = grabGuard({ mode: 'lifers' });
  assert.equal(typeof guard({ name: 'subagent' }), 'string', '终身奴不派一次性点工');
  assert.equal(typeof guard({ name: 'subagent_fork' }), 'string');
  assert.equal(typeof guard({ name: 'workflow' }), 'string', '终身奴不能用一次性工作流绕过工位顶');
  assert.equal(guard({ name: 'spawn_teammate' }), undefined, '没有 maxTeammates 时不该拦建工位');
  assert.equal(guard({ name: 'team_task_create' }), undefined, '终身奴要用任务板');
});

test('guard 不吞未知工具 / 空模式', () => {
  const guard = grabGuard({ mode: 'dayrate' });
  assert.equal(guard({ name: 'read_file' }), undefined);
  assert.equal(guard({}), undefined);
  assert.equal(grabGuard({})({ name: 'spawn_teammate' }), undefined, '没配 mode 就只管人数，不拦工具');
});

test('cordis.patch.yml：两条 preset + 两处 guard', () => {
  for (const id of ['preset-slayer-lifers', 'preset-slayer-dayrate']) {
    assert.ok(patch.includes(id), `缺 ${id}`);
  }
  assert.equal((patch.match(/- id: slayer-guard/g) ?? []).length, 2, '两条 preset 各挂一个 guard');
  assert.match(patch, /name:\s*'dsh-plugin-slayer'/, 'guard 的模块名必须是包名');
  assert.ok(patch.includes('maxMembers: 9'), '实验性 Team 层编制 = 8 工位 + 1 包工头');
});

test('cordis.patch.yml：每条 preset 只装自己那套 mode', () => {
  const lifersAt = patch.indexOf('preset-slayer-lifers');
  const dayrateAt = patch.indexOf('preset-slayer-dayrate');
  const lifersMode = patch.indexOf('mode: lifers');
  const dayrateMode = patch.indexOf('mode: dayrate');
  assert.ok(lifersAt >= 0 && dayrateAt > lifersAt, 'preset 顺序不对');
  assert.ok(lifersMode > lifersAt && lifersMode < dayrateAt, 'mode: lifers 必须夹在第一条 preset 里');
  assert.ok(dayrateMode > dayrateAt, 'mode: dayrate 必须在第二条 preset 里');
  assert.equal(patch.indexOf('mode: lifers', lifersMode + 1), -1, 'mode: lifers 只能出现一次');
});

test('package.json：市场与安装契约全在', () => {
  assert.equal(pkg.name, 'dsh-plugin-slayer');
  assert.equal(pkg.version, '0.1.0');
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
  assert.match(pkg.engines.dsh, /-rc\./, 'engines.dsh 要含预发布比较符');
  assert.match(pkg.peerDependencies['@deepseek-ai/dsh'], /-rc\./, 'peer 范围要含预发布比较符');
  assert.equal(pkg.repository.url, 'git+https://github.com/yuna78/dsh-slayer.git');
  // 开发仓必须 private（防手滑 publish）；构建出的公开包相反。用 docs/dev 是否在判断仓形态。
  const isDevRepo = existsSync(join(ROOT, 'docs', 'dev'));
  assert.equal(pkg.private, isDevRepo, '开发仓 private: true；公开包 private: false');
  assert.deepEqual(Object.keys(pkg.bin).sort(), ['slayer-init', 'slayer-schedule', 'slayer-sync']);
});

test('files 白名单：门禁随包发，装完 npm run verify / npm test 能跑', () => {
  const files = pkg.files;
  // 早先为了包轻把门禁排除在 npm 包外，结果装完 `npm run verify` 是 MODULE_NOT_FOUND、
  // `npm test` 0 测试还 exit 0（假绿）。这两条脚本必须能在装好的包里跑，目录就得进包。
  for (const dir of ['verify/', 'test/', 'scripts/']) {
    assert.ok(files.includes(dir), `files 缺 ${dir}：装完 npm run verify / npm test 会是坏的或假绿`);
  }
  for (const entry of ['mode.js', 'cordis.patch.yml', 'docs/', 'README.md', 'bin/', 'template/', 'manuals/']) {
    assert.ok(files.includes(entry), `files 缺 ${entry}`);
  }
  // 反向：开发仓私货绝不能进包
  for (const forbidden of ['docs/dev/', 'SLAYER.md', '.github/', 'market/']) {
    assert.ok(!files.includes(forbidden), `${forbidden} 不该进 npm 包`);
  }
});

test('构建脚本 FORBIDDEN 命中本机路径与 token 样本', () => {
  const localPath = ['', 'Users', 'a', 'b'].join('/'); // 拼出来：本文件也在公开包里，会被自己的规则扫到
  const token = `ghp_${'A'.repeat(32)}`;
  const apiKey = `sk-${'b'.repeat(28)}`;
  const lan = ['192', '168', '1', '20'].join('.');

  assert.ok(scanText(`见 ${localPath} 目录`).some((hit) => hit.label === '本机绝对路径'));
  assert.ok(scanText(token).some((hit) => hit.label === 'GitHub token'));
  assert.ok(scanText(apiKey).some((hit) => hit.label === 'API key'));
  // 身份规则是运行时从 os / git config 取的，源码里不留明文；样本只能用运行时值造。
  if (IDENTITY.email) assert.ok(scanText(`联系 ${IDENTITY.email}`).some((hit) => hit.label === '个人邮箱'));
  if (IDENTITY.user) assert.ok(scanText(`在 ${IDENTITY.user} 名下`).some((hit) => hit.label === '本机用户名'));
  assert.ok(scanText(`内网 ${lan}`).some((hit) => hit.label.startsWith('内网地址')));
  assert.ok(scanText(`内网 ${['10', '0', '0', '7'].join('.')}`).length > 0);
  assert.ok(scanText(`内网 ${['172', '20', '3', '9'].join('.')}`).length > 0);
  assert.ok(scanText(`旧仓 见 dsh-${OLD_ID} 目录`).length > 0, '旧标识符要拦');
});

test('构建脚本 FORBIDDEN 不误伤 .slayer / slaver / 文档占位路径', () => {
  assert.deepEqual(scanText('.slayer/history/state.json'), [], '.slayer 是合法目录名');
  assert.deepEqual(scanText('SLAYER 不是 slaver 的缩写，是妥协'), [], 'README 讲命名梗要放行');
  assert.deepEqual(scanText('/Users/x/project/demo'), [], '/Users/x/ 是文档占位符');
  assert.deepEqual(scanText('版本 0.10.0.2 与 10 个工位'), [], '版本号不算内网地址');
  // 身份两条规则是运行时拼的（取不到就少一条），所以按「核心标签在不在」断言，不锁死长度。
  const labels = new Set(FORBIDDEN.map(([, label]) => label));
  for (const label of ['本机绝对路径', 'GitHub token', 'API key', '旧开发仓标识符']) {
    assert.ok(labels.has(label), `规则被删了要有人知道：缺 ${label}`);
  }
  assert.ok(FORBIDDEN.length >= 7, '规则表不能少于 7 条');
});

test('publicPackageJson 只翻 private，其余字段原样', () => {
  const out = publicPackageJson(ROOT);
  const dist = JSON.parse(out);
  assert.equal(dist.private, false);
  assert.equal(dist.name, pkg.name);
  assert.equal(dist.version, pkg.version);
  assert.deepEqual(dist.repository, pkg.repository);
  assert.deepEqual(dist.files, pkg.files);
  assert.ok(out.endsWith('\n'));
  assert.ok(!/"private": true/.test(out));
});

// ────────────────────────────────────────── 产能纪律（验机制，不验口音）
// persona 的写法会随着「奴隶主做派」这类调性改造重写，所以这里只锁机制与接口，
// 不锁形容词：改口号不该红，删机制、把判据换成软话才该红。

test('产能纪律不许写成软话，且必须有可判据的机制骨架', () => {
  const source = read('cordis.patch.yml');
  const start = source.indexOf('【产能纪律');
  const end = source.indexOf('【产能账', start);
  assert.ok(start > 0, '终身奴 persona 缺【产能纪律 段');
  assert.ok(end > start, '切不出产能纪律段（【产能纪律 → 【产能账 边界不对）');
  const block = source.slice(start, end);

  // 软措辞是模型最爱的退路：一句「尽量别空转」就把纪律变成背景音。
  // 注意「适当 / 尽可能 / 差不多」在奴隶主腔里会自然出现（适当加压 / 尽可能压满），不再当软话禁。
  for (const soft of ['尽量', '视情况', '酌情', '如果能', '能不动就不动']) {
    assert.ok(!block.includes(soft), `产能纪律里出现软措辞「${soft}」——模型会当背景音，必须写成可执行的判据`);
  }
  // 判据必须绑在工具上，否则「不许闲着」只是形容词
  assert.match(block, /spawn_teammate|team_task_create/, '纪律段没绑到任何派工工具，等于口号');
  assert.match(source.slice(start), /空席数\s*=/, '纪律/账目段没有账目字段（空席数=），空席无法计数');
  assert.match(block, /(reviewer|挑刺的)[^\n]{0,40}(只读|不动笔|不落文件)/, '缺只读工位豁免：模型会为了不空转逼挑刺的写文件');
  assert.match(block, /一轮|汇报周期|一次汇报/, '缺可判定的时间窗口（一轮 / 一个汇报周期）');
});

test('账目进两个汇报模板，人数顶理由与 mode.js 同源', () => {
  const source = read('cordis.patch.yml');

  // 两个 preset 的汇报模板里，【过去一小时】后 400 字内必须有账目字段 + 分母（不锁模板用词）
  const heads = [...source.matchAll(/【过去一小时】/g)].map((m) => m.index);
  assert.ok(heads.length >= 2, '两个 preset 都应该有【过去一小时】汇报模板');
  for (const at of heads) {
    const tail = source.slice(at, at + 400);
    assert.match(tail, /空席数\s*=/, '汇报模板缺账目字段（空席数=）');
    assert.match(tail, /\/\s*(8|3)(?!\d)/, '汇报模板缺在跑分母（/8 或 /3）');
  }

  // 日结奴：最多 3 个点工，且必须并行点满（换口气不改这条机制）
  const dayrate = source.slice(source.indexOf('preset-slayer-dayrate'));
  assert.match(dayrate, /\/\s*3(?!\d)/, '日结奴 persona 里找不到「/3」分母');
  assert.match(dayrate, /并行/, '日结奴 persona 丢了「并行点满」这条机制');

  // 人数顶：mode.js 是唯一真源，两本手册必须引用同一句，换口气只改 mode.js 一处
  const cap = Number((source.match(/maxMembers:\s*(\d+)/) || [])[1]) - 1;
  assert.ok(cap > 0, 'cordis.patch.yml 里找不到 maxMembers');
  const mjs = read('mode.js');
  const m = mjs.match(/本队 \$\{cap\} 个工位已满[^`]*/);
  assert.ok(m, 'mode.js 的人数顶拒绝理由被删了');
  const zh = `包工头：${m[0].replace('${cap}', String(cap))}`;
  for (const file of ['docs/manual.md', 'docs/manual.en.md']) {
    assert.ok(read(file).includes(zh), `${file} 里的人数顶理由与 mode.js 对不上：缺「${zh}」`);
  }
});
