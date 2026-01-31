import { CryptoService } from '@nexquery/shared'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Initialize Encryption Service
const enableEncryption = import.meta.env.API_ENCRYPTION_ENABLED === 'true'
const encryptionKey = import.meta.env.API_ENCRYPTION_KEY
export const cryptoService: CryptoService | null = (() => {
  if (enableEncryption && encryptionKey) {
    try {
      return new CryptoService(encryptionKey)
    }
    catch (e) {
      console.error('Failed to initialize CryptoService', e)
    }
  }
  return null
})()

// Add request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Encryption Logic
  if (cryptoService && config.data && !(config.data instanceof FormData)) {
    try {
      const encryptedData = cryptoService.encrypt(config.data)
      const signature = cryptoService.sign(encryptedData)

      // Replace body with { data: encrypted }
      config.data = { data: encryptedData }

      // Set headers
      config.headers['X-Signature'] = signature
      config.headers['X-Encryption-Enabled'] = 'true'
    }
    catch (e) {
      console.error('Request encryption failed', e)
      // Fallback? Or fail? If encryption is enforced, we should probably throw.
      // But for now let's hope it works.
      throw e
    }
  }

  return config
})

// Helper to decrypt response data
function decryptResponse(response: any) {
  if (
    cryptoService
    && response.data
    && response.data.data
    && typeof response.data.data === 'string'
  ) {
    try {
      const isEncrypted = response.headers['x-encryption-enabled'] === 'true'
      if (isEncrypted) {
        const decrypted = cryptoService.decrypt(response.data.data)
        if (decrypted !== null && decrypted !== undefined) {
          response.data = decrypted
        }
      }
    }
    catch (e) {
      console.error('Response decryption failed', e)
    }
  }
  return response
}

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    return decryptResponse(response)
  },
  (error) => {
    // Decrypt error response data if possible
    if (error.response) {
      decryptResponse(error.response)
    }

    if (error.response && error.response.status === 401) {
      const data = error.response.data

      // Check for password expiration
      if (data && data.code === 'PASSWORD_EXPIRED') {
        if (window.location.pathname !== '/change-password') {
          window.location.href = '/change-password?reason=expired'
        }
        return Promise.reject(error)
      }

      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')

      // Don't redirect if already on login page to avoid loops
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api
