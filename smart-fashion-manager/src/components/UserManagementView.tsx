/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/StateContext';
import { SystemUser, PermissionModuleKey, PermissionActionKey, ModulePermissions, UserPermissions } from '../types';
import { UserRole, ROLES, DEFAULT_ROLE_PERMISSIONS, PERMISSION_GROUPS } from '../utils/rbac';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  User,
  Power,
  Eye,
  EyeOff,
  Sliders,
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const {
    currentRole,
    systemUsers,
    addSystemUser,
    updateSystemUser,
    resetUserPassword,
    deleteSystemUser,
    toggleUserStatus,
    auditLogs,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<SystemUser | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<SystemUser | null>(null);

  // Form Field States
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Custom Permissions State
  const [isCustomPermissions, setIsCustomPermissions] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<UserPermissions>(
    JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.cashier))
  );

  // Password Reset Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Password visibility toggles
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Error & Toast States
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return systemUsers.filter((u) => {
      const matchesSearch =
        (u.fullName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (u.username || '').toLowerCase().includes((searchTerm || '').toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [systemUsers, searchTerm, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: systemUsers.length,
      admins: systemUsers.filter((u) => u.role === 'admin' && u.status === 'active').length,
      managers: systemUsers.filter((u) => u.role === 'manager' && u.status === 'active').length,
      cashiers: systemUsers.filter((u) => u.role === 'cashier' && u.status === 'active').length,
    };
  }, [systemUsers]);

  // Handlers
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[newRole])));
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setRole('cashier');
    setStatus('active');
    setIsCustomPermissions(false);
    setPermissions(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS.cashier)));
    setFormError(null);
    setShowPass(false);
    setShowConfirmPass(false);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setUsername(user.username);
    setPassword('');
    setConfirmPassword('');
    setRole(user.role);
    setStatus(user.status);
    setIsCustomPermissions(!!user.isCustomPermissions);
    if (user.permissions) {
      setPermissions(JSON.parse(JSON.stringify(user.permissions)));
    } else {
      setPermissions(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[user.role])));
    }
    setFormError(null);
    setShowPass(false);
    setShowConfirmPass(false);
    setIsAddEditModalOpen(true);
  };

  const handlePermissionChange = (
    moduleKey: PermissionModuleKey,
    actionKey: PermissionActionKey,
    checked: boolean
  ) => {
    setPermissions((prev) => {
      const currentMod = prev[moduleKey] || { view: false, add: false, edit: false, delete: false };
      let newMod: ModulePermissions;

      if (actionKey === 'view') {
        if (!checked) {
          // If View is unchecked, automatically disable and uncheck Add, Edit, and Delete
          newMod = { view: false, add: false, edit: false, delete: false };
        } else {
          newMod = { ...currentMod, view: true };
        }
      } else {
        // If Add, Edit, or Delete is checked, View must automatically become checked
        if (checked) {
          newMod = { ...currentMod, [actionKey]: true, view: true };
        } else {
          newMod = { ...currentMod, [actionKey]: false };
        }
      }

      return { ...prev, [moduleKey]: newMod };
    });
  };

  const handleSelectAllPermissions = () => {
    const updated = { ...permissions };
    (Object.keys(updated) as PermissionModuleKey[]).forEach((mKey) => {
      updated[mKey] = { view: true, add: true, edit: true, delete: true };
    });
    setPermissions(updated);
  };

  const handleClearAllPermissions = () => {
    const updated = { ...permissions };
    (Object.keys(updated) as PermissionModuleKey[]).forEach((mKey) => {
      updated[mKey] = { view: false, add: false, edit: false, delete: false };
    });
    setPermissions(updated);
  };

  const handleResetRoleDefaults = () => {
    setPermissions(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role])));
  };

  const handleOpenResetPasswordModal = (user: SystemUser) => {
    setResetTargetUser(user);
    setNewPassword('');
    setConfirmNewPassword('');
    setFormError(null);
    setShowPass(false);
    setShowConfirmPass(false);
    setIsResetPasswordModalOpen(true);
  };

  // Logged-in / current user calculation
  const currentUser = useMemo(() => {
    return systemUsers.find((u) => u.role === currentRole) || systemUsers[0];
  }, [systemUsers, currentRole]);

  const handleOpenDeleteModal = (user: SystemUser) => {
    if (currentUser && (user.id === currentUser.id || user.username === currentUser.username)) {
      showToast('You cannot delete your own logged-in account.', 'error');
      return;
    }
    const activeAdminCount = systemUsers.filter((u) => u.role === 'admin' && u.status === 'active').length;
    if (user.role === 'admin' && activeAdminCount <= 1) {
      showToast('The last remaining Admin account cannot be deleted.', 'error');
      return;
    }
    setDeleteTargetUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Full Name is required');
      return;
    }

    if (!username.trim()) {
      setFormError('Username is required');
      return;
    }

    if (username.trim().length < 3) {
      setFormError('Username must be at least 3 characters');
      return;
    }

    if (!editingUser) {
      // Adding new user validation
      if (!password) {
        setFormError('Password is required');
        return;
      }
      if (password.length < 3) {
        setFormError('Password must be at least 3 characters');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match');
        return;
      }

      const res = addSystemUser({
        fullName: fullName.trim(),
        username: username.trim(),
        password,
        role,
        status,
        isCustomPermissions,
        permissions: isCustomPermissions ? permissions : DEFAULT_ROLE_PERMISSIONS[role],
      });

      if (!res.success) {
        setFormError(res.message || 'Failed to add user');
        return;
      }

      showToast(res.message || 'User added successfully', 'success');
      setIsAddEditModalOpen(false);
    } else {
      // Editing existing user
      const res = updateSystemUser(editingUser.id, {
        fullName: fullName.trim(),
        username: username.trim(),
        role,
        status,
        isCustomPermissions,
        permissions: isCustomPermissions ? permissions : DEFAULT_ROLE_PERMISSIONS[role],
      });

      if (!res.success) {
        setFormError(res.message || 'Failed to update user');
        return;
      }

      showToast(res.message || 'User updated successfully', 'success');
      setIsAddEditModalOpen(false);
    }
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!resetTargetUser) return;

    if (!newPassword) {
      setFormError('New password is required');
      return;
    }

    if (newPassword.length < 3) {
      setFormError('Password must be at least 3 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setFormError('Passwords do not match');
      return;
    }

    const res = resetUserPassword(resetTargetUser.id, newPassword);

    if (!res.success) {
      setFormError(res.message || 'Failed to reset password');
      return;
    }

    showToast(res.message || 'Password reset successfully', 'success');
    setIsResetPasswordModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetUser) return;

    const res = deleteSystemUser(deleteTargetUser.id, currentUser?.id || currentUser?.username);
    if (!res.success) {
      showToast(res.message || 'Failed to delete user', 'error');
    } else {
      showToast(res.message || 'User deleted successfully', 'success');
    }
    setIsDeleteModalOpen(false);
  };

  const handleToggleStatus = (user: SystemUser) => {
    const res = toggleUserStatus(user.id);
    if (!res.success) {
      showToast(res.message || 'Failed to change user status', 'error');
    } else {
      showToast(res.message || 'User status updated', 'success');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[2000] px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-xs font-semibold animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 className="font-serif text-xl font-bold text-amber-100">User Management Studio</h2>
              <span className="text-[10px] bg-amber-500/15 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                RBAC Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Create and manage system credentials, role designations, password resets, and account statuses.
            </p>
          </div>

          {activeTab === 'users' && (
            <button
              id="btn-add-user"
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 gold-gradient text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:opacity-90 transition active:scale-95 shadow-lg cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              Add New User
            </button>
          )}
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-slate-800 pb-px mb-4">
        <button
          id="btn-tab-users"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition ${
            activeTab === 'users'
              ? 'border-amber-500 text-amber-400 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          User Accounts
        </button>
        <button
          id="btn-tab-audit"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-bold tracking-wider uppercase border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-amber-500 text-amber-400 font-black'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Security Audit Trail
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Accounts</span>
            <span className="text-lg font-bold text-slate-100 font-mono">{stats.total}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider block">Active Admins</span>
            <span className="text-lg font-bold text-amber-300 font-mono">{stats.admins}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-blue-400/90 uppercase tracking-wider block">Managers</span>
            <span className="text-lg font-bold text-blue-300 font-mono">{stats.managers}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <UserCheckIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-400/90 uppercase tracking-wider block">Cashiers</span>
            <span className="text-lg font-bold text-emerald-300 font-mono">{stats.cashiers}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-users"
            type="text"
            placeholder="Search name or @username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Filters:</span>
          
          <select
            id="select-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
          </select>

          <select
            id="select-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-3.5 pl-5">User</th>
                <th className="p-3.5">Username</th>
                <th className="p-3.5">Assigned Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5 text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60 text-xs text-slate-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No user accounts found matching query filters.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleMeta = ROLES[u.role] || ROLES.cashier;
                  const activeAdminCount = systemUsers.filter((usr) => usr.role === 'admin' && usr.status === 'active').length;
                  const isLastAdmin = u.role === 'admin' && activeAdminCount <= 1;
                  const isSelf = currentUser && (u.id === currentUser.id || u.username === currentUser.username);
                  const cannotDelete = isLastAdmin || isSelf;
                  const isPrimaryAdmin = u.id === 'usr_admin';

                  const deleteTooltip = isSelf
                    ? 'You cannot delete your own logged-in account'
                    : isLastAdmin
                    ? 'The last remaining Admin account cannot be deleted'
                    : 'Delete Account';

                  const toggleTooltip = isLastAdmin && u.status === 'active'
                    ? 'The last active Admin account cannot be deactivated'
                    : u.status === 'active'
                    ? 'Deactivate Account'
                    : 'Activate Account';

                  return (
                    <tr key={u.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isPrimaryAdmin && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                                  System Main
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-amber-400/90 text-xs">
                        @{u.username}
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${roleMeta.badgeColor}`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            {roleMeta.label}
                          </span>
                          {u.isCustomPermissions && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              <Sliders className="w-2.5 h-2.5" />
                              Custom Perms
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                            }`}
                          />
                          {u.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px] font-mono">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="p-3.5 text-right pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit User */}
                          <button
                            id={`btn-user-edit-${u.id}`}
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition cursor-pointer"
                            title="Edit User Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            id={`btn-user-reset-pass-${u.id}`}
                            onClick={() => handleOpenResetPasswordModal(u)}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/30 transition cursor-pointer"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          <button
                            id={`btn-user-toggle-status-${u.id}`}
                            onClick={() => handleToggleStatus(u)}
                            disabled={isLastAdmin && u.status === 'active'}
                            className={`p-1.5 rounded-lg bg-slate-950 border border-slate-800 transition ${
                              isLastAdmin && u.status === 'active'
                                ? 'opacity-30 cursor-not-allowed text-slate-600'
                                : u.status === 'active'
                                ? 'text-emerald-400 hover:text-rose-400 cursor-pointer'
                                : 'text-rose-400 hover:text-emerald-400 cursor-pointer'
                            }`}
                            title={toggleTooltip}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          <button
                            id={`btn-user-delete-${u.id}`}
                            onClick={() => handleOpenDeleteModal(u)}
                            disabled={cannotDelete}
                            className={`p-1.5 rounded-lg bg-slate-950 border border-slate-800 transition ${
                              cannotDelete
                                ? 'opacity-30 cursor-not-allowed text-slate-600'
                                : 'text-slate-400 hover:text-rose-400 hover:border-rose-500/30 cursor-pointer'
                            }`}
                            title={deleteTooltip}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          {/* Security Summary Alert */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security Log State</span>
                <span className="text-xs font-semibold text-amber-300">Administrative Cryptographic Integrity Maintained</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Recorded Incidents</span>
              <span className="text-sm font-bold text-slate-100 font-mono">{auditLogs ? auditLogs.length : 0}</span>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-3.5 pl-5">Timestamp</th>
                    <th className="p-3.5">Security Event</th>
                    <th className="p-3.5">Details</th>
                    <th className="p-3.5 pr-5">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-xs text-slate-300">
                  {!auditLogs || auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-500">
                        <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                        <p className="text-xs">No recorded security event logs in this session.</p>
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      let badgeColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
                      if (log.action.includes("Failed") || log.action.includes("Lockout")) {
                        badgeColor = "bg-rose-500/15 text-rose-400 border-rose-500/20";
                      } else if (log.action.includes("Success")) {
                        badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
                      } else if (log.action.includes("Delete")) {
                        badgeColor = "bg-rose-500/15 text-rose-400 border-rose-500/20";
                      } else if (log.action.includes("Create")) {
                        badgeColor = "bg-blue-500/15 text-blue-400 border-blue-500/20";
                      } else if (log.action.includes("Reset") || log.action.includes("Status") || log.action.includes("Toggle")) {
                        badgeColor = "bg-amber-500/15 text-amber-400 border-amber-500/20";
                      }

                      return (
                        <tr key={log.id} className="hover:bg-slate-950/30 transition">
                          <td className="p-3.5 pl-5 font-mono text-[11px] text-slate-400">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3.5 font-bold">
                            <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-mono ${badgeColor}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-300">{log.details}</td>
                          <td className="p-3.5 pr-5 font-medium text-amber-400">@{log.user}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT USER MODAL */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-[1500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  {editingUser ? 'Edit User Account' : 'Create System User'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  id="input-user-fullname"
                  type="text"
                  placeholder="e.g., Rajesh Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
                  <input
                    id="input-user-username"
                    type="text"
                    placeholder="rajesh_sharma"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-amber-300 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>
              </div>

              {/* Passwords (Only for Adding) */}
              {!editingUser && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="input-user-password"
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="input-user-confirm-password"
                        type={showConfirmPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Assign Role Designation
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'manager', 'cashier'] as UserRole[]).map((rKey) => {
                    const rData = ROLES[rKey];
                    const isSelected = role === rKey;
                    const isPrimary = editingUser?.id === 'usr_admin' && rKey !== 'admin';

                    return (
                      <button
                        key={rKey}
                        type="button"
                        disabled={isPrimary}
                        onClick={() => handleRoleChange(rKey)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col items-center justify-center gap-1 transition ${
                          isPrimary
                            ? 'opacity-30 cursor-not-allowed border-slate-800 bg-slate-950'
                            : isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-amber-200 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold">{rData.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Account Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={editingUser?.id === 'usr_admin'}
                    onClick={() => setStatus('active')}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      status === 'active'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Active
                  </button>

                  <button
                    type="button"
                    disabled={editingUser?.id === 'usr_admin'}
                    onClick={() => setStatus('inactive')}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      editingUser?.id === 'usr_admin'
                        ? 'opacity-30 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-600'
                        : status === 'inactive'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    Inactive
                  </button>
                </div>
              </div>

              {/* ADVANCED MODULE PERMISSIONS SECTION */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div>
                    <label htmlFor="toggle-custom-permissions" className="text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      Custom Permissions
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Enable module-level permission overrides for this account.
                    </p>
                  </div>
                  <input
                    id="toggle-custom-permissions"
                    type="checkbox"
                    checked={isCustomPermissions}
                    onChange={(e) => setIsCustomPermissions(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer accent-amber-500"
                  />
                </div>

                {isCustomPermissions && (
                  <div className="mt-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-3 animate-fadeIn">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        Permission Matrix
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSelectAllPermissions}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md text-[10px] font-semibold transition cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllPermissions}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md text-[10px] font-semibold transition cursor-pointer"
                        >
                          Clear All
                        </button>
                        <button
                          type="button"
                          onClick={handleResetRoleDefaults}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10px] font-semibold transition cursor-pointer"
                        >
                          Reset to Role Defaults
                        </button>
                      </div>
                    </div>

                    {/* Compact Permission Table */}
                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900/90 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                            <th className="p-2 pl-3">Module</th>
                            <th className="p-2 text-center w-16">View</th>
                            <th className="p-2 text-center w-16">Add</th>
                            <th className="p-2 text-center w-16">Edit</th>
                            <th className="p-2 text-center w-16">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {PERMISSION_GROUPS.map((group) => (
                            <React.Fragment key={group.category}>
                              {/* Category Header Row */}
                              <tr className="bg-slate-900/80 font-bold text-[10px] text-amber-400 uppercase tracking-wider">
                                <td colSpan={5} className="py-1.5 px-3 border-t border-slate-800">
                                  {group.category}
                                </td>
                              </tr>
                              {/* Module Rows */}
                              {group.modules.map((mod) => {
                                const modPerm = permissions[mod.key] || { view: false, add: false, edit: false, delete: false };
                                const isOtherDisabled = !modPerm.view;

                                return (
                                  <tr key={mod.key} className="hover:bg-slate-900/40 transition">
                                    <td className="p-2 pl-4 text-slate-200 font-medium text-xs">
                                      {mod.label}
                                    </td>
                                    <td className="p-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={modPerm.view}
                                        onChange={(e) => handlePermissionChange(mod.key, 'view', e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer accent-amber-500"
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={modPerm.add}
                                        disabled={isOtherDisabled}
                                        onChange={(e) => handlePermissionChange(mod.key, 'add', e.target.checked)}
                                        className={`w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 accent-amber-500 ${
                                          isOtherDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={modPerm.edit}
                                        disabled={isOtherDisabled}
                                        onChange={(e) => handlePermissionChange(mod.key, 'edit', e.target.checked)}
                                        className={`w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 accent-amber-500 ${
                                          isOtherDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={modPerm.delete}
                                        disabled={isOtherDisabled}
                                        onChange={(e) => handlePermissionChange(mod.key, 'delete', e.target.checked)}
                                        className={`w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 accent-amber-500 ${
                                          isOtherDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  id="btn-save-user-submit"
                  type="submit"
                  className="gold-gradient text-slate-950 font-bold px-5 py-2 rounded-xl text-xs uppercase tracking-wider hover:opacity-90 transition active:scale-95 shadow-md cursor-pointer"
                >
                  {editingUser ? 'Save Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && resetTargetUser && (
        <div className="fixed inset-0 z-[1500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-400" />
                <h3 className="font-serif text-base font-bold text-slate-100">Reset Password</h3>
              </div>
              <button
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-xs">
                {resetTargetUser.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">{resetTargetUser.fullName}</p>
                <p className="text-[10px] font-mono text-amber-400">@{resetTargetUser.username}</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  New Password
                </label>
                <input
                  id="input-reset-new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="input-reset-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-reset-password"
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && deleteTargetUser && (
        <div className="fixed inset-0 z-[1500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-serif text-lg font-bold text-slate-100">Delete User Account?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-200">{deleteTargetUser.fullName}</strong> (
                <span className="font-mono text-amber-400">@{deleteTargetUser.username}</span>)?
              </p>
              <p className="text-[10px] text-rose-400/90 mt-2">This account deletion is permanent and cannot be undone.</p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-user"
                type="button"
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Icon for Cashier stats
const UserCheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);
