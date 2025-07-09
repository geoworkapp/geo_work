// Enhanced Schedule Session Types - Comprehensive Auto Time Tracking System
// Includes break automation, overtime detection, employee consent, and error recovery

export interface BreakPeriod {
  id: string;
  startTime: Date;
  endTime: Date | null;
  type: 'manual' | 'auto' | 'required' | 'geofence_exit';
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  triggeredBy: 'employee' | 'system' | 'admin' | 'schedule';
  duration?: number; // minutes, calculated when endTime is set
}

export interface AutoBreakSettings {
  enabled: boolean;
  requiredBreakDuration: number; // minutes, from CompanySettings
  autoStartBreak: boolean; // automatically start break at scheduled time
  autoEndBreak: boolean; // automatically end break after duration
  geofenceBasedBreaks: boolean; // start break when leaving job site
  scheduleBasedBreaks: boolean; // start break at specific scheduled times
  minimumWorkBeforeBreak: number; // minutes of work before break allowed
}

export interface OvertimeSettings {
  enabled: boolean;
  thresholdMinutes: number; // minutes beyond schedule before overtime
  autoClockOutAtEnd: boolean; // force clock-out when schedule ends
  allowOvertime: boolean; // permit working beyond scheduled hours
  notifyAdminAtOvertime: boolean; // send admin alert when overtime starts
  notifyEmployeeAtOvertime: boolean; // warn employee approaching overtime
  overtimeRate: number; // multiplier for overtime pay calculation
}

export interface OvertimePeriod {
  id: string;
  startTime: Date;
  endTime: Date | null;
  reason: 'schedule_overrun' | 'early_arrival' | 'manual_extension';
  approved: boolean;
  approvedBy?: string;
  duration?: number; // minutes
}

export interface EmployeeNotificationSettings {
  autoTrackingEnabled: boolean;
  notifyOnSessionStart: boolean;
  notifyOnAutoClockIn: boolean;
  notifyOnAutoClockOut: boolean;
  notifyOnBreakDetection: boolean;
  notifyOnScheduleChange: boolean;
  notifyOnOvertimeStart: boolean;
  consentGiven: boolean;
  consentDate: Date;
  consentVersion: string; // for tracking policy updates
}

export interface CompanyPolicySettings {
  geofenceAccuracy: number; // meters
  minimumTimeAtSite: number; // minutes before auto clock-in
  allowClockInEarly: boolean; // clock-in before scheduled time
  allowClockOutEarly: boolean; // clock-out before scheduled end
  clockInBuffer: number; // minutes before schedule start to allow clock-in
  clockOutBuffer: number; // minutes after schedule end to allow clock-out
  overtimeThreshold: number; // hours before overtime calculation
  requiredBreakDuration: number; // minutes
  requiredBreakInterval: number; // hours of work before break required
  geofenceExitGracePeriod: number; // minutes before triggering break/clock-out
}

export interface ScheduleSessionEvent {
  id: string;
  timestamp: Date;
  eventType: 'session_created' | 'monitoring_started' | 'employee_arrived' | 'auto_clock_in' | 
             'manual_clock_in' | 'break_started' | 'break_ended' | 'auto_clock_out' | 
             'manual_clock_out' | 'session_completed' | 'overtime_started' | 'schedule_modified' |
             'admin_override' | 'error_occurred' | 'session_repaired';
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  triggeredBy: 'schedule' | 'employee' | 'system' | 'admin' | 'geofence';
  details: string; // human-readable description
  metadata?: {
    distanceFromJobSite?: number;
    accuracy?: number;
    deviceInfo?: {
      platform: string;
      appVersion: string;
      deviceId: string;
    };
    scheduleChange?: {
      field: string;
      oldValue: any;
      newValue: any;
    };
  };
}

export interface AdminOverride {
  id: string;
  timestamp: Date;
  adminId: string;
  adminName: string;
  action: 'force_clock_in' | 'force_clock_out' | 'start_break' | 'end_break' | 
          'extend_schedule' | 'terminate_session' | 'repair_session' | 'approve_overtime';
  reason: string;
  originalState: any; // snapshot of session before override
  newState: any; // snapshot of session after override
}

