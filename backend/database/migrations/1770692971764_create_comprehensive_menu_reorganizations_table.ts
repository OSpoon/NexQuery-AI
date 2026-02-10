import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  async up() {
    // 1. Top-Level Menus
    const topLevel = [
      { path: '/', sort_order: 10 },
      { path: '/query-tasks', sort_order: 20 },
      { path: '/history', sort_order: 30 },
      { path: '/data-sources', sort_order: 40 },
      { path: '/knowledge-base', sort_order: 50 },
      { path: '/ai-feedback', sort_order: 60 },
      { path: '#admin-group', sort_order: 100 },
    ]

    for (const m of topLevel) {
      await db.from('menus').where('path', m.path).update({ sort_order: m.sort_order })
    }

    // 2. Admin Sub-Menus
    const adminItems = [
      { path: '/admin/api-keys', sort_order: 10 },
      { path: '/admin/users', sort_order: 20 },
      { path: '/admin/roles', sort_order: 30 },
      { path: '/admin/menus', sort_order: 40 },
      { path: '/admin/permissions', sort_order: 50 },
      { path: '/admin/finops', sort_order: 60 },
      { path: '/admin/evaluations', sort_order: 70 },
      { path: '/admin/settings', sort_order: 80 },
    ]

    for (const item of adminItems) {
      await db.from('menus').where('path', item.path).update({ sort_order: item.sort_order })
    }
  }

  async down() {
    // Reverting to some recognizable previous state (approximate)
    const originalTop = [
      { path: '/', sort_order: 10 },
      { path: '/query-tasks', sort_order: 20 },
      { path: '/history', sort_order: 25 },
      { path: '/data-sources', sort_order: 30 },
      { path: '/knowledge-base', sort_order: 50 },
      { path: '/ai-feedback', sort_order: 60 },
      { path: '#admin-group', sort_order: 90 },
    ]
    for (const m of originalTop) {
      await db.from('menus').where('path', m.path).update({ sort_order: m.sort_order })
    }
  }
}
