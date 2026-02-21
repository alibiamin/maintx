import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DashboardKPIs from './pages/DashboardKPIs';
import DashboardActivity from './pages/DashboardActivity';
import EquipmentList from './pages/equipment/EquipmentList';
import EquipmentDetail from './pages/equipment/EquipmentDetail';
import EquipmentMap from './pages/equipment/EquipmentMap';
import EquipmentCategories from './pages/equipment/EquipmentCategories';
import EquipmentTechnical from './pages/equipment/EquipmentTechnical';
import EquipmentTechnicalList from './pages/equipment/EquipmentTechnicalList';
import EquipmentHistory from './pages/equipment/EquipmentHistory';
import EquipmentDocuments from './pages/equipment/EquipmentDocuments';
import EquipmentWarranties from './pages/equipment/EquipmentWarranties';
import WorkOrderList from './pages/maintenance/WorkOrderList';
import WorkOrderDetail from './pages/maintenance/WorkOrderDetail';
import WorkOrderForm from './pages/maintenance/WorkOrderForm';
import MaintenancePlans from './pages/maintenance/MaintenancePlans';
import MaintenancePlansDue from './pages/maintenance/MaintenancePlansDue';
import Planning from './pages/Planning';
import PlanningAssignments from './pages/PlanningAssignments';
import PlanningResources from './pages/PlanningResources';
import StockList from './pages/stock/StockList';
import StockMovements from './pages/stock/StockMovements';
import StockInventories from './pages/stock/StockInventories';
import StockAlerts from './pages/stock/StockAlerts';
import StockEntries from './pages/stock/StockEntries';
import StockExits from './pages/stock/StockExits';
import StockTransfers from './pages/stock/StockTransfers';
import StockReorders from './pages/stock/StockReorders';
import SuppliersList from './pages/suppliers/SuppliersList';
import SuppliersOrders from './pages/suppliers/SuppliersOrders';
import Reports from './pages/Reports';
import ReportsExports from './pages/ReportsExports';
import Users from './pages/Users';
import Sites from './pages/Sites';
import SitesLines from './pages/SitesLines';
import Settings from './pages/Settings';
import SettingsRoles from './pages/SettingsRoles';
import Contracts from './pages/Contracts';
import Tools from './pages/Tools';
import ToolsAssignments from './pages/tools/ToolsAssignments';
import ToolsCalibrations from './pages/tools/ToolsCalibrations';
import Checklists from './pages/Checklists';
import Creation from './pages/Creation';
import TechnicianList from './pages/technicians/TechnicianList';
import TechnicianDetail from './pages/technicians/TechnicianDetail';
import CompetenciesPage from './pages/technicians/CompetenciesPage';
import TypeCompetenciesPage from './pages/technicians/TypeCompetenciesPage';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard/kpis" element={<DashboardKPIs />} />
        <Route path="dashboard/activity" element={<DashboardActivity />} />
        <Route path="creation" element={<Creation />} />
        <Route path="equipment" element={<EquipmentList />} />
        <Route path="equipment/map" element={<EquipmentMap />} />
        <Route path="equipment/categories" element={<EquipmentCategories />} />
        <Route path="equipment/technical" element={<EquipmentTechnicalList />} />
        <Route path="equipment/:id" element={<EquipmentDetail />} />
        <Route path="equipment/:id/technical" element={<EquipmentTechnical />} />
        <Route path="equipment/:id/history" element={<EquipmentHistory />} />
        <Route path="equipment/:id/documents" element={<EquipmentDocuments />} />
        <Route path="equipment/:id/warranties" element={<EquipmentWarranties />} />
        <Route path="work-orders" element={<WorkOrderList />} />
        <Route path="work-orders/new" element={<WorkOrderForm />} />
        <Route path="work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="planning" element={<Planning />} />
        <Route path="planning/assignments" element={<PlanningAssignments />} />
        <Route path="planning/resources" element={<PlanningResources />} />
        <Route path="maintenance-plans" element={<MaintenancePlans />} />
        <Route path="maintenance-plans/due" element={<MaintenancePlansDue />} />
        <Route path="stock" element={<StockList />} />
        <Route path="stock/movements" element={<StockMovements />} />
        <Route path="stock/inventories" element={<StockInventories />} />
        <Route path="stock/alerts" element={<StockAlerts />} />
        <Route path="stock/entries" element={<StockEntries />} />
        <Route path="stock/exits" element={<StockExits />} />
        <Route path="stock/transfers" element={<StockTransfers />} />
        <Route path="stock/reorders" element={<StockReorders />} />
        <Route path="suppliers" element={<SuppliersList />} />
        <Route path="suppliers/orders" element={<SuppliersOrders />} />
        <Route path="sites" element={<Sites />} />
        <Route path="sites/lines" element={<SitesLines />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/exports" element={<ReportsExports />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="tools" element={<Tools />} />
        <Route path="tools/assignments" element={<ToolsAssignments />} />
        <Route path="tools/calibrations" element={<ToolsCalibrations />} />
        <Route path="checklists" element={<Checklists />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/roles" element={<SettingsRoles />} />
        <Route path="users" element={<Users />} />
        <Route path="technicians" element={<TechnicianList />} />
        <Route path="technicians/competencies" element={<CompetenciesPage />} />
        <Route path="technicians/type-competencies" element={<TypeCompetenciesPage />} />
        <Route path="technicians/:id" element={<TechnicianDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
