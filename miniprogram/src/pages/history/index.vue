<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/lib/api'
import { onPullDownRefresh } from '@dcloudio/uni-app'

const logs = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
let searchTimeout: any = null

const fetchLogs = async () => {
  loading.value = true
  try {
    const res = await api.get('/query-logs', {
      search: searchQuery.value,
      status: statusFilter.value
    })
    logs.value = res.data || []
  } catch (error) {
    console.error('Failed to fetch logs', error)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

const onSearchInput = (e: any) => {
  searchQuery.value = e.detail.value
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchLogs()
  }, 500)
}

const setStatus = (status: string) => {
  if (statusFilter.value === status) return
  statusFilter.value = status
  fetchLogs()
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  // Check if valid
  if (isNaN(date.getTime())) return dateStr

  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

const viewResult = (log: any) => {
  // Navigate to detail page
  uni.setStorageSync('current_log_detail', JSON.stringify(log))
  uni.navigateTo({
    url: '/pages/history/detail'
  })
}

onMounted(() => {
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
        <image class="search-icon" src="/static/tabs/history_active.png" mode="aspectFit"></image>
        <input class="search-input" placeholder="搜索运行记录..." v-model="searchQuery" @input="onSearchInput"
          confirm-type="search" />
      </view>
      <view class="status-tabs">
        <view class="tab-item" :class="{ active: statusFilter === '' }" @click="setStatus('')">全部</view>
        <view class="tab-item" :class="{ active: statusFilter === 'success' }" @click="setStatus('success')">成功</view>
        <view class="tab-item" :class="{ active: statusFilter === 'failed' }" @click="setStatus('failed')">失败</view>
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
          <text class="task-title">{{ log.task?.name || '未知任务' }}</text>
          <text class="log-time">{{ formatDate(log.createdAt) }}</text>
        </view>
        <view class="log-status">
          <text class="status-badge" :class="log.status === 'success' ? 'success' : 'failed'">
            {{ log.status === 'success' ? '成功' : '失败' }}
          </text>
          <view class="arrow-icon"></view>
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
  padding: 20rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.02);
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-bar {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  padding: 12rpx 20rpx;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}

.search-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  opacity: 0.4;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.status-tabs {
  display: flex;
  gap: 20rpx;
}

.tab-item {
  font-size: 26rpx;
  color: #666;
  padding: 8rpx 24rpx;
  border-radius: 30rpx;
  background-color: #f5f5f5;
}

.tab-item.active {
  background-color: #e6f7ff;
  color: #1890ff;
  font-weight: bold;
}

.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  color: #999;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.log-item {
  background-color: #fff;
  padding: 30rpx;
  border-radius: 12rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-info {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.task-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.log-time {
  font-size: 24rpx;
  color: #999;
}

.log-status {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.status-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.status-badge.success {
  background-color: #e6f7ff;
  color: #1890ff;
}

.status-badge.failed {
  background-color: #fff1f0;
  color: #f5222d;
}

.arrow-icon {
  width: 14rpx;
  height: 14rpx;
  border-top: 3rpx solid #ccc;
  border-right: 3rpx solid #ccc;
  transform: rotate(45deg);
}
</style>
