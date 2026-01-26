import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'

export default class ResetPassword extends BaseCommand {
  static commandName = 'reset:password'
  static description = 'Reset a user\'s password'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Email address of the user' })
  declare email: string

  @flags.string({ description: 'New password', alias: 'p' })
  declare password?: string

  async run() {
    const email = this.email
    let password = this.password

    if (!password) {
      password = await this.prompt.secure('Enter new password')
    }

    if (!password) {
      this.logger.error('Password is required')
      return
    }

    try {
      const user = await User.findBy('email', email)

      if (!user) {
        this.logger.error(`User with email "${email}" not found`)
        return
      }

      user.password = password
      await user.save()

      this.logger.success(`Password for user "${email}" has been reset successfully`)
    } catch (error) {
      this.logger.error('Failed to reset password')
      this.logger.error(error.message)
    }
  }
}
