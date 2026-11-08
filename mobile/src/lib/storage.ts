import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Plain, non-secret storage for zustand stores (cached screens, drafts, preferences). Never tokens. */
export const persistStorage = createJSONStorage(() => AsyncStorage);
