import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MetricCard from '../components/Common/MetricCard';
import StatusBadge from '../components/Common/StatusBadge';
import {
  PSI_WARNING,
  PSI_DRIFT,
  formatPsi,
  classifyPsi,
  latestReportsByFeature,
  summarisePsi,
  pickDefaultModelId,
} from '../utils/drift';

const PSI_STATUS_LABELS = {
  stable: 'STABLE',
  warning: 'WARNING',
  drift_detected: 'DRIFT DETECTED',
  unavailable: 'NO REPORTS',
};

const PSI_STATUS_CLASSES = {
  stable: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
  warning: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
  drift_detected: 'bg-red-950/60 text-red-300 border-red-800/60',
  unavailable: 'bg-slate-800 text-slate-300 border-slate-700',
};

const PSI_GAUGE_COLORS = {
  stable: '#68B89A',
  warning: '#E0B36A',
  drift_detected: '#E06C75',
  unavailable: '#353640',
};

const GAUGE_CIRCUMFERENCE = 201;

export function DashboardPage({ transactionCounts, onInspectCase, onNavigateTransactions, onNavigateDrift }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [models, setModels] = useState([]);
  const [driftReports, setDriftReports] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [txRes, modelRes, driftRes, summaryRes] = await Promise.allSettled([
        api.getTransactions(0, 50),
        api.getModelsComparison(),
        api.getDriftReports(),
        api.getTransactionSummary(),
      ]);

      if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) {
        setTransactions(txRes.value);
      }
      if (modelRes.status === 'fulfilled' && Array.isArray(modelRes.value)) {
        setModels(modelRes.value);
      }
      if (driftRes.status === 'fulfilled' && Array.isArray(driftRes.value)) {
        setDriftReports(driftRes.value);
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setSummaryData(summaryRes.value);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Metrics computation
  const activeSummary = summaryData || transactionCounts;
  const totalTxCount = activeSummary?.transaction_count;
  const flaggedCount = activeSummary?.fraud_prediction_count;
  const fraudRate = totalTxCount
    ? ((flaggedCount / totalTxCount) * 100).toFixed(3)
    : null;

  // Active model: same default-model rule as Drift Monitoring
  const defaultModelId = pickDefaultModelId(models, user);
  const activeModel = models.find((model) => model.model_id === defaultModelId) || {};
  const normalizeModelMetric = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return numericValue > 1 && numericValue <= 100 ? numericValue / 100 : numericValue;
  };
  const formatModelPercent = (value) => {
    const normalized = normalizeModelMetric(value);
    return normalized == null ? '—' : `${(normalized * 100).toFixed(2)}%`;
  };
  const formatModelScore = (value) => {
    const normalized = normalizeModelMetric(value);
    return normalized == null ? '—' : normalized.toFixed(4);
  };

  // PSI: computed from the same latest-per-feature reports as Drift Monitoring
  const latestFeatureReports = defaultModelId
    ? latestReportsByFeature(driftReports, defaultModelId)
        .sort((left, right) => right.drift_score - left.drift_score)
    : [];
  const psi = summarisePsi(latestFeatureReports);
  const gaugeFill = psi.mean == null ? 0 : Math.min(psi.mean / 0.5, 1);
  const topDriftedFeatures = latestFeatureReports.slice(0, 2);
  const driftWarnings = latestFeatureReports
    .filter((report) => report.drift_score >= PSI_WARNING)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* METRIC CARDS ROW (4 Cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Transactions */}
        <MetricCard
          title="Total Transactions"
          value={totalTxCount?.toLocaleString() ?? '—'}
          subtext="All database records"
          icon="receipt_long"
          footerLabel="Latest records shown below"
          footerValue={transactions.length.toLocaleString()}
        />

        {/* Flagged Suspicious */}
        <MetricCard
          title="Flagged Suspicious"
          value={flaggedCount?.toLocaleString() ?? '—'}
          subtext={fraudRate == null ? 'Fraud predictions' : `${fraudRate}% of transactions`}
          badgeText="Flagged"
          badgeVariant="danger"
          hoverColor="hover:border-red-900/50"
          footerLabel="Model Identified"
          footerValue={`${flaggedCount?.toLocaleString() ?? '—'} Predictions`}
        />

        {/* Fraud Rate */}
        <MetricCard
          title="Fraud Rate"
          value={fraudRate == null ? '—' : `${fraudRate}%`}
          badgeText={fraudRate == null ? 'Loading' : 'From database'}
          badgeVariant="warning"
          hoverColor="hover:border-amber-900/50"
          footerLabel="Positive predictions"
          footerValue={flaggedCount?.toLocaleString() ?? '—'}
        />

        {/* Model Performance */}
        <div className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 flex flex-col justify-between hover:border-emerald-900/50 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Model Performance</span>
            <span className="inline-flex items-center gap-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded text-[10px] font-sans font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {activeModel.model_id || 'Model'}
            </span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-100 truncate font-sans">
              {activeModel.model_name || '—'}
            </span>
            <span className="text-[11px] text-emerald-400 bg-[#0B111E] px-1.5 py-0.5 rounded border border-[#1E293B] font-sans">
              ROC-AUC {formatModelScore(activeModel.model_roc_auc)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 border-t border-[#1E293B] pt-2 text-center font-sans">
            <div className="bg-[#0B111E] py-1 rounded border border-[#1E293B]">
              <div className="text-[9px] uppercase text-slate-400 font-sans">Precision</div>
              <div className="text-xs font-semibold text-slate-200">
                {formatModelPercent(activeModel.model_precision)}
              </div>
            </div>
            <div className="bg-[#0B111E] py-1 rounded border border-[#1E293B]">
              <div className="text-[9px] uppercase text-slate-400 font-sans">Recall</div>
              <div className="text-xs font-semibold text-slate-200">
                {formatModelPercent(activeModel.model_recall)}
              </div>
            </div>
            <div className="bg-[#0B111E] py-1 rounded border border-[#1E293B]">
              <div className="text-[9px] uppercase text-slate-400 font-sans">F1 Score</div>
              <div className="text-xs font-semibold text-cyan-400">
                {formatModelScore(activeModel.model_f1_score)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MIDDLE GRID: 60% Left (Chart) / 40% Right (PSI Gauge) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: Volume vs Fraud Score Curve */}
        <div className="lg:col-span-7 bg-[#131D31] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#1E293B] gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Transaction Volume vs Fraud Score Curve
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Dual-axis correlation with classification threshold cutoff (Threshold = 0.700)
              </p>
            </div>
            <div className="flex items-center gap-1 bg-[#0B111E] p-1 rounded-md border border-[#1E293B] text-xs">
              <span className="px-2 py-0.5 text-slate-400">1h</span>
              <span className="px-2 py-0.5 text-slate-400">6h</span>
              <span className="px-2 py-0.5 font-semibold bg-[#1E293B] text-cyan-300 rounded shadow-sm">
                24h
              </span>
              <span className="px-2 py-0.5 text-slate-400">7d</span>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="relative w-full h-56 mt-4 flex flex-col justify-end">
            <div className="absolute top-0 right-0 flex items-center gap-3 text-[11px] font-mono flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 bg-[#1E293B] border border-slate-600 inline-block rounded-xs"></span>
                <span className="text-slate-400">Ingestion Vol</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span>
                <span className="text-slate-300">Mean Score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-red-500 border-dashed border-t inline-block"></span>
                <span className="text-red-400 font-medium">0.70 Cutoff</span>
              </div>
            </div>

            <svg className="w-full h-44 overflow-visible" preserveAspectRatio="none" viewBox="0 0 620 160">
              {/* Gridlines */}
              <line stroke="#1E293B" strokeWidth="1" x1="30" x2="600" y1="20" y2="20" />
              <line stroke="#1E293B" strokeWidth="1" x1="30" x2="600" y1="60" y2="60" />
              <line stroke="#1E293B" strokeWidth="1" x1="30" x2="600" y1="100" y2="100" />
              <line stroke="#1E293B" strokeWidth="1" x1="30" x2="600" y1="140" y2="140" />

              {/* Volume Bars */}
              {[
                { x: 40, h: 80, y: 60 }, { x: 72, h: 90, y: 50 }, { x: 104, h: 105, y: 35 },
                { x: 136, h: 110, y: 30 }, { x: 168, h: 85, y: 55 }, { x: 200, h: 75, y: 65 },
                { x: 232, h: 95, y: 45 }, { x: 264, h: 115, y: 25 }, { x: 296, h: 120, y: 20 },
                { x: 328, h: 100, y: 40 }, { x: 360, h: 80, y: 60 }, { x: 392, h: 95, y: 45 },
                { x: 424, h: 110, y: 30 }, { x: 456, h: 125, y: 15 }, { x: 488, h: 115, y: 25 },
                { x: 520, h: 105, y: 35 }, { x: 552, h: 90, y: 50 },
              ].map((b, i) => (
                <rect
                  key={i}
                  fill="#625568"
                  height={b.h}
                  stroke="#897891"
                  strokeWidth="0.5"
                  width="16"
                  x={b.x}
                  y={b.y}
                />
              ))}

              {/* Cutoff line at 0.70 */}
              <line stroke="#E0B36A" strokeDasharray="4 3" strokeWidth="1.5" x1="30" x2="600" y1="45" y2="45" />
              <text fill="#E0B36A" fontFamily="JetBrains Mono" fontSize="10" fontWeight="600" x="515" y="40">
                CUTOFF: 0.70
              </text>

              {/* Score Spline */}
              <path
                d="M 40,115 Q 104,110 168,90 T 296,68 T 424,35 T 520,48 T 580,72"
                fill="none"
                stroke="#B97852"
                strokeWidth="2.5"
              />

              {/* Spike Highlight */}
              <circle cx="424" cy="35" fill="#E06C75" r="4" stroke="#17181D" strokeWidth="2" />
              <rect fill="#080E1B" height="18" rx="3" stroke="#223049" strokeWidth="1" width="95" x="375" y="10" />
              <text fill="#F8FAFC" fontFamily="JetBrains Mono" fontSize="9" fontWeight="500" x="382" y="22">
                Peak: 0.824
              </text>
            </svg>

            <div className="flex justify-between pl-8 pr-4 text-[11px] font-mono text-slate-500 border-t border-[#1E293B] pt-1">
              <span>00:00 UTC</span>
              <span>04:00 UTC</span>
              <span>08:00 UTC</span>
              <span>12:00 UTC</span>
              <span>16:00 UTC</span>
              <span>20:00 UTC</span>
              <span className="text-cyan-400 font-semibold">NOW</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Population Stability Index (PSI) - live data */}
        <div className="lg:col-span-5 bg-[#131D31] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
              <div>
                <h2 className="text-sm font-bold text-slate-100">Population Stability Index</h2>
                <p className="text-xs text-slate-400">
                  Mean of latest feature reports · {defaultModelId || 'no model'}
                </p>
              </div>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded border font-medium ${PSI_STATUS_CLASSES[psi.status]}`}>
                {psi.mean == null ? '—' : formatPsi(psi.mean)} {PSI_STATUS_LABELS[psi.status]}
              </span>
            </div>

            {/* Circular Gauge */}
            <div className="py-3 flex items-center justify-center gap-6">
              <div className="relative flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" fill="transparent" r="32" stroke="#1E293B" strokeWidth="7" />
                  <circle
                    cx="40"
                    cy="40"
                    fill="transparent"
                    r="32"
                    stroke={PSI_GAUGE_COLORS[psi.status]}
                    strokeDasharray={GAUGE_CIRCUMFERENCE}
                    strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - gaugeFill)}
                    strokeLinecap="round"
                    strokeWidth="7"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-base font-bold font-mono text-slate-100">
                    {psi.mean == null ? '—' : formatPsi(psi.mean)}
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-semibold">
                    Mean PSI
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-200 font-medium">
                    &lt; {PSI_WARNING.toFixed(2)}: Stable ({psi.stableCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-slate-400">
                    {PSI_WARNING.toFixed(2)} - {PSI_DRIFT.toFixed(2)}: Moderate ({psi.warningCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-slate-400">
                    &gt; {PSI_DRIFT.toFixed(2)}: Severe Drift ({psi.driftCount})
                  </span>
                </div>
              </div>
            </div>

            {/* Top Drifted Features */}
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-[11px] font-semibold text-slate-400 font-sans">
                Top Drifted Features
              </span>
              {topDriftedFeatures.length === 0 ? (
                <div className="bg-[#0B111E] p-2 rounded border border-[#1E293B] text-xs text-slate-400 text-center">
                  No drift reports for this model yet.
                </div>
              ) : topDriftedFeatures.map((report) => {
                const status = classifyPsi(report.drift_score);
                const textColor = status === 'drift_detected'
                  ? 'text-red-400'
                  : status === 'warning'
                    ? 'text-amber-400'
                    : 'text-emerald-400';
                const barColor = status === 'drift_detected'
                  ? 'bg-red-400'
                  : status === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400';
                const label = status === 'drift_detected' ? 'Severe' : status === 'warning' ? 'Moderate' : 'Stable';
                return (
                  <div key={report.report_id} className="bg-[#0B111E] p-2 rounded border border-[#1E293B] flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="text-slate-200 font-medium font-mono truncate">{report.feature_name}</span>
                      <span className={`${textColor} text-[11px] font-semibold font-sans`}>
                        PSI {formatPsi(report.drift_score)} • {label}
                      </span>
                    </div>
                    <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`${barColor} h-full`}
                        style={{ width: `${Math.min((report.drift_score / 0.5) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={onNavigateDrift}
            className="mt-3 w-full py-1 text-xs border border-[#1E293B] rounded hover:bg-[#1A263E] text-slate-300 flex items-center justify-center gap-1 transition-colors"
            type="button"
          >
            <span>View All Features & Drift Reports</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* BOTTOM GRID: 65% Transactions Table / 35% Alerts Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: Recent High-Risk Transactions */}
        <div className="lg:col-span-8 bg-[#131D31] border border-[#1E293B] rounded-lg p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              <h2 className="text-sm font-bold text-slate-100">Recent High-Risk Transactions</h2>
              <span className="text-[11px] font-mono text-red-400 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded">
                Action Required
              </span>
            </div>
            <button
              onClick={onNavigateTransactions}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              type="button"
            >
              <span>View All In Queue</span>
              <span className="material-symbols-outlined text-xs">open_in_new</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0B111E] border-b border-[#1E293B] text-slate-400 font-mono uppercase text-[11px]">
                  <th className="py-2.5 px-3">Tx ID</th>
                  <th className="py-2.5 px-3">Sender Account</th>
                  <th className="py-2.5 px-3">Destination Account</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B] font-mono">
                {transactions.slice(0, 5).map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-[#1A263E]/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-cyan-400">
                      TX-{tx.transaction_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{tx.sender_account_id}</td>
                    <td className="py-2.5 px-3 text-slate-300">{tx.destination_account_id}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-100 font-sans">
                      ${Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">{tx.transaction_type}</td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge
                        status={tx.is_fraud ? 'flagged' : 'approved'}
                        label={tx.is_fraud ? 'Flagged Fraud' : 'Cleared'}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        onClick={() => onInspectCase(tx.transaction_id)}
                        className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded text-xs transition-colors font-medium"
                        type="button"
                      >
                        Inspect Case
                      </button>
                    </td>
                  </tr>
                ))}

                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 px-3 text-center text-slate-400 font-sans">
                      {loading ? 'Loading transactions...' : 'No transactions found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Derived Drift Warnings (from real reports) */}
        <div className="lg:col-span-4 bg-[#131D31] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">
                    notifications_active
                  </span>
                  <h2 className="text-sm font-bold text-slate-100">Risk Warnings</h2>
                </div>
              </div>
              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded text-xs font-mono">
                Live
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {driftWarnings.length === 0 && (
                <div className="p-3 bg-[#0B111E] border border-[#1E293B] rounded text-xs text-slate-400 text-center font-sans">
                  No feature has PSI at or above {PSI_WARNING.toFixed(2)} for {defaultModelId || 'this model'}.
                </div>
              )}

              {driftWarnings.map((report) => {
                const isSevere = report.drift_score >= PSI_DRIFT;
                const when = report.report_time || report.checked_at;
                return (
                  <div
                    key={report.report_id}
                    className={`p-2.5 bg-[#0B111E] border-l-2 ${isSevere ? 'border-l-red-500' : 'border-l-amber-500'} border border-[#1E293B] rounded flex flex-col gap-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`${isSevere ? 'bg-red-950 text-red-400 border-red-800/70' : 'bg-amber-950/80 text-amber-300 border-amber-800/70'} border px-1.5 py-0.2 rounded font-sans text-[10px] font-semibold uppercase`}>
                        {isSevere ? 'SEVERE DRIFT' : 'DRIFT WARNING'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {when ? new Date(when).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    <div className="text-xs text-slate-200 leading-snug font-sans">
                      {isSevere ? 'Significant' : 'Moderate'} drift detected on{' '}
                      <code className="font-mono text-cyan-300">{report.feature_name}</code>{' '}
                      (PSI: {formatPsi(report.drift_score)}).
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-[#1E293B] text-[11px] font-sans">
                      <span className="text-slate-400">Covariate Shift</span>
                      <button
                        onClick={onNavigateDrift}
                        className="bg-[#131D31] hover:bg-[#1E293B] text-slate-300 border border-[#1E293B] px-2 py-0.5 rounded text-[11px] transition-colors"
                        type="button"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;