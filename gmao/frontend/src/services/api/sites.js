import api from '../api';

export const sitesApi = {
  list: () => api.get('/sites').then((r) => r.data),
  get: (id) => api.get(`/sites/${id}`).then((r) => r.data),
  create: (data) => api.post('/sites', data).then((r) => r.data),
  update: (id, data) => api.put(`/sites/${id}`, data).then((r) => r.data)
};

export const lignesApi = {
  list: (siteId) => api.get('/lignes', { params: siteId ? { siteId } : {} }).then((r) => r.data),
  get: (id) => api.get(`/lignes/${id}`).then((r) => r.data),
  create: (data) => api.post('/lignes', data).then((r) => r.data),
  update: (id, data) => api.put(`/lignes/${id}`, data).then((r) => r.data)
};
