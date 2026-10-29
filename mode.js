// SLAYER · 赛博包工头 · 工地模式插件（npm: dsh-plugin-slayer）
//
// 1) 自动交底：会话创建时，项目根若还没有 SLAYER.md，就从包里拷一份骨架过去。
// 2) 模式边界：DSH 的 Team 工具是 host 层插件（装不到 preset 作用域里，装进去也不注册工具），
//    所以两个模式共用同一套工具目录，用 guard 在调用时拦：终身奴不许点一次性工，日结奴不许建名册。
// 3) 人数硬顶：TeamService 是进程级单例，maxMembers 只能部署时定（本机 8），
//    preset 表达不了「这个模式 8 席」，只能在调用时拦。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'slayer-guard'

const pkgRoot = path.dirname(fileURLToPath(import.meta.url))

// 各模式禁止调用的委派工具（reject 文案就是给模型的理由，别只说“不行”）
// 键 = cordis.patch.yml 里 guard 的 config.mode（preset id: slayer-lifers / slayer-dayrate）
//
// 只拦「另一种形态独占」的工具，别按工具名字猜归属：
//   spawn_teammate / team_task_* / wait_agent  = Team 专属（@deepseek-ai/dsh-experimental-tool-agent-team）
//   subagent / subagent_fork / workflow        = 一次性点工
//   send_message / list_agents / interrupt_agent 是 @deepseek-ai/dsh-tool-subagent-control 的**子 agent 工具**，
//   两种形态都要用（子 agent 是异步的：要收它的中途汇报、要追问、要叫停，全靠这三个），所以谁都不拦。
const BLOCKED = {
  lifers: {
    subagent: '终身奴不派一次性点工；要人就用 spawn_teammate 建工位，写清职责与写作用域',
    'subagent_fork': '终身奴不派一次性点工；要人就用 spawn_teammate 建工位，写清职责与写作用域',
    workflow: '终身奴不铺一次性工作流（那也是点工）；要并行就用 spawn_teammate 建工位，写清职责与写作用域',
  },
  dayrate: {
    spawn_teammate: '日结奴不建名册；直接用 subagent 点工，干完就散',
    team_task_create: '日结奴不建任务板；任务写在交接文件里，别占 Team 的账',
    team_task_list: '日结奴不建任务板；任务写在交接文件里，别占 Team 的账',
    team_task_get: '日结奴不建任务板；任务写在交接文件里，别占 Team 的账',
    team_task_update: '日结奴不建任务板；任务写在交接文件里，别占 Team 的账',
    wait_agent: '日结奴没有长期工位；子 agent 收工会自动回一条结算消息，不用守',
  },
}

function looksLikeProject(cwd) {
  return ['.git', 'AGENTS.md', 'CLAUDE.md', 'package.json'].some((n) => fs.existsSync(path.join(cwd, n)))
}

async function sessionCwd(ctx, agent) {
  try {
    if (ctx?.workingDirectory?.ensure) return await ctx.workingDirectory.ensure(agent)
  } catch {}
  const guess = agent?.cwd ?? agent?.session?.header?.cwd ?? agent?.session?.cwd
  if (typeof guess === 'string' && guess.length > 0) {
    try {
      return fs.realpathSync(guess)
    } catch {
      return guess
    }
  }
  return undefined
}

async function ensureBrief(ctx, agent, autoBrief) {
  if (!autoBrief) return
  const cwd = await sessionCwd(ctx, agent)
  if (!cwd || !looksLikeProject(cwd)) return
  try {
    if (!fs.existsSync(path.join(cwd, 'SLAYER.md'))) {
      fs.copyFileSync(path.join(pkgRoot, 'template', 'SLAYER.md'), path.join(cwd, 'SLAYER.md'))
    }
    const feedback = path.join(cwd, 'SLAYER-FEEDBACK.md')
    if (!fs.existsSync(feedback)) {
      fs.copyFileSync(path.join(pkgRoot, 'template', 'SLAYER-FEEDBACK.md'), feedback)
    }
    fs.mkdirSync(path.join(cwd, '.slayer', 'history'), { recursive: true })
  } catch {
    // 只读目录 / 没权限：静默跳过，靠手册提示人工初始化
  }
}

export function apply(ctx, config = {}) {
  const mode = config.mode
  const cap = Number(config.maxTeammates)
  const autoBrief = config.autoBrief !== false

  ctx.on('agent/created', (payload) => {
    const agent = payload?.agent ?? payload
    void ensureBrief(ctx, agent, autoBrief)
    if (!agent?.ctx?.tools?.guard) return
    try {
      agent.ctx.tools.guard((exec) => {
        const tool = exec?.name
        if (!tool) return undefined

        const blocked = mode ? BLOCKED[mode]?.[tool] : undefined
        if (blocked) return blocked

        if (tool !== 'spawn_teammate' || !Number.isFinite(cap) || cap <= 0) return undefined
        let teams
        try {
          teams = agent.ctx.get?.('agentTeams') ?? ctx.get?.('agentTeams')
        } catch {
          return undefined
        }
        if (!teams?.listMembers) return undefined
        let count = 0
        try {
          const members = teams.listMembers(agent) ?? []
          count = members.filter((m) => m?.role === 'teammate').length
        } catch {
          return undefined
        }
        if (count >= cap) return `包工头：本队 ${cap} 个工位已满，等一个收工的再来，别硬塞`
        return undefined
      })
    } catch {
      // 老版本没有 agent 作用域 guard：静默退回「手册管人数」，不影响开工。
    }
  })
}
