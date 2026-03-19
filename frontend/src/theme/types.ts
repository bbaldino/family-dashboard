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

export const BUILTIN_THEMES: Theme[] = [EARTH_TONES, OCEAN]

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
