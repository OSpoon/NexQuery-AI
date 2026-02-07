import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { GetEsIndexSummaryTool } from '#services/tools/get_es_index_summary_tool'
import { GetEsFieldStatsTool } from '#services/tools/get_es_field_stats_tool'
import { LUCENE_SKILL_PROMPT } from '#prompts/index'

export class LuceneSkill extends BaseSkill {
  readonly name = 'Lucene'
  readonly description = 'Elasticsearch search and Lucene query generation'

  getSystemPrompt(_context: SkillContext): string {
    return LUCENE_SKILL_PROMPT
  }

  getTools(_context: SkillContext) {
    return [
      new GetEsIndexSummaryTool(),
      new GetEsFieldStatsTool(),
    ]
  }
}
