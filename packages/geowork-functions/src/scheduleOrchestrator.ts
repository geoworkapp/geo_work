/**
 * Schedule Orchestrator Cloud Function
 * Comprehensive system for automatic schedule-driven time tracking
 * 
 * Features:
 * - Schedule-based session initialization
 * - Automatic break management
 * - Overtime detection and handling
 * - Employee presence monitoring
 * - Error recovery and health checks
 * - Real-time admin notifications
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import * as logger from "firebase-functions/logger";

// Import our types
import { 
  ScheduleSession, 
  ScheduleSessionEvent
} from '../../shared/types/schedule-session';

// Import helper functions
import {
  getEmployee,
  getJobSite,
  getCompanySettings,
  getLatestEmployeeLocation,
  calculateDistance,
  createScheduleSession,
  createSessionEvent,
  notifyEmployee,
  notifyAdmin,
  shouldAutoClockIn,
  shouldAutoClockOut,
  shouldTriggerGeofenceExit,
  getCurrentBreakPeriod,
  generateId,
  calculateSessionMetrics,
  calculateWorkDurationMinutes,
  hasHadRecentBreak
} from './scheduleOrchestratorHelpers';

// Ensure Admin SDK is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Core orchestrator - runs every minute to manage active sessions
const scheduleOrchestrator = onSchedule('every 1 minutes', async (event) => {
  logger.info('Schedule orchestrator starting...');
  
  try {
    await Promise.all([
      processScheduleStarts(),
      processActiveScheduleSessions(),
      processScheduleEnds(),
      detectOvertimeViolations(),
      processAutoBreaks(),
      healthCheckSessions(),
      detectComplianceViolations(),
      cleanupCompletedSessions()
    ]);
    
    logger.info('Schedule orchestrator completed successfully');
  } catch (error) {
    logger.error('Schedule orchestrator failed:', error);
    throw error;
  }
});

/**
 * Process schedules that should start monitoring now
 */
async function processScheduleStarts(): Promise<void> {
  const now = new Date();
  const bufferTime = 10; // minutes before schedule start to begin monitoring
  
  // Find schedules starting within the next 10 minutes that don't have sessions yet
  const schedulesQuery = await db.collection('schedules')
    .where('startTime', '<=', new Date(now.getTime() + bufferTime * 60000))
    .where('startTime', '>', new Date(now.getTime() - bufferTime * 60000))
    .where('status', '==', 'scheduled')
    .get();

  const batch = db.batch();
  let sessionsCreated = 0;

  for (const scheduleDoc of schedulesQuery.docs) {
    const schedule = scheduleDoc.data();
    
    // Check if session already exists
    const existingSession = await db.collection('scheduleSessions')
      .where('scheduleId', '==', scheduleDoc.id)
      .limit(1)
      .get();

    if (existingSession.empty) {
      // Get employee and company details
      const employee = await getEmployee(schedule.employeeId);
      const jobSite = await getJobSite(schedule.jobSiteId);
      const companySettings = await getCompanySettings(schedule.companyId);
      
      if (employee && jobSite && companySettings) {
        const session = await createScheduleSession(scheduleDoc.id, schedule, employee, jobSite, companySettings);
        const sessionRef = db.collection('scheduleSessions').doc();
        batch.set(sessionRef, session);
        sessionsCreated++;
        
        // Notify employee of upcoming schedule
        await notifyEmployee(schedule.employeeId, 'session_starting', {
          sessionId: sessionRef.id,
          jobSiteName: jobSite.siteName,
          startTime: schedule.startTime
        });
      }
    }
  }

  if (sessionsCreated > 0) {
    await batch.commit();
    logger.info(`Created ${sessionsCreated} new schedule sessions`);
  }
}

/**
 * Process active schedule sessions for location monitoring and auto clock-in/out
 */