export interface SessionError {
  id: string;
  timestamp: Date;
  errorType: 'geofence_failure' | 'location_timeout' | 'schedule_conflict' | 
             'cloud_function_failure' | 'device_offline' | 'permission_denied';
  errorMessage: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

export interface ScheduleSession {
  // Core session identification
  id: string;
  scheduleId: string;
  employeeId: string; // Keep as employeeId for schedule context
  employeeName: string;
  jobSiteId: string;
  jobSiteName: string;
  companyId: string;

  // Schedule timing with time zone support
  timeZone: string; // Company time zone (e.g., "America/New_York")
  scheduledStartTime: Date; // UTC time
  scheduledEndTime: Date; // UTC time
  localScheduledStartTime: Date; // Local time for display
  localScheduledEndTime: Date; // Local time for display

  // Session state and status
  status: 'scheduled' | 'monitoring_active' | 'clocked_in' | 'on_break' | 
          'clocked_out' | 'completed' | 'no_show' | 'overtime' | 'error' | 'cancelled';

  // Employee presence and arrival tracking
  monitoringStarted: Date;
  employeePresent: boolean;
  arrivalTime: Date | null;
  departureTime: Date | null;
  lastLocationUpdate: Date | null;

  // Time tracking state
  clockedIn: boolean;
  clockInTime: Date | null;
  clockOutTime: Date | null;
  autoClockInTriggered: boolean;
  autoClockOutTriggered: boolean;

  // Break management
  currentlyOnBreak: boolean;
  breakPeriods: BreakPeriod[];
  autoBreakSettings: AutoBreakSettings;

  // Overtime handling
  overtimeDetection: OvertimeSettings;
  overtimePeriods: OvertimePeriod[];
  isInOvertime: boolean;

  // Company policy integration
  companySettings: CompanyPolicySettings;

  // Employee preferences and consent
  employeeNotifications: EmployeeNotificationSettings;

  // Event tracking and audit trail
  events: ScheduleSessionEvent[];
  adminOverrides: AdminOverride[];

  // Error handling and health monitoring
  errors: SessionError[];
  lastHealthCheck: Date;
  healthStatus: 'healthy' | 'warning' | 'error' | 'critical';

  // Calculated metrics and analytics
  totalScheduledTime: number; // minutes
  totalWorkedTime: number; // minutes (excluding breaks)
  totalBreakTime: number; // minutes
  totalOvertimeTime: number; // minutes
  punctualityScore: number; // 0-100, based on arrival vs scheduled time
  attendanceRate: number; // 0-100, based on presence during scheduled time
  complianceScore: number; // 0-100, overall compliance with schedule

  // Audit timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin ID who created the schedule
  lastModifiedBy: string; // Last person to modify the session
}

// Supporting types for session queries and operations
export interface ScheduleSessionQuery {
  companyId: string;
  employeeIds?: string[];
  jobSiteIds?: string[];
  startDate?: Date;
  endDate?: Date;
  status?: ScheduleSession['status'][];
  includeErrors?: boolean;
  includeCompleted?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'scheduledStartTime' | 'createdAt' | 'updatedAt' | 'punctualityScore';
  sortOrder?: 'asc' | 'desc';
}

export interface ScheduleSessionSummary {
  sessionId: string;
  employeeId: string;
  employeeName: string;
  jobSiteName: string;
  scheduledHours: number;
  workedHours: number;
  breakHours: number;
  overtimeHours: number;
  punctualityScore: number;
  attendanceRate: number;
  complianceScore: number;
  status: ScheduleSession['status'];
  date: Date;
}

// Real-time session update types for live dashboard
export interface SessionUpdate {
  sessionId: string;
  updateType: 'location' | 'status' | 'break' | 'error' | 'overtime';
  timestamp: Date;
  data: any;
}

// Bulk operations for admin management
export interface BulkSessionOperation {
  operationId: string;
  companyId: string;
  type: 'approve_overtime' | 'force_clock_out' | 'repair_errors' | 'extend_sessions';
  sessionIds: string[];
  parameters: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: {
    successful: number;
    failed: number;
    errors: string[];
  };
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

// Export as named export only - no default export for types with verbatimModuleSyntax 