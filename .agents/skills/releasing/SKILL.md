---
name: releasing
description: Perform app releases using release-it. Triggers when the user asks to release a patch, minor, or major version (e.g. 'release patch', 'release minor', 'release major').
---

# Releasing Skill

Use this skill to automate and manage the process of releasing new versions of the application using the `release-it` tool.

This skill should trigger whenever the user requests a new release (e.g., "release patch", "release minor", "release major").

## Release Workflow

Follow these steps precisely:

### Step 1: Pre-Release Check & Auto-Commit
Before running the release tool, check if there are any uncommitted changes in the repository:
1. Run `git status` to identify modified or untracked files.
2. If there are uncommitted files:
   - Stage them: `git add .`
   - Commit them with a structured commit message following the project's commit guidelines (e.g. `feat: finalize changes for release` or `fix: resolve remaining bugs`).

### Step 2: Bump Version using `release-it`
Run the `release-it` tool directly with CLI arguments to avoid manual inputs:
- For **patch**: Run `pnpm release-it patch -y` or `npx release-it patch -y`.
- For **minor**: Run `pnpm release-it minor -y` or `npx release-it minor -y`.
- For **major**: Run `pnpm release-it major -y` or `npx release-it major -y`.

*Note: You can pass `-m "custom commit message"` to customize the commit message, and `--no-build` or `--build` to control the build check behavior.*

### Step 3: Update CHANGELOG & README
Once `release-it` finishes bumping the version:
1. Read the newly bumped version number from `package.json` (e.g., `"version": "X.Y.Z"`).
2. Open `CHANGELOG.md`:
   - Under the `## [Unreleased]` section, locate all listed bullet points under `### Added`, `### Changed`, or `### Fixed`.
   - Create a new section for the released version directly below `## [Unreleased]`, formatted as:
     `## [<New Version>] - <Current Date>` (where Current Date is in `YYYY-MM-DD` format).
   - Move the bullet points from `## [Unreleased]` into the newly created version section.
3. Check `README.md` for any version references, features lists, or release instructions that need updating for the new release, and apply necessary edits.
4. Stage the updated documentation files:
   - Run `git add CHANGELOG.md README.md`
5. Commit the changelog changes:
   - Run `git commit -m "docs: update changelog for v<New Version>"`
6. Push the updated documentation commit:
   - Run `git push`
