import type { HttpContext } from '@adonisjs/core/http'
import Prompt from '#models/prompt'
import { PromptService } from '#services/PromptService'

export default class PromptsController {
  /**
   * List all available prompts (Merged DB + File)
   */
  async index({ response }: HttpContext) {
    const keys = PromptService.getKeys()
    const dbPrompts = await Prompt.all()
    const dbMap = new Map(dbPrompts.map(p => [p.key, p]))

    const result = keys.map((key) => {
      const dbRecord = dbMap.get(key)
      const content = PromptService.getPromptSync(key)

      return {
        key,
        content, // Effective content (from Cache)
        description: dbRecord?.description || null,
        source: dbRecord ? 'database' : 'file',
        updatedAt: dbRecord?.updatedAt || null,
      }
    })

    return response.ok(result)
  }

  /**
   * Get a specific prompt
   */
  async show({ params, response }: HttpContext) {
    const key = params.key
    // Decode key if it was URL encoded
    // (Actually adonis router might handle / correctly if we use wildcard or just ensure clients don't encode slashes strangely)
    // For safety, users should request /prompts?key=... or use a safe ID interaction?
    // But RESTful is /prompts/:key.
    // If key contains '/', we might need `where('key', check)`.
    // Let's assume standard routing. If key has slashes, we need wildcard route in router.

    try {
      const content = PromptService.getPromptSync(key)
      if (content.startsWith('[ERROR')) {
        return response.notFound({ message: 'Prompt not found' })
      }

      const dbRecord = await Prompt.findBy('key', key)

      return response.ok({
        key,
        content,
        description: dbRecord?.description || null,
        source: dbRecord ? 'database' : 'file',
        updatedAt: dbRecord?.updatedAt || null,
      })
    } catch (error) {
      return response.notFound({ message: 'Prompt not found' })
    }
  }

  /**
   * Update or Create a prompt (Override)
   */
  async update({ params, request, response }: HttpContext) {
    const key = params.key
    const { content, description } = request.only(['content', 'description'])

    // 1. Persist to DB
    const prompt = await Prompt.updateOrCreate({ key }, { content, description })

    // 2. Update Cache (Hot Swapping)
    PromptService.updateCache(key, content)

    return response.ok({
      message: 'Prompt updated successfully',
      data: prompt,
    })
  }

  /**
   * Reset a prompt to Default (File)
   */
  async destroy({ params, response }: HttpContext) {
    const key = params.key

    // 1. Delete from DB
    await Prompt.query().where('key', key).delete()

    // 2. Reset Cache (Reload from File)
    const exists = await PromptService.reset(key)

    return response.ok({
      message: 'Prompt reset to default',
      existsInFile: exists,
    })
  }
}
