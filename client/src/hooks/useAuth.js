import { useState } from "react";
import { TOKEN_KEY, loginDefaults, registerDefaults } from "../lib/app.js";
import { authApi } from "../lib/authApi.js";

export function useAuth() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) || "");
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState(loginDefaults);
  const [registerForm, setRegisterForm] = useState(registerDefaults);
  const [resetEmail, setResetEmail] = useState(loginDefaults.email);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  const completeAuth = async (request) => {
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const response = await request();
      if (response.token) {
        window.localStorage.setItem(TOKEN_KEY, response.token);
        setToken(response.token);
      }
      if (response.message) {
        setAuthNotice(response.message + (response.resetToken ? ` Token: ${response.resetToken}` : ""));
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const onLogin = async (event, useDemo = false) => {
    if (event) {
      event.preventDefault();
    }
    const payload = useDemo ? loginDefaults : loginForm;
    await completeAuth(() => authApi.login(payload));
  };

  const onRegister = async (event) => {
    event.preventDefault();
    await completeAuth(() => authApi.register(registerForm));
  };

  const onForgot = async (event) => {
    event.preventDefault();
    await completeAuth(() => authApi.forgotPassword(resetEmail));
  };

  const onLogout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthNotice("");
  };

  return {
    token,
    setToken,
    authMode,
    setAuthMode,
    loginForm,
    setLoginForm,
    registerForm,
    setRegisterForm,
    resetEmail,
    setResetEmail,
    authBusy,
    authError,
    setAuthError,
    authNotice,
    setAuthNotice,
    onLogin,
    onRegister,
    onForgot,
    onLogout
  };
}
