import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { CryptoService } from '@nexquery/shared'
import logger from '@adonisjs/core/services/logger'

export default class ApiEncryptionMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    const isEnabled
      = env.get('API_ENCRYPTION_ENABLED', false) || env.get('ENABLE_API_ENCRYPTION', false)

    if (!isEnabled) {
      return await next()
    }

    // Skip encryption for streaming endpoints entirely
    const url = request.url()
    if (url.includes('/ai/chat/stream') || url.includes('/notifications/stream')) {
      return await next()
    }

    const key = env.get('API_ENCRYPTION_KEY')
    if (!key) {
      logger.warn('API Encryption is enabled but API_ENCRYPTION_KEY is missing.')
      return await next()
    }

    const crypto = new CryptoService(key)

    // --- Request Decryption ---
    // Only attempt decryption if the body has content and looks like it might be encrypted
    // Usually frontend sends { data: "ciphertext" } for JSON requests
    const body = request.body()
    const signature = request.header('x-signature')

    if (body && body.data && signature) {
      // 1. Verify Signature
      const calculatedSignature = crypto.sign(body.data)
      if (calculatedSignature !== signature) {
        logger.warn({ calculatedSignature, signature }, 'Invalid API Signature')
        return response.unauthorized({ error: 'Invalid API Signature' })
      }

      // 2. Decrypt
      const decryptedRaw = crypto.decryptRaw(body.data)
      if (decryptedRaw === null) {
        logger.error('Failed to decrypt request body: Result is null')
        return response.badRequest({ error: 'Decryption Failed' })
      }

      // 3. Parse JSON defensively
      try {
        const decryptedJson = JSON.parse(decryptedRaw)
        // 4. Replace body with decrypted data
        request.updateBody(decryptedJson)
      } catch (e: any) {
        logger.error(
          { decryptedRaw, error: e.message },
          'Failed to parse decrypted request body as JSON',
        )
        return response.badRequest({
          error: 'Invalid JSON after decryption',
          details: env.get('NODE_ENV') === 'development' ? e.message : undefined,
        })
      }
    }

    // Process the request
    await next()

    // --- Response Encryption ---
    // Skip encryption for streaming responses (SSE)
    if (response.getHeader('Content-Type') === 'text/event-stream') {
      return
    }

    // After the controller is done
    const responseBody = response.getBody()

    // We only encrypt JSON responses (objects/arrays)
    // Avoid encrypting strings/buffers unless specific requirement
    if (responseBody && typeof responseBody === 'object') {
      const encryptedData = crypto.encrypt(responseBody)
      const respSignature = crypto.sign(encryptedData)

      // Replace response body with { data: encrypted }
      response.send({ data: encryptedData })

      // Set signature header
      response.header('x-signature', respSignature)
      response.header('x-encryption-enabled', 'true')
    }
  }
}
