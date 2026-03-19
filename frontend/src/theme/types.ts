export interface ThemeColors {
  palette: string[] // exactly 8 hex colors
  roles: {
    success: string
    warning: string
    error: string
    info: string
  }
  surfaces: {
    background: string
    card: string
    cardHover: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    disabled: string
  }
  border: {
    default: string
    subtle: string
  }
}

export interface Theme {
  id: string
  name: string
  builtin: boolean
  colors: ThemeColors
}

export const EARTH_TONES: Theme = {
  id: 'earth-tones',
  name: 'Earth Tones',
  builtin: true,
  colors: {
    palette: ['#c06830', '#4a8a4a', '#4a7a9a', '#9a7a30', '#8a5a9a', '#c04040', '#2a7a5a', '#aa6a7a'],
    roles: { success: '#4caf50', warning: '#c06830', error: '#e53935', info: '#4a7a9a' },
    surfaces: { background: '#f3efe9', card: '#ffffff', cardHover: '#f5f3ef' },
    text: { primary: '#2a2520', secondary: '#7a6a5a', muted: '#b0a89e', disabled: '#c0b8ae' },
    border: { default: '#e0dcd6', subtle: '#f0ece6' },
  },
}

export const OCEAN: Theme = {
  id: 'ocean',
  name: 'Ocean',
  builtin: true,
  colors: {
    palette: ['#2a7a9a', '#3a9a8a', '#5a8aba', '#6a8a5a', '#7a6a9a', '#c06a6a', '#2a8a6a', '#9a7a8a'],
    roles: { success: '#3a9a6a', warning: '#ca8a30', error: '#d04040', info: '#4a8aba' },
    surfaces: { background: '#eaf2f6', card: '#ffffff', cardHover: '#f0f5f8' },
    text: { primary: '#1a2a3a', secondary: '#4a6a7a', muted: '#8aa0ae', disabled: '#a8b8c4' },
    border: { default: '#d0dce4', subtle: '#e4ecf0' },
  },
}

export const SUNSET: Theme = {
  id: 'sunset',
  name: 'Sunset',
  builtin: true,
  colors: {
    palette: ['#d4574a', '#e8965a', '#f0c040', '#6a9a6a', '#5a7aaa', '#9a5a7a', '#c08a50', '#7a6a5a'],
    roles: { success: '#5a9a5a', warning: '#e8965a', error: '#d4574a', info: '#5a7aaa' },
    surfaces: { background: '#faf5f0', card: '#ffffff', cardHover: '#f8f2ec' },
    text: { primary: '#3a2520', secondary: '#7a5a4a', muted: '#b09a8a', disabled: '#c8b8a8' },
    border: { default: '#e8dcd0', subtle: '#f2ece4' },
  },
}

export const FOREST: Theme = {
  id: 'forest',
  name: 'Forest',
  builtin: true,
  colors: {
    palette: ['#4a7a4a', '#6a5a3a', '#3a6a6a', '#8a7a3a', '#6a4a6a', '#9a5a4a', '#3a7a5a', '#7a6a5a'],
    roles: { success: '#4a8a4a', warning: '#b08a30', error: '#b05040', info: '#3a7a8a' },
    surfaces: { background: '#f0f2ee', card: '#fafbf8', cardHover: '#eaede6' },
    text: { primary: '#2a3a2a', secondary: '#5a6a5a', muted: '#8a9a8a', disabled: '#a8b4a8' },
    border: { default: '#d0d8cc', subtle: '#e4e8e0' },
  },
}

export const MIDNIGHT: Theme = {
  id: 'midnight',
  name: 'Midnight',
  builtin: true,
  colors: {
    palette: ['#6a8aca', '#5aaa8a', '#ca8a5a', '#aa7aba', '#5a9aaa', '#ca6a6a', '#6aaa7a', '#aa8a7a'],
    roles: { success: '#5aaa7a', warning: '#caa050', error: '#ca6060', info: '#6a9aca' },
    surfaces: { background: '#1a1e2a', card: '#242a38', cardHover: '#2a3040' },
    text: { primary: '#e0e4ea', secondary: '#a0a8b4', muted: '#6a7080', disabled: '#4a5060' },
    border: { default: '#3a4050', subtle: '#2e3444' },
  },
}

export const ROSE: Theme = {
  id: 'rose',
  name: 'Rose',
  builtin: true,
  colors: {
    palette: ['#c06080', '#7a8aaa', '#8aaa7a', '#aa8a6a', '#9a7aaa', '#aa6a6a', '#5a9a8a', '#aa8090'],
    roles: { success: '#6aaa6a', warning: '#caa050', error: '#ca5a5a', info: '#7a8aaa' },
    surfaces: { background: '#f8f2f4', card: '#ffffff', cardHover: '#f4eef0' },
    text: { primary: '#3a2a30', secondary: '#7a5a6a', muted: '#aa9098', disabled: '#c0b0b8' },
    border: { default: '#e4d8dc', subtle: '#f0e8ec' },
  },
}

export const BUILTIN_THEMES: Theme[] = [EARTH_TONES, OCEAN, SUNSET, FOREST, MIDNIGHT, ROSE]

/** Map a ThemeColors object to CSS variable name → value pairs */
export function themeToVariables(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {}

  colors.palette.forEach((c, i) => {
    vars[`--color-palette-${i + 1}`] = c
  })

  vars['--color-role-success'] = colors.roles.success
  vars['--color-role-warning'] = colors.roles.warning
  vars['--color-role-error'] = colors.roles.error
  vars['--color-role-info'] = colors.roles.info
  vars['--color-success'] = colors.roles.success
  vars['--color-error'] = colors.roles.error
  vars['--color-info'] = colors.roles.info

  vars['--color-bg-primary'] = colors.surfaces.background
  vars['--color-bg-card'] = colors.surfaces.card
  vars['--color-bg-card-hover'] = colors.surfaces.cardHover

  vars['--color-text-primary'] = colors.text.primary
  vars['--color-text-secondary'] = colors.text.secondary
  vars['--color-text-muted'] = colors.text.muted
  vars['--color-text-disabled'] = colors.text.disabled

  vars['--color-border-subtle'] = colors.border.subtle

  return vars
}
