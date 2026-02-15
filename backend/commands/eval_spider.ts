import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import EvaluationService from '#services/evaluation_service'
import { DateTime } from 'luxon'

export default class EvalSpider extends BaseCommand {
  static commandName = 'eval:spider'
  static description = 'Run Spider dataset evaluation for Text-to-SQL agents'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({ description: 'Number of samples to evaluate', alias: 'l', default: 5 })
  declare limit: number

  @flags.number({ description: 'Offset from which to start sampling', alias: 'o', default: 0 })
  declare offset: number

  @flags.string({ description: 'Filter samples by database ID', alias: 'db' })
  declare db: string

  async run() {
    const evalService = new EvaluationService()
    const sampleLimit = this.limit
    const sampleOffset = this.offset
    const dbFilter = this.db

    this.logger.info(`Starting Spider evaluation (Limit: ${sampleLimit}, Offset: ${sampleOffset}${dbFilter ? `, DB: ${dbFilter}` : ''})...`)

    const samples = await evalService.loadSamples(sampleLimit, sampleOffset, dbFilter)
    if (samples.length === 0) {
      this.logger.error('No samples found. Please ensure dev.json exists in storage/eval/spider/')
      return
    }

    const results = []
    let correctCount = 0

    // Generate filename once
    const timestamp = DateTime.local().toFormat('yyyy-MM-dd\'T\'HH-mm-ss-SSS')
    const reportFileName = `spider_eval_${timestamp}.json`

    for (const [index, sample] of samples.entries()) {
      this.logger.info(`[${index + 1}/${samples.length}] Evaluating: "${sample.question}"`)
      const result = await evalService.evaluateSample(sample)
      results.push(result)

      if (result.isCorrect) {
        correctCount++
        this.logger.success('  Result: CORRECT')
      } else {
        this.logger.error(`  Result: FAILED (${result.error || 'SQL Mismatch'})`)
      }
      this.logger.info(`  [Expected]  : ${result.expectedSql}`)
      this.logger.info(`  [Generated] : ${result.generatedSql}`)
      this.logger.log('') // Add empty line between samples

      // Save progress incrementally
      await evalService.saveReport(results, reportFileName)
    }

    // Summary
    const accuracy = (correctCount / samples.length) * 100
    this.logger.info('\n--- Evaluation Summary ---')
    this.logger.info(`Total Samples: ${samples.length}`)
    this.logger.info(`Correct: ${correctCount}`)
    this.logger.info(`Accuracy: ${accuracy.toFixed(2)}%`)
    this.logger.info('--------------------------')

    // Save persistent report
    const reportPath = await evalService.saveReport(results, reportFileName)
    this.logger.success(`Report saved to: ${reportPath}`)
  }
}
