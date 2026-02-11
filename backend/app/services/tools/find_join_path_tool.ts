import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import DiscoveryService from '#services/discovery_service'

export class FindJoinPathTool extends StructuredTool {
  name = 'find_join_path'
  description = '给定起始表和目标表，基于数据库外键关系自动计算最短关联路径，并生成相应的 JOIN SQL 片段。适用于 3 张及以上表级联的复杂场景。'

  schema = z.object({
    dataSourceId: z.number().describe('数据源 ID'),
    startTable: z.string().describe('起始表名'),
    endTable: z.string().describe('目标表名'),
  })

  async _call({ dataSourceId, startTable, endTable }: z.infer<typeof this.schema>): Promise<string> {
    try {
      return await DiscoveryService.findJoinPath(dataSourceId, startTable, endTable)
    } catch (error: any) {
      return `路径发现失败: ${error.message}`
    }
  }
}
