import type { DataSource } from '@nexquery/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/lib/api'

export const useDataSourceStore = defineStore('dataSource', () => {
  const dataSources = ref<DataSource[]>([])
  const isLoading = ref(false)

  const fetchDataSources = async () => {
    isLoading.value = true
    try {
      const response = await api.get('/data-sources')
      dataSources.value = response.data
    }
    catch (error) {
      console.error('Failed to fetch data sources', error)
    }
    finally {
      isLoading.value = false
    }
  }

  const databaseSources = computed(() => {
    return dataSources.value.filter(ds => ds.type === 'mysql' || ds.type === 'postgresql' || ds.type === 'elasticsearch')
  })

  return {
    dataSources,
    isLoading,
    fetchDataSources,
    databaseSources,
  }
})
