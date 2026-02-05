import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { ValidateSqlTool } from '#services/tools/validate_sql_tool'
import { SECURITY_SKILL_PROMPT } from '#prompts/index'

export class SecuritySkill extends BaseSkill {
  readonly name = 'Security'
  readonly description = 'SQL safety verification and optimization auditing'

  getSystemPrompt(_context: SkillContext): string {
    return SECURITY_SKILL_PROMPT
  }

  getTools(_context: SkillContext) {
    return [new ValidateSqlTool()]
  }
}
