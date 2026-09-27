import type { ApplicationStatus, DeliveryStatus, DispatcherStatus, EmploymentRules, JobPayUnit, WorkEligibility } from '@anu/shared';
import { api } from '@/lib/axios';

export interface Job {
  id: string;
  title: string;
  unit: string;
  description: string;
  hoursPerWeek: number;
  payRate: number;
  payUnit: JobPayUnit;
  positions: number;
  minCgpa: number | null;
  closesAt: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  decisionNote: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  job: Pick<Job, 'id' | 'title' | 'unit' | 'hoursPerWeek' | 'payRate' | 'payUnit'>;
}

export interface OpenJobs {
  standing: { cgpa: number | null; eligibility: WorkEligibility; minCgpa: number };
  jobs: Array<Job & { myStatus: ApplicationStatus | null; eligibility: WorkEligibility }>;
  applications: MyApplication[];
}

export interface StudentJob extends Job {
  supervisor: { firstName: string; lastName: string } | null;
  eligibility: WorkEligibility & { cgpa: number | null };
  myApplication: { id: string; status: ApplicationStatus; decisionNote: string | null } | null;
}

export type Transport = 'WALKING' | 'BICYCLE' | 'MOTORBIKE';
export const TRANSPORT_LABEL: Record<Transport, string> = { WALKING: 'On foot', BICYCLE: 'Bicycle', MOTORBIKE: 'Motorbike' };

export interface MyDispatcher {
  profile: null | {
    id: string; status: DispatcherStatus; statement: string; transport: Transport; payoutNetwork: string; payoutNumber: string; payoutName: string; statusNote: string | null; createdAt: string; reviewedAt: string | null;
  };
  eligibility: WorkEligibility & { cgpa: number | null };
  feePerDelivery: number;
}

export interface DispatcherApplication {
  statement: string;
  transport: Transport;
  payoutNetwork: string;
  payoutNumber: string;
  payoutName: string;
}

export interface AdminJob extends Job {
  supervisor: { firstName: string; lastName: string; email: string | null } | null;
  applicants: number;
  waiting: number;
  hired: number;
}

export interface Applicant {
  id: string;
  status: ApplicationStatus;
  statement: string;
  availability: string | null;
  cgpaAtApply: number | null;
  decisionNote: string | null;
  decidedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  cgpa: number | null;
  eligibility: WorkEligibility;
  student: { id: string; firstName: string; lastName: string; indexNumber: string | null; email: string | null; phone: string | null; studentProfile: { currentLevel: number; programme: { name: string } } | null };
}

export interface JobDetail extends Job {
  supervisor: { firstName: string; lastName: string; email: string | null } | null;
  applications: Applicant[];
}

export interface AdminDispatcher {
  id: string;
  status: DispatcherStatus;
  statement: string;
  transport: Transport;
  payoutNetwork: string;
  payoutNumber: string;
  payoutName: string;
  cgpaAtApply: number | null;
  online: boolean;
  lastSeenAt: string | null;
  statusNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  cgpa: number | null;
  eligibility: WorkEligibility;
  deliveriesLast30Days: number;
  earnedLast30Days: number;
  student: Applicant['student'];
}

export interface JobInput {
  title: string;
  unit: string;
  description: string;
  hoursPerWeek: number;
  payRate: number;
  payUnit: JobPayUnit;
  positions: number;
  minCgpa?: number | null;
  closesAt: string;
  supervisorEmail?: string;
}

