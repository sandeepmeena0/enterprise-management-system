# 🚀 Enterprise Management System (EMS) — Deployment Guide

This guide walks you through deploying the complete **EMS system** across **GitHub**, **Vercel** (Frontend), and **Render** (Backend).

---

## 📌 Architecture Overview
- **Frontend**: React + Vite (Single Page Application) -> **Vercel**
- **Backend**: Node.js + Express + MongoDB -> **Render**
- **Database**: MongoDB Atlas Cloud Cluster
- **Code Repository**: GitHub

---

## Step 1: Push Code to GitHub

Open terminal in the project root directory:

```bash
# 1. Initialize git (if not already initialized)
git init

# 2. Add all project files
git add .

# 3. Commit your changes
git commit -m "feat: complete Enterprise Management System with CRM, HRMS, Settings & Screen Recorder"

# 4. Create a new repository on GitHub (e.g. `enterprise-management-system`)
# Then link your local repository:
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git

# 5. Set main branch and push
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Render

1. Go to **[https://render.com](https://render.com)** and sign in.
2. Click **"New +"** in the top-right corner and select **"Web Service"**.
3. Select **"Build and deploy from a Git repository"** and choose your GitHub repository.
4. Fill in the deployment settings:
   - **Name**: `ems-backend-api` (or your choice)
   - **Region**: Singapore / Frankfurt / Oregon (nearest to you)
   - **Branch**: `main`
   - **Root Directory**: `backend` *(⚠️ Crucial: set to `backend`)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (or `node server.js`)
   - **Instance Type**: `Free`

5. Scroll down to **Environment Variables** and add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production environment |
   | `PORT` | `5000` | Port for Express server |
   | `MONGO_URI` | `mongodb+srv://admin:pos123@cluster0.k9qrejo.mongodb.net/ems_database?retryWrites=true&w=majority` | Your MongoDB Atlas connection URI |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` | Will update after Vercel deployment |

6. Click **"Deploy Web Service"**.
7. Once deployed, Render will provide a public URL like:
   `https://ems-backend-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. Go to **[https://vercel.com](https://vercel.com)** and sign in with GitHub.
2. Click **"Add New..."** > **"Project"**.
3. Import your GitHub repository.
4. Configure project settings:
   - **Framework Preset**: `Vite` (Auto-detected)
   - **Root Directory**: `./` (Leave as default root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://ems-backend-api.onrender.com/api` (Your Render backend URL) |
6. Click **"Deploy"**.
7. Once deployment finishes, Vercel will give you a live URL like:
   `https://enterprise-management-system.vercel.app`

---

## Step 4: Final Connection (CORS Update)

1. Copy your live Vercel URL (e.g. `https://enterprise-management-system.vercel.app`).
2. Go back to your **Render Dashboard** > **ems-backend-api** > **Environment**.
3. Update `FRONTEND_URL` to match your Vercel URL:
   `FRONTEND_URL=https://enterprise-management-system.vercel.app`
4. Click **Save Changes** (Render will automatically redeploy).

---

## ✅ Verification Checklist

- [x] **Vercel SPA Routing**: `vercel.json` ensures direct URL visits (e.g. `/dashboard`, `/leads`, `/settings`) load properly without 404.
- [x] **Backend Health Check**: Open `https://your-backend.onrender.com/api/health` in browser to verify API is active.
- [x] **CORS Support**: Backend allows requests from localhost and `*.vercel.app` domains automatically.
