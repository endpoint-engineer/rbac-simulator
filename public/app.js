/* =====================================================================
   IGAM — Application Controller
   Communicates with the preserved backend through the same API surface.
   ===================================================================== */

const RESOURCE_MAP = {
  notice_boards: { label: 'Notice Boards',   permission: 'view_notice_boards' },
  code_repo:     { label: 'Code Repository', permission: 'view_code' },
  salaries:      { label: 'Salary Records',  permission: 'view_employee_records' },
  finance:       { label: 'Finance Reports', permission: 'view_finance' }
};

// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = 'Rajesh';
let currentView = 'dashboard';
let auditFilter = 'ALL';
let allLogs = [];
let jitTimerIntervals = {};

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  attachNavigation();
  attachUserSwitcher();
  attachSimulator();
  attachAuditFilters();
  attachRefreshButtons();

  refreshSidebarIdentity();
  refreshGlobalState();
  loadView('dashboard');

  // Poll global state every 4s for lockdown banner, metrics
  setInterval(refreshGlobalState, 4000);
});

// ─── Navigation ──────────────────────────────────────────────────────────────
function attachNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const view = el.dataset.view;
      navigateTo(view);
    });
  });

  // Dashboard panel link
  document.querySelectorAll('.panel__link[data-view]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.view);
    });
  });
}

function navigateTo(view) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active-view');

  currentView = view;
  loadView(view);
}

function loadView(view) {
  switch (view) {
    case 'dashboard': loadDashboard(); break;
    case 'simulator': /* ready when user clicks evaluate */ break;
    case 'requests':  loadRequests(); break;
    case 'jit':       loadJitSessions(); break;
    case 'users':     loadUsers(); break;
    case 'audit':     loadAudit(); break;
    case 'lockdown':  loadLockdown(); break;
  }
}

// ─── User Switcher ───────────────────────────────────────────────────────────
function attachUserSwitcher() {
  document.getElementById('user-select').addEventListener('change', e => {
    currentUser = e.target.value;
    refreshSidebarIdentity();
    refreshGlobalState();
    loadView(currentView);
  });
}

async function refreshSidebarIdentity() {
  const res = await fetch('/api/user', { headers: { 'x-user': currentUser } });
  if (!res.ok) return;
  const user = await res.json();

  document.getElementById('sidebar-avatar').textContent = user.name[0];
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-role').textContent = user.group;
  document.getElementById('header-user-name').textContent = user.name;
  document.getElementById('header-user-group').textContent = user.group;

  // Show/hide admin-only nav items
  const isAdmin = user.group === 'Super Admin';
  ['lockdown', 'audit'].forEach(v => {
    const el = document.querySelector(`.nav-item[data-view="${v}"]`);
    if (el) el.style.display = isAdmin ? 'flex' : 'none';
  });

  // Requests view: show maker-checker panel only for Priya
  updateRequestsPanel();
}

// ─── Global State ────────────────────────────────────────────────────────────
async function refreshGlobalState() {
  const res = await fetch('/api/state');
  if (!res.ok) return;
  const state = await res.json();

  // Lockdown banner
  const banner = document.getElementById('lockdown-banner');
  const layout = document.getElementById('app-layout');
  const statusText = document.getElementById('system-status-text');

  if (state.lockdown) {
    banner.classList.remove('hidden');
    document.body.classList.add('has-banner');
    statusText.textContent = '⚠ Emergency Lockdown Active';
    statusText.className = 'identity-card__system-status lockdown-active';
  } else {
    banner.classList.add('hidden');
    document.body.classList.remove('has-banner');
    statusText.textContent = '● System Secure';
    statusText.className = 'identity-card__system-status';
  }

  // Metrics
  document.getElementById('metric-pending').textContent = state.pendingCount;
  document.getElementById('metric-pending-label').textContent =
    state.pendingCount > 0 ? `${state.pendingCount} awaiting review` : 'No pending items';

  document.getElementById('metric-jit').textContent = state.jitCount;

  // Health panel
  document.getElementById('health-lockdown-badge').textContent = state.lockdown ? 'ACTIVE' : 'Inactive';
  document.getElementById('health-lockdown-badge').className = state.lockdown ? 'badge badge--red' : 'badge badge--emerald';
  document.getElementById('health-maker-badge').textContent = state.pendingCount > 0 ? `${state.pendingCount} Pending` : 'Clear';
  document.getElementById('health-maker-badge').className = state.pendingCount > 0 ? 'badge badge--amber' : 'badge badge--emerald';
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  // Refresh metrics
  await refreshGlobalState();

  // Load recent audit logs for activity feed
  const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': currentUser } });
  const list = document.getElementById('recent-activity-list');

  if (!res.ok) {
    list.innerHTML = '<div class="empty-state">Visible to Super Admin only.</div>';
    document.getElementById('metric-critical').textContent = '—';
    return;
  }

  const data = await res.json();
  const recent = data.logs.slice(0, 5);

  // Count criticals in last 24h
  const criticalCount = data.logs.filter(l => l.severity === 'CRITICAL').length;
  document.getElementById('metric-critical').textContent = criticalCount;

  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state">No activity recorded yet.</div>';
    return;
  }

  list.innerHTML = recent.map(log => `
    <div class="activity-item">
      <div class="activity-item__left">
        <div class="activity-item__user">${log.user}</div>
        <div class="activity-item__detail">${log.action}</div>
      </div>
      <span class="sev-badge sev-${log.severity}">${log.severity}</span>
    </div>
  `).join('');
}

