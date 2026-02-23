import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import { Save, Image } from '@mui/icons-material';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

const CATEGORIES = [
  { id: 'hierarchie', label: 'Hiérarchie' },
  { id: 'stock', label: 'Stock' },
  { id: 'outils', label: 'Outils' },
  { id: 'fournisseurs', label: 'Fournisseurs' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'parametres', label: 'Paramètres' }
];

const TYPES_BY_CATEGORY = {
  hierarchie: [
    { value: 'site', label: 'Site' },
    { value: 'departement', label: 'Département' },
    { value: 'ligne', label: 'Ligne' },
    { value: 'machine', label: 'Machine' },
    { value: 'section', label: 'Section' },
    { value: 'composant', label: 'Composant' },
    { value: 'sous_composant', label: 'Sous-composant' }
  ],
  stock: [
    { value: 'piece', label: 'Pièce détachée' },
    { value: 'entree_stock', label: 'Entrée stock' },
    { value: 'sortie_stock', label: 'Sortie stock' },
    { value: 'transfert_stock', label: 'Transfert stock' }
  ],
  outils: [
    { value: 'outil', label: 'Outil' },
    { value: 'assignation_outil', label: 'Assignation d\'outil' }
  ],
  fournisseurs: [
    { value: 'fournisseur', label: 'Fournisseur' },
    { value: 'commande_fournisseur', label: 'Commande fournisseur' },
    { value: 'contrat', label: 'Contrat de maintenance' }
  ],
  maintenance: [
    { value: 'plan_maintenance', label: 'Plan de maintenance' },
    { value: 'checklist', label: 'Checklist' },
    { value: 'ordre_travail', label: 'Ordre de travail' }
  ],
  parametres: [
    { value: 'utilisateur', label: 'Utilisateur' },
    { value: 'code_defaut', label: 'Code défaut' }
  ]
};

const getDefaultForm = (type) => {
  const defaults = {
    site: { code: '', name: '', address: '' },
    departement: { siteId: '', code: '', name: '', description: '' },
    ligne: { siteId: '', code: '', name: '' },
    machine: { code: '', name: '', description: '', categoryId: '', ligneId: '', departmentId: '', serialNumber: '', criticite: 'B', status: 'operational' },
    section: { code: '', name: '', parentId: '', categoryId: '', criticite: 'B', status: 'operational' },
    composant: { code: '', name: '', parentId: '', categoryId: '', criticite: 'B', status: 'operational' },
    sous_composant: { code: '', name: '', parentId: '', categoryId: '', criticite: 'B', status: 'operational' },
    piece: { code: '', name: '', description: '', unitId: '', stockCategory: '', family: '', subFamily1: '', subFamily2: '', subFamily3: '', subFamily4: '', subFamily5: '', unitPrice: '0', minStock: '0', supplierId: '', location: '', manufacturerReference: '', imageData: null },
    entree_stock: { sparePartId: '', quantity: '', reference: '', notes: '' },
    sortie_stock: { sparePartId: '', quantity: '', workOrderId: '', notes: '' },
    transfert_stock: { sparePartId: '', quantity: '', reference: '', notes: '' },
    outil: { code: '', name: '', description: '', tool_type: 'hand_tool', calibration_due_date: '', location: '' },
    assignation_outil: { toolId: '', assignedTo: '', workOrderId: '', notes: '' },
    fournisseur: { code: '', name: '', contactPerson: '', email: '', phone: '', address: '' },
    commande_fournisseur: { supplierId: '' },
    contrat: { contract_number: '', name: '', supplier_id: '', equipment_id: '', contract_type: 'preventive', start_date: '', end_date: '', annual_cost: '' },
    plan_maintenance: { equipmentId: '', name: '', description: '', frequencyDays: '30', procedureId: '' },
    checklist: { name: '', description: '', maintenance_plan_id: '', is_template: false, items: [{ item_text: '', item_type: 'check' }] },
    ordre_travail: { title: '', description: '', equipmentId: '', typeId: '', priority: 'medium', maintenancePlanId: '', procedureIds: [], assignedUserIds: [], checklistIds: [], reservations: [{ sparePartId: '', quantity: 1, notes: '' }], toolIds: [] },
    utilisateur: { email: '', password: '', firstName: '', lastName: '', roleId: '', phone: '', address: '', city: '', postalCode: '', employeeNumber: '', jobTitle: '', department: '', hireDate: '', contractType: '' },
    code_defaut: { code: '', name: '', description: '', category: '' }
  };
  return { ...(defaults[type] || {}) };
};

