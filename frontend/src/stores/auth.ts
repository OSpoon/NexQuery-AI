import type { LoginResponse, Menu, Permission, Role, User } from '@nexquery/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import api from '@/lib/api'
import router from '@/router'

export type { Menu, Permission, Role, User }

/*
export interface Permission {
  id: number
  name: string
  slug: string
}

export interface Role {
  id: number
  name: string
  slug: string
  permissions: Permission[]
}

export interface User {
  id: number
  fullName: string
  email: string
  roles?: Role[]
  isActive: boolean
  createdAt: string
  updatedAt?: string
}
*/

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const permissions = ref<Set<string>>(new Set())

  const isAuthenticated = computed(() => !!user.value && !!token.value)

  async function register(fullName: string, email: string, password: string): Promise<void> {
    try {
      await api.post('/register', { fullName, email, password })
    }
    catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed')
    }
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/password/change', { currentPassword, newPassword })
    }
    catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to change password')
    }
  }

  async function login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/login', { email, password })
      const data = response.data

      // If 2FA is required, return early (no token yet)
      if (data.requiresTwoFactor) {
        return data
      }

      // If password change is required, we still need to set the token so the user is authenticated
      // to call the change password endpoint.
      token.value = data.token!
      user.value = data.user!

      localStorage.setItem('auth_token', token.value!)
      localStorage.setItem('user', JSON.stringify(user.value))

      // Fetch permissions immediately after login
      await fetchPermissions()
      await fetchMenus()
      await fetchRoutePermissions()

      if (data.requiresPasswordChange) {
        return data
      }

      return data
    }
    catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed')
    }
  }

  async function verify2fa(tempToken: string, code: string): Promise<void> {
    try {
      const response = await api.post<LoginResponse>('/auth/2fa/verify', { tempToken, code })
      const data = response.data

      token.value = data.token!
      user.value = data.user!

      localStorage.setItem('auth_token', token.value!)
      localStorage.setItem('user', JSON.stringify(user.value))

      await fetchPermissions()
      await fetchMenus()
      await fetchRoutePermissions()
    }
    catch (error: any) {
      throw new Error(error.response?.data?.message || 'Verification failed')
    }
  }

  async function fetchPermissions() {
    if (!token.value)
      return

    try {
      const response = await api.get('/me')
      permissions.value = new Set(response.data.permissions)
      // Update user state to reflect changes (e.g. 2FA enabled)
      if (response.data.user) {
        user.value = response.data.user
        localStorage.setItem('user', JSON.stringify(user.value))
      }
    }
    catch (e) {
      console.error('Failed to fetch permissions', e)
    }
  }

  function hasPermission(permission: string): boolean {
    return permissions.value.has(permission)
  }

  function logout() {
    user.value = null
    token.value = null
    permissions.value.clear()
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    // Optional: Call /api/logout backend endpoint
  }

  async function initAuth() {
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = JSON.parse(savedUser)
      await fetchPermissions()
      await fetchMenus()
      await fetchRoutePermissions()
    }
  }

  const menus = ref<Menu[]>([])

  async function fetchMenus() {
    if (!token.value)
      return
    try {
      const response = await api.get('/menus/public')
      menus.value = response.data
      // Register dynamic routes based on fetched menus
      registerDynamicRoutes()
    }
    catch (e) {
      console.error('Failed to fetch menus', e)
    }
  }

  function registerDynamicRoutes() {
    // Glob all vue components in @/pages
    const modules = import.meta.glob('@/pages/**/*.vue')

    const flattenMenus = (items: Menu[]): Menu[] => {
      let result: Menu[] = []
      for (const item of items) {
        result.push(item)
        if (item.children) {
          result = result.concat(flattenMenus(item.children))
        }
      }
      return result
    }

    const allMenus = flattenMenus(menus.value)

    for (const menu of allMenus) {
      if (menu.path && menu.component && !menu.path.startsWith('#')) {
        // Match the component path from DB with globbed modules
        // We look for a key that ends with the path stored in DB (e.g. pages/dashboard/home.vue)
        const dbPath = menu.component.replace('@/', '')
        const matchingKey = Object.keys(modules).find(key => key.includes(dbPath))
        const resolver = matchingKey ? modules[matchingKey] : null

        if (resolver) {
          const routeName = `dynamic-${menu.id}`
          // Check if route already exists to avoid warnings/duplicates
          if (!router.hasRoute(routeName)) {
            router.addRoute('dashboard', {
              path: menu.path.startsWith('/') ? menu.path.substring(1) : menu.path,
              name: routeName,
              component: resolver,
              meta: {
                requiresAuth: true,
                permission: menu.permission,
                title: menu.title,
              },
            })
          }
        }
        else {
          console.warn(`[DynamicRouting] Component not found for path: ${menu.component}`)
        }
      }
    }
  }

  const routePermissions = ref<Record<string, string>>({})

  async function fetchRoutePermissions() {
    if (!token.value)
      return
    try {
      const response = await api.get('/menus/route-permissions')
      routePermissions.value = response.data
    }
    catch (e) {
      console.error('Failed to fetch route permissions', e)
    }
  }

  function getPermissionForPath(path: string): string | undefined {
    // Find the longest matching path in the map
    const keys = Object.keys(routePermissions.value)
    // Sort keys by length descending to match longest prefix first
    keys.sort((a, b) => b.length - a.length)

    for (const key of keys) {
      if (path === key || path.startsWith(`${key}/`)) {
        return routePermissions.value[key]
      }
    }
    return undefined
  }

  return {
    user,
    token,
    menus,
    isAuthenticated,
    login,
    verify2fa,
    register,
    changePassword,
    logout,
    initAuth,
    hasPermission,
    fetchPermissions,
    fetchMenus,
    permissions,
    getPermissionForPath,
  }
})
