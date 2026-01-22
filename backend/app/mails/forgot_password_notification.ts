import { BaseMail } from '@adonisjs/mail'
import User from '#models/user'

export default class ForgotPasswordNotification extends BaseMail {
  subject = 'Reset your password'

  constructor(
    private user: User,
    private resetUrl: string
  ) {
    super()
  }

  /**
   * The "prepare" method is where you configure the message
   * options, like getting the view, or setting the subject.
   */
  prepare() {
    this.message.to(this.user.email).htmlView('emails/forgot_password', {
      user: this.user,
      url: this.resetUrl,
    })
  }
}
