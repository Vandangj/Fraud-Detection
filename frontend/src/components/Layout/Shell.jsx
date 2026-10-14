import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ModelRetrainModal from '../Common/ModelRetrainModal';
import { useAuth } from '../../context/AuthContext';

export function Shell({
  currentTab,
  onSelectTab,
  pageTitle,
  children,
  onRefreshData,
  onTriggerRetrain,
  isRetrainModalOpen,
  onCloseRetrain,
  onRetrainComplete,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B111E] text-[#F8FAFC]">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0B111E]">
        <Header
          pageTitle={pageTitle}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onTriggerRetrain={onTriggerRetrain}
          onRefresh={onRefreshData}
          onNavigateAlerts={() => onSelectTab('alerts')}
          onLogout={logout}
        />

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0B111E]">
          <div className="max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>

      <ModelRetrainModal
        isOpen={isRetrainModalOpen}
        onClose={onCloseRetrain}
        onComplete={onRetrainComplete}
      />
    </div>
  );
}

export default Shell;
