const Employee = require('../models/Employee');
const asyncHandler = require('../../../shared/middleware/asyncHandler');

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

  const employees = await Employee.find(query).sort({ createdAt: 1 });

  res.json({
    success: true,
    count: employees.length,
    data: employees
  });
});

// ─── GET /api/employees/current ───────────────────────────────────────────────
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await Employee.findOne({ isCurrentUser: true });
  if (!user) {
    return res.status(404).json({ success: false, message: 'No current user found' });
  }
  res.json({ success: true, data: user });
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }
  res.json({ success: true, data: employee });
});

// ─── POST /api/employees ──────────────────────────────────────────────────────
const createEmployee = asyncHandler(async (req, res) => {
  const { employeeCode, email } = req.body;
  if (employeeCode) {
    const existingCode = await Employee.findOne({ employeeCode: employeeCode.trim().toUpperCase() });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `Employee ID "${employeeCode}" is already assigned to ${existingCode.name}`
      });
    }
  }

  if (email) {
    const existingEmail = await Employee.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: `Email address "${email}" is already registered with ${existingEmail.name}`
      });
    }
  }

  const employee = new Employee({
    ...req.body,
    employeeCode: req.body.employeeCode ? req.body.employeeCode.trim().toUpperCase() : undefined,
    email: req.body.email ? req.body.email.trim().toLowerCase() : undefined
  });
  await employee.save();
  res.status(201).json({ success: true, data: employee });
});

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }
  res.json({ success: true, data: employee });
});

// ─── DELETE /api/employees/:id ───────────────────────────────────────────────
const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }
  res.json({ success: true, message: 'Employee removed', data: {} });
});

module.exports = {
  getEmployees,
  getCurrentUser,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
};

