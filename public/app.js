document.addEventListener('DOMContentLoaded', () => {
    const roleSelect = document.getElementById('role-select');
    const navLinks = document.querySelectorAll('#nav-links a');
    const dataContainer = document.getElementById('data-container');
    const messageContainer = document.getElementById('message-container');
    const pageTitle = document.getElementById('page-title');

    let currentRole = roleSelect.value;
    let currentEndpoint = '/api/home';

    // Handle role change
    roleSelect.addEventListener('change', (e) => {
        currentRole = e.target.value;
        fetchData(currentEndpoint);
    });

    // Handle navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            
            currentEndpoint = e.target.getAttribute('data-endpoint');
            pageTitle.textContent = e.target.textContent;
            fetchData(currentEndpoint);
        });
    });

    // Fetch data from API
    async function fetchData(endpoint) {
        messageContainer.innerHTML = '';
        dataContainer.innerHTML = '<p>Loading...</p>';

        try {
            const response = await fetch(endpoint, {
                headers: {
                    'x-role': currentRole
                }
            });

            if (response.status === 403) {
                const errorData = await response.json();
                showError(errorData.error || 'Forbidden: Access Denied');
                dataContainer.innerHTML = '';
            } else if (!response.ok) {
                showError('An error occurred while fetching data.');
                dataContainer.innerHTML = '';
            } else {
                const data = await response.json();
                renderData(data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            showError('Network error. Please try again.');
            dataContainer.innerHTML = '';
        }
    }

    function showError(message) {
        messageContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }

    function renderData(data) {
        if (data.message) {
             dataContainer.innerHTML = `<div class="success-message">${data.message}</div>`;
             return;
        }

        if (data.data && Array.isArray(data.data)) {
            let html = '';
            data.data.forEach(item => {
                html += `<div class="data-card"><pre>${JSON.stringify(item, null, 2)}</pre></div>`;
            });
            dataContainer.innerHTML = html;
        } else if (data.data) {
            dataContainer.innerHTML = `<div class="data-card"><pre>${JSON.stringify(data.data, null, 2)}</pre></div>`;
        } else {
             dataContainer.innerHTML = `<p>No data available.</p>`;
        }
    }

    // Initial fetch for home
    fetchData('/api/home');
});
