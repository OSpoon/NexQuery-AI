import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import ForgotPasswordNotification from '#mails/forgot_password_notification'
import env from '#start/env'

export default class PasswordResetsController {
  async sendResetLink({ request, response }: HttpContext) {
    const { email } = request.all()
    const user = await User.findBy('email', email)

    // Security: Always return the same message regardless of whether the user exists or not.
    const message = 'If your email is in our system, you will receive a reset link shortly.'

    if (!user) {
      return response.ok({ message })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = DateTime.now().plus({ hours: 2 })

    // Save token to DB
    await db.table('password_reset_tokens').insert({
      email,
      token,
      expires_at: expiresAt.toFormat('yyyy-MM-dd HH:mm:ss'),
      created_at: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
      updated_at: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
    })

    // Send email
    const frontendUrl = env.get('FRONTEND_URL')
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${email}`

    await mail.send(new ForgotPasswordNotification(user, resetUrl))

    return response.ok({ message })
  }

  async reset({ request, response }: HttpContext) {
    const { email, token, password } = request.all()

    const resetToken = await db
      .from('password_reset_tokens')
      .where('email', email)
      .where('token', token)
      .where('expires_at', '>', DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'))
      .first()

    if (!resetToken) {
      return response.badRequest({ message: 'Invalid or expired reset token.' })
    }

    const user = await User.findByOrFail('email', email)
    user.password = password
    await user.save()

    // Delete token after successful reset
    await db.from('password_reset_tokens').where('email', email).delete()

    return response.ok({ message: 'Password has been reset successfully.' })
  }
}
