const Expense = require('../models/Expense');
const asyncHandler = require('../../../shared/middleware/asyncHandler');

function isExpensePrivileged(u) {
  if (!u) return false;
  return Boolean(
    u.isAdmin ||
    u.systemRole === 'admin' ||
    u.systemRole === 'hr' ||
    (u.department || '').toLowerCase().includes('finance') ||
    u.permissions?.allAccess ||
    u.permissions?.manageExpenses
  );
}

// @desc    Get all expenses with role-based scoping
// @route   GET /api/expenses
exports.getExpenses = asyncHandler(async (req, res) => {
  const { status, category, employeeId } = req.query;
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (category && category !== 'all') filter.category = category;
  if (employeeId && employeeId !== 'all') filter.employeeId = employeeId;

  const u = req.user;
  if (!isExpensePrivileged(u) && u) {
    const uId = String(u._id || u.id || '');
    const uCode = String(u.employeeCode || '');
    const userScope = [
      { employeeId: uId },
      { employeeId: uCode },
      { createdBy: uId },
      { createdBy: uCode }
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: userScope }];
      delete filter.$or;
    } else {
      filter.$or = userScope;
    }
  }

  const expenses = await Expense.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: expenses.length, data: expenses });
});

// @desc    Create an expense
// @route   POST /api/expenses
exports.createExpense = asyncHandler(async (req, res) => {
  const count = await Expense.countDocuments();
  const expenseCode = req.body.expenseCode || `EXP-${100 + count + 1}`;
  const u = req.user;

  const expense = await Expense.create({
    ...req.body,
    expenseCode,
    employeeId: req.body.employeeId || u?._id?.toString() || u?.employeeCode || '',
    employeeName: req.body.employeeName || u?.name || 'Employee',
    createdBy: u?._id?.toString() || u?.employeeCode || ''
  });
  res.status(201).json({ success: true, data: expense });
});

// @desc    Update an expense
// @route   PUT /api/expenses/:id
exports.updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    return res.status(404).json({ success: false, message: 'Expense not found' });
  }

  const u = req.user;
  const isPrivileged = isExpensePrivileged(u);
  const uId = String(u?._id || u?.id || '');
  const uCode = String(u?.employeeCode || '');
  const isOwner = (uId && (expense.employeeId === uId || expense.createdBy === uId)) ||
                  (uCode && (expense.employeeId === uCode || expense.createdBy === uCode));

  if (!isPrivileged && !isOwner) {
    return res.status(403).json({ success: false, message: 'Access denied: You cannot modify this expense record.' });
  }

  // Non-privileged owners cannot approve/reject their own expenses
  const updateData = { ...req.body };
  delete updateData._id;
  delete updateData.expenseCode;

  if (!isPrivileged) {
    delete updateData.status; // Only Admin/Finance can change approval status
  }

  Object.assign(expense, updateData);
  await expense.save();

  res.json({ success: true, data: expense });
});

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
exports.deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    return res.status(404).json({ success: false, message: 'Expense not found' });
  }

  const u = req.user;
  const isPrivileged = isExpensePrivileged(u);
  const uId = String(u?._id || u?.id || '');
  const uCode = String(u?.employeeCode || '');
  const isOwner = (uId && (expense.employeeId === uId || expense.createdBy === uId)) ||
                  (uCode && (expense.employeeId === uCode || expense.createdBy === uCode));

  if (!isPrivileged && !isOwner) {
    return res.status(403).json({ success: false, message: 'Access denied: You cannot delete this expense record.' });
  }

  await Expense.findByIdAndDelete(expense._id);
  res.json({ success: true, message: 'Expense removed', data: {} });
});
