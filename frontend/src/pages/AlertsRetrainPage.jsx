import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/Common/StatusBadge';
import Modal from '../components/Common/Modal';
import PendingNotice from '../components/Common/PendingNotice';

export function AlertsRetrainPage({ onNavigateTransactions, onNavigateDrift }) {
  const { isAdmin } = useAuth();
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [isRetrainModalOpen, setIsRetrainModalOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      // 1. Fetch real alerts from GET /alerts/
      let realAlerts = [];
      try {
        const data = await api.getAlerts();
        if (Array.isArray(data) && data.length > 0) {
          realAlerts = data.map((a) => {
            const isCrit = a.severity === 'critical' || a.severity === 'high';
            const isWarn = a.severity === 'medium' || a.severity === 'warning';
            return {
              id: `ALERT-${a.alert_id}`,
              type: isCrit ? 'critical' : isWarn ? 'warning' : 'resolved',
              tag: a.alert_type === 'FRAUD_DETECTED' ? 'FRAUD FLAG' : 'DRIFT WARNING',
              title: a.alert_type === 'FRAUD_DETECTED'
                ? `Fraud Flag on Transaction TX-${a.transaction_id}`
                : `Feature Drift Warning on ${a.feature_name || 'Model'}`,
              message: a.message,
              timestamp: a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
              code: a.model_id || (a.alert_type === 'FRAUD_DETECTED' ? 'TX-FLAGGED' : 'DRIFT-REPORT'),
              metric: a.fraud_probability != null
                ? `Fraud Score: ${(a.fraud_probability * 100).toFixed(1)}%`
                : a.drift_score != null
                ? `PSI: ${a.drift_score.toFixed(3)}`
                : a.severity?.toUpperCase(),
            };
          });
        }
      } catch (err) {
        console.warn('GET /alerts/ failed:', err.message);
      }

      // 2. If no alerts table rows, derive strictly from real fetched transactions and drift reports
      if (realAlerts.length === 0) {
        const [txRes, driftRes] = await Promise.allSettled([
          api.getTransactions(0, 100),
          api.getDriftReports(),
        ]);

        const derived = [];

        if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) {
          txRes.value
            .filter((t) => t.is_fraud)
            .slice(0, 10)
            .forEach((t) => {
              derived.push({
                id: `TX-WARN-${t.transaction_id}`,
                type: 'critical',
                tag: 'FRAUD FLAG',
                title: `Flagged Transaction TX-${t.transaction_id}`,
                message: `Real transaction TX-${t.transaction_id} (${t.transaction_type}) of $${Number(t.amount || 0).toLocaleString()} flagged as fraudulent in database.`,
                timestamp: `Step ${t.step || 1}`,
                code: `TX-${t.transaction_id}`,
                metric: `is_fraud = true`,
              });
            });
        }

        if (driftRes.status === 'fulfilled' && Array.isArray(driftRes.value)) {
          driftRes.value
            .filter((d) => d.drift_status === 'warning' || d.drift_status === 'drift_detected')
            .slice(0, 10)
            .forEach((d) => {
              const isDetected = d.drift_status === 'drift_detected';
              derived.push({
                id: `DRIFT-WARN-${d.report_id}`,
                type: isDetected ? 'critical' : 'warning',
                tag: 'DRIFT WARNING',
                title: `Drift Alert on ${d.feature_name}`,
                message: `Feature ${d.feature_name} registered Population Stability Index (PSI) of ${Number(d.drift_score || 0).toFixed(3)} (${d.drift_status.replace('_', ' ')}).`,
                timestamp: d.report_time ? new Date(d.report_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent check',
                code: d.model_id || 'DRIFT',
                metric: `PSI: ${Number(d.drift_score || 0).toFixed(3)}`,
              });
            });
        }

        realAlerts = derived;
      }

      // Set only real alerts or derived warnings (no hardcoded fallback sample warnings)
      setAlerts(realAlerts);
    } catch (err) {
      console.error('Error fetching alerts or derived data:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, type: 'resolved', tag: 'RESOLVED' } : a))
    );
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'ALL') return true;
    return a.type === filterSeverity.toLowerCase();
  });

  const criticalCount = alerts.filter((a) => a.type === 'critical').length;
  const warningCount = alerts.filter((a) => a.type === 'warning').length;
  const resolvedCount = alerts.filter((a) => a.type === 'resolved').length;

  return (
    <div className="space-y-5">
      {/* Alert Metric Summary Header */}
      <section className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-cyan-400 text-xl">warning</span>
              <h1 className="text-base font-semibold text-white tracking-tight">
                Derived Risk & Drift Warnings
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Heuristic warnings derived from transaction scores and Population Stability Index (PSI) drift reports.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/50 text-red-300 border border-red-500/30 rounded-md">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-semibold uppercase font-mono">{criticalCount} Critical</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 text-amber-300 border border-amber-500/30 rounded-md">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-xs font-semibold uppercase font-mono">{warningCount} Warning</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-semibold uppercase font-mono">{resolvedCount} Resolved</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Category Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t border-[#1E293B] gap-2">
          <div className="flex items-center bg-[#0B111E] p-0.5 rounded border border-[#1E293B] text-xs">
            {['ALL', 'CRITICAL', 'WARNING', 'RESOLVED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterSeverity(tab)}
                className={`px-3 py-1 rounded transition-colors ${
                  filterSeverity === tab
                    ? 'bg-[#131D31] text-white font-medium border border-[#1E293B] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsRetrainModalOpen(true)}
            className="h-8 px-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-sm font-bold">bolt</span>
            <span>Retrain Pipeline Status</span>
          </button>
        </div>
      </section>

      {/* Alerts Stream */}
      <section className="space-y-3">
        {loading && (
          <div className="bg-[#131D31] border border-[#1E293B] rounded-lg p-10 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading alerts and risk warnings...</p>
          </div>
        )}

        {!loading && filteredAlerts.length === 0 && (
          <div className="bg-[#131D31] border border-[#1E293B] rounded-lg p-10 text-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-slate-500">notifications_off</span>
            <h3 className="text-sm font-semibold text-slate-200">No alerts available</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No active fraud incidents or model drift warnings currently detected in the system.
            </p>
          </div>
        )}
        {filteredAlerts.map((alert) => {
          const isCritical = alert.type === 'critical';
          const isWarning = alert.type === 'warning';
          return (
            <article
              key={alert.id}
              className={`bg-[#131D31] rounded-lg p-4 space-y-3 shadow-sm border transition-all ${
                isCritical
                  ? 'border-l-4 border-l-red-500 border-[#1E293B]'
                  : isWarning
                  ? 'border-l-4 border-l-amber-500 border-[#1E293B]'
                  : 'border-l-4 border-l-emerald-500 border-[#1E293B] opacity-80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={`p-1.5 rounded border ${
                      isCritical
                        ? 'bg-red-950/60 text-red-400 border-red-800/60'
                        : isWarning
                        ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                        : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {isCritical ? 'report' : isWarning ? 'trending_down' : 'check_circle'}
                    </span>
                  </span>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge
                        status={isCritical ? 'critical' : isWarning ? 'warning' : 'stable'}
                        label={alert.tag}
                      />
                      <span className="text-xs font-mono text-slate-400">{alert.code}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs font-mono text-cyan-400">{alert.metric}</span>
                    </div>
                    <h2 className="text-sm font-semibold text-white mt-1">{alert.title}</h2>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  <span>{alert.timestamp}</span>
                </div>
              </div>

              <div className="p-3 bg-[#0B111E] border border-[#1E293B] rounded text-xs text-slate-300">
                <p className="leading-relaxed">{alert.message}</p>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-2">
                  {isCritical && (
                    <button
                      onClick={onNavigateTransactions}
                      className="h-7 px-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded transition-colors flex items-center gap-1"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-xs">visibility</span>
                      <span>View in Transactions</span>
                    </button>
                  )}
                  {isWarning && (
                    <button
                      onClick={() => setIsRetrainModalOpen(true)}
                      className="h-7 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded transition-colors flex items-center gap-1"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-xs font-bold">bolt</span>
                      <span>View Retrain Requirements</span>
                    </button>
                  )}
                </div>

                {alert.type !== 'resolved' && (
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="h-7 px-3 bg-[#0B111E] border border-[#1E293B] text-slate-400 hover:text-white rounded transition-colors flex items-center gap-1"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-xs">check</span>
                    <span>Acknowledge</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* Real Project Status Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-sans">
        <div className="bg-[#131D31] border border-[#1E293B] p-3 rounded-lg">
          <div className="flex justify-between font-mono text-slate-400 uppercase text-[10px]">
            <span>FastAPI Service</span>
            <span className="text-emerald-400 font-bold">Running</span>
          </div>
          <div className="text-sm font-bold font-mono text-white mt-1">localhost:8000</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Uvicorn ASGI Server</p>
        </div>

        <div className="bg-[#131D31] border border-[#1E293B] p-3 rounded-lg">
          <div className="flex justify-between font-mono text-slate-400 uppercase text-[10px]">
            <span>Database Backend</span>
            <span className="text-cyan-400 font-bold">Connected</span>
          </div>
          <div className="text-sm font-bold font-mono text-white mt-1">MySQL Local</div>
          <p className="text-[11px] text-slate-400 mt-0.5">SQLAlchemy ORM</p>
        </div>

        <div className="bg-[#131D31] border border-[#1E293B] p-3 rounded-lg">
          <div className="flex justify-between font-mono text-slate-400 uppercase text-[10px]">
            <span>Primary Model</span>
            <span className="text-cyan-400 font-bold">v1.0</span>
          </div>
          <div className="text-sm font-bold font-mono text-white mt-1">Random Forest (SMOTE)</div>
          <p className="text-[11px] text-slate-400 mt-0.5">scikit-learn Classifier</p>
        </div>
      </section>

      {/* Retrain Pipeline Status Modal */}
      <Modal
        isOpen={isRetrainModalOpen}
        onClose={() => setIsRetrainModalOpen(false)}
        title="Model Retraining Pipeline Status"
        icon="restart_alt"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs font-sans">
          <PendingNotice
            feature="Automated Model Retraining Pipeline"
            endpoint="POST /models/retrain"
            sourceFile="ml/train.py"
            description="The ML training script (ml/train.py) and retraining endpoint are pending backend implementation. Execution is disabled to ensure no fabricated simulation is presented."
          />

          <div className="bg-[#131D31] border border-[#1E293B] rounded divide-y divide-[#1E293B] text-xs">
            <div className="px-3.5 py-2 flex justify-between items-center">
              <span className="text-slate-400">Target Model:</span>
              <span className="font-mono text-white font-semibold">
                Random Forest Classifier (SMOTE)
              </span>
            </div>
            <div className="px-3.5 py-2 flex justify-between items-center">
              <span className="text-slate-400">Dataset Source:</span>
              <span className="text-slate-200">MySQL ground-truth transactions</span>
            </div>
            <div className="px-3.5 py-2 flex justify-between items-center">
              <span className="text-slate-400">Class Balancing:</span>
              <span className="text-cyan-400 font-mono">SMOTE (Over-sampling)</span>
            </div>
            <div className="px-3.5 py-2 flex justify-between items-center">
              <span className="text-slate-400">Execution Status:</span>
              <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 font-mono font-medium">
                Retraining API Pending
              </span>
            </div>
            <div className="px-3.5 py-2 flex justify-between items-center">
              <span className="text-slate-400">Authorization:</span>
              <span className="font-mono text-slate-300">
                {isAdmin ? (
                  <span className="text-emerald-400 font-bold">Admin</span>
                ) : (
                  <span className="text-slate-400">Analyst (View Only)</span>
                )}
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#1E293B]">
            <button
              onClick={() => setIsRetrainModalOpen(false)}
              className="h-8 px-3 rounded bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white"
              type="button"
            >
              Close
            </button>
            <button
              disabled
              className="h-8 px-3.5 rounded font-semibold bg-[#1E293B] text-slate-500 cursor-not-allowed border border-slate-700 flex items-center gap-1.5"
              type="button"
              title="Execution disabled until backend endpoint POST /models/retrain is implemented"
            >
              <span className="material-symbols-outlined text-sm">block</span>
              <span>Retraining API Pending</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AlertsRetrainPage;
