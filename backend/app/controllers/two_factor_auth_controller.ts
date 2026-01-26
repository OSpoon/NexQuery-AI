import type { HttpContext } from '@adonisjs/core/http'
import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'

import hash from '@adonisjs/core/services/hash'

export default class TwoFactorAuthController {
  /**
   * Generate a new 2FA secret and QR code for setup
   */
  async generate({ auth, response }: HttpContext) {
    const user = auth.user!

    // Generate secret
    const secret = generateSecret()

    // Generate otpauth URL
    const otpauth = generateURI({
      secret,
      label: user.email,
      issuer: 'NexQuery AI',
    })

    // Generate QR Code
    const qrCode = await QRCode.toDataURL(otpauth)

    return response.ok({
      secret,
      qrCode,
    })
  }

  /**
   * Enable 2FA after verifying the code
   */
  async enable({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { secret, token } = request.all()

    if (!secret || !token) {
      return response.badRequest({ message: 'Secret and token are required' })
    }

    // Verify token against the proposed secret
    const { valid } = await verify({ token, secret })

    if (!valid) {
      return response.badRequest({ message: 'Invalid 2FA code' })
    }

    // Save secret and enable
    user.twoFactorSecret = secret
    user.twoFactorEnabled = true

    // Generate recovery codes (simple implementation)
    const recoveryCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase())
    user.twoFactorRecoveryCodes = JSON.stringify(recoveryCodes)

    await user.save()

    return response.ok({
      message: '2FA enabled successfully',
      recoveryCodes,
    })
  }

  /**
   * Disable 2FA requires password confirmation
   */
  async disable({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { password } = request.all()

    if (!password) {
      return response.badRequest({ message: 'Password is required' })
    }

    // Verify password
    const isPasswordValid = await hash.verify(user.password, password)
    if (!isPasswordValid) {
      return response.unauthorized({ message: 'Invalid password' })
    }

    user.twoFactorEnabled = false
    user.twoFactorSecret = null
    user.twoFactorRecoveryCodes = null
    await user.save()

    return response.ok({ message: '2FA disabled successfully' })
  }
}
