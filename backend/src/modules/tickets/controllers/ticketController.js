const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const asyncHandler = require('../../../shared/middleware/asyncHandler');

// ─── Security Helpers ─────────────────────────────────────────────────────────

function isUserAdmin(u) {
  if (!u) return false;
  return Boolean(
    u.employeeCode === 'ADM-001' ||
    u.isSuperAdmin ||
    u.isAdmin ||
    u.systemRole === 'admin' ||
    u.permissions?.allAccess ||
    u.permissions?.manageTickets
  );
}

function isUserHR(u) {
  if (!u) return false;
  return Boolean(
    u.systemRole === 'hr' ||
    u.department === 'Human Resources' ||
    (u.role && u.role.toLowerCase().includes('hr'))
  );
}

function isPasswordResetTicket(ticket) {
  if (!ticket) return false;
  const cat = String(ticket.category || '').toLowerCase();
  const subj = String(ticket.subject || '').toLowerCase();
  return cat === 'account access' || subj.includes('password reset request');
}

function canUserAccessTicket(u, ticket) {
  if (!u || !ticket) return false;
  const isAdmin = isUserAdmin(u);
  const isReset = isPasswordResetTicket(ticket);

  // Password reset tickets are strictly Admin-only
  if (isReset) {
    return isAdmin;
  }

  if (isAdmin) return true;

  const uId = String(u._id || u.id || '');
  const uCode = String(u.employeeCode || '').toUpperCase();
  const uEmail = String(u.email || '').toLowerCase();

  const reqId = String(ticket.requestedById || ticket.createdBy || '');
  const reqEmail = String(ticket.requestedByEmail || '').toLowerCase();
  const assId = String(ticket.assignedToId || ticket.assignedTo || '');

  const isRequester = (uId && reqId === uId) || (uCode && reqId.toUpperCase() === uCode) || (uEmail && reqEmail === uEmail);
  const isAssignee = (uId && assId === uId) || (uCode && assId.toUpperCase() === uCode);

  if (isRequester || isAssignee) return true;

  // HR can view non-reset tickets in HR department or general support
  if (isUserHR(u)) {
    const dept = String(ticket.department || '').toLowerCase();
    const cat = String(ticket.category || '').toLowerCase();
    if (dept.includes('hr') || dept.includes('human resource') || cat.includes('hr')) {
      return true;
    }
  }

  return false;
}

// @desc    Get all tickets with role-based scoping and tenant isolation
// @route   GET /api/tickets
exports.getTickets = asyncHandler(async (req, res) => {
  const u = req.user;
  const { status, priority, department, category } = req.query;
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (priority && priority !== 'all') filter.priority = priority;
  if (department && department !== 'all') filter.department = department;
  if (category && category !== 'all') filter.category = category;

  const isAdmin = isUserAdmin(u);
  const isHR = isUserHR(u);

  if (!isAdmin && u) {
    const uId = String(u._id || u.id || '');
    const uCode = String(u.employeeCode || '').toUpperCase();
    const uEmail = String(u.email || '').toLowerCase();

    const userMatchConditions = [
      { requestedById: uId },
      { requestedById: uCode },
      { createdBy: uId },
      { createdBy: uCode },
      { requestedByEmail: uEmail },
      { assignedToId: uId },
      { assignedToId: uCode },
      { assignedTo: uCode },
      { assignedTo: uId }
    ];

    if (isHR) {
      userMatchConditions.push(
        { department: { $regex: /human resource|hr/i } },
        { category: { $regex: /human resource|hr/i } }
      );
    }

    // Strictly exclude password reset tickets for all non-admin users
    const nonAdminFilter = {
      $and: [
        { $or: userMatchConditions },
        { category: { $ne: 'Account Access' } },
        { subject: { $not: /Password Reset Request/i } }
      ]
    };

    if (filter.$and) {
      filter.$and.push(nonAdminFilter);
    } else {
      filter.$and = [nonAdminFilter];
    }
  }

  const rawTickets = await Ticket.find(filter).sort({ createdAt: -1 });

  const tickets = rawTickets.map(t => {
    const doc = t.toObject ? t.toObject() : t;
    return {
      ...doc,
      _id: doc._id ? String(doc._id) : `tkt_${Date.now()}`,
      requestedById: doc.requestedById || doc.createdBy || '',
      requestedByName: doc.requestedByName || doc.createdByName || 'Employee',
      requestedByAvatar: doc.requestedByAvatar || doc.createdByAvatar || '',
      requestedByRole: doc.requestedByRole || doc.createdByRole || 'Team Member',
      category: doc.category || doc.department || 'General Support',
      assignedToId: doc.assignedToId || doc.assignedTo || '',
      assignedToName: doc.assignedToName || 'Unassigned',
      replies: doc.replies || [],
      internalNotes: isAdmin ? (doc.internalNotes || []) : []
    };
  });

  res.json({ success: true, count: tickets.length, data: tickets });
});

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
exports.getTicketById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { ticketCode: id };

  const ticket = await Ticket.findOne(query);
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  const u = req.user;
  if (!canUserAccessTicket(u, ticket)) {
    return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to view this ticket.' });
  }

  const doc = ticket.toObject ? ticket.toObject() : ticket;
  const sanitized = {
    ...doc,
    _id: String(doc._id),
    internalNotes: isUserAdmin(u) ? (doc.internalNotes || []) : []
  };

  res.json({ success: true, data: sanitized });
});

