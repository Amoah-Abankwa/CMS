import { create } from 'zustand';

export interface CartLine {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  vendorId: string | null;
  lines: CartLine[];
  add: (vendorId: string, item: Omit<CartLine, 'quantity'>) => void;
  change: (id: string, delta: number) => void;
  clear: () => void;
}

/** One basket, for one vendor at a time. Adding from another vendor starts a new basket. */
export const useCart = create<CartState>((set) => ({
  vendorId: null,
  lines: [],
  add: (vendorId, item) =>
    set((s) => {
      const lines = s.vendorId === vendorId ? s.lines : [];
      const found = lines.find((l) => l.id === item.id);
      return {
        vendorId,
        lines: found ? lines.map((l) => (l.id === item.id ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l)) : [...lines, { ...item, quantity: 1 }],
      };
    }),
  change: (id, delta) =>
    set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, quantity: Math.min(20, l.quantity + delta) } : l)).filter((l) => l.quantity > 0) })),
  clear: () => set({ vendorId: null, lines: [] }),
}));
