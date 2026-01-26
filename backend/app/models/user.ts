import type { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, beforeSave, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import Role from '#models/role'
import PasswordHistory from '#models/password_history'

import { AccessToken as AccessTokenModel } from '#models/auth/access_token'

import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { AccessToken } from '@adonisjs/auth/access_tokens'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

const UserBase = compose(BaseModel, AuthFinder)

export default class User extends UserBase {
  static accessTokens = new DbAccessTokensProvider({
    tokenableModel: User,
  })

  // Direct relation for listing tokens
  @hasMany(() => AccessTokenModel, {
    foreignKey: 'tokenableId',
  })
  declare apiTokens: HasMany<typeof AccessTokenModel>

  declare currentAccessToken: AccessToken
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column()
  declare avatar: string | null

  @column({ consume: (value: any) => Boolean(value) })
  declare isActive: boolean

  @column()
  declare twoFactorSecret: string | null

  @column({ consume: (value: any) => Boolean(value) })
  declare twoFactorEnabled: boolean

  @column()
  declare twoFactorRecoveryCodes: string | null

  @column()
  declare wechatOpenid: string | null

  @column({ serializeAs: null })
  declare password: string

  @manyToMany(() => Role, {
    pivotTable: 'role_user',
  })
  declare roles: ManyToMany<typeof Role>

  async hasPermission(permissionSlug: string): Promise<boolean> {
    if (!this.roles) {
      await this.load('roles' as any)
    }

    for (const role of this.roles) {
      await role.load('permissions' as any)
      if (role.permissions.some(p => p.slug === permissionSlug)) {
        return true
      }
    }

    return false
  }

  @column.dateTime()
  declare lastPasswordChangeAt: DateTime | null

  @hasMany(() => PasswordHistory)
  declare passwordHistories: HasMany<typeof PasswordHistory>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @beforeSave()
  public static async hashUserPassword(user: User) {
    if (user.$dirty.password && user.password) {
      if (!user.password.startsWith('$scrypt$')) {
        user.password = await hash.make(user.password)
      }
    }
  }
}