export default function Creation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = useCurrency();
  const [categoryId, setCategoryId] = useState('hierarchie');
  const [creationType, setCreationType] = useState('site');
  const [form, setForm] = useState(getDefaultForm('site'));
  const [sites, setSites] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);
  const [parts, setParts] = useState([]);
  const [tools, setTools] = useState([]);
  const [users, setUsers] = useState([]);
  const [workOrderTypes, setWorkOrderTypes] = useState([]);
  const [maintenancePlans, setMaintenancePlans] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nextCode, setNextCode] = useState('');
  const [codificationConfig, setCodificationConfig] = useState({});

  const types = TYPES_BY_CATEGORY[categoryId] || TYPES_BY_CATEGORY.hierarchie;
  const firstTypeValue = types[0]?.value || 'site';
  const effectiveType = types.some(t => t.value === creationType) ? creationType : firstTypeValue;

  // Entité codification selon le type de création (machine/section/composant/sous_composant → machine)
  const codificationEntityMap = {
    site: 'site',
    departement: 'departement',
    ligne: 'ligne',
    machine: 'machine',
    section: 'machine',
    composant: 'machine',
    sous_composant: 'machine',
    piece: 'piece',
    outil: 'outil',
    fournisseur: 'fournisseur',
    code_defaut: 'code_defaut'
  };
  const codificationEntity = codificationEntityMap[creationType] || null;

  useEffect(() => {
    api.get('/settings/codification').then(r => setCodificationConfig(r.data || {})).catch(() => setCodificationConfig({}));
  }, []);

  // Prochain code auto pour tous les types avec codification
  useEffect(() => {
    if (!codificationEntity) { setNextCode(''); return; }
    if ((codificationEntity === 'departement' || codificationEntity === 'ligne') && !form.siteId) { setNextCode(''); return; }
    const siteId = (codificationEntity === 'departement' || codificationEntity === 'ligne') ? form.siteId : null;
    const url = siteId ? `/settings/codification/next/${codificationEntity}?siteId=${siteId}` : `/settings/codification/next/${codificationEntity}`;
    api.get(url).then(r => setNextCode(r.data?.nextCode || '')).catch(() => setNextCode(''));
  }, [codificationEntity, form.siteId]);

  useEffect(() => {
    Promise.all([
      api.get('/sites').catch(() => ({ data: [] })),
      api.get('/lignes').catch(() => ({ data: [] })),
      api.get('/equipment/categories').catch(() => ({ data: [] })),
      api.get('/equipment').catch(() => ({ data: [] })),
      api.get('/suppliers').catch(() => ({ data: [] })),
      api.get('/settings/units').catch(() => ({ data: [] })),
      api.get('/stock/parts').catch(() => ({ data: [] })),
      api.get('/tools').catch(() => ({ data: [] })),
      api.get('/users').catch(() => ({ data: [] })),
      api.get('/failure-codes').catch(() => ({ data: [] }))
    ]).then(([s, l, c, e, sup, unitsRes, p, t, u]) => {
      const dedupeById = (arr) => {
        if (!Array.isArray(arr)) return [];
        const seen = new Set();
        return arr.filter((x) => {
          if (!x || x.id == null) return true;
          if (seen.has(x.id)) return false;
          seen.add(x.id);
          return true;
        });
      };
      setSites(dedupeById(s.data || []));
      setLignes(dedupeById(l.data || []));
      setCategories(dedupeById(c.data || []));
      setEquipment(dedupeById(e.data || []));
      setSuppliers(dedupeById(sup.data || []));
      setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
      setParts(dedupeById(p.data || []));
      setTools(dedupeById(t.data || []));
      setUsers(dedupeById(u.data || []));
    }).catch(console.error);
    api.get('/departements').then(r => setDepartements(r.data || [])).catch(() => setDepartements([]));
    api.get('/users/roles').then(r => setRoles(r.data || [])).catch(() => setRoles([]));
    api.get('/maintenance-plans').then(r => setMaintenancePlans(r.data || [])).catch(() => setMaintenancePlans([]));
    api.get('/procedures').then(r => setProcedures(r.data || [])).catch(() => setProcedures([]));
    api.get('/work-orders/types').then(r => setWorkOrderTypes(r.data || [])).catch(() => setWorkOrderTypes([]));
    api.get('/checklists').then(r => setChecklists(Array.isArray(r.data) ? r.data : [])).catch(() => setChecklists([]));
  }, []);

  useEffect(() => {
    const firstType = types[0]?.value || 'site';
    setCreationType(firstType);
    setForm(getDefaultForm(firstType));
    setError('');
    setSuccess('');
  }, [categoryId]);

  // Garder creationType et form cohérents avec les types de la catégorie (évite value hors options)
  useEffect(() => {
    if (effectiveType !== creationType) {
      setCreationType(effectiveType);
      setForm(getDefaultForm(effectiveType));
    }
  }, [effectiveType]);

  useEffect(() => {
    setForm(getDefaultForm(creationType));
    setError('');
    setSuccess('');
  }, [creationType]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const run = () => {
      if (creationType === 'site') {
        return api.post('/sites', { name: form.name, address: form.address || undefined })
          .then(r => { setSuccess(r.data?.code ? `Site créé avec le code ${r.data.code}.` : 'Site créé.'); setForm(getDefaultForm('site')); });
      }
      if (creationType === 'departement') {
        return api.post('/departements', { siteId: parseInt(form.siteId), name: form.name, description: form.description || undefined })
          .then(r => { setSuccess(r.data?.code ? `Département créé avec le code ${r.data.code}.` : 'Département créé.'); setForm(getDefaultForm('departement')); });
      }
      if (creationType === 'ligne') {
        return api.post('/lignes', { siteId: parseInt(form.siteId), name: form.name })
          .then(r => { setSuccess(r.data?.code ? `Ligne créée avec le code ${r.data.code}.` : 'Ligne créée.'); setForm(getDefaultForm('ligne')); });
      }
      if (['machine', 'section', 'composant', 'sous_composant'].includes(creationType)) {
        const equipmentTypeMap = { machine: 'machine', section: 'section', composant: 'composant', sous_composant: 'sous_composant' };
        const payload = {
          ...(nextCode ? {} : { code: form.code }),
          name: form.name, description: form.description || undefined,
          categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
          ligneId: form.ligneId ? parseInt(form.ligneId) : undefined,
          departmentId: form.departmentId ? parseInt(form.departmentId) : undefined,
          parentId: form.parentId ? parseInt(form.parentId) : undefined,
          serialNumber: form.serialNumber || undefined,
          criticite: form.criticite || 'B', status: form.status || 'operational',
          equipmentType: equipmentTypeMap[creationType]
        };
        return api.post('/equipment', payload)
          .then(r => { setSuccess(r.data?.code ? `Élément créé avec le code ${r.data.code}.` : 'Élément créé.'); setForm(getDefaultForm(creationType)); if (r.data?.id) navigate(`/app/equipment/${r.data.id}`); });
      }
      if (creationType === 'piece') {
        return api.post('/stock/parts', {
          ...(nextCode ? {} : { code: form.code }),
          name: form.name, description: form.description || undefined,
          unitId: form.unitId ? parseInt(form.unitId, 10) : undefined,
          unitPrice: parseFloat(form.unitPrice) || 0, minStock: parseInt(form.minStock) || 0,
          supplierId: form.supplierId ? parseInt(form.supplierId) : undefined,
          location: (form.location || '').trim() || undefined,
          manufacturerReference: (form.manufacturerReference || '').trim() || undefined,
          imageData: form.imageData || undefined,
          stockCategory: (form.stockCategory || '').trim() || undefined,
          family: (form.family || '').trim() || undefined,
          subFamily1: (form.subFamily1 || '').trim() || undefined,
          subFamily2: (form.subFamily2 || '').trim() || undefined,
          subFamily3: (form.subFamily3 || '').trim() || undefined,
          subFamily4: (form.subFamily4 || '').trim() || undefined,
          subFamily5: (form.subFamily5 || '').trim() || undefined
        }).then(r => { setSuccess(r.data?.code ? `Pièce créée avec le code ${r.data.code}.` : 'Pièce créée.'); setForm(getDefaultForm('piece')); if (r.data?.id) navigate(`/app/stock/parts/${r.data.id}`); });
      }
      if (creationType === 'entree_stock') {
        return api.post('/stock/movements', {
          sparePartId: parseInt(form.sparePartId), quantity: parseInt(form.quantity),
          movementType: 'in', reference: form.reference || undefined, notes: form.notes || undefined
        }).then(() => { setSuccess('Entrée enregistrée.'); setForm(getDefaultForm('entree_stock')); });
      }
      if (creationType === 'sortie_stock') {
        return api.post('/stock/movements', {
          sparePartId: parseInt(form.sparePartId), quantity: Math.abs(parseInt(form.quantity)),
          movementType: 'out', workOrderId: form.workOrderId ? parseInt(form.workOrderId) : undefined, notes: form.notes || undefined
        }).then(() => { setSuccess('Sortie enregistrée.'); setForm(getDefaultForm('sortie_stock')); });
      }
      if (creationType === 'transfert_stock') {
        return api.post('/stock/movements', {
          sparePartId: parseInt(form.sparePartId), quantity: Math.abs(parseInt(form.quantity)),
          movementType: 'transfer', reference: form.reference || undefined, notes: form.notes || undefined
        }).then(() => { setSuccess('Transfert enregistré.'); setForm(getDefaultForm('transfert_stock')); });
      }
      if (creationType === 'outil') {
        return api.post('/tools', {
          ...(nextCode ? {} : { code: form.code }),
          name: form.name, description: form.description || undefined,
          tool_type: form.tool_type || undefined, location: form.location || undefined,
          calibration_due_date: form.calibration_due_date || undefined
        }).then(r => { setSuccess(r.data?.code ? `Outil créé avec le code ${r.data.code}.` : 'Outil créé.'); setForm(getDefaultForm('outil')); });
      }
      if (creationType === 'assignation_outil') {
        return api.post(`/tools/${form.toolId}/assign`, {
          assigned_to: form.assignedTo ? parseInt(form.assignedTo) : undefined,
          work_order_id: form.workOrderId ? parseInt(form.workOrderId) : undefined,
          notes: form.notes || undefined
        }).then(() => { setSuccess('Assignation enregistrée.'); setForm(getDefaultForm('assignation_outil')); });
      }
      if (creationType === 'fournisseur') {
        return api.post('/suppliers', {
          ...(nextCode ? {} : { code: form.code }),
          name: form.name, contactPerson: form.contactPerson || undefined,
          email: form.email || undefined, phone: form.phone || undefined, address: form.address || undefined
        }).then(r => { setSuccess(r.data?.code ? `Fournisseur créé avec le code ${r.data.code}.` : 'Fournisseur créé.'); setForm(getDefaultForm('fournisseur')); });
      }
      if (creationType === 'commande_fournisseur') {
        return api.post('/suppliers/orders', { supplierId: parseInt(form.supplierId) })
          .then(r => { setSuccess('Commande créée.'); setForm(getDefaultForm('commande_fournisseur')); if (r.data?.id) navigate(`/app/suppliers/orders`); });
      }
      if (creationType === 'contrat') {
        return api.post('/contracts', {
          contract_number: form.contract_number, name: form.name, supplier_id: parseInt(form.supplier_id),
          equipment_id: form.equipment_id ? parseInt(form.equipment_id) : undefined,
          contract_type: form.contract_type || 'preventive', start_date: form.start_date, end_date: form.end_date,
          annual_cost: parseFloat(form.annual_cost) || 0
        }).then(() => { setSuccess('Contrat créé.'); setForm(getDefaultForm('contrat')); });
      }
      if (creationType === 'plan_maintenance') {
        return api.post('/maintenance-plans', {
          equipmentId: parseInt(form.equipmentId), name: form.name,
          description: form.description || undefined, frequencyDays: parseInt(form.frequencyDays) || 30,
          procedureId: form.procedureId ? parseInt(form.procedureId, 10) : undefined
        }).then(() => { setSuccess('Plan créé.'); setForm(getDefaultForm('plan_maintenance')); });
      }
      if (creationType === 'checklist') {
        const items = (form.items || []).filter(it => it?.item_text?.trim()).map((it, i) => ({ item_text: it.item_text.trim(), item_type: it.item_type || 'check', order_index: i }));
        return api.post('/checklists', {
          name: form.name, description: form.description || undefined,
          maintenance_plan_id: form.maintenance_plan_id ? parseInt(form.maintenance_plan_id) : undefined,
          is_template: !!form.is_template,
          items
        }).then(() => { setSuccess('Checklist créée.'); setForm(getDefaultForm('checklist')); });
      }
      if (creationType === 'ordre_travail') {
        const planId = form.maintenancePlanId ? parseInt(form.maintenancePlanId, 10) : undefined;
        let procedureIds = (form.procedureIds || []).map(id => parseInt(id, 10)).filter(Boolean);
        if (procedureIds.length === 0 && planId && maintenancePlans.length) {
          const plan = maintenancePlans.find(p => p.id === planId);
          if (plan?.procedure_id) procedureIds = [plan.procedure_id];
        }
        const reservationsPayload = (form.reservations || []).filter(r => r.sparePartId && Number(r.quantity) > 0).map(r => ({ sparePartId: parseInt(r.sparePartId, 10), quantity: parseInt(r.quantity, 10) || 1, notes: r.notes || undefined }));
        return api.post('/work-orders', {
          title: form.title, description: form.description || undefined,
          equipmentId: form.equipmentId ? parseInt(form.equipmentId) : undefined,
          typeId: form.typeId ? parseInt(form.typeId) : 2, priority: form.priority || 'medium',
          maintenancePlanId: planId, procedureIds: procedureIds.length ? procedureIds : undefined,
          assignedUserIds: (form.assignedUserIds && form.assignedUserIds.length) ? form.assignedUserIds.map(id => parseInt(id, 10)) : undefined,
          reservations: reservationsPayload.length ? reservationsPayload : undefined,
          toolIds: (form.toolIds && form.toolIds.length) ? form.toolIds.map(id => parseInt(id, 10)) : undefined,
          checklistIds: (form.checklistIds && form.checklistIds.length) ? form.checklistIds.map(id => parseInt(id, 10)) : undefined
        }).then(r => {
          setSuccess('Déclaration enregistrée. L\'équipe maintenance a été notifiée.');
          setForm(getDefaultForm('ordre_travail'));
          if (r.data?.id) navigate(`/app/work-orders/${r.data.id}`);
        });
      }
      if (creationType === 'utilisateur') {
        return api.post('/users', {
          email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, roleId: parseInt(form.roleId),
          phone: form.phone || undefined, address: form.address || undefined, city: form.city || undefined, postalCode: form.postalCode || undefined,
          employeeNumber: form.employeeNumber || undefined, jobTitle: form.jobTitle || undefined, department: form.department || undefined,
          hireDate: form.hireDate || undefined, contractType: form.contractType || undefined
        }).then(() => { setSuccess('Utilisateur créé.'); setForm(getDefaultForm('utilisateur')); });
      }
      if (creationType === 'code_defaut') {
        return api.post('/failure-codes', {
          ...(nextCode ? {} : { code: form.code }),
          name: form.name, description: form.description || undefined, category: form.category || undefined
        }).then(r => { setSuccess(r.data?.code ? `Code défaut créé avec le code ${r.data.code}.` : 'Code défaut créé.'); setForm(getDefaultForm('code_defaut')); });
      }
      return Promise.reject(new Error('Type non géré'));
    };

    run()
      .catch(err => setError(err.response?.data?.error || err.message || 'Erreur lors de la création'))
      .finally(() => setLoading(false));
  };

  const canSubmit = () => {
    if (creationType === 'site') return form.name?.trim();
    if (creationType === 'departement') return form.siteId && form.name?.trim();
    if (creationType === 'ligne') return form.siteId && form.name?.trim();
    if (['machine', 'section', 'composant', 'sous_composant'].includes(creationType)) return form.name?.trim() && (nextCode || form.code?.trim());
    if (creationType === 'piece') return form.name?.trim() && (nextCode || form.code?.trim());
    if (creationType === 'entree_stock') return form.sparePartId && form.quantity && parseInt(form.quantity) > 0;
    if (creationType === 'sortie_stock') return form.sparePartId && form.quantity && parseInt(form.quantity) > 0;
    if (creationType === 'transfert_stock') return form.sparePartId && form.quantity && parseInt(form.quantity) > 0;
    if (creationType === 'outil') return form.name?.trim() && (nextCode || form.code?.trim());
    if (creationType === 'assignation_outil') return form.toolId;
    if (creationType === 'fournisseur') return form.name?.trim() && (nextCode || form.code?.trim());
    if (creationType === 'commande_fournisseur') return form.supplierId;
    if (creationType === 'contrat') return form.contract_number?.trim() && form.name?.trim() && form.supplier_id && form.start_date && form.end_date;
    if (creationType === 'plan_maintenance') return form.equipmentId && form.name?.trim();
    if (creationType === 'checklist') return form.name?.trim();
    if (creationType === 'ordre_travail') return form.title?.trim();
    if (creationType === 'utilisateur') return form.email && form.password && form.firstName?.trim() && form.lastName?.trim() && form.roleId;
    if (creationType === 'code_defaut') return form.name?.trim() && (nextCode || form.code?.trim());
    return false;
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>Création</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choisissez une catégorie et un type d&apos;élément, puis renseignez le formulaire.
      </Typography>

      <Card sx={{ maxWidth: 720, borderRadius: 2 }}>
        <CardContent>
          <Tabs value={categoryId} onChange={(_, v) => setCategoryId(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            {CATEGORIES.map(c => <Tab key={c.id} value={c.id} label={c.label} />)}
          </Tabs>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Type d&apos;élément</InputLabel>
            <Select value={effectiveType} label="Type d'élément" onChange={(e) => { setCreationType(e.target.value); setForm(getDefaultForm(e.target.value)); }}>
              {types.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>

          <Divider sx={{ my: 2 }} />
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            {/* ——— Hiérarchie ——— */}
            {creationType === 'site' && (
              <Grid container spacing={2}>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Désignation (nom)" value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth label="Adresse" value={form.address ?? ''} onChange={(e) => handleChange('address', e.target.value)} /></Grid>
              </Grid>
            )}
            {creationType === 'departement' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Site</InputLabel><Select value={form.siteId ?? ''} label="Site" onChange={(e) => handleChange('siteId', e.target.value)}>{sites.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select></FormControl></Grid>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                <Grid item xs={12}><TextField fullWidth required label="Désignation (nom)" value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
              </Grid>
            )}
            {creationType === 'ligne' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Site</InputLabel><Select value={form.siteId ?? ''} label="Site" onChange={(e) => handleChange('siteId', e.target.value)}>{sites.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select></FormControl></Grid>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                <Grid item xs={12}><TextField fullWidth required label="Désignation (nom)" value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
              </Grid>
            )}
            {creationType === 'machine' && (
              <Grid container spacing={2}>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                {!nextCode && <Grid item xs={12} sm={6}><TextField fullWidth required label="Code" value={form.code ?? ''} onChange={(e) => handleChange('code', e.target.value)} /></Grid>}
                <Grid item xs={12} sm={6}><TextField fullWidth required label={nextCode ? 'Désignation (nom)' : 'Nom'} value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Catégorie</InputLabel><Select value={form.categoryId ?? ''} label="Catégorie" onChange={(e) => handleChange('categoryId', e.target.value)}><MenuItem value="">—</MenuItem>{categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Département</InputLabel><Select value={form.departmentId ?? ''} label="Département" onChange={(e) => handleChange('departmentId', e.target.value)}><MenuItem value="">—</MenuItem>{departements.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Ligne</InputLabel><Select value={form.ligneId ?? ''} label="Ligne" onChange={(e) => handleChange('ligneId', e.target.value)}><MenuItem value="">—</MenuItem>{lignes.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="N° série" value={form.serialNumber ?? ''} onChange={(e) => handleChange('serialNumber', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Criticité</InputLabel><Select value={form.criticite ?? 'B'} label="Criticité" onChange={(e) => handleChange('criticite', e.target.value)}><MenuItem value="A">A</MenuItem><MenuItem value="B">B</MenuItem><MenuItem value="C">C</MenuItem></Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Statut</InputLabel><Select value={form.status ?? 'operational'} label="Statut" onChange={(e) => handleChange('status', e.target.value)}><MenuItem value="operational">Opérationnel</MenuItem><MenuItem value="maintenance">En maintenance</MenuItem><MenuItem value="out_of_service">Hors service</MenuItem></Select></FormControl></Grid>
              </Grid>
            )}
            {(creationType === 'section' || creationType === 'composant' || creationType === 'sous_composant') && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Équipement parent</InputLabel><Select value={form.parentId ?? ''} label="Équipement parent" onChange={(e) => handleChange('parentId', e.target.value)}><MenuItem value="">—</MenuItem>{equipment.map(eq => <MenuItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</MenuItem>)}</Select></FormControl></Grid>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                {!nextCode && <Grid item xs={12} sm={6}><TextField fullWidth required label="Code" value={form.code ?? ''} onChange={(e) => handleChange('code', e.target.value)} /></Grid>}
                <Grid item xs={12} sm={6}><TextField fullWidth required label={nextCode ? 'Désignation (nom)' : 'Nom'} value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Catégorie</InputLabel><Select value={form.categoryId ?? ''} label="Catégorie" onChange={(e) => handleChange('categoryId', e.target.value)}><MenuItem value="">—</MenuItem>{categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Criticité</InputLabel><Select value={form.criticite ?? 'B'} label="Criticité" onChange={(e) => handleChange('criticite', e.target.value)}><MenuItem value="A">A</MenuItem><MenuItem value="B">B</MenuItem><MenuItem value="C">C</MenuItem></Select></FormControl></Grid>
              </Grid>
            )}

            {/* ——— Stock ——— */}
            {creationType === 'piece' && (
              <Grid container spacing={2}>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                {!nextCode && <Grid item xs={12} sm={6}><TextField fullWidth required label="Code" value={form.code ?? ''} onChange={(e) => handleChange('code', e.target.value)} /></Grid>}
                <Grid item xs={12} sm={6}><TextField fullWidth required label={nextCode ? 'Désignation (nom)' : 'Nom'} value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Catégorie stock" value={form.stockCategory ?? ''} onChange={(e) => handleChange('stockCategory', e.target.value)} placeholder="ex: Consommable, Pièce rechange" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Famille" value={form.family ?? ''} onChange={(e) => handleChange('family', e.target.value)} placeholder="ex: Transmission" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Sous-famille 1" value={form.subFamily1 ?? ''} onChange={(e) => handleChange('subFamily1', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Sous-famille 2" value={form.subFamily2 ?? ''} onChange={(e) => handleChange('subFamily2', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Sous-famille 3" value={form.subFamily3 ?? ''} onChange={(e) => handleChange('subFamily3', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Sous-famille 4" value={form.subFamily4 ?? ''} onChange={(e) => handleChange('subFamily4', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Sous-famille 5" value={form.subFamily5 ?? ''} onChange={(e) => handleChange('subFamily5', e.target.value)} /></Grid>
                <Grid item xs={12} sm={4}><FormControl fullWidth><InputLabel>Unité</InputLabel><Select value={form.unitId ?? ''} label="Unité" onChange={(e) => handleChange('unitId', e.target.value)}><MenuItem value="">—</MenuItem>{units.map(u => <MenuItem key={u.id} value={u.id}>{u.symbol ? `${u.name} (${u.symbol})` : u.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth type="number" label={`Prix unitaire (${currency})`} value={form.unitPrice ?? ''} onChange={(e) => handleChange('unitPrice', e.target.value)} inputProps={{ min: 0, step: 0.01 }} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth type="number" label="Stock minimum" value={form.minStock ?? ''} onChange={(e) => handleChange('minStock', e.target.value)} inputProps={{ min: 0 }} /></Grid>
                <Grid item xs={12}><FormControl fullWidth><InputLabel>Fournisseur</InputLabel><Select value={form.supplierId ?? ''} label="Fournisseur" onChange={(e) => handleChange('supplierId', e.target.value)}><MenuItem value="">—</MenuItem>{suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Emplacement" value={form.location ?? ''} onChange={(e) => handleChange('location', e.target.value)} placeholder="Rayon, armoire..." /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Référence constructeur" value={form.manufacturerReference ?? ''} onChange={(e) => handleChange('manufacturerReference', e.target.value)} /></Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Image de l&apos;article (optionnel, max 500 Ko)</Typography>
                  {form.imageData ? (
                    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                      <img src={form.imageData} alt="Aperçu" style={{ maxHeight: 120, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid #e0e0e0' }} />
                      <Button size="small" onClick={() => handleChange('imageData', null)}>Supprimer l&apos;image</Button>
                    </Box>
                  ) : (
                    <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 2, textAlign: 'center' }}>
                      <Image sx={{ fontSize: 40, color: 'text.secondary', mb: 0.5 }} />
                      <Button variant="outlined" component="label" size="small">Choisir une image
                        <input type="file" accept="image/*" hidden onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 500 * 1024) { setError('Image trop volumineuse (max 500 Ko).'); return; }
                          const reader = new FileReader();
                          reader.onload = (ev) => { handleChange('imageData', ev.target?.result || null); setError(''); };
                          reader.readAsDataURL(file);
                        }} />
                      </Button>
                    </Box>
                  )}
                </Grid>
              </Grid>
            )}
            {creationType === 'entree_stock' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Pièce</InputLabel><Select value={form.sparePartId ?? ''} label="Pièce" onChange={(e) => handleChange('sparePartId', e.target.value)}>{parts.map(p => <MenuItem key={p.id} value={p.id}>{p.code} — {p.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="number" label="Quantité" value={form.quantity ?? ''} onChange={(e) => handleChange('quantity', e.target.value)} inputProps={{ min: 1 }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Référence" value={form.reference ?? ''} onChange={(e) => handleChange('reference', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Notes" value={form.notes ?? ''} onChange={(e) => handleChange('notes', e.target.value)} /></Grid>
              </Grid>
            )}
            {creationType === 'sortie_stock' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Pièce</InputLabel><Select value={form.sparePartId ?? ''} label="Pièce" onChange={(e) => handleChange('sparePartId', e.target.value)}>{parts.map(p => <MenuItem key={p.id} value={p.id}>{p.code} — {p.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="number" label="Quantité" value={form.quantity ?? ''} onChange={(e) => handleChange('quantity', e.target.value)} inputProps={{ min: 1 }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="OT (optionnel)" value={form.workOrderId ?? ''} onChange={(e) => handleChange('workOrderId', e.target.value)} placeholder="ID OT" /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Notes" value={form.notes ?? ''} onChange={(e) => handleChange('notes', e.target.value)} /></Grid>
              </Grid>
            )}
            {creationType === 'transfert_stock' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Pièce</InputLabel><Select value={form.sparePartId ?? ''} label="Pièce" onChange={(e) => handleChange('sparePartId', e.target.value)}>{parts.map(p => <MenuItem key={p.id} value={p.id}>{p.code} — {p.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="number" label="Quantité" value={form.quantity ?? ''} onChange={(e) => handleChange('quantity', e.target.value)} inputProps={{ min: 1 }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Référence" value={form.reference ?? ''} onChange={(e) => handleChange('reference', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Notes" value={form.notes ?? ''} onChange={(e) => handleChange('notes', e.target.value)} /></Grid>
              </Grid>
            )}

            {/* ——— Outils ——— */}
            {creationType === 'outil' && (
              <Grid container spacing={2}>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                {!nextCode && <Grid item xs={12} sm={6}><TextField fullWidth required label="Code" value={form.code ?? ''} onChange={(e) => handleChange('code', e.target.value)} /></Grid>}
                <Grid item xs={12} sm={6}><TextField fullWidth required label={nextCode ? 'Désignation (nom)' : 'Nom'} value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Type</InputLabel><Select value={form.tool_type ?? 'hand_tool'} label="Type" onChange={(e) => handleChange('tool_type', e.target.value)}><MenuItem value="hand_tool">Outil manuel</MenuItem><MenuItem value="power_tool">Outil électrique</MenuItem><MenuItem value="measuring">Mesure</MenuItem><MenuItem value="safety">Sécurité</MenuItem><MenuItem value="other">Autre</MenuItem></Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth type="date" label="Échéance calibration" value={form.calibration_due_date ?? ''} onChange={(e) => handleChange('calibration_due_date', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={12}><TextField fullWidth label="Localisation" value={form.location ?? ''} onChange={(e) => handleChange('location', e.target.value)} /></Grid>
              </Grid>
            )}
            {creationType === 'assignation_outil' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Outil</InputLabel><Select value={form.toolId ?? ''} label="Outil" onChange={(e) => handleChange('toolId', e.target.value)}>{tools.map(t => <MenuItem key={t.id} value={t.id}>{t.code} — {t.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><FormControl fullWidth><InputLabel>Assigné à</InputLabel><Select value={form.assignedTo ?? ''} label="Assigné à" onChange={(e) => handleChange('assignedTo', e.target.value)}><MenuItem value="">—</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><TextField fullWidth label="OT (ID)" value={form.workOrderId ?? ''} onChange={(e) => handleChange('workOrderId', e.target.value)} placeholder="Optionnel" /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Notes" value={form.notes ?? ''} onChange={(e) => handleChange('notes', e.target.value)} /></Grid>
              </Grid>
            )}

            {/* ——— Fournisseurs ——— */}
            {creationType === 'fournisseur' && (
              <Grid container spacing={2}>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                {!nextCode && <Grid item xs={12} sm={6}><TextField fullWidth required label="Code" value={form.code ?? ''} onChange={(e) => handleChange('code', e.target.value)} /></Grid>}
                <Grid item xs={12} sm={6}><TextField fullWidth required label={nextCode ? 'Désignation (nom)' : 'Nom'} value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Contact" value={form.contactPerson ?? ''} onChange={(e) => handleChange('contactPerson', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth type="email" label="Email" value={form.email ?? ''} onChange={(e) => handleChange('email', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Téléphone" value={form.phone ?? ''} onChange={(e) => handleChange('phone', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth label="Adresse" value={form.address ?? ''} onChange={(e) => handleChange('address', e.target.value)} /></Grid>
              </Grid>
            )}
            {creationType === 'commande_fournisseur' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Fournisseur</InputLabel><Select value={form.supplierId ?? ''} label="Fournisseur" onChange={(e) => handleChange('supplierId', e.target.value)}>{suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select></FormControl></Grid>
              </Grid>
            )}
            {creationType === 'contrat' && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="N° contrat" value={form.contract_number ?? ''} onChange={(e) => handleChange('contract_number', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Nom" value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Fournisseur</InputLabel><Select value={form.supplier_id ?? ''} label="Fournisseur" onChange={(e) => handleChange('supplier_id', e.target.value)}>{suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><FormControl fullWidth><InputLabel>Équipement</InputLabel><Select value={form.equipment_id ?? ''} label="Équipement" onChange={(e) => handleChange('equipment_id', e.target.value)}><MenuItem value="">—</MenuItem>{equipment.map(eq => <MenuItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Type</InputLabel><Select value={form.contract_type ?? 'preventive'} label="Type" onChange={(e) => handleChange('contract_type', e.target.value)}><MenuItem value="preventive">Préventif</MenuItem><MenuItem value="corrective">Correctif</MenuItem><MenuItem value="full">Complet</MenuItem><MenuItem value="spare_parts">Pièces</MenuItem></Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth type="number" label={`Coût annuel (${currency})`} value={form.annual_cost ?? ''} onChange={(e) => handleChange('annual_cost', e.target.value)} inputProps={{ min: 0 }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="date" label="Début" value={form.start_date ?? ''} onChange={(e) => handleChange('start_date', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="date" label="Fin" value={form.end_date ?? ''} onChange={(e) => handleChange('end_date', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              </Grid>
            )}

            {/* ——— Maintenance ——— */}
            {creationType === 'plan_maintenance' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Équipement</InputLabel><Select value={form.equipmentId ?? ''} label="Équipement" onChange={(e) => handleChange('equipmentId', e.target.value)}>{equipment.map(eq => <MenuItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><TextField fullWidth required label="Nom du plan" value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth type="number" label="Fréquence (jours)" value={form.frequencyDays ?? ''} onChange={(e) => handleChange('frequencyDays', e.target.value)} inputProps={{ min: 1 }} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Procédure (optionnel)</InputLabel><Select value={form.procedureId ?? ''} label="Procédure (optionnel)" onChange={(e) => handleChange('procedureId', e.target.value)}><MenuItem value="">—</MenuItem>{(procedures || []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</Select></FormControl></Grid>
              </Grid>
            )}
            {creationType === 'checklist' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><TextField fullWidth required label="Nom" value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
                <Grid item xs={12}><FormControl fullWidth><InputLabel>Plan de maintenance</InputLabel><Select value={form.maintenance_plan_id ?? ''} label="Plan de maintenance" onChange={(e) => handleChange('maintenance_plan_id', e.target.value)}><MenuItem value="">—</MenuItem>{maintenancePlans.map(m => <MenuItem key={m.id} value={m.id}>{m.name} ({m.equipment_code})</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><FormControl fullWidth><InputLabel>Modèle</InputLabel><Select value={form.is_template ? '1' : '0'} label="Modèle" onChange={(e) => handleChange('is_template', e.target.value === '1')}><MenuItem value="0">Non</MenuItem><MenuItem value="1">Oui</MenuItem></Select></FormControl></Grid>
                <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary">Premier item (optionnel)</Typography><TextField fullWidth label="Texte item" value={form.items?.[0]?.item_text ?? ''} onChange={(e) => handleChange('items', [{ item_text: e.target.value, item_type: form.items?.[0]?.item_type || 'check' }])} /></Grid>
              </Grid>
            )}
            {creationType === 'ordre_travail' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><TextField fullWidth required label="Titre" value={form.title ?? ''} onChange={(e) => handleChange('title', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Équipement</InputLabel><Select value={form.equipmentId ?? ''} label="Équipement" onChange={(e) => handleChange('equipmentId', e.target.value)}><MenuItem value="">—</MenuItem>{equipment.map(eq => <MenuItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Type</InputLabel><Select value={form.typeId ?? ''} label="Type" onChange={(e) => handleChange('typeId', e.target.value)}><MenuItem value="">—</MenuItem>{workOrderTypes.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Plan de maintenance</InputLabel><Select value={form.maintenancePlanId ?? ''} label="Plan de maintenance" onChange={(e) => { const v = e.target.value; handleChange('maintenancePlanId', v); if (v) { const p = maintenancePlans.find(m => String(m.id) === String(v)); if (p?.procedure_id) handleChange('procedureIds', [String(p.procedure_id)]); } }}><MenuItem value="">—</MenuItem>{maintenancePlans.map(m => <MenuItem key={m.id} value={m.id}>{m.name} ({m.equipment_code})</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Procédures / modes opératoires</InputLabel><Select multiple value={form.procedureIds ?? []} onChange={(e) => handleChange('procedureIds', e.target.value)} label="Procédures / modes opératoires" renderValue={(sel) => (sel || []).map(id => procedures.find(p => p.id === id)?.name).filter(Boolean).join(', ') || '—'}><MenuItem value="">—</MenuItem>{(procedures || []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Priorité</InputLabel><Select value={form.priority ?? 'medium'} label="Priorité" onChange={(e) => handleChange('priority', e.target.value)}><MenuItem value="low">{t('priority.low')}</MenuItem><MenuItem value="medium">{t('priority.medium')}</MenuItem><MenuItem value="high">{t('priority.high')}</MenuItem><MenuItem value="critical">{t('priority.critical')}</MenuItem></Select></FormControl></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth><InputLabel>Opérateurs / Équipe</InputLabel><Select multiple value={form.assignedUserIds ?? []} onChange={(e) => handleChange('assignedUserIds', e.target.value)} label="Opérateurs / Équipe" renderValue={(sel) => (sel || []).map(id => users.find(u => u.id === id) && `${users.find(u => u.id === id).first_name} ${users.find(u => u.id === id).last_name}`).filter(Boolean).join(', ') || '—'}><MenuItem value="">—</MenuItem>{(users || []).map(u => <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary">Checklists à exécuter</Typography><FormControl fullWidth size="small"><InputLabel>Checklists</InputLabel><Select multiple value={form.checklistIds ?? []} onChange={(e) => handleChange('checklistIds', e.target.value)} label="Checklists" renderValue={(sel) => (sel || []).map(id => checklists.find(c => c.id === id)?.name).filter(Boolean).join(', ') || '—'}><MenuItem value="">—</MenuItem>{checklists.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.equipment_code ? `(${c.equipment_code})` : ''}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary">Pièces détachées (réservations)</Typography>{(form.reservations || []).map((r, index) => (<Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}><FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Pièce</InputLabel><Select value={r.sparePartId ?? ''} label="Pièce" onChange={(e) => setForm(prev => ({ ...prev, reservations: prev.reservations.map((res, i) => i === index ? { ...res, sparePartId: e.target.value } : res) }))}><MenuItem value="">—</MenuItem>{parts.map(p => <MenuItem key={p.id} value={p.id}>{p.code || p.name} — {p.name}</MenuItem>)}</Select></FormControl><TextField type="number" size="small" label="Qté" value={r.quantity ?? 1} onChange={(e) => setForm(prev => ({ ...prev, reservations: prev.reservations.map((res, i) => i === index ? { ...res, quantity: e.target.value } : res) }))} inputProps={{ min: 1 }} sx={{ width: 80 }} /><TextField size="small" label="Notes" value={r.notes ?? ''} onChange={(e) => setForm(prev => ({ ...prev, reservations: prev.reservations.map((res, i) => i === index ? { ...res, notes: e.target.value } : res) }))} sx={{ flex: 1 }} /><Button size="small" onClick={() => setForm(prev => ({ ...prev, reservations: prev.reservations.filter((_, i) => i !== index) }))}>Suppr.</Button></Box>))}<Button size="small" onClick={() => setForm(prev => ({ ...prev, reservations: [...(prev.reservations || []), { sparePartId: '', quantity: 1, notes: '' }] }))}>+ Pièce</Button></Grid>
                <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary">Outils à affecter</Typography><FormControl fullWidth size="small"><InputLabel>Outils</InputLabel><Select multiple value={form.toolIds ?? []} onChange={(e) => handleChange('toolIds', e.target.value)} label="Outils" renderValue={(sel) => (sel || []).map(id => tools.find(t => t.id === id)?.name).filter(Boolean).join(', ') || '—'}><MenuItem value="">—</MenuItem>{tools.map(t => <MenuItem key={t.id} value={t.id}>{t.code} — {t.name}</MenuItem>)}</Select></FormControl></Grid>
              </Grid>
            )}

            {/* ——— Paramètres ——— */}
            {creationType === 'utilisateur' && (
              <Grid container spacing={2}>
                <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary">Compte</Typography></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="email" label="Email" value={form.email ?? ''} onChange={(e) => handleChange('email', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required type="password" label="Mot de passe" value={form.password ?? ''} onChange={(e) => handleChange('password', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Prénom" value={form.firstName ?? ''} onChange={(e) => handleChange('firstName', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Nom" value={form.lastName ?? ''} onChange={(e) => handleChange('lastName', e.target.value)} /></Grid>
                <Grid item xs={12}><FormControl fullWidth required><InputLabel>Rôle</InputLabel><Select value={form.roleId ?? ''} label="Rôle" onChange={(e) => handleChange('roleId', e.target.value)}>{roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Infos personnelles</Typography></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Téléphone" value={form.phone ?? ''} onChange={(e) => handleChange('phone', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth label="Adresse" value={form.address ?? ''} onChange={(e) => handleChange('address', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Ville" value={form.city ?? ''} onChange={(e) => handleChange('city', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Code postal" value={form.postalCode ?? ''} onChange={(e) => handleChange('postalCode', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Matricule" value={form.employeeNumber ?? ''} onChange={(e) => handleChange('employeeNumber', e.target.value)} /></Grid>
                <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Infos techniques</Typography></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Fonction / Poste" value={form.jobTitle ?? ''} onChange={(e) => handleChange('jobTitle', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Service / Département" value={form.department ?? ''} onChange={(e) => handleChange('department', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth type="date" InputLabelProps={{ shrink: true }} label="Date d'entrée" value={form.hireDate ?? ''} onChange={(e) => handleChange('hireDate', e.target.value)} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Type de contrat" value={form.contractType ?? ''} onChange={(e) => handleChange('contractType', e.target.value)} placeholder="CDI, CDD, etc." /></Grid>
              </Grid>
            )}
            {creationType === 'code_defaut' && (
              <Grid container spacing={2}>
                {nextCode && <Grid item xs={12}><Typography variant="body2" color="text.secondary">Code : attribué automatiquement (ex. {nextCode})</Typography></Grid>}
                {!nextCode && <Grid item xs={12} sm={6}><TextField fullWidth required label="Code" value={form.code ?? ''} onChange={(e) => handleChange('code', e.target.value)} /></Grid>}
                <Grid item xs={12} sm={6}><TextField fullWidth required label={nextCode ? 'Désignation (nom)' : 'Nom'} value={form.name ?? ''} onChange={(e) => handleChange('name', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline label="Description" value={form.description ?? ''} onChange={(e) => handleChange('description', e.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth label="Catégorie" value={form.category ?? ''} onChange={(e) => handleChange('category', e.target.value)} /></Grid>
              </Grid>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button type="submit" variant="contained" startIcon={<Save />} disabled={loading || !canSubmit()}>
                {loading ? 'Création...' : 'Créer'}
              </Button>
              <Button onClick={() => setForm(getDefaultForm(creationType))}>Réinitialiser</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
