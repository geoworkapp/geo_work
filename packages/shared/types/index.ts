// Core data models shared between React app and Cloud Functions
// These serve as the source of truth for data structure

export interface User {
  uid: string;
  email: string;
  displayName: string;
  companyId: string;
  role: 'admin' | 'employee';
  hourlyWage?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  companyId: string;
  companyName: string;
  ownerUid: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobSite {
  siteId: string;
  companyId: string;
  siteName: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in meters
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  entryId: string;
  userId: string;
  siteId: string;
  companyId: string;
  eventType: 'enter' | 'exit';
  timestamp: Date;
  method: 'automatic' | 'manual';
  deviceInfo?: {
    platform: string;
    appVersion: string;
  };
  createdAt: Date;
}

export interface CompletedShift {
  shiftId: string;
  userId: string;
  siteId: string;
  companyId: string;
  enterTime: Date;
  exitTime: Date;
  durationMinutes: number;
  hourlyWage: number;
  totalPay: number;
  isApproved: boolean;
  notes?: string;
  createdAt: Date;
}

// API Request/Response types
export interface CreateJobSiteRequest {
  siteName: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface GenerateReportRequest {
  userId: string;
  startDate: Date;
  endDate: Date;
}

export interface GenerateReportResponse {
  shifts: CompletedShift[];
  totalHours: number;
  totalPay: number;
  anomalies: TimeEntry[];
}

export interface InviteUserRequest {
  email: string;
  displayName: string;
  hourlyWage: number;
}

// Frontend-specific types
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface MapState {
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  selectedSite: JobSite | null;
} 