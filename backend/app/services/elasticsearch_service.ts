import { Client } from '@elastic/elasticsearch'
import logger from '@adonisjs/core/services/logger'

export default class ElasticsearchService {
  public readonly client: Client

  constructor(options: {
    node: string
    auth?: {
      username?: string
      password?: string
      apiKey?: string
    }
  }) {
    const { node, auth } = options
    this.client = new Client({
      node,
      auth: auth?.apiKey ? { apiKey: auth.apiKey } : (auth?.username && auth?.password ? { username: auth.username, password: auth.password } : undefined),
      requestTimeout: 30000, // 30s global timeout
    })
  }

  /**
   * Test connection to ES
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.ping()
      return true
    } catch (error) {
      logger.error({ err: error }, '[Elasticsearch] Ping failed')
      return false
    }
  }

  /**
   * Search logs
   */
  async search(options: {
    index: string
    query?: string
    size?: number
    from?: number
  }) {
    const { index, query, size = 100, from = 0 } = options

    // Defensive size capping
    const cappedSize = Math.min(size, 500)
    if (size > 500) {
      logger.info({ index, size, cappedSize }, '[Elasticsearch] Capping search size')
    }

    try {
      const res = await this.client.search({
        index,
        from,
        size: cappedSize,
        terminate_after: 5000, // Defensive stop after 5000 docs
        body: {
          query: query
            ? {
                query_string: {
                  query,
                },
              }
            : {
                match_all: {},
              },
          sort: [
            { '@timestamp': { order: 'desc' } },
          ],
        },
      })

      return res.hits.hits.map((hit: any) => ({
        id: hit._id,
        timestamp: hit._source['@timestamp'],
        message: hit._source.message || hit._source.msg || JSON.stringify(hit._source),
        source: hit._source,
      }))
    } catch (error: any) {
      logger.error({ err: error, index }, '[Elasticsearch] Search failed')
      throw error
    }
  }

  /**
   * Get mapping for an index (without caching for now)
   */
  async getMapping(index: string) {
    try {
      const response: any = await this.client.indices.getMapping({ index })
      return response
    } catch (error: any) {
      logger.error({ err: error, index }, '[Elasticsearch] Failed to get mapping')
      throw error
    }
  }

  /**
   * Get statistics for a specific field
   */
  async getFieldStats(index: string, field: string) {
    try {
      // 1. Get field type from mapping
      const mapping: any = await this.getMapping(index)
      const fieldMapping = mapping[index]?.mappings?.properties?.[field]
      const type = fieldMapping?.type || 'text'

      // 2. Perform aggregation based on type
      let body: any = {}
      if (type === 'keyword' || type === 'text') {
        // Use .keyword if it's a text field with multibfield
        const aggField = type === 'text' && fieldMapping.fields?.keyword ? `${field}.keyword` : field
        body = {
          size: 0,
          aggs: {
            top_values: {
              terms: {
                field: aggField,
                size: 10,
              },
            },
          },
        }
      } else if (['long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float', 'date'].includes(type)) {
        body = {
          size: 0,
          aggs: {
            stats: {
              stats: {
                field,
              },
            },
          },
        }
      } else {
        return { type, message: `Field type '${type}' not supported for stats` }
      }

      const res: any = await this.client.search({
        index,
        body,
      })

      if (body.aggs.top_values) {
        return {
          type,
          top_values: res.aggregations.top_values.buckets.map((b: any) => ({
            value: b.key,
            count: b.doc_count,
          })),
        }
      } else {
        return {
          type,
          stats: res.aggregations.stats,
        }
      }
    } catch (error: any) {
      logger.error({ err: error, index, field }, '[Elasticsearch] Failed to get field stats')
      throw error
    }
  }

  /**
   * Get high-level summary of an index (without caching for now)
   */
  async getIndexSummary(index: string) {
    try {
      // 1. Get doc count
      const countRes = await this.client.count({ index })

      // 2. Get stats (size)
      const statsRes = await this.client.indices.stats({ index })
      const sizeInBytes = statsRes.indices?.[index]?.total?.store?.size_in_bytes

      // 3. Try to get time range if @timestamp exists
      let timeRange = null
      try {
        const mapping = await this.getMapping(index)
        if (mapping[index]?.mappings?.properties?.['@timestamp']) {
          const timeRes: any = await this.client.search({
            index,
            terminate_after: 10000,
            body: {
              size: 0,
              aggs: {
                time_stats: {
                  stats: { field: '@timestamp' },
                },
              },
            },
          })
          timeRange = {
            min: timeRes.aggregations.time_stats.min_as_string,
            max: timeRes.aggregations.time_stats.max_as_string,
          }
        }
      } catch (e) {
        // Ignore time range errors
      }

      return {
        count: countRes.count,
        size_bytes: sizeInBytes,
        size_human: sizeInBytes ? `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB` : 'unknown',
        time_range: timeRange,
      }
    } catch (error: any) {
      logger.error({ err: error, index }, '[Elasticsearch] Failed to get index summary')
      throw error
    }
  }
}
