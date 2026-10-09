/**
 * @file companySettingsService.js
 * @description Centralized Company Branding & Payslip Configuration Layer.
 * Allows Admin to dynamically customize company name, address, tax IDs, and signatories across all payslips & letters.
 */

const STORAGE_KEY = 'EMS_COMPANY_SETTINGS';

export const DEFAULT_COMPANY_SETTINGS = {
  companyName: 'INFORAG TECHNOLOGY PVT. LTD.',
  shortName: 'Inforag Technology',
  tagline: 'Enterprise Management System & Tech Solutions',
  address: 'Enterprise Tech Towers, Cyber City, Sector 24, Gurugram / New Delhi - 110001',
  email: 'support@inforagtechnology.com',
  hrEmail: 'hr@inforagtechnology.com',
  phone: '+91 98765 43210',
  website: 'https://inforagtechnology.com',
  cin: 'U72200DL2023PTC123456',
  gstin: '07AAAAA0000A1Z5',
  signatoryTitle: 'Authorized HR Directorate',
  signatoryName: 'Sneha Patel',
  footerNote: '* This is a computer-generated salary slip and does not require a physical signature.'
};

export const getCompanySettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.warn('Error reading company settings:', err);
  }
  return DEFAULT_COMPANY_SETTINGS;
};

export const saveCompanySettings = (newSettings) => {
  try {
    const updated = { ...getCompanySettings(), ...newSettings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom window event so all open modals / pages re-render instantly
    window.dispatchEvent(new Event('company-settings-updated'));
    return updated;
  } catch (err) {
    console.error('Error saving company settings:', err);
    return DEFAULT_COMPANY_SETTINGS;
  }
};
