import type { Schedule, ScheduleConflict, User } from '@shared/types';
import { 
  isSameDay, 
  differenceInMinutes, 
  addMinutes,
  startOfDay,
  format,
} from 'date-fns';

// Helper functions to safely get dates from schedule fields
function getScheduleStartDate(schedule: Schedule): Date {
  return schedule.startDateTime || schedule.startTime?.toDate() || new Date();
}

function getScheduleEndDate(schedule: Schedule): Date {
  return schedule.endDateTime || schedule.endTime?.toDate() || new Date();
}

// Conflict detection types
export type ConflictType = 'overlap' | 'double-booking' | 'insufficient-rest' | 'overtime-limit' | 'availability';
export type ConflictSeverity = 'warning' | 'error';

// Configuration for conflict detection rules
export interface ConflictDetectionConfig {
  maxDailyHours: number;
  minBreakMinutes: number;
  maxWeeklyHours: number;
  requiredSkillsChecking: boolean;
  travelTimeBuffer: number;
}

export interface ValidationRule {
  type: 'time_overlap' | 'max_hours' | 'minimum_break' | 'skill_mismatch' | 'travel_time' | 'availability';
  severity: 'warning' | 'error';
  parameters: Record<string, any>;
}

// Default configuration
const DEFAULT_CONFIG: ConflictDetectionConfig = {
  maxDailyHours: 8,
  minBreakMinutes: 480, // 8 hours
  maxWeeklyHours: 40,
  requiredSkillsChecking: false,
  travelTimeBuffer: 30, // 30 minutes between shifts
};

// Detect conflicts in a schedule
export function detectScheduleConflicts(
  schedules: Schedule[],
  employees: User[],
  config: Partial<ConflictDetectionConfig> = {}
): ScheduleConflict[] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const conflicts: ScheduleConflict[] = [];

  // Group schedules by employee
  const employeeSchedules = groupSchedulesByEmployee(schedules);

  for (const [employeeId, employeeScheduleList] of employeeSchedules.entries()) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) continue;

    // Sort schedules by start time
    const sortedSchedules = [...employeeScheduleList].sort((a, b) => {
      return getScheduleStartDate(a).getTime() - getScheduleStartDate(b).getTime();
    });

    // Check for conflicts within this employee's schedules
    const employeeConflicts = detectEmployeeConflicts(
      sortedSchedules,
      employee,
      fullConfig
    );

    conflicts.push(...employeeConflicts);
  }

  return conflicts;
}

// Group schedules by employee ID
function groupSchedulesByEmployee(schedules: Schedule[]): Map<string, Schedule[]> {
  const grouped = new Map<string, Schedule[]>();

  for (const schedule of schedules) {
    const existing = grouped.get(schedule.employeeId) || [];
    existing.push(schedule);
    grouped.set(schedule.employeeId, existing);
  }

  return grouped;
}

// Detect conflicts for a specific employee
function detectEmployeeConflicts(
  schedules: Schedule[],
  employee: User,
  config: ConflictDetectionConfig
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < schedules.length; i++) {
    const currentSchedule = schedules[i];

    // Check overlap conflicts with other schedules
    for (let j = i + 1; j < schedules.length; j++) {
      const nextSchedule = schedules[j];
      const overlapConflict = checkOverlapConflict(
        currentSchedule,
        nextSchedule,
        employee,
        config
      );
      if (overlapConflict) {
        conflicts.push(overlapConflict);
      }
    }

    // Check insufficient rest conflicts
    if (i > 0) {
      const previousSchedule = schedules[i - 1];
      const restConflict = checkInsufficientRestConflict(
        previousSchedule,
        currentSchedule,
        employee,
        config
      );
      if (restConflict) {
        conflicts.push(restConflict);
      }
    }

    // Check daily overtime conflicts
    const overtimeConflict = checkDailyOvertimeConflict(
      currentSchedule,
      schedules,
      employee,
      config
    );
    if (overtimeConflict) {
      conflicts.push(overtimeConflict);
    }

    // Check availability conflicts
    const availabilityConflict = checkAvailabilityConflict(
      currentSchedule,
      employee
    );
    if (availabilityConflict) {
      conflicts.push(availabilityConflict);
    }
  }

  // Check weekly overtime conflicts
  const weeklyOvertimeConflicts = checkWeeklyOvertimeConflicts(
    schedules,
    employee,
    config
  );
  conflicts.push(...weeklyOvertimeConflicts);

  return conflicts;
}

