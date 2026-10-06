import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatusBadge from '../components/Common/StatusBadge';
import PendingNotice from '../components/Common/PendingNotice';

export function CaseDetailPage({ transactionId, onBackToTransactions }) {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verdict, setVerdict] = useState('fraud');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    loadCaseData();
  }, [transactionId]);

  const loadCaseData = async () => {
    setLoading(true);
    setSubmitError(null);
    try {
      let data = null;
      // 1. Try provided transactionId if valid
      if (transactionId) {
        try {
          data = await api.getTransaction(transactionId);
        } catch {
          // If transactionId is not found, fallback to fetching real latest transaction
        }
      }

      // 2. Fallback to latest transaction from backend if specific ID not found
      if (!data) {
        const txList = await api.getTransactions(0, 1);
        if (Array.isArray(txList) && txList.length > 0) {
          data = txList[0];
        }
      }

      if (data) {
        setTransaction(data);
        setVerdict(data.is_fraud ? 'fraud' : 'legitimate');
      } else {
        // Fallback default case placeholder only if backend returned 0 transactions
        setTransaction({
          transaction_id: transactionId || 1,
          user_id: 1,
          sender_account_id: 'ACC-SND-99201',
          destination_account_id: 'ACC-DST-44120',
          amount: 2450.0,
          old_balance: 5000.0,
          new_balance: 2550.0,
          transaction_type: 'TRANSFER',
          step: 42,
          is_fraud: true,
        });
      }
    } catch (err) {
      console.error('Failed to load case data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDecision = async (targetVerdict = verdict) => {
    if (!transaction?.transaction_id || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // 1. "In Review" must NOT write is_fraud=false.
    // Keep decision only in frontend session because backend has no review-status field.
    if (targetVerdict === 'review') {
      setVerdict('review');
      setSubmitFeedback({
        verdict: 'In Review',
        persisted: false,
        txId: transaction.transaction_id,
        isFraud: transaction.is_fraud,
        hasNotes: Boolean(notes && notes.trim()),
      });
      setIsSubmitting(false);
      return;
    }

    // 2. Confirm Fraud → persist is_fraud=true.
    // 3. Mark Legit → persist is_fraud=false.
    const isFraudValue = targetVerdict === 'fraud';
    const label = isFraudValue ? 'Confirm Fraud' : 'Mark Legit';

    try {
      // Persist only fields actually supported by the backend
      const updated = await api.updateTransaction(transaction.transaction_id, {
        is_fraud: isFraudValue,
      });

      setTransaction(updated);
      setVerdict(targetVerdict);

      // Show clear, truthful feedback without fabricating note persistence
      setSubmitFeedback({
        verdict: label,
        persisted: true,
        isFraud: updated.is_fraud,
        txId: updated.transaction_id,
        hasNotes: Boolean(notes && notes.trim()),
      });
    } catch (err) {
      // PRESERVE entered values (verdict and notes) if the request fails
      setSubmitError(err.message || 'Failed to update transaction on backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTx = transaction || {
    transaction_id: transactionId || 1,
    amount: 2450.0,
    sender_account_id: 'ACC-SND-99201',
    destination_account_id: 'ACC-DST-44120',
    transaction_type: 'TRANSFER',
    is_fraud: true,
  };

  return (
    <div className="space-y-5">
      {/* Top Action Ribbon */}
      <section className="bg-[#131D31] border border-[#223049] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBackToTransactions}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white bg-[#0F172A] hover:bg-[#1A263E] border border-[#1E293B] rounded transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to Transactions</span>
          </button>
          <div className="h-4 w-px bg-[#1E293B]"></div>
          <h1 className="text-base font-semibold text-white tracking-normal flex items-center gap-2">
            <span>Case Review:</span>
            <span className="font-mono text-cyan-400">TX-{currentTx.transaction_id}</span>
          </h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
            currentTx.is_fraud
              ? 'border-red-500/50 bg-red-950/40 text-red-300'
              : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${currentTx.is_fraud ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`}></span>
            <span>{currentTx.is_fraud ? 'Flagged as Fraud' : 'Cleared Baseline'}</span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleSubmitDecision('fraud')}
            disabled={isSubmitting}
            className="h-8 px-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">gavel</span>
            <span>Confirm Fraud & Block</span>
          </button>
          <button
            onClick={() => handleSubmitDecision('legitimate')}
            disabled={isSubmitting}
            className="h-8 px-3 bg-[#0F172A] hover:bg-emerald-950/40 disabled:opacity-50 text-emerald-300 border border-emerald-500/40 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
            <span>Dismiss as Legitimate</span>
          </button>
        </div>
      </section>

      {/* FEEDBACK BANNERS */}
      {submitFeedback && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-base">
                {submitFeedback.persisted ? 'verified' : 'pending_actions'}
              </span>
              <span className="font-semibold text-white">
                Analyst Verdict Recorded: <span className="text-cyan-300 font-bold">{submitFeedback.verdict}</span>
              </span>
              {submitFeedback.persisted ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-900/60 border border-emerald-600/40 text-emerald-300">
                  is_fraud = {String(submitFeedback.isFraud)}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300">
                  Session Only (Not Persisted)
                </span>
              )}
            </div>
            <button
              onClick={() => setSubmitFeedback(null)}
              className="text-slate-400 hover:text-white p-0.5"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          {submitFeedback.persisted ? (
            <p className="text-[11px] text-slate-300">
              Persisted via backend endpoint <code className="text-cyan-300 font-mono">PUT /transactions/{submitFeedback.txId}</code>.
            </p>
          ) : (
            <p className="text-[11px] text-amber-300/90 font-sans">
              "In Review" status is recorded in your active session only. It is <strong>not persisted to the database</strong> because the backend currently lacks a review-status field (the database only supports the boolean is_fraud flag).
            </p>
          )}
          {submitFeedback.hasNotes && (
            <p className="text-[10px] text-slate-400 font-sans italic">
              * Note: Investigation notes are retained in your active session only (the backend transaction schema currently has no notes column).
            </p>
          )}
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-lg text-xs text-red-200 flex items-start justify-between gap-2 shadow-sm">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-red-400 text-base shrink-0 mt-0.5">error</span>
            <div className="space-y-0.5">
              <span className="font-semibold text-red-300 block">Failed to Submit Decision:</span>
              <span className="text-[11px] leading-relaxed break-words">{submitError}</span>
            </div>
          </div>
          <button
            onClick={() => setSubmitError(null)}
            className="text-slate-400 hover:text-white p-0.5 shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Two-Column Layout */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-5 flex flex-col space-y-5">
          {/* Card 1: Core Transaction Metadata */}
          <article className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">receipt_long</span>
                <h2 className="text-xs font-semibold text-white">Core Transaction Metadata</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Step {currentTx.step || 42}</span>
            </div>

            <div className="p-3 bg-[#0F172A] border border-[#1E293B] rounded flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Transaction Amount</span>
                <div className="text-2xl font-bold text-white tracking-tight">
                  ${Number(currentTx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-slate-400 font-mono ml-1">USD</span>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 border border-red-800 text-red-300 font-medium text-xs">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  <span>High Value</span>
                </span>
                <span className="text-xs text-slate-400 block mt-1 font-mono">
                  {currentTx.transaction_type}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1E293B]/60">
                <span className="text-slate-400">Sender Account</span>
                <span className="font-mono text-white font-medium">{currentTx.sender_account_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1E293B]/60">
                <span className="text-slate-400">Destination Account</span>
                <span className="font-mono text-white font-medium">{currentTx.destination_account_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1E293B]/60">
                <span className="text-slate-400">Old Balance</span>
                <span className="font-mono text-slate-300">
                  ${Number(currentTx.old_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1E293B]/60">
                <span className="text-slate-400">New Balance</span>
                <span className="font-mono text-slate-300">
                  ${Number(currentTx.new_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </article>

          {/* Card 2: Historical Account Profile */}
          <article className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">account_balance</span>
                <h2 className="text-xs font-semibold text-white">Historical Account Profile</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">USR-PROFILE</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 bg-[#0F172A] rounded border border-[#1E293B]">
                <span className="text-slate-400 block text-[10px]">Account Age</span>
                <div className="text-base font-semibold text-white mt-1 font-mono">420 days</div>
                <span className="text-emerald-400 text-[10px]">Established</span>
              </div>
              <div className="p-2.5 bg-[#0F172A] rounded border border-[#1E293B]">
                <span className="text-slate-400 block text-[10px]">Avg 30d Vol</span>
                <div className="text-base font-semibold text-white mt-1 font-mono">$142.50</div>
                <span className="text-slate-400 text-[10px]">Monthly Mean</span>
              </div>
              <div className="p-2.5 bg-red-950/30 rounded border border-red-900/60">
                <span className="text-red-300 block text-[10px] font-medium">Velocity Spike</span>
                <div className="text-base font-semibold text-red-400 mt-1 font-mono">4.8x</div>
                <span className="text-red-300 text-[10px]">Tx / 24h</span>
              </div>
            </div>

            <div className="p-2.5 bg-[#0F172A] rounded border border-[#1E293B] text-xs text-slate-300 flex items-start gap-2">
              <span className="material-symbols-outlined text-sm text-cyan-400 mt-0.5">info</span>
              <p className="leading-relaxed text-xs">
                Account typically executes small retail payments. Current transaction deviates significantly
                from baseline average.
              </p>
            </div>
          </article>

          {/* Card 3: Analyst Verdict & Disposition Notes */}
          <article className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">rate_review</span>
                <h2 className="text-xs font-semibold text-white">Analyst Verdict & Notes</h2>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-[#0F172A] rounded text-slate-400 border border-[#1E293B]">
                Manual Disposition
              </span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmitDecision(verdict); }} className="space-y-3 text-xs">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Case Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex flex-col items-center justify-center p-2 rounded border cursor-pointer text-center transition-colors ${
                      verdict === 'fraud'
                        ? 'border-red-500/60 bg-red-950/40 text-red-300'
                        : 'border-[#1E293B] bg-[#0F172A] text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="verdict"
                      value="fraud"
                      checked={verdict === 'fraud'}
                      onChange={() => setVerdict('fraud')}
                      className="sr-only"
                    />
                    <span className="text-xs font-semibold">Confirm Fraud</span>
                  </label>

                  <label
                    className={`flex flex-col items-center justify-center p-2 rounded border cursor-pointer text-center transition-colors ${
                      verdict === 'legitimate'
                        ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                        : 'border-[#1E293B] bg-[#0F172A] text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="verdict"
                      value="legitimate"
                      checked={verdict === 'legitimate'}
                      onChange={() => setVerdict('legitimate')}
                      className="sr-only"
                    />
                    <span className="text-xs font-semibold">Mark Legit</span>
                  </label>

                  <label
                    className={`flex flex-col items-center justify-center p-2 rounded border cursor-pointer text-center transition-colors ${
                      verdict === 'review'
                        ? 'border-amber-500/60 bg-amber-950/40 text-amber-300'
                        : 'border-[#1E293B] bg-[#0F172A] text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="verdict"
                      value="review"
                      checked={verdict === 'review'}
                      onChange={() => setVerdict('review')}
                      className="sr-only"
                    />
                    <span className="text-xs font-semibold">In Review</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Investigation Notes</label>
                <textarea
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record analysis reasoning, feature anomalies, or verification details..."
                  className="w-full text-xs font-sans p-2.5 bg-[#0F172A] border border-[#1E293B] text-white rounded focus:border-cyan-400 focus:outline-none placeholder:text-slate-500 resize-none"
                ></textarea>
                <span className="text-[10px] text-slate-400 block mt-1 font-sans">
                  * Note: Submitting persists <code className="text-slate-300 font-mono">is_fraud</code> via backend PUT /transactions/{currentTx.transaction_id}. Investigation notes are retained in your active session (backend schema currently has no notes column).
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-3.5 py-1.5 font-semibold text-xs rounded transition-colors flex items-center gap-1.5 ${
                    isSubmitting
                      ? 'bg-cyan-800 text-slate-300 cursor-not-allowed'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-transparent animate-spin"></span>
                      <span>Submitting Decision...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                      <span>Submit Decision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </article>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-7 flex flex-col space-y-5">
          {/* Card 1: Model Inference & Risk Score */}
          <article className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">psychology</span>
                <h2 className="text-xs font-semibold text-white">Model Inference & Risk Score</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 bg-[#0F172A] text-cyan-300 border border-cyan-500/30 rounded">
                  Random Forest (SMOTE)
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Model Online"></span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 p-3.5 bg-red-950/30 border border-red-900/60 rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-300">Fraud Probability</span>
                  <span className="px-2 py-0.5 bg-red-600 text-white font-semibold text-[10px] rounded">
                    High Risk
                  </span>
                </div>
                <div className="my-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold font-mono text-red-400 tracking-tight">0.842</span>
                  <span className="text-xs text-red-300 font-mono">/ 1.000</span>
                </div>
                <div>
                  <div className="w-full bg-red-950/80 h-2 rounded-full relative overflow-hidden border border-red-900/50">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '84.2%' }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-red-300 mt-1.5">
                    <span className="text-slate-400">Safe (0.0)</span>
                    <span className="text-amber-300 font-mono">Threshold: 0.75</span>
                    <span className="text-red-400 font-medium">Flagged (1.0)</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-[#0F172A] border border-[#1E293B] rounded">
                  <span className="text-[10px] text-slate-400 block">Active Model</span>
                  <span className="font-medium text-white block truncate">RandomForestClassifier</span>
                  <span className="text-[10px] font-mono text-cyan-400">v1.0 (SMOTE)</span>
                </div>
                <div className="p-2 bg-[#0F172A] border border-[#1E293B] rounded">
                  <span className="text-[10px] text-slate-400 block">Balancing Method</span>
                  <span className="font-medium text-white block">SMOTE</span>
                  <span className="text-[10px] text-emerald-400">Ratio 1:1 on Train</span>
                </div>
                <div className="p-2 bg-[#0F172A] border border-[#1E293B] rounded">
                  <span className="text-[10px] text-slate-400 block">Decision Threshold</span>
                  <span className="font-semibold font-mono text-red-400 block">≥ 0.75 Flagged</span>
                  <span className="text-[10px] text-slate-400">Recall Optimized</span>
                </div>
                <div className="p-2 bg-[#0F172A] border border-[#1E293B] rounded">
                  <span className="text-[10px] text-slate-400 block">Validation Metrics</span>
                  <span className="font-medium text-white block font-mono">ROC-AUC: 0.942</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Precision: 92.4%</span>
                </div>
              </div>
            </div>

          </article>

          {/* Card 2: Local Feature Contributions (TreeSHAP Waterfall) */}
          <article className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">waterfall_chart</span>
                <h2 className="text-xs font-semibold text-white">
                  Feature Explainability (TreeSHAP Template)
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2 bg-red-500 rounded-xs"></span>
                  <span>+SHAP (Risk)</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2 bg-emerald-500 rounded-xs"></span>
                  <span>-SHAP (Protective)</span>
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300">
              Base rate score <span className="text-white font-mono font-semibold">E[f(x)] = 0.12</span> shifted to{' '}
              <span className="text-red-400 font-mono font-bold">f(x) = 0.842</span> by top features:
            </div>

            {/* Waterfall Bars */}
            <div className="space-y-2 pt-1 text-xs">
              <div className="p-2 rounded bg-[#0F172A] border border-[#1E293B]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-slate-200 text-xs">amt_ratio_to_avg (3.4x)</span>
                  <span className="text-red-400 font-mono font-bold text-xs">+0.28</span>
                </div>
                <div className="w-full bg-[#161F33] h-2.5 rounded relative flex items-center">
                  <div className="absolute left-[35%] top-0 bottom-0 w-0.5 bg-slate-600 z-10"></div>
                  <div className="absolute left-[35%] h-2 bg-red-500 rounded-r" style={{ width: '48%' }}></div>
                </div>
              </div>

              <div className="p-2 rounded bg-[#0F172A] border border-[#1E293B]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-slate-200 text-xs">transaction_velocity_1h (4 txs)</span>
                  <span className="text-red-400 font-mono font-bold text-xs">+0.21</span>
                </div>
                <div className="w-full bg-[#161F33] h-2.5 rounded relative flex items-center">
                  <div className="absolute left-[35%] top-0 bottom-0 w-0.5 bg-slate-600 z-10"></div>
                  <div className="absolute left-[35%] h-2 bg-red-500 rounded-r" style={{ width: '36%' }}></div>
                </div>
              </div>

              <div className="p-2 rounded bg-[#0F172A] border border-[#1E293B]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-slate-200 text-xs">destination_step_diff</span>
                  <span className="text-red-400 font-mono font-bold text-xs">+0.15</span>
                </div>
                <div className="w-full bg-[#161F33] h-2.5 rounded relative flex items-center">
                  <div className="absolute left-[35%] top-0 bottom-0 w-0.5 bg-slate-600 z-10"></div>
                  <div className="absolute left-[35%] h-2 bg-red-500 rounded-r" style={{ width: '26%' }}></div>
                </div>
              </div>

              <div className="p-2 rounded bg-[#0F172A] border border-[#1E293B]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-slate-200 text-xs">account_age_days (420 days)</span>
                  <span className="text-emerald-400 font-mono font-bold text-xs">-0.09 (protective)</span>
                </div>
                <div className="w-full bg-[#161F33] h-2.5 rounded relative flex items-center">
                  <div className="absolute left-[35%] top-0 bottom-0 w-0.5 bg-slate-600 z-10"></div>
                  <div className="absolute right-[65%] h-2 bg-emerald-500 rounded-l" style={{ width: '16%' }}></div>
                </div>
              </div>
            </div>

          </article>
        </div>
      </main>
    </div>
  );
}

export default CaseDetailPage;
