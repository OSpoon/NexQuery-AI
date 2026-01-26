<script setup lang="ts">
import { ref } from 'vue'
import api from '@/lib/api'

const loading = ref(false)

function handleWechatLogin() {
  loading.value = true
  uni.login({
    provider: 'weixin',
    success: async (loginRes) => {
      try {
        const res = await api.post('/auth/miniprogram/login', {
          code: loginRes.code,
        })

        uni.setStorageSync('auth_token', res.token)
        uni.setStorageSync('user', JSON.stringify(res.user))

        uni.showToast({
          title: '登录成功',
          icon: 'success',
        })

        setTimeout(() => {
          uni.reLaunch({
            url: '/pages/index/index',
          })
        }, 1500)
      }
      catch (error: any) {
        console.error('Login failed', error)

        // Handle User Not Found (Unbound WeChat account)
        if (error.code === 'USER_NOT_FOUND' && error.openid) {
          uni.showModal({
            title: '账号未绑定',
            content: '您的微信账号尚未绑定 NexQuery AI 用户，是否前往绑定？',
            success: (modalRes) => {
              if (modalRes.confirm) {
                uni.navigateTo({
                  url: `/pages/login/bind?openid=${error.openid}`,
                })
              }
            },
          })
          return
        }

        uni.showModal({
          title: '登录失败',
          content: error.message || '账号未绑定或服务器错误',
          showCancel: false,
        })
      }
      finally {
        loading.value = false
      }
    },
    fail: (err) => {
      console.error('uni.login failed', err)
      loading.value = false

      let errorMsg = '获取微信Code失败'
      if (err.errMsg && err.errMsg.includes('需要重新登录')) {
        errorMsg = '微信工具登录过期，请在开发者工具上方点击头像重新登录'
      }
      else if (err.errMsg) {
        errorMsg = `登录失败: ${err.errMsg}`
      }

      uni.showModal({
        title: '登录异常',
        content: errorMsg,
        showCancel: false,
      })
    },
  })
}
</script>

<template>
  <view class="container">
    <view class="header">
      <image class="logo" src="/static/logo.png" mode="aspectFit" />
      <text class="title">
        NexQuery AI
      </text>
      <text class="subtitle">
        移动端便捷查询助手
      </text>
    </view>

    <view class="content">
      <button class="login-btn" type="primary" :loading="loading" @click="handleWechatLogin">
        微信一键登录
      </button>
      <view class="agreement-box">
        <text class="tips">
          登录即代表您同意
        </text>
        <text class="link" @click="uni.navigateTo({ url: '/pages/profile/policy?type=service' })">
          《用户协议》
        </text>
        <text class="tips">
          和
        </text>
        <text class="link" @click="uni.navigateTo({ url: '/pages/profile/policy?type=privacy' })">
          《隐私政策》
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 0 40rpx;
  background-color: #fff;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 100rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 20rpx;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.subtitle {
  font-size: 28rpx;
  color: #999;
  margin-top: 10rpx;
}

.content {
  width: 100%;
}

.login-btn {
  width: 100%;
  height: 90rpx;
  line-height: 90rpx;
  border-radius: 45rpx;
  background-color: #07c160;
  color: #fff;
  font-size: 32rpx;
}

.agreement-box {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 30rpx;
  flex-wrap: wrap;
}

.tips {
  font-size: 24rpx;
  color: #ccc;
}

.link {
  font-size: 24rpx;
  color: #576b95;
}
</style>
