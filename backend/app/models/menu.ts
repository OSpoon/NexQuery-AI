import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Menu extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare parentId: number | null

  @column()
  declare title: string

  @column()
  declare path: string

  @column()
  declare icon: string | null

  @column()
  declare permission: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Menu, {
    foreignKey: 'parentId',
  })
  declare parent: BelongsTo<typeof Menu>

  @hasMany(() => Menu, {
    foreignKey: 'parentId',
  })
  declare children: HasMany<typeof Menu>
}
