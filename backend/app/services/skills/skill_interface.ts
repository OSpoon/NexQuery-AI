import type { BaseTool } from '@langchain/core/tools'

export interface SkillContext {
  dataSourceId?: number
  dbType: string
  userId?: number
  [key: string]: any
}

export abstract class BaseSkill {
  abstract readonly name: string
  abstract readonly description: string

  /**
   * Returns the system prompt segment for this skill
   */
  abstract getSystemPrompt(context: SkillContext): string

  /**
   * Returns the tools associated with this skill
   */
  abstract getTools(context: SkillContext): BaseTool[]
}
