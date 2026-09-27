import { api } from '@/lib/axios';
import type { Semester } from '@/features/academics/api';
import type { RosterStudent } from '@/features/offerings/api';

export interface ScaleBand {
  letter: string;
  minScore: number;
  gradePoint: number;
  isPass: boolean;
  remark: string | null;
}

export interface GradingScale {
  id: string;
  version: number;
  name: string;
  passMark: number;
  maxGradePoint: number;
  createdAt: string;
  bands: ScaleBand[];
}

export interface AssessmentComponent {
  id?: string;
  name: string;
  kind: 'CONTINUOUS' | 'EXAM';
  weight: number;
  maxScore: number;
  releasedAt?: string | null;
  marksUpdatedAt?: string | null;
}

export type SheetStatus = 'DRAFT' | 'SUBMITTED' | 'HOD_APPROVED' | 'DEAN_APPROVED' | 'PUBLISHED';

export interface Workbook {
  offering: { id: string; semesterLabel: string; course: { code: string; title: string; creditHours: number } };
  isLead: boolean;
  canEdit: boolean;
  sheet: { status: SheetStatus; returnNote: string | null; returnedAt: string | null; submittedAt: string | null; publishedAt: string | null };
  assessments: Array<Required<Pick<AssessmentComponent, 'id'>> & AssessmentComponent>;
  suggestedScheme: AssessmentComponent[] | null;
  students: RosterStudent[];
  marks: Array<{ assessmentId: string; studentId: string; score: number | null; absent: boolean }>;
  scale: GradingScale | null;
}

export interface MarkEntry {
  assessmentId: string;
  studentId: string;
  score: number | null;
  absent: boolean;
}

export interface SheetSummary {
  students: number;
  passRate: number | null;
  mean: number | null;
  incomplete: number;
  distribution: Record<string, number>;
}

export interface Sheet {
  id: string;
  status: SheetStatus;
  submittedAt: string | null;
  hodApprovedAt: string | null;
  deanApprovedAt: string | null;
  publishedAt: string | null;
  returnNote: string | null;
  returnedAt: string | null;
  scale: { version: number; name: string; passMark: number } | null;
  offering: {
    id: string;
    semesterLabel: string;
    course: { code: string; title: string; creditHours: number; department: { id: string; name: string } };
    lecturers: Array<{ name: string; isLead: boolean }>;
  };
  summary: SheetSummary;
  canAct: boolean;
  nextAction: 'approve' | 'publish' | null;
}

export interface SheetDetail extends Sheet {
  results: Array<{
    caScore: number;
    examScore: number;
    total: number;
    grade: string;
    gradePoint: number;
    isPass: boolean;
    incomplete: boolean;
    student: { id: string; indexNumber: string; firstName: string; middleName: string | null; lastName: string };
  }>;
}

export interface MyResults {
  cgpa: number | null;
  creditsAttempted: number;
  creditsPassed: number;
  semesters: Array<{
    id: string;
    label: string;
    gpa: number | null;
    credits: number;
    courses: Array<{ code: string; title: string; credits: number; total: number; grade: string; gradePoint: number; isPass: boolean; incomplete: boolean }>;
  }>;
}

export interface MyInternals {
  semester: { id: string; label: string };
  courses: Array<{
    offeringId: string;
    course: { code: string; title: string };
    assessments: Array<{ id: string; name: string; weight: number; maxScore: number; releasedAt: string; score: number | null; absent: boolean; contribution: number | null }>;
  }>;
}

export const resultsApi = {
  scale: () => api.get<GradingScale>('/grading/scale').then((r) => r.data),
  saveScale: (dto: { name: string; passMark: number; maxGradePoint: number; bands: Array<Omit<ScaleBand, 'remark'> & { remark?: string }> }) =>
    api.put<GradingScale>('/grading/scale', dto).then((r) => r.data),

  workbook: (offeringId: string) => api.get<Workbook>(`/teaching/classes/${offeringId}/marks`).then((r) => r.data),
  saveScheme: (offeringId: string, components: AssessmentComponent[]) =>
    api.put<Workbook>(`/teaching/classes/${offeringId}/scheme`, { components: components.map(({ releasedAt, marksUpdatedAt, ...c }) => c) }).then((r) => r.data),
  saveMarks: (offeringId: string, entries: MarkEntry[]) => api.put<Workbook>(`/teaching/classes/${offeringId}/marks`, { entries }).then((r) => r.data),
  share: (offeringId: string, assessmentId: string) => api.post<Workbook>(`/teaching/classes/${offeringId}/assessments/${assessmentId}/share`).then((r) => r.data),
  submit: (offeringId: string) => api.post<Workbook>(`/teaching/classes/${offeringId}/results/submit`).then((r) => r.data),

  sheets: (params: { semesterId?: string; status?: string }) =>
    api.get<{ semester: Semester; items: Sheet[]; actionableStages: string[] }>('/results/sheets', { params }).then((r) => r.data),
  sheet: (id: string) => api.get<SheetDetail>(`/results/sheets/${id}`).then((r) => r.data),
  advance: (id: string) => api.post<SheetDetail>(`/results/sheets/${id}/advance`).then((r) => r.data),
  returnSheet: (id: string, note: string) => api.post<SheetDetail>(`/results/sheets/${id}/return`, { note }).then((r) => r.data),

  myResults: () => api.get<MyResults>('/me/results').then((r) => r.data),
  myInternals: () => api.get<MyInternals>('/me/internals').then((r) => r.data),
};

export const SHEET_STATUS: Record<SheetStatus, { label: string; tone: 'neutral' | 'primary' | 'warning' | 'success' }> = {
  DRAFT: { label: 'With lecturer', tone: 'neutral' },
  SUBMITTED: { label: 'Waiting for Head of Department', tone: 'warning' },
  HOD_APPROVED: { label: 'Waiting for Dean', tone: 'warning' },
  DEAN_APPROVED: { label: 'Ready to publish', tone: 'primary' },
  PUBLISHED: { label: 'Published', tone: 'success' },
};