async function processActiveScheduleSessions(): Promise<void> {
  const now = new Date();
  
  // Find all active sessions that need processing
  const activeSessions = await db.collection('scheduleSessions')
    .where('status', 'in', ['monitoring_active', 'clocked_in', 'on_break'])
    .get();

  const batch = db.batch();
  let updatesCount = 0;

  for (const sessionDoc of activeSessions.docs) {
    const session = sessionDoc.data() as ScheduleSession;
    const sessionRef = sessionDoc.ref;
    
    try {
      // Get latest employee location
      const employeeLocation = await getLatestEmployeeLocation(session.employeeId);
      
      if (employeeLocation) {
        const jobSite = await getJobSite(session.jobSiteId);
        if (!jobSite) continue;
        
        const distanceFromJobSite = calculateDistance(
          employeeLocation.latitude,
          employeeLocation.longitude,
          jobSite.location.latitude,
          jobSite.location.longitude
        );
        
        const isWithinGeofence = distanceFromJobSite <= jobSite.radius;
        const updates: Partial<ScheduleSession> = {};
        const events: ScheduleSessionEvent[] = [];
        
        // Handle employee arrival detection
        if (!session.employeePresent && isWithinGeofence) {
          updates.employeePresent = true;
          updates.arrivalTime = now;
          
          events.push(createSessionEvent('employee_arrived', now, 'geofence', 
            `Employee arrived at ${session.jobSiteName}`, employeeLocation, {
              distanceFromJobSite
            }));
          
          // Auto clock-in if conditions are met
          if (shouldAutoClockIn(session, now)) {
            updates.clockedIn = true;
            updates.clockInTime = now;
            updates.autoClockInTriggered = true;
            updates.status = 'clocked_in';
            
            events.push(createSessionEvent('auto_clock_in', now, 'system',
              `Automatically clocked in at ${session.jobSiteName}`, employeeLocation));
              
            await notifyEmployee(session.employeeId, 'auto_clock_in', {
              sessionId: session.id,
              jobSiteName: session.jobSiteName,
              time: now
            });
          }
        }
        
        // Handle employee departure detection
        if (session.employeePresent && !isWithinGeofence) {
          const gracePeriod = session.companySettings.geofenceExitGracePeriod || 5;
          
          // Check if employee has been outside geofence for grace period
          if (shouldTriggerGeofenceExit(session, now, gracePeriod)) {
            updates.employeePresent = false;
            updates.departureTime = now;
            
            events.push(createSessionEvent('employee_departed', now, 'geofence',
              `Employee left ${session.jobSiteName}`, employeeLocation, {
                distanceFromJobSite
              }));
            
            // Auto clock-out if clocked in
            if (session.clockedIn && shouldAutoClockOut(session, now)) {
              updates.clockedIn = false;
              updates.clockOutTime = now;
              updates.autoClockOutTriggered = true;
              updates.status = 'clocked_out';
              
              events.push(createSessionEvent('auto_clock_out', now, 'system',
                `Automatically clocked out - left ${session.jobSiteName}`, employeeLocation));
                
              await notifyEmployee(session.employeeId, 'auto_clock_out', {
                sessionId: session.id,
                jobSiteName: session.jobSiteName,
                time: now
              });
            }
          }
        }
        
        // Update location tracking
        updates.lastLocationUpdate = now;
        
        // Add events to session
        if (events.length > 0) {
          updates.events = [...(session.events || []), ...events];
        }
        
        // Apply updates
        if (Object.keys(updates).length > 0) {
          batch.update(sessionRef, {
            ...updates,
            updatedAt: now,
            lastModifiedBy: 'system'
          });
          updatesCount++;
        }
      }
      
    } catch (error) {
      logger.error(`Error processing session ${session.id}:`, error);
      
      // Add error to session
      batch.update(sessionRef, {
        errors: [...(session.errors || []), {
          id: generateId(),
          timestamp: now,
          errorType: 'cloud_function_failure',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
          resolved: false
        }],
        healthStatus: 'error',
        updatedAt: now
      });
    }
  }

  if (updatesCount > 0) {
    await batch.commit();
    logger.info(`Processed ${updatesCount} active sessions`);
  }
}

/**
 * Process schedules that should end monitoring now
 */
