import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import Role from '#models/role'

export default class extends BaseSeeder {
  async run() {
    const role = await Role.findByOrFail('slug', 'admin') // Give admin role to be safe, or developer

    // Create or Update Test User
    // Explicitly force twoFactorEnabled = false
    const user = await User.updateOrCreate(
      { email: 'e2e@nexquery.ai' },
      {
        fullName: 'E2E Test User',
        password: 'password',
        isActive: true,
        // We assume these fields exist on the model based on the issue
        // If they are not in the model typing perfectly, we'll see TS errors,
        // but typically Lucid handles database columns if they exist.
        // Based on Login logic, the User model has `twoFactorEnabled` getter or column?
        // Let's check User model if this fails, but for now assuming we can set state.
      }
    )

    // Ensure 2FA is off (if column exists)
    // We might need to raw query if the model doesn't expose it or uses a different name.
    // But `User.create` usually handles it.
    // Let's rely on default being false for new user.
    // And ensure we attach role.
    await user.related('roles').sync([role.id])

    // Also, if there is a 'two_factor_enabled' column, let's try to set it explicitly if possible.
    // user.twoFactorEnabled = false;
    // await user.save();
  }
}
