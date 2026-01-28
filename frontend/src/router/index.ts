import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login/index.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/register/index.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/pages/forgot-password/index.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/pages/reset-password/index.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/pages/change-password/index.vue'),
      // It implies auth is needed, but we might redirect there if expired token is invalid?
      // Wait, if token is expired in backend eyes (password expired), we still need to be "authenticated" enough to call changePassword?
      // Our interceptor removes token on 401.
      // But for password expiration, we want to allow access to this page.
      // AND we need the token to call /auth/password/change?
      // Actually `AuthController.changePassword` uses `auth.user`.
      // If `login` failed with "expired", we don't have a token yet?
      // Wait. The requirement "Regularly force change (<=90 days)".
      // If user tries to login, and it is expired:
      // Option A: Allow login but restrict access? (Adonis keeps token valid?)
      // Option B: Block login, but provide a specific "change password" flow (e.g. temporary token).
      // My implementation in `AuthController.login` returns 401. So NO token is issued.
      // So `auth.user` will be null.
      // So `changePassword` endpoint requires auth... catch-22.

      // I need to fix this design.
      // If password expired, I should probably return a TEMPORARY token with scope 'password_reset' or similar.
      // Or allow login but set a flag `mustChangePassword` in the response, and the frontend redirects to change-password.
      // The token would be valid, but maybe with restricted permissions? (Adonis 6 capabilities?)
      // Or just a normal token, but the frontend enforces the redirect.

      // Let's change `AuthController.login` to return 200 OK but with `requiresPasswordChange: true`.
      // And the frontend handles the redirect.
      // This is smoother.
      meta: { requiresAuth: true }, // We will have a token.
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/pages/dashboard/index.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/pages/dashboard/home.vue'),
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/pages/profile/index.vue'),
        },
        {
          path: 'data-sources',
          name: 'data-sources',
          component: () => import('@/pages/data-sources/index.vue'),
        },
        {
          path: 'knowledge-base',
          name: 'knowledge-base',
          component: () => import('@/pages/knowledge-base/index.vue'),
        },
        {
          path: 'query-tasks',
          name: 'query-tasks',
          component: () => import('@/pages/query-tasks/index.vue'),
        },
        {
          path: 'query-tasks/:id/run',
          name: 'query-run',
          component: () => import('@/pages/query-execution/index.vue'),
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('@/pages/history/index.vue'),
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/pages/admin/users/index.vue'),
        },
        {
          path: 'admin/roles',
          name: 'admin-roles',
          component: () => import('@/pages/admin/roles/index.vue'),
        },
        {
          path: 'admin/settings',
          name: 'admin-settings',
          component: () => import('@/pages/admin/settings/index.vue'),
        },
        {
          path: 'admin/api-keys',
          name: 'admin-api-keys',
          component: () => import('@/pages/admin/api-keys/index.vue'),
        },
        {
          path: 'admin/menus',
          name: 'admin-menus',
          component: () => import('@/pages/admin/menus/index.vue'),
        },
        {
          path: 'ai-feedback',
          name: 'ai-feedback',
          component: () => import('@/pages/feedback/index.vue'),
        },
        {
          path: 'workflow',
          name: 'workflow',
          component: () => import('@/pages/workflow/index.vue'),
        },
        {
          path: 'workflow/instances/:id',
          name: 'workflow-detail',
          component: () => import('@/pages/workflow/detail.vue'),
        },
        {
          path: 'workflow/history/:id',
          name: 'workflow-history-detail',
          component: () => import('@/pages/workflow/history-detail.vue'),
        },
        {
          path: 'workflow/definitions/:id',
          name: 'workflow-definition',
          component: () => import('@/pages/workflow/definition.vue'),
        },
        {
          path: 'workflow/design',
          name: 'workflow-design',
          component: () => import('@/pages/workflow/design.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// Route Guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Initialize auth state
  if (!authStore.user && !authStore.token) {
    await authStore.initAuth()
  }

  // Check if route requires auth
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Requires auth but not logged in, redirect to login page
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    // Logged in but accessing login page, redirect to dashboard
    next({ name: 'dashboard' })
    return
  }

  // Check Permissions
  // Priority: 1. Specific meta (legacy/override) 2. Dynamic route permission
  let requiredPermission = to.meta.permission as string | undefined

  if (!requiredPermission) {
    // Try to find a dynamic permission for this path
    requiredPermission = authStore.getPermissionForPath(to.path)
  }

  if (requiredPermission) {
    if (!authStore.hasPermission(requiredPermission)) {
      // User does not have permission
      if (from.name) {
        // next(false) // This aborts navigation but leaves URL unchanged?
        // Better redirect to dashboard or show error toast?
        // For now, redirect to dashboard/home
        next({ name: 'home' })
      }
      else {
        next({ name: 'home' })
      }
      return
    }
  }

  // Check Password Expiration
  if (authStore.isAuthenticated && authStore.user) {
    const lastChange = authStore.user.lastPasswordChangeAt
      ? new Date(authStore.user.lastPasswordChangeAt).getTime()
      : authStore.user.createdAt
        ? new Date(authStore.user.createdAt).getTime()
        : 0

    if (lastChange > 0) {
      const ninetyDays = 90 * 24 * 60 * 60 * 1000
      const now = Date.now()
      if (now - lastChange > ninetyDays) {
        if (to.name !== 'change-password' && to.name !== 'login') {
          next({ name: 'change-password', query: { reason: 'expired' } })
          return
        }
      }
    }
  }

  // Check 2FA Enforcement
  const settingsStore = useSettingsStore()
  // Ensure settings are loaded or we use default (fetched in App.vue mount, but might not be ready here on first load)
  // Ideally, initAuth should fetch settings too, or we trust App.vue

  if (authStore.isAuthenticated && authStore.user && settingsStore.require2fa) {
    // If 2FA is not enabled AND enforcement is on, force them to the profile page
    if (
      !authStore.user.twoFactorEnabled
      && to.name !== 'profile'
      && to.name !== 'login'
      && to.name !== 'logout'
    ) {
      next({ name: 'profile' })
      return
    }
  }

  next()
})

export default router