// ─── Decision Simulator ──────────────────────────────────────────────────────
function attachSimulator() {
  document.getElementById('evaluate-btn').addEventListener('click', runSimulator);
}

async function runSimulator() {
  const user     = document.getElementById('sim-user').value;
  const resource = document.getElementById('sim-resource').value;

  const btn = document.getElementById('evaluate-btn');
  btn.textContent = 'Evaluating…';
  btn.disabled = true;

  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, resource })
  });

  btn.textContent = 'Evaluate Access';
  btn.disabled = false;

  if (!res.ok) {
    document.getElementById('simulator-result').innerHTML =
      `<div class="result-placeholder"><p style="color:var(--red)">Error: ${(await res.json()).error}</p></div>`;
    return;
  }

  const result = await res.json();
  renderSimulatorResult(result, user, resource);
}

function renderSimulatorResult(result, user, resource) {
  const { granted, lockdownBlock, grantSource, trace } = result;
  const resLabel = RESOURCE_MAP[resource]?.label || resource;

  // ── Determine step states ──
  // Step 1: User
  const step1pass = true;

  // Step 2: Group
  const step2pass = true;

  // Step 3: Group permissions
  const step3match = trace.groupMatch;

  // Step 4: Overrides
  const step4match = trace.overrideMatch;

  // Step 5: JIT
  const step5match = trace.jitActive;

  // Step 6: Final
  const finalGranted = granted;

  // ── Build source label ──
  let sourceDesc = '';
  if (granted) {
    sourceDesc = `Access granted via <strong>${grantSource}</strong>`;
  } else if (lockdownBlock) {
    sourceDesc = 'Blocked by Emergency Lockdown — all non-admin routes suspended.';
  } else {
    sourceDesc = `No matching permission found for <code>${trace.requiredPermission}</code>`;
  }

  // ── Required perm tags ──
  const groupPermTags = trace.groupPermissions.map(p => {
    const isMatch = p === trace.requiredPermission || p === '*';
    return `<span class="trace-tag${isMatch ? ' trace-tag--match' : ''}">${p}</span>`;
  }).join('');

  const overrideTags = trace.overrides.length > 0
    ? trace.overrides.map(p => {
        const isMatch = p === trace.requiredPermission;
        return `<span class="trace-tag${isMatch ? ' trace-tag--match' : ''}">${p}</span>`;
      }).join('')
    : '<span class="trace-tag" style="opacity:0.5">none</span>';

  document.getElementById('simulator-result').innerHTML = `
    <div class="decision-verdict">
      <div class="decision-verdict__icon">${granted ? '✓' : '✕'}</div>
      <div>
        <div class="decision-verdict__label ${granted ? 'decision-verdict__label--granted' : 'decision-verdict__label--denied'}">
          ${granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
        </div>
        <div class="decision-verdict__source">${sourceDesc}</div>
      </div>
    </div>

    <div class="decision-trace">
      <h4>Authorization Decision Trace</h4>
      <div class="trace-steps">

        <div class="trace-step">
          <div class="trace-step__num trace-step__num--pass">1</div>
          <div class="trace-step__body">
            <div class="trace-step__title">User Identity</div>
            <div class="trace-step__detail">Identity verified — <strong>${user}</strong></div>
          </div>
        </div>

        <div class="trace-step">
          <div class="trace-step__num trace-step__num--pass">2</div>
          <div class="trace-step__body">
            <div class="trace-step__title">Group Membership</div>
            <div class="trace-step__detail">Member of <strong>${trace.group}</strong></div>
          </div>
        </div>

        <div class="trace-step">
          <div class="trace-step__num ${step3match ? 'trace-step__num--pass' : 'trace-step__num--neutral'}">3</div>
          <div class="trace-step__body">
            <div class="trace-step__title">Inherited Group Permissions</div>
            <div class="trace-step__detail">Required: <code>${trace.requiredPermission}</code> — ${step3match ? 'Found in group permissions' : 'Not present in group'}</div>
            <div class="trace-step__tags">${groupPermTags}</div>
          </div>
        </div>

        <div class="trace-step">
          <div class="trace-step__num ${step4match ? 'trace-step__num--pass' : 'trace-step__num--neutral'}">4</div>
          <div class="trace-step__body">
            <div class="trace-step__title">Individual User Overrides</div>
            <div class="trace-step__detail">${step4match ? 'Explicit override grants access' : 'No matching override found'}</div>
            <div class="trace-step__tags">${overrideTags}</div>
          </div>
        </div>

        <div class="trace-step">
          <div class="trace-step__num ${step5match ? 'trace-step__num--pass trace-step__num--jit' : 'trace-step__num--neutral'}">5</div>
          <div class="trace-step__body">
            <div class="trace-step__title">JIT Session</div>
            <div class="trace-step__detail">${step5match ? `<span class="trace-tag trace-tag--jit">Active JIT grant</span> — temporary access in effect` : 'No active JIT session'}</div>
          </div>
        </div>

        <div class="trace-step">
          <div class="trace-step__num ${finalGranted ? 'trace-step__num--pass' : 'trace-step__num--fail'}">6</div>
          <div class="trace-step__body">
            <div class="trace-step__title">Final Decision</div>
            <div class="trace-step__detail">
              <span class="badge ${finalGranted ? 'badge--emerald' : 'badge--red'}">
                ${finalGranted ? 'GRANTED' : 'DENIED'}
              </span>
              ${lockdownBlock ? ' — Emergency Lockdown override' : ''}
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

// ─── Access Requests ─────────────────────────────────────────────────────────
async function loadRequests() {
  document.getElementById('req-submitter').textContent = currentUser;
  updateRequestsPanel();

  document.getElementById('submit-request-btn').onclick = async () => {
    const resource = document.getElementById('req-resource').value;
    const res = await fetch('/api/access/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user': currentUser },
      body: JSON.stringify({ resource })
    });
    const data = await res.json();
    showToast(data.message);
    await loadRequests();
    await refreshGlobalState();
  };

  document.getElementById('stage-salary-btn').onclick = async () => {
    const dataRes = await fetch('/api/data/salaries', { headers: { 'x-user': currentUser } });
    if (!dataRes.ok) { showToast('Could not load salary data.'); return; }
    const { data } = await dataRes.json();
    const newSalaries = JSON.parse(JSON.stringify(data));
    newSalaries[0].amount += 8000;

    const res = await fetch('/api/salary/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user': currentUser },
      body: JSON.stringify({ changes: newSalaries })
    });
    const r = await res.json();
    showToast(r.message || r.error);
    await loadRequests();
    await refreshGlobalState();
  };

  await refreshApprovalQueue();
}

function updateRequestsPanel() {
  const makerPanel = document.getElementById('maker-checker-panel');
  if (makerPanel) {
    makerPanel.classList.toggle('hidden', currentUser !== 'Priya');
  }
  const reqSubmitter = document.getElementById('req-submitter');
  if (reqSubmitter) reqSubmitter.textContent = currentUser;
}

async function refreshApprovalQueue() {
  const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': 'Rajesh' } });
  const list = document.getElementById('approval-queue-list');
  if (!res.ok) { list.innerHTML = '<div class="empty-state">Approval queue requires admin credentials.</div>'; return; }

  const data = await res.json();
  if (data.approvals.length === 0) {
    list.innerHTML = '<div class="empty-state">No pending approvals.</div>';
    return;
  }

  list.innerHTML = data.approvals.map(app => `
    <div class="approval-queue-item">
      <div>
        <div class="approval-queue-item__label">
          <span class="badge ${app.type === 'JIT' ? 'badge--amber' : 'badge--blue'}">${app.type}</span>
          &nbsp; ${app.user}
        </div>
        <div class="approval-queue-item__meta">${app.permission || 'Salary modification'} — Status: ${app.status}</div>
      </div>
      <div class="approval-queue-item__actions">
        <button class="btn btn--primary btn--sm" onclick="handleApproval('${app.id}', true)">Approve</button>
        <button class="btn btn--danger btn--sm" onclick="handleApproval('${app.id}', false)">Deny</button>
      </div>
    </div>
  `).join('');
}

window.handleApproval = async function(id, approved) {
  await fetch(`/api/admin/approve/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user': 'Rajesh' },
    body: JSON.stringify({ approved })
  });
  showToast(approved ? 'Request approved.' : 'Request denied.');
  await refreshApprovalQueue();
  await refreshGlobalState();
  loadJitSessions(); // refresh JIT view if open
};