// Check for overlapping schedules
function checkOverlapConflict(
  schedule1: Schedule,
  schedule2: Schedule,
  employee: User,
  config: ConflictDetectionConfig
): ScheduleConflict | null {
  if (config.requiredSkillsChecking) return null;

  const overlap = getScheduleOverlap(schedule1, schedule2);
  if (overlap) {
    const isDoubleBooking = schedule1.jobSiteId !== schedule2.jobSiteId;
    
    if (isDoubleBooking && !config.requiredSkillsChecking) {
      return createConflict(
        'double-booking',
        'error',
        employee,
        [schedule1.scheduleId, schedule2.scheduleId],
        `Employee is double-booked: ${schedule1.jobSiteName} and ${schedule2.jobSiteName}`,
        [
          'Reschedule one of the shifts',
          'Assign different employee',
          'Adjust shift times to avoid overlap'
        ]
      );
    } else {
      return createConflict(
        'overlap',
        'warning',
        employee,
        [schedule1.scheduleId, schedule2.scheduleId],
        `Overlapping shifts: ${format(overlap.start, 'HH:mm')} - ${format(overlap.end, 'HH:mm')}`,
        [
          'Adjust shift times',
          'Add buffer time between shifts',
          'Review job site requirements'
        ]
      );
    }
  }

  return null;
}

// Check for insufficient rest between shifts
function checkInsufficientRestConflict(
  previousSchedule: Schedule,
  currentSchedule: Schedule,
  employee: User,
  config: ConflictDetectionConfig
): ScheduleConflict | null {
  const restTime = differenceInMinutes(
    getScheduleStartDate(currentSchedule),
    getScheduleEndDate(previousSchedule)
  );

  if (restTime < config.minBreakMinutes) {
    const restHours = Math.floor(restTime / 60);
    const restMinutes = restTime % 60;
    const requiredHours = Math.floor(config.minBreakMinutes / 60);

    return createConflict(
      'insufficient-rest',
      'warning',
      employee,
      [previousSchedule.scheduleId, currentSchedule.scheduleId],
      `Insufficient rest period: ${restHours}h ${restMinutes}m (minimum ${requiredHours}h required)`,
      [
        'Increase gap between shifts',
        'Schedule shifts on different days',
        'Review labor regulations'
      ]
    );
  }

  return null;
}

// Check for daily overtime violations
function checkDailyOvertimeConflict(
  schedule: Schedule,
  allSchedules: Schedule[],
  employee: User,
  config: ConflictDetectionConfig
): ScheduleConflict | null {
  const scheduleDay = startOfDay(getScheduleStartDate(schedule));
  const daySchedules = allSchedules.filter(s => 
    isSameDay(getScheduleStartDate(s), scheduleDay)
  );

  const totalMinutes = daySchedules.reduce((total, s) => {
    return total + differenceInMinutes(getScheduleEndDate(s), getScheduleStartDate(s));
  }, 0);

  const maxDailyMinutes = config.maxDailyHours * 60;
  
  if (totalMinutes > maxDailyMinutes) {
    const totalHours = Math.floor(totalMinutes / 60);
    const overtimeHours = Math.floor((totalMinutes - maxDailyMinutes) / 60);

    return createConflict(
      'overtime-limit',
      'warning',
      employee,
      daySchedules.map(s => s.scheduleId),
      `Daily overtime: ${totalHours}h scheduled (${overtimeHours}h overtime)`,
      [
        'Reduce shift duration',
        'Spread work across multiple days',
        'Assign additional employees'
      ]
    );
  }

  return null;
}

// Check for availability conflicts (employee working hours, time off, etc.)
function checkAvailabilityConflict(
  _schedule: Schedule,
  _employee: User
): ScheduleConflict | null {
  // This would check against employee availability, time-off requests, etc.
  // For now, we'll return null as this requires additional data structures
  return null;
}

