import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/Common/StatusBadge';
import Modal from '../components/Common/Modal';
import {
  PSI_WARNING,
  PSI_DRIFT,
  formatPsi,
  classifyPsi,
  latestReportsByFeature,
  summarisePsi,
  pickDefaultModelId,
} from '../utils/drift';

const DRIFT_FEATURES = [
  'step',
  'amount',
  'old_balance',
  'new_balance',
  'transaction_type',
  'is_fraud',
  'balanceDiffOrig',
  'amountToOrigBalance',
  'type_CASH_IN',
  'type_CASH_OUT',
  'type_DEBIT',
  'type_PAYMENT',
  'type_TRANSFER',
];

const PSI_STATUS_CLASSES = {
  stable: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/70',
  warning: 'bg-amber-950/70 text-amber-300 border-amber-800/70',
  drift_detected: 'bg-red-950/70 text-red-300 border-red-800/70',
  unavailable: 'bg-slate-800 text-slate-300 border-slate-700',
};

const PSI_STATUS_LABELS = {
  stable: 'STABLE',
  warning: 'WARNING',
  drift_detected: 'DRIFT DETECTED',
  unavailable: 'NO REPORTS',
};

// StatusBadge understands these keys
const BADGE_STATUS = {
  stable: 'stable',
  warning: 'warning',
  drift_detected: 'critical',
};

const BADGE_LABEL = {
  stable: 'stable',
  warning: 'warning',
  drift_detected: 'drift_detected',
};

