import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import Role from '#models/role'
import Permission from '#models/permission'
import Menu from '#models/menu'
import Setting from '#models/setting'
import KnowledgeBase from '#models/knowledge_base'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'

import { PERMISSION_DETAILS, PERMISSIONS } from '@nexquery/shared'

export default class extends BaseSeeder {
  async run() {
    // 1. Define all permissions (Using shared constants)
    const permissions: Record<string, Permission> = {}
    for (const p of PERMISSION_DETAILS) {
      permissions[p.slug] = await Permission.updateOrCreate({ slug: p.slug }, p)
    }

    // 2. Create Roles
    const adminRole = await Role.firstOrCreate(
      { slug: 'admin' },
      {
        name: 'Administrator',
        slug: 'admin',
        description: 'Full system access',
      },
    )

    const developerRole = await Role.firstOrCreate(
      { slug: 'developer' },
      {
        name: 'Developer',
        slug: 'developer',
        description: 'Full access to Data Sources, Tasks, and AI features',
      },
    )

    const operatorRole = await Role.firstOrCreate(
      { slug: 'operator' },
      {
        name: 'Operator',
        slug: 'operator',
        description: 'Can execute allowed query tasks but cannot modify them',
      },
    )

    // 3. Attach permissions to roles
    // Admin gets everything
    await adminRole.related('permissions').sync(Object.values(permissions).map(p => p.id))

    // Helper to extract IDs safely
    const getIds = (perms: (Permission | undefined)[]) => {
      const valid = perms.filter((p): p is Permission => !!p)
      if (valid.length < perms.length) {
        logger.warn(
          'Some permissions were not found during seeding. Check permissions.ts matches init_seeder.ts',
        )
      }
      return valid.map(p => p.id)
    }

    // Developer gets almost everything except User Management and Settings
    const devPerms = [
      permissions[PERMISSIONS.VIEW_DASHBOARD],
      permissions[PERMISSIONS.MANAGE_DATA_SOURCES],
      permissions[PERMISSIONS.MANAGE_TASKS],
      permissions[PERMISSIONS.VIEW_HISTORY],
      permissions[PERMISSIONS.MANAGE_KNOWLEDGE_BASE],
      permissions[PERMISSIONS.MANAGE_AI_FEEDBACK],
      permissions[PERMISSIONS.MANAGE_AI_FINOPS],
    ]
    await developerRole.related('permissions').sync(getIds(devPerms))

    // Operator is execute-only (View Dashboard, View Tasks, View History)
    const operatorPerms = [
      permissions[PERMISSIONS.VIEW_DASHBOARD],
      permissions[PERMISSIONS.MANAGE_TASKS],
      permissions[PERMISSIONS.VIEW_HISTORY],
    ]
    await operatorRole.related('permissions').sync(getIds(operatorPerms))

    // 4. Create Initial Users for each Role
    const usersToCreate = [
      { email: 'admin@nexquery.ai', name: 'System Admin', roleId: adminRole.id },
      { email: 'developer@nexquery.ai', name: 'Developer User', roleId: developerRole.id },
      { email: 'operator@nexquery.ai', name: 'Operator User', roleId: operatorRole.id },
    ]

    for (const u of usersToCreate) {
      const existingUser = await User.findBy('email', u.email)
      let userNode

      if (existingUser) {
        userNode = existingUser
        userNode.isActive = true
        await userNode.save()
      } else {
        userNode = await User.create({
          email: u.email,
          fullName: u.name,
          password: 'password', // Default password
          isActive: true,
        })
      }

      await userNode.related('roles').sync([u.roleId])
      logger.info(`Seeded user: ${u.email} with role ID: ${u.roleId}`)
    }

    // Verification (Check Admin)
    const adminUser = await User.findBy('email', 'admin@nexquery.ai')
    if (adminUser) {
      const isValid = await hash.verify(adminUser.password, 'password')
      logger.info(`Admin password verification: ${isValid ? 'PASSED' : 'FAILED'}`)
    }

    // 5. Build Menu Structure
    // 5. Build Menu Structure
    const mainMenus = [
      {
        title: 'Dashboard',
        path: '/',
        icon: 'LayoutDashboard',
        permission: PERMISSIONS.VIEW_DASHBOARD,
        sortOrder: 10,
        parentId: null,
      },
      {
        title: 'Query Tasks',
        path: '/query-tasks',
        icon: 'Terminal',
        permission: PERMISSIONS.MANAGE_TASKS,
        sortOrder: 20,
        parentId: null,
      },
      {
        title: 'Data Sources',
        path: '/data-sources',
        icon: 'Database',
        permission: PERMISSIONS.MANAGE_DATA_SOURCES,
        sortOrder: 30,
        parentId: null,
      },
      {
        title: 'History',
        path: '/history',
        icon: 'History',
        permission: PERMISSIONS.VIEW_HISTORY,
        sortOrder: 25,
        parentId: null,
      },
      {
        title: 'Knowledge Base',
        path: '/knowledge-base',
        icon: 'Book',
        permission: PERMISSIONS.MANAGE_KNOWLEDGE_BASE,
        sortOrder: 50,
        parentId: null,
      },
      {
        title: 'AI Feedback',
        path: '/ai-feedback',
        icon: 'MessageSquare',
        permission: PERMISSIONS.MANAGE_AI_FEEDBACK,
        sortOrder: 60,
        parentId: null,
      },
    ]

    for (const m of mainMenus) {
      // Logic to sync: check by path.
      // If we are "moving" items, we need to ensure their parentId is updated correctly later.
      // For now, just create/update.
      await Menu.updateOrCreate({ path: m.path }, m)
    }

    // Administration Group
    const adminGroup = await Menu.updateOrCreate(
      { path: '#admin-group' }, // Use a stable path internal identifier
      {
        title: 'Administration',
        path: '#admin-group',
        icon: 'ShieldCheck',
        permission: PERMISSIONS.MANAGE_USERS,
        sortOrder: 90,
      },
    )

    const adminMenuItems = [
      {
        title: 'API Access',
        path: '/admin/api-keys',
        icon: 'Key',
        permission: PERMISSIONS.MANAGE_API_KEYS,
        sortOrder: 91,
      },
      {
        title: 'FinOps Monitoring',
        path: '/admin/finops',
        icon: 'BarChart',
        permission: PERMISSIONS.MANAGE_AI_FINOPS,
        sortOrder: 95,
      },
      {
        title: 'Users',
        path: '/admin/users',
        icon: 'Users',
        permission: PERMISSIONS.MANAGE_USERS,
        sortOrder: 92,
      },
      {
        title: 'Roles',
        path: '/admin/roles',
        icon: 'Shield',
        permission: PERMISSIONS.MANAGE_ROLES,
        sortOrder: 93,
      },
      {
        title: 'Menus',
        path: '/admin/menus',
        icon: 'Menu',
        permission: PERMISSIONS.MANAGE_MENUS,
        sortOrder: 94,
      },
      {
        title: 'Settings',
        path: '/admin/settings',
        icon: 'Settings',
        permission: PERMISSIONS.MANAGE_SETTINGS,
        sortOrder: 95,
      },
    ]

    for (const item of adminMenuItems) {
      await Menu.updateOrCreate({ path: item.path }, { ...item, parentId: adminGroup.id })
    }

    // 6. Default Settings
    const defaultSettings = [
      { key: 'platform_name', value: 'NexQuery AI', type: 'string', group: 'platform' },
      { key: 'require_2fa', value: 'true', type: 'boolean', group: 'security' },
      { key: 'allow_export', value: 'true', type: 'boolean', group: 'security' },
      { key: 'show_watermark', value: 'true', type: 'boolean', group: 'security' },
      { key: 'query_timeout_ms', value: '30000', type: 'number', group: 'engine' },
      { key: 'ai_provider', value: 'openai', type: 'string', group: 'ai', label: 'AI Provider', description: 'The AI Provider to use (e.g., openai, deepseek, glm).' },
      { key: 'ai_base_url', value: 'https://api.openai.com/v1', type: 'string', group: 'ai', label: 'AI Base URL', description: 'Base URL for the AI Provider API.' },
      { key: 'ai_api_key', value: '', type: 'string', group: 'ai', label: 'AI API Key', description: 'API Key for the AI Provider.' },
      { key: 'ai_chat_model', value: 'gpt-4o', type: 'string', group: 'ai' },
      { key: 'ai_embedding_model', value: 'text-embedding-3-small', type: 'string', group: 'ai', label: 'AI Embedding Model', description: 'Model for text embeddings (e.g., embedding-3).' },
      { key: 'ai_timeout_sec', value: '600', type: 'number', group: 'ai', label: 'AI Request Timeout', description: 'Maximum duration in seconds for AI models to respond.' },
      { key: 'workflow_bindings', value: '{}', type: 'string', group: 'workflow' },
    ]

    for (const s of defaultSettings) {
      const existing = await Setting.findBy('key', s.key)
      if (existing) {
        // Only update metadata, preserve user-configured 'value'
        existing.merge({
          type: s.type,
          group: s.group,
          label: s.label || existing.label,
          description: s.description || existing.description,
        })
        await existing.save()
      } else {
        await Setting.create(s)
      }
    }

    // 7. Seed Knowledge Base (Consolidated from knowledge_seeder.ts)
    const kbCount = await KnowledgeBase.query().count('* as total').first()
    if (!kbCount || Number(kbCount.$extras.total) === 0) {
      const kbItems = [
        {
          keyword: 'Active User',
          description: 'Users who are currently enabled in the system.',
          exampleSql: 'status = \'active\' AND is_active = true',
        },
        {
          keyword: 'Admin User',
          description: 'Users with the administrator role.',
          exampleSql:
            'EXISTS (SELECT 1 FROM role_users JOIN roles ON roles.id = role_users.role_id WHERE role_users.user_id = users.id AND roles.slug = \'admin\')',
        },
        {
          keyword: 'Failed Query',
          description: 'Queries that did not execute successfully.',
          exampleSql: 'status = \'failed\'',
        },
        {
          keyword: 'Recent Activity',
          description: 'Activity logs from the last 24 hours.',
          exampleSql: 'created_at >= NOW() - INTERVAL 1 DAY',
        },
        {
          keyword: 'Slow Query',
          description: 'Queries that took longer than 1 second (1000ms) to execute.',
          exampleSql: 'duration_ms > 1000',
        },
        {
          keyword: 'MySQL Source',
          description: 'Data sources connecting to a MySQL database.',
          exampleSql: 'type = \'mysql\'',
        },
        {
          keyword: 'Production Source',
          description: 'Data sources marked as production environment.',
          exampleSql: 'is_production = true',
        },
        {
          keyword: 'High Frequency User',
          description: 'Users who have executed more than 100 queries.',
          exampleSql:
            'id IN (SELECT user_id FROM query_logs GROUP BY user_id HAVING COUNT(*) > 100)',
        },
      ]
      await KnowledgeBase.createMany(kbItems)
    }

    // 8. FINAL PERMISSION SNYC (Ensure Admin has ALL permissions)
    // Fetch ALL permissions from DB (including any that might have been created dynamically if logic changed)
    const allPermissions = await Permission.all()
    await adminRole.related('permissions').sync(allPermissions.map(p => p.id))
    logger.info(`Assigned ${allPermissions.length} permissions to Admin role`)
  }
}
