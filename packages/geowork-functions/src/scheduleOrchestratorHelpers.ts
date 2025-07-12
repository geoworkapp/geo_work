/**
 * Helper functions for Schedule Orchestrator
 * Data access, calculations, notifications, and utilities
 */

import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";
import { 
  ScheduleSession, 
  ScheduleSessionEvent, 
  BreakPeriod,
  CompanyPolicySettings,
  EmployeeNotificationSettings,

} from '../../shared/types/schedule-session';

const db = admin.firestore();

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

/**
 * Get employee details by ID
 */
export async function getEmployee(employeeId: string): Promise<any | null> {
  try {
    const employeeDoc = await db.collection('users').doc(employeeId).get();
    return employeeDoc.exists ? employeeDoc.data() : null;
  } catch (error) {
    logger.error(`Error fetching employee ${employeeId}:`, error);
    return null;
  }
}

/**
 * Get job site details by ID
 */
export async function getJobSite(jobSiteId: string): Promise<any | null> {
  try {
    const jobSiteDoc = await db.collection('jobSites').doc(jobSiteId).get();
    return jobSiteDoc.exists ? jobSiteDoc.data() : null;
  } catch (error) {
    logger.error(`Error fetching job site ${jobSiteId}:`, error);
    return null;
  }
}

/**
 * Get company settings by ID
 */
export async function getCompanySettings(companyId: string): Promise<CompanyPolicySettings> {
  try {
    const settingsDoc = await db.collection('companySettings').doc(companyId).get();
    
    const defaults = {
      minimumTimeAtSite: 5,
      allowClockInEarly: false,
      allowClockOutEarly: false,
      clockInBuffer: 15,
      clockOutBuffer: 30,
      overtimeThreshold: 8.0,
      requiredBreakDuration: 30,
      requiredBreakInterval: 4,
      geofenceExitGracePeriod: 5,
    } as const;

    if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      return { ...defaults, ...(settings || {}) };
    }

    // No settings doc – log once and return defaults
    logger.warn(`companySettings/${companyId} missing – using defaults`);
    return defaults;
  } catch (error) {
    logger.error(`Error fetching company settings ${companyId}:`, error);
    return {
      minimumTimeAtSite: 5,
      allowClockInEarly: false,
      allowClockOutEarly: false,
      clockInBuffer: 15,
      clockOutBuffer: 30,
      overtimeThreshold: 8.0,
      requiredBreakDuration: 30,
      requiredBreakInterval: 4,
      geofenceExitGracePeriod: 5
    };
  }
}

/**
 * Get employee notification settings
 */
export async function getEmployeeNotificationSettings(employeeId: string): Promise<EmployeeNotificationSettings> {
  try {
    const settingsDoc = await db.collection('employeeNotificationSettings').doc(employeeId).get();
    
    if (settingsDoc.exists) {
      return settingsDoc.data() as EmployeeNotificationSettings;
    }
    
    // Return defaults
    return {
      autoTrackingEnabled: true,
      notifyOnSessionStart: true,
      notifyOnAutoClockIn: true,
      notifyOnAutoClockOut: true,
      notifyOnBreakDetection: true,
      notifyOnScheduleChange: true,
      notifyOnOvertimeStart: true,
      consentGiven: false,
      consentDate: new Date(),
      consentVersion: '1.0'
    };
  } catch (error) {
    logger.error(`Error fetching notification settings ${employeeId}:`, error);
    // Return safe defaults
    return {
      autoTrackingEnabled: false,
      notifyOnSessionStart: false,
      notifyOnAutoClockIn: false,
      notifyOnAutoClockOut: false,
      notifyOnBreakDetection: false,
      notifyOnScheduleChange: false,
      notifyOnOvertimeStart: false,
      consentGiven: false,
      consentDate: new Date(),
      consentVersion: '1.0'
    };
  }
}

/**
 * Get latest employee location from heartbeat/location collection
 */
