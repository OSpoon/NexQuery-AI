import axios from 'axios'
import { CryptoService } from '@nexquery/shared'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Initialize Encryption Service
const enableEncryption = import.meta.env.API_ENCRYPTION_ENABLED === 'true'
const encryptionKey = import.meta.env.API_ENCRYPTION_KEY
let cryptoService: CryptoService | null = null

if (enableEncryption && encryptionKey) {
  try {
    cryptoService = new CryptoService(encryptionKey)
  } catch (e) {
    console.error('Failed to initialize CryptoService', e)
  }
}

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
    } catch (e) {
      console.error('Request encryption failed', e)
      // Fallback? Or fail? If encryption is enforced, we should probably throw.
      // But for now let's hope it works.
      throw e
    }
  }

  return config
})

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    // Decryption Logic
    if (
      cryptoService &&
      response.data &&
      response.data.data &&
      typeof response.data.data === 'string'
    ) {
      try {
        // We assume usage of { data: "ciphertext" } wrapper for encrypted responses
        // Check if encryption was enabled/expected?
        // We can just rely on the structure or the header X-Encryption-Enabled from server if present.
        // Middleware sets 'x-encryption-enabled: true'

        // Only decrypt if it looks like the encrypted wrapper or header is present
        // Checking header is safer
        const isEncrypted = response.headers['x-encryption-enabled'] === 'true'

        if (isEncrypted) {
          const decrypted = cryptoService.decrypt(response.data.data)
          if (decrypted !== null) {
            response.data = decrypted
          } else {
            console.error('Response decryption returned null')
          }
        }
      } catch (e) {
        console.error('Response decryption failed', e)
      }
    }
    return response
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      const data = error.response.data

      // Check for password expiration
      if (data && data.code === 'PASSWORD_EXPIRED') {
        // Redirect to change password page (we need to create this route)
        // Store the fact that it's an expired password scenario?
        // Maybe just query param?
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
