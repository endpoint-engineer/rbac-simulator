# Corporate RBAC Simulator

A Node.js and Express web application demonstrating granular Role-Based Access Control (RBAC).

## Features
- Simulated login via a real-time "Role Switcher" dropdown.
- Secure API endpoints protecting sensitive corporate data.
- 6-role access matrix enforcing strict permissions.
- Vanilla HTML/CSS/JS frontend for simplicity.
- Uses a local `database.json` file as a mock data store.

## Roles
1. **Super Admin**: Full access to all endpoints.
2. **Finance Manager**: Access to `/api/finance`. Blocked from `/api/code-repo`.
3. **Security Officer**: Read-only access to `/api/audit-logs`.
4. **Lead Developer**: Access to `/api/code-repo`. Blocked from `/api/finance`.
5. **HR Director**: Access to `/api/employee-records`. Blocked from `/api/code-repo`.
6. **Intern**: Access to `/api/home` only. Blocked from everything else.

## Running Locally
1. Clone the repository and navigate into the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000`.

## Deployment to Render.com

This application is ready to be deployed to Render as a Node.js web service. The application correctly listens on `process.env.PORT` as required by cloud providers.

### Steps to Deploy:
1. Push this project to a GitHub, GitLab, or Bitbucket repository.
2. Create a new account or log in to [Render.com](https://render.com/).
3. Click on the **New** button and select **Web Service**.
4. Connect your GitHub/GitLab account and select the repository containing this project.
5. In the service settings:
   - **Name**: Choose a name for your app (e.g., `rbac-simulator`).
   - **Environment**: Select `Node`.
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click **Create Web Service**.
7. Render will automatically build and deploy your application. Once finished, you will receive a public URL (e.g., `https://rbac-simulator.onrender.com`).
