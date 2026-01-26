<script setup lang="ts">
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import api from '@/lib/api'

const logs = ref<any[]>([])
const fullLogs = ref<any[]>([]) // Cache to store all tags
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const selectedTag = ref('All')
const allTaskTags = ref<string[]>([])
let searchTimeout: any = null

const availableTags = computed(() => {
  return ['All', ...allTaskTags.value]
})

async function fetchGlobalTags() {
  try {
    const res = await api.get('/query-tasks')
    const tasks = Array.isArray(res) ? res : (res.data || [])
    const tags = new Set<string>()
    tasks.forEach((task: any) => {
      if (task.tags) {
        task.tags.forEach((t: string) => tags.add(t))
      }
    })
    allTaskTags.value = Array.from(tags)
  }
  catch (_error) {
    console.error('Failed to fetch global tags', _error)
  }
}

async function fetchLogs() {
  loading.value = true
  try {
    const res = await api.get('/query-logs', {
      search: searchQuery.value,
      status: statusFilter.value,
      tag: selectedTag.value === 'All' ? undefined : selectedTag.value,
    })
    const data = res.data || []
    logs.value = data

    // Update cache if no filters
    if (selectedTag.value === 'All' && !searchQuery.value && !statusFilter.value) {
      fullLogs.value = data
    }
  }
  catch (_error) {
    console.error('Failed to fetch logs', _error)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function onSearchInput(e: any) {
  searchQuery.value = e.detail.value
  if (searchTimeout)
    clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchLogs()
  }, 500)
}

function setStatus(status: string) {
  if (statusFilter.value === status)
    return
  statusFilter.value = status
  fetchLogs()
}

function selectTag(tag: string) {
  if (selectedTag.value === tag)
    return
  selectedTag.value = tag
  fetchLogs()
}

function formatDate(dateStr: string) {
  if (!dateStr)
    return '-'
  const date = new Date(dateStr)
  // Check if valid
  if (Number.isNaN(date.getTime()))
    return dateStr

  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

function viewResult(log: any) {
  // Navigate to detail page
  uni.setStorageSync('current_log_detail', JSON.stringify(log))
  uni.navigateTo({
    url: '/pages/history/detail',
  })
}

onMounted(() => {
  fetchGlobalTags()
  fetchLogs()
})

onPullDownRefresh(() => {
  fetchLogs()
})
</script>

<template>
  <view class="container">
    <view class="filter-header">
      <view class="search-bar">
        <image class="search-icon" src="/static/tabs/history_active.png" mode="aspectFit" />
        <input
          v-model="searchQuery" class="search-input" placeholder="搜索运行记录..." confirm-type="search"
          @input="onSearchInput"
        >
      </view>

      <view class="filter-row">
        <text class="filter-label">
          状态:
        </text>
        <view class="status-tabs">
          <view class="tab-item" :class="{ active: statusFilter === '' }" @click="setStatus('')">
            全部
          </view>
          <view class="tab-item" :class="{ active: statusFilter === 'success' }" @click="setStatus('success')">
            成功
          </view>
          <view class="tab-item" :class="{ active: statusFilter === 'failed' }" @click="setStatus('failed')">
            失败
          </view>
        </view>
      </view>

      <view class="filter-row">
        <text class="filter-label">
          标签:
        </text>
        <scroll-view scroll-x class="tag-filter" :show-scrollbar="false">
          <view class="tag-list">
            <view
              v-for="tag in availableTags" :key="tag" class="tag-chip" :class="{ active: selectedTag === tag }"
              @click="selectTag(tag)"
            >
              {{ tag }}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="loading && logs.length === 0" class="loading-state">
      <text>加载中...</text>
    </view>

    <view v-else-if="logs.length === 0" class="empty-state">
      <text>暂无最近执行记录</text>
    </view>

    <view v-else class="log-list">
      <view v-for="log in logs" :key="log.id" class="log-item" @click="viewResult(log)">
        <view class="log-info">
          <view class="log-header">
            <text class="task-title">
              {{ log.task?.name || '未知任务' }}
            </text>
            <view class="exec-info">
              <text class="exec-user">
                {{ log.user?.fullName || '未知用户' }}
              </text>
              <text class="status-badge" :class="log.status === 'success' ? 'success' : 'failed'">
                {{ log.status === 'success' ? '成功' : '失败' }}
              </text>
            </view>
          </view>

          <view v-if="log.task?.tags && log.task.tags.length > 0" class="task-tags">
            <text v-for="tag in log.task.tags" :key="tag" class="task-tag">
              {{ tag }}
            </text>
          </view>

          <view class="log-footer">
            <text class="log-time">
              {{ formatDate(log.createdAt) }}
            </text>
            <view class="arrow-icon" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20rpx;
}

.filter-header {
  background-color: #fff;
  padding: 24rpx;
  border-radius: 20rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-bar {
  display: flex;
  align-items: center;
  background-color: #f5f7fa;
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}

.search-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 16rpx;
  opacity: 0.4;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.filter-row {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  gap: 20rpx;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-label {
  font-size: 24rpx;
  color: #999;
  font-weight: 500;
  width: 70rpx;
  flex-shrink: 0;
}

.status-tabs {
  display: flex;
  gap: 16rpx;
  flex: 1;
}

.tab-item {
  font-size: 24rpx;
  color: #666;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  background-color: #f5f7fa;
  transition: all 0.2s ease;
}

.tab-item.active {
  background-color: #007aff;
  color: #fff;
  font-weight: bold;
}

.tag-filter {
  flex: 1;
  white-space: nowrap;
}

.tag-list {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx 0;
}

.tag-chip {
  display: inline-block;
  padding: 8rpx 24rpx;
  background-color: #f5f7fa;
  color: #666;
  border-radius: 30rpx;
  font-size: 22rpx;
  border: 1rpx solid transparent;
}

.tag-chip.active {
  background-color: #e3f2fd;
  color: #007aff;
  border-color: #007aff;
  font-weight: bold;
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-item {
  background-color: #fff;
  padding: 30rpx;
  border-radius: 20rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.04);
}

.log-info {
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.task-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1a1a;
  flex: 1;
  margin-right: 20rpx;
}

.exec-info {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.exec-user {
  font-size: 20rpx;
  background-color: #f5f7fa;
  color: #666;
  padding: 6rpx 16rpx;
  border-radius: 30rpx;
  font-weight: 500;
}

.status-badge {
  font-size: 20rpx;
  padding: 6rpx 20rpx;
  border-radius: 30rpx;
  font-weight: 600;
}

.status-badge.success {
  background-color: #f0fdf4;
  color: #22c55e;
}

.status-badge.failed {
  background-color: #fef2f2;
  color: #ef4444;
}

.log-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8rpx;
}

.log-time {
  font-size: 24rpx;
  color: #888;
}

.arrow-icon {
  width: 14rpx;
  height: 14rpx;
  border-top: 3rpx solid #dcdcdc;
  border-right: 3rpx solid #dcdcdc;
  transform: rotate(45deg);
}
</style>
