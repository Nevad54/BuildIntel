import { api } from "./app.js";

export const authApi = {
  login: (payload) => api("/api/auth/login", { method: "POST", body: payload }),
  register: (payload) => api("/api/auth/register", { method: "POST", body: payload }),
  forgotPassword: (email) => api("/api/auth/forgot-password", { method: "POST", body: { email } })
};
