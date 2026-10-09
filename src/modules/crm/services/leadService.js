/**
 * @file leadService.js
 * @description Enterprise CRM Leads data service with API calls & reliable offline storage fallback.
 */

import { getCollection, saveCollection, KEYS } from '../../../shared/services/storageService';

const API_BASE = '/api';

async function fetchWithFallback(url, options = {}, fallbackFn) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return json.data !== undefined ? json.data : json;
    }
  } catch (err) {
    // API offline or route not ready — seamlessly use reactive local storage fallback
  }

  return await fallbackFn();
}

export const leadService = {
  /**
   * Get filtered leads
   */
  async getLeads(filters = {}) {
    const query = new URLSearchParams();
    if (filters.search) query.append('search', filters.search);
    if (filters.status && filters.status !== 'all') query.append('status', filters.status);
    if (filters.leadType && filters.leadType !== 'all') query.append('leadType', filters.leadType);
    if (filters.leadOwnerId && filters.leadOwnerId !== 'all') query.append('leadOwnerId', filters.leadOwnerId);
    if (filters.priority && filters.priority !== 'all') query.append('priority', filters.priority);
    if (filters.startDate && filters.endDate) {
      query.append('startDate', filters.startDate);
      query.append('endDate', filters.endDate);
    }

    return fetchWithFallback(`${API_BASE}/leads?${query.toString()}`, { method: 'GET' }, async () => {
      let leads = getCollection(KEYS.LEADS);

      if (filters.search) {
        const q = filters.search.toLowerCase();
        leads = leads.filter(l =>
          l.name?.toLowerCase().includes(q) ||
          l.contactPerson?.toLowerCase().includes(q) ||
          l.companyName?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.leadCode?.toLowerCase().includes(q) ||
          l.client?.toLowerCase().includes(q) ||
          l.leadOwnerName?.toLowerCase().includes(q)
        );
      }

      if (filters.status && filters.status !== 'all') {
        leads = leads.filter(l => l.status === filters.status);
      }

      if (filters.leadType && filters.leadType !== 'all') {
        leads = leads.filter(l => l.leadType === filters.leadType);
      }

      if (filters.leadOwnerId && filters.leadOwnerId !== 'all') {
        leads = leads.filter(l => l.leadOwnerId === filters.leadOwnerId);
      }

      if (filters.priority && filters.priority !== 'all') {
        leads = leads.filter(l => l.priority === filters.priority);
      }

      if (filters.startDate && filters.endDate) {
        leads = leads.filter(l => l.startDate >= filters.startDate && l.endDate <= filters.endDate);
      }

      return leads;
    });
  },

  /**
   * Create a new Lead
   */
  async createLead(leadData) {
    return fetchWithFallback(`${API_BASE}/leads`, {
      method: 'POST',
      body: JSON.stringify(leadData)
    }, async () => {
      const leads = getCollection(KEYS.LEADS);
      const nextNum = (leads.length > 0 ? Math.max(...leads.map(l => l.idNumber || 0)) + 1 : 1);
      const now = new Date();
      
      const newLead = {
        _id: `lead_${Date.now()}`,
        idNumber: nextNum,
        leadCode: `LEAD-${1000 + nextNum}`,
        createdDate: now.toLocaleDateString('en-GB').replace(/\//g, '-'),
        createdAt: now.toISOString(),
        status: leadData.status || 'new',
        priority: leadData.priority || 'medium',
        dealValue: Number(leadData.dealValue) || 0,
        ...leadData
      };

      leads.unshift(newLead);
      saveCollection(KEYS.LEADS, leads);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
      return newLead;
    });
  },

  /**
   * Update existing Lead
   */
  async updateLead(leadId, updateData) {
    return fetchWithFallback(`${API_BASE}/leads/${leadId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    }, async () => {
      const leads = getCollection(KEYS.LEADS);
      const idx = leads.findIndex(l => l._id === leadId);
      if (idx === -1) throw new Error('Lead not found');

      leads[idx] = {
        ...leads[idx],
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      saveCollection(KEYS.LEADS, leads);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
      return leads[idx];
    });
  },

  /**
   * Update Lead Status (e.g. from table or kanban)
   */
  async updateLeadStatus(leadId, status) {
    return this.updateLead(leadId, { status });
  },

  /**
   * Delete Lead
   */
  async deleteLead(leadId) {
    return fetchWithFallback(`${API_BASE}/leads/${leadId}`, {
      method: 'DELETE'
    }, async () => {
      let leads = getCollection(KEYS.LEADS);
      leads = leads.filter(l => l._id !== leadId);
      saveCollection(KEYS.LEADS, leads);
      window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
      return { success: true };
    });
  },

  /**
   * Import multiple leads in batch
   */
  async importLeads(importedLeads) {
    const leads = getCollection(KEYS.LEADS);
    let maxNum = leads.length > 0 ? Math.max(...leads.map(l => l.idNumber || 0)) : 0;
    const now = new Date();

    const formattedNewLeads = importedLeads.map((item, idx) => {
      maxNum++;
      return {
        _id: `lead_${Date.now()}_${idx}`,
        idNumber: maxNum,
        leadCode: `LEAD-${1000 + maxNum}`,
        name: item.name || item.contactPerson || 'Untitled Lead',
        contactPerson: item.contactPerson || item.name || 'Contact Person',
        companyName: item.companyName || item.client || 'Enterprise Client',
        client: item.client || item.companyName || 'Enterprise Client',
        email: item.email || '',
        phone: item.phone || item.phoneNumber || '',
        leadType: item.leadType || item.category || 'Inbound Web',
        leadOwnerId: item.leadOwnerId || 'emp_001',
        leadOwnerName: item.leadOwnerName || 'Avinash',
        leadOwnerRole: item.leadOwnerRole || 'Digital Marketing Strategic',
        leadOwnerAvatar: item.leadOwnerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        createdById: item.createdById || 'emp_001',
        createdByName: item.createdByName || 'Avinash',
        createdByRole: item.createdByRole || 'Senior',
        createdByAvatar: item.createdByAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        startDate: item.startDate || now.toISOString().split('T')[0],
        endDate: item.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdDate: now.toLocaleDateString('en-GB').replace(/\//g, '-'),
        createdAt: now.toISOString(),
        status: item.status || 'new',
        priority: item.priority || 'medium',
        dealValue: Number(item.dealValue) || 0,
        leadSource: item.leadSource || 'CSV Import',
        notes: item.notes || item.description || 'Imported via CSV/Excel template.'
      };
    });

    const updatedList = [...formattedNewLeads, ...leads];
    saveCollection(KEYS.LEADS, updatedList);
    window.dispatchEvent(new CustomEvent('hrms_storage_change', { detail: { key: KEYS.LEADS } }));
    return formattedNewLeads;
  }
};
