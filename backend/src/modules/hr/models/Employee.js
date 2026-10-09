const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      required: [true, 'Employee code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Za-z0-9_-]+$/, 'Employee code must contain valid characters (e.g. EMP-001 or INF-001)']
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },
    avatar: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      required: [true, 'Role/designation is required'],
      trim: true
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: [
        'Marketing & Growth',
        'Product Design',
        'Engineering',
        'Human Resources',
        'Infrastructure',
        'Finance',
        'Sales',
        'Operations',
        'Management'
      ]
    },
    status: {
      type: String,
      enum: ['active', 'on_leave', 'resigned', 'inactive'],
      default: 'active'
    },
    joiningDate: {
      type: String,
      required: [true, 'Joining date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD']
    },
    isCurrentUser: {
      type: Boolean,
      default: false
    },
    leaveBalance: {
      casual: { type: Number, default: 12, min: 0 },
      sick: { type: Number, default: 12, min: 0 },
      earned: { type: Number, default: 15, min: 0 },
      maternity: { type: Number, default: 0, min: 0 }
    },
    salary: {
      basic: { type: Number, default: 45000 },
      hra: { type: Number, default: 18000 },
      allowances: { type: Number, default: 12000 },
      bonus: { type: Number, default: 0 },
      pf: { type: Number, default: 3600 },
      pt: { type: Number, default: 200 },
      tds: { type: Number, default: 2500 },
      revisionType: { type: String, enum: ['hike', 'decrease', 'initial'], default: 'initial' },
      lastRevisionDate: { type: String, default: '' },
      lastRevisionPercentage: { type: Number, default: 0 },
      lastRevisionAmount: { type: Number, default: 0 },
      reason: { type: String, default: '' },
      remarks: { type: String, default: '' }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual: Full display info
EmployeeSchema.virtual('displayName').get(function () {
  return `${this.name} (${this.employeeCode})`;
});

// Index for fast lookups
EmployeeSchema.index({ status: 1, department: 1 });
EmployeeSchema.index({ isCurrentUser: 1 });

module.exports = mongoose.model('Employee', EmployeeSchema);
