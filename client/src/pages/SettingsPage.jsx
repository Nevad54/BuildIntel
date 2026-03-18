import { currencyChoices, formatCurrency, themeChoices } from "../lib/app.js";
import { Banner, Field, MetricCard, SectionCard } from "../components/ui.jsx";

function PreferencePreview({ data, settings }) {
  const currentTheme = settings.themeMode[0].toUpperCase() + settings.themeMode.slice(1);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Currency" value={settings.currencyCode} note="Used across pricing, estimates, and billing" />
      <MetricCard label="Theme" value={currentTheme} note="Applied to the full workspace shell" />
      <MetricCard label="Current Project" value={data.currentProject?.name || "None"} note={data.currentProject ? data.currentProject.location : "No active project context"} />
      <MetricCard
        label="Sample Estimate"
        value={formatCurrency(1246824, settings.currencyCode, data.currentProject?.location)}
        note={data.currentProject ? `Converted using ${data.currentProject.location}` : "Preview of how totals render with the selected currency"}
      />
    </div>
  );
}

function AccountSnapshot({ data, settings }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="surface-card rounded-[20px] p-5">
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Role</p>
        <p className="surface-title mt-3 text-xl font-semibold">{data.user?.role || "-"}</p>
        <p className="surface-copy mt-2 text-sm">Access level for billing, templates, and admin operations.</p>
      </div>
      <div className="surface-card rounded-[20px] p-5">
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Company</p>
        <p className="surface-title mt-3 text-xl font-semibold">{data.company?.name || "-"}</p>
        <p className="surface-copy mt-2 text-sm">Workspace owner and billing entity.</p>
      </div>
      <div className="surface-card rounded-[20px] p-5">
        <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Plan</p>
        <p className="surface-title mt-3 text-xl font-semibold">{data.company?.plan || "-"}</p>
        <p className="surface-copy mt-2 text-sm">
          Preferred currency: {settings.currencyCode} / Theme: {settings.themeMode}
        </p>
      </div>
    </div>
  );
}

export function SettingsPage({
  data,
  settings,
  onSaveSettings,
  onLogout,
  accountForm,
  setAccountForm,
  onUpdateAccount,
  accountBusy,
  notice,
  error
}) {
  return (
    <div className="space-y-6">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <SectionCard title="Workspace Preferences" eyebrow="Settings">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="surface-card rounded-[24px] p-5">
            <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Display</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="app-label block text-sm">
                <span>Currency</span>
                <select
                  className="app-input mt-2 w-full rounded-2xl px-4 py-3"
                  value={settings.currencyCode}
                  onChange={(event) => onSaveSettings({ currencyCode: event.target.value })}
                >
                  {currencyChoices.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="app-label block text-sm">
                <span>Appearance</span>
                <select
                  className="app-input mt-2 w-full rounded-2xl px-4 py-3"
                  value={settings.themeMode}
                  onChange={(event) => onSaveSettings({ themeMode: event.target.value })}
                >
                  {themeChoices.map((theme) => (
                    <option key={theme.value} value={theme.value}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="surface-copy mt-4 text-sm leading-6">
              Preference changes apply immediately so you can validate currency formatting and theme contrast in place.
            </p>
          </div>

          <div>
            <PreferencePreview data={data} settings={settings} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Account and Identity" eyebrow="Profile">
        <div className="space-y-6">
          <AccountSnapshot data={data} settings={settings} />

          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <div className="surface-card rounded-[24px] p-5">
              <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Profile Details</p>
              <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onUpdateAccount}>
                <Field
                  label="Name"
                  value={accountForm.name}
                  onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))}
                />
                <Field
                  label="Email"
                  type="email"
                  value={accountForm.email}
                  onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))}
                />
                <div className="app-label block text-sm">
                  <span>Role</span>
                  <div className="app-input mt-2 rounded-2xl px-4 py-3 text-sm">{data.user?.role || "-"}</div>
                </div>
                <Field
                  label="Company"
                  value={accountForm.companyName}
                  onChange={(event) => setAccountForm((current) => ({ ...current, companyName: event.target.value }))}
                />
                <div className="md:col-span-2">
                  <Field
                    label="New Password"
                    type="password"
                    value={accountForm.password}
                    placeholder="Leave blank to keep current password"
                    onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <button className="primary-btn" type="submit" disabled={accountBusy}>
                    {accountBusy ? "Saving..." : "Save Account Settings"}
                  </button>
                  <p className="surface-copy text-sm">Password changes are only applied when a new password is entered.</p>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <div className="surface-card rounded-[24px] p-5">
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Workspace Context</p>
                <h3 className="surface-title mt-3 text-xl font-semibold">{data.currentProject?.name || "No project selected"}</h3>
                <p className="surface-copy mt-2 text-sm leading-6">
                  {data.currentProject
                    ? `${data.currentProject.location} / ${data.currentProject.areaSqm} sqm / ${data.currentProject.status}`
                    : "Choose a current project from the sidebar to keep documents and estimates aligned."}
                </p>
              </div>

              <div className="surface-card rounded-[24px] p-5">
                <p className="section-eyebrow text-xs uppercase tracking-[0.24em]">Session</p>
                <p className="surface-copy mt-3 text-sm leading-6">
                  Log out from this device when you are done making pricing, billing, or account changes.
                </p>
                <button className="ghost-btn mt-5" type="button" onClick={onLogout}>
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
