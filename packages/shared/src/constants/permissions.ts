export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_DATA_SOURCES: 'manage_data_sources',
  MANAGE_TASKS: 'manage_tasks',
  VIEW_HISTORY: 'view_history',
  MANAGE_USERS: 'manage_users', // Admin group (users, roles, menus, settings)
  MANAGE_ROLES: 'manage_roles',
  MANAGE_MENUS: 'manage_menus',
  MANAGE_API_KEYS: 'manage_api_keys',
  MANAGE_AI_FEEDBACK: 'manage_ai_feedback',
  MANAGE_KNOWLEDGE_BASE: 'manage_knowledge_base',
  MANAGE_SETTINGS: 'manage_settings',
  WORKFLOW_INITIATE: 'workflow:initiate',
  WORKFLOW_APPROVE: 'workflow:approve',
} as const

export const PERMISSION_DETAILS = [
  {
    name: 'View Dashboard',
    slug: PERMISSIONS.VIEW_DASHBOARD,
    description: 'Can view the main dashboard',
  },
  {
    name: 'Manage Data Sources',
    slug: PERMISSIONS.MANAGE_DATA_SOURCES,
    description: 'Can create/edit/delete data sources',
  },
  {
    name: 'Manage Tasks',
    slug: PERMISSIONS.MANAGE_TASKS,
    description: 'Can create/edit/delete query tasks',
  },
  {
    name: 'View History',
    slug: PERMISSIONS.VIEW_HISTORY,
    description: 'Can view query execution history',
  },
  {
    name: 'Manage Users/Admin',
    slug: PERMISSIONS.MANAGE_USERS,
    description: 'Can manage platform users and general admin settings',
  },
  {
    name: 'Manage Roles',
    slug: PERMISSIONS.MANAGE_ROLES,
    description: 'Can define roles and permissions',
  },
  {
    name: 'Manage Menus',
    slug: PERMISSIONS.MANAGE_MENUS,
    description: 'Can configure sidebar navigation',
  },
  {
    name: 'Manage API Keys',
    slug: PERMISSIONS.MANAGE_API_KEYS,
    description: 'Can manage API keys (API Access)',
  },
  {
    name: 'Manage AI Feedback',
    slug: PERMISSIONS.MANAGE_AI_FEEDBACK,
    description: 'Can review user ratings and promote corrections to Knowledge Base',
  },
  {
    name: 'Manage Knowledge Base',
    slug: PERMISSIONS.MANAGE_KNOWLEDGE_BASE,
    description: 'Can manage vector search knowledge base',
  },
  {
    name: 'Manage Settings',
    slug: PERMISSIONS.MANAGE_SETTINGS,
    description: 'Can update platform-wide settings',
  },
  {
    name: 'Initiate Workflow',
    slug: PERMISSIONS.WORKFLOW_INITIATE,
    description: 'Can trigger approval workflows for high-risk operations',
  },
  {
    name: 'Approve Workflow',
    slug: PERMISSIONS.WORKFLOW_APPROVE,
    description: 'Can review and approve/reject pending workflow tasks',
  },
]
