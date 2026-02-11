import fs from 'node:fs/promises'
import path from 'node:path'
import { DateTime } from 'luxon'
import { createAgentGraph } from '#services/agents/graph'
import { HumanMessage } from '@langchain/core/messages'
import DbHelper from '#services/db_helper'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'
import AiProviderService from '#services/ai_provider_service'

export interface SpiderSample {
  db_id: string
  query: string
  question: string
}

export interface EvalResult {
  question: string
  expectedSql: string
  generatedSql: string
  isCorrect: boolean
  error?: string
}

/**
 * [EVALUATION ONLY]
 * This service is designed exclusively for evaluating agents against the Spider dataset using SQLite.
 */
export default class EvaluationService {
  private spiderPath = app.makePath('storage/eval/spider')

  async loadSamples(limit: number = 5, offset: number = 0, dbFilter?: string): Promise<SpiderSample[]> {
    const devPath = path.join(this.spiderPath, 'dev.json')
    try {
      const content = await fs.readFile(devPath, 'utf-8')
      let samples = JSON.parse(content) as SpiderSample[]

      if (dbFilter) {
        samples = samples.filter(s => s.db_id === dbFilter)
      }

      return samples.slice(offset, offset + limit)
    } catch (error) {
      logger.error({ error }, 'Failed to load Spider samples')
      return []
    }
  }

  async evaluateSample(sample: SpiderSample): Promise<EvalResult> {
    const sqlitePath = path.join(this.spiderPath, 'database', sample.db_id, `${sample.db_id}.sqlite`)

    // 设置评测路径，以便智能体工具能访问到当前 SQLite
    DbHelper.setEvaluationPath(sqlitePath)

    // 1. Run Agent Graph to generate SQL
    const graph = createAgentGraph()
    let generatedSql = ''
    let errorMsg = ''
    let isCorrect = false

    try {
      // Get Langfuse Trace Handler
      const aiProvider = new AiProviderService()
      const traceHandler = aiProvider.getLangfuseHandler({
        tags: ['spider_evaluation', sample.db_id],
        metadata: {
          db_id: sample.db_id,
          question: sample.question,
        },
      })

      const inputs = {
        messages: [new HumanMessage(sample.question)],
        dbType: 'sqlite',
        dataSourceId: 9999, // 虚拟 ID，映射到当前的评测 SQLite 文件
      }

      const result = await graph.invoke(inputs, { callbacks: [traceHandler] })
      generatedSql = (result.sql || '').trim()

      if (generatedSql) {
        isCorrect = await this.compareResults(sample.query, generatedSql)
      } else {
        errorMsg = `Agent failed to generate SQL${result.error ? `: ${result.error}` : ''}`
      }
    } catch (error: any) {
      errorMsg = generatedSql ? `Execution error: ${error.message}` : error.message
    }

    return {
      question: sample.question,
      expectedSql: sample.query,
      generatedSql,
      isCorrect,
      error: errorMsg,
    }
  }

  private async compareResults(expectedSql: string, generatedSql: string): Promise<boolean> {
    const { client } = await DbHelper.getRawConnection(9999)

    try {
      const expectedResults = await this.runQuery(client, expectedSql)
      const generatedResults = await this.runQuery(client, generatedSql)

      // Normalize results:
      // 1. Convert each row to an array of its values, ignoring keys
      // 2. Sort values within each row to be column-order independent
      // 3. Sort the rows themselves to be row-order independent
      const normalize = (rows: any[]) =>
        rows
          .map(row =>
            Object.values(row)
              .map(v => (v === null ? 'NULL' : String(v)))
              .sort(), // Column order independent
          )
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) // Row order independent

      const expectedNorm = normalize(expectedResults)
      const generatedNorm = normalize(generatedResults)

      return JSON.stringify(expectedNorm) === JSON.stringify(generatedNorm)
    } finally {
      client.close()
    }
  }

  async saveReport(results: EvalResult[]): Promise<string> {
    const reportsPath = path.join(this.spiderPath, 'reports')
    const now = DateTime.local()
    const timestamp = now.toFormat('yyyy-MM-dd\'T\'HH-mm-ss-SSS')
    const fileName = `spider_eval_${timestamp}.json`
    const filePath = path.join(reportsPath, fileName)

    const summary = {
      timestamp: now.toISO(),
      total: results.length,
      correct: results.filter(r => r.isCorrect).length,
      accuracy: `${((results.filter(r => r.isCorrect).length / results.length) * 100).toFixed(2)}%`,
      results,
    }

    await fs.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8')
    return filePath
  }

  private runQuery(client: any, sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      client.all(sql, [], (err: any, rows: any[]) => {
        if (err)
          reject(err)
        else resolve(rows)
      })
    })
  }
}
