import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/lib/api'
import type { DataSource } from '@nexquery/shared'

export const useDataSourceStore = defineStore('dataSource', () => {
  const dataSources = ref<DataSource[]>([])
  const isLoading = ref(false)

  const fetchDataSources = async () => {
    isLoading.value = true
    try {
      const response = await api.get('/data-sources')
      dataSources.value = response.data
    } catch (error) {
      console.error('Failed to fetch data sources', error)
    } finally {
      isLoading.value = false
    }
  }

  const databaseSources = computed(() => {
    return dataSources.value.filter((ds) => ds.type === 'mysql' || ds.type === 'postgresql')
  })

  return {
    dataSources,
    isLoading,
    fetchDataSources,
    databaseSources,
  }
})
