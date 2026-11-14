const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const asyncHandler = require('../../../shared/middleware/asyncHandler');
const { invalidateUserAuthCache } = require('../../../shared/cache/userAuthCache');
const { disconnectUserSockets } = require('../../../shared/socket/socketManager');
const { hashPassword } = require('../../../shared/utils/passwordUtils');

// ─── GET /api/employees ───────────────────────────────────────────────────────
const getEmployees = asyncHandler(async (req, res) => {
  const { status, department, search } = req.query;

  const query = {};
  if (status) query.status = status;
  if (department) query.department = department;
  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { role: new RegExp(search, 'i') },
      { employeeCode: new RegExp(search, 'i') }
    ];
  }

  const employees = await Employee.find(query).select('-password -passwordHistory').sort({ createdAt: 1 });

  res.json({
    success: true,
    count: employees.length,
    data: employees
  });
});

// ─── GET /api/employees/current ───────────────────────────────────────────────
const getCurrentUser = asyncHandler(async (req, res) => {
  let user = null;
  if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
    user = await Employee.findById(req.user._id).select('-password -passwordHistory');
  }
  if (!user && req.user?.employeeCode) {
    user = await Employee.findOne({ employeeCode: req.user.employeeCode }).select('-password -passwordHistory');
  }
  if (!user) {
    user = await Employee.findOne({ isCurrentUser: true }).select('-password -passwordHistory');
  }
  if (!user) {
    user = (await Employee.findOne({ employeeCode: 'ADM-001' }).select('-password -passwordHistory')) ||
           (await Employee.findOne({ isAdmin: true }).select('-password -passwordHistory')) ||
           (await Employee.findOne().select('-password -passwordHistory'));
    if (user) {
      user.isCurrentUser = true;
      await user.save();
    }
  }
  if (!user) {
    return res.status(404).json({ success: false, message: 'No current user found in database' });
  }
  res.json({ success: true, data: user });
});

// ─── POST /api/employees/switch/:id ──────────────────────────────────────────
const switchCurrentUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let target = null;
  if (id === 'admin') {
    target = await Employee.findOne({ $or: [{ employeeCode: 'ADM-001' }, { role: 'Administrator' }, { isAdmin: true }] }).select('-password -passwordHistory');
  } else if (id === 'hr') {
    target = await Employee.findOne({ $or: [{ employeeCode: 'HR-001' }, { department: 'Human Resources' }] }).select('-password -passwordHistory');
  } else if (id === 'employee' || id === 'team_member') {
    target = await Employee.findOne({ $or: [{ employeeCode: 'ENG-001' }, { department: 'Engineering' }] }).select('-password -passwordHistory');
  } else if (mongoose.Types.ObjectId.isValid(id)) {
    target = await Employee.findById(id).select('-password -passwordHistory');
  } else {
    target = await Employee.findOne({ employeeCode: id.toUpperCase() }).select('-password -passwordHistory');
  }

  if (!target) {
    return res.status(404).json({ success: false, message: `Target employee "${id}" not found in database` });
  }

  await Employee.updateMany({}, { isCurrentUser: false });
  target.isCurrentUser = true;
  await target.save();

  res.json({ success: true, data: target });
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
const getEmployeeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { $or: [{ employeeCode: id.trim().toUpperCase() }, { email: id.trim().toLowerCase() }] };

  const employee = await Employee.findOne(query).select('-password -passwordHistory');
  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }
  res.json({ success: true, data: employee });
});

