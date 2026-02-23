import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Landing from './pages/Landing';
import Layout from './components/Layout';
import AppLoadingScreen from './components/AppLoadingScreen';
import AppLoadingScreenWithMinDelay from './components/AppLoadingScreenWithMinDelay';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardKPIs = lazy(() => import('./pages/DashboardKPIs'));
const DashboardActivity = lazy(() => import('./pages/DashboardActivity'));
const EquipmentList = lazy(() => import('./pages/equipment/EquipmentList'));
const EquipmentDetail = lazy(() => import('./pages/equipment/EquipmentDetail'));
const EquipmentMap = lazy(() => import('./pages/equipment/EquipmentMap'));
const EquipmentCategories = lazy(() => import('./pages/equipment/EquipmentCategories'));
const EquipmentModelsList = lazy(() => import('./pages/equipment/EquipmentModelsList'));
const EquipmentTechnical = lazy(() => import('./pages/equipment/EquipmentTechnical'));
const EquipmentTechnicalList = lazy(() => import('./pages/equipment/EquipmentTechnicalList'));
const EquipmentHistory = lazy(() => import('./pages/equipment/EquipmentHistory'));
const EquipmentDocuments = lazy(() => import('./pages/equipment/EquipmentDocuments'));
const EquipmentWarranties = lazy(() => import('./pages/equipment/EquipmentWarranties'));
const WorkOrderList = lazy(() => import('./pages/maintenance/WorkOrderList'));
const WorkOrderDetail = lazy(() => import('./pages/maintenance/WorkOrderDetail'));
const WorkOrderForm = lazy(() => import('./pages/maintenance/WorkOrderForm'));
const MyWorkOrdersToday = lazy(() => import('./pages/maintenance/MyWorkOrdersToday'));
const MaintenancePlans = lazy(() => import('./pages/maintenance/MaintenancePlans'));
const MaintenancePlansDue = lazy(() => import('./pages/maintenance/MaintenancePlansDue'));
const MaintenanceProjectsList = lazy(() => import('./pages/maintenance/MaintenanceProjectsList'));
const MaintenanceProjectDetail = lazy(() => import('./pages/maintenance/MaintenanceProjectDetail'));
const MaintenanceProjectForm = lazy(() => import('./pages/maintenance/MaintenanceProjectForm'));
const InterventionRequests = lazy(() => import('./pages/maintenance/InterventionRequests'));
const Planning = lazy(() => import('./pages/Planning'));
const PlanningAssignments = lazy(() => import('./pages/PlanningAssignments'));
const PlanningResources = lazy(() => import('./pages/PlanningResources'));
const StockList = lazy(() => import('./pages/stock/StockList'));
const StockMovements = lazy(() => import('./pages/stock/StockMovements'));
const StockInventories = lazy(() => import('./pages/stock/StockInventories'));
const StockAlerts = lazy(() => import('./pages/stock/StockAlerts'));
const StockEntries = lazy(() => import('./pages/stock/StockEntries'));
const StockExits = lazy(() => import('./pages/stock/StockExits'));
const StockTransfers = lazy(() => import('./pages/stock/StockTransfers'));
const StockReorders = lazy(() => import('./pages/stock/StockReorders'));
const StockFiche = lazy(() => import('./pages/stock/StockFiche'));
const StockQuality = lazy(() => import('./pages/stock/StockQuality'));
const SuppliersList = lazy(() => import('./pages/suppliers/SuppliersList'));
const SuppliersOrders = lazy(() => import('./pages/suppliers/SuppliersOrders'));
const Reports = lazy(() => import('./pages/Reports'));
const ReportsExports = lazy(() => import('./pages/ReportsExports'));
const Users = lazy(() => import('./pages/Users'));
const Sites = lazy(() => import('./pages/Sites'));
const SitesLines = lazy(() => import('./pages/SitesLines'));
const SitesMap = lazy(() => import('./pages/SitesMap'));
const Settings = lazy(() => import('./pages/Settings'));
const SettingsRoles = lazy(() => import('./pages/SettingsRoles'));
const SettingsTenants = lazy(() => import('./pages/SettingsTenants'));
const FailureCodesList = lazy(() => import('./pages/FailureCodesList'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Tools = lazy(() => import('./pages/Tools'));
const ToolsAssignments = lazy(() => import('./pages/tools/ToolsAssignments'));
const ToolsCalibrations = lazy(() => import('./pages/tools/ToolsCalibrations'));
const Checklists = lazy(() => import('./pages/Checklists'));
const ProceduresList = lazy(() => import('./pages/ProceduresList'));
const Creation = lazy(() => import('./pages/Creation'));
const TechnicianList = lazy(() => import('./pages/technicians/TechnicianList'));
const TechnicianDetail = lazy(() => import('./pages/technicians/TechnicianDetail'));
const TeamPage = lazy(() => import('./pages/technicians/TeamPage'));
const CompetenciesPage = lazy(() => import('./pages/technicians/CompetenciesPage'));
const TypeCompetenciesPage = lazy(() => import('./pages/technicians/TypeCompetenciesPage'));
const ExploitationExport = lazy(() => import('./pages/ExploitationExport'));
const ExploitationImport = lazy(() => import('./pages/ExploitationImport'));

const LOADING_MIN_MS = 3000;

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const content = !isAuthenticated ? <Navigate to="/login" replace /> : <Suspense fallback={<AppLoadingScreen />}>{children}</Suspense>;
  return (
    <AppLoadingScreenWithMinDelay loading={loading} minDisplayMs={LOADING_MIN_MS}>
      {content}
    </AppLoadingScreenWithMinDelay>
  );
}

/** Affiche l’écran de chargement au moins 3 s à l’ouverture du site (avant login ou dashboard). */
function AppInitialLoader({ children }) {
  const [initialDone, setInitialDone] = useState(false);
  const { loading: authLoading } = useAuth();
  useEffect(() => {
    const t = setTimeout(() => setInitialDone(true), LOADING_MIN_MS);
    return () => clearTimeout(t);
  }, []);
  if (!initialDone || authLoading) return <AppLoadingScreen />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<AppInitialLoader><PrivateRoute><Layout /></PrivateRoute></AppInitialLoader>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard/kpis" element={<DashboardKPIs />} />
        <Route path="dashboard/activity" element={<DashboardActivity />} />
        <Route path="equipment" element={<EquipmentList />} />
        <Route path="equipment/creation/:type" element={<Creation />} />
        <Route path="equipment/map" element={<EquipmentMap />} />
        <Route path="equipment/categories" element={<EquipmentCategories />} />
        <Route path="equipment/models" element={<EquipmentModelsList />} />
        <Route path="equipment/technical" element={<EquipmentTechnicalList />} />
        <Route path="equipment/:id" element={<EquipmentDetail />} />
        <Route path="equipment/:id/technical" element={<EquipmentTechnical />} />
        <Route path="equipment/:id/history" element={<EquipmentHistory />} />
        <Route path="equipment/:id/documents" element={<EquipmentDocuments />} />
        <Route path="equipment/:id/warranties" element={<EquipmentWarranties />} />
        <Route path="work-orders" element={<WorkOrderList />} />
        <Route path="maintenance/creation/:type" element={<Creation />} />
        <Route path="my-work-orders" element={<MyWorkOrdersToday />} />
        <Route path="work-orders/new" element={<WorkOrderForm />} />
        <Route path="work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="intervention-requests" element={<InterventionRequests />} />
        <Route path="planning" element={<Planning />} />
        <Route path="planning/assignments" element={<PlanningAssignments />} />
        <Route path="planning/resources" element={<PlanningResources />} />
        <Route path="maintenance-plans" element={<MaintenancePlans />} />
        <Route path="maintenance-plans/due" element={<MaintenancePlansDue />} />
        <Route path="maintenance-projects" element={<MaintenanceProjectsList />} />
        <Route path="maintenance-projects/new" element={<MaintenanceProjectForm />} />
        <Route path="maintenance-projects/:id/edit" element={<MaintenanceProjectForm />} />
        <Route path="maintenance-projects/:id" element={<MaintenanceProjectDetail />} />
        <Route path="stock" element={<StockList />} />
        <Route path="stock/creation/:type" element={<Creation />} />
        <Route path="stock/parts/:id" element={<StockFiche />} />
        <Route path="stock/movements" element={<StockMovements />} />
        <Route path="stock/inventories" element={<StockInventories />} />
        <Route path="stock/alerts" element={<StockAlerts />} />
        <Route path="stock/entries" element={<StockEntries />} />
        <Route path="stock/exits" element={<StockExits />} />
        <Route path="stock/transfers" element={<StockTransfers />} />
        <Route path="stock/reorders" element={<StockReorders />} />
        <Route path="stock/quality" element={<StockQuality />} />
        <Route path="suppliers" element={<SuppliersList />} />
        <Route path="suppliers/creation/:type" element={<Creation />} />
        <Route path="suppliers/orders" element={<SuppliersOrders />} />
        <Route path="sites" element={<Sites />} />
        <Route path="sites/lines" element={<SitesLines />} />
        <Route path="sites/map" element={<SitesMap />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/exports" element={<ReportsExports />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="tools" element={<Tools />} />
        <Route path="tools/creation/:type" element={<Creation />} />
        <Route path="tools/assignments" element={<ToolsAssignments />} />
        <Route path="tools/calibrations" element={<ToolsCalibrations />} />
        <Route path="checklists" element={<Checklists />} />
        <Route path="procedures" element={<ProceduresList />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/creation/:type" element={<Creation />} />
        <Route path="settings/roles" element={<SettingsRoles />} />
        <Route path="settings/tenants" element={<SettingsTenants />} />
        <Route path="failure-codes" element={<FailureCodesList />} />
        <Route path="exploitation/export" element={<ExploitationExport />} />
        <Route path="exploitation/import" element={<ExploitationImport />} />
        <Route path="users" element={<Users />} />
        <Route path="technicians" element={<TechnicianList />} />
        <Route path="technicians/team" element={<TeamPage />} />
        <Route path="technicians/competencies" element={<CompetenciesPage />} />
        <Route path="technicians/type-competencies" element={<TypeCompetenciesPage />} />
        <Route path="technicians/:id" element={<TechnicianDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
