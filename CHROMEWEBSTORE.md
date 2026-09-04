# Chrome Web Store Listing — Talika

> Last Updated: 2026-09-02

## Store Listing

**Extension Name** [REQUIRED]
Talika - Minimalist To-Do List

**Short Description** [REQUIRED]
Fast, minimal, offline-first to-do list with folders, subtasks, and reminders.

**Detailed Description** [REQUIRED]
Talika is a minimal, blazing-fast to-do list and task manager engineered for focus and clarity.

FEATURES:
- Fast task creation with single-level subtasks
- Color-coded folders and semantic icon customization
- Private recurring reminders and local scheduling
- Real-time cloud sync across desktop PWA, Android, and Chrome extension
- Offline-first architecture with instant local caching
- Side panel and quick toolbar popup support for distraction-free task management while browsing
- Shared folders and collaboration support with link sharing
- Smooth fluid animations and full dark/light theme support

HOW TO USE:
1. Click the Talika icon in your toolbar to open your task list in a popup.
2. Right-click anywhere and choose "Open Talika in Side Panel" to keep your tasks alongside your active tab.
3. Type a task name and press Enter to capture thoughts instantly.
4. Organize tasks with folders, set reminders, and break down complex items with subtasks.

PRIVACY & PERMISSIONS:
Talika stores your tasks securely in Firebase Firestore. When offline, your data stays cached locally on your device. We do not track browsing history, sell personal data, or serve advertisements.

SUPPORT & FEEDBACK:
For bug reports, feature suggestions, or questions, please visit our GitHub repository at https://github.com/MatrixRex/Talika-To-Do-List.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Manage daily tasks, subtasks, and reminders directly from your browser's toolbar and side panel.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `public/icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | `docs/screenshots/screenshot-home.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | `docs/screenshots/screenshot-sidepanel.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | `docs/screenshots/screenshot-folders.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | `docs/screenshots/promo-small.png` |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | `docs/screenshots/promo-marquee.png` |

### Screenshot Notes
- Screenshot 1: Talika Home screen showing task list with subtasks, completed items, and folder grid.
- Screenshot 2: Side panel mode docked next to a web page for multitasking.
- Screenshot 3: Folder view with custom color badge and icon picker.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `sidePanel` | permissions | Allows Talika to dock alongside web browsing tabs for side-by-side task management. |
| `storage` | permissions | Persists extension preferences and cache state across browser sessions. |
| `contextMenus` | permissions | Adds a right-click context menu action ("Open Talika in Side Panel") to conveniently trigger the side panel from any page. |
| `identity` | permissions | Enables Google Sign-In and user authentication within the Chrome extension. |
| `https://*.firebaseio.com/*` | host_permissions | Connects to Firebase Firestore and Auth real-time sync endpoints. |
| `https://*.googleapis.com/*` | host_permissions | Facilitates Google account sign-in and token authorization for cloud sync. |
| `https://*.firebaseapp.com/*` | host_permissions | Serves Firebase authentication redirect and popup handlers. |
| `http://127.0.0.1/*` | host_permissions | Allows connecting to local Firebase emulators during development. |
| `http://localhost/*` | host_permissions | Allows connecting to local development server and emulators. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | Yes (Name, Email) | Yes (Firebase Auth) | Account authentication and folder collaboration identification | No |
| Health info | No | No | N/A | No |
| Financial info | No | No | N/A | No |
| Authentication info | Yes (Auth token) | Yes (Firebase Auth) | User sign-in and session authorization | No |
| Personal communications | No | No | N/A | No |
| Location | No | No | N/A | No |
| Web history | No | No | N/A | No |
| User activity | Yes (Tasks, Folders) | Yes (Firestore) | Synchronizing to-do items and folder structures across user devices | No |
| Website content | No | No | N/A | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED if collecting data, RECOMMENDED otherwise]
https://matrixrex.github.io/Talika-To-Do-List/privacy

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name** [REQUIRED]
Talika Team

**Contact Email** [REQUIRED]
support@talika.app

**Support URL / Email** [RECOMMENDED]
https://github.com/MatrixRex/Talika-To-Do-List/issues

**Homepage URL** [RECOMMENDED]
https://github.com/MatrixRex/Talika-To-Do-List

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.2.2 | 2026-09-04 | Modal dialog and sheet portal rendering to document.body, backdrop isolation, and Escape key dismissal | Draft |
| 0.2.1 | 2026-09-04 | Offline PWA service worker caching, silent auth session restore, and cache-first offline sweeps | Draft |
| 0.2.0 | 2026-09-02 | Manifest V3 build with direct Side Panel toggle, exact brand PNG icons, and Google OAuth2 integration | Draft |

## Review Notes

### Known Issues / Limitations
- None currently reported.