async function processScheduleEnds(): Promise<void> {
  const now = new Date();
  const bufferTime = 30; // minutes after schedule end to complete session
  
  // Find sessions that should be completed
  const endingSessions = await db.collection('scheduleSessions')
    .where('scheduledEndTime', '<=', new Date(now.getTime() - bufferTime * 60000))
    .where('status', 'in', ['monitoring_active', 'clocked_in', 'on_break'])
    .get();

  const batch = db.batch();
  let completedCount = 0;

  for (const sessionDoc of endingSessions.docs) {
    const session = sessionDoc.data() as ScheduleSession;
    const sessionRef = sessionDoc.ref;
    
    const updates: Partial<ScheduleSession> = {
      status: 'completed',
      updatedAt: now,
      lastModifiedBy: 'system'
    };
    
    // Auto clock-out if still clocked in
    if (session.clockedIn) {
      updates.clockedIn = false;
      updates.clockOutTime = now;
      updates.autoClockOutTriggered = true;
      
      const clockOutEvent = createSessionEvent('auto_clock_out', now, 'system',
        'Automatically clocked out - schedule ended');
      
      updates.events = [...(session.events || []), clockOutEvent];
      
      await notifyEmployee(session.employeeId, 'schedule_ended', {
        sessionId: session.id,
        jobSiteName: session.jobSiteName,
        endTime: now
      });
    }
    
    // Calculate final metrics
    const metrics = calculateSessionMetrics(session, updates as ScheduleSession);
    Object.assign(updates, metrics);
    
    batch.update(sessionRef, updates);
    completedCount++;
  }

  if (completedCount > 0) {
    await batch.commit();
    logger.info(`Completed ${completedCount} schedule sessions`);
  }
}

/**
 * Detect and handle overtime violations
 */
async function detectOvertimeViolations(): Promise<void> {
  const now = new Date();
  
  // Find sessions that may be in overtime
  const potentialOvertimeSessions = await db.collection('scheduleSessions')
    .where('status', 'in', ['clocked_in', 'on_break'])
    .where('isInOvertime', '==', false)
    .get();

  const batch = db.batch();
  let overtimeDetected = 0;

  for (const sessionDoc of potentialOvertimeSessions.docs) {
    const session = sessionDoc.data() as ScheduleSession;
    const sessionRef = sessionDoc.ref;
    
    // Check if session has exceeded scheduled end time by threshold
    const overtimeThreshold = session.overtimeDetection.thresholdMinutes || 15;
    const overtimeStart = new Date(session.scheduledEndTime.getTime() + overtimeThreshold * 60000);
    
    if (now > overtimeStart && session.clockedIn) {
      const updates: Partial<ScheduleSession> = {
        isInOvertime: true,
        status: 'overtime',
        updatedAt: now
      };
      
      // Create overtime period
      const overtimePeriod: any = {
        id: generateId(),
        startTime: overtimeStart,
        endTime: null,
        reason: 'schedule_overrun' as const,
        approved: false,
        duration: null
      };
      
      updates.overtimePeriods = [...(session.overtimePeriods || []), overtimePeriod];
      
      // Add event
      const overtimeEvent = createSessionEvent('overtime_started', now, 'system',
        `Overtime started - exceeded scheduled end time by ${overtimeThreshold} minutes`);
      
      updates.events = [...(session.events || []), overtimeEvent];
      
      batch.update(sessionRef, updates);
      overtimeDetected++;
      
      // Notify admin and employee
      if (session.overtimeDetection.notifyAdminAtOvertime) {
        await notifyAdmin(session.companyId, 'overtime_detected', {
          sessionId: session.id,
          employeeName: session.employeeName,
          jobSiteName: session.jobSiteName,
          overtimeMinutes: Math.floor((now.getTime() - overtimeStart.getTime()) / 60000)
        });
      }
      
      if (session.overtimeDetection.notifyEmployeeAtOvertime) {
        await notifyEmployee(session.employeeId, 'overtime_started', {
          sessionId: session.id,
          jobSiteName: session.jobSiteName
        });
      }
    }
  }

  if (overtimeDetected > 0) {
    await batch.commit();
    logger.info(`Detected overtime in ${overtimeDetected} sessions`);
  }
}

/**
 * Process automatic break management
 */
