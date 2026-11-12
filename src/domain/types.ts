// ProofLoop: tipe domain. Data demo fiktif; bentuk mengikuti state localStorage `proofloop.v1`. © 2026 Vassel Goleyu.

export type Stage = 'draft' | 'ready' | 'progress' | 'submitted' | 'improve' | 'done';
export type Outcome = 'mandiri' | 'dengan_bantuan' | 'belum';
export type CriterionResult = 'pass' | 'revision' | 'na';
export type Role = 'Administrator' | 'Pemegang Pengetahuan' | 'Penerus' | 'Reviewer';
export type GapStatus = 'Baru' | 'Dikerjakan' | 'Selesai';
export type GapSource = 'assist' | 'issue' | 'review';

export interface Member {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: string;
  last: string;
  title: string;
  pwHash?: string;
}

export interface Criterion {
  id: string;
  text: string;
  mandatory: boolean;
}

export interface Process {
  id: string;
  name: string;
  description: string;
  category: string;
  purpose: string;
  frequency: string;
  duration: number;
  importance: string;
  ownerId: string;
  successorId: string;
  reviewerId: string;
  expected: string;
  deliverables: string;
  quality: Criterion[];
  resources: Record<string, string>;
  stage: Stage;
  cycle: number;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  draft: boolean;
  seed: boolean;
  completedAt?: string;
}

export interface Step {
  id: string;
  title: string;
  what: string;
  why: string;
  prepare: string;
  how: string;
  success: string;
  risk: string;
  fallback: string;
  critical: boolean;
  warning: string;
  example: string;
  checklist: string;
  decision: string;
  files: string[];
  /** Bila true, penerus wajib melampirkan bukti (teks atau foto) pada langkah ini. */
  needsEvidence?: boolean;
}

export interface GuideVersion {
  v: string;
  at: string;
  editor: string;
  summary: string;
  gapIds: string[];
  steps: Step[];
}

export interface Guide {
  draft: Step[];
  versions: GuideVersion[];
}

export interface Assist {
  id: string;
  step: string;
  type: string;
  text: string;
  provider: string;
  at: string;
  evidence: string;
  verified: boolean;
}

export interface Issue {
  id: string;
  step: string;
  kind: string;
  text: string;
  at: string;
}

export interface Submission {
  files: string[];
  link: string;
  text: string;
}

export interface StepEvidence {
  text: string;
  /** Data URL gambar yang sudah diperkecil. Disimpan di peramban, bukan di server. */
  photo?: { name: string; dataUrl: string };
  at: string;
}

export interface ReviewComment {
  id: string;
  stepId: string;
  authorId: string;
  text: string;
  at: string;
}

export interface ReviewNotes {
  well: string;
  unclear: string;
  steps: string;
  next: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  results: Record<string, CriterionResult>;
  notes: ReviewNotes;
  reason: string;
  at: string;
}

export type AttemptStatus = 'progress' | 'submitted' | 'reviewed';

export interface Attempt {
  id: string;
  pid: string;
  cycle: number;
  guideVersion: string;
  startedAt: string;
  submittedAt: string | null;
  doneSteps: string[];
  cursor: number;
  assist: Assist[];
  issues: Issue[];
  submission: Submission;
  self: Record<string, boolean>;
  minutes: number;
  status: AttemptStatus;
  outcome: Outcome | null;
  review: Review | null;
  notes: unknown[];
  stepEvidence?: Record<string, StepEvidence>;
  comments?: ReviewComment[];
}

export interface Gap {
  id: string;
  pid: string;
  attemptId: string;
  stepId: string;
  source: GapSource;
  desc: string;
  evidence: string;
  cause: number;
  suggestion: string;
  status: GapStatus | string;
  resolvedIn: string | null;
}

export interface Notification {
  id: string;
  to: string;
  type: string;
  title: string;
  body: string;
  route: string;
  read: boolean;
  at: string;
}

export interface Activity {
  id: string;
  who: string;
  text: string;
  route: string;
  at: string;
}

export interface State {
  ver: 1;
  session: { user: string | null };
  ui: { view: string };
  onboarding?: boolean;
  org: {
    id: string;
    name: string;
    type: string;
    size: string;
    description: string;
    objective: string;
    createdAt: string;
  };
  members: Member[];
  invites: unknown[];
  processes: Process[];
  guides: Record<string, Guide>;
  attempts: Attempt[];
  gaps: Gap[];
  notifications: Notification[];
  activity: Activity[];
  settings: unknown;
}

/** Sumber waktu dan id diinjeksi agar logika murni dan bisa diuji secara deterministik. */
export interface Ctx {
  now: () => string;
  uid: (prefix: string) => string;
}
