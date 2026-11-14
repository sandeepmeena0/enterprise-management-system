/**
 * @file companySettingsController.js
 * @description Controller for Company Settings, Foundation Anniversary & Shift Policy in MongoDB Atlas.
 */

const CompanySettings = require('../models/CompanySettings');

exports.getCompanySettings = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = new CompanySettings();
      await settings.save();
    }
    res.json({
      success: true,
      data: settings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCompanySettings = async (req, res) => {
  const u = req.user;
  const canUpdate = u && Boolean(u.isAdmin || u.systemRole === 'admin' || u.isSuperAdmin || u.permissions?.allAccess);
  if (!canUpdate) {
    return res.status(403).json({ success: false, message: 'Access denied: Only Administrators can modify company settings.' });
  }

  try {
    const data = req.body;
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = new CompanySettings(data);
    } else {
      Object.assign(settings, data);
    }
    await settings.save();
    res.json({
      success: true,
      data: settings,
      message: 'Company settings updated successfully in database'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