async function processAutoBreaks(): Promise<void> {
  const now = new Date();
  
  // Find sessions that might need break processing
  const activeWorkingSessions = await db.collection('scheduleSessions')
    .where('status', '==', 'clocked_in')
    .where('currentlyOnBreak', '==', false)
    .get();

  const batch = db.batch();
  let breaksProcessed = 0;

  for (const sessionDoc of activeWorkingSessions.docs) {
    const session = sessionDoc.data() as ScheduleSession;
    const sessionRef = sessionDoc.ref;
    
    if (!session.autoBreakSettings.enabled) continue;
    
    const workDuration = calculateWorkDurationMinutes(session, now);
    const requiredBreakInterval = session.autoBreakSettings.minimumWorkBeforeBreak || 240; // 4 hours default
    
    // Check if employee needs a required break
    if (workDuration >= requiredBreakInterval && !hasHadRecentBreak(session, requiredBreakInterval)) {
      if (session.autoBreakSettings.autoStartBreak) {
        // Automatically start break
        const breakPeriod: any = {
          id: generateId(),
          startTime: now,
          endTime: null,
          type: 'required' as const,
          triggeredBy: 'system',
          duration: null
        };
        
        const updates: Partial<ScheduleSession> = {
          currentlyOnBreak: true,
          status: 'on_break',
          breakPeriods: [...(session.breakPeriods || []), breakPeriod],
          updatedAt: now
        };
        
        const breakEvent = createSessionEvent('break_started', now, 'system',
          'Required break started automatically - worked 4+ hours');
        
        updates.events = [...(session.events || []), breakEvent];
        
        batch.update(sessionRef, updates);
        breaksProcessed++;
        
        await notifyEmployee(session.employeeId, 'break_started', {
          sessionId: session.id,
          reason: 'Required break after 4 hours of work'
        });
      } else {
        // Notify employee that break is recommended
        await notifyEmployee(session.employeeId, 'break_recommended', {
          sessionId: session.id,
          workDuration: workDuration
        });
      }
    }
  }

  // Process auto-end breaks
  const activeBreakSessions = await db.collection('scheduleSessions')
    .where('status', '==', 'on_break')
    .where('currentlyOnBreak', '==', true)
    .get();

  for (const sessionDoc of activeBreakSessions.docs) {
    const session = sessionDoc.data() as ScheduleSession;
    const sessionRef = sessionDoc.ref;
    
    if (!session.autoBreakSettings.autoEndBreak) continue;
    
    const currentBreak = getCurrentBreakPeriod(session);
    if (!currentBreak) continue;
    
    const breakDuration = Math.floor((now.getTime() - currentBreak.startTime.getTime()) / 60000);
    const requiredBreakDuration = session.autoBreakSettings.requiredBreakDuration || 30;
    
    if (breakDuration >= requiredBreakDuration) {
      // Automatically end break
      const updatedBreakPeriods = session.breakPeriods.map(bp => 
        bp.id === currentBreak.id ? { ...bp, endTime: now, duration: breakDuration } : bp
      );
      
      const updates: Partial<ScheduleSession> = {
        currentlyOnBreak: false,
        status: 'clocked_in',
        breakPeriods: updatedBreakPeriods,
        updatedAt: now
      };
      
      const breakEndEvent = createSessionEvent('break_ended', now, 'system',
        `Break ended automatically after ${breakDuration} minutes`);
      
      updates.events = [...(session.events || []), breakEndEvent];
      
      batch.update(sessionRef, updates);
      breaksProcessed++;
      
      await notifyEmployee(session.employeeId, 'break_ended', {
        sessionId: session.id,
        duration: breakDuration
      });
    }
  }

  if (breaksProcessed > 0) {
    await batch.commit();
    logger.info(`Processed ${breaksProcessed} automatic breaks`);
  }
}

/**
 * Health check sessions for errors and stuck states
 */
