export enum VisitStatus {
  REGULAR = 'REGULAR',
  EMERGENCY = 'EMERGENCY',
  OTHER = 'OTHER',
  CANCELLED = 'CANCELLED'
}

// --- DATABASE SCHEMA & PERFORMANCE STRATEGY ---
// To avoid "Noisy Neighbor" issues and ensure high performance:
// 1. Partitioning: The database should be horizontally partitioned (sharded) by 'companyId'.
// 2. Indexing: 
//    - Visits Table: Composite Index on (companyId, date, startTime)
//    - Staff Table: Index on (companyId, leftDate)
//    - Shifts Table: Composite Index on (companyId, date, staffId)
// 3. RLS (Row Level Security): Enforce 'companyId' check at the database engine level.
// --------------------------------------------------

export interface Staff {
  id: string;
  companyId: string; // Tenant ID (Indexed)
  name: string;
  jobTitle?: string; // Added: Job title managed by company settings
  color: string; // Tailwind color class prefix or hex
  avatar: string;
  joinedDate: string; // ISO Date YYYY-MM-DD
  leftDate?: string; // ISO Date YYYY-MM-DD (If defined, staff is retired after this date)
  defaultHolidayWeekDays?: number[]; // 0=Sun, 1=Mon, ... Default holidays
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekDays: number[]; // 0=Sun, 1=Mon, ... 6=Sat
  weekNos?: number[]; // 1=1st, 2=2nd, ... 5=5th/Last (Used when frequency is monthly)
  endType: 'never' | 'date' | 'count';
  endDate?: string; // ISO Date
  endCount?: number;
}

export interface Visit {
  id: string;
  companyId: string; // Tenant ID (Indexed)
  staffIds: string[]; // Assigned staff IDs (Multiple)
  patientName: string; // Manual entry
  address?: string; // Address for Google Maps
  date: string; // ISO Date YYYY-MM-DD (Start date)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: string; // Changed from Enum to string to support dynamic keys, though we map internal keys
  recurrence: 'none' | 'custom';
  recurrenceRule?: RecurrenceRule;
  excludeDates?: string[]; // Dates to skip (ISO YYYY-MM-DD)
  recurrenceEndDate?: string; // Date when the series stops
  notes: string; 
}

export interface VisitWithStaff extends Visit {
  staffMembers?: Staff[]; // Resolved staff objects
}

export type RecurrenceScope = 'this' | 'following' | 'all';

// Updated to include holiday+night combinations
export type ShiftType = 'night1' | 'night2' | 'holiday' | 'work' | 'night1_holiday' | 'night2_holiday' | null;

export interface ShiftAssignment {
  id: string;
  companyId: string; // Tenant ID (Indexed)
  staffId: string;
  date: string; // YYYY-MM-DD
  type: ShiftType;
}

export type UserRole = 'system_admin' | 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  companyId?: string; // Null for system_admin
  companyName?: string;
}

export interface UserAccount extends AuthUser {
  password?: string; // For mock DB management
}

export interface CompanySettings {
  // Custom labels and colors for system statuses
  visitStatuses: {
    key: string; // 'REGULAR', 'EMERGENCY', 'OTHER', 'CANCELLED'
    label: string;
    color: string; // Tailwind class identifier e.g. 'blue', 'red'
  }[];
  // Job titles available for staff
  jobTitles: string[];
}

export interface Company {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  contactPerson: string;
  email: string;
  userCount: number;
  createdAt: string;
  settings: CompanySettings; // Added tenant-specific settings
}

export interface ScheduleSuggestion {
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  // reason: string; // Removed as requested
}
