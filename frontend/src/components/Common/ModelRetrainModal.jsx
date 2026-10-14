import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';

const MODEL_OPTIONS = [
  { id: 'rf-balanced-v1', name: 'Random Forest' },
  { id: 'xgb-boosted-v1', name: 'XGBoost' },
  { id: 'lgb-fast-v1', name: 'LightGBM' },
  { id: 'gb-ensemble-v1', name: 'Gradient Boosting' },
  { id: 'lr-baseline-v1', name: 'Logistic Regression' },
];

export function ModelRetrainModal({ isOpen, onClose, onComplete }) {
  const { isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trainingScope, setTrainingScope] = useState('all');
  const [selectedModelId, setSelectedModelId] = useState(MODEL_OPTIONS[0].id);
  const [results, setResults] = useState([]);
  const [failures, setFailures] = useState([]);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setTrainingScope('all');
      setSelectedModelId(MODEL_OPTIONS[0].id);
      setResults([]);
      setFailures([]);
      setProgress(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async () => {
    if (!isAdmin || isSubmitting) return;

    const modelIds = trainingScope === 'all'
      ? MODEL_OPTIONS.map((modelOption) => modelOption.id)
      : [selectedModelId];
    const completedResults = [];
    const failedModels = [];

    setIsSubmitting(true);
    setResults([]);
    setFailures([]);

    for (let index = 0; index < modelIds.length; index += 1) {
      const modelId = modelIds[index];
      setProgress({ current: index + 1, total: modelIds.length, modelId, complete: false });
      try {
        const retrainingResult = await api.triggerRetrainPipeline(modelId);
        completedResults.push(retrainingResult);
        setResults([...completedResults]);
      } catch (err) {
        failedModels.push({ modelId, message: err.message || 'Model retraining failed.' });
        setFailures([...failedModels]);
      }
    }

    setProgress({ current: modelIds.length, total: modelIds.length, modelId: null, complete: true });
    setIsSubmitting(false);
    if (completedResults.length > 0) onComplete?.(completedResults);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Model Retraining"
      icon="restart_alt"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-xs">
        <p className="text-slate-300 leading-relaxed">
          Train and evaluate new model versions from the configured fraud dataset. Jobs run sequentially and do not replace production models.
        </p>

        <div className="bg-[#131D31] border border-[#1E293B] rounded divide-y divide-[#1E293B]">
          <div className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-slate-400">Models to retrain</span>
            <div className="flex items-center gap-4 text-slate-200">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="retraining-scope"
                  value="all"
                  checked={trainingScope === 'all'}
                  onChange={() => setTrainingScope('all')}
                  disabled={isSubmitting}
                  className="accent-cyan-400"
                />
                <span>All five</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="retraining-scope"
                  value="single"
                  checked={trainingScope === 'single'}
                  onChange={() => setTrainingScope('single')}
                  disabled={isSubmitting}
                  className="accent-cyan-400"
                />
                <span>One model</span>
              </label>
            </div>
          </div>
          {trainingScope === 'single' && (
            <div className="px-3.5 py-2.5 flex justify-between items-center gap-3">
              <label htmlFor="retrain-model" className="text-slate-400">Model family</label>
              <select
                id="retrain-model"
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
                disabled={isSubmitting}
                className="max-w-[65%] bg-[#0F172A] border border-[#334155] text-white rounded px-2 py-1 text-xs"
              >
                {MODEL_OPTIONS.map((modelOption) => (
                  <option key={modelOption.id} value={modelOption.id}>{modelOption.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="px-3.5 py-2.5 flex justify-between gap-3">
            <span className="text-slate-400">Training sample per model</span>
            <span className="font-mono text-white">80,000 non-fraud + all fraud rows</span>
          </div>
          <div className="px-3.5 py-2.5 flex justify-between gap-3">
            <span className="text-slate-400">Execution access</span>
            <span className={isAdmin ? 'text-emerald-400 font-semibold' : 'text-amber-300'}>
              {isAdmin ? 'Admin' : 'Admin role required'}
            </span>
          </div>
        </div>

        {isSubmitting && (
          <div className="flex items-center gap-2 p-3 border border-cyan-800/60 bg-cyan-950/30 rounded text-cyan-200">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin"></span>
            <span>
              Training {progress?.current} of {progress?.total}: {progress?.modelId}. Each model may take several minutes.
            </span>
          </div>
        )}

        {results.length > 0 && (
          <div className="p-3 border border-emerald-700/60 bg-emerald-950/30 rounded space-y-2 text-emerald-100">
            <p className="font-semibold">
              Retraining completed for {results.length} of {progress?.total || results.length} model(s)
            </p>
            <div className="divide-y divide-emerald-800/50">
              {results.map((result) => (
                <div key={result.model_id} className="py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span className="font-mono">{result.model_id}</span>
                  <span>F1 {Number(result.model_f1_score).toFixed(3)} · ROC-AUC {Number(result.model_roc_auc).toFixed(3)}</span>
                  <span>Full-sample matrix: {Number(result.full_sample_rows).toLocaleString()} rows</span>
                  <span>Drift refreshed: {Number(result.drift_reports_created || 0)} features</span>
                </div>
              ))}
            </div>
            <p className="text-emerald-200/80">New versions are registered as evaluated; production remains unchanged.</p>
          </div>
        )}

        {failures.length > 0 && (
          <div role="alert" className="p-3 border border-red-700/60 bg-red-950/40 rounded space-y-1 text-red-200">
            <p className="font-semibold">{results.length > 0 ? 'Some models could not be retrained:' : 'Retraining failed:'}</p>
            {failures.map((failure) => (
              <p key={failure.modelId}><span className="font-mono">{failure.modelId}</span>: {failure.message}</p>
            ))}
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2 border-t border-[#1E293B]">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-8 px-4 bg-[#131D31] border border-[#1E293B] text-slate-300 hover:text-white disabled:opacity-50 text-xs font-medium rounded transition-colors"
            type="button"
          >
            {results.length > 0 ? 'Done' : 'Close'}
          </button>
          {(!progress?.complete || results.length === 0) && (
            <button
              onClick={handleSubmit}
              disabled={!isAdmin || isSubmitting}
              className="h-8 px-4 font-semibold text-xs rounded bg-cyan-500 hover:bg-cyan-400 disabled:bg-[#1E293B] disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 flex items-center gap-1.5"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">{isSubmitting ? 'sync' : 'bolt'}</span>
              <span>
                {isSubmitting
                  ? 'Retraining...'
                  : trainingScope === 'all'
                    ? 'Retrain All Models'
                    : 'Retrain Selected Model'}
              </span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ModelRetrainModal;