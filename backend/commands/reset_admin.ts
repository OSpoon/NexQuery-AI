import { BaseCommand } from '@adonisjs/core/ace'
import User from '#models/user'

export default class ResetAdminPassword extends BaseCommand {
  static commandName = 'reset:admin'
  static description = 'Reset admin user password to admin_password'

  static options = {
    startApp: true,
  }

  async run() {
    const emails = ['zhangxin94@2925.com', 'admin@nexquery.ai']
    const RoleModule = await import('#models/role')
    const Role = RoleModule.default

    const adminRole = await Role.findBy('slug', 'admin')
    if (!adminRole) {
      this.logger.error('Admin role not found in database. Please run seeders first.')
      return
    }

    for (const email of emails) {
      const user = await User.findBy('email', email)

      if (!user) {
        this.logger.info(`User ${email} not found, skipping.`)
        continue
      }

      user.password = 'password' // Consistent with new seeder default
      user.isActive = true
      await user.save()

      // Ensure role is assigned
      await user.related('roles').sync([adminRole.id])

      this.logger.success(`User ${email} reset. Password: password, Role: Administrator`)
    }
  }
}
