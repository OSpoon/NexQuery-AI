import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { SubmitSqlTool } from '#services/tools/submit_sql_tool'
import { ClarifyIntentTool } from '#services/tools/clarify_intent_tool'
import { GetCurrentTimeTool } from '#services/tools/get_current_time_tool'
import { CORE_ASSISTANT_SKILL_PROMPT } from '#prompts/index'

export class CoreAssistantSkill extends BaseSkill {
  readonly name = 'CoreAssistant'
  readonly description = 'Fundamental interaction, contextual memory, and task submission'

  getSystemPrompt(context: SkillContext): string {
    return CORE_ASSISTANT_SKILL_PROMPT(context.dbType || 'mysql', context.dataSourceId)
  }

  getTools(_context: SkillContext) {
    return [
      new SubmitSqlTool(),
      new ClarifyIntentTool(),
      new GetCurrentTimeTool(),
    ]
  }
}
