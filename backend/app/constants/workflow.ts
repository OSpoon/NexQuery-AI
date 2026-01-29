export const WORKFLOW_CONSTANTS = {
  // Flowable API
  API: {
    BASE_PATH: '/flowable-ui/process-api',
    ENDPOINTS: {
      PROCESS_DEFINITIONS: '/repository/process-definitions',
      DEPLOYMENTS: '/repository/deployments',
      PROCESS_INSTANCES: '/runtime/process-instances',
      TASKS: '/runtime/tasks',
      QUERY_TASKS: '/query/tasks',
      QUERY_PROCESS_INSTANCES: '/query/process-instances',
      QUERY_HISTORIC_PROCESS_INSTANCES: '/query/historic-process-instances',
      QUERY_HISTORIC_TASK_INSTANCES: '/query/historic-task-instances',
      IDENTITY_USERS: '/identity/users',
      IDENTITY_GROUPS: '/identity/groups',
    },
    DEFAULTS: {
      HOST: 'http://localhost:8080',
      USER: 'admin',
      PASSWORD: 'test',
    },
  },

  // BPMN Process Variables (Contract between App and Flowable)
  VARIABLES: {
    APPROVED: 'approved',
    COMMENT: 'comment',
    LAST_COMMENT: 'lastComment',
    INITIATOR: 'initiator',
    TASK_ID: 'taskId',
    SQL_QUERY: 'sqlQuery',
    DATA_SOURCE_ID: 'dataSourceId',
    REQUEST_PARAMS: 'requestParams',
    TASK_OUTCOME: 'taskOutcome',
    APPROVER: 'approver',
    RISK_LEVEL: 'riskLevel',
    ADMIN_USER: 'adminUser',
  },

  // Task/Process Status
  STATUS: {
    IDLE: 'IDLE',
    PENDING: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },

  // Logic Constants
  CONFIG: {
    TIME_INTEGRITY_BUFFER_MS: 1000,
    DEFAULT_REASON: 'Rejected',
  },
}