export async function getLatestEmployeeLocation(employeeId: string): Promise<{latitude: number, longitude: number, accuracy: number, timestamp: Date} | null> {
  try {
    // Check timeEntries for heartbeat location data
    const recentEntries = await db.collection('timeEntries')
      .where('employeeId', '==', employeeId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (!recentEntries.empty) {
      const entry = recentEntries.docs[0].data();
      if (entry.location) {
        return {
          latitude: entry.location.latitude,
          longitude: entry.location.longitude,
          accuracy: entry.location.accuracy || 50,
          timestamp: entry.timestamp.toDate()
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.error(`Error fetching location for employee ${employeeId}:`, error);
    return null;
  }
}

// ============================================================================
// SESSION CREATION FUNCTIONS
// ============================================================================

/**
 * Create a new schedule session
 */
export async function createScheduleSession(
  scheduleId: string,
  schedule: any,
  employee: any,
  jobSite: any,
  companySettings: CompanyPolicySettings
): Promise<ScheduleSession> {
  
  const now = new Date();
  const notificationSettings = await getEmployeeNotificationSettings(schedule.employeeId);
  
  // Handle time zones
  const timeZone = (companySettings as any).timeZone || 'UTC';
  const scheduledStartTime = schedule.startTime.toDate();
      const scheduledEndTime = schedule.endTime.toDate();
  
  const session: ScheduleSession = {
    id: '', // Will be set by Firestore
    scheduleId,
    employeeId: schedule.employeeId,
    employeeName: employee.profile?.firstName + ' ' + employee.profile?.lastName || 'Unknown Employee',
    jobSiteId: schedule.jobSiteId,
    jobSiteName: jobSite.siteName,
    companyId: schedule.companyId,
    
    // Schedule timing
    timeZone,
    scheduledStartTime,
    scheduledEndTime,
    localScheduledStartTime: scheduledStartTime, // TODO: Convert to local time
    localScheduledEndTime: scheduledEndTime, // TODO: Convert to local time
    
    // Initial state
    status: 'monitoring_active',
    monitoringStarted: now,
    employeePresent: false,
    arrivalTime: null,
    departureTime: null,
    lastLocationUpdate: null,
    
    // Time tracking
    clockedIn: false,
    clockInTime: null,
    clockOutTime: null,
    autoClockInTriggered: false,
    autoClockOutTriggered: false,
    
    // Break management
    currentlyOnBreak: false,
    breakPeriods: [],
    autoBreakSettings: {
      enabled: true,
      requiredBreakDuration: companySettings.requiredBreakDuration,
      autoStartBreak: false, // TODO: Get from company settings
      autoEndBreak: false,
      geofenceBasedBreaks: true,
      scheduleBasedBreaks: false,
      minimumWorkBeforeBreak: companySettings.requiredBreakInterval * 60
    },
    
    // Overtime
    overtimeDetection: {
      enabled: true,
      thresholdMinutes: 15, // 15 minutes after scheduled end
      autoClockOutAtEnd: false,
      allowOvertime: true,
      notifyAdminAtOvertime: true,
      notifyEmployeeAtOvertime: true,
      overtimeRate: 1.5
    },
    overtimePeriods: [],
    isInOvertime: false,
    
    // Company settings
    companySettings,
    
    // Employee notifications
    employeeNotifications: notificationSettings,
    
    // Events and tracking
    events: [{
      id: generateId(),
      timestamp: now,
      eventType: 'session_created',
      triggeredBy: 'system',
      details: `Schedule session created for ${jobSite.siteName}`,
      location: undefined,
      metadata: {
        deviceInfo: undefined
      }
    }],
    adminOverrides: [],
    
    // Error handling
    errors: [],
    lastHealthCheck: now,
    healthStatus: 'healthy',
    
    // Metrics (will be calculated as session progresses)
    totalScheduledTime: Math.floor((scheduledEndTime.getTime() - scheduledStartTime.getTime()) / 60000),
    totalWorkedTime: 0,
    totalBreakTime: 0,
    totalOvertimeTime: 0,
    punctualityScore: 100,
    attendanceRate: 100,
    complianceScore: 100,
    
    // Audit
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    lastModifiedBy: 'system'
  };
  
  return session;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Calculate work duration in minutes excluding breaks
 */
export function calculateWorkDurationMinutes(session: ScheduleSession, currentTime: Date): number {
  if (!session.clockInTime) return 0;
  
  const startTime = session.clockInTime;
  const endTime = session.clockOutTime || currentTime;
  const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
  
  // Subtract break time
  const breakMinutes = session.breakPeriods.reduce((total, breakPeriod) => {
    if (breakPeriod.endTime) {
      return total + Math.floor((breakPeriod.endTime.getTime() - breakPeriod.startTime.getTime()) / 60000);
    }
    // If break is ongoing, calculate partial duration
    if (session.currentlyOnBreak && !breakPeriod.endTime) {
      return total + Math.floor((currentTime.getTime() - breakPeriod.startTime.getTime()) / 60000);
    }
    return total;
  }, 0);
  
  return Math.max(0, totalMinutes - breakMinutes);
}

/**
 * Calculate session metrics for completion
 */
export function calculateSessionMetrics(session: ScheduleSession, updates: ScheduleSession): Partial<ScheduleSession> {
  const now = new Date();
  
  // Calculate total worked time
  const totalWorkedTime = calculateWorkDurationMinutes(session, session.clockOutTime || now);
  
  // Calculate break time
  const totalBreakTime = session.breakPeriods.reduce((total, bp) => {
    if (bp.endTime) {
      return total + Math.floor((bp.endTime.getTime() - bp.startTime.getTime()) / 60000);
    }
    return total;
  }, 0);
  
  // Calculate overtime
  const scheduledMinutes = Math.floor((session.scheduledEndTime.getTime() - session.scheduledStartTime.getTime()) / 60000);
  const totalOvertimeTime = Math.max(0, totalWorkedTime - scheduledMinutes);
  
  // Calculate punctuality score (0-100)
  let punctualityScore = 100;
  if (session.arrivalTime && session.arrivalTime > session.scheduledStartTime) {
    const lateMinutes = Math.floor((session.arrivalTime.getTime() - session.scheduledStartTime.getTime()) / 60000);
    punctualityScore = Math.max(0, 100 - (lateMinutes * 2)); // -2 points per minute late
  }
  
  // Calculate attendance rate (0-100)
  const attendanceRate = Math.min(100, (totalWorkedTime / scheduledMinutes) * 100);
  
  // Calculate compliance score (average of punctuality and attendance)
  const complianceScore = (punctualityScore + attendanceRate) / 2;
  
  return {
    totalWorkedTime,
    totalBreakTime,
    totalOvertimeTime,
    punctualityScore,
    attendanceRate,
    complianceScore
  };
}

// ============================================================================
// DECISION LOGIC FUNCTIONS
// ============================================================================

/**
 * Determine if auto clock-in should trigger
 */
export function shouldAutoClockIn(session: ScheduleSession, currentTime: Date): boolean {
  // Must be within scheduled time or buffer
  const scheduleStart = session.scheduledStartTime.getTime();
  const clockInBuffer = session.companySettings.clockInBuffer * 60000; // Convert to ms
  const earliestClockIn = scheduleStart - clockInBuffer;
  
  if (currentTime.getTime() < earliestClockIn) {
    return false;
  }
  
  // Must have employee consent
  if (!session.employeeNotifications.consentGiven || !session.employeeNotifications.autoTrackingEnabled) {
    return false;
  }
  
  // Must not already be clocked in
  if (session.clockedIn) {
    return false;
  }
  
  // Employee must be present at job site
  if (!session.employeePresent) {
    return false;
  }
  
  // Must meet minimum time at site requirement
  if (session.arrivalTime) {
    const timeAtSite = currentTime.getTime() - session.arrivalTime.getTime();
    const minimumTime = session.companySettings.minimumTimeAtSite * 60000;
    if (timeAtSite < minimumTime) {
      return false;
    }
  }
  
  return true;
}

/**
 * Determine if auto clock-out should trigger
 */
export function shouldAutoClockOut(session: ScheduleSession, currentTime: Date): boolean {
  // If geofence-based break is enabled and employee left site
  if (session.autoBreakSettings.geofenceBasedBreaks) {
    return true;
  }
  
  // If auto clock-out at schedule end is enabled
  if (session.overtimeDetection.autoClockOutAtEnd && currentTime > session.scheduledEndTime) {
    return true;
  }
  
  return false;
}

/**
 * Determine if geofence exit should trigger actions
 */
export function shouldTriggerGeofenceExit(session: ScheduleSession, currentTime: Date, gracePeriodMinutes: number): boolean {
  // Check if employee has been outside for grace period
  // This would require tracking when they first left the geofence
  // For now, trigger immediately
  return true;
}

/**
 * Check if employee has had a recent break
 */
export function hasHadRecentBreak(session: ScheduleSession, intervalMinutes: number): boolean {
  if (session.breakPeriods.length === 0) return false;
  
  const now = new Date();
  const intervalMs = intervalMinutes * 60000;
  
  return session.breakPeriods.some(bp => {
    const breakEnd = bp.endTime || now;
    return (now.getTime() - breakEnd.getTime()) < intervalMs;
  });
}

/**
 * Get current active break period
 */
export function getCurrentBreakPeriod(session: ScheduleSession): BreakPeriod | null {
  return session.breakPeriods.find(bp => !bp.endTime) || null;
}

// ============================================================================
// EVENT CREATION FUNCTIONS
// ============================================================================

/**
 * Create a session event
 */
export function createSessionEvent(
  eventType: any,
  timestamp: Date,
  triggeredBy: any,
  details: string,
  location?: {latitude: number, longitude: number, accuracy: number},
  metadata?: any
): ScheduleSessionEvent {
  const event: any = {
    id: generateId(),
    timestamp,
    eventType,
    triggeredBy,
    details
  };

  if (location !== undefined) {
    event.location = location;
  }

  if (metadata !== undefined) {
    event.metadata = metadata;
  }

  return event as ScheduleSessionEvent;
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Send notification to employee
 */
export async function notifyEmployee(employeeId: string, type: string, data: any): Promise<void> {
  try {
    // Check employee notification preferences
    const settings = await getEmployeeNotificationSettings(employeeId);
    
    // Check if this notification type is enabled
    const shouldNotify = checkNotificationEnabled(settings, type);
    if (!shouldNotify) return;
    
    // Send FCM notification
    await admin.messaging().send({
      topic: `user_${employeeId}`,
      notification: {
        title: getNotificationTitle(type),
        body: getNotificationBody(type, data)
      },
      data: {
        type,
        ...data
      }
    });
    
    logger.info(`Sent ${type} notification to employee ${employeeId}`);
  } catch (error) {
    logger.error(`Failed to notify employee ${employeeId}:`, error);
  }
}

/**
 * Send notification to admin
 */
export async function notifyAdmin(companyId: string, type: string, data: any): Promise<void> {
  try {
    await admin.messaging().send({
      topic: `company_${companyId}_admins`,
      notification: {
        title: getAdminNotificationTitle(type),
        body: getAdminNotificationBody(type, data)
      },
      data: {
        type,
        companyId,
        ...data
      }
    });
    
    logger.info(`Sent ${type} notification to company ${companyId} admins`);
  } catch (error) {
    logger.error(`Failed to notify admins for company ${companyId}:`, error);
  }
}

/**
 * Check if notification type is enabled for employee
 */
function checkNotificationEnabled(settings: EmployeeNotificationSettings, type: string): boolean {
  switch (type) {
    case 'session_starting': return settings.notifyOnSessionStart;
    case 'auto_clock_in': return settings.notifyOnAutoClockIn;
    case 'auto_clock_out': return settings.notifyOnAutoClockOut;
    case 'break_started': 
    case 'break_ended': 
    case 'break_recommended': return settings.notifyOnBreakDetection;
    case 'schedule_changed': return settings.notifyOnScheduleChange;
    case 'overtime_started': return settings.notifyOnOvertimeStart;
    default: return true;
  }
}

/**
 * Get notification title for employee notifications
 */
function getNotificationTitle(type: string): string {
  switch (type) {
    case 'session_starting': return 'Schedule Starting Soon';
    case 'auto_clock_in': return 'Automatically Clocked In';
    case 'auto_clock_out': return 'Automatically Clocked Out';
    case 'break_started': return 'Break Started';
    case 'break_ended': return 'Break Ended';
    case 'break_recommended': return 'Break Recommended';
    case 'schedule_ended': return 'Schedule Completed';
    case 'overtime_started': return 'Overtime Started';
    default: return 'Work Update';
  }
}

/**
 * Get notification body for employee notifications
 */
function getNotificationBody(type: string, data: any): string {
  switch (type) {
    case 'session_starting': return `Your shift at ${data.jobSiteName} starts soon`;
    case 'auto_clock_in': return `You've been clocked in at ${data.jobSiteName}`;
    case 'auto_clock_out': return `You've been clocked out from ${data.jobSiteName}`;
    case 'break_started': return data.reason || 'Your break has started';
    case 'break_ended': return `Break ended after ${data.duration} minutes`;
    case 'break_recommended': return `You've worked ${Math.floor(data.workDuration / 60)} hours. Consider taking a break.`;
    case 'schedule_ended': return `Your shift at ${data.jobSiteName} has ended`;
    case 'overtime_started': return `You're now in overtime at ${data.jobSiteName}`;
    default: return 'Work status update';
  }
}

/**
 * Get notification title for admin notifications
 */
function getAdminNotificationTitle(type: string): string {
  switch (type) {
    case 'overtime_detected': return 'Overtime Alert';
    case 'compliance_violations': return 'Attendance Violations';
    case 'session_errors': return 'System Issues';
    default: return 'System Alert';
  }
}

/**
 * Get notification body for admin notifications
 */
function getAdminNotificationBody(type: string, data: any): string {
  switch (type) {
    case 'overtime_detected': 
      return `${data.employeeName} is in overtime at ${data.jobSiteName} (${data.overtimeMinutes} min)`;
    case 'compliance_violations':
      return `${data.violations.length} attendance violations detected`;
    case 'session_errors':
      return `System errors detected in active sessions`;
    default: return 'System notification';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Convert minutes to hours and minutes display
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Check if time is within business hours
 */
export function isWithinBusinessHours(time: Date, companySettings: any): boolean {
  // TODO: Implement business hours check based on company settings
  return true;
}

export default {
  getEmployee,
  getJobSite,
  getCompanySettings,
  getEmployeeNotificationSettings,
  getLatestEmployeeLocation,
  createScheduleSession,
  calculateDistance,
  calculateWorkDurationMinutes,
  calculateSessionMetrics,
  shouldAutoClockIn,
  shouldAutoClockOut,
  createSessionEvent,
  notifyEmployee,
  notifyAdmin,
  generateId
}; 