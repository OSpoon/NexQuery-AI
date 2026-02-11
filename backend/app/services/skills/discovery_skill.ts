import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { ListEntitiesTool } from '#services/tools/list_entities_tool'
import { GetEntitySchemaTool } from '#services/tools/get_entity_schema_tool'
import { SampleEntityDataTool } from '#services/tools/sample_entity_data_tool'
import { SearchEntitiesTool } from '#services/tools/search_entities_tool'
import { SearchFieldValuesTool } from '#services/tools/search_field_values_tool'
import { SearchRelatedKnowledgeTool } from '#services/tools/search_related_knowledge_tool'
import { GetEntityStatisticsTool } from '#services/tools/get_entity_statistics_tool'
import { RunQuerySampleTool } from '#services/tools/run_query_sample_tool'
import { GetDatabaseCompassTool } from '#services/tools/get_database_compass_tool'
import { FindJoinPathTool } from '#services/tools/find_join_path_tool'
import { CrossEntitySearchTool } from '#services/tools/cross_entity_search_tool'
import { DISCOVERY_PROMPT } from '#prompts/index'

export class DiscoverySkill extends BaseSkill {
  readonly name = 'Discovery'
  readonly description = 'Discover entities, schemas, and data structures in the database'

  constructor(private options: { lite?: boolean } = {}) {
    super()
  }

  getSystemPrompt(context: SkillContext): string {
    return DISCOVERY_PROMPT(context.dbType || 'mysql', '')
  }

  getTools(_context: SkillContext) {
    if (this.options.lite) {
      return [
        new GetEntitySchemaTool(),
        new SampleEntityDataTool(),
        new RunQuerySampleTool(),
      ]
    }
    return [
      new ListEntitiesTool(),
      new GetEntitySchemaTool(),
      new SearchEntitiesTool(),
      new SearchFieldValuesTool(),
      new SearchRelatedKnowledgeTool(),
      new SampleEntityDataTool(),
      new GetEntityStatisticsTool(),
      new RunQuerySampleTool(),
      new GetDatabaseCompassTool(),
      new FindJoinPathTool(),
      new CrossEntitySearchTool(),
    ]
  }
}
