import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class ApiKeysController {
  /**
   * List all active API keys for the current user
   */
  async index({ auth, response }: HttpContext) {
    const user = auth.user!
    // Load relations sorted by newest, filtering only API Keys (which have a name)
    await user.load('apiTokens', (query) => {
      query.whereNotNull('name').orderBy('created_at', 'desc')
    })

    return response.ok(user.apiTokens)
  }

  /**
   * Create a new API Key (Long-lived token)
   */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { name, expiresIn } = request.only(['name', 'expiresIn'])

    if (!name) {
      return response.badRequest({ message: 'Name is required' })
    }

    // Validate expiration (must be one of allowed values for security)
    const allowedDurations = ['30d', '90d', '180d', '365d']
    const duration = allowedDurations.includes(expiresIn) ? expiresIn : '90d'

    // Create a token with specific duration
    const token = await User.accessTokens.create(user, ['*'], {
      name: name,
      expiresIn: duration,
    })

    return response.created({
      type: 'bearer',
      name: name,
      token: token.value!.release(), // Release the raw token value
      createdAt: new Date(),
    })
  }

  /**
   * Revoke (Delete) an API Key
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const id = params.id

    // Ensure the token belongs to the user and is an API Key (has name)
    const token = await user
      .related('apiTokens')
      .query()
      .where('id', id)
      .whereNotNull('name')
      .first()

    if (!token) {
      return response.notFound({ message: 'Token not found' })
    }

    await token.delete()
    return response.ok({ message: 'Token revoked' })
  }
}
