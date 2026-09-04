# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-09-04
### Fixed
- Fixed PWA offline unavailability: implemented Service Worker app-shell precaching, network-first navigation with offline fallback to cached `index.html`, and cache-first static bundle delivery.
- Fixed startup login screen flash ("silent login"): synchronously restored cached user credentials and profile from `localStorage` on React mount, eliminating premature fallback timers and preventing `<LoginView />` from flashing while background auth is initializing.
- Fixed offline app getting stuck at the login screen: ensured authenticated sessions and UID resolution are available offline, and converted `syncUserProfile` and `orphanSweep` to query Firestore's local IndexedDB cache (`getCachedDoc` / `getCachedDocs`) without stalling on network timeouts.
- Added standard 192×192 and 512×512 PWA icons to `public/site.webmanifest` and automated icon generator.

## [0.2.0] - 2026-09-02
### Added
- Manifest V3 Chrome Extension target with direct Side Panel toggle and action bar support.
- Automated brand icon generator (`scripts/generate-icons.js`) rendering exact cubic Bézier vector curves and $4\times 4$ subpixel antialiasing at 16×16, 32×32, 48×48, and 128×128 dimensions.
- MV3 background service worker (`background.js`) with native `chrome.sidePanel.setPanelBehavior` and right-click context menu.
- Google OAuth 2.0 integration via `chrome.identity.getAuthToken` with declared scopes and `host_permissions`.
- Modernized Firestore multi-tab cache configuration (`persistentLocalCache` + `persistentMultipleTabManager`).
- Chrome Web Store metadata, privacy policy disclosures, and permissions justifications (`CHROMEWEBSTORE.md`).
- Step-by-step developer installation guide in `README.md` for Chromium browsers (Chrome, Edge, Brave).

## [0.1.3] - 2026-08-27
### Fixed
- Fixed settings toggle buttons getting stuck by including `reduceAnimations` and `fastMode` in Firestore preferences update payloads and adding immediate optimistic UI state updates in `AuthContext`.
- Fixed newly added collaborators/editors being unable to add tasks or subtasks until page reload by ensuring proper inheritance of `ownerId`, `memberIds`, and `folderId` in `handleCreateTask` and verifying folder freshness before validation.
- Fixed `ShareFolderDialog` collaborator list updates by optimistically adding/removing members on invite/revoke and preventing unnecessary re-fetching on background sync.
- Fixed prefer-const lint warning in `syncUserProfile` within `src/lib/auth.ts`.
- Added fallback configuration defaults in `src/lib/firebase.ts` to ensure seamless test execution in headless environments.

## [0.1.2] - 2026-08-24
### Fixed
- Resolved case sensitivity issue with email lookups preventing users from being found during folder sharing.
- Fixed Firebase security rules for `joinFolder` so share links correctly sync tasks to the joining user.
- Cache-busted the PWA icon by renaming it to `icon-v2.svg` to force home screen icon updates on installed devices.

## [0.1.1] - 2026-08-22
### Added
- Designed a custom minimalist SVG app icon featuring the Bengali letter **তা** (first syllable of তালিকা - Talika) sculpted to fit seamlessly inside a circle.
- Replaced default favicon with high-res scalable `favicon.svg` and `icon.svg` with PWA and Chrome MV3 extension support.
- Added `<AppLogo />` circular UI component and `logo` icon to `src/ui/icons.tsx`.
- Integrated Talika circular app logo across the navigation header (`AuthBar`), login hero card (`LoginView`), and settings dialog footer (`SettingsDialog`).

## [0.1.0] - 2026-08-21
### Added
- Direct Folder Share Links support (`#join=<folderId>`) with native Web Share API and clipboard copy fallback.
- Dedicated `JoinFolderDialog` modal showing folder icon, color badge, folder name, owner information, and member count.
- Unauthenticated join state persistence across Google Sign-In with automatic post-login join prompt.
- Granular Firestore security rules allowing authenticated folder previews and secure self-joining as an editor.
- Centralized Animation Engine with Apple-style fluid easing (`cubic-bezier(0.2, 0, 0, 1)`).
- Fast Mode and Reduce Animations user preferences in settings.
- Staggered waterfall entrance animations for tasks and folders (`AnimateEnter`).
- Hardware-accelerated animated strikethrough drawing for completed tasks.
- Green flash highlight on completion and red flash highlight on deletion.
- Smooth delayed exit and collapse transitions for clearing tasks and removing folders.
- Scale and fade transitions for Dialogs and Menus using `useDelayedUnmount`.

## [0.0.2] - 2026-08-21
### Added
- Added settings dialog with hide completed tasks preference.

## [0.0.1] - 2026-08-21
### Added
- Added semantic versioning system.
- Application version is now displayed in the user info popup.
- Automated deployment to GitHub Pages now triggers exclusively on version tags (`v*`).
