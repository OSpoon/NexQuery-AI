import { test } from '@japa/runner'
import QueryExecutionService from '#services/query_execution_service'

test.group('Data Masking', () => {
  const service = new QueryExecutionService()

  test('mask mobile phone', ({ assert }) => {
    const results = [{ phone: '13812345678' }]
    const config = [
      {
        table: 'users',
        fields: [
          {
            name: 'phone',
            masking: { type: 'mobile' },
          },
        ],
      },
    ]

    const masked = service.applyAdvancedConfig(results, config)
    assert.equal(masked[0].phone, '138****5678')
  })

  test('mask id card', ({ assert }) => {
    const results = [{ id_card: '110101199001011234' }]
    const config = [
      {
        table: 'users',
        fields: [
          {
            name: 'id_card',
            masking: { type: 'id_card' },
          },
        ],
      },
    ]

    const masked = service.applyAdvancedConfig(results, config)
    assert.equal(masked[0].id_card, '110101********1234')
  })

  test('mask email', ({ assert }) => {
    const results = [{ email: 'test@example.com' }]
    const config = [
      {
        table: 'users',
        fields: [
          {
            name: 'email',
            masking: { type: 'email' },
          },
        ],
      },
    ]

    const masked = service.applyAdvancedConfig(results, config)
    assert.equal(masked[0].email, 't***@example.com')
  })

  test('mask custom regex', ({ assert }) => {
    const results = [{ api_key: 'sk-1234567890abcdef' }]

    // regex logic: ^sk-.{4}(.*).{4}$ matches "sk-1234" (group 1: 567890ab) "cdef"
    // replace: sk-****567890ab****

    // Simpler test for custom: hide middle
    const config2 = [
      {
        table: 'keys',
        fields: [
          {
            name: 'api_key',
            masking: {
              type: 'custom',
              rule: '^(sk-).+(.{4})$',
              replace: '$1****$2',
            },
          },
        ],
      },
    ]

    const masked = service.applyAdvancedConfig(results, config2)
    assert.equal(masked[0].api_key, 'sk-****cdef')
  })
})
