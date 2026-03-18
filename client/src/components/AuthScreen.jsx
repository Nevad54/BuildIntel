import { Banner, Field, MetricCard, cls } from "./ui.jsx";

export function AuthScreen({
  mode,
  setMode,
  loginForm,
  setLoginForm,
  registerForm,
  setRegisterForm,
  resetEmail,
  setResetEmail,
  onLogin,
  onRegister,
  onForgot,
  busy,
  error
}) {
  return (
    <main className="workspace-root min-h-screen px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hero-panel rounded-[36px] p-8 lg:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">Construction estimating workspace</p>
          <h1 className="hero-title mt-5 max-w-xl text-4xl font-semibold leading-tight lg:text-6xl">
            BuildIntel keeps the estimating flow clear from first document to final proposal.
          </h1>
          <p className="hero-copy mt-6 max-w-2xl text-base leading-7">
            The new navigation follows a simple pattern: a small set of destinations, one main task per page, and a
            sidebar that stays stable while the work changes.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Projects" value="5 active" note="Starter cap awareness is built in." />
            <MetricCard label="Documents" value="Review queue" note="Uploads and OCR edits stay together." />
            <MetricCard label="Estimates" value="AI to PDF" note="Generate, edit, simulate, export." />
          </div>
        </section>
        <section className="dashboard-shell rounded-[36px] p-6 lg:p-8">
          <div className="sidebar-panel flex gap-2 rounded-full border p-1">
            {["login", "register", "forgot"].map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setMode(entry)}
                className={cls(
                  "flex-1 rounded-full px-4 py-2 text-sm font-medium transition",
                  mode === entry ? "bg-amber-300 text-slate-950" : "surface-copy"
                )}
              >
                {entry === "login" ? "Sign In" : entry === "register" ? "Create Account" : "Reset Password"}
              </button>
            ))}
          </div>
          {error ? (
            <div className="mt-5">
              <Banner tone="danger">{error}</Banner>
            </div>
          ) : null}
          {mode === "login" ? (
            <form className="mt-6 space-y-4" onSubmit={onLogin}>
              <Field
                label="Email"
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
              />
              <Field
                label="Password"
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              />
              <button className="primary-btn w-full" type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </button>
              <button className="ghost-btn w-full" type="button" onClick={() => onLogin(null, true)} disabled={busy}>
                Sign in to demo workspace
              </button>
            </form>
          ) : null}
          {mode === "register" ? (
            <form className="mt-6 space-y-4" onSubmit={onRegister}>
              <Field
                label="Company Name"
                value={registerForm.companyName}
                onChange={(event) => setRegisterForm((current) => ({ ...current, companyName: event.target.value }))}
              />
              <Field
                label="Your Name"
                value={registerForm.name}
                onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
              />
              <Field
                label="Email"
                type="email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
              />
              <Field
                label="Password"
                type="password"
                value={registerForm.password}
                onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
              />
              <button className="primary-btn w-full" type="submit" disabled={busy}>
                {busy ? "Creating account..." : "Create workspace"}
              </button>
            </form>
          ) : null}
          {mode === "forgot" ? (
            <form className="mt-6 space-y-4" onSubmit={onForgot}>
              <Field
                label="Email"
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
              />
              <button className="primary-btn w-full" type="submit" disabled={busy}>
                {busy ? "Preparing reset..." : "Prepare reset token"}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
