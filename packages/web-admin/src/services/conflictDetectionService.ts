import type { Schedule, ScheduleConflict } from '@shared/types';
import type { ValidationRule } from '../components/schedule/utils/conflictDetection';

// Helper functions to safely get dates from schedule fields
function getScheduleStartDate(schedule: Schedule): Date {
  return schedule.startDateTime || schedule.startTime?.toDate() || new Date();
}

function getScheduleEndDate(schedule: Schedule): Date {
  return schedule.endDateTime || schedule.endTime?.toDate() || new Date();
}

export class ConflictDetectionService {
  private static instance: ConflictDetectionService;
  private rules: ValidationRule[] = [];

  private constructor() {
    this.initializeDefaultRules();
  }

  static getInstance(): ConflictDetectionService {
    if (!ConflictDetectionService.instance) {
      ConflictDetectionService.instance = new ConflictDetectionService();
    }
    return ConflictDetectionService.instance;
  }

  private initializeDefaultRules() {
    this.rules = [
      {
        type: 'time_overlap',
        severity: 'error',
        parameters: { allowGracePeriod: false, gracePeriodMinutes: 0 }
      },
      {
        type: 'max_hours',
        severity: 'warning',
        parameters: { dailyLimit: 8, weeklyLimit: 40 }
      },
      {
        type: 'minimum_break',
        severity: 'warning',
        parameters: { minimumMinutes: 480 } // 8 hours
      },
      {
        type: 'skill_mismatch',
        severity: 'error',
        parameters: { enforceStrict: true }
      },
      {
        type: 'travel_time',
        severity: 'warning',
        parameters: { bufferMinutes: 30 }
      }
    ];
  }

  async detectConflicts(
    schedule: Schedule,
    existingSchedules: Schedule[]
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    try {
      // Process each validation rule
      for (const rule of this.rules) {
        let ruleConflicts: ScheduleConflict[] = [];

        switch (rule.type) {
          case 'time_overlap':
            ruleConflicts = await this.checkTimeOverlap(schedule, existingSchedules, rule);
            break;
          case 'max_hours':
            ruleConflicts = await this.checkMaxHours(schedule, existingSchedules, rule);
            break;
          case 'minimum_break':
            ruleConflicts = await this.checkMinimumBreak(schedule, existingSchedules, rule);
            break;
          case 'skill_mismatch':
            ruleConflicts = await this.checkSkillMatch(schedule);
            break;
          case 'travel_time':
            ruleConflicts = await this.checkTravelTime(schedule, existingSchedules);
            break;
        }

        conflicts.push(...ruleConflicts);
      }

      return conflicts;
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return [{
        conflictId: `error_${Date.now()}`,
        type: 'overlap',
        severity: 'error',
        conflictingSchedules: [schedule.scheduleId],
        employeeId: schedule.employeeId,
        employeeName: schedule.employeeName,
        message: 'Error occurred during conflict detection',
        suggestions: ['Please try again or contact support']
      }];
    }
  }

  private async checkTimeOverlap(
    schedule: Schedule,
    existingSchedules: Schedule[],
    rule: ValidationRule
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    for (const existing of existingSchedules) {
      if (existing.scheduleId === schedule.scheduleId) continue;
      if (existing.employeeId !== schedule.employeeId) continue;

      const hasOverlap = this.schedulesOverlap(schedule, existing);
      if (hasOverlap) {
        conflicts.push({
          conflictId: `overlap_${schedule.scheduleId}_${existing.scheduleId}`,
          type: 'overlap',
          severity: rule.severity,
          conflictingSchedules: [schedule.scheduleId, existing.scheduleId],
          employeeId: schedule.employeeId,
          employeeName: schedule.employeeName,
          message: `Schedule overlaps with existing shift at ${existing.jobSiteName}`,
          suggestions: [
            'Adjust start or end time',
            'Reschedule to different time slot',
            'Assign to different employee'
          ]
        });
      }
    }

    return conflicts;
  }

  private async checkMaxHours(
    schedule: Schedule,
    existingSchedules: Schedule[],
    rule: ValidationRule
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];
    const dailyLimit = rule.parameters.dailyLimit * 60; // Convert to minutes

    // Get same-day schedules for the employee
    const sameDay = existingSchedules.filter(s => 
      s.employeeId === schedule.employeeId &&
      this.isSameDay(getScheduleStartDate(s), getScheduleStartDate(schedule))
    );

