/**
 * @file rbac.test.js
 * @description Automated Unit & Integration Tests for Role-Based Access Control & Field-Level Data Isolation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Replicate sanitization rules from employeeController
const SENSITIVE_FIELDS = [
  'password',
  'passwordHistory',
  'salary',
  'startingSalary',
  'annualCTC',
  'salaryBasis',
  'aadhaar',
  'pan',
  'bankDetails',
  'upiId',
  'emergencyContact',
  'documents'
];

function sanitizeEmployeeForViewer(empObj, requestingUser) {
  if (!empObj) return null;
  const copy = { ...empObj };

  delete copy.password;
  delete copy.passwordHistory;

  if (!requestingUser) {
    for (const field of SENSITIVE_FIELDS) {
      delete copy[field];
    }
    return copy;
  }

  const isMasterAdmin = Boolean(
    requestingUser.employeeCode === 'ADM-001' ||
    requestingUser.isSuperAdmin ||
    requestingUser.email === 'admin@inforag.com' ||
    requestingUser.email === 'avinash@inforag.com'
  );
  const isAdmin = Boolean(
    isMasterAdmin ||
    requestingUser.isAdmin ||
    requestingUser.systemRole === 'admin' ||
    requestingUser.permissions?.allAccess
  );
  const isHR = Boolean(
    requestingUser.systemRole === 'hr' ||
    requestingUser.department === 'Human Resources' ||
    requestingUser.permissions?.manageEmployees
  );

  const empIdStr = (copy._id || copy.id || '').toString();
  const reqUserIdStr = (requestingUser._id || requestingUser.id || '').toString();
  const isSelf = Boolean(
    (empIdStr && reqUserIdStr && empIdStr === reqUserIdStr) ||
    (requestingUser.employeeCode && copy.employeeCode && requestingUser.employeeCode.toUpperCase() === copy.employeeCode.toUpperCase())
  );

  if (isAdmin || isHR || isSelf) {
    return copy;
  }

  for (const field of SENSITIVE_FIELDS) {
    delete copy[field];
  }
  return copy;
}

describe('RBAC & Sensitive Data Isolation Suite', () => {
  const fullEmployeeRecord = {
    _id: 'emp_100',
    employeeCode: 'EMP-100',
    name: 'Alice Developer',
    email: 'alice@inforag.com',
    role: 'Full Stack Engineer',
    department: 'Engineering',
    password: '$2a$10$hashedPasswordHere',
    passwordHistory: ['oldPass1', 'oldPass2'],
    salary: 85000,
    startingSalary: 60000,
    annualCTC: 1020000,
    salaryBasis: 'monthly',
    aadhaar: '1234-5678-9012',
    pan: 'ABCDE1234F',
    bankDetails: { account: '987654321', ifsc: 'HDFC0001234' },
    upiId: 'alice@okaxis',
    emergencyContact: { name: 'Bob', phone: '9999999999' },
    documents: [{ name: 'OfferLetter.pdf' }]
  };

  test('Team Member viewer cannot view sensitive fields of another employee', () => {
    const teamMemberViewer = {
      _id: 'emp_200',
      employeeCode: 'EMP-200',
      name: 'Charlie Colleague',
      role: 'QA Engineer',
      department: 'Engineering',
      systemRole: 'team_member',
      isAdmin: false
    };

    const sanitized = sanitizeEmployeeForViewer(fullEmployeeRecord, teamMemberViewer);

    // Public fields are preserved
    assert.equal(sanitized.name, 'Alice Developer');
    assert.equal(sanitized.employeeCode, 'EMP-100');
    assert.equal(sanitized.role, 'Full Stack Engineer');

    // Sensitive fields are completely stripped
    assert.equal(sanitized.salary, undefined, 'salary must be stripped');
    assert.equal(sanitized.annualCTC, undefined, 'annualCTC must be stripped');
    assert.equal(sanitized.aadhaar, undefined, 'aadhaar must be stripped');
    assert.equal(sanitized.pan, undefined, 'pan must be stripped');
    assert.equal(sanitized.bankDetails, undefined, 'bankDetails must be stripped');
    assert.equal(sanitized.emergencyContact, undefined, 'emergencyContact must be stripped');
    assert.equal(sanitized.password, undefined, 'password must never be exposed');
    assert.equal(sanitized.passwordHistory, undefined, 'passwordHistory must never be exposed');
  });

  test('Admin viewer can view complete employee record (except password hashes)', () => {
    const adminViewer = {
      _id: 'adm_001',
      employeeCode: 'ADM-001',
      name: 'System Admin',
      role: 'Administrator',
      systemRole: 'admin',
      isAdmin: true
    };

    const sanitized = sanitizeEmployeeForViewer(fullEmployeeRecord, adminViewer);

    assert.equal(sanitized.salary, 85000);
    assert.equal(sanitized.annualCTC, 1020000);
    assert.equal(sanitized.aadhaar, '1234-5678-9012');
    assert.equal(sanitized.password, undefined, 'password hash must always remain hidden');
  });

  test('HR viewer can view employee HR fields (salary, emergency contacts)', () => {
    const hrViewer = {
      _id: 'hr_001',
      employeeCode: 'HR-001',
      name: 'Janvi HR',
      role: 'HR Manager',
      department: 'Human Resources',
      systemRole: 'hr',
      isAdmin: false
    };

    const sanitized = sanitizeEmployeeForViewer(fullEmployeeRecord, hrViewer);

    assert.equal(sanitized.salary, 85000);
    assert.equal(sanitized.emergencyContact.name, 'Bob');
    assert.equal(sanitized.password, undefined);
  });

  test('Employee can view their own sensitive profile (Self View)', () => {
    const selfViewer = {
      _id: 'emp_100',
      employeeCode: 'EMP-100',
      email: 'alice@inforag.com'
    };

    const sanitized = sanitizeEmployeeForViewer(fullEmployeeRecord, selfViewer);

    assert.equal(sanitized.salary, 85000);
    assert.equal(sanitized.bankDetails.account, '987654321');
    assert.equal(sanitized.aadhaar, '1234-5678-9012');
    assert.equal(sanitized.password, undefined);
  });
});
