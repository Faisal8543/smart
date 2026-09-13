/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PermissionModuleKey, PermissionActionKey, UserPermissions } from '../types';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface RolePermissions {
  role: UserRole;
  label: string;
  description: string;
  badgeColor: string;
}

export const ROLES: Record<UserRole, RolePermissions> = {
  admin: {
    role: 'admin',
    label: 'Admin',
    description: 'Full access to every module and every system action.',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  manager: {
    role: 'manager',
    label: 'Manager',
    description: 'Operations management, catalog, sales, and customer relations.',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  cashier: {
    role: 'cashier',
    label: 'Cashier',
    description: 'POS billing, customer search, walk-in creation, and invoice printing.',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    dashboard: { view: true, add: true, edit: true, delete: true },
    pos: { view: true, add: true, edit: true, delete: true },
    products: { view: true, add: true, edit: true, delete: true },
    customers: { view: true, add: true, edit: true, delete: true },
    discountCards: { view: true, add: true, edit: true, delete: true },
    promotions: { view: true, add: true, edit: true, delete: true },
    creditLedger: { view: true, add: true, edit: true, delete: true },
    suppliers: { view: true, add: true, edit: true, delete: true },
    reports: { view: true, add: true, edit: true, delete: true },
    expenses: { view: true, add: true, edit: true, delete: true },
    settings: { view: true, add: true, edit: true, delete: true },
    userManagement: { view: true, add: true, edit: true, delete: true },
  },
  manager: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: true },
    products: { view: true, add: true, edit: true, delete: false },
    customers: { view: true, add: true, edit: true, delete: false },
    discountCards: { view: true, add: true, edit: true, delete: false },
    promotions: { view: true, add: true, edit: true, delete: true },
    creditLedger: { view: true, add: true, edit: true, delete: false },
    suppliers: { view: true, add: false, edit: false, delete: false },
    reports: { view: true, add: false, edit: false, delete: false },
    expenses: { view: true, add: true, edit: true, delete: false },
    settings: { view: true, add: false, edit: false, delete: false },
    userManagement: { view: false, add: false, edit: false, delete: false },
  },
  cashier: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    products: { view: true, add: false, edit: false, delete: false },
    customers: { view: true, add: true, edit: false, delete: false },
    discountCards: { view: true, add: false, edit: false, delete: false },
    promotions: { view: true, add: false, edit: false, delete: false },
    creditLedger: { view: true, add: false, edit: false, delete: false },
    suppliers: { view: false, add: false, edit: false, delete: false },
    reports: { view: true, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false },
    userManagement: { view: false, add: false, edit: false, delete: false },
  },
};

export interface PermissionModuleMeta {
  key: PermissionModuleKey;
  label: string;
}

export interface PermissionCategoryGroup {
  category: 'Sales' | 'Inventory' | 'CRM' | 'Reports' | 'Settings';
  modules: PermissionModuleMeta[];
}

export const PERMISSION_GROUPS: PermissionCategoryGroup[] = [
  {
    category: 'Sales',
    modules: [
      { key: 'pos', label: 'POS Billing' },
      { key: 'promotions', label: 'Promotions & Offers' },
    ],
  },
  {
    category: 'Inventory',
    modules: [
      { key: 'products', label: 'Products & Catalog' },
      { key: 'suppliers', label: 'Suppliers' },
    ],
  },
  {
    category: 'CRM',
    modules: [
      { key: 'customers', label: 'Customers' },
      { key: 'discountCards', label: 'Discount Cards' },
      { key: 'creditLedger', label: 'Credit Ledger' },
    ],
  },
  {
    category: 'Reports',
    modules: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'reports', label: 'Sales Reports' },
      { key: 'expenses', label: 'Expenses' },
    ],
  },
  {
    category: 'Settings',
    modules: [
      { key: 'settings', label: 'Store Settings' },
      { key: 'userManagement', label: 'User Management' },
    ],
  },
];

export function mapToPermissionModuleKey(module: string): PermissionModuleKey | null {
  if (module === 'pos') return 'pos';
  if (module === 'promotions') return 'promotions';
  if (module === 'products') return 'products';
  if (module === 'suppliers') return 'suppliers';
  if (module === 'customers') return 'customers';
  if (module === 'discount-cards' || module === 'discountCards') return 'discountCards';
  if (module === 'creditLedger' || module === 'credit-ledger') return 'creditLedger';
  if (module === 'dashboard') return 'dashboard';
  if (module === 'reports') return 'reports';
  if (module === 'expenses') return 'expenses';
  if (module === 'settings' || module === 'masters') return 'settings';
  if (module === 'user_management' || module === 'userManagement') return 'userManagement';
  return null;
}

