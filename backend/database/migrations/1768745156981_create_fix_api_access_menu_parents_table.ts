import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  /**
   * This migration was originally intended for a data fix but accidentally created an empty table.
   * The table has been manually removed to keep the database clean.
   */
  async up() {}

  async down() {}
}
