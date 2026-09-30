import React from 'react';
import { useAuth } from '../../context/AuthContext';

export function Sidebar({ currentTab, onSelectTab, isOpen, onClose }) {
  const { user, switchRole, isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt_long', badge: 'Live' },
    { id: 'alerts', label: 'Alerts', icon: 'warning', badgeCount: 3, badgeColor: 'red' },
    { id: 'case-detail', label: 'Cases & SHAP', icon: 'fact_check' },
    { id: 'model-health', label: 'Model Health', icon: 'health_and_safety' },
    { id: 'drift-monitoring', label: 'Drift Monitoring', icon: 'ssid_chart' },
    { id: 'db-tables', label: 'DB Tables Explorer', icon: 'table_view', badge: 'MySQL' },
    { id: 'users', label: 'Admin & Users', icon: 'manage_accounts', adminOnly: true },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 min-w-[256px] max-w-[256px] bg-[#0D1320] border-r border-[#1E293B] flex flex-col justify-between p-4 select-none shrink-0 transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-5">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/30 rounded-md flex items-center justify-center text-cyan-400">
                <span className="material-symbols-outlined text-base">shield</span>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-100 leading-tight">Fraud & Drift</div>
                <div className="text-[11px] text-cyan-400 font-sans">Student Capstone</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-white p-1"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onClose) onClose();
                  }}
                  type="button"
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left w-full ${
                    isActive
                      ? 'bg-[#131D31] text-cyan-300 border-r-2 border-cyan-400 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#131D31]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        isActive ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className={isActive ? 'text-white' : ''}>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 font-medium">
                      {item.badge}
                    </span>
                  )}
                  {item.badgeCount && (
                    <span className="bg-red-950/80 border border-red-800/60 text-red-400 px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold">
                      {item.badgeCount}
                    </span>
                  )}
                  {item.adminOnly && !isAdmin && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#1E293B] text-slate-400">
                      Admin
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-3 pt-3 border-t border-[#1E293B]">
          {/* Quick Role Switcher */}
          <div className="bg-[#0B111E] p-1.5 rounded border border-[#1E293B]">
            <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 px-1 flex justify-between items-center">
              <span>Active Role</span>
              <span className="text-cyan-400 font-bold">{isAdmin ? 'Admin' : 'Analyst'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => switchRole('analyst')}
                className={`py-1 px-2 text-[11px] rounded transition-colors flex items-center justify-center gap-1 ${
                  !isAdmin
                    ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-700/60'
                    : 'text-slate-400 hover:text-white bg-[#131D31]'
                }`}
                type="button"
              >
                Analyst
              </button>
              <button
                onClick={() => switchRole('admin')}
                className={`py-1 px-2 text-[11px] rounded transition-colors flex items-center justify-center gap-1 ${
                  isAdmin
                    ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-700/60'
                    : 'text-slate-400 hover:text-white bg-[#131D31]'
                }`}
                type="button"
              >
                Admin
              </button>
            </div>
          </div>

          {/* User Profile Badge */}
          <div className="flex items-center justify-between px-2.5 py-2 rounded-md bg-[#131D31] border border-[#1E293B]">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-300 font-semibold text-xs shrink-0">
                {user?.initials || 'U'}
              </div>
              <div className="truncate text-left">
                <div className="text-xs font-medium text-slate-200 truncate">{user?.name}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Session Active"></span>
          </div>

          {/* Backend Status */}
          <div className="w-full bg-[#131D31] border border-[#1E293B] text-slate-300 text-xs font-sans py-1.5 px-3 rounded flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              FastAPI :8000
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-medium">MySQL</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
