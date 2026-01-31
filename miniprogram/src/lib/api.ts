import { CryptoService } from '@nexquery/shared'
import CryptoJS from 'crypto-js'

// --- NexQuery: WeChat Mini Program Crypto Fix ---
try {
  const lib = (CryptoJS as any).lib
  if (lib && lib.WordArray) {
    lib.WordArray.random = function (nBytes: number) {
      const words = []
      for (let i = 0; i < nBytes; i += 4) {
        words.push(Math.floor(Math.random() * 0x100000000))
      }
      return lib.WordArray.create(words, nBytes)
    }
  }
}
catch (e) {
  console.error('NexQuery: API lib - Failed to patch CryptoJS', e)
}
// -----------------------------------------------

const serverRoot = 'http://localhost:3008'
const baseURL = `${serverRoot}/api`

// Initialize Encryption Service
// In Uni-app (Vite), we use import.meta.env to read variables
const enableEncryption = import.meta.env.API_ENCRYPTION_ENABLED === 'true'
const encryptionKey = '12345678901234567890123456789012' // Should match backend

function createCryptoService() {
  if (enableEncryption && encryptionKey) {
    try {
      return new CryptoService(encryptionKey)
    }
    catch (e) {
      console.error('Failed to initialize CryptoService', e)
    }
  }
  return null
}

const cryptoService = createCryptoService()

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: any
}

function request(options: RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    let { url, method = 'GET', data, header = {} } = options

    // Add Auth Token
    const token = uni.getStorageSync('auth_token')
    if (token) {
      header.Authorization = `Bearer ${token}`
    }

    // Encryption Logic
    if (cryptoService && data && method !== 'GET') {
      try {
        const encryptedData = cryptoService.encrypt(data)
        const signature = cryptoService.sign(encryptedData)

        // Replace body with { data: encrypted }
        data = { data: encryptedData }

        // Set headers
        header['X-Signature'] = signature
        header['X-Encryption-Enabled'] = 'true'
      }
      catch (e) {
        console.error('Request encryption failed', e)
        return reject(e)
      }
    }

    uni.request({
      url: url.startsWith('http') ? url : `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
      success: (res) => {
        let responseData = res.data as any

        // Decryption Logic
        if (
          cryptoService
          && responseData
          && responseData.data
          && typeof responseData.data === 'string'
        ) {
          const isEncrypted = res.header['x-encryption-enabled'] === 'true'
            || res.header['X-Encryption-Enabled'] === 'true'
            || res.header['X-Encryption-Enabled']?.toLowerCase() === 'true'

          if (isEncrypted) {
            try {
              const decrypted = cryptoService.decrypt(responseData.data)
              if (decrypted !== null) {
                responseData = decrypted
              }
              else {
                console.error('Decryption failed: decryption result is null')
              }
            }
            catch (e) {
              console.error('Response decryption failed', e)
            }
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData)
        }
        else {
          console.error('Request status error:', res.statusCode, responseData)
          if (res.statusCode === 401) {
            uni.removeStorageSync('auth_token')
            uni.removeStorageSync('user')
            uni.reLaunch({
              url: '/pages/login/index',
            })
          }
          reject(responseData || { message: 'Request failed' })
        }
      },
      fail: (err) => {
        reject(err)
      },
    })
  })
}

const api = {
  get: (url: string, data?: any, header?: any) => request({ url, method: 'GET', data, header }),
  post: (url: string, data?: any, header?: any) => request({ url, method: 'POST', data, header }),
  put: (url: string, data?: any, header?: any) => request({ url, method: 'PUT', data, header }),
  delete: (url: string, header?: any) => request({ url, method: 'DELETE', header }),
}

export { baseURL, cryptoService, serverRoot }
export default api
