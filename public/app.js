document.addEventListener('DOMContentLoaded', () => {
    const userSelect = document.getElementById('user-select');
    const navLinks = document.querySelectorAll('#nav-links a');
    const dataContainer = document.getElementById('data-container');
    const lockedView = document.getElementById('locked-view');
    const adminConsole = document.getElementById('admin-console');
    const pageTitle = document.getElementById('page-title');
    
    // Profile Card
    const pName = document.getElementById('profile-name');
    const pGroup = document.getElementById('profile-group');
    const pPrivs = document.getElementById('profile-privileges');
    
    // JIT Timer
    const jitContainer = document.getElementById('jit-timer-container');
    const jitTimer = document.getElementById('jit-timer');
    
    let currentUser = userSelect.value;
    let currentResource = 'notice_boards';
    let currentView = 'data'; // 'data' or 'admin'
    let jitInterval;

    // Load initial user
    fetchUserContext();

    userSelect.addEventListener('change', (e) => {
        currentUser = e.target.value;
        fetchUserContext();
    });

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            
            pageTitle.textContent = e.target.textContent;
            
            if (e.target.getAttribute('data-view') === 'admin') {
                currentView = 'admin';
                loadAdminConsole();
            } else {
                currentView = 'data';
                currentResource = e.target.getAttribute('data-resource');
                fetchData(currentResource);
            }
        });
    });

    document.getElementById('request-access-btn').addEventListener('click', async () => {
        const res = await fetch('/api/access/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user': currentUser },
            body: JSON.stringify({ resource: currentResource })
        });
        const data = await res.json();
        alert(data.message);
    });

    async function fetchUserContext() {
        const res = await fetch('/api/user', { headers: { 'x-user': currentUser } });
        const user = await res.json();
        
        pName.textContent = user.name;
        pGroup.textContent = user.group;
        pPrivs.innerHTML = user.privileges.map(p => `<li>${p}</li>`).join('');
        
        // Hide admin panel link if not Super Admin
        document.getElementById('admin-nav-item').style.display = user.group === 'Super Admin' ? 'block' : 'none';
        
        manageJITTimer(user.jit);

        if (currentView === 'data') {
            fetchData(currentResource);
        } else {
            loadAdminConsole();
        }
    }

    function manageJITTimer(jit) {
        clearInterval(jitInterval);
        if (!jit) {
            jitContainer.classList.add('hidden');
            return;
        }
        
        jitContainer.classList.remove('hidden');
        jitInterval = setInterval(() => {
            const left = Math.round((jit.expiresAt - Date.now()) / 1000);
            if (left <= 0) {
                clearInterval(jitInterval);
                jitContainer.classList.add('hidden');
                fetchUserContext(); // Re-fetch to clear permissions and kick out
            } else {
                jitTimer.textContent = `${left}s`;
            }
        }, 1000);
    }

    async function fetchData(resource) {
        adminConsole.classList.add('hidden');
        dataContainer.classList.add('hidden');
        lockedView.classList.add('hidden');

        const res = await fetch(`/api/data/${resource}`, { headers: { 'x-user': currentUser } });
        
        if (res.status === 403) {
            const err = await res.json();
            document.getElementById('req-perm').textContent = err.requiredPerm;
            lockedView.classList.remove('hidden');
        } else {
            const data = await res.json();
            dataContainer.innerHTML = `<div class="data-card"><pre>${JSON.stringify(data.data, null, 2)}</pre></div>`;
            
            // If Priya is viewing salaries, inject a Maker-Checker edit button
            if (resource === 'salaries' && currentUser === 'Priya') {
                dataContainer.innerHTML += `<button id="edit-salary-btn" class="btn btn-success" style="margin-top:1rem">Modify Salary (+10%) [Maker-Checker]</button>`;
                document.getElementById('edit-salary-btn').addEventListener('click', async () => {
                    const newSalaries = JSON.parse(JSON.stringify(data.data));
                    newSalaries[0].amount += 8000;
                    
                    const editRes = await fetch('/api/salary/edit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-user': currentUser },
                        body: JSON.stringify({ changes: newSalaries })
                    });
                    const editData = await editRes.json();
                    alert(editData.message);
                });
            }
            
            dataContainer.classList.remove('hidden');
        }
    }

    // --- Admin Console Logic ---
    async function loadAdminConsole() {
        dataContainer.classList.add('hidden');
        lockedView.classList.add('hidden');
        adminConsole.classList.remove('hidden');

        const res = await fetch('/api/admin/dashboard', { headers: { 'x-user': currentUser } });
        if (res.status === 403) {
            adminConsole.innerHTML = "<h3>Access Denied</h3>";
            return;
        }
        
        const data = await res.json();
        
        // Lockdown button
        const lBtn = document.getElementById('toggle-lockdown-btn');
        lBtn.textContent = data.lockdown ? "DISABLE LOCKDOWN" : "ENABLE LOCKDOWN";
        lBtn.className = data.lockdown ? "btn" : "btn btn-danger";
        lBtn.onclick = async () => {
            await fetch('/api/admin/lockdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user': currentUser },
                body: JSON.stringify({ active: !data.lockdown })
            });
            loadAdminConsole();
        };

        // Approvals
        const appQueue = document.getElementById('approvals-queue');
        appQueue.innerHTML = '';
        if (data.approvals.length === 0) appQueue.innerHTML = '<p>No pending approvals.</p>';
        data.approvals.forEach(app => {
            appQueue.innerHTML += `
                <div class="approval-item">
                    <div>
                        <strong>${app.type}</strong> from <em>${app.user}</em><br>
                        ${app.permission ? 'Req: ' + app.permission : 'Staged Changes'}
                    </div>
                    <div>
                        <button onclick="approveReq('${app.id}', true)" class="btn btn-success">Approve</button>
                        <button onclick="approveReq('${app.id}', false)" class="btn btn-danger">Deny</button>
                    </div>
                </div>
            `;
        });

        // Logs
        const logsBody = document.getElementById('audit-logs-body');
        logsBody.innerHTML = '';
        data.logs.forEach(log => {
            logsBody.innerHTML += `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td><span class="sev-${log.severity}">${log.severity}</span></td>
                    <td>${log.user}</td>
                    <td>${log.action}</td>
                </tr>
            `;
        });
    }

    window.approveReq = async function(id, approved) {
        await fetch(`/api/admin/approve/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user': currentUser },
            body: JSON.stringify({ approved })
        });
        loadAdminConsole();
    };
});
