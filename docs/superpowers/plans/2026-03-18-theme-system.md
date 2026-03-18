# Theme System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded hex colors with a structured two-layer theme system (semantic roles + palette slots) that enables full palette swaps from a single set of CSS variables.

**Architecture:** Add palette slot and semantic role variables to `variables.css`. Update all components to use theme tokens instead of hardcoded hex values or category-named variables. The migration is done in two phases: first add new variables alongside old ones (with aliases), then sweep all files to use the new names, then remove the aliases.

**Tech Stack:** CSS custom properties, Tailwind CSS v4 `@theme` block

**Spec:** `docs/superpowers/specs/2026-03-18-theme-system-design.md`

---

## File Structure

No new files. This is a refactor of `frontend/src/theme/variables.css` and a sweep of all component files that reference colors.

---

### Task 1: Add new theme variables

**Files:**
- Modify: `frontend/src/theme/variables.css`

- [ ] **Step 1: Add palette slots, semantic roles, and new tiers**

In the `@theme` block in `frontend/src/theme/variables.css`, replace this section:
```css
    --color-calendar: #c06830;
    --color-chores: #4a8a4a;
    --color-info: #4a7a9a;
    --color-food: #9a7a30;
    --color-grocery: #8a5a9a;
    --color-sports: #c04040;
    --color-success: #4caf50;
    --color-error: #e53935;
```

With:
```css
    /* Palette slots — assignable accent pool */
    --color-palette-1: #c06830;
    --color-palette-2: #4a8a4a;
    --color-palette-3: #4a7a9a;
    --color-palette-4: #9a7a30;
    --color-palette-5: #8a5a9a;
    --color-palette-6: #c04040;
    --color-palette-7: #2a7a5a;
    --color-palette-8: #aa6a7a;

    /* Semantic roles */
    --color-role-success: #4caf50;
    --color-role-warning: #c06830;
    --color-role-error: #e53935;
    --color-role-info: #4a7a9a;

    /* Text tiers */
    --color-text-disabled: #c0b8ae;

    /* Border tiers */
    --color-border-subtle: #f0ece6;

    /* Backward-compatible aliases (will be removed in Task 4) */
    --color-calendar: var(--color-palette-1);
    --color-chores: var(--color-palette-2);
    --color-info: var(--color-role-info);
    --color-food: var(--color-palette-4);
    --color-grocery: var(--color-palette-5);
    --color-sports: var(--color-palette-6);
    --color-success: var(--color-role-success);
    --color-error: var(--color-role-error);
```

- [ ] **Step 2: Verify nothing changed visually**

Run: `cd frontend && npx tsc --noEmit`

