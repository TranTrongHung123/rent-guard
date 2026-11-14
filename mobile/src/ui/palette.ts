/** Shared semantic colors. Severity keeps its meaning independently of branding. */
export const colors = {
  background: '#F4F7FC',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF3FC',
  ink: '#10233F',
  muted: '#52657F',
  primary: '#2563EB',
  primaryDeep: '#153C83',
  primarySoft: '#E8F0FF',
  primaryBorder: '#C6D8FC',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#DCE8FF',
  line: '#DDE6F2',
  high: '#B42335',
  highSoft: '#FFF0F2',
  highBorder: '#F3C9D0',
  medium: '#946200',
  mediumSoft: '#FFF7E5',
  mediumBorder: '#EFD9A5',
  low: '#176A50',
  lowSoft: '#E9F6F0',
  accent: '#087C9D',
  overlay: '#10233F80',
} as const;

export type ColorToken = keyof typeof colors;
