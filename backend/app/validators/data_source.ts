import vine from '@vinejs/vine'

export const createDataSourceValidator = vine.compile(
  vine.object({
    name: vine.string().trim(),
    type: vine.string().in(['mysql', 'postgresql', 'api']),
    host: vine.string().trim(),
    port: vine.number().min(1).max(65535).optional(),
    username: vine.string().trim().optional(),
    password: vine.string().optional(),
    database: vine.string().trim().optional(),
    description: vine.string().optional(),
    isActive: vine.boolean().optional(),
    config: vine.object({}).allowUnknownProperties().optional(),
  })
)

export const updateDataSourceValidator = vine.compile(
  vine.object({
    name: vine.string().trim().optional(),
    type: vine.string().in(['mysql', 'postgresql', 'api']).optional(),
    host: vine.string().trim().optional(),
    port: vine.number().min(1).max(65535).optional(),
    username: vine.string().trim().optional(),
    password: vine.string().optional(),
    database: vine.string().trim().optional(),
    description: vine.string().optional(),
    isActive: vine.boolean().optional(),
    config: vine.object({}).allowUnknownProperties().optional(),
  })
)