// @desc    Create a ticket
// @route   POST /api/tickets
exports.createTicket = asyncHandler(async (req, res) => {
  const count = await Ticket.countDocuments();
  const ticketCode = req.body.ticketCode || `TKT-${100 + count + 1}`;
  const ticketData = { ...req.body };
  if (ticketData._id && !mongoose.Types.ObjectId.isValid(ticketData._id)) {
    delete ticketData._id;
  }
  ticketData.ticketCode = ticketCode;

  // Harmonize requester & creator fields from authenticated session
  const u = req.user;
  ticketData.requestedById = u?._id ? String(u._id) : (ticketData.requestedById || u?.employeeCode || '');
  ticketData.requestedByName = u?.name || ticketData.requestedByName || 'Employee';
  ticketData.requestedByRole = u?.role || ticketData.requestedByRole || 'Team Member';
  ticketData.requestedByAvatar = u?.avatar || ticketData.requestedByAvatar || '';
  ticketData.requestedByEmail = u?.email || ticketData.requestedByEmail || '';
  ticketData.createdBy = ticketData.requestedById;
  ticketData.createdByName = ticketData.requestedByName;
  ticketData.createdByRole = ticketData.requestedByRole;
  ticketData.createdByAvatar = ticketData.requestedByAvatar;
  ticketData.category = ticketData.category || ticketData.department || 'General Support';
  ticketData.requestedOn = ticketData.requestedOn || new Date().toISOString().split('T')[0];
  if (!ticketData.description) {
    ticketData.description = 'Support ticket raised.';
  }

  const ticket = await Ticket.create(ticketData);
  res.status(201).json({ success: true, data: ticket });
});

// @desc    Update a ticket
// @route   PUT /api/tickets/:id
exports.updateTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { ticketCode: id };

  const ticket = await Ticket.findOne(query);
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  const u = req.user;
  if (!canUserAccessTicket(u, ticket)) {
    return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to modify this ticket.' });
  }

  const isAdmin = isUserAdmin(u);
  const isReset = isPasswordResetTicket(ticket);

  if (isReset && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Security Policy: Password reset tickets can only be resolved by Administrators.' });
  }

  const updateData = { ...req.body };
  delete updateData._id;
  delete updateData.ticketCode; // Prevent modifying immutable ticketCode

  // Non-admins can only update non-privileged fields (e.g. description, closing own ticket)
  if (!isAdmin) {
    delete updateData.assignedTo;
    delete updateData.assignedToId;
    delete updateData.assignedToName;
    delete updateData.internalNotes;
    delete updateData.priority;
    delete updateData.category;
  }

  Object.assign(ticket, updateData);
  await ticket.save();

  res.json({ success: true, data: ticket });
});

// @desc    Add comment / reply to ticket
// @route   POST /api/tickets/:id/comments
exports.addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { ticketCode: id };

  const ticket = await Ticket.findOne(query);
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  const u = req.user;
  if (!canUserAccessTicket(u, ticket)) {
    return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to comment on this ticket.' });
  }

  if (req.body.text) {
    ticket.comments = ticket.comments || [];
    ticket.comments.push({
      authorName: u?.name || req.body.authorName || 'Employee',
      authorAvatar: u?.avatar || req.body.authorAvatar || '',
      authorRole: u?.role || req.body.authorRole || 'Team Member',
      text: String(req.body.text).trim(),
      timestamp: new Date().toISOString()
    });
  }
  if (req.body.message || req.body.reply) {
    ticket.replies = ticket.replies || [];
    ticket.replies.push({
      id: req.body.id || `rep_${Date.now()}`,
      senderId: u?._id ? String(u._id) : (req.body.senderId || ''),
      senderName: u?.name || req.body.senderName || 'Employee',
      senderAvatar: u?.avatar || req.body.senderAvatar || '',
      message: String(req.body.message || req.body.reply || '').trim(),
      timestamp: new Date().toISOString(),
      isAdminReply: isUserAdmin(u)
    });
  }

  await ticket.save();
  res.json({ success: true, data: ticket });
});

// @desc    Delete a ticket
// @route   DELETE /api/tickets/:id
exports.deleteTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { ticketCode: id };

  const ticket = await Ticket.findOne(query);
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  const u = req.user;
  const isAdmin = isUserAdmin(u);
  const isReset = isPasswordResetTicket(ticket);

  if (isReset && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Security Policy: Password reset tickets can only be managed by Administrators.' });
  }

  const uId = String(u?._id || u?.id || '');
  const uCode = String(u?.employeeCode || '').toUpperCase();
  const reqId = String(ticket.requestedById || ticket.createdBy || '');
  const isCreator = (uId && reqId === uId) || (uCode && reqId.toUpperCase() === uCode);

  if (!isAdmin && !isCreator) {
    return res.status(403).json({ success: false, message: 'Access denied: You can only delete tickets created by you.' });
  }

  await Ticket.findByIdAndDelete(ticket._id);
  res.json({ success: true, message: 'Ticket removed successfully', data: { id: ticket._id, ticketCode: ticket.ticketCode } });
});