export const workApi = {
  openJobs: () => api.get<OpenJobs>('/me/work/jobs').then((r) => r.data),
  job: (id: string) => api.get<StudentJob>(`/me/work/jobs/${id}`).then((r) => r.data),
  apply: (id: string, dto: { statement: string; availability?: string }) => api.post(`/me/work/jobs/${id}/apply`, dto),
  withdraw: (applicationId: string) => api.post(`/me/work/applications/${applicationId}/withdraw`),
  dispatcher: () => api.get<MyDispatcher>('/me/work/dispatcher').then((r) => r.data),
  applyDispatcher: (dto: DispatcherApplication) => api.post('/me/work/dispatcher', dto),
  updatePayout: (dto: DispatcherApplication) => api.put('/me/work/dispatcher/payout', dto),

  rules: () => api.get<EmploymentRules>('/employment/rules').then((r) => r.data),
  saveRules: (dto: EmploymentRules) => api.put('/employment/rules', dto),
  jobs: () => api.get<AdminJob[]>('/employment/jobs').then((r) => r.data),
  saveJob: (dto: JobInput, id?: string) => (id ? api.patch(`/employment/jobs/${id}`, dto) : api.post('/employment/jobs', dto)),
  setJobStatus: (id: string, status: Job['status']) => api.post(`/employment/jobs/${id}/status`, { status }),
  jobDetail: (id: string) => api.get<JobDetail>(`/employment/jobs/${id}`).then((r) => r.data),
  decide: (applicationId: string, dto: { status: 'SHORTLISTED' | 'HIRED' | 'REJECTED' | 'ENDED'; note?: string; startDate?: string }) => api.post(`/employment/applications/${applicationId}/decision`, dto),
  dispatchers: (status?: DispatcherStatus) => api.get<AdminDispatcher[]>('/employment/dispatchers', { params: status ? { status } : {} }).then((r) => r.data),
  reviewDispatcher: (id: string, status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'ENDED', note?: string) => api.post(`/employment/dispatchers/${id}/review`, { status, note }),
};

export interface DispatchState {
  profile: { online: boolean; transport: Transport };
  maxActive: number;
  feePerDelivery: number;
  available: Array<{ id: string; fee: number; offeredAt: string; number: number; vendor: { name: string; location: string }; area: string; items: number }>;
  mine: Array<{
    id: string; status: Extract<DeliveryStatus, 'ASSIGNED' | 'PICKED_UP'>; fee: number; assignedAt: string | null; pickedUpAt: string | null; problemNote: string | null;
    order: {
      id: string; number: number; deliveryAddress: string | null; deliveryNote: string | null; total: number;
      vendor: { name: string; location: string; phone: string };
      customer: { firstName: string; lastName: string; phone: string | null };
      items: Array<{ name: string; quantity: number }>;
    };
  }>;
  today: { deliveries: number; earned: number };
}

export interface Earnings {
  deliveries: Array<{ id: string; fee: number; deliveredAt: string; order: { number: number; vendor: { name: string }; deliveryAddress: string } }>;
  earned: number;
  payouts: Array<{ id: string; amount: number; reference: string | null; createdAt: string; periodFrom: string; periodTo: string }>;
  balance: number;
  payout: { network: string; number: string; name: string };
}

export const dispatchApi = {
  state: () => api.get<DispatchState>('/dispatch').then((r) => r.data),
  setOnline: (online: boolean) => api.post('/dispatch/online', { online }),
  take: (id: string) => api.post(`/dispatch/deliveries/${id}/take`),
  release: (id: string) => api.post(`/dispatch/deliveries/${id}/release`),
  pickedUp: (id: string) => api.post(`/dispatch/deliveries/${id}/picked-up`),
  delivered: (id: string, code: string) => api.post<{ earned: number }>(`/dispatch/deliveries/${id}/delivered`, { code }).then((r) => r.data),
  problem: (id: string, note: string) => api.post(`/dispatch/deliveries/${id}/problem`, { note }),
  earnings: (from: string, to: string) => api.get<Earnings>('/dispatch/earnings', { params: { from, to } }).then((r) => r.data),
};

export const APPLICATION_TONE: Record<ApplicationStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  SUBMITTED: 'primary', SHORTLISTED: 'warning', HIRED: 'success', REJECTED: 'neutral', WITHDRAWN: 'neutral', ENDED: 'neutral',
};
export const DISPATCHER_TONE: Record<DispatcherStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning', ACTIVE: 'success', SUSPENDED: 'danger', REJECTED: 'neutral', ENDED: 'neutral',
};
export const cgpaText = (cgpa: number | null) => (cgpa === null ? 'No results yet' : cgpa.toFixed(2));
