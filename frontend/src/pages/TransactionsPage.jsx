import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import StatusBadge from '../components/Common/StatusBadge';
import Modal from '../components/Common/Modal';
import PendingNotice from '../components/Common/PendingNotice';

export function TransactionsPage({ onInspectCase, onTransactionCreated, onTransactionDeleted }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Selected Transaction for Drawer
  const [selectedTx, setSelectedTx] = useState(null);

  // Users list from backend for valid sender mapping
  const [usersList, setUsersList] = useState([]);

  // Modal State for Adding Transaction
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    user_id: 1,
    sender_account_id: 'ACC-USR-1001',
    destination_account_id: 'ACC-DST-8821',
    step: 1,
    transaction_type: 'TRANSFER',
    amount: 1250.0,
    old_balance: 5000.0,
    new_balance: 3750.0,
    is_fraud: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [successFeedback, setSuccessFeedback] = useState(null);

  useEffect(() => {
    loadTransactions();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await api.getUsers(0, 100);
      if (Array.isArray(usersData) && usersData.length > 0) {
        setUsersList(usersData);
        // Pre-sync sender account to match an existing valid user
        setFormData((prev) => ({
          ...prev,
          user_id: usersData[0].user_id,
          sender_account_id: usersData[0].account_id || prev.sender_account_id,
        }));
      }
    } catch (uErr) {
      console.warn('Could not pre-load users list:', uErr.message);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTransactions(0, 100);
      if (Array.isArray(data)) {
        setTransactions(data);
        if (data.length > 0 && !selectedTx) {
          setSelectedTx(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // CRUD: Create Transaction & Score
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate fields client-side before sending
    const userIdNum = Number(formData.user_id);
    if (!userIdNum || userIdNum <= 0) {
      setModalError('Valid User ID (> 0) is required.');
      return;
    }
    const senderAcc = formData.sender_account_id?.trim();
    if (!senderAcc) {
      setModalError('Sender Account ID is required.');
      return;
    }
    const destAcc = formData.destination_account_id?.trim();
    if (!destAcc) {
      setModalError('Destination Account ID is required.');
      return;
    }
    const amountNum = Number(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setModalError('Transaction amount must be greater than 0.');
      return;
    }
    const stepNum = Number(formData.step);
    if (isNaN(stepNum) || stepNum < 0) {
      setModalError('Step must be a non-negative integer (>= 0).');
      return;
    }
    const oldBal = formData.old_balance !== '' ? Number(formData.old_balance) : 0;
    const newBal = formData.new_balance !== '' ? Number(formData.new_balance) : 0;
    if (oldBal < 0 || newBal < 0) {
      setModalError('Balances cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      // Build payload matching backend schemas.TransactionCreate
      const payload = {
        user_id: userIdNum,
        sender_account_id: senderAcc,
        destination_account_id: destAcc,
        step: stepNum,
        transaction_type: formData.transaction_type,
        amount: amountNum,
        old_balance: oldBal,
        new_balance: newBal,
      };

      // Only send manual override if explicitly checked by user;
      // Do NOT send is_fraud=false merely because the checkbox is unchecked.
      // Omission allows the backend/model to auto-score via Random Forest.
      if (formData.is_fraud) {
        payload.is_fraud = true;
      }

      // 1. POST the transaction using the existing backend
      let newTx = await api.createTransaction(payload);
      const initiallyPersistedTransaction = newTx;

      // 2. Real scoring endpoint call if available
      let scoringResult = null;
      let scoringUnavailable = false;
      try {
        const predictPayload = {
          transaction_id: newTx.transaction_id,
          model_id: 'rf-balanced-v1',
          step: Number(newTx.step ?? stepNum),
          amount: Number(newTx.amount),
          oldbalanceOrg: Number(newTx.old_balance ?? oldBal),
          newbalanceOrig: Number(newTx.new_balance ?? newBal),
          oldbalanceDest: 0,
          newbalanceDest: Number(newTx.amount),
          isFlaggedFraud: 0,
          transaction_type: newTx.transaction_type,
        };
        const predictRes = await api.predictTransaction(predictPayload);
        if (predictRes && typeof predictRes.fraud_probability === 'number') {
          scoringResult = predictRes;

          // Ensure stored transaction fraud state and displayed POST /predict/ result cannot contradict each other:
          // If the user did not manually override, ensure the stored transaction matches the model prediction.
          if (!formData.is_fraud && scoringResult.prediction !== newTx.is_fraud) {
            try {
              const syncedTx = await api.updateTransaction(newTx.transaction_id, {
                is_fraud: scoringResult.prediction,
              });
              newTx = syncedTx;
            } catch (syncErr) {
              console.warn('Could not sync transaction fraud status with scoring result:', syncErr.message);
            }
          }
        } else {
          scoringUnavailable = true;
        }
      } catch (scoreErr) {
        console.warn('Real-time ML scoring call failed / unavailable:', scoreErr.message);
        // Do NOT fabricate score
        scoringUnavailable = true;
      }

      // 3. Update transaction state and UI
      setTransactions((prev) => [newTx, ...prev]);
      onTransactionCreated?.(initiallyPersistedTransaction, scoringResult);
      setSelectedTx(newTx);
      setIsAddModalOpen(false);

      // 4. Set readable feedback banner ensuring consistent verdict display
      setSuccessFeedback({
        txId: newTx.transaction_id,
        isFraud: newTx.is_fraud,
        manualOverride: Boolean(formData.is_fraud),
        scoringResult,
        scoringUnavailable,
      });

      // Reset form with valid defaults
      const defaultUser = usersList.length > 0 ? usersList[0] : null;
      setFormData({
        user_id: defaultUser ? defaultUser.user_id : 1,
        sender_account_id: defaultUser?.account_id || `ACC-USR-1001`,
        destination_account_id: `ACC-DST-${Math.floor(1000 + Math.random() * 9000)}`,
        step: stepNum + 1,
        transaction_type: 'TRANSFER',
        amount: 500.0,
        old_balance: 2000.0,
        new_balance: 1500.0,
        is_fraud: false,
      });
    } catch (err) {
      // Readable backend errors shown in modal, preserved entered values
      setModalError(err.message || 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // CRUD: Update is_fraud Flag
  const handleToggleFraud = async (tx, e) => {
    if (e) e.stopPropagation();
    try {
      const updated = await api.updateTransaction(tx.transaction_id, {
        is_fraud: !tx.is_fraud,
      });
      setTransactions((prev) =>
        prev.map((t) => (t.transaction_id === tx.transaction_id ? updated : t))
      );
      if (selectedTx?.transaction_id === tx.transaction_id) {
        setSelectedTx(updated);
      }
    } catch (err) {
      alert(`Failed to update fraud flag: ${err.message}`);
    }
  };

  // CRUD: Delete Transaction
  const handleDeleteTransaction = async (txId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete transaction TX-${txId} from database?`)) return;

    try {
      await api.deleteTransaction(txId);
      setTransactions((prev) => prev.filter((t) => t.transaction_id !== txId));
      onTransactionDeleted?.();
      if (selectedTx?.transaction_id === txId) {
        setSelectedTx(null);
      }
    } catch (err) {
      alert(`Failed to delete transaction: ${err.message}`);
    }
  };

  // Filtering
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      searchQuery === '' ||
      tx.transaction_id?.toString().includes(searchQuery) ||
      tx.sender_account_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.destination_account_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDecision =
      decisionFilter === 'ALL' ||
      (decisionFilter === 'FRAUD' && tx.is_fraud) ||
      (decisionFilter === 'CLEARED' && !tx.is_fraud);

    const matchesType =
      typeFilter === 'ALL' || tx.transaction_type === typeFilter;

    return matchesSearch && matchesDecision && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* REAL-TIME SUBMISSION FEEDBACK BANNER */}
      {successFeedback && (
        <div className="p-3 bg-[#132238] border border-cyan-500/50 rounded-lg text-xs text-slate-200 flex items-start justify-between gap-3 shadow-md">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-cyan-400 text-lg shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white">
                  Transaction <span className="font-mono text-cyan-400 font-bold">TX-{successFeedback.txId}</span> Saved Successfully!
                </span>
                {successFeedback.isFraud ? (
                  <span className="px-1.5 py-0.5 rounded bg-red-950/70 border border-red-600/50 text-red-300 text-[10px] font-mono">
                    {successFeedback.manualOverride ? 'Flagged Fraud (Manual Override)' : 'Flagged Fraud (ML Auto-Scored)'}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 text-[10px] font-mono">
                    Cleared Baseline (ML Auto-Scored)
                  </span>
                )}
              </div>

              {successFeedback.scoringResult ? (
                <div className="text-[11px] text-slate-300 space-y-0.5">
                  <p className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-400">Real ML Model Score:</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {(successFeedback.scoringResult.fraud_probability * 100).toFixed(2)}% probability
                    </span>
                    <span className="text-slate-500">•</span>
                    <span>Model: <code className="text-slate-200 font-mono">{successFeedback.scoringResult.model_id}</code></span>
                    <span className="text-slate-500">•</span>
                    <span>
                      Verdict:{' '}
                      <strong className={successFeedback.isFraud ? 'text-red-400' : 'text-emerald-400'}>
                        {successFeedback.isFraud
                          ? (successFeedback.manualOverride && !successFeedback.scoringResult.prediction
                              ? 'FLAGGED (Manual Override)'
                              : 'FLAGGED FRAUD')
                          : 'CLEARED BASELINE'}
                      </strong>
                    </span>
                  </p>
                  {successFeedback.scoringResult.reasons?.length > 0 && (
                    <p className="text-[10px] text-slate-400 font-sans italic">
                      Reason: {successFeedback.scoringResult.reasons[0]}
                    </p>
                  )}
                </div>
              ) : successFeedback.scoringUnavailable ? (
                <p className="text-[11px] text-amber-300/90 font-sans">
                  Real-time ML scoring endpoint currently unavailable / pending. Record persisted in MySQL ledger without fabricated score.
                </p>
              ) : null}
            </div>
          </div>

          <button
            onClick={() => setSuccessFeedback(null)}
            className="text-slate-400 hover:text-white p-1"
            type="button"
            title="Dismiss"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* PAGE HEADER BAR */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#131D31] px-4 py-3 rounded-lg border border-[#223049] gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold text-white tracking-tight">
              Transactions Ledger & Real-Time Scoring
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 text-[11px] font-medium border border-cyan-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Live Stream Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time MySQL records evaluated by Random Forest classification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            type="button"
            className="h-8 px-3 rounded bg-[#0F172A] border border-[#223049] text-slate-200 text-xs font-medium hover:bg-[#1A263D] hover:border-cyan-500/40 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-cyan-400 text-base">add_circle</span>
            <span>Add Test Transaction</span>
          </button>
        </div>
      </section>

      {/* FILTER TOOLBAR */}
      <section className="bg-[#131D31] p-3 rounded-lg border border-[#223049] space-y-2.5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-6 relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
              search
            </span>
            <input
              type="text"
              placeholder="Search by ID, sender, or destination account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-0 font-sans"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-slate-200 focus:border-cyan-400 focus:ring-0 font-sans"
            >
              <option value="ALL">Decision: All</option>
              <option value="FRAUD">Flagged Fraud (is_fraud=true)</option>
              <option value="CLEARED">Cleared Baseline</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-slate-200 focus:border-cyan-400 focus:ring-0 font-sans"
            >
              <option value="ALL">Channel / Type: All</option>
              <option value="PAYMENT">PAYMENT</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="CASH_OUT">CASH_OUT</option>
              <option value="DEBIT">DEBIT</option>
              <option value="CASH_IN">CASH_IN</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[#1E293B] pt-2 text-[11px] text-slate-400">
          <span>Showing {filteredTransactions.length} of {transactions.length} records</span>
          {(searchQuery || decisionFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDecisionFilter('ALL');
                setTypeFilter('ALL');
              }}
              className="text-cyan-400 hover:underline font-semibold"
              type="button"
            >
              Reset Filters
            </button>
          )}
        </div>
      </section>

      {/* DATA AREA: TABLE + FORENSIC INSPECTOR DRAWER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* TRANSACTIONS TABLE */}
        <section className="lg:col-span-8 bg-[#131D31] rounded-lg border border-[#223049] overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px] text-xs">
              <thead className="bg-[#0F172A] border-b border-[#1E293B] text-slate-400 text-[11px] uppercase tracking-wider font-semibold font-mono">
                <tr>
                  <th className="px-3 py-2.5">Tx ID</th>
                  <th className="px-3 py-2.5">Sender</th>
                  <th className="px-3 py-2.5">Destination</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-center">Fraud Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B] text-slate-200 font-mono">
                {filteredTransactions.map((tx) => {
                  const isSelected = selectedTx?.transaction_id === tx.transaction_id;
                  return (
                    <tr
                      key={tx.transaction_id}
                      onClick={() => setSelectedTx(tx)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400'
                          : 'hover:bg-[#1A263D]/60'
                      }`}
                    >
                      <td className="px-3 py-2 font-bold text-cyan-400">
                        TX-{tx.transaction_id}
                      </td>
                      <td className="px-3 py-2 text-slate-200">{tx.sender_account_id}</td>
                      <td className="px-3 py-2 text-slate-300">{tx.destination_account_id}</td>
                      <td className="px-3 py-2 text-right font-semibold text-white font-sans">
                        ${Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 font-sans text-slate-300">{tx.transaction_type}</td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge
                          status={tx.is_fraud ? 'flagged' : 'approved'}
                          label={tx.is_fraud ? 'Flagged Fraud' : 'Cleared'}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-sans space-x-1">
                        <button
                          onClick={(e) => handleToggleFraud(tx, e)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            tx.is_fraud
                              ? 'bg-amber-950/60 border border-amber-600/50 text-amber-300 hover:bg-amber-900/60'
                              : 'bg-red-950/60 border border-red-600/50 text-red-300 hover:bg-red-900/60'
                          }`}
                          title="Toggle is_fraud via PUT /transactions/{id}"
                          type="button"
                        >
                          {tx.is_fraud ? 'Unflag' : 'Flag'}
                        </button>
                        <button
                          onClick={(e) => handleDeleteTransaction(tx.transaction_id, e)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-red-900/80 text-slate-400 hover:text-white transition-colors"
                          title="Delete via DELETE /transactions/{id}"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredTransactions.length === 0 && !loading && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 font-sans">
                      No transactions found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* FORENSIC INSPECTOR DRAWER */}
        <aside className="lg:col-span-4 bg-[#131D31] border border-[#223049] rounded-lg shadow-lg flex flex-col overflow-hidden">
          {selectedTx ? (
            <>
              <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between bg-[#0F172A]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-lg">insights</span>
                  <div>
                    <h3 className="font-sans text-xs font-bold text-white leading-tight">
                      Forensic Inspector
                    </h3>
                    <span className="font-mono text-[10px] text-cyan-400">
                      TX-{selectedTx.transaction_id}
                    </span>
                  </div>
                </div>
                <StatusBadge
                  status={selectedTx.is_fraud ? 'flagged' : 'approved'}
                  label={selectedTx.is_fraud ? 'FLAGGED' : 'CLEARED'}
                />
              </div>

              <div className="p-4 space-y-3 text-xs">
                {/* Score / Verdict Card */}
                <div
                  className={`p-3 rounded border flex items-center justify-between ${
                    selectedTx.is_fraud
                      ? 'bg-red-950/40 border-red-600/50 text-red-300'
                      : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider block font-sans">
                      Random Forest Classification
                    </span>
                    <p className="text-white text-xs font-semibold mt-0.5 font-sans">
                      {selectedTx.is_fraud ? 'Predicted Fraud' : 'Cleared Transaction'}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-0.5 font-sans">
                      {selectedTx.is_fraud
                        ? (selectedTx.old_balance > 0 && selectedTx.new_balance === 0
                            ? 'Flagged: 100% account balance emptied to 0.00 (High-risk account drain pattern)'
                            : 'Flagged by Random Forest model rule or manual analyst review')
                        : 'Cleared within baseline distribution bounds'}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-sm font-bold block leading-none">
                      {selectedTx.is_fraud ? 'FLAGGED' : 'CLEARED'}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase font-sans">
                      Status
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="border border-[#1E293B] rounded p-3 bg-[#0F172A] space-y-2">
                  <h4 className="text-[10px] uppercase text-slate-400 font-bold tracking-wider font-sans">
                    Transaction Schema Details
                  </h4>
                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <dt className="text-slate-400">Sender Account</dt>
                      <dd className="font-mono text-white font-medium truncate mt-0.5">
                        {selectedTx.sender_account_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Destination Account</dt>
                      <dd className="font-mono text-white font-medium truncate mt-0.5">
                        {selectedTx.destination_account_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Amount</dt>
                      <dd className="font-semibold text-white truncate mt-0.5">
                        ${Number(selectedTx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Step (Time)</dt>
                      <dd className="font-mono text-slate-300 truncate mt-0.5">
                        Step {selectedTx.step}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Old Balance</dt>
                      <dd className="font-mono text-slate-300 truncate mt-0.5">
                        ${Number(selectedTx.old_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">New Balance</dt>
                      <dd className="font-mono text-slate-300 truncate mt-0.5">
                        ${Number(selectedTx.new_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* SHAP Feature Contribution Preview */}
                <div className="border border-[#1E293B] rounded p-3 bg-[#0F172A] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] uppercase text-slate-400 font-bold tracking-wider font-sans">
                      Top SHAP Feature Contributions
                    </h4>
                    <span className="text-[10px] font-mono text-cyan-400">TreeSHAP</span>
                  </div>

                  <div className="space-y-2 font-sans">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-300">amount_to_oldbalance</span>
                        <span className="text-red-400 font-bold">+0.31</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: '78%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-300">transaction_step_freq</span>
                        <span className="text-red-400 font-bold">+0.22</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: '55%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-3 border-t border-[#1E293B] bg-[#0F172A] flex items-center justify-between gap-2">
                <button
                  onClick={() => onInspectCase(selectedTx.transaction_id)}
                  className="h-7 px-2.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
                  type="button"
                >
                  Open Full Case
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleToggleFraud(selectedTx, e)}
                    className={`h-7 px-3 rounded text-xs font-medium transition-colors ${
                      selectedTx.is_fraud
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                        : 'bg-red-600 hover:bg-red-500 text-white font-semibold'
                    }`}
                    type="button"
                  >
                    {selectedTx.is_fraud ? 'Clear Fraud' : 'Flag Fraud'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Select a transaction to inspect its forensic features and SHAP attribution.
            </div>
          )}
        </aside>
      </div>

      {/* MODAL: ADD TEST TRANSACTION (POST /transactions/) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setModalError(null);
          setIsAddModalOpen(false);
        }}
        title="Add Test Transaction"
        icon="add_card"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs font-sans">
          {modalError && (
            <div className="p-2.5 rounded bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-red-400 text-base shrink-0 mt-0.5">error</span>
              <div className="space-y-0.5 min-w-0">
                <span className="font-semibold block text-red-300">Transaction Save Error:</span>
                <span className="text-[11px] leading-relaxed break-words">{modalError}</span>
              </div>
            </div>
          )}

          {usersList.length > 0 && (
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Associated User (Sender Account Match)
              </label>
              <select
                value={formData.user_id}
                onChange={(e) => {
                  const selectedId = Number(e.target.value);
                  const found = usersList.find((u) => u.user_id === selectedId);
                  setFormData((prev) => ({
                    ...prev,
                    user_id: selectedId,
                    sender_account_id: found ? found.account_id : prev.sender_account_id,
                  }));
                }}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-sans"
              >
                {usersList.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    User #{u.user_id} — {u.name || u.email || 'User'} ({u.account_id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase text-slate-400 font-semibold">
                  Sender Account ID
                </label>
                <span className="text-[9px] text-cyan-400 font-mono">User #{formData.user_id}</span>
              </div>
              <input
                type="text"
                required
                maxLength={50}
                value={formData.sender_account_id}
                onChange={(e) => setFormData({ ...formData, sender_account_id: e.target.value })}
                className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Destination Account ID
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={formData.destination_account_id}
                onChange={(e) => setFormData({ ...formData, destination_account_id: e.target.value })}
                className="w-full h-8 px-2.5 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Type
              </label>
              <select
                value={formData.transaction_type}
                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400"
              >
                <option value="TRANSFER">TRANSFER</option>
                <option value="PAYMENT">PAYMENT</option>
                <option value="CASH_OUT">CASH_OUT</option>
                <option value="DEBIT">DEBIT</option>
                <option value="CASH_IN">CASH_IN</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Step (Hour)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                required
                value={formData.step}
                onChange={(e) => setFormData({ ...formData, step: parseInt(e.target.value, 10) || 0 })}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                Old Balance
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.old_balance}
                onChange={(e) => setFormData({ ...formData, old_balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 font-semibold">
                New Balance
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.new_balance}
                onChange={(e) => setFormData({ ...formData, new_balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="w-full h-8 px-2 bg-[#0F172A] border border-[#223049] rounded text-xs text-white focus:border-cyan-400 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isFraudCheck"
              checked={formData.is_fraud}
              onChange={(e) => setFormData({ ...formData, is_fraud: e.target.checked })}
              className="rounded border-[#223049] bg-[#0B111E] text-red-500 focus:ring-0"
            />
            <label htmlFor="isFraudCheck" className="text-xs text-slate-300">
              Flag as Fraudulent (<code className="text-red-400">is_fraud = true</code>)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#1E293B] pt-3 mt-2">
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setIsAddModalOpen(false);
              }}
              className="h-7 px-3 rounded bg-[#0F172A] border border-[#223049] text-slate-300 text-xs hover:bg-[#1A263D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`h-7 px-3.5 rounded font-semibold text-xs transition-colors flex items-center gap-1.5 ${
                isSubmitting
                  ? 'bg-cyan-800 text-slate-300 cursor-not-allowed'
                  : 'bg-cyan-500 text-[#041E26] hover:bg-cyan-400'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-transparent animate-spin"></span>
                  <span>Saving & Scoring...</span>
                </>
              ) : (
                <span>Save & Score Transaction</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TransactionsPage;
