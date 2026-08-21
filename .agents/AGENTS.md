# AGENTS.md

Read `SPEC.md` before doing anything. It is the source of truth for the data
model, invariants, and stage plan.

## Working method

- We build in stages. **Ask which stage we are on before starting.**
- Do not modify code belonging to an earlier stage unless the task is explicitly
  to fix that stage. An agent "improving" Stage 1's index logic during Stage 7 is
  a bug you will not find until two devices disagree.
- Write the exit tests before the implementation.
- If a change contradicts `SPEC.md`, stop and say so. Do not silently diverge.
- Update `SPEC.md` in the same commit as any behaviour change.

## Never

- Never write a raw hex colour, a raw px value, or a Tailwind arbitrary value
  (`rounded-[13px]`, `duration-[250ms]`, `text-[#333]`). Tokens only.
- Never build a button, input, row, sheet, menu, or dialog from scratch. Compose
  `src/ui/`.
- Never import an icon at a call site. Add it to `src/ui/icons.tsx` and use
  `<Icon name="…" />`.
- Never animate anything but `transform` and `opacity`.
- Never introduce a Cloud Function or Cloud Storage bucket. Neither exists on the
  Spark plan; both would require a billing account.
- Never use integer positions for ordering. `sortKey` is a fractional index.
- Never store a hex colour or an icon component in Firestore. Store semantic keys.
- Never add a second level of subtask nesting or any folder nesting.
- Never put a reminder on an item where `memberIds.length > 1`.
- Never sync the last-opened folder id. The on/off preference syncs; the value
  is device-local.
- Never clear the input query when the mode changes.
- Never require a `#`, `/`, or `@` character to complete an action on mobile.

## Always

- Every mutation goes through the Zod schema at the boundary.
- Subtasks inherit `folderId`, `memberIds`, and `ownerId` from their parent —
  carry them on every move.
- Regenerate `sortKey` when an item changes list.
- Multi-document changes use a batch.
- Test on the real entry-level Android device, not DevTools throttling.
- Update `CHANGELOG.md` whenever adding new features, changing behavior, or fixing bugs.
- Update `README.md` appropriately when introducing new major features or instructions.

## Bundle budget

Initial JS ≤ 200 KB gzipped. Check with `npx vite-bundle-visualizer` before
declaring a stage done. Firestore is the largest dependency; it is lazy-loaded
after first paint.

## The three things you get wrong

Write real tests for these. They produce confident, plausible, incorrect code:

1. **Recurrence date math** — DST, month-end, "every 31st" in February
2. **Fractional index generation** — collisions, exhaustion, concurrent inserts
3. **Offline → online reconciliation** — same item edited on two devices offline

## Git Workflow

- Auto-commit after successfully implementing bug-free code.
- Manage `main` as the stable working copy.
- Create new branches for new feature implementations or bug fixes.
- Once the feature or bug fix is done and verified, merge the branch back into `main` and discard (delete) the branch.
