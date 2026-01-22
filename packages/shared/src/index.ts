export interface Permission {
    id: number;
    name: string;
    slug: string;
    description?: string;
}

export interface Role {
    id: number;
    name: string;
    slug: string;
    description?: string;
    permissions: Permission[];
}

export interface User {
    id: number;
    fullName: string;
    email: string;
    avatar?: string | null;
    isActive: boolean;
    twoFactorEnabled?: boolean;
    createdAt: string;
    updatedAt?: string;
    roles?: Role[];
    lastPasswordChangeAt?: string;
}

export interface LoginResponse {
    token?: string;
    user?: User;
    requiresTwoFactor?: boolean;
    requiresPasswordChange?: boolean;
    tempToken?: string;
}

export interface RegisterRequest {
    fullName: string;
    email: string;
    password: string;
}

export interface Menu {
    id: number;
    parentId?: number | null;
    title: string;
    path: string;
    icon?: string;
    permission?: string;
    sortOrder: number;
    isActive: boolean;
    children?: Menu[];
    createdAt: string;
    updatedAt?: string;
}
export interface DataSource {
    id: number;
    name: string;
    type: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    database: string;
    isActive: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface QueryTask {
    id: number;
    name: string;
    description?: string;
    sqlTemplate: string;
    formSchema: any[];
    storeResults?: boolean;
    dataSourceId: number;
    dataSource?: DataSource;
    creator?: User;
    createdAt: string;
    updatedAt?: string;
}

export * from './utils/crypto.js'
export * from './constants/permissions.js'
