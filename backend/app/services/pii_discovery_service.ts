import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import logger from '@adonisjs/core/services/logger'

import AiProviderService from '#services/ai_provider_service'
import DataSource from '#models/data_source'
import { PII_DISCOVERY_SYSTEM_PROMPT } from '#prompts/index'

export interface PiiFieldConfig {
  name: string
  masking: {
    type: string
  }
}

export interface PiiTableConfig {
  table: string
  fields: PiiFieldConfig[]
}

export default class PiiDiscoveryService {
  private async getModel() {
    const aiProvider = new AiProviderService()
    return aiProvider.getChatModel({ temperature: 0.1 })
  }

  /**
   * Analyze schema to discover PII fields
   */
  public async discover(schema: any[]): Promise<PiiTableConfig[]> {
    try {
      const model = await this.getModel()

      const systemPrompt = PII_DISCOVERY_SYSTEM_PROMPT

      // Prepare a condensed version of schema to save tokens
      const condensedSchema = schema.map(t => ({
        table: t.name,
        columns: t.columns.map((c: any) => ({ name: c.name, comment: c.comment })),
      }))

      // Custom retry loop with backoff for 429 Concurrency errors
      let response
      let attempts = 0
      const maxAttempts = 5

      while (attempts < maxAttempts) {
        try {
          response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(`Identify PII in this schema:\n${JSON.stringify(condensedSchema)}`),
          ])
          break // Success
        } catch (err: any) {
          attempts++
          // Check for 429 or concurrency error
          if (
            (err?.status === 429 || err?.message?.includes('429') || err?.error?.code === '1302')
            && attempts < maxAttempts
          ) {
            const delay = 2 ** attempts * 2000 // 4s, 8s, 16s, 32s...
            logger.warn(`[PiiDiscovery] Rate limit hit (Attempt ${attempts}/${maxAttempts}). Retrying in ${delay}ms...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          throw err // Re-throw other errors immediately
        }
      }

      if (!response) {
        throw new Error('PII Discovery failed after max retries')
      }

      let content = response.content as string
      // Clean up markdown block if present
      content = content.replace(/```json/g, '').replace(/```/g, '').trim()

      const discovered = JSON.parse(content) as PiiTableConfig[]

      logger.info({ dataSourceId: (schema as any).dataSourceId, tablesFound: discovered.length }, 'PII Discovery completed successfully')
      return discovered
    } catch (e) {
      logger.error({ error: e, stack: e.stack }, 'PII Discovery failed')
      return []
    }
  }

  /**
   * Merges discovery results into a DataSource's advanced_config
   */
  public async mergeDiscoveryResults(ds: DataSource, piiConfig: any[]) {
    // 1. Merge with existing advanced_config
    const currentConfig = ds.config || {}
    const advancedConfig = (currentConfig.advanced_config || []).map((t: any) => ({
      table: t.table || t.tableName, // compatibility
      fields: t.fields || [],
    }))

    for (const tableRule of piiConfig) {
      let existingTable = advancedConfig.find((t: any) => t.table === tableRule.table)
      if (!existingTable) {
        existingTable = { table: tableRule.table, fields: [] }
        advancedConfig.push(existingTable)
      }

      // Merge fields
      for (const field of tableRule.fields) {
        const existingField = existingTable.fields.find((f: any) => f.name === field.name)
        if (existingField) {
          // Only update if no manual masking is set or if it's 'none'
          if (!existingField.masking || existingField.masking.type === 'none') {
            existingField.masking = field.masking
            existingField.isAuto = true
          }
        } else {
          existingTable.fields.push({ ...field, isAuto: true })
        }
      }
    }

    ds.config = {
      ...currentConfig,
      advanced_config: advancedConfig,
    }

    await ds.save()
    logger.info({ dataSourceId: ds.id, tablesDiscovered: piiConfig.length }, 'PII discovery applied to advanced_config')
  }
}
