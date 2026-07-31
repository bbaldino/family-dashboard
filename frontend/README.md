# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Scenario fixtures

Some dashboard states are hard to see because reality rarely produces them —
a packed calendar day, an empty one, an event spanning a month boundary.
`?scenario=<name>` on the page URL puts the dashboard into one of these
named states, so they can be designed against and verified — including on
the wall tablet itself, since this works in production builds, not just
dev.

```
http://<tablet>/calendar?scenario=packed
```

With no `?scenario=` parameter, nothing changes: every hook fetches and
polls exactly as it does day to day. That's the important case — it's what
the household uses.

**Currently wired for the calendar only** (`src/data/google-calendar/`):

| Scenario   | What it shows |
|------------|----------------|
| `empty`    | No events at all. |
| `packed`   | Several busy days; one day (month grid) and today (rolling week) carry more events than their layouts budget for, to check overflow handling. |
| `spanning` | A multi-day event crossing a month boundary, plus an all-day and a timed event landing on the same day (tests the sort rule: all-day first, then chronological). |

A scenario name with no fixture for a given hook (e.g. a future
`?scenario=live-game`) falls through to live data rather than erroring.

**How it works:** `src/data/scenario.ts` reads `?scenario=` once at module
load (`activeScenario`) — no React involved. Each integration that wants
scenario support keeps its own `fixtures.ts` next to its hook(s) (see
`src/data/google-calendar/fixtures.ts`), exporting fixtures **typed as the
hook's real return type** (e.g. `MonthEvents`, not a hand-rolled shape) so
a hook's shape changing breaks the fixture at compile time instead of
silently drifting. The hook's fetcher checks for a fixture first and falls
back to its normal fetch when there isn't one:

```ts
fetcher: () => {
  const fixture = monthFixtureFor(activeScenario, year, month)
  return fixture ? Promise.resolve(fixture) : fetchMonthEvents(year, month)
},
```

**To add a fixture set for another integration:** write a `fixtures.ts`
next to that integration's hook(s), export scenario functions typed
against its real return type, and wire the hook's fetcher the same way.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