export function mapToActionKey(action: string): PermissionActionKey {
  if (action === 'view') return 'view';
  if (action === 'delete') return 'delete';
  if (action === 'add' || action === 'walkin_customer' || action === 'issue_card' || action === 'renew_card') return 'add';
  return 'edit';
}

export type ModuleName =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'reports'
  | 'expenses'
  | 'promotions'
  | 'discount-cards'
  | 'settings'
  | 'masters';

export type ActionName =
  | 'view'
  | 'add'
  | 'edit'
  | 'delete'
  | 'update_stock'
  | 'issue_card'
  | 'renew_card'
  | 'walkin_customer'
  | 'apply_coupon'
  | 'print_invoice'
  | 'settings_modify'
  | 'user_management'
  | 'security_backup';

/**
 * Checks if a given user role has permission to perform an action on a module.
 */
export function hasPermission(
  role: UserRole,
  module: ModuleName,
  action: ActionName
): boolean {
  // 1. Admin has full access to every module and every action.
  if (role === 'admin') {
    return true;
  }

  // 2. Manager Role
  if (role === 'manager') {
    // Full access to POS Billing
    if (module === 'pos') {
      return true;
    }

    // Full access to Promotions
    if (module === 'promotions') {
      return true;
    }

    // Products & Catalog: View, Add, Edit, Update Stock. Delete = Not Allowed
    if (module === 'products') {
      if (action === 'delete') return false;
      return true;
    }

    // Customers: View, Add, Edit. Delete = Not Allowed
    if (module === 'customers') {
      if (action === 'delete') return false;
      return true;
    }

    // Discount Cards: View, Create/Add, Issue, Renew, Edit. Delete = Not Allowed
    if (module === 'discount-cards') {
      if (action === 'delete') return false;
      return true;
    }

    // Expenses: View, Add, Edit. Delete = Not Allowed
    if (module === 'expenses') {
      if (action === 'delete') return false;
      return true;
    }

    // All other modules (Dashboard, Suppliers, Sales Reports, Store Settings, Masters):
    // View Only; No Add/Edit/Delete/Settings Modification
    if (action === 'view') {
      return true;
    }

    return false;
  }

  // 3. Cashier Role
  if (role === 'cashier') {
    // Allowed POS Billing actions
    if (module === 'pos') {
      if (
        action === 'view' ||
        action === 'add' ||
        action === 'edit' ||
        action === 'walkin_customer' ||
        action === 'apply_coupon' ||
        action === 'print_invoice' ||
        action === 'issue_card' ||
        action === 'renew_card' ||
        action === 'update_stock'
      ) {
        return true;
      }
      return false;
    }

    // Customers module: Search & Walk-in Customer Creation allowed
    if (module === 'customers') {
      if (action === 'view' || action === 'walkin_customer' || action === 'add') {
        return true;
      }
      return false; // Cashier cannot edit or delete existing customers
    }

    // All other modules: View Only
    if (action === 'view') {
      return true;
    }

    // Cashier Restrictions: No Add, No Edit, No Delete, No Store Settings modification, No User Management, No Security & Backup changes
    return false;
  }

  return false;
}

/**
 * Checks permission for a specific user object (supporting custom permissions)
 */
export function hasUserPermission(
  user: { role: UserRole; isCustomPermissions?: boolean; permissions?: UserPermissions } | null | undefined,
  module: ModuleName | string,
  action: ActionName | string
): boolean {
  if (!user) return false;

  if (user.isCustomPermissions && user.permissions) {
    const modKey = mapToPermissionModuleKey(module);
    const actKey = mapToActionKey(action);
    if (modKey && user.permissions[modKey]) {
      return !!user.permissions[modKey][actKey];
    }
  }

  return hasPermission(user.role, module as ModuleName, action as ActionName);
}

/**
 * Returns a user-friendly error message when an action is unauthorized for a role.
 */
export function getPermissionDeniedReason(
  role: UserRole,
  module: ModuleName,
  action: ActionName
): string {
  const roleLabel = ROLES[role]?.label || role;
  const actionLabel = action.replace(/_/g, ' ');
  return `Insufficient Permission: ${roleLabel} role is not authorized to ${actionLabel} in ${module}.`;
}
