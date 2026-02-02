import { BaseSkill, SkillContext } from '#services/skills/skill_interface'
import { SearchTablesTool } from '#services/tools/search_tables_tool'
import { GetTableSchemaTool } from '#services/tools/get_table_schema_tool'
import { ListTablesTool } from '#services/tools/list_tables_tool'
import { SampleTableDataTool } from '#services/tools/sample_table_data_tool'
import { SearchColumnValuesTool } from '#services/tools/search_column_values_tool'

export class DiscoverySkill extends BaseSkill {
  readonly name = 'Discovery'
  readonly description = 'Explore database schema and sample data'

  getSystemPrompt(_context: SkillContext): string {
    return `### 1. 数据发现预览 (Discovery Capabilities)
- **模糊搜索**: 通过 \`search_tables\` 快速定位相关表名及业务含义。
- **结构检查**: 锁定目标后，使用 \`get_table_schema\` 获取精确字段列表。
- **全量列表**: 使用 \`list_tables\` 浏览所有物理表。
- **抽样分析**: 遇到不确定的枚举值或状态码，务必使用 \`sample_table_data\` 观察真实内容。
- **值搜索**: 遇到具体的数值或名称查询，使用 \`search_column_values\` 检索索引数据。`
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