async function healthCheckSessions(): Promise<void> {
  const now = new Date();
  const healthCheckInterval = 5 * 60 * 1000; // 5 minutes
  
  // Find sessions that haven't been health checked recently
  const sessionsToCheck = await db.collection('scheduleSessions')
    .where('lastHealthCheck', '<', new Date(now.getTime() - healthCheckInterval))
    .where('status', 'in', ['monitoring_active', 'clocked_in', 'on_break'])
    .limit(50) // Process in batches
    .get();

  const batch = db.batch();
  let healthChecked = 0;

  for (const sessionDoc of sessionsToCheck.docs) {
    const session = sessionDoc.data() as ScheduleSession;
    const sessionRef = sessionDoc.ref;
    
    const healthIssues = [];
    let healthStatus = 'healthy';
    
    // Check for location update issues
    if (session.lastLocationUpdate) {
      const locationAge = now.getTime() - session.lastLocationUpdate.getTime();
      if (locationAge > 15 * 60 * 1000) { // 15 minutes
        healthIssues.push({
          id: generateId(),
          timestamp: now,
          errorType: 'location_timeout' as const,
          errorMessage: 'No location updates received for 15+ minutes',
          severity: 'warning' as const,
          resolved: false
        });
        healthStatus = 'warning';
      }
    }
    
    // Check for stuck sessions
    const sessionAge = now.getTime() - session.updatedAt.getTime();
    if (sessionAge > 60 * 60 * 1000) { // 1 hour
      healthIssues.push({
        id: generateId(),
        timestamp: now,
        errorType: 'cloud_function_failure' as const,
        errorMessage: 'Session has not been updated for 1+ hours',
        severity: 'error' as const,
        resolved: false
      });
      healthStatus = 'error';
    }
    
    // Update health status
    const updates: Partial<ScheduleSession> = {
      lastHealthCheck: now,
      healthStatus: healthStatus as any,
      updatedAt: now
    };
    
    if (healthIssues.length > 0) {
      updates.errors = [...(session.errors || []), ...healthIssues];
    }
    
    batch.update(sessionRef, updates);
    healthChecked++;
  }

  if (healthChecked > 0) {
    await batch.commit();
    logger.info(`Health checked ${healthChecked} sessions`);
  }
}

/**
 * Detect compliance violations and alert admins
 */
async function detectComplianceViolations(): Promise<void> {
  const now = new Date();
  const violations = [];
  
  // Check for no-show employees (15+ minutes late)
  const lateThreshold = 15 * 60 * 1000; // 15 minutes
  const noShowSessions = await db.collection('scheduleSessions')
    .where('status', '==', 'monitoring_active')
    .where('employeePresent', '==', false)
    .where('scheduledStartTime', '<', new Date(now.getTime() - lateThreshold))
    .get();

  for (const sessionDoc of noShowSessions.docs) {
    const session = sessionDoc.data() as ScheduleSession;
    
    violations.push({
      type: 'no_show',
      sessionId: session.id,
      employeeId: session.employeeId,
      employeeName: session.employeeName,
      jobSiteName: session.jobSiteName,
      scheduledStartTime: session.scheduledStartTime,
      minutesLate: Math.floor((now.getTime() - session.scheduledStartTime.getTime()) / 60000)
    });
    
    // Update session status
    await sessionDoc.ref.update({
      status: 'no_show',
      updatedAt: now,
      lastModifiedBy: 'system'
    });
  }
  
  // Send compliance notifications to admins
  if (violations.length > 0) {
    const companiesWithViolations = [...new Set(violations.map(v => v.sessionId))];
    
    for (const companyId of companiesWithViolations) {
      const companyViolations = violations.filter(v => v.sessionId.startsWith(companyId));
      
      await notifyAdmin(companyId, 'compliance_violations', {
        violations: companyViolations,
        timestamp: now
      });
    }
    
    logger.info(`Detected ${violations.length} compliance violations`);
  }
}

/**
 * Clean up old completed sessions to optimize queries
 */
async function cleanupCompletedSessions(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days of completed sessions
  
  const oldSessions = await db.collection('scheduleSessions')
    .where('status', '==', 'completed')
    .where('updatedAt', '<', cutoffDate)
    .limit(100) // Process in small batches
    .get();

  if (!oldSessions.empty) {
    const batch = db.batch();
    
    oldSessions.docs.forEach(doc => {
      // Move to archive collection instead of deleting
      const archiveRef = db.collection('archivedScheduleSessions').doc(doc.id);
      batch.set(archiveRef, doc.data());
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    logger.info(`Archived ${oldSessions.size} old completed sessions`);
  }
}

// ... (Helper functions continue in next message due to length)

export {
  scheduleOrchestrator,
  processScheduleStarts,
  processActiveScheduleSessions,
  processScheduleEnds
}; 