    const totalMinutes = sameDay.reduce((total, s) => {
      return total + this.getScheduleDurationMinutes(s);
    }, this.getScheduleDurationMinutes(schedule));

    if (totalMinutes > dailyLimit) {
      conflicts.push({
        conflictId: `max_hours_${schedule.scheduleId}`,
        type: 'overtime-limit',
        severity: rule.severity,
        conflictingSchedules: [schedule.scheduleId],
        employeeId: schedule.employeeId,
        employeeName: schedule.employeeName,
        message: `Daily hours exceeded: ${Math.round(totalMinutes / 60)}h (limit: ${rule.parameters.dailyLimit}h)`,
        suggestions: [
          'Reduce shift duration',
          'Move to different day',
          'Split into multiple shifts'
        ]
      });
    }

    return conflicts;
  }

  private async checkMinimumBreak(
    schedule: Schedule,
    existingSchedules: Schedule[],
    rule: ValidationRule
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];
    const minimumBreak = rule.parameters.minimumMinutes;

    const employeeSchedules = existingSchedules
      .filter(s => s.employeeId === schedule.employeeId)
      .sort((a, b) => getScheduleStartDate(a).getTime() - getScheduleStartDate(b).getTime());

    // Check breaks before and after the new schedule
    for (const existing of employeeSchedules) {
      const breakTime = this.getBreakTime(existing, schedule);
      if (breakTime !== null && breakTime < minimumBreak) {
        conflicts.push({
          conflictId: `break_${schedule.scheduleId}_${existing.scheduleId}`,
          type: 'insufficient-rest',
          severity: rule.severity,
          conflictingSchedules: [schedule.scheduleId, existing.scheduleId],
          employeeId: schedule.employeeId,
          employeeName: schedule.employeeName,
          message: `Insufficient break time: ${Math.round(breakTime / 60)}h (minimum: ${Math.round(minimumBreak / 60)}h)`,
          suggestions: [
            'Increase gap between shifts',
            'Reschedule one of the shifts',
            'Allow extended break period'
          ]
        });
      }
    }

    return conflicts;
  }

  private async checkSkillMatch(
    _schedule: Schedule
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    // TODO: Implement skill matching logic
    // This would require fetching employee skills and job site requirements
    
    return conflicts;
  }

  private async checkTravelTime(
    _schedule: Schedule,
    _existingSchedules: Schedule[]
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    // TODO: Implement travel time checking logic
    // This would require calculating distances between job sites
    
    return conflicts;
  }

  private schedulesOverlap(schedule1: Schedule, schedule2: Schedule): boolean {
    return getScheduleStartDate(schedule1) < getScheduleEndDate(schedule2) && 
           getScheduleEndDate(schedule1) > getScheduleStartDate(schedule2);
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  private getScheduleDurationMinutes(schedule: Schedule): number {
    return (getScheduleEndDate(schedule).getTime() - getScheduleStartDate(schedule).getTime()) / (1000 * 60);
  }

  private getBreakTime(schedule1: Schedule, schedule2: Schedule): number | null {
    // Calculate break time between two schedules
    const earlierEnd = getScheduleEndDate(schedule1) < getScheduleStartDate(schedule2) ? 
      getScheduleEndDate(schedule1) : getScheduleEndDate(schedule2);
    const laterStart = getScheduleStartDate(schedule1) > getScheduleEndDate(schedule2) ? 
      getScheduleStartDate(schedule1) : getScheduleStartDate(schedule2);
    
    if (earlierEnd >= laterStart) {
      return null; // Schedules overlap
    }
    
    return (laterStart.getTime() - earlierEnd.getTime()) / (1000 * 60); // minutes
  }

  async loadCompanyRules(): Promise<void> {
    // TODO: Load company-specific rules from Firestore
    // Implementation pending
  }

  async updateRule(ruleType: string, parameters: Record<string, any>): Promise<void> {
    const ruleIndex = this.rules.findIndex(rule => rule.type === ruleType);
    if (ruleIndex !== -1) {
      this.rules[ruleIndex].parameters = { ...this.rules[ruleIndex].parameters, ...parameters };
    }
  }

  getRules(): ValidationRule[] {
    return [...this.rules];
  }
} 