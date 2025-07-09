import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

part 'schedule_session.freezed.dart';
part 'schedule_session.g.dart';

@freezed
class Location with _$Location {
  const factory Location({
    required double latitude,
    required double longitude,
    required double accuracy,
  }) = _Location;

  factory Location.fromJson(Map<String, dynamic> json) => _$LocationFromJson(json);
}

@freezed
class DeviceInfo with _$DeviceInfo {
  const factory DeviceInfo({
    required String deviceId,
    required String deviceModel,
    required String osVersion,
    required String appVersion,
    required double batteryLevel,
  }) = _DeviceInfo;

  factory DeviceInfo.fromJson(Map<String, dynamic> json) => _$DeviceInfoFromJson(json);
}

@freezed
class BreakPeriod with _$BreakPeriod {
  const factory BreakPeriod({
    required String id,
    required DateTime startTime,
    DateTime? endTime,
    required String type, // 'manual' | 'auto' | 'required' | 'geofence_exit'
    Location? location,
    required String triggeredBy, // 'employee' | 'system' | 'admin' | 'schedule'
    int? duration, // minutes, calculated when endTime is set
  }) = _BreakPeriod;

  factory BreakPeriod.fromJson(Map<String, dynamic> json) => _$BreakPeriodFromJson(json);
}

@freezed
class AutoBreakSettings with _$AutoBreakSettings {
  const factory AutoBreakSettings({
    required bool enabled,
    required int requiredBreakDuration, // minutes
    required bool autoStartBreak,
    required bool autoEndBreak,
    required bool geofenceBasedBreaks,
    required bool scheduleBasedBreaks,
    required int minimumWorkBeforeBreak, // minutes
  }) = _AutoBreakSettings;

  factory AutoBreakSettings.fromJson(Map<String, dynamic> json) => _$AutoBreakSettingsFromJson(json);
}

@freezed
class OvertimeSettings with _$OvertimeSettings {
  const factory OvertimeSettings({
    required bool enabled,
    required int thresholdMinutes,
    required bool autoClockOutAtEnd,
    required bool allowOvertime,
    required bool notifyAdminAtOvertime,
    required bool notifyEmployeeAtOvertime,
    required double overtimeRate,
  }) = _OvertimeSettings;

  factory OvertimeSettings.fromJson(Map<String, dynamic> json) => _$OvertimeSettingsFromJson(json);
}

@freezed
class OvertimePeriod with _$OvertimePeriod {
  const factory OvertimePeriod({
    required String id,
    required DateTime startTime,
    DateTime? endTime,
    required int duration, // minutes
    required bool approved,
    String? approvedBy,
    DateTime? approvedAt,
    String? reason,
  }) = _OvertimePeriod;

  factory OvertimePeriod.fromJson(Map<String, dynamic> json) => _$OvertimePeriodFromJson(json);
}

@freezed
class EmployeeNotificationSettings with _$EmployeeNotificationSettings {
  const factory EmployeeNotificationSettings({
    required bool autoTrackingEnabled,
    required bool notifyOnSessionStart,
    required bool notifyOnAutoClockIn,
    required bool notifyOnAutoClockOut,
    required bool notifyOnBreakDetection,
    required bool notifyOnScheduleChange,
    required bool notifyOnOvertimeStart,
    required bool consentGiven,
    required DateTime consentDate,
    required String consentVersion,
  }) = _EmployeeNotificationSettings;

  factory EmployeeNotificationSettings.fromJson(Map<String, dynamic> json) => _$EmployeeNotificationSettingsFromJson(json);
}

@freezed
class CompanyPolicySettings with _$CompanyPolicySettings {
  const factory CompanyPolicySettings({
    required double geofenceAccuracy,
    required int minimumTimeAtSite,
    required bool allowClockInEarly,
    required bool allowClockOutEarly,
    required int clockInBuffer,
    required int clockOutBuffer,
    required double overtimeThreshold,
    required int requiredBreakDuration,
    required int requiredBreakInterval,
    required int geofenceExitGracePeriod,
    String? timeZone,
  }) = _CompanyPolicySettings;

