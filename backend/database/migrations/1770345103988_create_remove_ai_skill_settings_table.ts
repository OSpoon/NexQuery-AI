import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'remove_ai_skill_settings'

  async up() {
    this.defer(async (db) => {
      await db.from('settings')
        .whereIn('key', [
          'ai_skill_discovery',
          'ai_skill_security',
          'ai_skill_core',
          'ai_skill_lucene',
        ])
        .delete()
    })
  }

  async down() {
    // No-op: We don't want to restore these legacy settings
  }
}
