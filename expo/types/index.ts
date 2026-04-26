export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  note: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  students: Student[];
  createdAt: string;
}

export type ParticipationRating = '+' | 'o' | '-';

export type PositiveReason = 'good_participation' | 'group_work' | 'helpful';
export type NegativeReason = 'unfocused' | 'disruptive' | 'unprepared';
export type ParticipationReason = PositiveReason | NegativeReason | null;

export interface ParticipationEntry {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  rating: ParticipationRating;
  reason: ParticipationReason;
  date: string;
  sessionId: string;
}

export type HomeworkStatus = 'done' | 'late' | 'missing';

export interface HomeworkRecord {
  studentId: string;
  status: HomeworkStatus;
}

export interface HomeworkEntry {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  status: HomeworkStatus;
  date: string;
  sessionId: string;
}

export interface LessonSession {
  id: string;
  classId: string;
  subject: string;
  startedAt: string;
  ratings: Record<string, ParticipationRating>;
  reasons: Record<string, ParticipationReason>;
  homework: Record<string, HomeworkStatus>;
  absent?: Record<string, boolean>;
  lateMinutes?: Record<string, number>;
}

export interface TeacherProfile {
  name: string;
  school: string;
  subjects: string[];
}

export interface AbsenceEntry {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  date: string;
  sessionId: string;
}

export interface LateEntry {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  minutes: number;
  date: string;
  sessionId: string;
}

export interface AppData {
  profile: TeacherProfile;
  classes: SchoolClass[];
  participations: ParticipationEntry[];
  homeworkEntries: HomeworkEntry[];
  absenceEntries: AbsenceEntry[];
  lateEntries: LateEntry[];
  activeSession: LessonSession | null;
  onboardingComplete: boolean;
  pinHash: string;
}

