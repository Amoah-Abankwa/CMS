import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { axiosInstance } from '@/lib/api';

export type LocationState = 'off' | 'ask' | 'sharing' | 'blocked';

/**
 * While carrying an order, shares the dispatcher's position every 20 seconds, only with that order's
 * customer (the backend clears it at delivery). Asks permission only when it is needed.
 */
export function useLiveLocation(carrying: boolean) {
  const [state, setState] = useState<LocationState>('off');
  useEffect(() => {
    if (!carrying) { setState('off'); return; }
    let timer: ReturnType<typeof setInterval> | null = null;
    let alive = true;
    void Location.getForegroundPermissionsAsync().then((p) => {
      if (!alive) return;
      if (!p.granted) { setState(p.canAskAgain ? 'ask' : 'blocked'); return; }
      setState('sharing');
      const send = () => void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((pos) => axiosInstance.post('/dispatch/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })).catch(() => undefined);
      send();
      timer = setInterval(send, 20000);
    });
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [carrying, state === 'sharing']); // eslint-disable-line react-hooks/exhaustive-deps
  const allow = async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    setState(p.granted ? 'sharing' : p.canAskAgain ? 'off' : 'blocked');
  };
  return { state, allow, dismiss: () => setState('off') };
}
