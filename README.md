# Talika (তালিকা) — Simple To-Do & Task Management

[![Test Suite](https://img.shields.io/badge/tests-132%20passed-brightgreen.svg)](#testing--quality-assurance)
[![Framework](https://img.shields.io/badge/react-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/vite-8.2-purple.svg)](https://vite.dev/)
[![Capacitor](https://img.shields.io/badge/capacitor-8.5-blue.svg)](https://capacitorjs.com/)
[![Firebase](<https://img.shields.io/badge/firebase-Spark%20Plan%20(Free)-amber.svg>)](https://firebase.google.com/)

**Talika** is a fast, offline-first, privacy-conscious to-do and list management application built on free-tier infrastructure. It targets desktop browsers (PWA), mobile (Capacitor Android), and browser sidebars (Chrome Manifest V3 Extension) from a single shared TypeScript codebase.

---

## 📑 Table of Contents

- [Overview &amp; Architecture](#overview--architecture)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started &amp; Local Development](#getting-started--local-development)
  - [1. Install Dependencies](#1-install-dependencies)
  - [2. Start with Firebase Emulators (Recommended)](#2-start-with-firebase-emulators-recommended)
  - [3. Start Frontend Only](#3-start-frontend-only)
- [Testing &amp; Quality Assurance](#testing--quality-assurance)
- [Building for Platforms](#building-for-platforms)
  - [Web / PWA](#web--pwa)
  - [Android (Capacitor)](#android-capacitor)
  - [Chrome Extension (MV3)](#chrome-extension-mv3)
- [Configuration &amp; Environment Variables](#configuration--environment-variables)
- [Project Structure](#project-structure)
- [Core Invariants &amp; Design Rules](#core-invariants--design-rules)

---

## 🎯 Overview & Architecture

Talika was engineered with strict invariants and production-grade engineering principles:

1. **Offline-First & Resilient:** Backed by Firestore Multi-Tab IndexedDB persistence with deterministic conflict resolution (field merging, last-write-wins, delete priority, and startup orphan sweeps).
2. **Fractional Indexing Ordering:** Uses `fractional-indexing` sort keys so reordering a list writes to **exactly one document** per drop rather than re-indexing entire lists.
3. **Strict Hierarchy Limits:** Top-level tasks support at most **one level of subtasks** (no deep nested tree complexity).
4. **Private Reminders:** Invariant: reminders exist strictly on personal items. Moving a task to a shared folder or sharing a folder automatically strips reminders with clear user confirmation.
5. **Zero-Cost Infrastructure:** Runs entirely on Firebase Spark tier (Firestore + Google Auth) with client-side batched operations (≤500 ops) and zero Cloud Functions / Storage requirements.

---

## ✨ Key Features

- **Unified Context Input Bar:** Dynamic mode switching (Task / Subtask / Folder / Search) based on active screen context, preserving input query across mode switches. Desktop accelerators (`#`, `/`, `Tab`, `Cmd/Ctrl+K`) and mobile gesture support.
- **Customizable Folders:** Color scales powered by Radix and curated semantic icons with custom rename and delete flows.
- **Real-Time Collaboration & Share Links:** Direct shareable folder links (`#join=<folderId>`) with mobile sharing, join confirmation modals, collaborator email lookups, granular permissions (`owner` vs `editor`), and move-out claim semantics.
- **Drag & Drop Reordering:** Smooth touch and pointer drag-and-drop using `@dnd-kit`.
- **Flexible Reminders & Recurrence:** Once, daily, weekly, monthly (with month-end leap year resilience), and interval schedules powered by Capacitor Local Notifications.
- **Account Backup & Wipe:** Full account JSON export/import and clean batched account data wipe.

---

## 🛠 Tech Stack

- **Core:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with Radix Colors design tokens
- **Data & Auth:** [Firebase SDK](https://firebase.google.com/) (Firestore with IndexedDB persistence, Firebase Auth)
- **Local Emulators:** [Firebase Tools Emulator Suite](https://firebase.google.com/docs/emulator-suite) (Auth :9099, Firestore :8080, UI :4000)
- **Drag & Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Ordering:** `fractional-indexing`
- **Validation:** [Zod](https://zod.dev/) boundary validation schemas
- **Mobile Shell:** [Capacitor](https://capacitorjs.com/) (Android platform & Local Notifications)
- **Testing:** [Vitest](https://vitest.dev/), `@testing-library/react`, `@firebase/rules-unit-testing`

---

## 📋 Prerequisites

- **Node.js:** v18.0+ or v20.0+
- **Package Manager:** `pnpm` (recommended), `npm`, or `yarn`
- **Java JRE/JDK 11+:** Required by Firebase Emulator Suite (Firestore & Auth emulators)
- **Android Studio & SDK:** *(Optional)* Only required for compiling and debugging the Android Capacitor app

---

## 🚀 Getting Started & Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start with Firebase Emulators (Recommended)

This starts the Firebase local emulators (Auth, Firestore, and Emulator UI) and launches the Vite dev server inside that environment:

```bash
pnpm dev
```

- **App:** `http://localhost:5173`
- **Firebase Emulator UI:** `http://localhost:4000`
- **Firestore Emulator:** `localhost:8080`
- **Auth Emulator:** `http://localhost:9099`

> [!TIP]
> In local development mode (`import.meta.env.DEV`), the app automatically points to the local Firebase emulators on `127.0.0.1` / your local network IP.

### 3. Start Frontend Only

If you are running Firebase emulators in a separate terminal or pointing to a live Firebase project:

```bash
# Start Vite standalone
pnpm dev:vite
```

---

## 🧪 Testing & Quality Assurance

Talika includes comprehensive test suites covering fractional indexing, schema invariants, recurrence edge-cases, and Firestore security rules.

```bash
# Run full test suite once
pnpm test --run

# Run tests in watch mode
pnpm test

# Run ESLint & Oxlint checks
pnpm lint
```

---

## 📱 Building for Platforms

### Web / PWA

```bash
# Type check and build production bundle into dist/
pnpm build

# Preview the production build locally
pnpm preview
```

### Android (Capacitor)

```bash
# 1. Build the web distribution
pnpm build

# 2. Sync web assets and plugins to Android project
npx cap sync android

# 3. Open Android project in Android Studio
npx cap open android
```

From Android Studio, you can run the app on a connected physical device or emulator, or build an APK / AAB.

### Chrome Extension (Manifest V3)

Talika can be loaded directly as a Manifest V3 extension in any Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Arc, Opera, Vivaldi), supporting both toolbar popups and the Chrome Side Panel.

#### 1. Build the Extension
```bash
# Build the production bundle into dist/
npm run build
```
This automatically compiles TypeScript, bundles React assets with Vite, and generates crisp PNG icons into the `dist/` folder.

#### 2. Install in Google Chrome / Chromium / Brave / Edge
1. Open your browser and navigate to the Extensions management page:
   - **Chrome / Brave / Chromium:** `chrome://extensions`
   - **Microsoft Edge:** `edge://extensions`
   - **Opera:** `opera://extensions`
2. Turn ON **Developer mode** toggle (located in the top-right corner of Chrome/Brave, or bottom-left in Edge).
3. Click the **Load unpacked** button in the top toolbar.
4. Browse to and select the **`dist`** folder inside your project directory (`/path/to/Talika-To-Do-List/dist`).
5. **Talika** will now appear in your list of active extensions!

#### 3. Using the Extension
- **Toolbar Quick Popup:** Click the puzzle icon in Chrome's toolbar, pin Talika, then click the Talika icon to open a fast task popup.
- **Side Panel Multitasking:** Right-click anywhere on any webpage and select **"Open Talika in Side Panel"** to dock Talika side-by-side with your browsing session. You can also open the Side Panel directly from Chrome's Side Panel menu.
- **Offline Capable:** Full task creation, reordering, and subtasks remain accessible even without an active internet connection.

#### 4. Updating After Code Changes
Whenever you modify code and run `npm run build`:
1. Go back to `chrome://extensions`.
2. Find **Talika** in the list.
3. Click the **Refresh / Reload (⟳)** icon on the Talika extension card.

---

## ⚙️ Configuration & Environment Variables

For production deployments against a live Firebase project, create a `.env` or `.env.local` file with your credentials:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_USE_EMULATOR=false
```

---

## 📂 Project Structure

```
Talika-To Do List/
├── .agents/                 # AI pair programming rules & specifications
├── android/                 # Capacitor Android native project
├── public/                  # Static assets & Chrome MV3 manifest
├── src/
│   ├── components/          # App views & feature components
│   │   ├── AuthBar.tsx              # User authentication header
│   │   ├── FolderCustomizeDialog.tsx# Folder color & icon picker
│   │   ├── FolderGrid.tsx           # Folders display & management
│   │   ├── FolderView.tsx           # Items inside selected folder
│   │   ├── HomeView.tsx             # Main split view
│   │   ├── LoginView.tsx            # Sign in / demo login
│   │   ├── ReminderDialog.tsx       # Reminder scheduling modal
│   │   ├── SearchResultsView.tsx    # Substring search filter view
│   │   ├── ShareFolderDialog.tsx    # Collaboration & sharing modal
│   │   ├── TaskItem.tsx             # Task row with gestures & menu
│   │   ├── SubtaskItem.tsx          # Subtask row component
│   │   └── UnifiedInput.tsx         # Universal context-driven input bar
│   ├── context/             # React contexts (AuthContext, etc.)
│   ├── lib/                 # Core domain logic, db, rules, tests
│   │   ├── auth.ts                  # Auth helpers & providers
│   │   ├── db.ts                    # Firestore CRUD & batched operations
│   │   ├── firebase.ts              # Firebase app initialization & emulator hookup
│   │   ├── notifications.ts         # Capacitor local notifications
│   │   ├── recurrence.ts            # Recurrence calculation logic
│   │   ├── sort-keys.ts             # Fractional indexing generators
│   │   ├── schema.ts                # Zod schemas & types
│   │   └── *.test.ts                # Unit and exit test suites
│   ├── ui/                  # Design system primitives (Button, Card, Menu, etc.)
│   │   ├── icons.tsx                # Curated semantic icon registry
│   │   └── tokens.css               # Design tokens & semantic color scales
│   ├── App.tsx              # Root application router & shell
│   └── main.tsx             # React entry point
├── capacitor.config.ts      # Capacitor configuration
├── firebase.json            # Firebase emulators configuration
├── firestore.rules          # Firestore security rules
├── SPEC.md                  # Project architectural specification (Source of Truth)
└── vite.config.ts           # Vite configuration
```

---

## 📜 Core Invariants & Design Rules

- **Design Tokens Only:** All UI components compose `src/ui/` primitives and reference semantic CSS variables (Radix color scales). No raw hex values or arbitrary Tailwind classes.
- **Single-Drop Writes:** Fractional keys (`sortKey`) guarantee that dragging and dropping an item modifies only one document in Firestore.
- **One Level of Subtasks:** Subtasks cannot have nested children (`parentId` can never refer to a subtask).
- **Subtask Inheritance:** Subtasks always inherit `folderId`, `ownerId`, and `memberIds` from their parent task.
- **Privacy Guarantee:** Reminders are strictly disabled and stripped from shared items (`memberIds.length > 1`).

---

## 📄 License

This project is private and proprietary.
