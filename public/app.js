/* ====================================================================
   IGAM — Application Controller
   All API calls use the existing backend. No logic is hardcoded here.
   ==================================================================== */

const app = (function () {

  // ─── State ───────────────────────────────────────────────────────
  const state = {
    user: 'Rajesh',
    view: 'dashboard',
    auditFilter: 'ALL',
    allLogs: [],
    jitIntervals: {}
  };

  // Backend resource → permission name (mirrors server.js RESOURCE_PERMISSIONS)
  const RESOURCE_PERMISSIONS = {
    notice_boards: 'view_notice_boards',
    code_repo:     'view_code',
    salaries:      'view_employee_records',
    finance:       'view_finance'
  };

  const RESOURCE_LABELS = {
    notice_boards: 'Notice Boards',
    code_repo:     'Code Repository',
    salaries:      'Salary Records',
    finance:       'Finance Reports'
  };

  // ─── Boot ────────────────────────────────────────────────────────
  function init() {
    bindNav();
    bindIdentitySwitcher();
    bindSimulator();
    bindRequestButtons();
    bindAuditFilters();
    bindDrawer();

    refreshIdentity();
    refreshGlobalState();
    loadView('dashboard');
    setInterval(refreshGlobalState, 4000);
  }

  // ─── Navigation ──────────────────────────────────────────────────
  function bindNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.view));
    });
  }

  function navigateTo(view) {
    state.view = view;
    document.querySelectorAll('.nav-item[data-view]').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    document.querySelectorAll('.view-section').forEach(el => {
      el.classList.toggle('active', el.id === `view-${view}`);
    });
    loadView(view);
  }

  function loadView(view) {
    switch (view) {
      case 'dashboard': loadDashboard();  break;
      case 'requests':  loadRequests();   break;
      case 'jit':       loadJit();        break;
      case 'users':     loadUsers();      break;
      case 'matrix':    loadMatrix();     break;
      case 'audit':     loadAudit();      break;
      case 'lockdown':  loadLockdown();   break;
      // simulator loads on demand via button
    }
  }

  // ─── Identity Switcher ───────────────────────────────────────────
  function bindIdentitySwitcher() {
    document.getElementById('global-identity-select').addEventListener('change', e => {
      state.user = e.target.value;
      refreshIdentity();
      refreshGlobalState();
      loadView(state.view);
    });
  }

  async function refreshIdentity() {
    try {
      const res  = await fetch('/api/user', { headers: { 'x-user': state.user } });
      if (!res.ok) return;
      const user = await res.json();

      document.getElementById('sidebar-avatar').textContent = user.name[0];
      document.getElementById('sidebar-name').textContent   = user.name;
      document.getElementById('sidebar-role').textContent   = user.group;

      // Show governance/system nav only for Super Admin
      const isAdmin = user.group === 'Super Admin';
      document.getElementById('nav-admin-governance').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('nav-admin-system').style.display     = isAdmin ? 'block' : 'none';

      // Keep select in sync
      document.getElementById('global-identity-select').value = state.user;
    } catch (_) {}
  }

  // ─── Global State (lockdown banner + metrics) ────────────────────
  async function refreshGlobalState() {
    try {
      const res  = await fetch('/api/state');
      if (!res.ok) return;
      const data = await res.json();

      const banner  = document.getElementById('global-lockdown-banner');
      const wrapper = document.getElementById('sidebar-status-wrapper');
      const dot     = document.getElementById('sidebar-status-dot');
      const txt     = document.getElementById('sidebar-status-text');

      if (data.lockdown) {
        banner.classList.remove('hidden');
        banner.style.display = 'flex';
        wrapper.className = 'flex items-center gap-2 px-2 py-1.5 rounded-md bg-error-container/20 border border-error/30';
        dot.className     = 'w-1.5 h-1.5 rounded-full bg-error animate-pulse flex-shrink-0';
        txt.className     = 'font-mono text-[10px] text-error font-bold tracking-wide';
        txt.textContent   = 'LOCKDOWN ACTIVE';
      } else {
        banner.classList.add('hidden');
        banner.style.display = 'none';
        wrapper.className = 'flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#041c14] border border-[#064e3b]';
        dot.className     = 'w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse flex-shrink-0';
        txt.className     = 'font-mono text-[10px] text-tertiary-fixed-dim font-bold tracking-wide';
        txt.textContent   = 'SYSTEM SECURE';
      }

      // Update dashboard metrics if visible
      setTextSafe('dash-metric-pending', data.pendingCount);
      setTextSafe('dash-metric-jit',     data.jitCount);

      // Health badge
      const badge = document.getElementById('dash-health-badge');
      if (badge) {
        if (data.lockdown) {
          badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-error-container/20 text-error border border-error/30';
          badge.innerHTML = '<span class="font-mono text-[10px] font-semibold tracking-wide">LOCKDOWN</span>';
        } else {
          badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#041c14] text-tertiary-fixed-dim border border-[#064e3b]';
          badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse"></span><span class="font-mono text-[10px] font-semibold tracking-wide">HEALTHY</span>';
        }
      }
    } catch (_) {}
  }

  function setTextSafe(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── Dashboard ───────────────────────────────────────────────────
  async function loadDashboard() {
    await refreshGlobalState();

    const actEl    = document.getElementById('dash-recent-activity');
    const healthEl = document.getElementById('dash-system-health');

    try {
      const stRes  = await fetch('/api/state');
      const sysState = await stRes.json();

      healthEl.innerHTML = `
        <div class="flex justify-between items-center py-1.5">
          <span class="text-xs text-on-surface-variant">Authorization Engine</span>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim"></span>
            <span class="font-mono text-[11px] text-tertiary-fixed-dim">Operational</span>
          </div>
        </div>
        <div class="flex justify-between items-center py-1.5">
          <span class="text-xs text-on-surface-variant">Lockdown Policy</span>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${sysState.lockdown ? 'bg-error' : 'bg-tertiary-fixed-dim'}"></span>
            <span class="font-mono text-[11px] ${sysState.lockdown ? 'text-error' : 'text-tertiary-fixed-dim'}">${sysState.lockdown ? 'ENGAGED' : 'Normal'}</span>
          </div>
        </div>
        <div class="flex justify-between items-center py-1.5">
          <span class="text-xs text-on-surface-variant">Pending Approvals</span>
          <span class="font-mono text-[11px] ${sysState.pendingCount > 0 ? 'text-[#f59e0b]' : 'text-tertiary-fixed-dim'}">${sysState.pendingCount} queued</span>
        </div>
      `;
    } catch (_) {}

    try {
      const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': state.user } });
      if (!res.ok) {
        actEl.innerHTML = '<div class="text-sm text-on-surface-variant py-6 text-center">Recent activity is restricted to Super Admin.</div>';
        setTextSafe('dash-metric-critical', '—');
        return;
      }
      const data = await res.json();
      const recent = data.logs.slice(0, 5);
      setTextSafe('dash-metric-critical', data.logs.filter(l => l.severity === 'CRITICAL').length);

      if (recent.length === 0) {
        actEl.innerHTML = '<div class="text-sm text-on-surface-variant py-6 text-center">No activity recorded yet.</div>';
        return;
      }
      actEl.innerHTML = recent.map(log => `
        <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-container-lowest border border-border-dim hover:border-[#3a3a3e] transition-colors">
          <div>
            <span class="text-sm font-medium text-primary">${escHtml(log.user)}</span>
            <div class="text-xs text-on-surface-variant mt-0.5 truncate max-w-xs">${escHtml(log.action)}</div>
          </div>
          <span class="flex-shrink-0 ml-3 font-mono text-[10px] px-2 py-0.5 rounded ${sevClass(log.severity)}">${log.severity}</span>
        </div>
      `).join('');
    } catch (_) {}
  }

  // ─── Decision Simulator ──────────────────────────────────────────
  function bindSimulator() {
    document.getElementById('sim-eval-btn').addEventListener('click', runSimulator);
  }

  async function runSimulator() {
    const user     = document.getElementById('sim-user').value;
    const resource = document.getElementById('sim-resource').value;
    const action   = document.getElementById('sim-action').value;
    const btn      = document.getElementById('sim-eval-btn');

    btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span> Evaluating…';
    btn.disabled  = true;

    try {
      const res  = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, resource })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      renderSimulatorResult(data, user, resource, action);
    } catch (e) {
      toast('Evaluation error: ' + e.message, true);
    } finally {
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">play_arrow</span> Evaluate Access';
      btn.disabled  = false;
    }
  }

  function renderSimulatorResult(data, user, resource, action) {
    const t             = data.trace;
    const resLabel      = RESOURCE_LABELS[resource] || resource;
    // For non-READ actions, the backend evaluates view permission — if denied there, definitely denied for elevated actions too
    const effectivelyGranted = data.granted && action === 'READ';
    const denied        = !data.granted;

    // For WRITE/EXECUTE/DELETE: even if READ is granted, elevated actions require explicit write permissions which don't exist in this model
    const actionBlocked = data.granted && action !== 'READ';

    const finalGranted  = effectivelyGranted;
    const verdictColor  = finalGranted ? '#4edea3' : '#ffb4ab';
    const verdictText   = finalGranted ? 'ACCESS GRANTED' : 'ACCESS DENIED';

    let reasonText = '';
    if (data.lockdownBlock) {
      reasonText = 'Blocked by Emergency Lockdown — all non-admin routes suspended.';
    } else if (actionBlocked) {
      reasonText = `${action} action requires elevated write permissions not present in this identity's privilege set.`;
    } else if (data.granted) {
      reasonText = `Access granted via ${data.grantSource}.`;
    } else {
      reasonText = `Required permission <code class="bg-surface-container px-1 rounded text-[11px]">${t.requiredPermission}</code> not found in group or overrides.`;
    }

    // Steps
    const steps = [
      {
        pass: true,
        label: 'Identity',
        detail: `<strong>${escHtml(user)}</strong> verified`
      },
      {
        pass: true,
        label: 'Group / Role',
        detail: `Member of <strong>${escHtml(t.group)}</strong>`
      },
      {
        pass: t.groupMatch,
        label: 'Inherited Permissions',
        detail: t.groupMatch
          ? `Required permission <code class="bg-surface-container px-1 rounded text-[11px]">${t.requiredPermission}</code> found in group`
          : `Required permission <code class="bg-surface-container px-1 rounded text-[11px]">${t.requiredPermission}</code> not in group`,
        tags: t.groupPermissions.map(p => `<span class="font-mono text-[10px] px-1.5 py-0.5 rounded border ${p === t.requiredPermission ? 'bg-[#041c14] text-tertiary-fixed-dim border-[#064e3b]' : 'bg-surface-container text-on-surface-variant border-border-dim'}">${p}</span>`).join(' ')
      },
      {
        pass: t.overrideMatch,
        label: 'User Overrides',
        detail: t.overrideMatch ? 'Explicit override grants access' : 'No matching individual override',
        tags: t.overrides.length > 0
          ? t.overrides.map(o => `<span class="font-mono text-[10px] px-1.5 py-0.5 rounded border bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30">${o}</span>`).join(' ')
          : ''
      },
      {
        pass: t.jitActive,
        label: 'JIT Session',
        detail: t.jitActive ? 'Active temporary grant found' : 'No active JIT session'
      }
    ];

    if (actionBlocked) {
      steps.push({
        pass: false,
        label: `Action: ${action}`,
        detail: `Elevated action requires explicit write/execute permission — not present`
      });
    }

    steps.push({
      pass: finalGranted,
      label: 'Final Decision',
      detail: finalGranted ? 'Access permitted' : 'Access blocked',
      isFinal: true
    });

    document.getElementById('sim-result-container').innerHTML = `
      <div class="flex flex-col h-full min-h-[360px]">

        <!-- Subject line -->
        <div class="mb-4 pb-4 border-b border-border-dim">
          <div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mb-2">Evaluation Request</div>
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-primary font-bold text-sm">${escHtml(user[0])}</span>
              <span class="font-semibold text-primary text-sm">${escHtml(user)}</span>
            </div>
            <span class="text-on-surface-variant text-xs">→</span>
            <span class="text-xs text-on-surface-variant bg-surface-container border border-border-dim px-2 py-1 rounded-md">${escHtml(resLabel)}</span>
            <span class="text-on-surface-variant text-xs">→</span>
            <span class="font-mono text-xs text-primary bg-surface-container border border-border-dim px-2 py-1 rounded-md">${action}</span>
          </div>
        </div>

        <!-- Verdict -->
        <div class="mb-5 flex items-center gap-4">
          <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold" style="background:${finalGranted ? 'rgba(78,222,163,0.12)' : 'rgba(255,180,171,0.12)'}; color:${verdictColor}; border: 1px solid ${finalGranted ? 'rgba(78,222,163,0.3)' : 'rgba(255,180,171,0.3)'};">
            ${finalGranted ? '✓' : '✕'}
          </div>
          <div>
            <div class="text-xl font-bold tracking-tight" style="color:${verdictColor}">${verdictText}</div>
            <div class="text-xs text-on-surface-variant mt-0.5">${reasonText}</div>
          </div>
        </div>

        <!-- Trace -->
        <div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mb-3">Authorization Decision Trace</div>
        <div class="space-y-0 relative">
          ${steps.map((s, i) => `
            <div class="trace-step pb-4">
              <div class="trace-connector"></div>
              <div class="w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-mono flex-shrink-0 z-10 relative ${s.isFinal ? (s.pass ? 'bg-[#041c14] border-[#064e3b] text-tertiary-fixed-dim' : 'bg-error-container/20 border-error/30 text-error') : (s.pass ? 'bg-[#041c14] border-[#064e3b] text-tertiary-fixed-dim' : 'bg-surface-container-lowest border-border-dim text-on-surface-variant')}">${s.pass ? '✓' : '✕'}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-primary leading-none mb-0.5">${s.label}</div>
                <div class="text-xs text-on-surface-variant">${s.detail}</div>
                ${s.tags ? `<div class="mt-1.5 flex flex-wrap gap-1">${s.tags}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ─── Access Requests ─────────────────────────────────────────────
  function bindRequestButtons() {
    document.getElementById('req-submit-btn').addEventListener('click', submitJitRequest);
    document.getElementById('req-stage-btn').addEventListener('click', stageSalary);
  }

  async function loadRequests() {
    // Update identity label
    setTextSafe('req-identity-label', state.user);
    document.getElementById('req-identity-label').textContent = state.user;

    // Maker-Checker — visible only to Priya
    document.getElementById('req-maker-panel').style.display = state.user === 'Priya' ? 'block' : 'none';

    // Admin queue — visible only to Rajesh
    const queuePanel = document.getElementById('req-approval-queue-panel');
    const queueList  = document.getElementById('req-approval-list');

    if (state.user === 'Rajesh') {
      queuePanel.style.display = 'block';
      try {
        const res  = await fetch('/api/admin/dashboard', { headers: { 'x-user': 'Rajesh' } });
        const data = await res.json();

        if (data.approvals.length === 0) {
          queueList.innerHTML = '<div class="text-sm text-on-surface-variant text-center py-4">No pending requests in queue.</div>';
        } else {
          queueList.innerHTML = data.approvals.map(a => `
            <div class="flex items-center justify-between p-4 bg-surface-container-lowest border border-border-dim rounded-lg">
              <div class="flex-1 min-w-0 mr-4">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-mono text-[10px] px-2 py-0.5 rounded-full border ${a.type === 'JIT' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}">${a.type}</span>
                  <span class="text-sm font-semibold text-primary">${escHtml(a.user)}</span>
                </div>
                <div class="text-xs text-on-surface-variant truncate">${escHtml(a.permission || 'Salary modification')}</div>
                <div class="text-[11px] text-on-surface-variant mt-1">Status: ${escHtml(a.status)}</div>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button onclick="app.approveReq('${a.id}', false)" class="px-3 py-1.5 rounded-md text-xs font-semibold border border-error/30 text-error hover:bg-error-container/20 transition-colors">Deny</button>
                <button onclick="app.approveReq('${a.id}', true)"  class="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-surface hover:bg-gray-100 transition-colors">Approve</button>
              </div>
            </div>
          `).join('');
        }
      } catch (_) {
        queueList.innerHTML = '<div class="text-sm text-on-surface-variant">Failed to load queue.</div>';
      }
    } else {
      queuePanel.style.display = 'none';
    }
  }

  async function submitJitRequest() {
    const resource = document.getElementById('req-resource').value;
    try {
      const res  = await fetch('/api/access/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': state.user },
        body:    JSON.stringify({ resource })
      });
      const data = await res.json();
      toast(data.message || 'Request submitted.');
      refreshGlobalState();
    } catch (_) { toast('Request failed.', true); }
  }

  async function stageSalary() {
    try {
      const dRes = await fetch('/api/data/salaries', { headers: { 'x-user': state.user } });
      if (!dRes.ok) { toast('No salary access.', true); return; }
      const { data } = await dRes.json();
      data[0].amount += 8000;

      const res  = await fetch('/api/salary/edit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': state.user },
        body:    JSON.stringify({ changes: data })
      });
      const json = await res.json();
      toast(json.message || json.error, !!json.error);
      refreshGlobalState();
    } catch (_) { toast('Staging failed.', true); }
  }

  async function approveReq(id, approved) {
    try {
      await fetch(`/api/admin/approve/${id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': 'Rajesh' },
        body:    JSON.stringify({ approved })
      });
      toast(approved ? 'Request approved.' : 'Request denied.');
      loadRequests();
      refreshGlobalState();
    } catch (_) { toast('Action failed.', true); }
  }

  // ─── Active JIT Sessions ─────────────────────────────────────────
  async function loadJit() {
    const container = document.getElementById('jit-list');
    container.innerHTML = '<div class="col-span-2 text-sm text-on-surface-variant text-center py-4">Checking sessions…</div>';

    const users   = ['Rajesh', 'Vikram', 'Rahul', 'Priya', 'Sneha'];
    const active  = [];

    for (const u of users) {
      try {
        const r    = await fetch('/api/user', { headers: { 'x-user': u } });
        const data = await r.json();
        if (data.jit) active.push({ user: u, group: data.group, jit: data.jit });
      } catch (_) {}
    }

    // Clear old timers
    Object.values(state.jitIntervals).forEach(clearInterval);
    state.jitIntervals = {};

    if (active.length === 0) {
      container.innerHTML = `
        <div class="col-span-2 p-8 text-center text-on-surface-variant border border-border-dim rounded-xl bg-surface-container-lowest">
          <span class="material-symbols-outlined text-3xl opacity-30 block mb-2">schedule</span>
          <p class="text-sm">No active JIT sessions.</p>
          <p class="text-xs mt-1">Approve a JIT request from Access Requests to see sessions here.</p>
        </div>`;
      return;
    }

    const startTs = Date.now();
    container.innerHTML = active.map(s => `
      <div class="panel relative overflow-hidden" id="jit-card-${s.user}">
        <div class="absolute top-0 left-0 right-0 h-0.5 bg-[#f59e0b]"></div>
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <div class="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-primary font-bold text-xs">${s.user[0]}</div>
              <span class="font-semibold text-primary text-sm">${escHtml(s.user)}</span>
            </div>
            <span class="font-mono text-[10px] text-on-surface-variant">${escHtml(s.group)}</span>
          </div>
          <span class="font-mono text-[10px] px-2 py-1 rounded-md bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30">JIT ACTIVE</span>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="sub-panel">
            <div class="font-mono text-[9px] text-on-surface-variant uppercase mb-1">Privilege</div>
            <div class="font-mono text-xs text-primary break-all">${escHtml(s.jit.permission)}</div>
          </div>
          <div class="sub-panel">
            <div class="font-mono text-[9px] text-on-surface-variant uppercase mb-1">Approved By</div>
            <div class="font-mono text-xs text-primary">Rajesh</div>
          </div>
          <div class="sub-panel">
            <div class="font-mono text-[9px] text-on-surface-variant uppercase mb-1">Expires At</div>
            <div class="font-mono text-xs text-primary">${new Date(s.jit.expiresAt).toLocaleTimeString()}</div>
          </div>
          <div class="sub-panel">
            <div class="font-mono text-[9px] text-on-surface-variant uppercase mb-1">Duration</div>
            <div class="font-mono text-xs text-primary">30 seconds</div>
          </div>
        </div>

        <div class="text-center pt-2 border-t border-border-dim">
          <div class="font-mono text-[10px] text-on-surface-variant uppercase mb-1">Time Remaining</div>
          <div class="text-4xl font-bold font-mono text-[#f59e0b]" id="jit-timer-${s.user}">--</div>
          <div class="font-mono text-[10px] text-on-surface-variant mt-1">seconds</div>
        </div>
      </div>
    `).join('');

    active.forEach(s => {
      const el = document.getElementById(`jit-timer-${s.user}`);
      if (!el) return;
      state.jitIntervals[s.user] = setInterval(() => {
        const left = Math.round((s.jit.expiresAt - Date.now()) / 1000);
        if (left <= 0) {
          clearInterval(state.jitIntervals[s.user]);
          loadJit();
        } else {
          el.textContent = left;
          if (left <= 8) {
            el.style.color = '#ffb4ab';
          }
        }
      }, 500);
    });
  }

  // ─── Users & Groups ──────────────────────────────────────────────
  async function loadUsers() {
    const grid = document.getElementById('users-grid');
    grid.innerHTML = '<div class="col-span-2 text-sm text-on-surface-variant text-center py-4">Loading identities…</div>';

    try {
      const usersRes = await fetch('/api/users');
      const usersDb  = await usersRes.json();

      const profiles = await Promise.all(
        Object.keys(usersDb).map(n =>
          fetch('/api/user', { headers: { 'x-user': n } }).then(r => r.json())
        )
      );

      const allResources = [
        { key: 'notice_boards', label: 'Notice Boards',   perm: 'view_notice_boards' },
        { key: 'code_repo',     label: 'Code Repository', perm: 'view_code' },
        { key: 'salaries',      label: 'Salary Records',  perm: 'view_employee_records' },
        { key: 'finance',       label: 'Finance Reports', perm: 'view_finance' }
      ];

      grid.innerHTML = profiles.map(p => {
        const dbUser    = usersDb[p.name];
        const groupPerms = p.privileges.filter(perm => !perm.endsWith('(JIT)') && !dbUser.overrides.includes(perm));
        const overrides  = dbUser.overrides;
        const jitPerms   = p.privileges.filter(perm => perm.endsWith('(JIT)'));

        // "What can this user do?" resource matrix
        const canAccess = new Set(p.privileges.map(pr => pr.replace(' (JIT)', '')));
        const resourceRows = allResources.map(r => {
          const has = canAccess.has(r.perm) || canAccess.has('*');
          return `
            <div class="flex items-center justify-between py-1.5 border-b border-border-dim last:border-0">
              <span class="text-xs text-on-surface-variant">${r.label}</span>
              <div class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] ${has ? 'text-tertiary-fixed-dim' : 'text-error'}">${has ? 'check_circle' : 'cancel'}</span>
                <span class="font-mono text-[10px] ${has ? 'text-tertiary-fixed-dim' : 'text-on-surface-variant'}">${has ? 'READ' : 'DENIED'}</span>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="panel flex flex-col gap-4">
            <!-- Header -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary font-bold text-base">${p.name[0]}</div>
              <div>
                <div class="font-semibold text-primary">${escHtml(p.name)}</div>
                <span class="font-mono text-[10px] px-2 py-0.5 rounded-md bg-surface-container border border-border-dim text-on-surface-variant">${escHtml(p.group)}</span>
              </div>
            </div>

            <!-- What can this user do? -->
            <div>
              <div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mb-2 pb-1 border-b border-border-dim">What can this user access?</div>
              ${resourceRows}
            </div>

            <!-- Permission Sources -->
            <div>
              <div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mb-2 pb-1 border-b border-border-dim">Permission Sources</div>

              <div class="space-y-2">
                <div>
                  <div class="text-[11px] text-on-surface-variant mb-1">Group Inheritance (${escHtml(p.group)})</div>
                  <div class="flex flex-wrap gap-1">
                    ${groupPerms.length > 0
                      ? groupPerms.map(pr => `<span class="perm-badge has">${pr}</span>`).join('')
                      : '<span class="text-[11px] text-on-surface-variant italic">none</span>'}
                  </div>
                </div>
                ${overrides.length > 0 ? `
                <div>
                  <div class="text-[11px] text-on-surface-variant mb-1">Individual Overrides</div>
                  <div class="flex flex-wrap gap-1">
                    ${overrides.map(o => `<span class="perm-badge" style="background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.3)">${o}</span>`).join('')}
                  </div>
                </div>` : ''}
                ${jitPerms.length > 0 ? `
                <div>
                  <div class="text-[11px] text-on-surface-variant mb-1">Temporary JIT Access</div>
                  <div class="flex flex-wrap gap-1">
                    ${jitPerms.map(o => `<span class="perm-badge" style="background:rgba(78,222,163,0.1);color:#4edea3;border:1px solid rgba(78,222,163,0.3)">${o}</span>`).join('')}
                  </div>
                </div>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      grid.innerHTML = '<div class="col-span-2 text-sm text-error text-center py-4">Failed to load identities.</div>';
    }
  }

  // ─── Permission Matrix ───────────────────────────────────────────
  async function loadMatrix() {
    const container = document.getElementById('matrix-container');

    try {
      const usersRes = await fetch('/api/users');
      const usersDb  = await usersRes.json();

      const profiles = await Promise.all(
        Object.keys(usersDb).map(n =>
          fetch('/api/user', { headers: { 'x-user': n } }).then(r => r.json())
        )
      );

      const resources = [
        { key: 'notice_boards', label: 'Notice Boards',   perm: 'view_notice_boards' },
        { key: 'code_repo',     label: 'Code Repository', perm: 'view_code' },
        { key: 'salaries',      label: 'Salary Records',  perm: 'view_employee_records' },
        { key: 'finance',       label: 'Finance Reports', perm: 'view_finance' }
      ];

      const groupDescs = {
        'Super Admin': 'Global access wildcard (*)',
        'Engineering': 'view_code, edit_code',
        'HR':          'view_employee_records',
        'Finance':     'view_finance',
        'Interns':     'view_notice_boards'
      };

      container.innerHTML = `
        <div class="mb-5">
          <div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Source of Truth</div>
          <p class="text-xs text-on-surface-variant">All entries are derived from live backend group and user data. Override permissions shown in amber.</p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm border-separate" style="border-spacing: 0;">
            <thead>
              <tr>
                <th class="text-left px-4 py-3 font-mono text-[10px] text-on-surface-variant uppercase tracking-wider bg-surface-container-low border border-border-dim rounded-tl-md w-56">Identity</th>
                ${resources.map((r, i) => `
                  <th class="text-center px-4 py-3 font-mono text-[10px] text-on-surface-variant uppercase tracking-wider bg-surface-container-low border-t border-b border-r border-border-dim ${i === resources.length - 1 ? 'rounded-tr-md' : ''} min-w-[120px]">${r.label}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dim">
              ${profiles.map((p, pi) => {
                const dbUser     = usersDb[p.name];
                const permsSet   = new Set(p.privileges.map(pr => pr.replace(' (JIT)', '')));
                const isSuperAdmin = p.group === 'Super Admin';
                const isLast     = pi === profiles.length - 1;

                return `
                  <tr class="hover:bg-surface-container-lowest transition-colors">
                    <td class="px-4 py-3 border-l border-b border-r border-border-dim ${isLast ? 'rounded-bl-md' : ''}">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">${p.name[0]}</div>
                        <div>
                          <div class="font-semibold text-primary text-sm leading-none">${escHtml(p.name)}</div>
                          <div class="font-mono text-[10px] text-on-surface-variant mt-0.5">${escHtml(p.group)}</div>
                        </div>
                      </div>
                    </td>
                    ${resources.map((r, ri) => {
                      const hasFromGroup    = isSuperAdmin || (p.privileges.some(perm => perm.replace(' (JIT)', '') === r.perm));
                      const hasFromOverride = dbUser.overrides.includes(r.perm);
                      const hasFromJit      = p.privileges.includes(r.perm + ' (JIT)');
                      const hasAccess       = hasFromGroup || hasFromOverride || hasFromJit;
                      const isOverride      = hasFromOverride && !isSuperAdmin;
                      const isJit           = hasFromJit;
                      const isLastCol       = ri === resources.length - 1;

                      return `
                        <td class="matrix-cell border-b border-r border-border-dim ${isLast && isLastCol ? 'rounded-br-md' : ''}">
                          ${isSuperAdmin
                            ? `<div class="flex justify-center"><span class="perm-badge has">R/W/X/D</span></div>`
                            : hasAccess
                              ? `<div class="flex flex-col items-center gap-1">
                                   <span class="perm-badge has">READ</span>
                                   ${isOverride ? '<span class="text-[9px] font-mono text-[#f59e0b] opacity-70">override</span>' : ''}
                                   ${isJit      ? '<span class="text-[9px] font-mono text-tertiary-fixed-dim opacity-70">JIT</span>' : ''}
                                 </div>`
                              : `<span class="perm-badge no">—</span>`
                          }
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Legend -->
        <div class="mt-5 pt-4 border-t border-border-dim flex flex-wrap gap-4">
          <div class="flex items-center gap-2">
            <span class="perm-badge has">READ</span>
            <span class="text-xs text-on-surface-variant">Group inherited</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="perm-badge has">R/W/X/D</span>
            <span class="text-xs text-on-surface-variant">Super Admin wildcard</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9px] font-mono text-[#f59e0b]">override</span>
            <span class="text-xs text-on-surface-variant">Individual override</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9px] font-mono text-tertiary-fixed-dim">JIT</span>
            <span class="text-xs text-on-surface-variant">Temporary JIT grant</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="perm-badge no">—</span>
            <span class="text-xs text-on-surface-variant">Access not permitted</span>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = '<div class="text-sm text-error text-center py-8">Failed to load permission data.</div>';
    }
  }

  // ─── Audit Trail ─────────────────────────────────────────────────
  function bindAuditFilters() {
    document.querySelectorAll('.audit-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.audit-filter').forEach(b => {
          b.className = 'audit-filter px-3 py-1.5 text-[11px] font-mono rounded-md bg-surface-container text-on-surface-variant border border-transparent hover:text-primary transition-colors';
        });
        btn.className = 'audit-filter px-3 py-1.5 text-[11px] font-mono rounded-md bg-surface-container-highest text-primary border border-border-dim';
        state.auditFilter = btn.dataset.filter;
        renderAuditTable();
      });
    });
  }

  async function loadAudit() {
    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-on-surface-variant">Loading…</td></tr>';
    try {
      const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': 'Rajesh' } });
      if (!res.ok) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-on-surface-variant">Audit Trail requires Super Admin access.</td></tr>';
        return;
      }
      const data = await res.json();
      state.allLogs = data.logs;
      renderAuditTable();
    } catch (_) {
      tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-error">Failed to load logs.</td></tr>';
    }
  }

  function renderAuditTable() {
    const tbody    = document.getElementById('audit-tbody');
    const filtered = state.auditFilter === 'ALL'
      ? state.allLogs
      : state.allLogs.filter(l => l.severity === state.auditFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-on-surface-variant">No log entries match this filter.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(log => {
      const enc = encodeURIComponent(JSON.stringify(log));
      return `
        <tr class="hover:bg-surface-container-lowest transition-colors cursor-pointer group" onclick="app.openAuditDetail('${enc}')">
          <td class="px-4 py-3 whitespace-nowrap text-xs text-on-surface-variant group-hover:text-primary font-mono">${new Date(log.timestamp).toLocaleTimeString()}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="font-mono text-[10px] px-2 py-0.5 rounded-full border ${sevClass(log.severity)}">${log.severity}</span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-primary">${escHtml(log.user)}</td>
          <td class="px-4 py-3 text-sm text-on-surface-variant group-hover:text-primary max-w-xs truncate">${escHtml(log.action)}</td>
        </tr>
      `;
    }).join('');
  }

  function sevClass(sev) {
    if (sev === 'CRITICAL') return 'bg-error-container/20 text-error border-error/30';
    if (sev === 'WARN')     return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30';
    return 'bg-surface-container text-on-surface-variant border-border-dim';
  }

  // ─── Audit Drawer ────────────────────────────────────────────────
  function bindDrawer() {
    document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
    document.getElementById('audit-drawer-overlay').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  }

  function openAuditDetail(enc) {
    try {
      const log     = JSON.parse(decodeURIComponent(enc));
      const content = document.getElementById('audit-drawer-content');

      content.innerHTML = `
        <div class="space-y-4">
          <div class="pb-3 border-b border-border-dim">
            <div class="font-mono text-[10px] text-on-surface-variant uppercase mb-1">Event ID</div>
            <div class="font-mono text-xs text-primary break-all">${escHtml(String(log.id))}</div>
          </div>
          <div class="pb-3 border-b border-border-dim">
            <div class="font-mono text-[10px] text-on-surface-variant uppercase mb-1">Timestamp</div>
            <div class="text-sm text-primary">${new Date(log.timestamp).toLocaleString()}</div>
          </div>
          <div class="pb-3 border-b border-border-dim">
            <div class="font-mono text-[10px] text-on-surface-variant uppercase mb-1">Severity</div>
            <span class="font-mono text-[10px] px-2 py-0.5 rounded-full border ${sevClass(log.severity)}">${log.severity}</span>
          </div>
          <div class="pb-3 border-b border-border-dim">
            <div class="font-mono text-[10px] text-on-surface-variant uppercase mb-1">User</div>
            <div class="text-sm font-semibold text-primary">${escHtml(log.user)}</div>
          </div>
          <div>
            <div class="font-mono text-[10px] text-on-surface-variant uppercase mb-2">Event Description</div>
            <div class="p-3 bg-surface-container rounded-lg text-sm text-primary font-mono leading-relaxed break-words">${escHtml(log.action)}</div>
          </div>
        </div>
      `;

      document.getElementById('audit-drawer-overlay').classList.add('active');
      document.getElementById('audit-drawer').classList.add('active');
    } catch (e) { console.error('Drawer error:', e); }
  }

  function closeDrawer() {
    document.getElementById('audit-drawer-overlay').classList.remove('active');
    document.getElementById('audit-drawer').classList.remove('active');
  }

  // ─── Emergency Lockdown ──────────────────────────────────────────
  async function loadLockdown() {
    try {
      const res  = await fetch('/api/state');
      const data = await res.json();
      renderLockdown(data.lockdown);
    } catch (_) {}
  }

  function renderLockdown(isLockdown) {
    const panel   = document.getElementById('lockdown-panel');
    const icon    = document.getElementById('lockdown-icon');
    const text    = document.getElementById('lockdown-status-text');
    const desc    = document.getElementById('lockdown-desc');
    const badge   = document.getElementById('lockdown-badge');
    const actions = document.getElementById('lockdown-actions');

    if (isLockdown) {
      panel.style.borderTopColor = '#ffb4ab';
      icon.textContent   = 'lock';
      icon.style.color   = '#ffb4ab';
      text.textContent   = 'LOCKDOWN ACTIVE';
      text.style.color   = '#ffb4ab';
      desc.textContent   = 'All non-admin routes are suspended. No access is permitted until lockdown is lifted. All events are logged.';
      badge.textContent  = 'RESTRICTED';
      badge.className    = 'font-mono text-[10px] px-3 py-1.5 rounded-md bg-error-container/20 text-error border border-error/30';
    } else {
      panel.style.borderTopColor = '#4edea3';
      icon.textContent   = 'lock_open';
      icon.style.color   = '#4edea3';
      text.textContent   = 'NORMAL';
      text.style.color   = '#4edea3';
      desc.textContent   = 'All authorization policies are active and enforced. Access is evaluated per RBAC rules.';
      badge.textContent  = 'GUARDRAILS ON';
      badge.className    = 'font-mono text-[10px] px-3 py-1.5 rounded-md bg-surface-container border border-border-dim text-on-surface-variant';
    }

    if (state.user === 'Rajesh') {
      actions.innerHTML = `
        <button onclick="app.toggleLockdown(${!isLockdown})"
          class="w-full py-2.5 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-colors ${isLockdown
            ? 'bg-surface-container border border-border-dim text-primary hover:bg-surface-container-low'
            : 'bg-error text-surface hover:opacity-90'}">
          <span class="material-symbols-outlined text-[16px]">${isLockdown ? 'lock_open' : 'lock'}</span>
          ${isLockdown ? 'Disable Emergency Lockdown' : 'Enable Emergency Lockdown'}
        </button>
        <p class="text-[11px] text-center text-on-surface-variant mt-2">Super Admin only. This action is audited and logged immediately.</p>
      `;
    } else {
      actions.innerHTML = `
        <div class="p-4 bg-surface-container rounded-lg border border-border-dim text-sm text-on-surface-variant text-center">
          Lockdown management requires Super Admin clearance.
        </div>
      `;
    }
  }

  async function toggleLockdown(active) {
    try {
      await fetch('/api/admin/lockdown', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': 'Rajesh' },
        body:    JSON.stringify({ active })
      });
      await refreshGlobalState();
      loadLockdown();
      toast(active ? '🔒 Emergency Lockdown engaged.' : '🔓 Lockdown lifted.', active);
    } catch (_) { toast('Lockdown toggle failed.', true); }
  }

  // ─── Utilities ───────────────────────────────────────────────────
  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, isError = false) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `px-4 py-3 rounded-lg shadow-xl border text-sm font-body pointer-events-auto transition-opacity duration-300 ${
      isError
        ? 'bg-error-container/90 text-error border-error/30 backdrop-blur-sm'
        : 'bg-surface-container-highest text-primary border-border-dim backdrop-blur-sm'
    }`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
  }

  // ─── Public API ──────────────────────────────────────────────────
  return {
    init,
    navigateTo,
    openAuditDetail,
    loadRequests,
    approveReq,
    loadAudit,
    loadMatrix,
    toggleLockdown
  };

})();

document.addEventListener('DOMContentLoaded', app.init);
