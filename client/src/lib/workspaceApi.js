import { API_ROOT, api } from "./app.js";

export const workspaceApi = {
  getExchangeRates: () => api("/api/reference-data/exchange-rates"),
  bootstrap: (token) => api("/api/bootstrap", { token }),
  createProject: (token, payload) => api("/api/projects", { token, method: "POST", body: payload }),
  updateProject: (token, projectId, payload) => api(`/api/projects/${projectId}`, { token, method: "PATCH", body: payload }),
  createTemplate: (token, payload) => api("/api/templates", { token, method: "POST", body: payload }),
  createPromptTemplate: (token, payload) => api("/api/prompt-templates", { token, method: "POST", body: payload }),
  updatePromptTemplate: (token, promptTemplateId, payload) =>
    api(`/api/prompt-templates/${promptTemplateId}`, { token, method: "PATCH", body: payload }),
  deletePromptTemplate: (token, promptTemplateId) => api(`/api/prompt-templates/${promptTemplateId}`, { token, method: "DELETE" }),
  createMaterial: (token, payload) => api("/api/materials", { token, method: "POST", body: payload }),
  generateEstimate: (token, payload) => api("/api/ai/estimate", { token, method: "POST", body: payload }),
  simulateEstimate: (token, payload) => api("/api/estimates/simulate", { token, method: "POST", body: payload }),
  refreshEstimateMarketPrices: (token, estimateId) =>
    api(`/api/estimates/${estimateId}/refresh-market-prices`, { token, method: "POST" }),
  updateEstimate: (token, estimateId, payload) => api(`/api/estimates/${estimateId}`, { token, method: "PATCH", body: payload }),
  updateEstimateStatus: (token, estimateId, status) =>
    api(`/api/estimates/${estimateId}/status`, { token, method: "PATCH", body: { status } }),
  exportEstimatePdf: async (token, estimateId) => {
    const response = await fetch(`${API_ROOT}/api/estimates/${estimateId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.message || "Export failed");
    }

    return response.blob();
  },
  uploadDocument: (token, projectId, payload) =>
    api(`/api/projects/${projectId}/documents`, { token, method: "POST", body: payload }),
  reviewDocument: (token, documentId, payload) =>
    api(`/api/documents/${documentId}/review`, { token, method: "PATCH", body: payload }),
  researchPricing: (token, payload) => api("/api/pricing/research", { token, method: "POST", body: payload }),
  findSuppliers: (token, payload) => api("/api/pricing/suppliers", { token, method: "POST", body: payload }),
  importPricingFeed: (token, payload) => api("/api/pricing/import", { token, method: "POST", body: payload }),
  importRemotePricingFeed: (token, payload) =>
    api("/api/pricing/import-remote", { token, method: "POST", body: payload }),
  updatePlan: (token, plan) => api("/api/company/plan", { token, method: "PATCH", body: { plan } }),
  listAuditLogs: (token) => api("/api/audit-logs", { token }),
  updateAccount: (token, payload) => api("/api/account", { token, method: "PATCH", body: payload })
};
