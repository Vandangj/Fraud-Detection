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
      const reports = await api.getDriftReports();
      const psiAlerts = (Array.isArray(reports) ? reports : [])
        .map((report) => {
          const psi = Number(report.drift_score);
          if (!Number.isFinite(psi) || psi < 0.10) return null;

          const type = psi >= 0.25 ? 'risky' : 'moderate';
          const date = report.report_time || report.checked_at;
          return {
            id: `DRIFT-${report.report_id}`,
            type,
            psi,
            tag: type.toUpperCase(),
            title: `${type === 'risky' ? 'Risky' : 'Moderate'} PSI: ${report.feature_name}`,
            message: `Model ${report.model_id} recorded PSI ${psi.toFixed(3)} for ${report.feature_name}.`,
            impact: type === 'risky'
              ? `PSI ${psi.toFixed(3)} is at or above 0.25, the project's drift-detected threshold. Investigate this feature before relying on current model decisions.`
              : `PSI ${psi.toFixed(3)} is in the moderate band (0.10 to less than 0.25). Monitor the next report and investigate if it rises to 0.25.`,
            timestamp: date
              ? new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : 'Time unavailable',
            code: report.model_id,
            source: `Drift report #${report.report_id}`,
            metric: `PSI: ${psi.toFixed(3)}`,
            actionLabel: 'Open drift monitoring',
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          const groupOrder = (left.type === 'risky' ? 0 : 1) - (right.type === 'risky' ? 0 : 1);
          return groupOrder || right.psi - left.psi || right.id.localeCompare(left.id);
        });

      setAlerts(psiAlerts);
    } catch (err) {
      console.error('Failed to load PSI alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'ALL') return true;
    return a.type === filterSeverity.toLowerCase();
  });

  const riskyCount = alerts.filter((a) => a.type === 'risky').length;
  const moderateCount = alerts.filter((a) => a.type === 'moderate').length;

  return (
    <div className="space-y-5">
      {/* Alert Metric Summary Header */}
      <section className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-cyan-400 text-xl">warning</span>
              <h1 className="text-base font-semibold text-white tracking-tight">
                PSI Risk Alerts
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Only drift reports with PSI at or above 0.10 are listed. Risky is 0.25 or higher; Moderate is 0.10 to less than 0.25.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/50 text-red-300 border border-red-500/30 rounded-md">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-semibold uppercase font-mono">{riskyCount} Risky</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 text-amber-300 border border-amber-500/30 rounded-md">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-xs font-semibold uppercase font-mono">{moderateCount} Moderate</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Category Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t border-[#1E293B] gap-2">
          <div className="flex items-center bg-[#0B111E] p-0.5 rounded border border-[#1E293B] text-xs">
            {['ALL', 'RISKY', 'MODERATE'].map((tab) => (
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
            <h3 className="text-sm font-semibold text-slate-200">
              {filterSeverity === 'ALL' ? 'No moderate or risky PSI reports' : `No ${filterSeverity.toLowerCase()} PSI reports`}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              PSI reports below 0.10 are excluded from this list.
            </p>
          </div>
        )}
        {filteredAlerts.map((alert) => {
          const isRisky = alert.type === 'risky';
          const isModerate = alert.type === 'moderate';
          return (
            <article
              key={alert.id}
              className={`bg-[#131D31] rounded-lg p-4 space-y-3 shadow-sm border transition-all ${
                isRisky
                  ? 'border-l-4 border-l-red-500 border-[#1E293B]'
                  : isModerate
                  ? 'border-l-4 border-l-amber-500 border-[#1E293B]'
                  : 'border-l-4 border-l-emerald-500 border-[#1E293B] opacity-80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={`p-1.5 rounded border ${
                      isRisky
                        ? 'bg-red-950/60 text-red-400 border-red-800/60'
                        : isModerate
                        ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                        : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {isRisky ? 'report' : 'trending_down'}
                    </span>
                  </span>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge
                        status={isRisky ? 'critical' : 'warning'}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#0B111E] border border-[#1E293B] rounded space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Severity</span>
                    <span className="text-white font-semibold capitalize">{alert.type}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Source</span>
                    <span className="text-cyan-300 font-mono text-right">{alert.source || alert.code}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Alert ID</span>
                    <span className="text-slate-200 font-mono">{alert.alertId || alert.id}</span>
                  </div>
                </div>
                <div className="p-3 bg-[#0B111E] border border-[#1E293B] rounded">
                  <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">What this means</div>
                  <p className="text-slate-300 leading-relaxed">{alert.impact || alert.message}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-2">
                  {(isRisky || isModerate) && (
                    <button
                      onClick={onNavigateDrift}
                      className="h-7 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded transition-colors flex items-center gap-1"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-xs font-bold">ssid_chart</span>
                      <span>{alert.actionLabel || 'Open drift monitoring'}</span>
                    </button>
                  )}
                </div>

              </div>
            </article>
          );
        })}
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
