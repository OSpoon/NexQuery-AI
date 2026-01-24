import vine from '@vinejs/vine'

export const createQueryTaskValidator = vine.compile(
  vine.object({
    name: vine.string().trim(),
    description: vine.string().optional(),
    sqlTemplate: vine.string(),
    formSchema: vine.any().optional(),
    dataSourceId: vine.number(),
    storeResults: vine.boolean().optional(),
    tags: vine.array(vine.string().maxLength(15)).maxLength(3).optional(),
  })
)

export const updateQueryTaskValidator = vine.compile(
  vine.object({
    name: vine.string().trim().optional(),
    description: vine.string().optional(),
    sqlTemplate: vine.string().optional(),
    formSchema: vine.any().optional(),
    dataSourceId: vine.number().optional(),
    storeResults: vine.boolean().optional(),
    tags: vine.array(vine.string().maxLength(15)).maxLength(3).optional(),
  })
)
