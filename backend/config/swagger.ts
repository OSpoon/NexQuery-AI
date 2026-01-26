import path from 'node:path'
import url from 'node:url'

export default {
  // path: path.dirname(url.fileURLToPath(import.meta.url)) + '/../', // for AdonisJS v5
  path: `${path.dirname(url.fileURLToPath(import.meta.url))}/../`, // for AdonisJS v6
  title: 'NexQuery AI API',
  version: '1.0.0',
  description: 'API documentation for NexQuery AI platform',
  tagIndex: 2,
  info: {
    title: 'NexQuery AI API',
    version: '1.0.0',
    description: 'API documentation for NexQuery AI platform',
  },
  snakeCase: true,

  debug: false, // set to true for debugging
  ignore: ['/swagger', '/docs'],
  preferredPutPatch: 'PUT', // if PUT/PATCH are provided for the same route, prefer PUT
  common: {
    parameters: {}, // OpenAPI conform parameters that are commonly used
    headers: {}, // OpenAPI conform headers that are commonly used
  },
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
    },
    ApiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-KEY',
    },
  }, // optional
  authMiddlewares: ['auth', 'auth:api'], // optional
  defaultSecurityScheme: 'BearerAuth', // optional
  persistAuthorization: true, // persist authorization between reloads on the swagger page
  showFullPath: false, // the path displayed in the swagger page will be the short path
}
