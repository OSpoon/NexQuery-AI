import { test } from '@japa/runner'
import QueryExecutionService from '#services/query_execution_service'

test.group('Advanced Config Logic', () => {
  test('should apply alias and enum mapping', async ({ assert }) => {
    const service = new QueryExecutionService()

    const rawResults = [
      { id: 1, status: 1, type: 'a' },
      { id: 2, status: 0, type: 'b' },
    ]

    const config = [
      {
        table: 'users',
        fields: [
          {
            name: 'status',
            alias: 'Account Status',
            enums: {
              '1': 'Active',
              '0': 'Inactive',
            },
          },
          {
            name: 'id',
            alias: 'User ID',
            enums: {},
          },
        ],
      },
    ]

    const transformed = service.applyAdvancedConfig(rawResults, config)

    assert.lengthOf(transformed, 2)
    assert.deepEqual(transformed[0], { 'User ID': 1, 'Account Status': 'Active', 'type': 'a' })
    assert.deepEqual(transformed[1], { 'User ID': 2, 'Account Status': 'Inactive', 'type': 'b' })
  })

  test('should handle missing enum values gracefully', async ({ assert }) => {
    const service = new QueryExecutionService()

    const rawResults = [{ status: 99 }]
    const config = [
      {
        table: 't',
        fields: [{ name: 'status', alias: 'S', enums: { '1': 'One' } }],
      },
    ]

    const transformed = service.applyAdvancedConfig(rawResults, config)
    assert.deepEqual(transformed[0], { S: 99 })
  })
})
