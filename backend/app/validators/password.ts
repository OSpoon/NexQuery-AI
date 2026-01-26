import vine from '@vinejs/vine'

/**
 * Validates that the password meets MLPS Level 3 strength requirements:
 * - Length >= 12
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number
 * - Contains special character
 */

const passwordStrength = vine.createRule((value: unknown, _options, field) => {
  if (typeof value !== 'string') {
    return
  }

  if (!/[A-Z]/.test(value)) {
    field.report('Password must contain at least one uppercase letter', 'password.uppercase', field)
  }
  if (!/[a-z]/.test(value)) {
    field.report('Password must contain at least one lowercase letter', 'password.lowercase', field)
  }
  if (!/\d/.test(value)) {
    field.report('Password must contain at least one number', 'password.number', field)
  }
  if (!/[^A-Z0-9]/i.test(value)) {
    field.report('Password must contain at least one special character', 'password.special', field)
  }
})

export const passwordRule = vine.string().minLength(12).use(passwordStrength())

export const passwordValidator = vine.compile(
  vine.object({
    password: passwordRule,
  }),
)
