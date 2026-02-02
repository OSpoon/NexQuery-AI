import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { SubmitSqlTool } from '#services/tools/submit_sql_tool'
import { ClarifyIntentTool } from '#services/tools/clarify_intent_tool'
import { GetCurrentTimeTool } from '#services/tools/get_current_time_tool'

export class CoreAssistantSkill extends BaseSkill {
  readonly name = 'CoreAssistant'
  readonly description = 'Fundamental interaction, contextual memory, and task submission'

  getSystemPrompt(context: SkillContext): string {
    return `### 3. 多轮交互与任务准则 (Core Directives)
- **记忆溯源**: 仔细阅读 History。如果用户要求修改或优化上一步结果，请提取旧 SQL 并在其基础上按新需求增减逻辑，而非推倒重来。
- **反向询问 (Clarification)**: 当存在多种合理的业务理解时，**必须** 使用 \`clarify_intent\`。
- **正式交付**: 所有产出的 SQL 和业务描述必须通过 \`submit_sql_solution\` 封装提交，禁止直接输出 markdown 样式。
- **时间坐标**: 获取“近一周”、“今天”等参考系，调用 \`get_current_time\`。
- **数据库语境**: 当前环境为 ${context.dbType}，DataSourceID: ${context.dataSourceId}。`
  }

  getTools(_context: SkillContext) {
    return [
      new SubmitSqlTool(),
      new ClarifyIntentTool(),
      new GetCurrentTimeTool(),
    ]
  }
}
