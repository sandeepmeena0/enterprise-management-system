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
  const u = req.user;
  const canSwitch = u && Boolean(u.isAdmin || u.systemRole === 'admin' || u.isSuperAdmin || u.permissions?.allAccess);
  if (!canSwitch) {
    return res.status(403).json({ success: false, message: 'Access denied: Only Administrators can switch user perspective.' });
  }

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

  // If creator is not Admin, prevent privilege escalation
  const isCallerAdmin = u && Boolean(u.isAdmin || u.systemRole === 'admin' || u.isSuperAdmin || u.permissions?.allAccess);
  if (!isCallerAdmin) {
    payload.isAdmin = false;
    payload.isDelegatedAdmin = false;
    payload.isSuperAdmin = false;
    payload.systemRole = payload.systemRole === 'admin' ? 'team_member' : (payload.systemRole || 'team_member');
    if (payload.permissions) {
      delete payload.permissions.allAccess;
      delete payload.permissions.isDelegatedAdmin;
    }
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
  const u = req.user;
  if (!u) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // Requirement D: Reject password / passwordHistory on general employee update endpoint
  if (req.body.password !== undefined || req.body.passwordHistory !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'Password modification is not permitted through this endpoint. Please use /api/auth/change-password for self-service or /api/auth/admin-reset-password for administrative reset.'
    });
  }

  const { id } = req.params;
  const cleanId = String(id).trim();

  // Multi-key query: id as ObjectId, id as employeeCode, or id as email
  const orConditions = [];
  if (mongoose.Types.ObjectId.isValid(id)) {
    orConditions.push({ _id: id });
  }
  orConditions.push({ employeeCode: cleanId.toUpperCase() });
  orConditions.push({ employeeCode: cleanId.toUpperCase().replace(/_/g, '-') });
  orConditions.push({ employeeCode: cleanId.toUpperCase().replace(/-/g, '_') });
  orConditions.push({ email: cleanId.toLowerCase() });

  const existingEmployee = await Employee.findOne({ $or: orConditions });
  if (!existingEmployee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  const empIdStr = existingEmployee._id.toString();
  const isTargetMasterAdmin = Boolean(
    existingEmployee.employeeCode === 'ADM-001' ||
    existingEmployee.isSuperAdmin ||
    existingEmployee.email === 'admin@inforag.com' ||
    existingEmployee.email === 'avinash@inforag.com'
  );
  const isCallerMasterAdmin = Boolean(
    u.employeeCode === 'ADM-001' ||
    u.isSuperAdmin ||
    u.email === 'admin@inforag.com' ||
    u.email === 'avinash@inforag.com'
  );
  const isCallerAdmin = Boolean(
    isCallerMasterAdmin ||
    u.isAdmin ||
    u.systemRole === 'admin' ||
    u.permissions?.allAccess
  );
  const isCallerHR = Boolean(
    !isCallerAdmin &&
    (u.systemRole === 'hr' || u.department === 'Human Resources' || u.permissions?.manageEmployees)
  );
  const isSelf = Boolean(
    String(u._id) === empIdStr ||
    String(u.id) === empIdStr ||
    (u.employeeCode && existingEmployee.employeeCode && u.employeeCode.toUpperCase() === existingEmployee.employeeCode.toUpperCase())
  );

  // Access Authorization Matrix
  if (!isCallerAdmin && !isCallerHR && !isSelf) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You are not authorized to modify another employee profile.'
    });
  }

  if (isTargetMasterAdmin && !isCallerMasterAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Security Policy: Master Administrator account cannot be modified by other users.'
    });
  }

  // Construct Explicit Allowlisted Update Fields
  const updateFields = {};
  let shouldRevokeTokens = false;
  let shouldDisconnectSockets = false;
  let permissionChanged = false;

  const b = req.body;

  if (isSelf && !isCallerAdmin && !isCallerHR) {
    // ── Self-Profile Update (Strict non-privileged fields only) ──
    if (b.phone !== undefined) updateFields.phone = String(b.phone).trim();
    if (b.phoneNumber !== undefined) updateFields.phoneNumber = String(b.phoneNumber).trim();
    if (b.emergencyContact !== undefined) updateFields.emergencyContact = b.emergencyContact;
    if (b.address !== undefined) updateFields.address = b.address;
    if (b.avatar !== undefined) updateFields.avatar = b.avatar;
    if (b.dob !== undefined) updateFields.dob = b.dob;
    if (b.skills !== undefined) updateFields.skills = b.skills;
    if (b.bio !== undefined) updateFields.bio = b.bio;
  } else if (isCallerHR) {
    // ── HR modifying employee ──
    if (b.name !== undefined) updateFields.name = String(b.name).trim();
    if (b.phone !== undefined) updateFields.phone = String(b.phone).trim();
    if (b.phoneNumber !== undefined) updateFields.phoneNumber = String(b.phoneNumber).trim();
    if (b.emergencyContact !== undefined) updateFields.emergencyContact = b.emergencyContact;
    if (b.address !== undefined) updateFields.address = b.address;
    if (b.avatar !== undefined) updateFields.avatar = b.avatar;
    if (b.dob !== undefined) updateFields.dob = b.dob;
    if (b.department !== undefined) updateFields.department = String(b.department).trim();
    if (b.designation !== undefined) updateFields.designation = String(b.designation).trim();
    if (b.role !== undefined) updateFields.role = String(b.role).trim();
    if (b.skills !== undefined) updateFields.skills = b.skills;
    if (b.bio !== undefined) updateFields.bio = b.bio;
    if (b.joiningDate !== undefined) updateFields.joiningDate = b.joiningDate;
    if (b.leaveBalance !== undefined && typeof b.leaveBalance === 'object') updateFields.leaveBalance = b.leaveBalance;
    if (b.salary !== undefined) updateFields.salary = b.salary;
    if (b.workShift !== undefined) updateFields.workShift = b.workShift;

    // Status modification by HR
    if (b.status && b.status !== existingEmployee.status) {
      updateFields.status = b.status;
      if (b.status !== 'active') {
        shouldRevokeTokens = true;
        shouldDisconnectSockets = true;
      }
    }
  } else if (isCallerAdmin) {
    // ── Admin modifying employee ──
    const allowedKeys = [
      'name', 'phone', 'phoneNumber', 'emergencyContact', 'address', 'avatar',
      'dob', 'department', 'designation', 'role', 'skills', 'bio',
      'joiningDate', 'leaveBalance', 'salary', 'workShift', 'baseRole', 'notes'
    ];
    for (const key of allowedKeys) {
      if (b[key] !== undefined) updateFields[key] = b[key];
    }

    if (b.status && b.status !== existingEmployee.status) {
      updateFields.status = b.status;
      if (b.status !== 'active') {
        shouldRevokeTokens = true;
        shouldDisconnectSockets = true;
      }
    }

    // Role / SystemRole changes
    if (b.systemRole && b.systemRole !== existingEmployee.systemRole) {
      if (isTargetMasterAdmin) {
        updateFields.systemRole = 'admin';
        updateFields.isAdmin = true;
      } else {
        updateFields.systemRole = b.systemRole;
        updateFields.isAdmin = (b.systemRole === 'admin');
        permissionChanged = true;
        shouldDisconnectSockets = true;
      }
    }

    // Permissions changes
    if (b.permissions && typeof b.permissions === 'object') {
      updateFields.permissions = { ...b.permissions };
      permissionChanged = true;
      shouldDisconnectSockets = true;
    }

    // Delegated admin changes
    if (b.isDelegatedAdmin !== undefined && !isTargetMasterAdmin) {
      updateFields.isDelegatedAdmin = Boolean(b.isDelegatedAdmin);
      updateFields.delegationExpiresAt = b.delegationExpiresAt || null;
      if (b.isDelegatedAdmin) {
        updateFields.isAdmin = true;
        updateFields.systemRole = 'admin';
      }
      permissionChanged = true;
      shouldDisconnectSockets = true;
    }
  }

  // Version increments
  if (shouldRevokeTokens) {
    updateFields.tokenVersion = (existingEmployee.tokenVersion || 0) + 1;
  }
  if (permissionChanged) {
    updateFields.permissionVersion = (existingEmployee.permissionVersion || 0) + 1;
  }

  const employee = await Employee.findByIdAndUpdate(
    existingEmployee._id,
    { $set: updateFields },
    { new: true, runValidators: false }
  ).select('-password -passwordHistory');

  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  // Invalidate cache immediately
  invalidateUserAuthCache(empIdStr);
  if (existingEmployee.employeeCode) invalidateUserAuthCache(existingEmployee.employeeCode);
  if (existingEmployee.email) invalidateUserAuthCache(existingEmployee.email.toLowerCase());

  // Force disconnect sockets if security-sensitive changes occurred
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

  // Force disconnect all active sockets so employee leaves old role/permission rooms and reconnects with fresh server-side permissions
  disconnectUserSockets(empIdStr);

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

