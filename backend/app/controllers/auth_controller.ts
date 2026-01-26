import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import { verify } from 'otplib'
import { DateTime } from 'luxon'
import { CryptoService } from '@nexquery/shared'
import env from '#start/env'
import { passwordValidator } from '#validators/password'
import AuditLog from '#models/audit_log'
import { isInternalIP } from '../utils/ip_utils.js'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const { fullName, email, password } = request.all()

    // Check if user exists
    const existingUser = await User.findBy('email', email)
    if (existingUser) {
      return response.badRequest({ message: 'User already exists' })
    }

    const user = await User.create({
      fullName,
      email,
      password,
      isActive: false, // Default to inactive
    })

    logger.info({ userId: user.id, email: user.email }, 'User registered successfully')

    // Audit Log for Registration
    await AuditLog.create({
      userId: user.id,
      action: 'auth:register',
      entityType: 'user',
      entityId: String(user.id),
      status: 'success',
      details: { email, fullName },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.created({ message: 'Registration successful. Please wait for admin approval.' })
  }

  async login({ request, response }: HttpContext) {
    const { email, password } = request.all()
    const user = await User.findBy('email', email)

    if (!user) {
      await AuditLog.create({
        action: 'auth:login_failed',
        status: 'failure',
        details: { reason: 'User not found', email },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    if (!user.isActive) {
      await AuditLog.create({
        userId: user.id,
        action: 'auth:login_failed',
        status: 'failure',
        details: { reason: 'Account inactive' },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })
      return response.unauthorized({ message: 'Your account is pending approval.' })
    }

    const isValid = await hash.verify(user.password, password)
    if (!isValid) {
      await AuditLog.create({
        userId: user.id,
        action: 'auth:login_failed',
        status: 'failure',
        details: { reason: 'Invalid password' },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    // --- Expired Check ---
    let requiresPasswordChange = false
    if (user.lastPasswordChangeAt) {
      const daysSinceChange = DateTime.now().diff(user.lastPasswordChangeAt, 'days').days
      if (daysSinceChange > 90) {
        requiresPasswordChange = true
      }
    }

    // --- 2FA Check ---
    if (user.twoFactorEnabled) {
      // Return a temporary token (encrypted user ID)
      const key = env.get('API_ENCRYPTION_KEY')
      if (key) {
        const crypto = new CryptoService(key)
        const tempToken = crypto.encrypt({
          userId: user.id,
          type: '2fa_pending',
          timestamp: Date.now(),
        })

        // Audit Log for 2FA Challenge
        await AuditLog.create({
          userId: user.id,
          action: 'auth:2fa_challenge',
          status: 'success',
          ipAddress: request.ip(),
          userAgent: request.header('user-agent'),
          isInternalIp: isInternalIP(request.ip()),
        })

        return response.ok({
          requiresTwoFactor: true,
          tempToken,
        })
      }
    }

    const token = await User.accessTokens.create(user, ['*'], {
      expiresIn: '24h',
    })

    logger.info({ userId: user.id, email: user.email }, 'User logged in successfully')

    await AuditLog.create({
      userId: user.id,
      action: 'auth:login',
      status: 'success',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.ok({
      token: token.value?.release(),
      requiresPasswordChange,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
        lastPasswordChangeAt: user.lastPasswordChangeAt?.toISO(),
        createdAt: user.createdAt.toISO(),
        isWechatBound: !!user.wechatOpenid,
      },
    })
  }

  async verify2fa({ request, response }: HttpContext) {
    const { tempToken, code } = request.all()

    if (!tempToken || !code) {
      return response.badRequest({ message: 'Missing token or code' })
    }

    const key = env.get('API_ENCRYPTION_KEY')
    if (!key) {
      return response.internalServerError({ message: 'Encryption not configured' })
    }

    const crypto = new CryptoService(key)
    const payload = crypto.decrypt(tempToken)

    if (!payload || !payload.userId || payload.type !== '2fa_pending') {
      return response.unauthorized({ message: 'Invalid session' })
    }

    // Check expiration (e.g. 5 minutes)
    if (Date.now() - payload.timestamp > 5 * 60 * 1000) {
      return response.unauthorized({ message: 'Session expired' })
    }

    const user = await User.find(payload.userId)
    if (!user) {
      return response.unauthorized({ message: 'User not found' })
    }

    // Verify TOTP
    if (!user.twoFactorSecret) {
      return response.badRequest({ message: '2FA not set up for this user' })
    }

    // authenticator.verify returns boolean
    const { valid } = await verify({ token: code, secret: user.twoFactorSecret })
    const isValid = valid

    // Also support checking recovery codes
    let isRecovery = false
    if (!isValid && user.twoFactorRecoveryCodes) {
      const recoveryCodes = JSON.parse(user.twoFactorRecoveryCodes) as string[]
      if (recoveryCodes.includes(code)) {
        isRecovery = true
        // Remove used code
        user.twoFactorRecoveryCodes = JSON.stringify(recoveryCodes.filter(c => c !== code))
        await user.save()
      }
    }

    if (!isValid && !isRecovery) {
      await AuditLog.create({
        userId: user.id,
        action: 'auth:2fa_verify_failed',
        status: 'failure',
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })
      return response.unauthorized({ message: 'Invalid 2FA code' })
    }

    // Success - generate real token
    const token = await User.accessTokens.create(user, ['*'], {
      expiresIn: '24h',
    })

    logger.info({ userId: user.id, email: user.email }, 'User logged in with 2FA successfully')

    await AuditLog.create({
      userId: user.id,
      action: 'auth:login_2fa',
      status: 'success',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.ok({
      token: token.value?.release(),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISO(),
        isWechatBound: !!user.wechatOpenid,
      },
    })
  }

  async me({ auth, response }: HttpContext) {
    const user = auth.user!
    await user.load('roles', (loader) => {
      loader.preload('permissions')
    })

    // Consolidate permissions
    const permissions = new Set<string>()
    user.roles.forEach((role) => {
      role.permissions.forEach((permission) => {
        permissions.add(permission.slug)
      })
    })

    return response.ok({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
        lastPasswordChangeAt: user.lastPasswordChangeAt?.toISO(),
        createdAt: user.createdAt.toISO(),
        isWechatBound: !!user.wechatOpenid,
      },
      permissions: Array.from(permissions),
      roles: user.roles.map(r => r.slug),
    })
  }

  async logout({ auth, response, request }: HttpContext) {
    const user = auth.user!
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    logger.info({ userId: user.id, email: user.email }, 'User logged out successfully')

    await AuditLog.create({
      userId: user.id,
      action: 'auth:logout',
      status: 'success',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.ok({ message: 'Logged out' })
  }

  async changePassword({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { currentPassword, newPassword } = request.all()

    // 1. Verify current password
    const isValid = await hash.verify(user.password, currentPassword)
    if (!isValid) {
      await AuditLog.create({
        userId: user.id,
        action: 'auth:change_password_failed',
        status: 'failure',
        details: { reason: 'Incorrect current password' },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })
      return response.badRequest({ message: 'Incorrect current password' })
    }

    // 2. Validate new password strength
    try {
      await passwordValidator.validate({ password: newPassword })
    } catch (e: any) {
      await AuditLog.create({
        userId: user.id,
        action: 'auth:change_password_failed',
        status: 'failure',
        details: { reason: 'Weak password', error: e.messages },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })
      throw e
    }

    // 3. Check history (Last 5)
    if (await hash.verify(user.password, newPassword)) {
      await AuditLog.create({
        userId: user.id,
        action: 'auth:change_password_failed',
        status: 'failure',
        details: { reason: 'Reuse currently password' },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })
      return response.badRequest({ message: 'Cannot reuse your new password' })
    }

    // We also need to check the history table
    await user.load('passwordHistories', q => q.orderBy('created_at', 'desc').limit(5))

    for (const history of user.passwordHistories) {
      // Assuming history.passwordHash is scrypt hash
      if (await hash.verify(history.passwordHash, newPassword)) {
        await AuditLog.create({
          userId: user.id,
          action: 'auth:change_password_failed',
          status: 'failure',
          details: { reason: 'Reuse history password' },
          ipAddress: request.ip(),
          userAgent: request.header('user-agent'),
          isInternalIp: isInternalIP(request.ip()),
        })
        return response.badRequest({ message: 'Cannot use any of your last 5 passwords' })
      }
    }

    // 4. Archive old password
    await user.related('passwordHistories').create({
      passwordHash: user.password,
    })

    // 5. Update user password
    user.password = newPassword // @beforeSave hook will hash this
    user.lastPasswordChangeAt = DateTime.now()
    await user.save()

    logger.info({ userId: user.id }, 'User changed password successfully')

    await AuditLog.create({
      userId: user.id,
      action: 'auth:change_password',
      status: 'success',
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.ok({ message: 'Password changed successfully' })
  }

  async updateAvatar({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const image = request.file('avatar', {
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg'],
    })

    if (!image) {
      return response.badRequest({ message: 'No image uploaded' })
    }

    if (!image.isValid) {
      return response.badRequest({ message: image.errors[0].message })
    }

    const fileName = `${user.id}_${DateTime.now().toMillis()}.${image.extname}`
    await image.move('./uploads/avatars', {
      name: fileName,
      overwrite: true,
    })

    // Delete old avatar if exists
    // (Optional but good for storage)

    user.avatar = `/api/uploads/avatars/${fileName}`
    await user.save()

    return response.ok({
      message: 'Avatar updated successfully',
      avatar: user.avatar,
    })
  }

  async miniProgramLogin({ request, response }: HttpContext) {
    const { code } = request.all()
    if (!code) {
      return response.badRequest({ message: 'Code is required' })
    }

    const appId = env.get('WECHAT_APP_ID')
    const appSecret = env.get('WECHAT_APP_SECRET')

    if (!appId || !appSecret) {
      return response.internalServerError({ message: 'WeChat configuration missing' })
    }

    try {
      const wechatResponse = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`,
      )
      const data = (await wechatResponse.json()) as any

      if (data.errcode) {
        logger.error({ wechatError: data }, 'WeChat login failed')
        return response.badRequest({ message: 'WeChat login failed', error: data.errmsg })
      }

      const openid = data.openid
      const user = await User.findBy('wechat_openid', openid)

      if (!user) {
        // Option 1: Create a new user (inactive by default as per register logic)
        // Option 2: Error and ask to bind (safer for enterprise tools)
        // We'll go with Option 1 but keep them inactive, so admin still approves.
        // We need a dummy email/password or something if they don't exist.
        // Actually, let's just return a "not_bound" status if the user doesn't exist,
        // allowing the mini-program to show a "Please contact admin" or "Bind account" screen.
        return response.notFound({
          code: 'USER_NOT_FOUND',
          message: 'WeChat account not bound to any user. Please contact admin.',
          openid,
        })
      }

      if (!user.isActive) {
        return response.unauthorized({ message: 'Your account is pending approval.' })
      }

      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '24h',
      })

      // Audit Log
      await AuditLog.create({
        userId: user.id,
        action: 'auth:miniprogram_login',
        status: 'success',
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })

      return response.ok({
        token: token.value?.release(),
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          twoFactorEnabled: user.twoFactorEnabled,
          createdAt: user.createdAt.toISO(),
          isWechatBound: !!user.wechatOpenid,
        },
      })
    } catch (error: any) {
      logger.error({ error: error.message }, 'Mini program login internal error')
      return response.internalServerError({ message: 'Internal server error' })
    }
  }

  async bindMiniProgram({ request, response }: HttpContext) {
    const { email, password, openid } = request.all()

    if (!email || !password || !openid) {
      return response.badRequest({ message: '邮箱、密码和 OpenID 必填' })
    }

    try {
      const user = await User.verifyCredentials(email, password)

      // 检查该 OpenID 是否已被绑定
      const existingUser = await User.findBy('wechat_openid', openid)
      if (existingUser) {
        return response.badRequest({ message: '该微信账号已绑定其他用户' })
      }

      // 如果用户当前已绑定了其他 OpenID，允许更新吗？
      // 这里暂时只允许绑定一次，防止误操作
      if (user.wechatOpenid) {
        return response.badRequest({ message: '该账号已绑定过微信，请先解绑或联系管理员' })
      }

      user.wechatOpenid = openid
      await user.save()

      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '24h',
      })

      // Audit Log
      await AuditLog.create({
        userId: user.id,
        action: 'auth:miniprogram_bind',
        status: 'success',
        ipAddress: request.ip(),
        userAgent: request.header('user-agent'),
        isInternalIp: isInternalIP(request.ip()),
      })

      return response.ok({
        message: '绑定成功',
        token: token.value?.release(),
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          twoFactorEnabled: user.twoFactorEnabled,
          createdAt: user.createdAt.toISO(),
          isWechatBound: !!user.wechatOpenid,
        },
      })
    } catch (error: any) {
      return response.unauthorized({ message: '账号或密码错误' })
    }
  }

  async unbindMiniProgram({ auth, response, request }: HttpContext) {
    const user = auth.user!

    if (!user.wechatOpenid) {
      return response.badRequest({ message: '当前账号未绑定微信' })
    }

    user.wechatOpenid = null
    await user.save()

    // Revoke all other tokens (invalidate Mini Program sessions)
    try {
      if (user.currentAccessToken) {
        const currentTokenId = user.currentAccessToken.identifier

        await user.load('apiTokens')

        // Iterate and delete individually to be safe
        for (const token of user.apiTokens) {
          // Compare ID. AccessToken model uses 'id', not 'identifier'.
          // We ensure we don't delete the current session's token.
          if (String(token.id) !== String(currentTokenId)) {
            try {
              await User.accessTokens.delete(user, token.id)
            } catch (innerError) {
              // Log failure for individual token but continue
              // console.error(`Failed to delete token ${token.id}: ${innerError.message}`)
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error, userId: user.id }, 'Failed to revoke other tokens during unbind')
      // We don't block the unbind if token revocation fails, but we log it.
    }

    await AuditLog.create({
      userId: user.id,
      action: 'auth:miniprogram_unbind',
      status: 'success',
      // details: { revokedTokensCount: '...' }, // Details not easily available if errors occur or counting is tricky without accumulating
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      isInternalIp: isInternalIP(request.ip()),
    })

    return response.ok({ message: '解绑成功' })
  }
}
