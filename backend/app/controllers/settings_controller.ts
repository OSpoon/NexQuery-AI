import type { HttpContext } from '@adonisjs/core/http'
import Setting from '#models/setting'
import env from '#start/env'
import { CryptoHelper } from '#services/crypto_helper'
import { AuditService } from '#services/audit_service'

export default class SettingsController {
  async index({ auth, response }: HttpContext) {
    try {
      await auth.check()
    } catch {
      // Ignore auth errors (invalid token etc) for public access
    }

    const settings = await Setting.all()
    const systemTimezone = env.get('TZ', 'UTC')

    // If not logged in, only return whitelisted non-sensitive settings
    if (!auth.isAuthenticated) {
      const whitelist = [
        'platform_name',
        'allow_export',
        'query_timeout_ms',
        'system_timezone',
        'show_watermark',
      ]
      const publicSettings = settings.filter(s => whitelist.includes(s.key))
      if (!publicSettings.find(s => s.key === 'system_timezone')) {
        publicSettings.push({ key: 'system_timezone', value: systemTimezone } as any)
      }
      return response.ok(publicSettings)
    }

    const serializedSettings = settings.map(s => s.serialize())
    if (!serializedSettings.find(s => s.key === 'system_timezone')) {
      serializedSettings.push({ key: 'system_timezone', value: systemTimezone })
    }

    // Encrypt sensitive keys if encryption is enabled
    try {
      const crypto = CryptoHelper.getInstance()

      for (const s of serializedSettings) {
        if (['ai_api_key'].includes(s.key) && s.value) {
          s.value = crypto.encrypt(s.value)
        }
      }
      return response.ok(serializedSettings)
    } catch {
      return response.ok(serializedSettings)
    }

    return response.ok(serializedSettings)
  }

  async updateMany({ request, response, auth }: HttpContext) {
    const { settings } = request.all() // Array of { key, value }
    const currentUser = auth.user!
    if (!currentUser.isAdmin) {
      return response.forbidden({ message: 'You do not have permission to perform this action' })
    }

    const crypto = CryptoHelper.getInstance()

    // Track changed keys for audit
    const changedKeys: string[] = []

    for (const item of settings) {
      // Decrypt sensitive keys before saving
      if (['ai_api_key'].includes(item.key) && crypto && item.value) {
        try {
          // It might be sent as encrypted string
          const decrypted = crypto.decrypt(item.value)
          if (decrypted !== null) {
            item.value = decrypted
          }
        } catch (e) {
          console.warn(`[SettingsController] Failed to decrypt ${item.key}`, e)
        }
      }

      const setting = await Setting.findBy('key', item.key)
      if (setting) {
        if (setting.value !== item.value) {
          setting.value = item.value
          await setting.save()
          changedKeys.push(item.key)
        }
      } else {
        await Setting.create(item)
        changedKeys.push(item.key)
      }
    }

    if (changedKeys.length > 0) {
      await AuditService.logAdminAction({ request, auth } as any, 'update_settings', {
        details: { keys: settings.map((s: any) => s.key) },
      })
    }

    return response.ok({ message: 'Settings updated successfully' })
  }
}
