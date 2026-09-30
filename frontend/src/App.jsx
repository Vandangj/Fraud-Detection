import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Shell from './components/Layout/Shell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import CaseDetailPage from './pages/CaseDetailPage';
import ModelHealthPage from './pages/ModelHealthPage';
import DriftMonitoringPage from './pages/DriftMonitoringPage';
import AlertsRetrainPage from './pages/AlertsRetrainPage';
import AdminUsersPage from './pages/AdminUsersPage';
import DatabaseTablesPage from './pages/DatabaseTablesPage';

function AppContent() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState(849201);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user || !user.isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setCurrentTab('dashboard')} />;
  }

  const handleInspectCase = (txId) => {
    setSelectedCaseId(txId);
    setCurrentTab('case-detail');
  };

  const handleRefreshData = () => {
    setRefreshKey((k) => k + 1);
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Overview Dashboard';
      case 'transactions':
        return 'Transactions Ledger & Real-Time Scoring';
      case 'alerts':
        return 'Active Incidents & Mitigation Feed';
      case 'case-detail':
        return `Case Investigation (TX-${selectedCaseId})`;
      case 'model-health':
        return 'Model Health & Validation Performance';
      case 'drift-monitoring':
        return 'Population Stability Index (PSI) Drift Monitoring';
      case 'db-tables':
        return 'MySQL Database Tables Explorer';
      case 'users':
        return 'Admin & User Access Management';
      default:
        return 'Overview Dashboard';
    }
  };

  return (
    <Shell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      pageTitle={getPageTitle()}
      onRefreshData={handleRefreshData}
    >
      {currentTab === 'dashboard' && (
        <DashboardPage
          key={`dash-${refreshKey}`}
          onInspectCase={handleInspectCase}
          onNavigateTransactions={() => setCurrentTab('transactions')}
          onNavigateDrift={() => setCurrentTab('drift-monitoring')}
        />
      )}

      {currentTab === 'transactions' && (
        <TransactionsPage
          key={`tx-${refreshKey}`}
          onInspectCase={handleInspectCase}
        />
      )}

      {currentTab === 'case-detail' && (
        <CaseDetailPage
          key={`case-${selectedCaseId}-${refreshKey}`}
          transactionId={selectedCaseId}
          onBackToTransactions={() => setCurrentTab('transactions')}
        />
      )}

      {currentTab === 'model-health' && (
        <ModelHealthPage
          key={`model-${refreshKey}`}
          onTriggerRetrain={() => setCurrentTab('alerts')}
        />
      )}

      {currentTab === 'drift-monitoring' && (
        <DriftMonitoringPage key={`drift-${refreshKey}`} />
      )}

      {currentTab === 'db-tables' && (
        <DatabaseTablesPage key={`db-${refreshKey}`} />
      )}

      {currentTab === 'alerts' && (
        <AlertsRetrainPage
          key={`alerts-${refreshKey}`}
          onNavigateTransactions={() => setCurrentTab('transactions')}
          onNavigateDrift={() => setCurrentTab('drift-monitoring')}
        />
      )}

      {currentTab === 'users' && (
        <AdminUsersPage key={`users-${refreshKey}`} />
      )}
    </Shell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