// ─── JIT Sessions ────────────────────────────────────────────────────────────
async function loadJitSessions() {
  const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': 'Rajesh' } });
  const container = document.getElementById('jit-sessions-list');

  if (!res.ok) { container.innerHTML = '<div class="empty-state">No active sessions found.</div>'; return; }

  const adminData = await res.json();

  // Re-fetch DB info via all-users endpoint to find JIT grants
  const stateRes = await fetch('/api/state');
  const state = await stateRes.json();

  // Collect active JIT grants by asking each user's profile
  const userNames = ['Rajesh', 'Vikram', 'Rahul', 'Priya', 'Sneha'];
  const activeSessions = [];

  for (const name of userNames) {
    const uRes = await fetch('/api/user', { headers: { 'x-user': name } });
    const u = await uRes.json();
    if (u.jit) activeSessions.push({ user: name, group: u.group, jit: u.jit });
  }

  if (activeSessions.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:48px;background:var(--s1);border:1px solid var(--border);border-radius:8px;">No active JIT sessions. Approve a JIT request from Access Requests to see sessions here.</div>';
    return;
  }

  container.innerHTML = activeSessions.map(s => `
    <div class="jit-card" id="jit-card-${s.user}">
      <div class="jit-card__user">${s.group} — ${s.user}</div>
      <div class="jit-card__perm">${s.jit.permission}</div>
      <div class="jit-card__timer-label">Session Expires In</div>
      <div class="jit-card__timer" id="jit-timer-${s.user}">--</div>
    </div>
  `).join('');

  // Start countdowns
  activeSessions.forEach(s => {
    startJitCountdown(s.user, s.jit.expiresAt);
  });
}

