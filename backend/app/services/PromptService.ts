import fs from 'node:fs/promises'
import path from 'node:path'
import app from '@adonisjs/core/services/app'

interface PromptCache {
  [key: string]: string
}

export class PromptService {
  private static cache: PromptCache = {}
  private static promptsDir = app.makePath('resources/prompts')
  private static isDev = process.env.NODE_ENV === 'development'

  /**
   * Preload all prompts into cache.
   * Call this during application boot.
   */
  public static async preload() {
    // eslint-disable-next-line no-console
    console.log('[PromptService] Preloading prompts...')
    try {
      const files = await this.getAllPromptFiles(this.promptsDir)
      for (const file of files) {
        const relativePath = path.relative(this.promptsDir, file).replace(/\.md$/, '')
        const content = await fs.readFile(file, 'utf-8')
        this.cache[relativePath] = content
      }
      // eslint-disable-next-line no-console
      console.log(`[PromptService] Preloaded ${Object.keys(this.cache).length} prompts.`)
    } catch (error) {
      console.error('[PromptService] Preload failed', error)
    }
  }

  private static async getAllPromptFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...await this.getAllPromptFiles(fullPath))
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
    return files
  }

  /**
   * Get a prompt synchronously from cache.
   * Throws if prompt is missing (in prod) or tries to load sync (in dev/missing).
   * Note: In dev mode, if not cached, this might fail or return a placeholder if we can't do sync I/O.
   * Recommendation: Use `preload` even in dev for simplicity, or accept that `getPromptSync` relies on cache.
   */
  public static getPromptSync(promptPath: string, variables: Record<string, any> = {}): string {
    const content = this.cache[promptPath]
    if (!content) {
      if (this.isDev) {
        return `[PromptService] Prompt '${promptPath}' not loaded (Call preload() or use async getPrompt)`
      }
      return `[ERROR: Prompt '${promptPath}' not found in cache]`
    }
    return this.interpolate(content, variables)
  }

  /**
   * Load a prompt file and interpolate variables (Async).
   */
  public static async getPrompt(promptPath: string, variables: Record<string, any> = {}): Promise<string> {
    const fullPath = path.join(this.promptsDir, `${promptPath}.md`)
    let content: string

    if (this.isDev || !this.cache[promptPath]) {
      try {
        content = await fs.readFile(fullPath, 'utf-8')
        if (!this.isDev) {
          this.cache[promptPath] = content
        }
      } catch (error) {
        console.error(`[PromptService] Failed to load prompt: ${promptPath}`, error)
        return `[ERROR: Prompt ${promptPath} not found]`
      }
    } else {
      content = this.cache[promptPath]
    }

    return this.interpolate(content, variables)
  }

  /**
   * Simple mustache-style interpolation {{ key }}
   */
  private static interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`
    })
  }

  /**
   * Assemble multiple prompts into a single string.
   */
  public static async assemble(promptPaths: string[], separator = '\n'): Promise<string> {
    const parts = await Promise.all(promptPaths.map(p => this.getPrompt(p)))
    return parts.join(separator).trim()
  }
}
