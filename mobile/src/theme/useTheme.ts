import { useColorScheme } from 'react-native';
import { palette, radius, space, type } from './tokens';

/** Colours for the phone's light or dark setting, plus spacing and type. */
export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palette[scheme], space, radius, type, scheme };
}
