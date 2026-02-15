import type { ApplicationService } from '@adonisjs/core/types'
import { PromptService } from '#services/PromptService'

export default class PromptProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {}

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {
    // Preload prompts when the app starts
    await PromptService.preload()
  }

  /**
   * The process has been started
   */
  async ready() {}

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {}
}
