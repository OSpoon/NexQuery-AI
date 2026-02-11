import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import DiscoveryService from '#services/discovery_service'

export class CrossEntitySearchTool extends StructuredTool {
  name = 'cross_entity_search'
  description = '全域关键字搜索。接受一个关键字（如人名、地名、具体业务 ID），在当前数据库所有表的文本字段中查找其所在位置（表名和字段名）。'

  schema = z.object({
    dataSourceId: z.number().describe('数据源 ID'),
    keyword: z.string().describe('要搜索的关键字'),
    limitPerTable: z.number().optional().default(3).describe('每张表返回的最大匹配数量'),
  })

  async _call({ dataSourceId, keyword, limitPerTable }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const results = await DiscoveryService.crossEntitySearch(dataSourceId, keyword, limitPerTable)
      if (results.length === 0) {
        return `在全库中未找到关于 "${keyword}" 的匹配项。`
      }
      return JSON.stringify(results)
    } catch (error: any) {
      return `全域搜索失败: ${error.message}`
    }
  }
}