function startJitCountdown(user, expiresAt) {
  clearInterval(jitTimerIntervals[user]);
  const el = document.getElementById(`jit-timer-${user}`);
  if (!el) return;

  jitTimerIntervals[user] = setInterval(() => {
    const left = Math.round((expiresAt - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(jitTimerIntervals[user]);
      el.closest('.jit-card')?.remove();
      const container = document.getElementById('jit-sessions-list');
      if (container && !container.querySelector('.jit-card')) {
        container.innerHTML = '<div class="empty-state" style="padding:48px;background:var(--s1);border:1px solid var(--border);border-radius:8px;">No active JIT sessions.</div>';
      }
    } else {
      el.textContent = `${left}s`;
      el.className = left <= 8 ? 'jit-card__timer expiring' : 'jit-card__timer';
    }
  }, 500);
}

// ─── Users & Groups ──────────────────────────────────────────────────────────
async function loadUsers() {
  const res = await fetch('/api/users');
  const users = await res.json();

  // Fetch group data too
  const stateRes = await fetch('/api/state'); // just to ensure server is alive
  const grid = document.getElementById('users-grid');

  // We'll fetch each user's profile individually to get their full resolved permissions
  const userNames = Object.keys(users);
  const profiles = await Promise.all(
    userNames.map(name =>
      fetch('/api/user', { headers: { 'x-user': name } }).then(r => r.json())
    )
  );

  const groupColors = {
    'Super Admin': 'badge--red',
    'Engineering': 'badge--blue',
    'HR': 'badge--amber',
    'Finance': 'badge--emerald',
    'Marketing': 'badge--blue',
    'Interns': 'badge--group'
  };

  grid.innerHTML = profiles.map(p => {
    const userData = users[p.name];
    const groupPerms = p.privileges.filter(perm => !perm.endsWith('(JIT)') && !userData.overrides.includes(perm));
    const overrides = userData.overrides;

    return `
      <div class="user-card">
        <div class="user-card__header">
          <div class="user-card__avatar">${p.name[0]}</div>
          <div>
            <div class="user-card__name">${p.name}</div>
            <div class="user-card__group">
              <span class="badge ${groupColors[p.group] || 'badge--group'}">${p.group}</span>
            </div>
          </div>
        </div>
        <div class="user-card__section-label">Inherited Permissions</div>
        <ul class="user-card__perm-list">
          ${groupPerms.map(p => `<li>${p}</li>`).join('') || '<li style="opacity:0.4">none</li>'}
        </ul>
        ${overrides.length > 0 ? `
          <div class="user-card__section-label">Individual Overrides</div>
          <ul class="user-card__perm-list">
            ${overrides.map(o => `<li class="override">${o}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────
async function loadAudit() {
  const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': 'Rajesh' } });
  const tbody = document.getElementById('audit-tbody');

  if (!res.ok) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Audit Trail requires Super Admin access.</td></tr>';
    return;
  }

  const data = await res.json();
  allLogs = data.logs;
  renderAuditTable();
}

function renderAuditTable() {
  const tbody = document.getElementById('audit-tbody');
  const filtered = auditFilter === 'ALL' ? allLogs : allLogs.filter(l => l.severity === auditFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No log entries for this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(log => `
    <tr onclick="openAuditDetail(${JSON.stringify(JSON.stringify(log))})">
      <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
      <td><span class="sev-badge sev-${log.severity}">${log.severity}</span></td>
      <td style="color:var(--text-primary);font-weight:500">${log.user}</td>
      <td>${log.action}</td>
    </tr>
  `).join('');
}

function attachAuditFilters() {
  document.querySelectorAll('.audit-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.audit-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      auditFilter = btn.dataset.filter;
      renderAuditTable();
    });
  });
}

window.openAuditDetail = function(logJsonStr) {
  const log = JSON.parse(logJsonStr);
  document.getElementById('audit-detail-overlay').classList.remove('hidden');
  document.getElementById('audit-detail-panel').classList.remove('hidden');
  document.getElementById('audit-detail-content').innerHTML = `
    <div class="detail-row">
      <div class="detail-row__label">Event ID</div>
      <div class="detail-row__value" style="font-family:monospace">${log.id}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row__label">Timestamp</div>
      <div class="detail-row__value">${new Date(log.timestamp).toLocaleString()}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row__label">Severity</div>
      <div class="detail-row__value"><span class="sev-badge sev-${log.severity}">${log.severity}</span></div>
    </div>
    <div class="detail-row">
      <div class="detail-row__label">User</div>
      <div class="detail-row__value">${log.user}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row__label">Event Description</div>
      <div class="detail-row__value">${log.action}</div>
    </div>
  `;
};

window.closeAuditDetail = function() {
  document.getElementById('audit-detail-overlay').classList.add('hidden');
  document.getElementById('audit-detail-panel').classList.add('hidden');
};

// ─── Lockdown ─────────────────────────────────────────────────────────────────
async function loadLockdown() {
  const stateRes = await fetch('/api/state');
  const state = await stateRes.json();
  renderLockdownPage(state.lockdown);
}

function renderLockdownPage(isLockdown) {
  const icon  = document.getElementById('lockdown-icon');
  const text  = document.getElementById('lockdown-state-text');
  const sub   = document.getElementById('lockdown-state-sub');
  const card  = document.getElementById('lockdown-status-card');
  const adminActions  = document.getElementById('lockdown-admin-actions');
  const nonAdminBlock = document.getElementById('lockdown-non-admin');
  const btn   = document.getElementById('toggle-lockdown-btn');

  icon.textContent  = isLockdown ? '🔒' : '🔓';
  text.textContent  = isLockdown ? 'LOCKDOWN ACTIVE' : 'NORMAL';
  text.className    = isLockdown ? 'lockdown-state-text active' : 'lockdown-state-text';
  sub.textContent   = isLockdown
    ? 'All non-admin routes are suspended. No user access is permitted until lockdown is lifted.'
    : 'All authorization policies are active and enforced.';

  card.style.borderColor = isLockdown ? 'var(--red)' : 'var(--border)';

  if (currentUser === 'Rajesh') {
    adminActions.style.display = 'block';
    nonAdminBlock.style.display = 'none';
    btn.textContent  = isLockdown ? 'Disable Emergency Lockdown' : 'Enable Emergency Lockdown';
    btn.className    = isLockdown ? 'btn btn--primary btn--lg' : 'btn btn--danger btn--lg';
    btn.onclick = async () => {
      await fetch('/api/admin/lockdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': 'Rajesh' },
        body: JSON.stringify({ active: !isLockdown })
      });
      await refreshGlobalState();
      loadLockdown();
    };
  } else {
    adminActions.style.display = 'none';
    nonAdminBlock.style.display = 'block';
  }
}

// ─── Refresh buttons ─────────────────────────────────────────────────────────
function attachRefreshButtons() {
  document.getElementById('refresh-requests-btn')?.addEventListener('click', () => refreshApprovalQueue());
  document.getElementById('refresh-audit-btn')?.addEventListener('click', () => loadAudit());
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;
    background:var(--s3);border:1px solid var(--border-md);
    color:var(--text-primary);padding:12px 20px;
    border-radius:6px;font-size:13px;z-index:500;
    box-shadow:0 4px 24px rgba(0,0,0,0.6);
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
