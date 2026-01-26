<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import api from '@/lib/api'

const email = ref('')
const password = ref('')
const openid = ref('')
const loading = ref(false)

// Get openid from navigation params
onLoad((options: any) => {
  if (options.openid) {
    openid.value = options.openid
  }
  else {
    uni.showToast({
      title: '缺少 OpenID，请重新从登录页进入',
      icon: 'none',
      duration: 2000,
    })
    setTimeout(() => uni.navigateBack(), 2000)
  }
})

async function handleBind() {
  if (!email.value || !password.value) {
    uni.showToast({
      title: '请输入邮箱和密码',
      icon: 'none',
    })
    return
  }

  loading.value = true
  try {
    const res = await api.post('/auth/miniprogram/bind', {
      email: email.value,
      password: password.value,
      openid: openid.value,
    })

    uni.setStorageSync('auth_token', res.token)
    uni.setStorageSync('user', JSON.stringify(res.user))

    uni.showToast({
      title: '绑定并登录成功',
      icon: 'success',
    })

    setTimeout(() => {
      uni.reLaunch({
        url: '/pages/index/index',
      })
    }, 1500)
  }
  catch (error: any) {
    console.error('Binding failed', error)
    uni.showModal({
      title: '绑定失败',
      content: error.message || '账号密码错误或服务器错误',
      showCancel: false,
    })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="container">
    <view class="header">
      <text class="title">
        身份绑定
      </text>
      <text class="subtitle">
        请使用您的 NexQuery AI 账号进行绑定
      </text>
    </view>

    <view class="form">
      <view class="input-group">
        <text class="label">
          邮箱
        </text>
        <input
          v-model="email" class="input" type="text" placeholder="请输入注册邮箱"
          placeholder-style="color: #ccc"
        >
      </view>

      <view class="input-group">
        <text class="label">
          密码
        </text>
        <input
          v-model="password" class="input" type="password" placeholder="请输入登录密码"
          placeholder-style="color: #ccc"
        >
      </view>

      <button class="bind-btn" type="button" :loading="loading" @click="handleBind">
        立即绑定
      </button>

      <view class="footer">
        <text class="back-link" @click="uni.navigateBack()">
          返回登录
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.container {
    padding: 60rpx 40rpx;
    background-color: #f8f9fa;
    min-height: 100vh;
}

.header {
    margin-bottom: 60rpx;
}

.title {
    font-size: 44rpx;
    font-weight: bold;
    color: #333;
}

.subtitle {
    display: block;
    font-size: 26rpx;
    color: #666;
    margin-top: 20rpx;
}

.form {
    background-color: #fff;
    padding: 40rpx;
    border-radius: 20rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.input-group {
    margin-bottom: 30rpx;
}

.label {
    display: block;
    font-size: 28rpx;
    color: #333;
    margin-bottom: 16rpx;
}

.input {
    width: 100%;
    height: 90rpx;
    background-color: #f5f5f5;
    border-radius: 12rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    box-sizing: border-box;
}

.bind-btn {
    width: 100%;
    height: 90rpx;
    line-height: 90rpx;
    border-radius: 45rpx;
    background-color: #07c160;
    color: #fff;
    font-size: 30rpx;
    margin-top: 40rpx;
}

.footer {
    text-align: center;
    margin-top: 30rpx;
}

.back-link {
    font-size: 26rpx;
    color: #07c160;
}
</style>
