import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import Modal from '../components/Common/Modal';

export function DatabaseTablesPage() {
  const [tablesList, setTablesList] = useState([]);
  const [selectedTable, setSelectedTable] = useState('frauds');
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Column-specific filter
  const [filterColumn, setFilterColumn] = useState('');
  const [filterOperator, setFilterOperator] = useState('contains');
  const [filterValue, setFilterValue] = useState('');

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  // Row Inspection Modal
  const [inspectRow, setInspectRow] = useState(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Load available database tables
  useEffect(() => {
    loadTables();
  }, []);

  // Reload table data when selection, pagination, sorting, or filters change
  useEffect(() => {
    if (selectedTable) {
      loadTableData();
    }
  }, [selectedTable, page, pageSize, sortBy, sortOrder, searchTerm, filterColumn, filterOperator, filterValue]);

  const loadTables = async () => {
    try {
      const data = await api.getDatabaseTables();
      if (Array.isArray(data) && data.length > 0) {
        setTablesList(data);
        // Default to 'frauds' or first table if 'frauds' not found
        const hasFrauds = data.some((t) => t.table_name === 'frauds');
        if (!hasFrauds && data[0]) {
          setSelectedTable(data[0].table_name);
        }
      }
    } catch (err) {
      console.error('Failed to load database tables:', err);
      setError(`Failed to inspect tables: ${err.message}`);
    }
  };

  const loadTableData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize,
      };
      if (sortBy) {
        params.sort_by = sortBy;
        params.order = sortOrder;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (filterColumn && filterValue !== '') {
        params.filter_column = filterColumn;
        params.filter_operator = filterOperator;
        params.filter_value = filterValue;
      }

      const res = await api.getTableData(selectedTable, params);
      setTableData(res);

      // Initialize visible columns if not yet set for this table
      if (res.columns && (!visibleColumns[selectedTable] || visibleColumns[selectedTable].length === 0)) {
        setVisibleColumns((prev) => ({
          ...prev,
          [selectedTable]: res.columns.map((c) => c.name),
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch records for ${selectedTable}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTableSwitch = (tableName) => {
    setSelectedTable(tableName);
    setPage(1);
    setSortBy('');
    setSortOrder('desc');
    setSearchTerm('');
    setSearchInput('');
    setFilterColumn('');
    setFilterValue('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  };

  const handleSort = (columnName) => {
    if (sortBy === columnName) {
      // Toggle direction or reset
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortBy('');
        setSortOrder('desc');
      }
    } else {
      setSortBy(columnName);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleApplyPreset = (preset) => {
    setFilterColumn(preset.column);
    setFilterOperator(preset.operator);
    setFilterValue(preset.value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilterColumn('');
    setFilterValue('');
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  };

  const toggleColumn = (colName) => {
    const current = visibleColumns[selectedTable] || [];
    if (current.includes(colName)) {
      if (current.length > 1) {
        setVisibleColumns({
          ...visibleColumns,
          [selectedTable]: current.filter((c) => c !== colName),
        });
      }
    } else {
      setVisibleColumns({
        ...visibleColumns,
        [selectedTable]: [...current, colName],
      });
    }
  };

  // Export functions
  const exportToCSV = () => {
    if (!tableData || !tableData.rows || tableData.rows.length === 0) return;
    const activeCols = (visibleColumns[selectedTable] || tableData.columns.map((c) => c.name));
    const header = activeCols.join(',');
    const rows = tableData.rows.map((row) =>
      activeCols.map((c) => {
        const val = row[c];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedTable}_page_${page}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (!tableData || !tableData.rows) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(tableData.rows, null, 2)
    )}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `${selectedTable}_page_${page}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyRowJSON = (row) => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Table presets by table
  const tablePresets = {
    frauds: [
      { label: 'Confirmed Frauds (Pred=1)', column: 'prediction', operator: 'is_true', value: '1' },
      { label: 'High Score (> 0.85)', column: 'Fraud_score', operator: 'gte', value: '0.85' },
      { label: 'Low Score (< 0.15)', column: 'Fraud_score', operator: 'lte', value: '0.15' },
      { label: 'XGBoost Only', column: 'model_id', operator: 'contains', value: 'xgb' },
      { label: 'Random Forest Only', column: 'model_id', operator: 'contains', value: 'rf' },
    ],
    drift_reports: [
      { label: 'Drift Detected (PSI >= 0.25)', column: 'drift_status', operator: 'eq', value: 'drift_detected' },
      { label: 'Warning Features', column: 'drift_status', operator: 'eq', value: 'warning' },
      { label: 'Stable Features', column: 'drift_status', operator: 'eq', value: 'stable' },
      { label: 'Amount Features', column: 'feature_name', operator: 'contains', value: 'amount' },
    ],
    models: [
      { label: 'Active Models', column: 'model_status', operator: 'eq', value: 'active' },
      { label: 'Evaluated Models', column: 'model_status', operator: 'eq', value: 'evaluated' },
    ],
    transactions: [
      { label: 'Fraud Only', column: 'is_fraud', operator: 'is_true', value: '1' },
      { label: 'Transfers', column: 'transaction_type', operator: 'eq', value: 'TRANSFER' },
      { label: 'Cash Out', column: 'transaction_type', operator: 'eq', value: 'CASH_OUT' },
      { label: 'High Value (> $100k)', column: 'amount', operator: 'gte', value: '100000' },
    ],
    users: [
      { label: 'Customer Accounts', column: 'account_type', operator: 'eq', value: 'customer' },
    ],
  };

  const currentTableMeta = tablesList.find((t) => t.table_name === selectedTable) || {};
  const activeCols = useMemo(() => {
    if (!tableData || !tableData.columns) return [];
    const visibleList = visibleColumns[selectedTable];
    if (!visibleList) return tableData.columns.map((c) => c.name);
    return tableData.columns.map((c) => c.name).filter((name) => visibleList.includes(name));
  }, [tableData, visibleColumns, selectedTable]);

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <section className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <span className="material-symbols-outlined text-lg">database</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  MySQL Database Tables Explorer
                </h1>
                <span className="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 text-[10px] font-mono border border-emerald-800/60 font-semibold">
                  LIVE CONNECTION
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect, filter, search, and paginate through all 5 relational tables in MySQL (fraud_detection)
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Pill */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded bg-[#0F172A] border border-[#1E293B] text-slate-300 flex items-center gap-2">
            <span className="text-slate-500">Database:</span>
            <span className="text-cyan-400 font-semibold">fraud_detection</span>
          </div>
          <div className="px-3 py-1.5 rounded bg-[#0F172A] border border-[#1E293B] text-slate-300 flex items-center gap-2">
            <span className="text-slate-500">Tables:</span>
            <span className="text-white font-bold">{tablesList.length || 5}</span>
          </div>
        </div>
      </section>

      {/* 5 TABLE SELECTOR CARDS / TABS */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tablesList.map((t) => {
          const isSelected = selectedTable === t.table_name;
          const iconMap = {
            frauds: 'gavel',
            drift_reports: 'ssid_chart',
            models: 'psychology',
            transactions: 'receipt_long',
            users: 'group',
          };
          const icon = iconMap[t.table_name] || 'table_chart';

          return (
            <button
              key={t.table_name}
              onClick={() => handleTableSwitch(t.table_name)}
              type="button"
              className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between relative overflow-hidden group ${
                isSelected
                  ? 'bg-[#152238] border-cyan-500/80 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                  : 'bg-[#131D31] border-[#1E293B] hover:border-slate-600 hover:bg-[#18243b]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
              )}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`material-symbols-outlined text-lg ${
                    isSelected ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {icon}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                    isSelected
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80'
                      : 'bg-[#0F172A] text-slate-400 border border-[#1E293B]'
                  }`}
                >
                  {t.columns?.length || 0} cols
                </span>
              </div>

              <div>
                <div
                  className={`text-sm font-bold font-mono truncate ${
                    isSelected ? 'text-white' : 'text-slate-200'
                  }`}
                >
                  {t.table_name}
                </div>
                <div className="flex items-baseline justify-between mt-1 pt-1.5 border-t border-[#1E293B]/70">
                  <span className="text-[10px] text-slate-400 uppercase font-sans">Rows:</span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      isSelected ? 'text-cyan-300' : 'text-slate-300'
                    }`}
                  >
                    {t.total_rows != null ? t.total_rows.toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* FILTER CONTROLS & QUERY BUILDER */}
      <section className="bg-[#131D31] border border-[#1E293B] rounded-lg p-4 space-y-3.5 shadow-sm">
        {/* Row 1: Search, Preset Pills, Column Filter */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Global Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder={`Search ${selectedTable} text or numbers...`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-8 pl-8 pr-7 bg-[#0F172A] border border-[#1E293B] rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="h-8 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </form>

          {/* Quick Presets for current table */}
          {tablePresets[selectedTable] && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 whitespace-nowrap mr-1">
                Presets:
              </span>
              {tablePresets[selectedTable].map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(preset)}
                  type="button"
                  className="px-2.5 py-1 rounded bg-[#0F172A] hover:bg-[#1E293B] text-slate-300 hover:text-cyan-300 text-[11px] font-sans border border-[#1E293B] transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Table Actions (Export, Column Toggle, Refresh) */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              type="button"
              className={`h-8 px-2.5 rounded text-xs border flex items-center gap-1.5 transition-colors ${
                showColumnToggle
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-[#0F172A] border-[#1E293B] text-slate-300 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_column</span>
              <span>Columns</span>
            </button>

            <button
              onClick={exportToCSV}
              type="button"
              className="h-8 px-2.5 bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 hover:text-white rounded text-xs flex items-center gap-1.5 transition-colors"
              title="Export current page to CSV"
            >
              <span className="material-symbols-outlined text-sm">csv</span>
              <span>CSV</span>
            </button>

            <button
              onClick={exportToJSON}
              type="button"
              className="h-8 px-2.5 bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 hover:text-white rounded text-xs flex items-center gap-1.5 transition-colors"
              title="Export current page to JSON"
            >
              <span className="material-symbols-outlined text-sm">code</span>
              <span>JSON</span>
            </button>

            <button
              onClick={loadTableData}
              type="button"
              className="h-8 w-8 bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 hover:text-cyan-400 rounded flex items-center justify-center transition-colors"
              title="Refresh table data"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Advanced Column Filter Form */}
        <div className="pt-2 border-t border-[#1E293B] flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-400 font-semibold uppercase flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-cyan-400">filter_alt</span>
            Filter by:
          </span>

          {/* Select Column */}
          <select
            value={filterColumn}
            onChange={(e) => setFilterColumn(e.target.value)}
            className="h-8 px-2 bg-[#0F172A] border border-[#1E293B] rounded text-xs text-white focus:border-cyan-400 font-mono"
          >
            <option value="">Select column...</option>
            {tableData?.columns?.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>

          {/* Select Operator */}
          {filterColumn && (
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="h-8 px-2 bg-[#0F172A] border border-[#1E293B] rounded text-xs text-white focus:border-cyan-400 font-mono"
            >
              <option value="contains">contains (ilike)</option>
              <option value="eq">equals (=)</option>
              <option value="neq">not equals (!=)</option>
              <option value="gt">greater than (&gt;)</option>
              <option value="gte">greater than or equal (&gt;=)</option>
              <option value="lt">less than (&lt;)</option>
              <option value="lte">less than or equal (&lt;=)</option>
              <option value="is_true">is true (1)</option>
              <option value="is_false">is false (0)</option>
              <option value="is_null">is null</option>
              <option value="not_null">is not null</option>
            </select>
          )}

          {/* Filter Value Input */}
          {filterColumn && !['is_null', 'not_null', 'is_true', 'is_false'].includes(filterOperator) && (
            <input
              type="text"
              placeholder="Value to match..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="h-8 px-2.5 bg-[#0F172A] border border-[#1E293B] rounded text-xs text-white placeholder-slate-500 focus:border-cyan-400 font-mono"
            />
          )}

          {(filterColumn || searchTerm) && (
            <button
              onClick={handleClearFilters}
              type="button"
              className="h-8 px-2.5 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs border border-red-800/60 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">filter_alt_off</span>
              <span>Clear Filters</span>
            </button>
          )}

          {/* Active Filter Pill */}
          {filterColumn && (
            <div className="ml-auto text-[11px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
              WHERE `{filterColumn}` {filterOperator} '{filterValue}'
            </div>
          )}
        </div>

        {/* Column Visibility Selector Drawer */}
        {showColumnToggle && tableData?.columns && (
          <div className="p-3 bg-[#0F172A] border border-[#1E293B] rounded-lg mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Toggle Visible Columns ({activeCols.length} of {tableData.columns.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setVisibleColumns({
                    ...visibleColumns,
                    [selectedTable]: tableData.columns.map((c) => c.name),
                  })
                }
                className="text-[10px] text-cyan-400 hover:underline"
              >
                Select All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tableData.columns.map((c) => {
                const isVis = activeCols.includes(c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggleColumn(c.name)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      isVis
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/80'
                        : 'bg-[#131D31] text-slate-500 border border-[#1E293B] line-through'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {isVis ? 'check' : 'close'}
                    </span>
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-red-400">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* DATA GRID TABLE */}
      <section className="bg-[#131D31] border border-[#1E293B] rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* Table Sub-Header Stats */}
        <div className="px-4 py-2.5 bg-[#0F172A] border-b border-[#1E293B] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-white font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              table: <strong className="text-cyan-300">{selectedTable}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Showing {tableData?.rows?.length || 0} rows of{' '}
              <strong className="text-white font-mono">
                {tableData?.filtered_rows != null ? tableData.filtered_rows.toLocaleString() : '—'}
              </strong>{' '}
              filtered (Total in DB:{' '}
              <strong className="text-slate-300 font-mono">
                {tableData?.total_rows != null ? tableData.total_rows.toLocaleString() : '—'}
              </strong>
              )
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px]">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-6 px-1.5 bg-[#131D31] border border-[#1E293B] rounded text-xs text-white font-mono"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table Viewport */}
        <div className="overflow-x-auto min-h-[300px] relative">
          {loading && (
            <div className="absolute inset-0 bg-[#0B111E]/70 backdrop-blur-xs flex items-center justify-center z-10">
              <div className="flex items-center gap-2 bg-[#131D31] px-4 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 text-xs font-mono shadow-xl">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                <span>Querying MySQL table `{selectedTable}`...</span>
              </div>
            </div>
          )}

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B111E] text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#1E293B] select-none sticky top-0 z-5">
                <th className="px-3 py-2.5 w-10 text-center text-slate-500">#</th>
                {activeCols.map((colName) => {
                  const isSorted = sortBy === colName;
                  const colMeta = tableData?.columns?.find((c) => c.name === colName);
                  const isPK = colMeta?.primary_key;

                  return (
                    <th
                      key={colName}
                      onClick={() => handleSort(colName)}
                      className="px-3 py-2.5 cursor-pointer hover:bg-[#152238] transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        {isPK && (
                          <span
                            className="material-symbols-outlined text-amber-400 text-xs"
                            title="Primary Key"
                          >
                            key
                          </span>
                        )}
                        <span className={isSorted ? 'text-cyan-300 font-bold' : ''}>{colName}</span>
                        {isSorted ? (
                          <span className="material-symbols-outlined text-cyan-400 text-xs">
                            {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-slate-600 text-xs opacity-0 hover:opacity-100">
                            unfold_more
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-2.5 text-right w-16">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1E293B] font-mono text-slate-300">
              {tableData?.rows?.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeCols.length + 2}
                    className="px-4 py-12 text-center text-slate-500 font-sans"
                  >
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-600 block">
                      inbox
                    </span>
                    <span className="text-sm font-medium">No records found matching current query</span>
                    <p className="text-xs text-slate-600 mt-1">
                      Try clearing filters or search term
                    </p>
                  </td>
                </tr>
              ) : (
                tableData?.rows?.map((row, rowIdx) => {
                  const rowNum = (page - 1) * pageSize + rowIdx + 1;
                  return (
                    <tr
                      key={rowIdx}
                      className="hover:bg-[#152238]/60 transition-colors group cursor-pointer"
                      onClick={() => setInspectRow(row)}
                    >
                      <td className="px-3 py-2 text-center text-[10px] text-slate-500 font-sans">
                        {rowNum}
                      </td>

                      {activeCols.map((colName) => {
                        const val = row[colName];
                        let renderedVal = null;

                        if (val === null || val === undefined) {
                          renderedVal = (
                            <span className="text-slate-600 italic font-sans text-[11px]">NULL</span>
                          );
                        } else if (typeof val === 'boolean' || colName === 'is_fraud' || colName === 'prediction') {
                          const isTrue = Boolean(val);
                          renderedVal = (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                isTrue
                                  ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                              }`}
                            >
                              {isTrue ? 'TRUE' : 'FALSE'}
                            </span>
                          );
                        } else if (colName === 'drift_status') {
                          const status = String(val).toLowerCase();
                          const color =
                            status === 'drift_detected'
                              ? 'bg-red-950/80 text-red-300 border-red-800/60'
                              : status === 'warning'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
                          renderedVal = (
                            <span className={`px-2 py-0.5 rounded text-[10px] border font-sans font-semibold ${color}`}>
                              {val}
                            </span>
                          );
                        } else if (colName === 'model_status') {
                          renderedVal = (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-sans font-semibold">
                              {val}
                            </span>
                          );
                        } else if (typeof val === 'number') {
                          renderedVal = (
                            <span className="text-cyan-300">
                              {val.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                          );
                        } else if (typeof val === 'string' && val.length > 35) {
                          renderedVal = (
                            <span className="truncate block max-w-[220px]" title={val}>
                              {val}
                            </span>
                          );
                        } else {
                          renderedVal = <span>{String(val)}</span>;
                        }

                        return (
                          <td key={colName} className="px-3 py-2 text-xs truncate max-w-xs">
                            {renderedVal}
                          </td>
                        );
                      })}

                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectRow(row);
                          }}
                          className="px-2 py-0.5 rounded bg-[#0F172A] hover:bg-cyan-950 hover:text-cyan-300 text-slate-400 text-[10px] border border-[#1E293B] transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div className="px-4 py-3 bg-[#0F172A] border-t border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 font-sans">
            Page <strong className="text-white">{page}</strong> of{' '}
            <strong className="text-white">{tableData?.total_pages || 1}</strong>
            <span className="ml-2 text-slate-500 font-mono">
              ({tableData?.filtered_rows?.toLocaleString() || 0} total records)
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1 rounded bg-[#131D31] border border-[#1E293B] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              « First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1 rounded bg-[#131D31] border border-[#1E293B] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ‹ Prev
            </button>

            <span className="px-3 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold">
              {page}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(tableData?.total_pages || 1, p + 1))}
              disabled={page >= (tableData?.total_pages || 1) || loading}
              className="px-3 py-1 rounded bg-[#131D31] border border-[#1E293B] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next ›
            </button>
            <button
              onClick={() => setPage(tableData?.total_pages || 1)}
              disabled={page >= (tableData?.total_pages || 1) || loading}
              className="px-2.5 py-1 rounded bg-[#131D31] border border-[#1E293B] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Last Page"
            >
              Last »
            </button>
          </div>
        </div>
      </section>

      {/* ROW INSPECTION MODAL */}
      <Modal
        isOpen={Boolean(inspectRow)}
        onClose={() => setInspectRow(null)}
        title={`Record Details: ${selectedTable}`}
        icon="data_object"
        maxWidth="max-w-2xl"
      >
        {inspectRow && (
          <div className="space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">
                table: <strong className="text-cyan-400">{selectedTable}</strong>
              </span>
              <button
                type="button"
                onClick={() => copyRowJSON(inspectRow)}
                className="px-2.5 py-1 rounded bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-xs">
                  {copiedNotification ? 'check' : 'content_copy'}
                </span>
                <span>{copiedNotification ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>

            {/* Field Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto p-1">
              {Object.entries(inspectRow).map(([key, val]) => (
                <div
                  key={key}
                  className="p-2.5 rounded bg-[#0F172A] border border-[#1E293B] flex flex-col justify-between"
                >
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
                    {key}
                  </span>
                  <div className="mt-1 font-mono text-white text-xs break-all">
                    {val === null || val === undefined ? (
                      <span className="text-slate-600 italic">NULL</span>
                    ) : typeof val === 'boolean' ? (
                      <span className={val ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {val ? 'TRUE (1)' : 'FALSE (0)'}
                      </span>
                    ) : (
                      String(val)
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* SQL Query simulation */}
            <div className="p-3 bg-[#080E1B] border border-[#1E293B] rounded text-[11px] font-mono text-slate-400">
              <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">
                SQL Inspection Statement
              </div>
              <code className="text-cyan-300">
                SELECT * FROM {selectedTable} WHERE{' '}
                {currentTableMeta.primary_key && currentTableMeta.primary_key[0]
                  ? `${currentTableMeta.primary_key[0]} = ${JSON.stringify(
                      inspectRow[currentTableMeta.primary_key[0]]
                    )}`
                  : '1=1'}{' '}
                LIMIT 1;
              </code>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DatabaseTablesPage;