// ─── POST /api/employees ──────────────────────────────────────────────────────
const createEmployee = asyncHandler(async (req, res) => {
  const u = req.user;
  if (u) {
    const canCreate = u.isAdmin || u.systemRole === 'admin' || u.systemRole === 'hr' || u.isDelegatedAdmin || u.permissions?.manageEmployees || u.permissions?.allAccess;
    if (!canCreate) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to add employees.' });
    }
  }

  const { employeeCode, email } = req.body;
  const cleanCode = employeeCode ? employeeCode.trim().toUpperCase() : undefined;
  const cleanEmail = email ? email.trim().toLowerCase() : undefined;

  if (cleanCode) {
    const existingCode = await Employee.findOne({ employeeCode: cleanCode });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `Employee ID "${cleanCode}" is already assigned to ${existingCode.name}`
      });
    }
  }

  if (cleanEmail) {
    const existingEmail = await Employee.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: `Email address "${cleanEmail}" is already registered with ${existingEmail.name}`
      });
    }
  }

  // Strip non-ObjectId _id if provided by client to avoid Mongo CastError
  const payload = { ...req.body };
  if (payload._id && !mongoose.Types.ObjectId.isValid(payload._id)) {
    delete payload._id;
  }

  // Cryptographically hash newly created employee password with bcrypt
  const rawPass = (payload.password || 'emp123').trim();
  payload.password = await hashPassword(rawPass);
  payload.passwordHistory = [];
  payload.passwordUpdatedAt = new Date().toISOString();
  payload.tokenVersion = 0;
  payload.permissionVersion = 0;

  const employee = new Employee({
    ...payload,
    employeeCode: cleanCode,
    email: cleanEmail
  });
  await employee.save();

  const sanitized = employee.toObject();
  delete sanitized.password;
  delete sanitized.passwordHistory;
  res.status(201).json({ success: true, data: sanitized });
});

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────
const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = { ...req.body };
  delete payload._id; // Prevent modifying immutable _id

  // Multi-key query: id as ObjectId, id as employeeCode (with hyphen/underscore conversion), id as email, or payload identifiers
  const orConditions = [];
  if (mongoose.Types.ObjectId.isValid(id)) {
    orConditions.push({ _id: id });
  }
  const cleanId = String(id).trim();
  orConditions.push({ employeeCode: cleanId.toUpperCase() });
  orConditions.push({ employeeCode: cleanId.toUpperCase().replace(/_/g, '-') });
  orConditions.push({ employeeCode: cleanId.toUpperCase().replace(/-/g, '_') });
  orConditions.push({ email: cleanId.toLowerCase() });

  if (payload.employeeCode) {
    const cleanCode = String(payload.employeeCode).trim().toUpperCase();
    orConditions.push({ employeeCode: cleanCode });
    orConditions.push({ employeeCode: cleanCode.replace(/_/g, '-') });
    orConditions.push({ employeeCode: cleanCode.replace(/-/g, '_') });
  }
  if (payload.email) {
    orConditions.push({ email: String(payload.email).trim().toLowerCase() });
  }

  // Explicitly ensure permissions object and delegation flags are preserved
  if (payload.permissions !== undefined) {
    payload.permissions = typeof payload.permissions === 'object' ? payload.permissions : {};
  }
  if (payload.isDelegatedAdmin !== undefined) {
    payload.isDelegatedAdmin = Boolean(payload.isDelegatedAdmin);
  }
  if (payload.delegationExpiresAt !== undefined) {
    payload.delegationExpiresAt = payload.delegationExpiresAt || null;
  }

  const existingEmployee = await Employee.findOne({ $or: orConditions });
  if (!existingEmployee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  const isPrimaryEmp = Boolean(
    existingEmployee.employeeCode === 'ADM-001' ||
    existingEmployee.isSuperAdmin ||
    existingEmployee.email === 'admin@inforag.com' ||
    existingEmployee.email === 'avinash@inforag.com'
  );

  const getBaseRoleHelper = (roleStr, deptStr) => {
    const r = (roleStr || '').toLowerCase();
    const d = (deptStr || '').toLowerCase();
    if (r.includes('hr') || r.includes('human resource') || d.includes('human resource')) return 'hr';
    if (r.includes('lead') || r.includes('manager') || r.includes('scrum master')) return 'team_leader';
    return 'team_member';
  };

  let shouldRevokeTokens = false;
  let shouldDisconnectSockets = false;
  let permissionChanged = false;

  // Protect primary admin from losing admin rights
  if (isPrimaryEmp) {
    payload.isAdmin = true;
    payload.systemRole = 'admin';
  } else if (payload.isDelegatedAdmin === false || (payload.permissions && !payload.permissions.allAccess && !payload.isDelegatedAdmin)) {
    // Clean revocation: non-primary employee must lose admin privileges
    payload.isAdmin = false;
    payload.isDelegatedAdmin = false;
    payload.delegationExpiresAt = null;
    if (payload.permissions) {
      delete payload.permissions.allAccess;
      delete payload.permissions.isDelegatedAdmin;
      delete payload.permissions.delegationExpiresAt;
    }
    const baselineRole = existingEmployee.baseRole || getBaseRoleHelper(payload.role || existingEmployee.role, payload.department || existingEmployee.department);
    if (!payload.systemRole || payload.systemRole === 'admin') {
      payload.systemRole = (existingEmployee.systemRole && existingEmployee.systemRole !== 'admin') ? existingEmployee.systemRole : baselineRole;
    }
    permissionChanged = true;
    if (existingEmployee.isAdmin) {
      shouldDisconnectSockets = true;
    }
  }

  // Account Status Modification (Deactivation / Reactivation)
  if (payload.status && payload.status !== existingEmployee.status) {
    if (payload.status !== 'active') {
      shouldRevokeTokens = true;
      shouldDisconnectSockets = true;
    }
  }

  // Role / Permission change detection
  if (payload.systemRole && payload.systemRole !== existingEmployee.systemRole) {
    permissionChanged = true;
  }
  if (payload.permissions && typeof payload.permissions === 'object') {
    permissionChanged = true;
  }

  // Password Modification (Cryptographically hash and never store plaintext)
  if (payload.password && typeof payload.password === 'string' && payload.password.trim() && payload.password !== '••••••••') {
    const rawPass = payload.password.trim();
    payload.password = await hashPassword(rawPass);
    payload.passwordUpdatedAt = new Date().toISOString();

    const historyEntry = {
      changedAt: new Date().toISOString(),
      changedBy: req.user?.name || req.user?.email || 'User'
    };
    const prevHistory = Array.isArray(existingEmployee.passwordHistory)
      ? existingEmployee.passwordHistory
      : [];
    payload.passwordHistory = [historyEntry, ...prevHistory].slice(0, 10);

    // Password change revokes existing active sessions across all devices
    shouldRevokeTokens = true;
    shouldDisconnectSockets = true;
  } else {
    delete payload.password;
    if (payload.passwordHistory === undefined && Array.isArray(existingEmployee.passwordHistory)) {
      payload.passwordHistory = existingEmployee.passwordHistory;
    }
  }

  // Increment versions when security metadata changes
  if (shouldRevokeTokens) {
    payload.tokenVersion = (existingEmployee.tokenVersion || 0) + 1;
  }
  if (permissionChanged) {
    payload.permissionVersion = (existingEmployee.permissionVersion || 0) + 1;
  }

  const employee = await Employee.findByIdAndUpdate(
    existingEmployee._id,
    { $set: payload },
    { new: true, runValidators: false }
  ).select('-password -passwordHistory');

  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  // Invalidate cache immediately after database update succeeds
  const empIdStr = existingEmployee._id.toString();
  invalidateUserAuthCache(empIdStr);
  if (existingEmployee.employeeCode) invalidateUserAuthCache(existingEmployee.employeeCode);
  if (existingEmployee.email) invalidateUserAuthCache(existingEmployee.email.toLowerCase());

  // Force disconnect sockets if account deactivated or password changed
  if (shouldDisconnectSockets) {
    disconnectUserSockets(empIdStr);
  }

  res.json({ success: true, data: employee });
});

