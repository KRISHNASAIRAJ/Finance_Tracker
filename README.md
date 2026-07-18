# Meridian — Personal Life Tracker

Meridian is a personal-use React Native mobile application designed for Android (with future iOS support), powered by a FastAPI Python backend and PostgreSQL/Supabase database. The app features a dark-first user interface with offline cache support, transaction logs, garage maintenance logging, and equity investment tracking.

---

## Technical Architecture

* **Mobile App:** React Native (Expo) using TypeScript.
  - **State Management:** Zustand with AsyncStorage persistent caching.
  - **Navigation:** React Navigation (Native Stack & Bottom Tabs).
  - **Styling:** Premium customized dark-theme layout with Glassmorphism, smooth CSS gradients, and custom SVG path-based visualization.
* **Backend:** FastAPI (Python 3.10+) with SQLAlchemy ORM and Alembic migrations.
* **Database:** PostgreSQL (Supabase) + SQLite local caching layer for offline-first CRUD operations.

---

## Directory Structure

```
krishnas-tracker/
├── AGENTS.md                  ← AI Agent Governance & boundaries
├── PRD.md                     ← Product Requirements Document
├── ARCHITECTURE.md            ← Data structures and module boundaries
├── DESIGN.md                  ← Styling system and dark theme specifications
├── README.md                  ← This file
├── scripts/
│   └── install-dev.ps1        ← Dev build and ADB installation script
├── mobile/                    ← React Native app
│   ├── src/
│   │   ├── modules/           ← Feature modules (finance, garage, personal, tasks)
│   │   ├── shared/            ← Shared components, theme constants
│   │   └── navigation/        ← Navigator configuration
│   └── package.json           ← Node dependencies
└── backend/                   ← Python FastAPI backend service
```

---

## Setup & Running Locally

### 1. Run with Expo Go (Fast & Wireless)

To view the app instantly on your Android/iOS phone over Wi-Fi:

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
2. Install the node modules:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm start
   ```
4. Install **Expo Go** from the Google Play Store or iOS App Store.
5. Connect your phone and PC to the same Wi-Fi network and scan the QR code printed in the terminal.

### 2. Run on Connected Device via USB (ADB)

If you have ADB installed and USB debugging enabled on your phone:
```powershell
.\scripts\install-dev.ps1
```

---

## Git Deployment Guide

Follow these steps to link your local workspace to your remote GitHub repository and push your code:

### 1. Configure the Remote Origin URL
Open your terminal in the root directory (`d:\Krishna's Trackrer`) and add the remote URL:
```bash
git remote add origin https://github.com/KRISHNASAIRAJ/Finance_Tracker.git
```

### 2. Rename the Default Branch to `main`
Ensure your primary branch is called `main`:
```bash
git branch -M main
```

### 3. Push Your Commits to GitHub
Push your local git history to the remote master:
```bash
git push -u origin main
```
*(If your local branch is named `master`, use `git push -u origin master` or rename it first as shown above).*