  factory CompanyPolicySettings.fromJson(Map<String, dynamic> json) => _$CompanyPolicySettingsFromJson(json);
}

@freezed
class ScheduleChange with _$ScheduleChange {
  const factory ScheduleChange({
    required String id,
    required DateTime timestamp,
    required String changeType, // 'time_modified' | 'location_changed' | 'cancelled' | 'rescheduled'
    required String changeReason,
    required String changedBy,
    Map<String, dynamic>? oldValues,
    Map<String, dynamic>? newValues,
  }) = _ScheduleChange;

  factory ScheduleChange.fromJson(Map<String, dynamic> json) => _$ScheduleChangeFromJson(json);
}

@freezed
class EventMetadata with _$EventMetadata {
  const factory EventMetadata({
    String? scheduleId,
    DeviceInfo? deviceInfo,
    double? distanceFromJobSite,
    double? accuracy,
    String? source,
    Map<String, dynamic>? additionalData,
  }) = _EventMetadata;

  factory EventMetadata.fromJson(Map<String, dynamic> json) => _$EventMetadataFromJson(json);
}

@freezed
class ScheduleSessionEvent with _$ScheduleSessionEvent {
  const factory ScheduleSessionEvent({
    required String id,
    required DateTime timestamp,
    required String eventType,
    Location? location,
    required String triggeredBy,
    required String details,
    EventMetadata? metadata,
  }) = _ScheduleSessionEvent;

  factory ScheduleSessionEvent.fromJson(Map<String, dynamic> json) => _$ScheduleSessionEventFromJson(json);
}

@freezed
class AdminOverride with _$AdminOverride {
  const factory AdminOverride({
    required String id,
    required DateTime timestamp,
    required String adminId,
    required String adminName,
    required String action,
    required String reason,
    Map<String, dynamic>? originalState,
    Map<String, dynamic>? newState,
  }) = _AdminOverride;

  factory AdminOverride.fromJson(Map<String, dynamic> json) => _$AdminOverrideFromJson(json);
}

@freezed
class SessionError with _$SessionError {
  const factory SessionError({
    required String id,
    required DateTime timestamp,
    required String errorType,
    required String errorMessage,
    required String severity, // 'low' | 'medium' | 'high' | 'critical'
    String? stackTrace,
    Map<String, dynamic>? context,
    required bool resolved,
    String? resolvedBy,
    DateTime? resolvedAt,
    String? resolution,
  }) = _SessionError;

  factory SessionError.fromJson(Map<String, dynamic> json) => _$SessionErrorFromJson(json);
}

@freezed
class ScheduleSession with _$ScheduleSession {
  const factory ScheduleSession({
    required String id,
    required String scheduleId,
    required String employeeId,
    required String employeeName,
    required String jobSiteId,
    required String jobSiteName,
    required String companyId,
    
    // Schedule timing
    String? timeZone,
    required DateTime scheduledStartTime,
    required DateTime scheduledEndTime,
    DateTime? localScheduledStartTime,
    DateTime? localScheduledEndTime,
    
    // Session state
    required String status,
    DateTime? monitoringStarted,
    required bool employeePresent,
    DateTime? arrivalTime,
    DateTime? departureTime,
    DateTime? lastLocationUpdate,
    
    // Time tracking
    required bool clockedIn,
    DateTime? clockInTime,
    DateTime? clockOutTime,
    required bool autoClockInTriggered,
    required bool autoClockOutTriggered,
    
    // Break management
    required bool currentlyOnBreak,
    @Default([]) List<BreakPeriod> breakPeriods,
    required AutoBreakSettings autoBreakSettings,
    
    // Overtime
    required OvertimeSettings overtimeDetection,
    @Default([]) List<OvertimePeriod> overtimePeriods,
    required bool isInOvertime,
    
    // Company settings
    required CompanyPolicySettings companySettings,
    
    // Employee notifications
    required EmployeeNotificationSettings employeeNotifications,
    
    // Events and tracking
    @Default([]) List<ScheduleSessionEvent> events,
    @Default([]) List<AdminOverride> adminOverrides,
    
    // Error handling
    @Default([]) List<SessionError> errors,
    DateTime? lastHealthCheck,
    required String healthStatus,
    
    // Metrics
    required int totalScheduledTime, // minutes
    required int totalWorkedTime, // minutes
    required int totalBreakTime, // minutes
    required int totalOvertimeTime, // minutes
    required double punctualityScore,
    required double attendanceRate,
    required double complianceScore,
    
    // Audit
    required DateTime createdAt,
    required DateTime updatedAt,
    required String createdBy,
    required String lastModifiedBy,
  }) = _ScheduleSession;

