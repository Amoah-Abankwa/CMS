import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  userLabel?: string;
  activeRoleKey?: string;
  logGroup?: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  run<T>(data: RequestContextData, fn: () => T): T {
    return storage.run(data, fn);
  },
  get(): RequestContextData | undefined {
    return storage.getStore();
  },
  patch(values: Partial<RequestContextData>): void {
    const store = storage.getStore();
    if (store) Object.assign(store, values);
  },
};
