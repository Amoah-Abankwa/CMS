import type { JobKind, JobPayUnit, TimesheetStatus } from '@anu/shared';

export interface Sheet { id: string; period: string; status: TimesheetStatus; amount: number; returnNote: string | null; paidAt: string | null; entries: Array<{ id: string; date: string; quantity: number; note: string | null }> }
export interface Hire { id: string; status: string; startedAt: string | null; payoutNetwork: string | null; payoutNumber: string | null; payoutName: string | null; job: { title: string; unit: string; kind: JobKind; payRate: number; payUnit: JobPayUnit; hoursPerWeek: number }; timesheets: Sheet[] }
