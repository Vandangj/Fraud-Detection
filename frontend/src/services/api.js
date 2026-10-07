/**
 * Centralized API Service for Sentinel Fraud Detection & Drift Monitoring
 * Connects exclusively to endpoints existing in the FastAPI backend:
 *   - /users
 *   - /transactions
 *   - /models
 *   - /frauds
 *   - /drift-reports
 *
 * Configurable via VITE_API_BASE_URL (defaults to '/api' with Vite proxy,
 * or direct 'http://localhost:8000').
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData?.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail
              .map((d) => {
                const loc = Array.isArray(d.loc) ? d.loc.slice(1).join('.') : 'field';
                return `${loc ? `${loc}: ` : ''}${d.msg || JSON.stringify(d)}`;
              })
              .join('; ');
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        }
      } catch {
        // Response was not JSON
      }
      throw new Error(errorMessage);
    }

    // Return empty object for 204 No Content
    if (response.status === 204) return {};
    return await response.json();
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${url}:`, err.message);
    throw err;
  }
}

export const api = {
  // ==========================================
  // Health & Root
  // ==========================================
  checkRoot: () => apiRequest('/'),

  // ==========================================
  // Users API (/users)
  // ==========================================
  getUsers: (skip = 0, limit = 100) => 
    apiRequest(`/users/?skip=${skip}&limit=${limit}`),

  getUser: (userId) => 
    apiRequest(`/users/${userId}`),

  createUser: (userData) => 
    apiRequest('/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUser: (userId, userData) => 
    apiRequest(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  deleteUser: (userId) => 
    apiRequest(`/users/${userId}`, {
      method: 'DELETE',
    }),

  // ==========================================
  // Transactions API (/transactions)
  // ==========================================
  getTransactions: (skip = 0, limit = 100) => 
    apiRequest(`/transactions/?skip=${skip}&limit=${limit}`),

  getTransactionSummary: () =>
    apiRequest('/transactions/summary'),

  getTransaction: (txId) => 
    apiRequest(`/transactions/${txId}`),

  createTransaction: (txData) => 
    apiRequest('/transactions/', {
      method: 'POST',
      body: JSON.stringify(txData),
    }),

  updateTransaction: (txId, txData) => 
    apiRequest(`/transactions/${txId}`, {
      method: 'PUT',
      body: JSON.stringify(txData),
    }),

  deleteTransaction: (txId) => 
    apiRequest(`/transactions/${txId}`, {
      method: 'DELETE',
    }),

  // ==========================================
  // Models API (/models)
  // ==========================================
  getModels: () => 
    apiRequest('/models/'),

  getModel: (modelId) => 
    apiRequest(`/models/${modelId}`),

  createModel: (modelData) => 
    apiRequest('/models/', {
      method: 'POST',
      body: JSON.stringify(modelData),
    }),

  updateModel: (modelId, modelData) => 
    apiRequest(`/models/${modelId}`, {
      method: 'PUT',
      body: JSON.stringify(modelData),
    }),

  deleteModel: (modelId) => 
    apiRequest(`/models/${modelId}`, {
      method: 'DELETE',
    }),

  // ==========================================
  // Fraud Predictions API (/frauds)
  // ==========================================
  getFraudPredictions: () => 
    apiRequest('/frauds/'),

  getFraudPrediction: (predictionId) => 
    apiRequest(`/frauds/${predictionId}`),

  createFraudPrediction: (predData) => 
    apiRequest('/frauds/', {
      method: 'POST',
      body: JSON.stringify(predData),
    }),

  deleteFraudPrediction: (predictionId) => 
    apiRequest(`/frauds/${predictionId}`, {
      method: 'DELETE',
    }),

  // ==========================================
  // Drift Reports API (/drift-reports)
  // ==========================================
  getDriftReports: () => 
    apiRequest('/drift-reports/'),

  getDriftReport: (reportId) => 
    apiRequest(`/drift-reports/${reportId}`),

  createDriftReport: (reportData) => 
    apiRequest('/drift-reports/', {
      method: 'POST',
      body: JSON.stringify(reportData),
    }),

  deleteDriftReport: (reportId) => 
    apiRequest(`/drift-reports/${reportId}`, {
      method: 'DELETE',
    }),

  // =========================================================================
  // PENDING ML & BACKEND ENDPOINTS (Explicit TODO Markers)
  // These features do not yet exist in the FastAPI repo and will be hooked up
  // when ML / auth components are implemented.
  // =========================================================================

  // Authentication — matches a user by email from /users
  authLogin: async (credentials) => {
    const users = await apiRequest('/users/?skip=0&limit=1000');
    const match = users.find(
      (u) => u.email === credentials.email
    );
    if (!match) throw new Error('User not found');
    return match;
  },

  // Real-Time ML Inference — POST /predict
  predictTransaction: (transactionData) =>
    apiRequest('/predict/', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    }),

  // SHAP Explainability — GET fraud prediction by transaction ID
  getShapExplanation: (transactionId) =>
    apiRequest(`/frauds/${transactionId}`),

  // Trigger Model Retrain — POST /retrain
  triggerRetrainPipeline: () =>
    apiRequest('/retrain/', {
      method: 'POST',
    }),

  // Alerts derived from high fraud scores + drift reports
  getAlerts: () =>
    apiRequest('/alerts/'),

  // ==========================================
  // Multi-Model Comparative Benchmarking
  // ==========================================
  getModelsComparison: () =>
    apiRequest('/models/comparison'),

  // ==========================================
  // Database Tables Explorer API (/tables)
  // ==========================================
  getDatabaseTables: () =>
    apiRequest('/tables/'),

  getTableData: (tableName, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return apiRequest(`/tables/${tableName}${qs ? `?${qs}` : ''}`);
  },
};

export default api;

