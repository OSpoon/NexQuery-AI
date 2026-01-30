export declare const WORKFLOW_CONSTANTS: {
    API: {
        BASE_PATH: string;
        ENDPOINTS: {
            PROCESS_DEFINITIONS: string;
            DEPLOYMENTS: string;
            PROCESS_INSTANCES: string;
            TASKS: string;
            QUERY_TASKS: string;
            QUERY_PROCESS_INSTANCES: string;
            QUERY_HISTORIC_PROCESS_INSTANCES: string;
            QUERY_HISTORIC_TASK_INSTANCES: string;
            IDENTITY_USERS: string;
            IDENTITY_GROUPS: string;
        };
        DEFAULTS: {
            HOST: string;
            USER: string;
            PASSWORD: string;
        };
    };
    VARIABLES: {
        APPROVED: string;
        COMMENT: string;
        LAST_COMMENT: string;
        INITIATOR: string;
        TASK_ID: string;
        SQL_QUERY: string;
        DATA_SOURCE_ID: string;
        REQUEST_PARAMS: string;
        TASK_OUTCOME: string;
        APPROVER: string;
        RISK_LEVEL: string;
        ADMIN_USER: string;
    };
    STATUS: {
        IDLE: string;
        PENDING: string;
        APPROVED: string;
        REJECTED: string;
    };
    CONFIG: {
        TIME_INTEGRITY_BUFFER_MS: number;
        DEFAULT_REASON: string;
    };
};
