const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock Database
const dbPath = path.join(__dirname, 'database.json');
let database = {};
try {
  const data = fs.readFileSync(dbPath, 'utf8');
  database = JSON.parse(data);
} catch (err) {
  console.error("Error reading database.json", err);
}

// RBAC Configuration
const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  FINANCE_MANAGER: 'Finance Manager',
  SECURITY_OFFICER: 'Security Officer',
  LEAD_DEVELOPER: 'Lead Developer',
  HR_DIRECTOR: 'HR Director',
  INTERN: 'Intern'
};

// Access Control Matrix
const permissions = {
  '/api/home': [ROLES.SUPER_ADMIN, ROLES.FINANCE_MANAGER, ROLES.SECURITY_OFFICER, ROLES.LEAD_DEVELOPER, ROLES.HR_DIRECTOR, ROLES.INTERN],
  '/api/finance': [ROLES.SUPER_ADMIN, ROLES.FINANCE_MANAGER],
  '/api/code-repo': [ROLES.SUPER_ADMIN, ROLES.LEAD_DEVELOPER],
  '/api/audit-logs': [ROLES.SUPER_ADMIN, ROLES.SECURITY_OFFICER],
  '/api/employee-records': [ROLES.SUPER_ADMIN, ROLES.HR_DIRECTOR]
};

// RBAC Middleware
function checkPermission(req, res, next) {
  // In a real app, role would come from a verified JWT token or session.
  // Here, we simulate by passing it in the 'x-role' header.
  const userRole = req.headers['x-role'];

  if (!userRole) {
    return res.status(403).json({ error: 'Forbidden: No role provided' });
  }

  const endpoint = req.path;
  const allowedRoles = permissions[endpoint];

  if (!allowedRoles) {
    return res.status(404).json({ error: 'Not Found' });
  }

  if (allowedRoles.includes(userRole)) {
    // If Security Officer tries to POST/PUT/DELETE, deny them (read-only)
    if (userRole === ROLES.SECURITY_OFFICER && req.method !== 'GET') {
      return res.status(403).json({ error: 'Forbidden: Read-only access' });
    }
    next();
  } else {
    return res.status(403).json({ error: `Forbidden: ${userRole} does not have access to this resource.` });
  }
}

// Endpoints
app.get('/api/home', checkPermission, (req, res) => {
  res.json({ message: database.homeData });
});

app.get('/api/finance', checkPermission, (req, res) => {
  res.json({ data: database.financeData });
});

app.get('/api/code-repo', checkPermission, (req, res) => {
  res.json({ data: database.codeRepoData });
});

app.get('/api/audit-logs', checkPermission, (req, res) => {
  res.json({ data: database.auditLogsData });
});

app.get('/api/employee-records', checkPermission, (req, res) => {
  res.json({ data: database.employeeRecordsData });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