// ─── PUT /api/employees/:id/permissions ─────────────────────────────────────
const updateEmployeePermissions = asyncHandler(async (req, res) => {
  const u = req.user;
  if (u) {
    const canGrant = u.isAdmin || u.systemRole === 'admin' || u.isDelegatedAdmin || u.permissions?.grantPermissions || u.permissions?.allAccess;
    if (!canGrant) {
      return res.status(403).json({ success: false, message: 'Access denied: Only Administrators can modify employee permissions.' });
    }
  }

  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { $or: [{ employeeCode: id.trim().toUpperCase() }, { email: id.trim().toLowerCase() }] };

  const { permissions, isDelegatedAdmin, delegationExpiresAt, systemRole } = req.body;

  const existing = await Employee.findOne(query);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  const isPrimary = Boolean(
    existing.employeeCode === 'ADM-001' ||
    existing.isSuperAdmin ||
    existing.email === 'admin@inforag.com' ||
    existing.email === 'avinash@inforag.com'
  );

  const getBaseRole = (roleStr, deptStr) => {
    const r = (roleStr || '').toLowerCase();
    const d = (deptStr || '').toLowerCase();
    if (r.includes('hr') || r.includes('human resource') || d.includes('human resource')) return 'hr';
    if (r.includes('lead') || r.includes('manager') || r.includes('scrum master')) return 'team_leader';
    return 'team_member';
  };

  const updateFields = {};
  if (permissions !== undefined) {
    updateFields.permissions = typeof permissions === 'object' ? { ...permissions } : {};
  }

  const isDelegated = Boolean(isDelegatedAdmin || permissions?.allAccess);

  if (isPrimary) {
    updateFields.isAdmin = true;
    updateFields.systemRole = 'admin';
    updateFields.isDelegatedAdmin = false;
  } else {
    updateFields.isDelegatedAdmin = isDelegated;
    updateFields.isAdmin = isDelegated;
    updateFields.delegationExpiresAt = isDelegated ? (delegationExpiresAt || null) : null;

    if (!isDelegated) {
      if (updateFields.permissions) {
        delete updateFields.permissions.allAccess;
        delete updateFields.permissions.isDelegatedAdmin;
        delete updateFields.permissions.delegationExpiresAt;
      }
      const baselineRole = existing.baseRole || getBaseRole(existing.role, existing.department);
      if (systemRole && systemRole !== 'admin') {
        updateFields.systemRole = systemRole;
      } else if (existing.systemRole && existing.systemRole !== 'admin') {
        updateFields.systemRole = existing.systemRole;
      } else {
        updateFields.systemRole = baselineRole;
      }
    } else {
      updateFields.systemRole = 'admin';
    }
  }

  // Increment permissionVersion on every permission update
  updateFields.permissionVersion = (existing.permissionVersion || 0) + 1;

  const employee = await Employee.findByIdAndUpdate(
    existing._id,
    { $set: updateFields },
    { new: true, runValidators: false }
  ).select('-password -passwordHistory');

  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  // Invalidate cache immediately after database update succeeds
  const empIdStr = existing._id.toString();
  invalidateUserAuthCache(empIdStr);
  if (existing.employeeCode) invalidateUserAuthCache(existing.employeeCode);
  if (existing.email) invalidateUserAuthCache(existing.email.toLowerCase());

  // If administrative access was revoked, disconnect sockets so user leaves privileged admin rooms
  if (!isDelegated && existing.isAdmin && !isPrimary) {
    disconnectUserSockets(empIdStr);
  }

  res.json({
    success: true,
    message: 'Permissions updated successfully in database',
    data: employee
  });
});