The aliases make this step a visual no-op. All existing Tailwind utilities (`text-calendar`, `bg-error/10`, etc.) should continue working.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/theme/variables.css
git commit -m "feat(theme): add palette slots, semantic roles, text-disabled, border-subtle"
```

---

### Task 2: Replace all hardcoded hex values in components

**Files:** All component files with hardcoded hex color values.

- [ ] **Step 1: Replace hardcoded hex values**

Search all `.tsx` files in `frontend/src` for hardcoded hex color references and replace with theme tokens. Here is the complete replacement table:

| File(s) | Find | Replace with |
|---------|------|-------------|
| `GameCard.tsx`, `GameDetailModal.tsx` | `text-[#c0b8ae]` | `text-text-disabled` |
| `GameCard.tsx`, `GameDetailModal.tsx` | `text-[#d0c8c0]` | `text-text-disabled` |
| `GameCard.tsx` | `border-[#f5f2ed]` | `border-border-subtle` |
| `GameCard.tsx` | `bg-[rgba(229,57,53,0.03)]` | `bg-role-error/[3%]` |
| `DayCell.tsx` | `#2a7a5a` (both foreground and color-mix background) | `var(--color-palette-7)` |
| `ShipmentRow.tsx` | `text-[#c06830]` | `text-role-warning` |
| `PackageDetailModal.tsx` | `bg-[#d0ccc6]` | `bg-text-disabled` |
| `PackageDetailModal.tsx` | `bg-[#e8e4de]` | `bg-border-subtle` |

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(theme): replace hardcoded hex colors with theme tokens"
```

---

### Task 3: Migrate all category-named Tailwind utilities to palette/role names

**Files:** All component files using Tailwind utilities like `text-calendar`, `bg-sports/10`, etc.

This is the comprehensive sweep. Use search-and-replace across the entire `frontend/src` directory for each mapping.

- [ ] **Step 1: Replace `calendar` → `palette-1` utilities**

Search all `.tsx` files for Tailwind classes using `calendar` and replace:

| Find | Replace |
|------|---------|
| `text-calendar` | `text-palette-1` |
| `bg-calendar` (standalone or with modifiers like `/5`, `/10`, `/20`) | `bg-palette-1` (with same modifiers) |
| `border-calendar` | `border-palette-1` |
| `accent-calendar` | `accent-palette-1` |
| `var(--color-calendar)` (in inline styles) | `var(--color-palette-1)` |

**Files affected:** `TabBar.tsx`, `HeroStrip.tsx`, `Button.tsx`, `GameCard.tsx`, `CalendarWidget.tsx`, `CalendarDetail.tsx`, `CalendarBoard.tsx`, `DayCell.tsx`, `DayDetailModal.tsx`, `ChoreAdmin.tsx`, `SettingsAdmin.tsx`, `AssignmentsTab.tsx`, `ChoresTab.tsx`

- [ ] **Step 2: Replace `chores` → `palette-2` utilities**

| Find | Replace |
|------|---------|
| `text-chores` | `text-palette-2` |
| `bg-chores/10` | `bg-palette-2/10` |
| `accent-chores` | `accent-palette-2` |

**Files affected:** `ChoresWidget.tsx`, `MetaChorePicker.tsx`

- [ ] **Step 3: Replace `food` → `palette-4` utilities**

| Find | Replace |
|------|---------|
| `text-food` | `text-palette-4` |
| `bg-food/5` | `bg-palette-4/5` |
| `bg-food` | `bg-palette-4` |

**Files affected:** `LunchMenuWidget.tsx`

- [ ] **Step 4: Replace `grocery` → `palette-5` utilities**

| Find | Replace |
|------|---------|
| `bg-grocery` | `bg-palette-5` |

**Files affected:** `PackageDetailModal.tsx`

- [ ] **Step 5: Replace `sports` → `palette-6` utilities**

| Find | Replace |
|------|---------|
| `text-sports` (with any modifiers like `/50`, `/60`) | `text-palette-6` (same modifiers) |
| `bg-sports/10` | `bg-palette-6/10` |
| `hover:text-sports` | `hover:text-palette-6` |
| `accent-sports` | `accent-palette-6` |

**Files affected:** `SportsWidget.tsx`, `SportsSettings.tsx`

- [ ] **Step 6: Replace inline `var(--color-info)` with `var(--color-role-info)`**

In files that use `var(--color-info)` in inline styles (not Tailwind utilities — those stay as `text-info` since `--color-info` remains as an alias):

| Find | Replace |
|------|---------|
| `var(--color-info)` (in style props) | `var(--color-role-info)` |

**Files affected:** `DayCell.tsx`, `MonthGrid.tsx`, `WeatherDetail.tsx`

Note: Tailwind utility classes like `text-info`, `bg-info/10` do NOT need to change — `--color-info` stays as a permanent alias for `--color-role-info`.

- [ ] **Step 7: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 8: Verify no remaining references to old category names**

Search for any remaining `text-calendar`, `bg-calendar`, `text-chores`, `bg-chores`, `text-food`, `bg-food`, `text-grocery`, `bg-grocery`, `text-sports`, `bg-sports`, `accent-calendar`, `accent-chores`, `accent-sports`, `border-calendar`, or `var(--color-calendar)`, `var(--color-chores)`, `var(--color-food)`, `var(--color-grocery)`, `var(--color-sports)` in any `.tsx` file. There should be zero results (excluding `variables.css` itself).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(theme): migrate all Tailwind utilities from category names to palette/role tokens"
```

---

### Task 4: Remove backward-compatible aliases + update WidgetCard

**Files:**
- Modify: `frontend/src/theme/variables.css`
- Modify: `frontend/src/ui/WidgetCard.tsx`

- [ ] **Step 1: Update WidgetCard categoryColors**

In `frontend/src/ui/WidgetCard.tsx`, replace the `categoryColors` mapping:

From:
```typescript
const categoryColors: Record<CardCategory, string> = {
  calendar: 'var(--color-calendar)',
  chores: 'var(--color-chores)',
  info: 'var(--color-info)',
  food: 'var(--color-food)',
  grocery: 'var(--color-grocery)',
  sports: 'var(--color-sports)',
}
```

To:
```typescript
const categoryColors: Record<CardCategory, string> = {
  calendar: 'var(--color-palette-1)',
  chores: 'var(--color-palette-2)',
  info: 'var(--color-palette-3)',
  food: 'var(--color-palette-4)',
  grocery: 'var(--color-palette-5)',
  sports: 'var(--color-palette-6)',
}
```

- [ ] **Step 2: Remove category aliases from variables.css**

In the `@theme` block, remove these lines:
```css
    --color-calendar: var(--color-palette-1);
    --color-chores: var(--color-palette-2);
    --color-food: var(--color-palette-4);
    --color-grocery: var(--color-palette-5);
    --color-sports: var(--color-palette-6);
```

**Keep** these aliases (they have generic semantic meaning and are widely used via Tailwind utilities):
```css
    --color-info: var(--color-role-info);
    --color-success: var(--color-role-success);
    --color-error: var(--color-role-error);
```

- [ ] **Step 3: Verify it compiles and renders**

Run: `cd frontend && npx tsc --noEmit`

Visually verify the dashboard renders correctly — all widget headers, active tabs, game scores, calendar events, etc.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme/variables.css frontend/src/ui/WidgetCard.tsx
git commit -m "refactor(theme): remove category aliases, update WidgetCard to palette slots"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Type check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 2: Visual verification**

Check every section of the dashboard:
- Home: all widget card headers have correct colors
- Sports: live game tint (red), score dimming, final (green), upcoming time
- Packages: ETA colors, timeline dots/lines in detail modal
- Calendar tab: timed events (teal), all-day bars (blue), today circle (orange)
- Calendar widget on home: event highlighting
- Chores: checkbox accent, meta-chore picker
- Lunch menu: food category label and entry styling
- Tab bar: active tab highlight
- Hero strip: event times and label color
- Admin: tab styling, checkbox accents, settings sidebar
- Button component: primary button color

- [ ] **Step 3: Verify theme swappability**

Quick test: temporarily change `--color-palette-1` to `#0000ff` in variables.css. Verify that the calendar widget header, tab bar active state, HeroStrip label, today circle, admin buttons, and all calendar-accented elements turn blue together. Revert.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "refactor(theme): complete theme system migration"
```
