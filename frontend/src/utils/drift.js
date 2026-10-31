/**
 * Single source of truth for PSI (drift) thresholds, formatting and
 * "which report counts" logic. Use this on Overview, Drift Monitoring and
 * Alerts so the same feature always shows the same number.
 */

export const PSI_WARNING = 0.10;
export const PSI_DRIFT = 0.25;

export const formatPsi = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : '--';
};

export const classifyPsi = (value) => {
  const n = Number(value);
  if (n >= PSI_DRIFT) return 'drift_detected';
  if (n >= PSI_WARNING) return 'warning';
  return 'stable';
};

const reportTime = (report) =>
  new Date(report.checked_at || report.report_time).getTime() || 0;

const isNewer = (candidate, current) => {
  if (!current) return true;
  const ct = reportTime(candidate);
  const pt = reportTime(current);
  return ct > pt || (ct === pt && candidate.report_id > current.report_id);
};

const normalise = (report) => ({ ...report, drift_score: Number(report.drift_score) });

/**
 * Latest report per feature.
 *  - modelId given  -> only that model's reports
 *  - modelId null   -> latest across all models for each feature
 */
export function latestReportsByFeature(reports, modelId = null) {
  const byFeature = new Map();
  for (const report of Array.isArray(reports) ? reports : []) {
    if (modelId && report.model_id !== modelId) continue;
    if (isNewer(report, byFeature.get(report.feature_name))) {
      byFeature.set(report.feature_name, report);
    }
  }
  return [...byFeature.values()].map(normalise);
}

/** Latest report per (model, feature) pair. */
export function latestReportsByModelFeature(reports) {
  const byKey = new Map();
  for (const report of Array.isArray(reports) ? reports : []) {
    const key = `${report.model_id}::${report.feature_name}`;
    if (isNewer(report, byKey.get(key))) byKey.set(key, report);
  }
  return [...byKey.values()].map(normalise);
}

/**
 * Summary shared by Overview and Drift Monitoring. Headline value is the MEAN
 * PSI across the latest per-feature reports of one model.
 */
export function summarisePsi(latestReports) {
  const scores = latestReports.map((r) => r.drift_score).filter(Number.isFinite);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return {
    mean,
    max: scores.length ? Math.max(...scores) : null,
    driftCount: scores.filter((s) => s >= PSI_DRIFT).length,
    warningCount: scores.filter((s) => s >= PSI_WARNING && s < PSI_DRIFT).length,
    stableCount: scores.filter((s) => s < PSI_WARNING).length,
    status: mean == null ? 'unavailable' : classifyPsi(mean),
  };
}

/** Same default-model rule on every screen. */
export function pickDefaultModelId(models, user) {
  if (!Array.isArray(models) || models.length === 0) return null;
  const configured = user?.modelEnvironment
    ? `${user.modelEnvironment.replace(/-v\d+$/, '')}-v1`
    : null;
  const found =
    models.find((m) => m.model_id === configured) ||
    models.find((m) => m.model_status?.toLowerCase() === 'active') ||
    models.find((m) => m.model_id === 'rf-balanced-v1') ||
    models[0];
  return found.model_id;
}