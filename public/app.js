const app = (function() {
  const state = {
    user: 'Rajesh',
    view: 'dashboard',
    auditFilter: 'ALL',
    allLogs: [],
    jitIntervals: {}
  };

  const RESOURCE_MAP = {
    notice_boards: 'Notice Boards',
    code_repo: 'Code Repository',
    salaries: 'Salary Records',
    finance: 'Finance Reports'
  };

  function init() {
    bindEvents();
    refreshIdentity();
    refreshGlobalState();
    loadView('dashboard');
    setInterval(refreshGlobalState, 4000);
  }

  function bindEvents() {
    // Nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.view));
    });

    // Identity Switcher
    document.getElementById('global-identity-select').addEventListener('change', (e) => {
      state.user = e.target.value;
      refreshIdentity();
      refreshGlobalState();
      loadView(state.view);
    });

    // Simulator
    document.getElementById('sim-eval-btn').addEventListener('click', runSimulator);

    // Requests
    document.getElementById('req-submit-btn').addEventListener('click', submitJitRequest);
    document.getElementById('req-stage-btn').addEventListener('click', stageSalary);

    // Audit Filters
    document.querySelectorAll('.audit-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.audit-filter').forEach(b => {
          b.className = 'audit-filter px-3 py-1 text-xs font-mono rounded bg-surface-container text-on-surface-variant border border-transparent hover:text-primary';
        });
        btn.className = 'audit-filter px-3 py-1 text-xs font-mono rounded bg-surface-container-highest text-primary border border-border-dim';
        state.auditFilter = btn.dataset.filter;
        renderAuditTable();
      });
    });

    // Drawer Close
    document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
    document.getElementById('audit-drawer-overlay').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDrawer(); });
  }

  function navigateTo(view) {
    state.view = view;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    document.querySelectorAll('.view-section').forEach(el => {
      el.classList.toggle('active', el.id === `view-${view}`);
    });
    loadView(view);
  }

  async function refreshIdentity() {
    try {
      const res = await fetch('/api/user', { headers: { 'x-user': state.user } });
      const user = await res.json();
      
      document.getElementById('sidebar-name').textContent = user.name;
      document.getElementById('sidebar-role').textContent = user.group;
      document.getElementById('sidebar-avatar').textContent = user.name[0];
      
      const isAdmin = user.group === 'Super Admin';
      document.getElementById('nav-admin-governance').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('nav-admin-system').style.display = isAdmin ? 'block' : 'none';
      
      document.getElementById('global-identity-select').value = state.user;
    } catch(e) {}
  }

  async function refreshGlobalState() {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();

      // Lockdown Banner & Sidebar Indicator
      const banner = document.getElementById('global-lockdown-banner');
      const sideText = document.getElementById('sidebar-status-text');
      const sideDot = document.getElementById('sidebar-status-dot');
      
      if (data.lockdown) {
        banner.classList.remove('hidden');
        sideText.textContent = 'LOCKDOWN ACTIVE';
        sideText.className = 'font-mono text-[10px] text-error font-bold tracking-wide';
        sideDot.className = 'w-2 h-2 rounded-full bg-error animate-pulse';
        sideDot.parentElement.className = 'flex items-center gap-2 px-2 py-1 rounded bg-error-container/20 border border-error/30';
      } else {
        banner.classList.add('hidden');
        sideText.textContent = 'SYSTEM SECURE';
        sideText.className = 'font-mono text-[10px] text-tertiary-fixed-dim font-bold tracking-wide';
        sideDot.className = 'w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse';
        sideDot.parentElement.className = 'flex items-center gap-2 px-2 py-1 rounded bg-[#041c14] border border-[#064e3b]';
      }

      // Update Dashboard Metrics if view is active
      if (state.view === 'dashboard') {
        document.getElementById('dash-metric-pending').textContent = data.pendingCount;
        document.getElementById('dash-metric-jit').textContent = data.jitCount;
      }
    } catch(e) {}
  }

  function loadView(view) {
    switch(view) {
      case 'dashboard': loadDashboard(); break;
      case 'requests': loadRequests(); break;
      case 'jit': loadJit(); break;
      case 'users': loadUsers(); break;
      case 'audit': loadAudit(); break;
      case 'lockdown': loadLockdown(); break;
    }
  }

  // --- DASHBOARD ---
  async function loadDashboard() {
    try {
      const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': state.user } });
      const recentList = document.getElementById('dash-recent-activity');
      const healthList = document.getElementById('dash-system-health');
      const stateRes = await fetch('/api/state');
      const sysState = await stateRes.json();
      
      // Health
      healthList.innerHTML = `
        <div class="flex justify-between items-center p-2 rounded bg-surface-container-lowest border border-border-dim">
          <span class="text-sm text-on-surface-variant">Authorization Engine</span>
          <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim"></span><span class="font-mono text-[10px] text-primary">Operational</span></div>
        </div>
        <div class="flex justify-between items-center p-2 rounded bg-surface-container-lowest border border-border-dim">
          <span class="text-sm text-on-surface-variant">Lockdown Status</span>
          <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${sysState.lockdown ? 'bg-error' : 'bg-tertiary-fixed-dim'}"></span><span class="font-mono text-[10px] text-primary">${sysState.lockdown ? 'ACTIVE' : 'Normal'}</span></div>
        </div>
      `;
      
      const badge = document.getElementById('dash-health-badge');
      if (sysState.lockdown) {
        badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded bg-error-container/20 text-error border border-error/30';
        badge.innerHTML = '<span class="font-mono text-[10px] font-semibold tracking-wide">LOCKDOWN</span>';
      } else {
        badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#041c14] text-tertiary-fixed-dim border border-[#064e3b]';
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse"></span><span class="font-mono text-[10px] font-semibold tracking-wide">HEALTHY</span>';
      }

      if (!res.ok) {
        recentList.innerHTML = '<div class="text-sm text-on-surface-variant py-4 text-center">Recent activity requires Super Admin clearance.</div>';
        document.getElementById('dash-metric-critical').textContent = '-';
        return;
      }
      
      const data = await res.json();
      document.getElementById('dash-metric-critical').textContent = data.logs.filter(l => l.severity === 'CRITICAL').length;
      
      const recent = data.logs.slice(0, 5);
      if (recent.length === 0) {
        recentList.innerHTML = '<div class="text-sm text-on-surface-variant py-4 text-center">No activity.</div>';
      } else {
        recentList.innerHTML = recent.map(log => `
          <div class="flex items-center justify-between p-3 rounded bg-surface-container-lowest border border-border-dim">
            <div class="flex flex-col">
              <span class="font-medium text-sm text-primary">${log.user}</span>
              <span class="text-xs text-on-surface-variant truncate w-64">${log.action}</span>
            </div>
            <span class="font-mono text-[10px] px-2 py-0.5 rounded ${getSeverityClass(log.severity)}">${log.severity}</span>
          </div>
        `).join('');
      }
    } catch(e) {}
  }

  // --- SIMULATOR ---
  async function runSimulator() {
    const user = document.getElementById('sim-user').value;
    const resource = document.getElementById('sim-resource').value;
    const btn = document.getElementById('sim-eval-btn');
    
    btn.textContent = 'Evaluating...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, resource })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      const t = data.trace;
      const stepClass = (pass) => pass ? "border-tertiary-fixed-dim bg-[#041c14] text-tertiary-fixed-dim" : "border-border-dim bg-surface-container text-on-surface-variant";
      const finalClass = data.granted ? "border-tertiary-fixed-dim bg-[#041c14] text-tertiary-fixed-dim" : "border-error/30 bg-error-container/20 text-error";

      document.getElementById('sim-result-container').innerHTML = `
        <div class="h-full flex flex-col">
          <div class="mb-6 pb-6 border-b border-border-dim text-center">
            <div class="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">Final Decision</div>
            <div class="text-3xl font-bold tracking-tight ${data.granted ? 'text-tertiary-fixed-dim' : 'text-error'}">
              ${data.granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
            </div>
            <div class="text-sm mt-2 text-primary font-medium">${data.lockdownBlock ? 'Blocked by Emergency Lockdown' : (data.granted ? `Via ${data.grantSource}` : 'No matching permission')}</div>
          </div>
          
          <div class="flex-1 relative ml-2">
            <div class="font-mono text-[10px] text-on-surface-variant uppercase mb-4 tracking-wider">Decision Trace</div>
            
            <div class="space-y-4 relative z-10">
              <div class="trace-step relative flex gap-4">
                <div class="trace-connector"></div>
                <div class="w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[10px] z-10 ${stepClass(true)}">1</div>
                <div class="flex-1 pb-2">
                  <div class="text-sm font-semibold text-primary">Identity</div>
                  <div class="text-xs text-on-surface-variant">${user} verified</div>
                </div>
              </div>
              <div class="trace-step relative flex gap-4">
                <div class="trace-connector"></div>
                <div class="w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[10px] z-10 ${stepClass(true)}">2</div>
                <div class="flex-1 pb-2">
                  <div class="text-sm font-semibold text-primary">Group Membership</div>
                  <div class="text-xs text-on-surface-variant">Member of ${t.group}</div>
                </div>
              </div>
              <div class="trace-step relative flex gap-4">
                <div class="trace-connector"></div>
                <div class="w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[10px] z-10 ${stepClass(t.groupMatch)}">3</div>
                <div class="flex-1 pb-2">
                  <div class="text-sm font-semibold text-primary">Inherited Permissions</div>
                  <div class="text-xs text-on-surface-variant">${t.groupMatch ? `Matched required <code>${t.requiredPermission}</code>` : 'No group permission matched'}</div>
                </div>
              </div>
              <div class="trace-step relative flex gap-4">
                <div class="trace-connector"></div>
                <div class="w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[10px] z-10 ${stepClass(t.overrideMatch)}">4</div>
                <div class="flex-1 pb-2">
                  <div class="text-sm font-semibold text-primary">User Overrides</div>
                  <div class="text-xs text-on-surface-variant">${t.overrideMatch ? 'Explicit override present' : 'No explicit override'}</div>
                </div>
              </div>
              <div class="trace-step relative flex gap-4">
                <div class="trace-connector"></div>
                <div class="w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[10px] z-10 ${stepClass(t.jitActive)}">5</div>
                <div class="flex-1 pb-2">
                  <div class="text-sm font-semibold text-primary">JIT Session</div>
                  <div class="text-xs text-on-surface-variant">${t.jitActive ? 'Active temporary grant' : 'No active JIT'}</div>
                </div>
              </div>
              <div class="trace-step relative flex gap-4">
                <div class="w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[10px] z-10 ${finalClass}">6</div>
                <div class="flex-1">
                  <div class="text-sm font-semibold text-primary">Final Verdict</div>
                  <div class="text-xs text-on-surface-variant">${data.granted ? 'Permitted' : 'Blocked'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch(e) {
      toast(e.message, true);
    } finally {
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">terminal</span> Evaluate Access`;
      btn.disabled = false;
    }
  }

  // --- REQUESTS ---
  async function loadRequests() {
    document.getElementById('req-identity-label').textContent = state.user;
    
    // Maker Checker Panel
    document.getElementById('req-maker-panel').style.display = state.user === 'Priya' ? 'block' : 'none';

    // Admin Queue
    const qPanel = document.getElementById('req-approval-queue-panel');
    const qList = document.getElementById('req-approval-list');
    
    if (state.user === 'Rajesh') {
      qPanel.style.display = 'block';
      try {
        const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': 'Rajesh' } });
        const data = await res.json();
        
        if (data.approvals.length === 0) {
          qList.innerHTML = '<div class="text-sm text-on-surface-variant">No pending requests in queue.</div>';
        } else {
          qList.innerHTML = data.approvals.map(a => `
            <div class="flex items-center justify-between p-4 bg-surface-container-lowest border border-border-dim rounded">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-0.5 font-mono text-[10px] rounded ${a.type==='JIT'?'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30':'bg-blue-500/20 text-blue-400 border border-blue-500/30'}">${a.type}</span>
                  <span class="font-medium text-sm text-primary">${a.user}</span>
                </div>
                <div class="text-xs text-on-surface-variant">${a.permission || 'Salary modification (+8000)'}</div>
              </div>
              <div class="flex gap-2">
                <button class="px-3 py-1 bg-surface-container hover:bg-error-container/40 text-error rounded text-xs font-medium border border-transparent hover:border-error/30 transition-colors" onclick="app.approveReq('${a.id}', false)">Deny</button>
                <button class="px-3 py-1 bg-primary hover:bg-gray-200 text-surface rounded text-xs font-semibold transition-colors" onclick="app.approveReq('${a.id}', true)">Approve</button>
              </div>
            </div>
          `).join('');
        }
      } catch(e) {}
    } else {
      qPanel.style.display = 'none';
    }
  }

  async function submitJitRequest() {
    const res = document.getElementById('req-resource').value;
    try {
      const response = await fetch('/api/access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': state.user },
        body: JSON.stringify({ resource: res })
      });
      const data = await response.json();
      toast(data.message);
      refreshGlobalState();
    } catch(e) {}
  }

  async function stageSalary() {
    try {
      const d = await fetch('/api/data/salaries', { headers: { 'x-user': state.user } });
      const { data } = await d.json();
      data[0].amount += 8000;
      
      const response = await fetch('/api/salary/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': state.user },
        body: JSON.stringify({ changes: data })
      });
      const json = await response.json();
      toast(json.message || json.error, !!json.error);
      refreshGlobalState();
    } catch(e) {}
  }

  async function approveReq(id, approved) {
    try {
      await fetch(`/api/admin/approve/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': 'Rajesh' },
        body: JSON.stringify({ approved })
      });
      toast(approved ? 'Request approved.' : 'Request denied.');
      loadRequests();
      refreshGlobalState();
    } catch(e) {}
  }

  // --- JIT ---
  async function loadJit() {
    const list = document.getElementById('jit-list');
    
    // Check all users
    const users = ['Rajesh', 'Vikram', 'Rahul', 'Priya', 'Sneha'];
    const active = [];
    
    for (const u of users) {
      const r = await fetch('/api/user', { headers: { 'x-user': u } });
      const data = await r.json();
      if (data.jit) active.push({ user: u, jit: data.jit });
    }

    if (active.length === 0) {
      list.innerHTML = '<div class="col-span-2 p-8 text-center text-on-surface-variant border border-border-dim rounded bg-surface-container-lowest text-sm">No active JIT sessions found.</div>';
      return;
    }

    list.innerHTML = active.map(s => `
      <div class="p-6 bg-surface-container-lowest border border-border-dim rounded flex flex-col items-center justify-center relative overflow-hidden" id="jit-card-${s.user}">
        <div class="absolute top-0 w-full h-1 bg-[#f59e0b]"></div>
        <div class="text-sm font-medium text-primary mb-1">${s.user}</div>
        <div class="text-xs text-on-surface-variant mb-4">${s.jit.permission}</div>
        <div class="text-4xl font-mono tracking-tight font-bold text-[#f59e0b]" id="jit-timer-${s.user}">--</div>
        <div class="text-[10px] font-mono text-on-surface-variant uppercase mt-2">Seconds Remaining</div>
      </div>
    `).join('');

    Object.values(state.jitIntervals).forEach(clearInterval);
    state.jitIntervals = {};

    active.forEach(s => {
      const el = document.getElementById(`jit-timer-${s.user}`);
      state.jitIntervals[s.user] = setInterval(() => {
        const left = Math.round((s.jit.expiresAt - Date.now()) / 1000);
        if (left <= 0) {
          clearInterval(state.jitIntervals[s.user]);
          loadJit(); // reload
        } else {
          el.textContent = left;
          if (left <= 10) el.className = 'text-4xl font-mono tracking-tight font-bold text-error animate-pulse';
        }
      }, 500);
    });
  }

  // --- USERS ---
  async function loadUsers() {
    try {
      const res = await fetch('/api/users');
      const users = await res.json();
      
      const profiles = await Promise.all(
        Object.keys(users).map(n => fetch('/api/user', { headers: { 'x-user': n } }).then(r=>r.json()))
      );

      document.getElementById('users-grid').innerHTML = profiles.map(p => {
        const dbUser = users[p.name];
        const groupPerms = p.privileges.filter(perm => !perm.endsWith('(JIT)') && !dbUser.overrides.includes(perm));
        
        return `
          <div class="panel h-full flex flex-col">
            <div class="flex items-center gap-4 mb-6">
              <div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-xl font-bold text-primary">${p.name[0]}</div>
              <div>
                <h3 class="text-lg font-semibold text-primary">${p.name}</h3>
                <span class="text-xs text-on-surface-variant px-2 py-0.5 rounded bg-surface-container border border-border-dim">${p.group}</span>
              </div>
            </div>
            
            <div class="flex-1 space-y-4">
              <div>
                <div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mb-2 border-b border-border-dim pb-1">Inherited Group Privileges</div>
                <div class="flex flex-wrap gap-2">
                  ${groupPerms.map(pr => `<span class="px-2 py-1 bg-surface-container rounded text-xs text-primary border border-border-dim">${pr}</span>`).join('') || '<span class="text-xs text-on-surface-variant italic">None</span>'}
                </div>
              </div>
              
              ${dbUser.overrides.length > 0 ? `
              <div>
                <div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mb-2 border-b border-border-dim pb-1">Individual Overrides</div>
                <div class="flex flex-wrap gap-2">
                  ${dbUser.overrides.map(o => `<span class="px-2 py-1 bg-[#f59e0b]/10 rounded text-xs text-[#f59e0b] border border-[#f59e0b]/30">${o}</span>`).join('')}
                </div>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch(e) {}
  }

  // --- AUDIT ---
  async function loadAudit() {
    try {
      const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': 'Rajesh' } });
      const tbody = document.getElementById('audit-tbody');
      
      if (!res.ok) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-sm text-on-surface-variant">Requires Super Admin access.</td></tr>';
        return;
      }
      
      const data = await res.json();
      state.allLogs = data.logs;
      renderAuditTable();
    } catch(e) {}
  }

  function renderAuditTable() {
    const tbody = document.getElementById('audit-tbody');
    const filtered = state.auditFilter === 'ALL' ? state.allLogs : state.allLogs.filter(l => l.severity === state.auditFilter);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-sm text-on-surface-variant">No logs match filter.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(log => {
      const str = encodeURIComponent(JSON.stringify(log));
      return `
        <tr class="hover:bg-surface-container-low transition-colors cursor-pointer group" onclick="app.openAuditDetail('${str}')">
          <td class="px-4 py-3 whitespace-nowrap text-on-surface-variant group-hover:text-primary">${new Date(log.timestamp).toLocaleTimeString()}</td>
          <td class="px-4 py-3 whitespace-nowrap"><span class="font-mono text-[10px] px-2 py-0.5 rounded ${getSeverityClass(log.severity)}">${log.severity}</span></td>
          <td class="px-4 py-3 whitespace-nowrap font-medium text-primary">${log.user}</td>
          <td class="px-4 py-3 text-on-surface-variant group-hover:text-primary truncate max-w-sm">${log.action}</td>
        </tr>
      `;
    }).join('');
  }

  function getSeverityClass(sev) {
    if (sev === 'CRITICAL') return 'bg-error-container/20 text-error border border-error/30';
    if (sev === 'WARN') return 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30';
    return 'bg-surface-container text-on-surface-variant border border-border-dim';
  }

  window.openAuditDetail = function(enc) {
    try {
      const log = JSON.parse(decodeURIComponent(enc));
      const content = document.getElementById('audit-drawer-content');
      content.innerHTML = `
        <div class="space-y-4">
          <div class="pb-3 border-b border-border-dim">
            <span class="block font-mono text-[10px] text-on-surface-variant uppercase mb-1">Event ID</span>
            <span class="font-mono text-xs text-primary">${log.id}</span>
          </div>
          <div class="pb-3 border-b border-border-dim">
            <span class="block font-mono text-[10px] text-on-surface-variant uppercase mb-1">Timestamp</span>
            <span class="text-sm text-primary">${new Date(log.timestamp).toLocaleString()}</span>
          </div>
          <div class="pb-3 border-b border-border-dim">
            <span class="block font-mono text-[10px] text-on-surface-variant uppercase mb-1">Severity</span>
            <span class="font-mono text-[10px] px-2 py-0.5 rounded inline-block ${getSeverityClass(log.severity)}">${log.severity}</span>
          </div>
          <div class="pb-3 border-b border-border-dim">
            <span class="block font-mono text-[10px] text-on-surface-variant uppercase mb-1">User</span>
            <span class="text-sm text-primary font-medium">${log.user}</span>
          </div>
          <div>
            <span class="block font-mono text-[10px] text-on-surface-variant uppercase mb-1">Action Details</span>
            <div class="p-3 bg-surface-container rounded text-sm text-primary font-mono leading-relaxed break-words">${log.action}</div>
          </div>
        </div>
      `;
      document.getElementById('audit-drawer-overlay').classList.add('active');
      document.getElementById('audit-drawer').classList.add('active');
    } catch(e) { console.error(e); }
  }

  function closeDrawer() {
    document.getElementById('audit-drawer-overlay').classList.remove('active');
    document.getElementById('audit-drawer').classList.remove('active');
  }

  // --- LOCKDOWN ---
  async function loadLockdown() {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      
      const panel = document.getElementById('lockdown-panel');
      const icon = document.getElementById('lockdown-icon');
      const text = document.getElementById('lockdown-status-text');
      const desc = document.getElementById('lockdown-desc');
      const badge = document.getElementById('lockdown-badge');
      const acts = document.getElementById('lockdown-actions');
      
      if (data.lockdown) {
        panel.style.borderTopColor = '#ffb4ab'; // error
        icon.textContent = 'lock';
        icon.style.color = '#ffb4ab';
        text.textContent = 'LOCKDOWN ACTIVE';
        text.style.color = '#ffb4ab';
        desc.textContent = 'All non-admin routes suspended. Security posture escalated.';
        badge.textContent = 'RESTRICTED';
        badge.className = 'font-mono text-[10px] px-2 py-1 rounded bg-error-container/20 text-error border border-error/30';
      } else {
        panel.style.borderTopColor = '#4edea3'; // tertiary
        icon.textContent = 'lock_open';
        icon.style.color = '#4edea3';
        text.textContent = 'NORMAL';
        text.style.color = '#4edea3';
        desc.textContent = 'All authorization policies are active and enforced.';
        badge.textContent = 'GUARDRAILS ON';
        badge.className = 'font-mono text-[10px] px-2 py-1 rounded bg-surface-container text-on-surface-variant border border-border-dim';
      }
      
      if (state.user === 'Rajesh') {
        acts.innerHTML = `
          <button class="w-full py-3 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors ${data.lockdown ? 'bg-surface-container border border-border-dim text-primary hover:bg-[#201f22]' : 'bg-error text-surface hover:bg-[#ffb4ab]/90'}" onclick="app.toggleLockdown(${!data.lockdown})">
            <span class="material-symbols-outlined text-[18px]">lock</span> ${data.lockdown ? 'Disable Emergency Lockdown' : 'Enable Emergency Lockdown'}
          </button>
          <p class="text-xs text-center text-on-surface-variant mt-3">Action requires Super Admin clearance and is logged.</p>
        `;
      } else {
        acts.innerHTML = `<p class="text-sm text-on-surface-variant italic p-4 bg-surface-container rounded text-center">Lockdown management requires Super Admin clearance.</p>`;
      }
    } catch(e) {}
  }

  async function toggleLockdown(active) {
    try {
      await fetch('/api/admin/lockdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user': 'Rajesh' },
        body: JSON.stringify({ active })
      });
      loadLockdown();
      refreshGlobalState();
      toast(active ? 'Lockdown engaged.' : 'Lockdown lifted.', active);
    } catch(e) {}
  }

  // --- UTILS ---
  function toast(msg, isError = false) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `px-4 py-3 rounded shadow-lg border ${isError ? 'bg-[#93000a] text-[#ffdad6] border-[#ffb4ab]/30' : 'bg-surface-container-highest text-primary border-border-dim'} font-body text-sm animate-[fadeIn_0.2s_ease]`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  return { init, navigateTo, openAuditDetail, loadRequests, approveReq, loadAudit, toggleLockdown };
})();

document.addEventListener('DOMContentLoaded', app.init);
