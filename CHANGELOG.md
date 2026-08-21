# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
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
