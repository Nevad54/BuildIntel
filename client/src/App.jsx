import { Navigate, Route, Routes } from "react-router-dom";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { WorkspaceShell } from "./components/WorkspaceShell.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ProjectsPage } from "./pages/ProjectsPage.jsx";
import { EstimatesPage } from "./pages/EstimatesPage.jsx";
import { DocumentsPage } from "./pages/DocumentsPage.jsx";
import { PricingPage } from "./pages/PricingPage.jsx";
import { BillingPage } from "./pages/BillingPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { useWorkspaceApp } from "./hooks/useWorkspaceApp.js";

export default function App() {
  const { auth, app, data, forms, results, busy, actions, preferences } = useWorkspaceApp();
  const isAdmin = data?.user?.role === "Admin";

  if (!auth.token) {
    return (
      <AuthScreen
        mode={auth.authMode}
        setMode={auth.setAuthMode}
        loginForm={auth.loginForm}
        setLoginForm={auth.setLoginForm}
        registerForm={auth.registerForm}
        setRegisterForm={auth.setRegisterForm}
        resetEmail={auth.resetEmail}
        setResetEmail={auth.setResetEmail}
        onLogin={auth.onLogin}
        onRegister={auth.onRegister}
        onForgot={auth.onForgot}
        busy={auth.authBusy}
        error={app.error || app.notice}
      />
    );
  }

  if (app.loadingWorkspace || !data) {
    return (
      <main className="workspace-root flex min-h-screen items-center justify-center">
        <div className="dashboard-shell rounded-[28px] px-8 py-6 text-lg">Loading workspace...</div>
      </main>
    );
  }

  return (
    <WorkspaceShell
      user={data.user}
      company={data.company}
      onLogout={auth.onLogout}
      projects={data.projects}
      currentProject={data.currentProject}
      currentProjectId={forms.currentProjectId}
      setCurrentProjectId={forms.setCurrentProjectId}
    >
      <Routes>
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                data={data}
                projectForm={forms.projectForm}
                setProjectForm={forms.setProjectForm}
                onCreateProject={actions.onCreateProject}
                createBusy={busy.createBusy}
                notice={app.notice}
                error={app.error}
                currencyCode={app.settings.currencyCode}
              />
            }
          />
          <Route
            path="/projects"
            element={
              <ProjectsPage
                data={data}
                projectForm={forms.projectForm}
                setProjectForm={forms.setProjectForm}
                onCreateProject={actions.onCreateProject}
                createBusy={busy.createBusy}
                onUpdateProject={actions.onUpdateProject}
                updateBusy={busy.updateBusy}
                notice={app.notice}
                error={app.error}
              />
            }
          />
          <Route
            path="/estimates"
            element={
              <EstimatesPage
                data={data}
                estimateForm={forms.estimateForm}
                setEstimateForm={forms.setEstimateForm}
                simulationForm={forms.simulationForm}
                setSimulationForm={forms.setSimulationForm}
                simulation={results.simulation}
                lastGeneratedEstimateId={results.lastGeneratedEstimateId}
                marketRefreshResult={results.marketRefreshResult}
                onSimulate={actions.onSimulate}
                onGenerateEstimate={actions.onGenerateEstimate}
                onRefreshEstimateMarketPrices={actions.onRefreshEstimateMarketPrices}
                onUpdateEstimateStatus={actions.onUpdateEstimateStatus}
                onCreatePromptTemplate={actions.onCreatePromptTemplate}
                onUpdatePromptTemplate={actions.onUpdatePromptTemplate}
                onDeletePromptTemplate={actions.onDeletePromptTemplate}
                generateBusy={busy.generateBusy}
                promptTemplateBusy={busy.promptTemplateBusy}
                marketRefreshBusy={busy.marketRefreshBusy}
                statusBusy={busy.statusBusy}
                selectedEstimateId={forms.selectedEstimateId}
                setSelectedEstimateId={forms.setSelectedEstimateId}
                editEstimate={forms.editEstimate}
                setEditEstimate={forms.setEditEstimate}
                onPatchEstimate={actions.onPatchEstimate}
                onCreateMaterialInline={actions.onCreateMaterialInline}
                materialBusy={busy.materialBusy}
                patchBusy={busy.patchBusy}
                exportBusy={busy.exportBusy}
                notice={app.notice}
                error={app.error}
                currencyCode={app.settings.currencyCode}
              />
            }
          />
          <Route
            path="/documents"
            element={
              <DocumentsPage
                data={data}
                documentForm={forms.documentForm}
                setDocumentForm={forms.setDocumentForm}
                onUploadDocument={actions.onUploadDocument}
                uploadBusy={busy.uploadBusy}
                onReviewDocument={actions.onReviewDocument}
                reviewBusy={busy.reviewBusy}
                notice={app.notice}
                error={app.error}
              />
            }
          />
          <Route
            path="/pricing"
            element={
              <PricingPage
                data={data}
                materialForm={forms.materialForm}
                setMaterialForm={forms.setMaterialForm}
                onCreateMaterial={actions.onCreateMaterial}
                materialBusy={busy.materialBusy}
                researchForm={forms.researchForm}
                setResearchForm={forms.setResearchForm}
                pricingResult={results.pricingResult}
                onResearchPricing={actions.onResearchPricing}
                supplierForm={forms.supplierForm}
                setSupplierForm={forms.setSupplierForm}
                supplierResults={results.supplierResults}
                onFindSuppliers={actions.onFindSuppliers}
                pricingImportForm={forms.pricingImportForm}
                setPricingImportForm={forms.setPricingImportForm}
                remoteImportForm={forms.remoteImportForm}
                setRemoteImportForm={forms.setRemoteImportForm}
                onImportPricing={actions.onImportPricing}
                onImportRemotePricing={actions.onImportRemotePricing}
                importBusy={busy.importBusy}
                notice={app.notice}
                error={app.error}
                currencyCode={app.settings.currencyCode}
              />
            }
          />
          <Route
            path="/billing"
            element={isAdmin ? (
              <BillingPage
                data={data}
                templateForm={forms.templateForm}
                setTemplateForm={forms.setTemplateForm}
                onCreateTemplate={actions.onCreateTemplate}
                templateBusy={busy.templateBusy}
                onChangePlan={actions.onChangePlan}
                planBusy={busy.planBusy}
                auditLogs={app.auditLogs}
                notice={app.notice}
                error={app.error}
                currencyCode={app.settings.currencyCode}
              />
            ) : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                data={data}
                settings={preferences.settings}
                onSaveSettings={preferences.onSaveSettings}
                onLogout={auth.onLogout}
                accountForm={forms.accountForm}
                setAccountForm={forms.setAccountForm}
                onUpdateAccount={actions.onUpdateAccount}
                accountBusy={busy.accountBusy}
                notice={app.notice}
                error={app.error}
              />
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </WorkspaceShell>
  );
}
