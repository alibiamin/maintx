import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import LoginPage from './pages/LoginPage';
import Landing from './pages/Landing';
import DemandeInterventionForm from './pages/DemandeInterventionForm';
import Layout from './components/Layout';
import RequirePermission, { ForbiddenPage, RequireMaintxAdmin } from './components/RequirePermission';
import { ROUTE_PERMISSIONS, getModuleForPath } from './config/routePermissions';

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
const Chat = lazy(() => import('./pages/Chat'));
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
const PresencePage = lazy(() => import('./pages/effectif/PresencePage'));
const PointagePage = lazy(() => import('./pages/effectif/PointagePage'));
const ExploitationData = lazy(() => import('./pages/ExploitationData'));
const PartFamiliesList = lazy(() => import('./pages/catalogue/PartFamiliesList'));
const BrandsList = lazy(() => import('./pages/catalogue/BrandsList'));
const WOTemplatesList = lazy(() => import('./pages/catalogue/WOTemplatesList'));
const BudgetsList = lazy(() => import('./pages/BudgetsList'));
const ExternalContractorsList = lazy(() => import('./pages/subcontracting/ExternalContractorsList'));
const SubcontractOrdersList = lazy(() => import('./pages/subcontracting/SubcontractOrdersList'));
const TrainingCatalogList = lazy(() => import('./pages/training/TrainingCatalogList'));
const TrainingPlansList = lazy(() => import('./pages/training/TrainingPlansList'));
const StockLocationsList = lazy(() => import('./pages/stock/StockLocationsList'));
const StockReservationsList = lazy(() => import('./pages/stock/StockReservationsList'));
const RootCausesList = lazy(() => import('./pages/maintenance/RootCausesList'));
const SatisfactionList = lazy(() => import('./pages/maintenance/SatisfactionList'));
const PlannedShutdownsList = lazy(() => import('./pages/maintenance/PlannedShutdownsList'));
const RegulatoryChecksList = lazy(() => import('./pages/maintenance/RegulatoryChecksList'));
const PurchaseRequestsList = lazy(() => import('./pages/suppliers/PurchaseRequestsList'));
const PriceRequestsList = lazy(() => import('./pages/suppliers/PriceRequestsList'));
const SupplierInvoicesList = lazy(() => import('./pages/suppliers/SupplierInvoicesList'));
const WarehousesList = lazy(() => import('./pages/stock/WarehousesList'));
const ReorderRulesList = lazy(() => import('./pages/stock/ReorderRulesList'));
const ReportsMtbfMttr = lazy(() => import('./pages/ReportsMtbfMttr'));
const SettingsEmailTemplates = lazy(() => import('./pages/SettingsEmailTemplates'));
const DecisionSupport = lazy(() => import('./pages/DecisionSupport'));
const BibliothequeNormes = lazy(() => import('./pages/BibliothequeNormes'));

function LoadingFallback() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );
}

/** Affiche un message propre lorsque le tenant n’a pas accès au module (sans faire planter l’app). */
function ModuleDisabledFallback() {
  const navigate = useNavigate();
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="50vh" gap={2} p={3}>
      <Typography color="text.secondary">Ce module n’est pas activé pour votre client.</Typography>
      <Button variant="contained" onClick={() => navigate('/app')}>Retour au tableau de bord</Button>
    </Box>
  );
}

