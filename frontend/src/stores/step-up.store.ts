import { create } from 'zustand';

interface StepUpState {
  open: boolean;
  resolver: ((confirmed: boolean) => void) | null;
  /** Opens the authenticator prompt and resolves when the user confirms or cancels. */
  request: () => Promise<boolean>;
  settle: (confirmed: boolean) => void;
}

export const useStepUpStore = create<StepUpState>((set, get) => ({
  open: false,
  resolver: null,
  request: () =>
    new Promise<boolean>((resolve) => {
      get().resolver?.(false);
      set({ open: true, resolver: resolve });
    }),
  settle: (confirmed) => {
    get().resolver?.(confirmed);
    set({ open: false, resolver: null });
  },
}));
