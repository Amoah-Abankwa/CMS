/** The same colours as the website (frontend/src/app/globals.css). Flat colours only: no gradients. */
export const palette = {
  light: {
    bg: '#F6F7F9', surface: '#FFFFFF', surfaceMuted: '#EEF1F5', text: '#16202C', muted: '#56616F', border: '#D9DEE5',
    primary: '#1D4E89', primaryFg: '#FFFFFF', primarySoft: '#E6EEF8',
    success: '#1F7A4D', successSoft: '#E5F3EC', warning: '#8A6414', warningSoft: '#F7EFDC', danger: '#B42318', dangerSoft: '#FBE9E7',
  },
  dark: {
    bg: '#0F1620', surface: '#16202C', surfaceMuted: '#1D2936', text: '#E6EAF0', muted: '#9AA6B4', border: '#2B3847',
    primary: '#7EAEE6', primaryFg: '#0F1620', primarySoft: '#1B2E45',
    success: '#6CC79A', successSoft: '#16301F', warning: '#E0B957', warningSoft: '#33290F', danger: '#F08A80', dangerSoft: '#3A1A17',
  },
} as const;

export type Colors = { [K in keyof (typeof palette)['light']]: string };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const type = {
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '500' as const },
};