// Check for weekly overtime violations
function checkWeeklyOvertimeConflicts(
  schedules: Schedule[],
  employee: User,
  config: ConflictDetectionConfig
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  
  // Group schedules by week
  const weeklySchedules = groupSchedulesByWeek(schedules);

  for (const [weekKey, weekSchedules] of weeklySchedules.entries()) {
    const totalMinutes = weekSchedules.reduce((total, s) => {
      return total + differenceInMinutes(getScheduleEndDate(s), getScheduleStartDate(s));
    }, 0);

    const maxWeeklyMinutes = config.maxWeeklyHours * 60;
    
    if (totalMinutes > maxWeeklyMinutes) {
      const totalHours = Math.floor(totalMinutes / 60);
      const overtimeHours = Math.floor((totalMinutes - maxWeeklyMinutes) / 60);

      conflicts.push(createConflict(
        'overtime-limit',
        'warning',
        employee,
        weekSchedules.map(s => s.scheduleId),
        `Weekly overtime: ${totalHours}h scheduled (${overtimeHours}h overtime) for week ${weekKey}`,
        [
          'Redistribute hours across the week',
          'Assign overtime to different employees',
          'Review weekly scheduling limits'
        ]
      ));
    }
  }

  return conflicts;
}

// Group schedules by week
function groupSchedulesByWeek(schedules: Schedule[]): Map<string, Schedule[]> {
  const grouped = new Map<string, Schedule[]>();

  for (const schedule of schedules) {
    const weekKey = format(getScheduleStartDate(schedule), 'yyyy-ww');
    const existing = grouped.get(weekKey) || [];
    existing.push(schedule);
    grouped.set(weekKey, existing);
  }

  return grouped;
}

// Get overlap between two schedules
function getScheduleOverlap(schedule1: Schedule, schedule2: Schedule): { start: Date; end: Date } | null {
  const start1 = getScheduleStartDate(schedule1);
  const end1 = getScheduleEndDate(schedule1);
  const start2 = getScheduleStartDate(schedule2);
  const end2 = getScheduleEndDate(schedule2);

  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

  if (overlapStart < overlapEnd) {
    return { start: overlapStart, end: overlapEnd };
  }

  return null;
}

// Create a conflict object
function createConflict(
  type: ConflictType,
  severity: ConflictSeverity,
  employee: User,
  scheduleIds: string[],
  message: string,
  suggestions: string[]
): ScheduleConflict {
  return {
    conflictId: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    employeeId: employee.id,
    employeeName: `${employee.profile.firstName} ${employee.profile.lastName}`,
    conflictingSchedules: scheduleIds,
    severity,
    message,
    suggestions,
  };
}

// Validate a single schedule
export function validateSchedule(
  schedule: Schedule,
  allSchedules: Schedule[],
  employees: User[],
  config: Partial<ConflictDetectionConfig> = {}
): ScheduleConflict[] {
  const employee = employees.find(e => e.id === schedule.employeeId);
  if (!employee) return [];

  const employeeSchedules = allSchedules.filter(s => s.employeeId === schedule.employeeId);
  return detectEmployeeConflicts([...employeeSchedules, schedule], employee, { ...DEFAULT_CONFIG, ...config });
}

// Check if a schedule can be moved to a new time slot
export function canMoveSchedule(
  schedule: Schedule,
  newStartTime: Date,
  newEndTime: Date,
  allSchedules: Schedule[],
  employees: User[],
  config: Partial<ConflictDetectionConfig> = {}
): { canMove: boolean; conflicts: ScheduleConflict[] } {
  const modifiedSchedule: Schedule = {
    ...schedule,
    startDateTime: newStartTime,
    endDateTime: newEndTime,
  };

  const otherSchedules = allSchedules.filter(s => s.scheduleId !== schedule.scheduleId);
  const conflicts = validateSchedule(modifiedSchedule, otherSchedules, employees, config);

  return {
    canMove: conflicts.length === 0,
    conflicts,
  };
}

