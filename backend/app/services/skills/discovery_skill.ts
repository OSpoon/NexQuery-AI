import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { ListEntitiesTool } from '#services/tools/list_entities_tool'
import { GetEntitySchemaTool } from '#services/tools/get_entity_schema_tool'
import { SampleEntityDataTool } from '#services/tools/sample_entity_data_tool'
import { SearchTablesTool } from '#services/tools/search_tables_tool'
import { DISCOVERY_PROMPT } from '#prompts/index'

export class DiscoverySkill extends BaseSkill {
  readonly name = 'Discovery'
  readonly description = 'Discover entities, schemas, and data structures in the database'

  getSystemPrompt(context: SkillContext): string {
    return DISCOVERY_PROMPT(context.dbType || 'mysql', '')
  }

  getTools(_context: SkillContext) {
    return [
      new ListEntitiesTool(),
      new GetEntitySchemaTool(),
      new SearchTablesTool(),
      new SampleEntityDataTool(),
    ]
  }
}
