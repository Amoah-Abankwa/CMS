import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

/** Whether the phone is online, kept current by NetInfo. */
interface NetworkState { online: boolean; since: number | null; start: () => () => void }

export const useNetwork = create<NetworkState>((set) => ({
  online: true,
  since: null,
  start: () =>
    NetInfo.addEventListener((s) => {
      const online = s.isConnected !== false && s.isInternetReachable !== false;
      set((prev) => (prev.online === online ? prev : { online, since: online ? null : Date.now() }));
    }),
}));
