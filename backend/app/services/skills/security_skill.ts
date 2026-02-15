import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { ValidateSqlTool } from '#services/tools/validate_sql_tool'
import { GET_SECURITY_SKILL_PROMPT } from '#prompts/index'

/**
 * Security Agent: 只做验证和提交，不做探测。
 * - ValidateSqlTool: 用 EXPLAIN 校验 SQL 语法
 * - RunQuerySampleTool: 已移除（会导致 Agent 越权探测）
 * - submit_sql_solution: 由 CoreAssistantSkill 提供
 */
export class SecuritySkill extends BaseSkill {
  readonly name = 'Security'
  readonly description = 'SQL safety verification and submission'

  getSystemPrompt(_context: SkillContext): string {
    return GET_SECURITY_SKILL_PROMPT()
  }

  getTools(_context: SkillContext) {
    return [
      new ValidateSqlTool(),
    ]
  }
}
