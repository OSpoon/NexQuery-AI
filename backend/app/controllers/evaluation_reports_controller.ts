import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import path from 'node:path'

export default class EvaluationReportsController {
  private reportsPath = app.makePath('storage/eval/spider/reports')

  /**
   * List all evaluation reports
   */
  async index({ response }: HttpContext) {
    try {
      if (!(await this.ensureDirectory())) {
        return response.ok([])
      }

      const files = await fs.readdir(this.reportsPath)
      const reports = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async (f) => {
            try {
              const content = await fs.readFile(path.join(this.reportsPath, f), 'utf-8')
              const data = JSON.parse(content)
              return {
                fileName: f,
                timestamp: data.timestamp,
                total: data.total,
                correct: data.correct,
                accuracy: data.accuracy,
              }
            } catch (e) {
              return null
            }
          }),
      )

      const filteredReports = reports.filter(r => r !== null)
      return response.ok(
        filteredReports.sort((a, b) => new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime()),
      )
    } catch (error) {
      return response.ok([])
    }
  }

  /**
   * Get details of a specific report
   */
  async show({ params, response }: HttpContext) {
    const fileName = params.filename
    const filePath = path.join(this.reportsPath, fileName)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return response.ok(JSON.parse(content))
    } catch (error) {
      return response.notFound({ message: 'Report not found' })
    }
  }

  /**
   * Get summary of all reports for trend visualization
   */
  async summary({ response }: HttpContext) {
    try {
      if (!(await this.ensureDirectory())) {
        return response.ok([])
      }

      const files = await fs.readdir(this.reportsPath)
      const summaries = await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(async (f) => {
            try {
              const content = await fs.readFile(path.join(this.reportsPath, f), 'utf-8')
              const data = JSON.parse(content)
              return {
                date: data.timestamp,
                accuracy: Number.parseFloat(data.accuracy),
                total: data.total,
              }
            } catch (e) {
              return null
            }
          }),
      )

      const filteredSummaries = summaries.filter(s => s !== null)
      return response.ok(
        filteredSummaries.sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime()),
      )
    } catch (error) {
      return response.ok([])
    }
  }

  private async ensureDirectory() {
    try {
      await fs.access(this.reportsPath)
      return true
    } catch {
      return false
    }
  }
}