  factory ScheduleSession.fromJson(Map<String, dynamic> json) => _$ScheduleSessionFromJson(json);

  // Factory method to create from Firestore document
  factory ScheduleSession.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ScheduleSession.fromJson({
      'id': doc.id,
      ...data,
    });
  }
}

// Extension methods for convenience
extension ScheduleSessionExtensions on ScheduleSession {
  
  // Status helpers
  bool get isActive => ['monitoring_active', 'clocked_in', 'on_break', 'overtime'].contains(status);
  bool get isCompleted => status == 'completed';
  bool get isLate => arrivalTime != null && arrivalTime!.isAfter(scheduledStartTime);
  bool get needsAttention => 
      healthStatus == 'error' || 
      status == 'no_show' || 
      isInOvertime || 
      errors.any((e) => !e.resolved);
  
  // Duration calculations
  Duration get currentWorkDuration {
    if (clockInTime == null) return Duration.zero;
    final endTime = clockOutTime ?? DateTime.now();
    final workMs = endTime.millisecondsSinceEpoch - clockInTime!.millisecondsSinceEpoch;
    final breakMs = totalBreakTime * 60000; // Convert minutes to milliseconds
    return Duration(milliseconds: workMs - breakMs);
  }
  
  // Status text helpers
  String get statusText {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'monitoring_active': return 'Monitoring';
      case 'clocked_in': return 'Working';
      case 'on_break': return 'On Break';
      case 'clocked_out': return 'Clocked Out';
      case 'completed': return 'Completed';
      case 'no_show': return 'No Show';
      case 'overtime': return 'Overtime';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  }
  
  String get statusColor {
    switch (status) {
      case 'scheduled': return 'blue';
      case 'monitoring_active': return 'amber';
      case 'clocked_in': return 'green';
      case 'on_break': return 'orange';
      case 'completed': return 'gray';
      case 'no_show': return 'red';
      case 'overtime': return 'purple';
      case 'error': return 'red';
      default: return 'gray';
    }
  }
}

@freezed
class ScheduleSessionQuery with _$ScheduleSessionQuery {
  const factory ScheduleSessionQuery({
    String? employeeId,
    String? jobSiteId,
    String? companyId,
    String? status,
    DateTime? startDate,
    DateTime? endDate,
    int? limit,
    String? orderBy,
    bool? descending,
  }) = _ScheduleSessionQuery;

  factory ScheduleSessionQuery.fromJson(Map<String, dynamic> json) => _$ScheduleSessionQueryFromJson(json);
}

@freezed
class ScheduleSessionSummary with _$ScheduleSessionSummary {
  const factory ScheduleSessionSummary({
    required String sessionId,
    required String employeeName,
    required String jobSiteName,
    required DateTime scheduledStart,
    required DateTime scheduledEnd,
    required String status,
    required int totalMinutes,
    required double complianceScore,
  }) = _ScheduleSessionSummary;

  factory ScheduleSessionSummary.fromJson(Map<String, dynamic> json) => _$ScheduleSessionSummaryFromJson(json);
}

@freezed
class SessionUpdate with _$SessionUpdate {
  const factory SessionUpdate({
    required String sessionId,
    required String field,
    dynamic oldValue,
    dynamic newValue,
    required DateTime timestamp,
    required String updatedBy,
  }) = _SessionUpdate;

  factory SessionUpdate.fromJson(Map<String, dynamic> json) => _$SessionUpdateFromJson(json);
} 