// ─── DELETE /api/employees/:id ───────────────────────────────────────────────
const deleteEmployee = asyncHandler(async (req, res) => {
  const u = req.user;
  if (u) {
    const canDelete = u.isAdmin || u.systemRole === 'admin' || u.isDelegatedAdmin || u.permissions?.deleteEmployees || u.permissions?.allAccess;
    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'Access denied: Only Administrators can delete employees.' });
    }
  }

  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { $or: [{ employeeCode: id.trim().toUpperCase() }, { email: id.trim().toLowerCase() }] };

  const employee = await Employee.findOne(query);
  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  // Security Policy: Never allow deletion of any Administrator account
  const isTargetAdmin = employee.isAdmin === true ||
                        employee.isSuperAdmin === true ||
                        String(employee.systemRole || '').toLowerCase() === 'admin' ||
                        String(employee.role || '').toLowerCase() === 'admin' ||
                        String(employee.role || '').toLowerCase().includes('administrator') ||
                        String(employee.employeeCode || '').toUpperCase() === 'ADM-001' ||
                        String(employee.email || '').toLowerCase() === 'avinash@inforag.com';

  if (isTargetAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Security Protection: Administrator accounts are permanently protected and cannot be deleted.'
    });
  }

  // Prevent deleting your own active account if user is attached to request
  if (req.user && String(req.user._id) === String(employee._id)) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete your own active administrator account.'
    });
  }

  await Employee.deleteOne({ _id: employee._id });

  // Invalidate auth cache & force disconnect all sockets immediately
  const empIdStr = employee._id.toString();
  invalidateUserAuthCache(empIdStr);
  if (employee.employeeCode) invalidateUserAuthCache(employee.employeeCode);
  if (employee.email) invalidateUserAuthCache(employee.email.toLowerCase());
  disconnectUserSockets(empIdStr);

  res.json({ success: true, message: 'Employee removed', data: {} });
});

module.exports = {
  getEmployees,
  getCurrentUser,
  switchCurrentUser,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeePermissions,
  deleteEmployee
};

