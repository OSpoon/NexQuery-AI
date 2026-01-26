<script setup lang="ts">
import type { QueryTask } from '@nexquery/shared'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import api from '@/lib/api'

const tasks = ref<QueryTask[]>([])
const fullTasks = ref<QueryTask[]>([]) // Cache to store all tags
const loading = ref(false)
const searchQuery = ref('')
const selectedTag = ref('All')
let searchTimeout: any = null

const availableTags = computed(() => {
  const tags = new Set<string>()
  // Always derive available tags from all possible tasks (ignore current filter for the set)
  const source = fullTasks.value.length > 0 ? fullTasks.value : tasks.value

  if (Array.isArray(source)) {
    source.forEach((task) => {
      if (task.tags) {
        task.tags.forEach(t => tags.add(t))
      }
    })
  }
  return ['All', ...Array.from(tags)]
})

async function fetchTasks() {
  loading.value = true
  try {
    const res = await api.get('/query-tasks', {
      search: searchQuery.value,
      tag: selectedTag.value === 'All' ? undefined : selectedTag.value,
    })
    tasks.value = res

    // If we're fetching all (no tag, no search), update fullTasks cache for the tag bar
    if (selectedTag.value === 'All' && !searchQuery.value) {
      fullTasks.value = res
    }
  }
  catch (error: any) {
    console.error('[FetchTasks] Failed', error)
    if (error.statusCode === 401) {
      uni.reLaunch({ url: '/pages/login/index' })
    }
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
    fetchTasks()
  }, 500)
}

function goToExecute(task: QueryTask) {
  uni.navigateTo({
    url: `/pages/task/execute?id=${task.id}`,
  })
}

onMounted(() => {
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.reLaunch({ url: '/pages/login/index' })
  }
  else {
    fetchTasks()
  }
})

function selectTag(tag: string) {
  selectedTag.value = tag
  fetchTasks()
}

onPullDownRefresh(() => {
  fetchTasks()
})
</script>

<template>
  <view class="container">
    <view class="search-bar">
      <image class="search-icon" src="/static/tabs/task_active.png" mode="aspectFit" />
      <input
        v-model="searchQuery" class="search-input" placeholder="搜索任务..." confirm-type="search"
        @input="onSearchInput"
      >
    </view>

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

    <view v-if="loading && tasks.length === 0" class="loading-state">
      <text>加载中...</text>
    </view>

    <view v-else-if="tasks.length === 0" class="empty-state">
      <text>暂无查询任务</text>
    </view>

    <view v-else class="task-list">
      <view v-for="task in tasks" :key="task.id" class="task-item" @click="goToExecute(task)">
        <view class="task-header">
          <text class="task-name">
            {{ task.name }}
          </text>
          <text class="ds-name">
            {{ task.dataSource?.name }}
          </text>
        </view>

        <view v-if="task.tags && task.tags.length > 0" class="task-tags">
          <text v-for="tag in task.tags" :key="tag" class="task-tag">
            {{ tag }}
          </text>
        </view>

        <view class="task-footer">
          <text class="task-desc">
            {{ task.description || '无描述' }}
          </text>
          <view class="arrow-icon" />
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

.search-bar {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  margin: 10rpx 0 24rpx 0;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
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

.tag-filter {
  width: 100%;
  margin-bottom: 30rpx;
  white-space: nowrap;
}

.tag-list {
  display: inline-flex;
  padding: 4rpx 10rpx;
  gap: 16rpx;
}

.tag-chip {
  display: inline-block;
  padding: 10rpx 28rpx;
  background-color: #fff;
  color: #666;
  border-radius: 30rpx;
  font-size: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.tag-chip.active {
  background-color: #007aff;
  color: #fff;
  font-weight: bold;
  box-shadow: 0 4rpx 12rpx rgba(0, 122, 255, 0.2);
}

.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  color: #999;
}

.task-list {
  display: flex;
  flex-direction: column;
}

.task-item {
  background-color: #fff;
  padding: 30rpx;
  border-radius: 20rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.04);
  position: relative;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.task-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #1a1a1a;
  flex: 1;
  margin-right: 20rpx;
}

.ds-name {
  font-size: 20rpx;
  background-color: #f0fdf4;
  color: #22c55e;
  padding: 6rpx 20rpx;
  border-radius: 30rpx;
  font-weight: 600;
  white-space: nowrap;
}

.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.task-tag {
  font-size: 20rpx;
  background-color: #f0f7ff;
  color: #007aff;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  border: 1rpx solid #ddecff;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-desc {
  font-size: 26rpx;
  color: #888;
  line-height: 1.4;
  flex: 1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.arrow-icon {
  width: 14rpx;
  height: 14rpx;
  border-top: 3rpx solid #dcdcdc;
  border-right: 3rpx solid #dcdcdc;
  transform: rotate(45deg);
  margin-left: 20rpx;
}
</style>
