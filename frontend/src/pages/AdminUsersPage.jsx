import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/Common/StatusBadge';
import Modal from '../components/Common/Modal';

const makeAccountId = () => `ACC-USR-${Date.now().toString().slice(-8)}`;

const emptyNewUser = () => ({
  account_id: makeAccountId(),
  name: '',
  account_type: 'Analyst',
  email: '',
  password_hash: 'hashed_demo_secret',
});

export function AdminUsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ admin: 0, analyst: 0, staff: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Role Drawer State
  const [drawerRole, setDrawerRole] = useState('Analyst');
  const [permissions, setPermissions] = useState({
    review_cases: true,
    trigger_retrain: false,
    adjust_threshold: false,
    manage_users: false,
  });

  // Modal State for Adding User
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser());

  useEffect(() => {
    loadUsers();
  }, []);

  const applyRolePermissions = (role) => {
    const isUserAdmin = (role || '').toLowerCase() === 'admin';
    setPermissions({
      review_cases: true,
      trigger_retrain: isUserAdmin,
      adjust_threshold: isUserAdmin,
      manage_users: isUserAdmin,
    });
  };

  // Always reads from the database, so list and counts survive a refresh.
  // preferredUserId keeps/sets the selected row (e.g. the user just created).
  const loadUsers = async (preferredUserId = null) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [staff, userCounts] = await Promise.all([
        api.getStaffUsers(),
        api.getUserCounts(),
      ]);
      const list = Array.isArray(staff) ? staff : [];
      setUsers(list);
      setCounts({
        admin: userCounts?.admin ?? 0,
        analyst: userCounts?.analyst ?? 0,
        staff: userCounts?.staff ?? list.length,
        total: userCounts?.total ?? list.length,
      });

      setSelectedUser((previous) => {
        const targetId = preferredUserId ?? previous?.user_id;
        const next = list.find((u) => u.user_id === targetId) || list[0] || null;
        if (next) {
          setDrawerRole(next.account_type || 'Analyst');
          applyRolePermissions(next.account_type);
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load users:', err);
      setLoadError(err.message || 'Failed to load users from the database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setDrawerRole(u.account_type || 'Analyst');
    applyRolePermissions(u.account_type);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        account_id: newUser.account_id,
        name: newUser.name,
        account_type: newUser.account_type,
        email: newUser.email,
        password_hash: newUser.password_hash,
      };
      const created = await api.createUser(payload);
      setIsAddUserModalOpen(false);
      setNewUser(emptyNewUser());
      // Re-fetch from the database instead of only appending to local state
      await loadUsers(created?.user_id);
    } catch (err) {
      alert(`Failed to create user: ${err.message}`);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    try {
      await api.updateUser(selectedUser.user_id, {
        account_type: drawerRole,
      });
      await loadUsers(selectedUser.user_id);
      alert(`Role saved for ${selectedUser.name}!`);
    } catch (err) {
      alert(`Failed to update permissions: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(`Delete user #${userId} from database?`)) return;
    try {
      await api.deleteUser(userId);
      if (selectedUser?.user_id === userId) {
        setSelectedUser(null);
      }
      await loadUsers();
    } catch (err) {
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'ALL') return true;
    return u.account_type?.toLowerCase() === roleFilter.toLowerCase();
  });

  // Counts come from the database (not the length of a truncated list)
  const adminCount = counts.admin;
  const analystCount = counts.analyst;
  const staffCount = counts.staff;

  return (
    <div className="space-y-5">
      {/* Page Title & Add CTA */}
      <section className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">
              User Management & Access Control
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-medium">
              FastAPI /users
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-based privilege configuration (RBAC) and user access directory
          </p>
        </div>

        <button
          onClick={() => setIsAddUserModalOpen(true)}
          type="button"
          className="h-8 px-3.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-sm font-bold">person_add</span>
          <span>Create New User</span>
        </button>
      </section>

      {loadError && (
        <div role="alert" className="p-3 rounded-lg border border-red-700/60 bg-red-950/40 text-red-200 text-xs flex items-center justify-between gap-3">
          <span>Could not load users from the database: {loadError}</span>
          <button
            onClick={() => loadUsers()}
            type="button"
            className="px-2.5 py-1 rounded bg-[#0F172A] border border-[#223049] text-slate-200 text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[#131D31] border border-[#1E293B] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Users
            </span>
            <span className="material-symbols-outlined text-cyan-400 text-base">group</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">{staffCount} Users</span>
            <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-800/40 px-2 py-0.5 rounded">
              {adminCount} Admins · {analystCount} Analysts
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Stored in the database ({counts.total.toLocaleString()} total accounts)
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#131D31] border border-[#1E293B] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Role Allocation
            </span>
            <span className="material-symbols-outlined text-emerald-400 text-base">
              badge
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">{adminCount} Admins</span>
            <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
              {analystCount} Analysts
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">tune</span>
            Configured via RBAC Drawer
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#131D31] border border-[#1E293B] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Storage Backend
            </span>
            <span className="material-symbols-outlined text-cyan-400 text-base">database</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">MySQL / TiDB</span>
            <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-800/40 px-2 py-0.5 rounded">
              users Table
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-cyan-400">lock</span>
            Stored with password_hash attribute
          </span>
        </div>
      </div>

      {/* MAIN 2-COLUMN SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT SIDE (60% ~ 7 cols): User Directory Table */}
        <div className="lg:col-span-7 bg-[#131D31] border border-[#1E293B] rounded-lg overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0F172A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-base">people</span>
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                User Directory
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({filteredUsers.length} Users)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-6 pl-2 pr-6 text-[11px] font-medium bg-[#131D31] border border-[#1E293B] text-slate-300 rounded focus:ring-0 focus:border-cyan-400 py-0"
              >
                <option value="ALL">All Roles</option>
                <option value="Admin">Admins only</option>
                <option value="Analyst">Analysts only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0B111E]/60 border-b border-[#1E293B] text-slate-400 font-medium text-[11px] uppercase tracking-wider font-mono">
                  <th className="py-2.5 px-3.5">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Account ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 px-3 text-center text-slate-400">
                      {loading ? 'Loading users...' : 'No admin or analyst accounts yet. Create one to get started.'}
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => {
                  const isSelected = selectedUser?.user_id === u.user_id;
                  const initials = u.name
                    ? u.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : 'U';
                  const isAdminRole = u.account_type?.toLowerCase() === 'admin';

                  return (
                    <tr
                      key={u.user_id}
                      onClick={() => handleSelectUser(u)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#16223A] border-l-2 border-l-cyan-400'
                          : 'hover:bg-[#16223A]/50'
                      }`}
                    >
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-bold text-[11px] font-mono">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">{u.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                            isAdminRole
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50'
                              : 'bg-blue-950/70 text-blue-300 border-blue-800/40'
                          }`}
                        >
                          {u.account_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                        {u.account_id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span className="text-[11px] text-emerald-300">Active</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1 font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectUser(u);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950 font-bold'
                              : 'bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white'
                          }`}
                          type="button"
                        >
                          {isSelected ? 'Editing' : 'Config'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(u.user_id);
                          }}
                          className="px-1.5 py-1 rounded bg-slate-800 hover:bg-red-900/80 text-slate-400 hover:text-white transition-colors"
                          title="Delete user"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT SIDE (40% ~ 5 cols): RBAC Drawer Panel */}
        <div className="lg:col-span-5 bg-[#131D31] border border-[#1E293B] rounded-lg overflow-hidden shadow-lg flex flex-col">
          {selectedUser ? (
            <>
              <div className="p-4 bg-[#0F172A] border-b border-[#1E293B] flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                    <span className="material-symbols-outlined text-base">tune</span>
                    <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
                      User Privilege Configuration
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Configure User: {selectedUser.name}
                  </h3>
                  <span className="text-xs text-slate-400 mt-0.5 font-mono">
                    {selectedUser.account_type} — {selectedUser.email}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4 text-xs font-sans">
                {/* Section 1: Assigned Role */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Assigned Role (Select One)
                  </label>
                  <div className="space-y-2">
                    {/* Admin Role */}
                    <label
                      onClick={() => {
                        setDrawerRole('Admin');
                        setPermissions({
                          review_cases: true,
                          trigger_retrain: true,
                          adjust_threshold: true,
                          manage_users: true,
                        });
                      }}
                      className={`p-3 border rounded flex items-start gap-3 cursor-pointer transition-colors ${
                        drawerRole.toLowerCase() === 'admin'
                          ? 'border-2 border-cyan-500/70 bg-[#0B111E]'
                          : 'border-[#1E293B] bg-[#0B111E]/60 hover:bg-[#16223A]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="project_role"
                        checked={drawerRole.toLowerCase() === 'admin'}
                        onChange={() => {}}
                        className="mt-0.5 text-cyan-400 bg-[#0B111E] border-cyan-400 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">Admin</span>
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-800/50 px-1.5 py-0.2 rounded font-semibold">
                            Full Governance
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Full access to retrain triggers, model threshold overrides, and user management.
                        </p>
                      </div>
                    </label>

                    {/* Analyst Role */}
                    <label
                      onClick={() => {
                        setDrawerRole('Analyst');
                        setPermissions({
                          review_cases: true,
                          trigger_retrain: false,
                          adjust_threshold: false,
                          manage_users: false,
                        });
                      }}
                      className={`p-3 border rounded flex items-start gap-3 cursor-pointer transition-colors ${
                        drawerRole.toLowerCase() === 'analyst'
                          ? 'border-2 border-cyan-500/70 bg-[#0B111E]'
                          : 'border-[#1E293B] bg-[#0B111E]/60 hover:bg-[#16223A]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="project_role"
                        checked={drawerRole.toLowerCase() === 'analyst'}
                        onChange={() => {}}
                        className="mt-0.5 text-cyan-400 bg-[#0B111E] border-cyan-400 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">Analyst</span>
                          <span className="text-[10px] font-mono text-blue-300 bg-blue-950/80 border border-blue-800/50 px-1.5 py-0.2 rounded font-semibold">
                            Investigation Focus
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          Investigate flagged transactions, inspect TreeSHAP explainability, and submit
                          dispositions.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Section 2: Functional Permissions Checkboxes */}
                <div className="pt-3 border-t border-[#1E293B]">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Functional Permissions
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#1E293B] cursor-pointer">
                      <div className="flex flex-col font-sans">
                        <span className="text-xs font-semibold text-white">
                          Review Cases & Submit Verdicts
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Inspect transactions, SHAP feature waterfalls, and dispositions
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={permissions.review_cases}
                        onChange={(e) =>
                          setPermissions({ ...permissions, review_cases: e.target.checked })
                        }
                        className="text-cyan-400 bg-[#0B111E] border-[#1E293B] rounded focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label
                      className={`flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#1E293B] ${
                        drawerRole.toLowerCase() !== 'admin'
                          ? 'opacity-60 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex flex-col font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-300">
                            Trigger Model Retraining
                          </span>
                          {drawerRole.toLowerCase() !== 'admin' && (
                            <span className="text-[9px] font-sans font-semibold text-slate-400 bg-[#1E293B] px-1.5 py-0.5 rounded">
                              Admin only
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Execute pipeline on new ground-truth labels
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        disabled={drawerRole.toLowerCase() !== 'admin'}
                        checked={permissions.trigger_retrain}
                        onChange={(e) =>
                          setPermissions({ ...permissions, trigger_retrain: e.target.checked })
                        }
                        className="text-cyan-400 bg-[#0B111E] border-[#1E293B] rounded focus:ring-0"
                      />
                    </label>

                    <label
                      className={`flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#1E293B] ${
                        drawerRole.toLowerCase() !== 'admin'
                          ? 'opacity-60 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex flex-col font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-300">
                            Adjust Risk Decision Threshold
                          </span>
                          {drawerRole.toLowerCase() !== 'admin' && (
                            <span className="text-[9px] font-sans font-semibold text-slate-400 bg-[#1E293B] px-1.5 py-0.5 rounded">
                              Admin only
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Modify cutoff boundary between 0.50 and 0.90
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        disabled={drawerRole.toLowerCase() !== 'admin'}
                        checked={permissions.adjust_threshold}
                        onChange={(e) =>
                          setPermissions({ ...permissions, adjust_threshold: e.target.checked })
                        }
                        className="text-cyan-400 bg-[#0B111E] border-[#1E293B] rounded focus:ring-0"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-3.5 bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-between mt-auto">
                <span className="text-[11px] text-slate-400 font-mono">
                  PUT /users/{selectedUser.user_id}
                </span>
                <button
                  onClick={handleSavePermissions}
                  type="button"
                  className="px-3.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm font-bold">check</span>
                  <span>Save Permissions</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-sans">
              Select a user from the directory to configure permissions.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add New User */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Create New User"
        icon="person_add"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateUser} className="space-y-3 text-xs font-sans">
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
              Account ID (Unique)
            </label>
            <input
              type="text"
              required
              maxLength={50}
              value={newUser.account_id}
              onChange={(e) => setNewUser({ ...newUser, account_id: e.target.value })}
              className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
              Full Name
            </label>
            <input
              type="text"
              required
              maxLength={50}
              placeholder="e.g. Jordan Lee"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
              Email Address
            </label>
            <input
              type="email"
              required
              maxLength={50}
              placeholder="user@sentinel.edu"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Account Type
              </label>
              <select
                value={newUser.account_type}
                onChange={(e) => setNewUser({ ...newUser, account_type: e.target.value })}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400"
              >
                <option value="Analyst">Analyst</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Password Hash / Key
              </label>
              <input
                type="text"
                required
                value={newUser.password_hash}
                onChange={(e) => setNewUser({ ...newUser, password_hash: e.target.value })}
                className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#1E293B] pt-3 mt-2">
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(false)}
              className="h-7 px-3 rounded bg-[#0F172A] border border-[#223049] text-slate-300 text-xs hover:bg-[#1A263D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-7 px-3.5 rounded bg-cyan-500 text-[#041E26] font-semibold text-xs hover:bg-cyan-400 transition-colors"
            >
              Create User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AdminUsersPage;