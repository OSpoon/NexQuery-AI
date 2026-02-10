import fs from 'node:fs/promises'
import path from 'node:path'
import { createAgentGraph } from '#services/agents/graph'
import { HumanMessage } from '@langchain/core/messages'
import DbHelper from '#services/db_helper'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

export interface SpiderSample {
  db_id: string
  query: string
  question: string
  difficulty: string
}

export interface EvalResult {
  question: string
  expectedSql: string
  generatedSql: string
  isCorrect: boolean
  difficulty: string
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

    try {
      const inputs = {
        messages: [new HumanMessage(sample.question)],
        dbType: 'sqlite',
        dataSourceId: 9999, // 虚拟 ID，映射到当前的评测 SQLite 文件
      }

      const result = await graph.invoke(inputs)
      generatedSql = result.sql || ''

      if (!generatedSql) {
        errorMsg = 'Agent failed to generate SQL'
      }
    } catch (error: any) {
      errorMsg = error.message
    }

    // 2. Execution Accuracy (EX) directly on SQLite (Evaluation Path Only)
    let isCorrect = false
    if (generatedSql) {
      try {
        isCorrect = await this.compareResults(sample.query, generatedSql)
      } catch (error: any) {
        errorMsg = `Execution error: ${error.message}`
      }
    }

    return {
      question: sample.question,
      expectedSql: sample.query,
      generatedSql,
      isCorrect,
      difficulty: sample.difficulty || 'unknown',
      error: errorMsg,
    }
  }

  private async compareResults(expectedSql: string, generatedSql: string): Promise<boolean> {
    const { client } = await DbHelper.getRawConnection(9999)

    try {
      const expectedResults = await this.runQuery(client, expectedSql)
      const generatedResults = await this.runQuery(client, generatedSql)

      // Normalize results: convert each row to an array of its values, ignoring keys
      const normalize = (rows: any[]) => rows.map(row => Object.values(row).map(v => (v === null ? null : String(v))))

      const expectedNorm = normalize(expectedResults)
      const generatedNorm = normalize(generatedResults)

      return JSON.stringify(expectedNorm) === JSON.stringify(generatedNorm)
    } finally {
      client.close()
    }
  }

  async saveReport(results: EvalResult[]): Promise<string> {
    const reportsPath = path.join(this.spiderPath, 'reports')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `spider_eval_${timestamp}.json`
    const filePath = path.join(reportsPath, fileName)

    const summary = {
      timestamp: new Date().toISOString(),
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
