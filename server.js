const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'database.json');

// Helper to read DB
function readDB() {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}
// Helper to write DB
function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Logger
function logEvent(action, user, severity) {
    const db = readDB();
    db.audit_logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        action,
        user,
        severity // INFO, WARN, CRITICAL
    });
    // Keep last 100
    if (db.audit_logs.length > 100) db.audit_logs.pop();
    writeDB(db);
}

// Endpoint map to permissions
const RESOURCE_PERMISSIONS = {
    'notice_boards': 'view_notice_boards',
    'code_repo': 'view_code',
    'salaries': 'view_employee_records',
    'finance': 'view_finance'
};

function hasPermission(userObj, db, requiredPerm) {
    if (userObj.group === 'Super Admin') return true;
    
    // Check JIT grants
    if (db.jit_grants[userObj.name]) {
        const grant = db.jit_grants[userObj.name];
        if (grant.permission === requiredPerm && Date.now() < grant.expiresAt) {
            return true;
        }
    }

    const groupPerms = db.groups[userObj.group].base_permissions;
    if (groupPerms.includes(requiredPerm) || groupPerms.includes('*')) return true;
    
    if (userObj.overrides.includes(requiredPerm)) return true;
    
    return false;
}

// Middleware
function checkPermission(requiredPerm) {
    return (req, res, next) => {
        const username = req.headers['x-user'];
        const db = readDB();
        
        if (!username || !db.users[username]) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const userObj = db.users[username];

        // Global Lockdown check
        if (db.system_state.emergency_lockdown && userObj.group !== 'Super Admin') {
            logEvent(`Access denied due to lockdown: ${req.path}`, username, 'CRITICAL');
            return res.status(403).json({ error: 'EMERGENCY LOCKDOWN ACTIVE.', requiredPerm: '*' });
        }

        if (hasPermission(userObj, db, requiredPerm)) {
            next();
        } else {
            logEvent(`403 Access Denied to ${req.path}`, username, 'CRITICAL');
            return res.status(403).json({ error: `Missing permission: ${requiredPerm}`, requiredPerm });
        }
    };
}

// --- Endpoints ---

// Current User Info
app.get('/api/user', (req, res) => {
    const username = req.headers['x-user'];
    const db = readDB();
    if (!username || !db.users[username]) return res.status(401).json({error: 'No user'});
    
    const user = db.users[username];
    const groupPerms = db.groups[user.group].base_permissions;
    const allPerms = [...new Set([...groupPerms, ...user.overrides])];
    
    // Check JIT
    let activeJit = null;
    if (db.jit_grants[username] && Date.now() < db.jit_grants[username].expiresAt) {
        activeJit = db.jit_grants[username];
        allPerms.push(activeJit.permission + " (JIT)");
    }

    res.json({
        name: username,
        group: user.group,
        privileges: allPerms,
        jit: activeJit
    });
});

// Generic Data fetch
app.get('/api/data/:resource', (req, res) => {
    const resource = req.params.resource;
    const requiredPerm = RESOURCE_PERMISSIONS[resource];
    if (!requiredPerm) return res.status(404).json({error: 'Resource not found'});
    
    checkPermission(requiredPerm)(req, res, () => {
        const db = readDB();
        res.json({ data: db.data[resource] });
    });
});

// Request Access (JIT)
app.post('/api/access/request', (req, res) => {
    const username = req.headers['x-user'];
    const { resource } = req.body;
    const requiredPerm = RESOURCE_PERMISSIONS[resource];
    
    const db = readDB();
    db.pending_approvals.push({
        id: Date.now().toString(),
        type: 'JIT',
        user: username,
        permission: requiredPerm,
        resource: resource,
        status: 'Pending'
    });
    writeDB(db);
    logEvent(`Requested access to ${resource}`, username, 'WARN');
    res.json({ message: 'Request submitted for admin approval.' });
});

// Maker-Checker: Draft Salary Edit
app.post('/api/salary/edit', checkPermission('edit_salaries'), (req, res) => {
    const username = req.headers['x-user'];
    const db = readDB();
    
    db.pending_approvals.push({
        id: Date.now().toString(),
        type: 'MAKER_CHECKER',
        user: username,
        changes: req.body.changes,
        status: 'Pending Verification'
    });
    writeDB(db);
    logEvent(`Staged salary changes for verification`, username, 'WARN');
    res.json({ message: 'Changes staged. Pending Super Admin verification.' });
});

