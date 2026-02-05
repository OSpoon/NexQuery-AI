import env from '#start/env'
import { CryptoService } from '@nexquery/shared'

export class CryptoHelper {
  private static instance: CryptoService | null = null

  public static getInstance(): CryptoService {
    if (!this.instance) {
      const encryptionKey = env.get('API_ENCRYPTION_KEY')
      if (!encryptionKey) {
        throw new Error('API_ENCRYPTION_KEY is not configured in environment')
      }
      this.instance = new CryptoService(encryptionKey)
    }
    return this.instance
  }

  /**
   * Helper to safely decrypt a value
   * Returns original value if decryption fails or value is not provided
   */
  public static tryDecrypt(val: string | null | undefined): string | null | undefined {
    if (!val)
      return val
    try {
      const crypto = this.getInstance()
      return crypto.decrypt(val) || val
    } catch {
      return val
    }
  }

  /**
   * Helper to safely encrypt a value
   */
  public static encrypt(val: string): string {
    const crypto = this.getInstance()
    return crypto.encrypt(val)
  }
}