/** Enveloppe la route : vérification module activé (tenant), puis RequirePermission si défini. */
function RouteGuard({ path, children }) {
  const location = useLocation();
  const { isModuleEnabled } = useAuth();
  const moduleCode = getModuleForPath(location.pathname);
  if (moduleCode && !isModuleEnabled(moduleCode)) {
    return <ModuleDisabledFallback />;
  }
  const perm = ROUTE_PERMISSIONS[path];
  if (!perm) return children;
  return <RequirePermission resource={perm.resource} action={perm.action}>{children}</RequirePermission>;
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

/** Affiche l’écran de chargement au moins 3 s à l’ouverture du site (avant login ou dashboard). */
function AppInitialLoader({ children }) {
  const { loading: authLoading } = useAuth();
  if (authLoading) return <LoadingFallback />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/demande-intervention" element={<PrivateRoute><DemandeInterventionForm /></PrivateRoute>} />
      <Route path="/forbidden" element={<PrivateRoute><ForbiddenPage /></PrivateRoute>} />
      <Route path="/app" element={<AppInitialLoader><PrivateRoute><ChatProvider><Layout /></ChatProvider></PrivateRoute></AppInitialLoader>}>
        <Route index element={<RouteGuard path=""><Dashboard /></RouteGuard>} />
        <Route path="dashboard/kpis" element={<RouteGuard path="dashboard/kpis"><DashboardKPIs /></RouteGuard>} />
        <Route path="dashboard/activity" element={<RouteGuard path="dashboard/activity"><DashboardActivity /></RouteGuard>} />
        <Route path="equipment" element={<RouteGuard path="equipment"><EquipmentList /></RouteGuard>} />
        <Route path="equipment/creation/:type" element={<RouteGuard path="equipment/creation/:type"><Creation /></RouteGuard>} />
        <Route path="equipment/map" element={<RouteGuard path="equipment/map"><EquipmentMap /></RouteGuard>} />
        <Route path="equipment/categories" element={<RouteGuard path="equipment/categories"><EquipmentCategories /></RouteGuard>} />
        <Route path="equipment/models" element={<RouteGuard path="equipment/models"><EquipmentModelsList /></RouteGuard>} />
        <Route path="equipment/technical" element={<RouteGuard path="equipment/technical"><EquipmentTechnicalList /></RouteGuard>} />
        <Route path="equipment/:id" element={<RouteGuard path="equipment/:id"><EquipmentDetail /></RouteGuard>} />
        <Route path="equipment/:id/technical" element={<RouteGuard path="equipment/:id/technical"><EquipmentTechnical /></RouteGuard>} />
        <Route path="equipment/:id/history" element={<RouteGuard path="equipment/:id/history"><EquipmentHistory /></RouteGuard>} />
        <Route path="equipment/:id/documents" element={<RouteGuard path="equipment/:id/documents"><EquipmentDocuments /></RouteGuard>} />
        <Route path="equipment/:id/warranties" element={<RouteGuard path="equipment/:id/warranties"><EquipmentWarranties /></RouteGuard>} />
        <Route path="work-orders" element={<RouteGuard path="work-orders"><WorkOrderList /></RouteGuard>} />
        <Route path="maintenance/creation/:type" element={<RouteGuard path="maintenance/creation/:type"><Creation /></RouteGuard>} />
        <Route path="my-work-orders" element={<RouteGuard path="my-work-orders"><MyWorkOrdersToday /></RouteGuard>} />
        <Route path="work-orders/new" element={<RouteGuard path="work-orders/new"><WorkOrderForm /></RouteGuard>} />
        <Route path="work-orders/:id" element={<RouteGuard path="work-orders/:id"><WorkOrderDetail /></RouteGuard>} />
        <Route path="intervention-requests" element={<RouteGuard path="intervention-requests"><InterventionRequests /></RouteGuard>} />
        <Route path="planning" element={<RouteGuard path="planning"><Planning /></RouteGuard>} />
        <Route path="planning/assignments" element={<RouteGuard path="planning/assignments"><PlanningAssignments /></RouteGuard>} />
        <Route path="planning/resources" element={<RouteGuard path="planning/resources"><PlanningResources /></RouteGuard>} />
        <Route path="chat" element={<RouteGuard path="chat"><Chat /></RouteGuard>} />
        <Route path="maintenance-plans" element={<RouteGuard path="maintenance-plans"><MaintenancePlans /></RouteGuard>} />
        <Route path="maintenance-plans/due" element={<RouteGuard path="maintenance-plans/due"><MaintenancePlansDue /></RouteGuard>} />
        <Route path="maintenance-projects" element={<RouteGuard path="maintenance-projects"><MaintenanceProjectsList /></RouteGuard>} />
        <Route path="maintenance-projects/new" element={<RouteGuard path="maintenance-projects/new"><MaintenanceProjectForm /></RouteGuard>} />
        <Route path="maintenance-projects/:id/edit" element={<RouteGuard path="maintenance-projects/:id/edit"><MaintenanceProjectForm /></RouteGuard>} />
        <Route path="maintenance-projects/:id" element={<RouteGuard path="maintenance-projects/:id"><MaintenanceProjectDetail /></RouteGuard>} />
        <Route path="stock" element={<RouteGuard path="stock"><StockList /></RouteGuard>} />
        <Route path="stock/creation/:type" element={<RouteGuard path="stock/creation/:type"><Creation /></RouteGuard>} />
        <Route path="stock/parts/:id" element={<RouteGuard path="stock/parts/:id"><StockFiche /></RouteGuard>} />
        <Route path="stock/movements" element={<RouteGuard path="stock/movements"><StockMovements /></RouteGuard>} />
        <Route path="stock/inventories" element={<RouteGuard path="stock/inventories"><StockInventories /></RouteGuard>} />
        <Route path="stock/alerts" element={<RouteGuard path="stock/alerts"><StockAlerts /></RouteGuard>} />
        <Route path="stock/entries" element={<RouteGuard path="stock/entries"><StockEntries /></RouteGuard>} />
        <Route path="stock/exits" element={<RouteGuard path="stock/exits"><StockExits /></RouteGuard>} />
        <Route path="stock/transfers" element={<RouteGuard path="stock/transfers"><StockTransfers /></RouteGuard>} />
        <Route path="stock/reorders" element={<RouteGuard path="stock/reorders"><StockReorders /></RouteGuard>} />
        <Route path="stock/quality" element={<RouteGuard path="stock/quality"><StockQuality /></RouteGuard>} />
        <Route path="suppliers" element={<RouteGuard path="suppliers"><SuppliersList /></RouteGuard>} />
        <Route path="suppliers/creation/:type" element={<RouteGuard path="suppliers/creation/:type"><Creation /></RouteGuard>} />
        <Route path="suppliers/orders" element={<RouteGuard path="suppliers/orders"><SuppliersOrders /></RouteGuard>} />
        <Route path="sites" element={<RouteGuard path="sites"><Sites /></RouteGuard>} />
        <Route path="sites/lines" element={<RouteGuard path="sites/lines"><SitesLines /></RouteGuard>} />
        <Route path="sites/map" element={<RouteGuard path="sites/map"><SitesMap /></RouteGuard>} />
        <Route path="catalogue/part-families" element={<RouteGuard path="catalogue/part-families"><PartFamiliesList /></RouteGuard>} />
        <Route path="catalogue/brands" element={<RouteGuard path="catalogue/brands"><BrandsList /></RouteGuard>} />
        <Route path="catalogue/wo-templates" element={<RouteGuard path="catalogue/wo-templates"><WOTemplatesList /></RouteGuard>} />
        <Route path="budgets" element={<RouteGuard path="budgets"><BudgetsList /></RouteGuard>} />
        <Route path="subcontracting/contractors" element={<RouteGuard path="subcontracting/contractors"><ExternalContractorsList /></RouteGuard>} />
        <Route path="subcontracting/orders" element={<RouteGuard path="subcontracting/orders"><SubcontractOrdersList /></RouteGuard>} />
        <Route path="training/catalog" element={<RouteGuard path="training/catalog"><TrainingCatalogList /></RouteGuard>} />
        <Route path="training/plans" element={<RouteGuard path="training/plans"><TrainingPlansList /></RouteGuard>} />
        <Route path="stock/locations" element={<RouteGuard path="stock/locations"><StockLocationsList /></RouteGuard>} />
        <Route path="stock/reservations" element={<RouteGuard path="stock/reservations"><StockReservationsList /></RouteGuard>} />
        <Route path="maintenance/root-causes" element={<RouteGuard path="maintenance/root-causes"><RootCausesList /></RouteGuard>} />
        <Route path="maintenance/satisfaction" element={<RouteGuard path="maintenance/satisfaction"><SatisfactionList /></RouteGuard>} />
        <Route path="maintenance/shutdowns" element={<RouteGuard path="maintenance/shutdowns"><PlannedShutdownsList /></RouteGuard>} />
        <Route path="maintenance/regulatory-checks" element={<RouteGuard path="maintenance/regulatory-checks"><RegulatoryChecksList /></RouteGuard>} />
        <Route path="suppliers/purchase-requests" element={<RouteGuard path="suppliers/purchase-requests"><PurchaseRequestsList /></RouteGuard>} />
        <Route path="suppliers/price-requests" element={<RouteGuard path="suppliers/price-requests"><PriceRequestsList /></RouteGuard>} />
        <Route path="suppliers/invoices" element={<RouteGuard path="suppliers/invoices"><SupplierInvoicesList /></RouteGuard>} />
        <Route path="stock/warehouses" element={<RouteGuard path="stock/warehouses"><WarehousesList /></RouteGuard>} />
        <Route path="stock/reorder-rules" element={<RouteGuard path="stock/reorder-rules"><ReorderRulesList /></RouteGuard>} />
        <Route path="reports" element={<RouteGuard path="reports"><Reports /></RouteGuard>} />
        <Route path="reports/mtbf-mttr" element={<RouteGuard path="reports/mtbf-mttr"><ReportsMtbfMttr /></RouteGuard>} />
        <Route path="reports/exports" element={<RouteGuard path="reports/exports"><ReportsExports /></RouteGuard>} />
        <Route path="decision-support" element={<RouteGuard path="decision-support"><DecisionSupport /></RouteGuard>} />
        <Route path="standards" element={<RouteGuard path="standards"><BibliothequeNormes /></RouteGuard>} />
        <Route path="settings/email-templates" element={<RouteGuard path="settings/email-templates"><SettingsEmailTemplates /></RouteGuard>} />
        <Route path="contracts" element={<RouteGuard path="contracts"><Contracts /></RouteGuard>} />
        <Route path="tools" element={<RouteGuard path="tools"><Tools /></RouteGuard>} />
        <Route path="tools/creation/:type" element={<RouteGuard path="tools/creation/:type"><Creation /></RouteGuard>} />
        <Route path="tools/assignments" element={<RouteGuard path="tools/assignments"><ToolsAssignments /></RouteGuard>} />
        <Route path="tools/calibrations" element={<RouteGuard path="tools/calibrations"><ToolsCalibrations /></RouteGuard>} />
        <Route path="checklists" element={<RouteGuard path="checklists"><Checklists /></RouteGuard>} />
        <Route path="procedures" element={<RouteGuard path="procedures"><ProceduresList /></RouteGuard>} />
        <Route path="settings" element={<RouteGuard path="settings"><Settings /></RouteGuard>} />
        <Route path="settings/creation/:type" element={<RouteGuard path="settings/creation/:type"><Creation /></RouteGuard>} />
        <Route path="settings/roles" element={<RouteGuard path="settings/roles"><SettingsRoles /></RouteGuard>} />
        <Route path="settings/tenants" element={<RequireMaintxAdmin><SettingsTenants /></RequireMaintxAdmin>} />
        <Route path="failure-codes" element={<RouteGuard path="failure-codes"><FailureCodesList /></RouteGuard>} />
        <Route path="exploitation" element={<RouteGuard path="exploitation"><ExploitationData /></RouteGuard>} />
        <Route path="exploitation/export" element={<RouteGuard path="exploitation/export"><ExploitationData /></RouteGuard>} />
        <Route path="exploitation/import" element={<RouteGuard path="exploitation/import"><ExploitationData /></RouteGuard>} />
        <Route path="users" element={<RouteGuard path="users"><Users /></RouteGuard>} />
        <Route path="technicians" element={<RouteGuard path="technicians"><TechnicianList /></RouteGuard>} />
        <Route path="technicians/team" element={<RouteGuard path="technicians/team"><TeamPage /></RouteGuard>} />
        <Route path="technicians/competencies" element={<RouteGuard path="technicians/competencies"><CompetenciesPage /></RouteGuard>} />
        <Route path="technicians/type-competencies" element={<RouteGuard path="technicians/type-competencies"><TypeCompetenciesPage /></RouteGuard>} />
        <Route path="technicians/:id" element={<RouteGuard path="technicians/:id"><TechnicianDetail /></RouteGuard>} />
        <Route path="effectif/presence" element={<RouteGuard path="effectif/presence"><PresencePage /></RouteGuard>} />
        <Route path="effectif/pointage" element={<RouteGuard path="effectif/pointage"><PointagePage /></RouteGuard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
