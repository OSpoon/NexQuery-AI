<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/lib/api'
import { onPullDownRefresh } from '@dcloudio/uni-app'

const logs = ref<any[]>([])
const loading = ref(false)

const fetchLogs = async () => {
  loading.value = true
  try {
    // Backend returns pagination object { meta: ..., data: [...] }
    const res = await api.get('/query-logs')
    logs.value = res.data || []
  } catch (error) {
    console.error('Failed to fetch logs', error)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  // Check if valid
  if (isNaN(date.getTime())) return dateStr

  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

const viewResult = (log: any) => {
  // Re-use result page by storing the data temporarily
  uni.setStorageSync('last_query_result', JSON.stringify(log.results || log.result))
  uni.navigateTo({
    url: '/pages/result/index'
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
