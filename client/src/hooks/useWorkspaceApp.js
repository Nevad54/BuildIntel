import { useEffect, useState } from "react";
import { defaultSettings, SETTINGS_KEY } from "../lib/app.js";
import { workspaceApi } from "../lib/workspaceApi.js";
import { useAuth } from "./useAuth.js";
import { useWorkspaceData } from "./useWorkspaceData.js";

export function useWorkspaceApp() {
  const auth = useAuth();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exchangeRates, setExchangeRates] = useState(null);
  const [settings, setSettings] = useState(() => {
    try {
      return {
        ...defaultSettings,
        ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}")
      };
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    setError(auth.authError);
  }, [auth.authError]);

  useEffect(() => {
    if (auth.authNotice) {
      setNotice(auth.authNotice);
    }
  }, [auth.authNotice]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice("");
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    const root = document.documentElement;
    const resolvedTheme =
      settings.themeMode === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : settings.themeMode;
    root.dataset.theme = resolvedTheme;
  }, [settings]);

  useEffect(() => {
    workspaceApi.getExchangeRates()
      .then((payload) => setExchangeRates(payload))
      .catch(() => setExchangeRates(null));
  }, []);

  useEffect(() => {
    window.__buildintelExchangeRates = exchangeRates;
  }, [exchangeRates]);

  const workspace = useWorkspaceData({
    token: auth.token,
    setGlobalError: setError,
    setGlobalNotice: setNotice,
    onUnauthorized: (loadError) => {
      auth.onLogout();
      setError(loadError.message);
    }
  });

  useEffect(() => {
    const serverSettings = workspace.data?.user?.profileSettings;

    if (!serverSettings) {
      return;
    }

    setSettings((current) => {
      const nextSettings = {
        ...defaultSettings,
        ...current,
        ...serverSettings
      };

      if (
        nextSettings.currencyCode === current.currencyCode &&
        nextSettings.themeMode === current.themeMode
      ) {
        return current;
      }

      return nextSettings;
    });
  }, [workspace.data?.user?.profileSettings]);

  const onSaveSettings = async (nextSettings) => {
    const previousSettings = settings;
    const mergedSettings = { ...settings, ...nextSettings };

    setSettings(mergedSettings);
    setError("");

    if (!auth.token) {
      setNotice("Settings updated.");
      return;
    }

    try {
      await workspaceApi.updateAccount(auth.token, {
        preferences: nextSettings
      });
      setNotice("Settings updated.");
    } catch (saveError) {
      setSettings(previousSettings);
      setError(saveError.message);
    }
  };

  return {
    auth: {
      token: auth.token,
      authMode: auth.authMode,
      setAuthMode: auth.setAuthMode,
      loginForm: auth.loginForm,
      setLoginForm: auth.setLoginForm,
      registerForm: auth.registerForm,
      setRegisterForm: auth.setRegisterForm,
      resetEmail: auth.resetEmail,
      setResetEmail: auth.setResetEmail,
      authBusy: auth.authBusy,
      onLogin: auth.onLogin,
      onRegister: auth.onRegister,
      onForgot: auth.onForgot,
      onLogout: auth.onLogout
    },
    app: {
      error,
      notice,
      loadingWorkspace: workspace.loadingWorkspace,
      user: workspace.data?.user,
      auditLogs: workspace.auditLogs,
      settings,
      exchangeRates
    },
    data: workspace.data,
    loadWorkspace: workspace.loadWorkspace,
    forms: workspace.forms,
    results: workspace.results,
    busy: workspace.busy,
    actions: workspace.actions,
    preferences: {
      settings,
      exchangeRates,
      onSaveSettings
    }
  };
}