// Admin: Get Approvals, Logs, State
app.get('/api/admin/dashboard', checkPermission('*'), (req, res) => {
    const db = readDB();
    res.json({
        logs: db.audit_logs,
        approvals: db.pending_approvals,
        lockdown: db.system_state.emergency_lockdown
    });
});

// Admin: Toggle Lockdown
app.post('/api/admin/lockdown', checkPermission('*'), (req, res) => {
    const username = req.headers['x-user'];
    const db = readDB();
    db.system_state.emergency_lockdown = req.body.active;
    writeDB(db);
    logEvent(`Emergency Lockdown ${req.body.active ? 'ENABLED' : 'DISABLED'}`, username, 'CRITICAL');
    res.json({ success: true, lockdown: db.system_state.emergency_lockdown });
});

// Admin: Approve/Reject
app.post('/api/admin/approve/:id', checkPermission('*'), (req, res) => {
    const username = req.headers['x-user'];
    const db = readDB();
    const idx = db.pending_approvals.findIndex(a => a.id === req.params.id);
    
    if (idx === -1) return res.status(404).json({error: 'Not found'});
    
    const request = db.pending_approvals[idx];
    const approved = req.body.approved; // boolean
    
    db.pending_approvals.splice(idx, 1); // remove from queue
    
    if (approved) {
        if (request.type === 'JIT') {
            db.jit_grants[request.user] = {
                permission: request.permission,
                expiresAt: Date.now() + 30000 // 30 seconds
            };
            logEvent(`Approved JIT access for ${request.user}`, username, 'INFO');
        } else if (request.type === 'MAKER_CHECKER') {
            // Apply changes
            db.data.salaries = request.changes;
            logEvent(`Verified and committed salary changes by ${request.user}`, username, 'INFO');
        }
    } else {
        logEvent(`Denied ${request.type} request from ${request.user}`, username, 'WARN');
    }
    
    writeDB(db);
    res.json({ success: true });
});

// Decision Simulator — evaluates access without side effects
app.post('/api/evaluate', (req, res) => {
    const { user: username, resource } = req.body;
    const requiredPerm = RESOURCE_PERMISSIONS[resource];
    const db = readDB();

    if (!username || !db.users[username]) {
        return res.status(400).json({ error: 'Unknown user' });
    }
    if (!requiredPerm) {
        return res.status(400).json({ error: 'Unknown resource' });
    }

    const userObj = { name: username, ...db.users[username] };
    const groupPerms = db.groups[userObj.group].base_permissions;
    const isSuperAdmin = userObj.group === 'Super Admin';

    // Lockdown
    const lockdownBlock = db.system_state.emergency_lockdown && !isSuperAdmin;

    // JIT
    let jitGrant = null;
    if (db.jit_grants[username]) {
        const g = db.jit_grants[username];
        if (g.permission === requiredPerm && Date.now() < g.expiresAt) {
            jitGrant = g;
        }
    }

    const groupMatch = groupPerms.includes(requiredPerm) || groupPerms.includes('*');
    const overrideMatch = userObj.overrides.includes(requiredPerm);
    const granted = !lockdownBlock && (isSuperAdmin || jitGrant || groupMatch || overrideMatch);

    let grantSource = null;
    if (granted) {
        if (isSuperAdmin) grantSource = 'Super Admin wildcard (*)';
        else if (jitGrant) grantSource = 'Just-In-Time (JIT) session grant';
        else if (groupMatch) grantSource = `Group: ${userObj.group}`;
        else if (overrideMatch) grantSource = 'Individual user override';
    }

    res.json({
        granted,
        lockdownBlock,
        grantSource,
        trace: {
            user: username,
            group: userObj.group,
            groupPermissions: groupPerms,
            overrides: userObj.overrides,
            requiredPermission: requiredPerm,
            groupMatch,
            overrideMatch,
            jitActive: !!jitGrant,
            jitGrant
        }
    });
});

// Global app state snapshot (for lockdown banner etc.)
app.get('/api/state', (req, res) => {
    const db = readDB();
    res.json({
        lockdown: db.system_state.emergency_lockdown,
        pendingCount: db.pending_approvals.length,
        jitCount: Object.keys(db.jit_grants).filter(u => Date.now() < db.jit_grants[u].expiresAt).length
    });
});

// All users list (for simulator dropdowns)
app.get('/api/users', (req, res) => {
    const db = readDB();
    res.json(db.users);
});

app.listen(PORT, () => {
    console.log(`Enterprise IGAM running on port ${PORT}`);
});
