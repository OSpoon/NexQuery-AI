import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import DiscoveryService from '#services/discovery_service'

export class GetDatabaseCompassTool extends StructuredTool {
  name = 'get_database_compass'
  description = '获取当前数据库的全库外键拓扑图（罗盘）。返回所有表之间的关联路径，帮助你在多表关联查询时快速定位桥接表。'

  schema = z.object({
    dataSourceId: z.number().describe('数据源 ID'),
  })

  async _call({ dataSourceId }: z.infer<typeof this.schema>): Promise<string> {
    try {
      const fks = await DiscoveryService.getDatabaseCompass(dataSourceId)
      if (fks.length === 0) {
        return '当前数据库未定义外键关联关系。'
      }
      return JSON.stringify(fks)
    } catch (error: any) {
      return `获取全库罗盘失败: ${error.message}`
    }
  }
}
