'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { foodApi } from '@/features/marketplace/api';

/**
 * After checkout the provider sends the person back with ?reference=. The payment only counts once
 * the server has verified it, so check it, report the outcome, then tidy the address bar.
 */
export function usePaymentReturn(onDone: () => void) {
  const params = useSearchParams();
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const done = useRef(false);
  useEffect(() => {
    const reference = params.get('reference');
    if (!reference || done.current) return;
    done.current = true;
    foodApi.verifyPayment(reference)
      .then((p) => setNotice(p.status === 'SUCCEEDED' ? { tone: 'success', text: 'Payment received. Your receipt has been sent to you.' } : p.status === 'FAILED' ? { tone: 'danger', text: 'The payment did not go through. You have not been charged.' } : { tone: 'info', text: 'Your payment is being confirmed. This page will show it shortly.' }))
      .catch(() => setNotice({ tone: 'info', text: 'Your payment is being confirmed.' }))
      .finally(() => { onDone(); router.replace(window.location.pathname); });
  }, [params, router, onDone]);
  return notice;
}