// Get schedule statistics for an employee
export function getEmployeeScheduleStats(
  employeeId: string,
  schedules: Schedule[],
  dateRange: { start: Date; end: Date }
): {
  totalHours: number;
  totalShifts: number;
  averageShiftLength: number;
  overtimeHours: number;
  regularHours: number;
  daysWorked: number;
  conflicts: number;
} {
  const employeeSchedules = schedules.filter(
    s => s.employeeId === employeeId &&
    getScheduleStartDate(s) >= dateRange.start &&
    getScheduleStartDate(s) <= dateRange.end
  );

  const totalMinutes = employeeSchedules.reduce((total, s) => {
    return total + differenceInMinutes(getScheduleEndDate(s), getScheduleStartDate(s));
  }, 0);

  const totalHours = totalMinutes / 60;
  const totalShifts = employeeSchedules.length;
  const averageShiftLength = totalShifts > 0 ? totalHours / totalShifts : 0;

  // Calculate overtime (assuming 8 hours per day is regular)
  const dailySchedules = groupSchedulesByDay(employeeSchedules);
  let overtimeMinutes = 0;
  let regularMinutes = 0;

  for (const daySchedules of dailySchedules.values()) {
    const dayMinutes = daySchedules.reduce((total, s) => {
      return total + differenceInMinutes(getScheduleEndDate(s), getScheduleStartDate(s));
    }, 0);

    if (dayMinutes > 480) { // 8 hours
      overtimeMinutes += dayMinutes - 480;
      regularMinutes += 480;
    } else {
      regularMinutes += dayMinutes;
    }
  }

  const daysWorked = dailySchedules.size;

  return {
    totalHours,
    totalShifts,
    averageShiftLength,
    overtimeHours: overtimeMinutes / 60,
    regularHours: regularMinutes / 60,
    daysWorked,
    conflicts: 0, // Would need to run conflict detection
  };
}

// Group schedules by day
function groupSchedulesByDay(schedules: Schedule[]): Map<string, Schedule[]> {
  const grouped = new Map<string, Schedule[]>();

  for (const schedule of schedules) {
    const dayKey = format(getScheduleStartDate(schedule), 'yyyy-MM-dd');
    const existing = grouped.get(dayKey) || [];
    existing.push(schedule);
    grouped.set(dayKey, existing);
  }

  return grouped;
}

// Find the best time slot for a new schedule
export function findBestTimeSlot(
  employeeId: string,
  duration: number, // in minutes
  _jobSiteId: string,
  preferredDate: Date,
  allSchedules: Schedule[],
  _employees: User[],
  config: Partial<ConflictDetectionConfig> = {}
): { startTime: Date; endTime: Date } | null {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const employeeSchedules = allSchedules.filter(s => s.employeeId === employeeId);
  
  // Sort existing schedules for the day
  const daySchedules = employeeSchedules
    .filter(s => isSameDay(getScheduleStartDate(s), preferredDate))
    .sort((a, b) => getScheduleStartDate(a).getTime() - getScheduleStartDate(b).getTime());

  // Try to find a slot starting from 8 AM
  let currentTime = new Date(preferredDate);
  currentTime.setHours(8, 0, 0, 0);

  const endOfDay = new Date(preferredDate);
  endOfDay.setHours(18, 0, 0, 0); // 6 PM

  while (currentTime.getTime() + duration * 60 * 1000 <= endOfDay.getTime()) {
    const proposedEnd = addMinutes(currentTime, duration);
    
    // Check if this slot conflicts with existing schedules
    const hasConflict = daySchedules.some(schedule => {
      const scheduleStart = getScheduleStartDate(schedule);
      const scheduleEnd = getScheduleEndDate(schedule);
      
      return (currentTime < scheduleEnd && proposedEnd > scheduleStart);
    });

    if (!hasConflict) {
      // Add buffer time if configured
      const bufferedStart = addMinutes(currentTime, fullConfig.travelTimeBuffer);
      const bufferedEnd = addMinutes(bufferedStart, duration);
      
      return {
        startTime: bufferedStart,
        endTime: bufferedEnd,
      };
    }

    // Move to next 30-minute slot
    currentTime = addMinutes(currentTime, 30);
  }

  return null; // No available slot found
}

export default {
  detectScheduleConflicts,
  validateSchedule,
  canMoveSchedule,
  getEmployeeScheduleStats,
  findBestTimeSlot,
}; 