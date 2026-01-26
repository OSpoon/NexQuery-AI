<script setup lang="ts">
import { ref } from 'vue'
import api from '@/lib/api'

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)

async function handleSave() {
  if (!currentPassword.value || !newPassword.value) {
    uni.showToast({ title: '请填写完整', icon: 'none' })
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    uni.showToast({ title: '两次新密码不一致', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await api.post('/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    uni.showToast({ title: '密码已修改', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }
  catch (e: any) {
    const msg = e.response?.data?.message || '修改失败'
    uni.showToast({ title: msg, icon: 'none' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="container">
    <view class="form-group">
      <text class="label">
        当前密码
      </text>
      <input v-model="currentPassword" class="input" type="password" placeholder="请输入当前密码">
    </view>

    <view class="form-group">
      <text class="label">
        新密码
      </text>
      <input v-model="newPassword" class="input" type="password" placeholder="请输入新密码">
    </view>

    <view class="form-group">
      <text class="label">
        确认新密码
      </text>
      <input v-model="confirmPassword" class="input" type="password" placeholder="再次输入新密码">
    </view>

    <button class="save-btn" type="button" :loading="loading" @click="handleSave">
      确认修改
    </button>
  </view>
</template>

<style scoped>
.container {
    min-height: 100vh;
    background-color: #f5f5f5;
    padding: 30rpx;
}

.form-group {
    background-color: #fff;
    padding: 30rpx;
    border-radius: 12rpx;
    margin-bottom: 20rpx;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
}

.label {
    font-size: 28rpx;
    font-weight: bold;
    color: #333;
}

.input {
    font-size: 30rpx;
    height: 60rpx;
    border-bottom: 2rpx solid #eee;
}

.save-btn {
    margin-top: 60rpx;
    border-radius: 40rpx;
}
</style>
