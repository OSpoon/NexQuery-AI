import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { SearchTablesTool } from '#services/tools/search_tables_tool'
import { GetTableSchemaTool } from '#services/tools/get_table_schema_tool'
import { ListTablesTool } from '#services/tools/list_tables_tool'
import { SampleTableDataTool } from '#services/tools/sample_table_data_tool'
import { SearchColumnValuesTool } from '#services/tools/search_column_values_tool'
// ES Tools
import { ListEsIndicesTool } from '#services/tools/list_es_indices_tool'
import { GetEsMappingTool } from '#services/tools/get_es_mapping_tool'
import { SampleEsDataTool } from '#services/tools/sample_es_data_tool'
import { GetEsIndexSummaryTool } from '#services/tools/get_es_index_summary_tool'
import { GetEsFieldStatsTool } from '#services/tools/get_es_field_stats_tool'

import { DISCOVERY_SKILL_PROMPT, ES_DISCOVERY_SKILL_PROMPT } from '#prompts/index'

export class DiscoverySkill extends BaseSkill {
  readonly name = 'Discovery'
  readonly description = 'Explore database schema and sample data'

  getSystemPrompt(context: SkillContext): string {
    if (context.dbType === 'elasticsearch') {
      return ES_DISCOVERY_SKILL_PROMPT
    }
    return DISCOVERY_SKILL_PROMPT
  }

  getTools(context: SkillContext) {
    if (context.dbType === 'elasticsearch') {
      return [
        new ListEsIndicesTool(),
        new GetEsIndexSummaryTool(),
        new GetEsMappingTool(),
        new GetEsFieldStatsTool(),
        new SampleEsDataTool(),
      ]
    }

    return [
      new SearchTablesTool(),
      new GetTableSchemaTool(),
      new ListTablesTool(),
      new SampleTableDataTool(),
      new SearchColumnValuesTool(),
    ]
  }
}
