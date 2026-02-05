import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { SearchTablesTool } from '#services/tools/search_tables_tool'
import { GetTableSchemaTool } from '#services/tools/get_table_schema_tool'
import { ListTablesTool } from '#services/tools/list_tables_tool'
import { SampleTableDataTool } from '#services/tools/sample_table_data_tool'
import { SearchColumnValuesTool } from '#services/tools/search_column_values_tool'
import { DISCOVERY_SKILL_PROMPT } from '#prompts/index'

export class DiscoverySkill extends BaseSkill {
  readonly name = 'Discovery'
  readonly description = 'Explore database schema and sample data'

  getSystemPrompt(_context: SkillContext): string {
    return DISCOVERY_SKILL_PROMPT
  }

  getTools(_context: SkillContext) {
    return [
      new SearchTablesTool(),
      new GetTableSchemaTool(),
      new ListTablesTool(),
      new SampleTableDataTool(),
      new SearchColumnValuesTool(),
    ]
  }
}