export function DriftMonitoringPage() {
  const { user } = useAuth();
  const [driftReports, setDriftReports] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCheckingDrift, setIsCheckingDrift] = useState(false);
  const [driftCheckProgress, setDriftCheckProgress] = useState(null);
  const [driftCheckFeedback, setDriftCheckFeedback] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    model_id: 'rf-balanced-v1',
    feature_name: 'amountToOrigBalance',
    drift_score: 0.14,
    drift_status: 'warning',
  });

  useEffect(() => {
    loadDriftReports();
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const data = await api.getModels();
      if (!Array.isArray(data) || data.length === 0) return;
      setModels(data);
      // Same default-model rule as the Overview page
      const defaultModelId = pickDefaultModelId(data, user);
      setSelectedModelId((current) => current || defaultModelId);
      setNewReport((current) => ({ ...current, model_id: defaultModelId }));
    } catch (err) {
      console.error('Failed to load models for drift checking:', err);
    }
  };

  const loadDriftReports = async () => {
    setLoading(true);
    try {
      const data = await api.getDriftReports();
      setDriftReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load drift reports:', err);
      setDriftReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    try {
      const score = parseFloat(newReport.drift_score);
      const payload = {
        model_id: newReport.model_id,
        feature_name: newReport.feature_name,
        drift_score: score,
        // Status always follows the score so every screen agrees
        drift_status: classifyPsi(score),
      };
      const created = await api.createDriftReport(payload);
      setDriftReports((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
    } catch (err) {
      alert(`Failed to save drift report: ${err.message}`);
    }
  };

  const handleRunDriftCheck = async () => {
    if (!selectedModelId || isCheckingDrift) return;

    setIsCheckingDrift(true);
    setDriftCheckFeedback(null);
    const failures = [];
    let completed = 0;
    try {
      for (const [index, featureName] of DRIFT_FEATURES.entries()) {
        setDriftCheckProgress({ current: index + 1, total: DRIFT_FEATURES.length, featureName });
        try {
          await api.checkDrift({
            model_id: selectedModelId,
            feature_name: featureName,
            sample_size: 1000,
          });
          completed += 1;
        } catch (err) {
          failures.push({ featureName, message: err.message || 'Drift check failed.' });
        }
      }

      await loadDriftReports();
      setDriftCheckFeedback({ completed, total: DRIFT_FEATURES.length, failures });
    } finally {
      setIsCheckingDrift(false);
      setDriftCheckProgress(null);
    }
  };

  // Shared logic with the Overview page
  const latestFeatureReports = selectedModelId
    ? latestReportsByFeature(driftReports, selectedModelId)
        .sort((left, right) => right.drift_score - left.drift_score)
    : [];
  const psi = summarisePsi(latestFeatureReports);
  const globalPsi = psi.mean;
  const globalPsiStatus = psi.status;
  const psiCounts = {
    stable: psi.stableCount,
    warning: psi.warningCount,
    drift: psi.driftCount,
  };
  const psiNeedlePosition = globalPsi == null
    ? '0%'
    : `${Math.min((globalPsi / 0.5) * 100, 100)}%`;
  const topFeatureReports = latestFeatureReports.slice(0, 5);

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm(`Delete drift report #${reportId}?`)) return;
    try {
      await api.deleteDriftReport(reportId);
      setDriftReports((prev) => prev.filter((r) => r.report_id !== reportId));
    } catch (err) {
      alert(`Failed to delete drift report: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#131D31] px-4 py-3 rounded-lg border border-[#1E293B] gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">
              Drift Monitoring & Population Stability (PSI)
            </h1>
            <label className="inline-flex items-center gap-2 text-[11px] font-sans text-cyan-300">
              <span>Model</span>
              <select
                aria-label="Model for drift check"
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
                disabled={isCheckingDrift}
                className="max-w-[240px] bg-[#0F172A] border border-cyan-800/60 text-white rounded px-2 py-1 text-xs"
              >
                {models.map((model) => (
                  <option key={model.model_id} value={model.model_id}>
                    {model.model_name || model.model_id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Mean PSI across the latest feature reports; each PSI compares recent transaction windows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            type="button"
            className="h-8 px-3 rounded bg-[#0B111E] border border-[#1E293B] text-slate-200 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-cyan-400">add</span>
            <span>Record Drift Metric</span>
          </button>
          <button
            onClick={handleRunDriftCheck}
            disabled={isCheckingDrift || !selectedModelId}
            type="button"
            className="h-8 px-3.5 rounded bg-cyan-500 hover:bg-cyan-400 disabled:bg-[#1E293B] disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className={`material-symbols-outlined text-sm font-bold ${isCheckingDrift ? 'animate-spin' : ''}`}>
              {isCheckingDrift ? 'sync' : 'monitoring'}
            </span>
            <span>{isCheckingDrift ? 'Checking Drift...' : 'Run Drift Check'}</span>
          </button>
        </div>
      </section>

      {(isCheckingDrift || driftCheckFeedback) && (
        <section
          aria-live="polite"
          className={`p-3 rounded-lg border text-xs ${driftCheckFeedback?.failures.length ? 'bg-amber-950/30 border-amber-700/50 text-amber-200' : 'bg-cyan-950/30 border-cyan-800/50 text-cyan-200'}`}
        >
          {isCheckingDrift ? (
            <span>
              Checking {driftCheckProgress?.current} of {driftCheckProgress?.total}: {driftCheckProgress?.featureName}
            </span>
          ) : (
            <div className="space-y-1">
              <p>Drift checks saved for {driftCheckFeedback.completed} of {driftCheckFeedback.total} features on {selectedModelId}.</p>
              {driftCheckFeedback.failures.map((failure) => (
                <p key={failure.featureName}>{failure.featureName}: {failure.message}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SECTION 1: TOP SUMMARY BANNER & PSI GAUGE ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Global Model PSI Card + Gauge */}
        <div className="lg:col-span-4 bg-[#131D31] border border-[#1E293B] rounded-lg p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Mean Feature PSI
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-mono font-bold text-white tracking-tight">
                  {globalPsi == null ? '—' : formatPsi(globalPsi)}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${PSI_STATUS_CLASSES[globalPsiStatus]}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {PSI_STATUS_LABELS[globalPsiStatus]}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-[#0B111E] border border-[#1E293B]">
              Scale: 0.00–0.50 PSI
            </span>
          </div>

          {/* Visual Horizontal Gauge Indicator */}
          <div className="mt-3">
            <div className="w-full h-2 rounded-full bg-[#0B111E] border border-[#1E293B] flex overflow-hidden relative">
              <div className="h-full bg-emerald-500/80 w-[20%]" title="Stable zone (0 - 0.10)"></div>
              <div className="h-full bg-amber-500/80 w-[30%]" title="Warning zone (0.10 - 0.25)"></div>
              <div className="h-full bg-red-500/80 w-[50%]" title="Drift detected (> 0.25)"></div>
              {globalPsi != null && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_#fff] z-10 -ml-0.5"
                  style={{ left: psiNeedlePosition }}
                ></div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-3 border-t border-[#1E293B] mt-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              &lt;{PSI_WARNING.toFixed(2)} Stable
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              {PSI_WARNING.toFixed(2)}-{PSI_DRIFT.toFixed(2)} Moderate
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              &gt;{PSI_DRIFT.toFixed(2)} Significant
            </span>
          </div>
        </div>

        {/* Right: Selected Model Drift Summary */}
        <div className={`lg:col-span-8 bg-[#131D31] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm relative overflow-hidden border ${
          psiCounts.drift > 0
            ? 'border-red-500/30'
            : psiCounts.warning > 0
              ? 'border-amber-500/30'
              : 'border-emerald-500/30'
        }`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${psiCounts.drift > 0 ? 'bg-red-500' : psiCounts.warning > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
          <div className="flex items-center gap-3.5 pl-1">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${psiCounts.drift > 0 ? 'bg-red-500/10 border border-red-500/30 text-red-400' : psiCounts.warning > 0 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
              <span className="material-symbols-outlined text-xl">{psiCounts.drift > 0 ? 'notification_important' : 'monitoring'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white font-sans">
                  {psiCounts.drift > 0 ? 'Feature Distribution Shift Detected' : psiCounts.warning > 0 ? 'Moderate Feature Shift' : latestFeatureReports.length ? 'No Significant Feature Shift' : 'No Drift Reports Yet'}
                </h3>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-sans border font-medium ${PSI_STATUS_CLASSES[globalPsiStatus]}`}>
                  {PSI_STATUS_LABELS[globalPsiStatus]}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                <span className="text-emerald-400 font-medium">{psiCounts.stable} Stable</span>
                <span className="mx-1 text-slate-500">|</span>
                <span className="text-amber-400 font-medium">{psiCounts.warning} Warning</span>
                <span className="mx-1 text-slate-500">|</span>
                <span className="text-red-400 font-medium">{psiCounts.drift} Significant Drift</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-mono">{selectedModelId || 'No model selected'}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Current PSI by Feature */}
      <div className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-base">monitoring</span>
            <h2 className="text-sm font-semibold text-white">Latest PSI by Feature</h2>
          </div>
          <span className="text-[10px] text-slate-400">Bar scale capped at PSI 0.50</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {topFeatureReports.length === 0 ? (
            <p className="md:col-span-2 py-6 text-center text-xs text-slate-400">
              {loading ? 'Loading drift reports...' : 'No drift checks are available for this model yet.'}
            </p>
          ) : topFeatureReports.map((report) => {
            const score = report.drift_score;
            const barColor = score >= PSI_DRIFT ? 'bg-red-500' : score >= PSI_WARNING ? 'bg-amber-400' : 'bg-emerald-500';
            return (
              <div key={report.report_id} className="grid grid-cols-[minmax(100px,1fr)_2fr_auto] items-center gap-3 text-xs">
                <span className="truncate text-slate-300" title={report.feature_name}>{report.feature_name}</span>
                <div className="h-2 rounded bg-[#0B111E] overflow-hidden">
                  <div className={`h-full ${barColor}`} style={{ width: `${Math.min((score / 0.5) * 100, 100)}%` }}></div>
                </div>
                <span className="w-12 text-right font-mono text-white">{formatPsi(score)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: FEATURE DRIFT REPORTS TABLE */}
      <section className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-base">table_chart</span>
            <h2 className="text-sm font-bold text-white">Feature Drift Ledger</h2>
            <span className="text-xs text-slate-400 font-mono">FastAPI /drift-reports</span>
          </div>
          <span className="text-xs text-slate-400">Latest features: {latestFeatureReports.length}</span>
        </div>

        <div className="overflow-x-auto border border-[#1E293B] rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0F172A] h-9 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#1E293B]">
                <th className="px-4 py-2">Report ID</th>
                <th className="px-4 py-2">Model ID</th>
                <th className="px-4 py-2">Feature Name</th>
                <th className="px-4 py-2 text-center">PSI Drift Score</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] font-mono">
              {latestFeatureReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No drift reports for this model. Run a drift check to calculate current PSI.
                  </td>
                </tr>
              ) : latestFeatureReports.map((r) => {
                const status = classifyPsi(r.drift_score);
                return (
                  <tr key={r.report_id} className="hover:bg-[#1A263D]/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-cyan-400">#{r.report_id}</td>
                    <td className="px-4 py-2.5 text-slate-300">{r.model_id}</td>
                    <td className="px-4 py-2.5 font-semibold text-white font-sans">{r.feature_name}</td>
                    <td className="px-4 py-2.5 text-center font-bold">
                      <span
                        className={
                          status === 'drift_detected'
                            ? 'text-red-400'
                            : status === 'warning'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        }
                      >
                        {formatPsi(r.drift_score)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-sans">
                      <StatusBadge status={BADGE_STATUS[status]} label={BADGE_LABEL[status]} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <button
                        onClick={() => handleDeleteReport(r.report_id)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-red-900/80 text-slate-400 hover:text-white text-xs transition-colors"
                        type="button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Add Drift Report */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record Feature Drift Report"
        icon="ssid_chart"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateReport} className="space-y-3 text-xs font-sans">
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
              Model ID
            </label>
            <input
              type="text"
              required
              value={newReport.model_id}
              onChange={(e) => setNewReport({ ...newReport, model_id: e.target.value })}
              className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
              Feature Name
            </label>
            <input
              type="text"
              required
              value={newReport.feature_name}
              onChange={(e) => setNewReport({ ...newReport, feature_name: e.target.value })}
              className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                PSI Score
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                required
                value={newReport.drift_score}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setNewReport({ ...newReport, drift_score: val, drift_status: classifyPsi(val) });
                }}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Drift Status (auto)
              </label>
              <input
                type="text"
                readOnly
                value={newReport.drift_status}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-slate-300 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#1E293B] pt-3 mt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="h-7 px-3 rounded bg-[#0F172A] border border-[#223049] text-slate-300 text-xs hover:bg-[#1A263D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-7 px-3.5 rounded bg-cyan-500 text-[#041E26] font-semibold text-xs hover:bg-cyan-400 transition-colors"
            >
              Save Drift Metric
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default DriftMonitoringPage;