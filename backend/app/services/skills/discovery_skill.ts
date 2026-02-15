import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { ListEntitiesTool } from '#services/tools/list_entities_tool'
import { GetEntitySchemaTool } from '#services/tools/get_entity_schema_tool'
import { SampleEntityDataTool } from '#services/tools/sample_entity_data_tool'
import { SearchEntitiesTool } from '#services/tools/search_entities_tool'
import { RunQuerySampleTool } from '#services/tools/run_query_sample_tool'
import { GetDatabaseCompassTool } from '#services/tools/get_database_compass_tool'
import { SaveBlueprintTool } from '#services/tools/save_blueprint_tool'
import { SearchRelatedKnowledgeTool } from '#services/tools/search_related_knowledge_tool'
import { DISCOVERY_PROTOCOL } from '#prompts/index'

export class DiscoverySkill extends BaseSkill {
  readonly name = 'Discovery'
  readonly description = 'Discover entities, schemas, and data structures in the database'

  constructor(private options: { lite?: boolean } = {}) {
    super()
  }

  getSystemPrompt(_context: SkillContext): string {
    return DISCOVERY_PROTOCOL()
  }

  getTools(_context: SkillContext) {
    if (this.options.lite) {
      return [
        new GetEntitySchemaTool(),
        new SampleEntityDataTool(),
        new RunQuerySampleTool(),
      ]
    }
    // P1-2: Streamlined tool set (12 -> 7)
    // Added back: search_related_knowledge for Few-shot RAG
    return [
      new ListEntitiesTool(),
      new GetEntitySchemaTool(),
      new SearchEntitiesTool(),
      new SampleEntityDataTool(),
      new GetDatabaseCompassTool(),
      new RunQuerySampleTool(),
      new SaveBlueprintTool(),
      new SearchRelatedKnowledgeTool(),
    ]
  }
}
