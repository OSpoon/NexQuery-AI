<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/lib/api'
import type { QueryTask } from '@nexquery/shared'

const tasks = ref<QueryTask[]>([])
const loading = ref(false)

const fetchTasks = async () => {
    loading.value = true
    try {
        const res = await api.get('/query-tasks')
        tasks.value = res
    } catch (error: any) {
        console.error('Failed to fetch tasks', error)
        if (error.statusCode === 401) {
            uni.reLaunch({ url: '/pages/login/index' })
        }
    } finally {
        loading.value = false
        uni.stopPullDownRefresh()
    }
}

const goToExecute = (task: QueryTask) => {
    uni.navigateTo({
        url: `/pages/task/execute?id=${task.id}`
    })
}

onMounted(() => {
    const token = uni.getStorageSync('auth_token')
    if (!token) {
        uni.reLaunch({ url: '/pages/login/index' })
    } else {
        fetchTasks()
    }
})

// Listen for pull down refresh in Uni-app
import { onPullDownRefresh } from '@dcloudio/uni-app'
onPullDownRefresh(() => {
    fetchTasks()
})
</script>

<template>
  <view class="container">
    <view v-if="loading && tasks.length === 0" class="loading-state">
      <text>加载中...</text>
    </view>
    
    <view v-else-if="tasks.length === 0" class="empty-state">
      <text>暂无查询任务</text>
    </view>
    
    <view v-else class="task-list">
      <view 
        v-for="task in tasks" 
        :key="task.id" 
        class="task-item"
        @click="goToExecute(task)"
      >
        <view class="task-info">
          <text class="task-name">{{ task.name }}</text>
          <text class="task-desc">{{ task.description || '无描述' }}</text>
        </view>
        <view class="task-meta">
          <text class="ds-name">{{ task.dataSource?.name }}</text>
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

.loading-state, .empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  color: #999;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.task-item {
  background-color: #fff;
  padding: 30rpx;
  border-radius: 12rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.task-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.task-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.task-desc {
  font-size: 24rpx;
  color: #999;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.ds-name {
  font-size: 20rpx;
  background-color: #e3f2fd;
  color: #1976d2;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.arrow-icon {
  width: 16rpx;
  height: 16rpx;
  border-top: 4rpx solid #ccc;
  border-right: 4rpx solid #ccc;
  transform: rotate(45deg);
  margin-left: 10rpx;
}
</style>
