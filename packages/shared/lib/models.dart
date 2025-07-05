// Dart models that mirror the TypeScript interfaces
// These should be kept in sync with packages/shared/types/index.ts

import 'package:freezed_annotation/freezed_annotation.dart';

part 'models.freezed.dart';
part 'models.g.dart';

@freezed
class UserProfile with _$UserProfile {
  const factory UserProfile({
    required String firstName,
    required String lastName,
    String? phoneNumber,
    String? avatar,
    String? department,
    String? jobTitle,
    DateTime? startDate,
    double? hourlyWage,
  }) = _UserProfile;

  factory UserProfile.fromJson(Map<String, dynamic> json) => _$UserProfileFromJson(json);
}

@freezed
class NumberFormat with _$NumberFormat {
  const factory NumberFormat({
    required String decimalSeparator, // '.' | ','
    required String thousandsSeparator, // ',' | '.' | ' '
  }) = _NumberFormat;

  factory NumberFormat.fromJson(Map<String, dynamic> json) => _$NumberFormatFromJson(json);
}

@freezed
class UserLocale with _$UserLocale {
  const factory UserLocale({
    required String id,
    required String userId,
    required String language, // 'en', 'el', 'ru' (English, Greek, Russian)
    required String country, // 'GB', 'GR', 'RU', 'CY', 'US', etc.
    required String timezone, // 'Europe/London', 'Europe/Athens', 'Europe/Moscow'
    required String currency, // 'EUR', 'GBP', 'RUB', 'USD'
    required String dateFormat, // 'dd/MM/yyyy' (EU), 'MM/dd/yyyy' (US)
    required String timeFormat, // '12h' | '24h'
    required String firstDayOfWeek, // 'monday' | 'sunday'
    required NumberFormat numberFormat,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _UserLocale;

  factory UserLocale.fromJson(Map<String, dynamic> json) => _$UserLocaleFromJson(json);
}

@freezed
class User with _$User {
  const factory User({
    required String id, // Standardized from uid
    required String email,
    required UserProfile profile,
    required String role, // 'superadmin' | 'company_admin' | 'manager' | 'employee'
    String? companyId, // null for superadmin
    UserLocale? locale,
    required bool isActive,
    DateTime? lastLoginAt,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

@freezed
class Company with _$Company {
  const factory Company({
    required String companyId,
    required String companyName,
    required String ownerUid,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Company;

  factory Company.fromJson(Map<String, dynamic> json) => _$CompanyFromJson(json);
}

@freezed
class Location with _$Location {
  const factory Location({
    required double latitude,
    required double longitude,
    double? accuracy,
  }) = _Location;

  factory Location.fromJson(Map<String, dynamic> json) => _$LocationFromJson(json);
}

@freezed
class JobSite with _$JobSite {
  const factory JobSite({
    required String siteId,
    required String companyId,
    required String siteName,
    required String address,
    required Location location,
    required int radius, // in meters
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _JobSite;

  factory JobSite.fromJson(Map<String, dynamic> json) => _$JobSiteFromJson(json);
}

@freezed
class DeviceInfo with _$DeviceInfo {
  const factory DeviceInfo({
    required String platform,
    required String appVersion,
    required String deviceId,
  }) = _DeviceInfo;

  factory DeviceInfo.fromJson(Map<String, dynamic> json) => _$DeviceInfoFromJson(json);
}

// New TimeEvent model (replaces legacy TimeEntry for new time tracking)
@freezed
class TimeEvent with _$TimeEvent {
  const factory TimeEvent({
    required String id,
    required String userId,
    required String companyId,
    required String jobSiteId,
    required String type, // 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
    required DateTime timestamp,
    required Location location,
    required String method, // 'geofence' | 'manual' | 'admin'
    String? sessionId, // groups related events
    DeviceInfo? deviceInfo,
    required DateTime createdAt,
  }) = _TimeEvent;

  factory TimeEvent.fromJson(Map<String, dynamic> json) => _$TimeEventFromJson(json);
}

@freezed
class WorkSession with _$WorkSession {
  const factory WorkSession({
    required String id,
    required String userId,
    required String companyId,
    required String jobSiteId,
    required List<TimeEvent> events,
    required DateTime startTime,
    DateTime? endTime,
    int? totalMinutes,
    int? breakMinutes,
    required String status, // 'active' | 'completed' | 'disputed'
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _WorkSession;

  factory WorkSession.fromJson(Map<String, dynamic> json) => _$WorkSessionFromJson(json);
}

// Legacy TimeEntry interface - DEPRECATED, use TimeEvent instead
@freezed
class TimeEntry with _$TimeEntry {
  const factory TimeEntry({
    required String entryId,
    required String userId,
    required String siteId,
    required String companyId,
    required String eventType, // 'enter' | 'exit'
    required DateTime timestamp,
    required String method, // 'automatic' | 'manual'
    DeviceInfo? deviceInfo,
    required DateTime createdAt,
  }) = _TimeEntry;

  factory TimeEntry.fromJson(Map<String, dynamic> json) => _$TimeEntryFromJson(json);
}

@freezed
class CompletedShift with _$CompletedShift {
  const factory CompletedShift({
    required String id,
    required String userId, // Fixed: changed from employeeId to userId
    required String companyId,
    required String jobSiteId,
    required String workSessionId, // References the WorkSession
    required DateTime startTime,
    required DateTime endTime,
    required double totalHours,
    required double regularHours,
    required double overtimeHours,
    double? breakTime,
    required bool approved,
    String? approvedBy,
    String? notes,
    Map<String, dynamic>? customFields, // Support for custom company fields
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _CompletedShift;

  factory CompletedShift.fromJson(Map<String, dynamic> json) =>
      _$CompletedShiftFromJson(json);
}

// Schedule Management Models
@freezed
class ScheduleRecurrence with _$ScheduleRecurrence {
  const factory ScheduleRecurrence({
    required String type, // 'daily' | 'weekly' | 'monthly'
    required int interval, // every N days/weeks/months
    List<int>? daysOfWeek, // 0-6 (Sunday-Saturday)
    DateTime? endDate,
    int? maxOccurrences,
  }) = _ScheduleRecurrence;

  factory ScheduleRecurrence.fromJson(Map<String, dynamic> json) => _$ScheduleRecurrenceFromJson(json);
}

@freezed
class ScheduleMetadata with _$ScheduleMetadata {
  const factory ScheduleMetadata({
    String? color, // for calendar display
    String? priority, // 'low' | 'medium' | 'high' | 'urgent'
    String? department,
    String? costCenter,
    String? projectCode,
  }) = _ScheduleMetadata;

  factory ScheduleMetadata.fromJson(Map<String, dynamic> json) => _$ScheduleMetadataFromJson(json);
}

@freezed
class Schedule with _$Schedule {
  const factory Schedule({
    required String scheduleId,
    required String companyId,
    required String employeeId,
    required String employeeName,
    required String jobSiteId,
    required String jobSiteName,
    required DateTime startDateTime,
    required DateTime endDateTime,
    required String shiftType, // 'regular' | 'overtime' | 'emergency' | 'training'
    required String status, // 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
    String? notes,
    required String createdBy,
    required DateTime createdAt,
    required DateTime updatedAt,
    
    // Recurring schedule options
    required bool isRecurring,
    ScheduleRecurrence? recurrence,
    
    // Shift details
    required int breakDuration, // minutes
    required double expectedHours,
    double? minimumHours,
    double? maximumHours,
    
    // Requirements and preferences
    List<String>? skillsRequired,
    List<String>? equipmentNeeded,
    String? specialInstructions,
    
    // Approval workflow
    required bool requiresApproval,
    String? approvedBy,
    DateTime? approvedAt,
    
    // Metadata
    ScheduleMetadata? metadata,
  }) = _Schedule;

  factory Schedule.fromJson(Map<String, dynamic> json) => _$ScheduleFromJson(json);
}

@freezed
class ScheduleTemplateRecurrence with _$ScheduleTemplateRecurrence {
  const factory ScheduleTemplateRecurrence({
    required String type, // 'daily' | 'weekly' | 'monthly'
    required int interval,
    List<int>? daysOfWeek,
  }) = _ScheduleTemplateRecurrence;

  factory ScheduleTemplateRecurrence.fromJson(Map<String, dynamic> json) => _$ScheduleTemplateRecurrenceFromJson(json);
}

@freezed
class ScheduleTemplate with _$ScheduleTemplate {
  const factory ScheduleTemplate({
    required String templateId,
    required String companyId,
    required String templateName,
    String? description,
    
    // Template configuration
    String? jobSiteId, // if specific to a job site
    required String shiftType, // 'regular' | 'overtime' | 'emergency' | 'training'
    required double duration, // hours
    required int breakDuration, // minutes
    
    // Default timing
    required String defaultStartTime, // HH:MM format
    required String defaultEndTime, // HH:MM format
    
    // Recurrence settings
    required ScheduleTemplateRecurrence recurrence,
    
    // Requirements
    List<String>? skillsRequired,
    List<String>? equipmentNeeded,
    String? specialInstructions,
    
    // Metadata
    required bool isActive,
    required String createdBy,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _ScheduleTemplate;

  factory ScheduleTemplate.fromJson(Map<String, dynamic> json) => _$ScheduleTemplateFromJson(json);
}

@freezed
class ScheduleConflict with _$ScheduleConflict {
  const factory ScheduleConflict({
    required String conflictId,
    required String type, // 'overlap' | 'double-booking' | 'insufficient-rest' | 'overtime-limit' | 'availability'
    required String employeeId,
    required String employeeName,
    required List<String> conflictingSchedules, // schedule IDs
    required String severity, // 'warning' | 'error'
    required String message,
    List<String>? suggestions,
  }) = _ScheduleConflict;

  factory ScheduleConflict.fromJson(Map<String, dynamic> json) => _$ScheduleConflictFromJson(json);
}

// User Assignment and Business Rules
@freezed
class UserAssignmentPermissions with _$UserAssignmentPermissions {
  const factory UserAssignmentPermissions({
    required bool canEditTimeEntries,
    required bool canViewReports,
    required bool canManageOtherUsers,
  }) = _UserAssignmentPermissions;

  factory UserAssignmentPermissions.fromJson(Map<String, dynamic> json) => _$UserAssignmentPermissionsFromJson(json);
}

@freezed
class UserAssignment with _$UserAssignment {
  const factory UserAssignment({
    required String id,
    required String userId,
    required String companyId,
    required String jobSiteId,
    String? role,
    required DateTime startDate,
    DateTime? endDate,
    required bool isActive,
    required UserAssignmentPermissions permissions,
    required String createdBy,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _UserAssignment;

  factory UserAssignment.fromJson(Map<String, dynamic> json) => _$UserAssignmentFromJson(json);
}

@freezed
class BusinessRule with _$BusinessRule {
  const factory BusinessRule({
    required String id,
    required String companyId,
    required String type, // 'overtime' | 'break' | 'geofence' | 'validation'
    required String name,
    required String description,
    required Map<String, dynamic> conditions,
    required Map<String, dynamic> actions,
    required bool isActive,
    required int priority,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _BusinessRule;

  factory BusinessRule.fromJson(Map<String, dynamic> json) => _$BusinessRuleFromJson(json);
}

// Enhanced Notification Preferences
@freezed
class NotificationPreference with _$NotificationPreference {
  const factory NotificationPreference({
    required String id,
    required String userId,
    required String companyId,
    // Notification Types
    required bool emailNotifications,
    required bool smsNotifications,
    required bool pushNotifications,
    // Event Triggers
    required bool onClockIn,
    required bool onClockOut,
    required bool onMissedClockOut,
    required bool onOvertimeAlert,
    required bool onGeofenceError,
    required bool onTimesheetApproval,
    // Frequency
    required bool dailySummary,
    required bool weeklySummary,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _NotificationPreference;

  factory NotificationPreference.fromJson(Map<String, dynamic> json) => _$NotificationPreferenceFromJson(json);
}

// API Request/Response classes
@freezed
class CreateJobSiteRequest with _$CreateJobSiteRequest {
  const factory CreateJobSiteRequest({
    required String siteName,
    required String address,
    required double latitude,
    required double longitude,
    required int radius,
  }) = _CreateJobSiteRequest;

  factory CreateJobSiteRequest.fromJson(Map<String, dynamic> json) => _$CreateJobSiteRequestFromJson(json);
}

@freezed
class GenerateReportRequest with _$GenerateReportRequest {
  const factory GenerateReportRequest({
    required String userId,
    required DateTime startDate,
    required DateTime endDate,
  }) = _GenerateReportRequest;

  factory GenerateReportRequest.fromJson(Map<String, dynamic> json) => _$GenerateReportRequestFromJson(json);
}

@freezed
class GenerateReportResponse with _$GenerateReportResponse {
  const factory GenerateReportResponse({
    required List<CompletedShift> shifts,
    required double totalHours,
    required double totalPay,
    required List<TimeEntry> anomalies,
  }) = _GenerateReportResponse;

  factory GenerateReportResponse.fromJson(Map<String, dynamic> json) => _$GenerateReportResponseFromJson(json);
}

// State management classes
@freezed
class AuthState with _$AuthState {
  const factory AuthState({
    User? user,
    required bool loading,
    String? error,
  }) = _AuthState;

  factory AuthState.fromJson(Map<String, dynamic> json) => _$AuthStateFromJson(json);
}

@freezed
class MapCenter with _$MapCenter {
  const factory MapCenter({
    required double latitude,
    required double longitude,
    required double zoom,
  }) = _MapCenter;

  factory MapCenter.fromJson(Map<String, dynamic> json) => _$MapCenterFromJson(json);
}

@freezed
class MapState with _$MapState {
  const factory MapState({
    required MapCenter center,
    required List<JobSite> jobSites,
    required List<TimeEntry> timeEntries,
    required bool isLoading,
    String? error,
  }) = _MapState;

  factory MapState.fromJson(Map<String, dynamic> json) => _$MapStateFromJson(json);
}

// Enhanced Business Logic Models
@freezed
class CompanySettings with _$CompanySettings {
  const factory CompanySettings({
    required String id,
    required String companyId,
    // Work Rules
    required double standardWorkHours, // e.g., 8 hours per day
    required double overtimeThreshold, // hours before overtime kicks in
    required double overtimeRate, // multiplier (e.g., 1.5 for time-and-a-half)
    // Break Policies
    int? requiredBreakDuration, // minutes
    int? requiredBreakInterval, // hours before break required
    required bool unpaidBreaks,
    // Geofencing Rules
    required int geofenceAccuracy, // meters
    required int minimumTimeAtSite, // minutes
    required bool allowClockInEarly,
    required bool allowClockOutEarly,
    // Scheduling
    required String weekStartDay, // 'monday' | 'sunday'
    required String payPeriodType, // 'weekly' | 'biweekly' | 'monthly'
    // Compliance
    required bool requireBreakAcknowledgment,
    required int dataRetentionDays,
    required String timezoneOffset,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _CompanySettings;

  factory CompanySettings.fromJson(Map<String, dynamic> json) => _$CompanySettingsFromJson(json);
}

@freezed
class EmployeePermissions with _$EmployeePermissions {
  const factory EmployeePermissions({
    required bool canViewOwnSchedule,
    required bool canViewOwnTimesheet,
    required bool canViewOwnReports,
    required bool canViewCompanySchedule,
    required bool canViewCompanyTimesheet,
    required bool canViewCompanyReports,
    required bool canManageEmployees,
    required bool canManageJobSites,
    required bool canManageCompanySettings,
    required bool canViewAnalytics,
    required bool canExportData,
    required bool canManageIntegrations,
  }) = _EmployeePermissions;

  factory EmployeePermissions.fromJson(Map<String, dynamic> json) => _$EmployeePermissionsFromJson(json);
}

@freezed
class EmployeeAssignment with _$EmployeeAssignment {
  const factory EmployeeAssignment({
    required String employeeId,
    required String jobSiteId,
    required DateTime startDate,
    DateTime? endDate,
    required bool isActive,
    required String assignedBy,
    required DateTime assignedAt,
  }) = _EmployeeAssignment;

  factory EmployeeAssignment.fromJson(Map<String, dynamic> json) => _$EmployeeAssignmentFromJson(json);
}



// Legacy notification preferences (replaced by enhanced version above)

// Audit and Logging
@freezed
class AuditLog with _$AuditLog {
  const factory AuditLog({
    required String logId,
    required String userId,
    required String action,
    required String resourceType,
    required String resourceId,
    required Map<String, dynamic> changes,
    required String ipAddress,
    required String userAgent,
    required DateTime timestamp,
  }) = _AuditLog;

  factory AuditLog.fromJson(Map<String, dynamic> json) => _$AuditLogFromJson(json);
}

// Subscription and Billing
@freezed
class Subscription with _$Subscription {
  const factory Subscription({
    required String subscriptionId,
    required String companyId,
    required String planId,
    required String status, // 'active', 'cancelled', 'past_due', 'trial'
    required DateTime startDate,
    required DateTime endDate,
    required int maxEmployees,
    required double monthlyPrice,
    required String currency,
    required Map<String, dynamic> features,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Subscription;

  factory Subscription.fromJson(Map<String, dynamic> json) => _$SubscriptionFromJson(json);
}

// Integrations
@freezed
class Integration with _$Integration {
  const factory Integration({
    required String integrationId,
    required String companyId,
    required String type, // 'payroll', 'accounting', 'hr', 'project_management'
    required String provider, // 'quickbooks', 'xero', 'bamboo', 'asana'
    required String status, // 'active', 'inactive', 'error'
    required Map<String, dynamic> config,
    required Map<String, dynamic> metadata,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Integration;

  factory Integration.fromJson(Map<String, dynamic> json) => _$IntegrationFromJson(json);
}

// Alerts and Monitoring
@freezed
class Alert with _$Alert {
  const factory Alert({
    required String alertId,
    required String companyId,
    required String type, // 'anomaly', 'threshold', 'system'
    required String severity, // 'low', 'medium', 'high', 'critical'
    required String title,
    required String message,
    required Map<String, dynamic> data,
    required bool isResolved,
    required DateTime createdAt,
    DateTime? resolvedAt,
  }) = _Alert;

  factory Alert.fromJson(Map<String, dynamic> json) => _$AlertFromJson(json);
}

// System Configuration
@freezed
class SystemConfiguration with _$SystemConfiguration {
  const factory SystemConfiguration({
    required String configId,
    required String key,
    required String value,
    required String type, // 'string', 'number', 'boolean', 'json'
    required String scope, // 'global', 'company', 'user'
    String? companyId,
    String? userId,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _SystemConfiguration;

  factory SystemConfiguration.fromJson(Map<String, dynamic> json) => _$SystemConfigurationFromJson(json);
}

// Custom Fields
@freezed
class CustomField with _$CustomField {
  const factory CustomField({
    required String fieldId,
    required String companyId,
    required String name,
    required String type, // 'text', 'number', 'date', 'select', 'multiselect'
    required String entity, // 'employee', 'job_site', 'timesheet'
    required bool isRequired,
    required Map<String, dynamic> options,
    required int order,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _CustomField;

  factory CustomField.fromJson(Map<String, dynamic> json) => _$CustomFieldFromJson(json);
}

@freezed
class CustomFieldValue with _$CustomFieldValue {
  const factory CustomFieldValue({
    required String valueId,
    required String fieldId,
    required String entityId,
    required String entityType,
    required dynamic value,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _CustomFieldValue;

  factory CustomFieldValue.fromJson(Map<String, dynamic> json) => _$CustomFieldValueFromJson(json);
}

// Permissions and Roles
@freezed
class Permission with _$Permission {
  const factory Permission({
    required String permissionId,
    required String name,
    required String description,
    required String resource,
    required String action,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Permission;

  factory Permission.fromJson(Map<String, dynamic> json) => _$PermissionFromJson(json);
}

@freezed
class Role with _$Role {
  const factory Role({
    required String roleId,
    required String name,
    required String description,
    required List<String> permissions,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Role;

  factory Role.fromJson(Map<String, dynamic> json) => _$RoleFromJson(json);
}

@freezed
class UserRole with _$UserRole {
  const factory UserRole({
    required String userRoleId,
    required String userId,
    required String roleId,
    required String companyId,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _UserRole;

  factory UserRole.fromJson(Map<String, dynamic> json) => _$UserRoleFromJson(json);
}

// Events and Metadata
@freezed
class EventMetadata with _$EventMetadata {
  const factory EventMetadata({
    required String eventId,
    required String eventType,
    required String source,
    required Map<String, dynamic> data,
    required DateTime timestamp,
  }) = _EventMetadata;

  factory EventMetadata.fromJson(Map<String, dynamic> json) => _$EventMetadataFromJson(json);
}

// System Events
@freezed
class SystemEvent with _$SystemEvent {
  const factory SystemEvent({
    required String eventId,
    required String eventType,
    required String severity,
    required String message,
    required Map<String, dynamic> metadata,
    required DateTime timestamp,
  }) = _SystemEvent;

  factory SystemEvent.fromJson(Map<String, dynamic> json) => _$SystemEventFromJson(json);
}

// Retry Policies
@freezed
class RetryPolicy with _$RetryPolicy {
  const factory RetryPolicy({
    required int maxAttempts,
    required Duration initialDelay,
    required double backoffMultiplier,
    required Duration maxDelay,
  }) = _RetryPolicy;

  factory RetryPolicy.fromJson(Map<String, dynamic> json) => _$RetryPolicyFromJson(json);
}

// Event Handlers
@freezed
class EventHandler with _$EventHandler {
  const factory EventHandler({
    required String handlerId,
    required String eventType,
    required String handlerType, // 'function', 'webhook', 'email'
    required Map<String, dynamic> config,
    required bool isActive,
    required RetryPolicy retryPolicy,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _EventHandler;

  factory EventHandler.fromJson(Map<String, dynamic> json) => _$EventHandlerFromJson(json);
}

// Background Jobs
@freezed
class BackgroundJob with _$BackgroundJob {
  const factory BackgroundJob({
    required String jobId,
    required String jobType,
    required String status, // 'pending', 'running', 'completed', 'failed'
    required Map<String, dynamic> data,
    required DateTime scheduledAt,
    DateTime? startedAt,
    DateTime? completedAt,
    String? error,
    required int attempts,
    required int maxAttempts,
  }) = _BackgroundJob;

  factory BackgroundJob.fromJson(Map<String, dynamic> json) => _$BackgroundJobFromJson(json);
}

// API Versioning
@freezed
class ApiVersion with _$ApiVersion {
  const factory ApiVersion({
    required String version,
    required DateTime releaseDate,
    required bool isDeprecated,
    required DateTime deprecationDate,
    required List<String> breakingChanges,
    required List<String> newFeatures,
    required List<String> bugFixes,
  }) = _ApiVersion;

  factory ApiVersion.fromJson(Map<String, dynamic> json) => _$ApiVersionFromJson(json);
}

// Caching
@freezed
class CacheEntry with _$CacheEntry {
  const factory CacheEntry({
    required String key,
    required dynamic value,
    required DateTime expiresAt,
    required DateTime createdAt,
  }) = _CacheEntry;

  factory CacheEntry.fromJson(Map<String, dynamic> json) => _$CacheEntryFromJson(json);
}

// Platform Analytics
@freezed
class PlatformMetrics with _$PlatformMetrics {
  const factory PlatformMetrics({
    required String metricId,
    required String metricName,
    required String metricType, // 'counter', 'gauge', 'histogram'
    required dynamic value,
    required Map<String, String> labels,
    required DateTime timestamp,
  }) = _PlatformMetrics;

  factory PlatformMetrics.fromJson(Map<String, dynamic> json) => _$PlatformMetricsFromJson(json);
}

@freezed
class PlatformTrends with _$PlatformTrends {
  const factory PlatformTrends({
    required String trendId,
    required String metricName,
    required List<double> values,
    required List<DateTime> timestamps,
    required String trend, // 'increasing', 'decreasing', 'stable'
    required double changeRate,
    required DateTime createdAt,
  }) = _PlatformTrends;

  factory PlatformTrends.fromJson(Map<String, dynamic> json) => _$PlatformTrendsFromJson(json);
}

@freezed
class PlatformAnalytics with _$PlatformAnalytics {
  const factory PlatformAnalytics({
    required String analyticsId,
    required String companyId,
    required DateTime startDate,
    required DateTime endDate,
    required Map<String, dynamic> metrics,
    required Map<String, PlatformTrends> trends,
    required DateTime createdAt,
  }) = _PlatformAnalytics;

  factory PlatformAnalytics.fromJson(Map<String, dynamic> json) => _$PlatformAnalyticsFromJson(json);
}

// Customer Metrics
@freezed
class CustomerMetricsData with _$CustomerMetricsData {
  const factory CustomerMetricsData({
    required String dataId,
    required String companyId,
    required DateTime date,
    required int activeUsers,
    required int totalShifts,
    required double totalHours,
    required double averageShiftDuration,
    required int jobSitesCount,
    required int employeesCount,
    required Map<String, dynamic> customMetrics,
  }) = _CustomerMetricsData;

  factory CustomerMetricsData.fromJson(Map<String, dynamic> json) => _$CustomerMetricsDataFromJson(json);
}

@freezed
class CustomerMetrics with _$CustomerMetrics {
  const factory CustomerMetrics({
    required String metricsId,
    required String companyId,
    required DateTime startDate,
    required DateTime endDate,
    required List<CustomerMetricsData> data,
    required Map<String, dynamic> summary,
    required DateTime createdAt,
  }) = _CustomerMetrics;

  factory CustomerMetrics.fromJson(Map<String, dynamic> json) => _$CustomerMetricsFromJson(json);
}

// Service Health
@freezed
class ServiceHealth with _$ServiceHealth {
  const factory ServiceHealth({
    required String serviceId,
    required String serviceName,
    required String status, // 'healthy', 'degraded', 'down'
    required double uptime,
    required double responseTime,
    required Map<String, dynamic> metrics,
    required DateTime lastCheck,
  }) = _ServiceHealth;

  factory ServiceHealth.fromJson(Map<String, dynamic> json) => _$ServiceHealthFromJson(json);
}

@freezed
class SystemHealth with _$SystemHealth {
  const factory SystemHealth({
    required String healthId,
    required DateTime timestamp,
    required String overallStatus,
    required List<ServiceHealth> services,
    required Map<String, dynamic> systemMetrics,
    required Map<String, dynamic> alerts,
  }) = _SystemHealth;

  factory SystemHealth.fromJson(Map<String, dynamic> json) => _$SystemHealthFromJson(json);
}

// Support System
@freezed
class SupportTicketMetadata with _$SupportTicketMetadata {
  const factory SupportTicketMetadata({
    required String ticketId,
    required String priority,
    required String category,
    required String status,
    required List<String> tags,
    required Map<String, dynamic> customFields,
  }) = _SupportTicketMetadata;

  factory SupportTicketMetadata.fromJson(Map<String, dynamic> json) => _$SupportTicketMetadataFromJson(json);
}

@freezed
class SupportConversation with _$SupportConversation {
  const factory SupportConversation({
    required String conversationId,
    required String ticketId,
    required String userId,
    required String message,
    required String type, // 'user', 'agent', 'system'
    required DateTime timestamp,
    required Map<String, dynamic> metadata,
  }) = _SupportConversation;

  factory SupportConversation.fromJson(Map<String, dynamic> json) => _$SupportConversationFromJson(json);
}

@freezed
class SupportTicket with _$SupportTicket {
  const factory SupportTicket({
    required String ticketId,
    required String userId,
    required String companyId,
    required String subject,
    required String description,
    required String priority,
    required String status,
    required SupportTicketMetadata metadata,
    required List<SupportConversation> conversations,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _SupportTicket;

  factory SupportTicket.fromJson(Map<String, dynamic> json) => _$SupportTicketFromJson(json);
}

// Localization and Internationalization
@freezed
class Translation with _$Translation {
  const factory Translation({
    required String translationId,
    required String key,
    required String language,
    required String value,
    required String context,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Translation;

  factory Translation.fromJson(Map<String, dynamic> json) => _$TranslationFromJson(json);
}

@freezed
class LocalizedContent with _$LocalizedContent {
  const factory LocalizedContent({
    required String contentId,
    required String contentType, // 'ui', 'email', 'notification'
    required Map<String, String> translations,
    required String defaultLanguage,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _LocalizedContent;

  factory LocalizedContent.fromJson(Map<String, dynamic> json) => _$LocalizedContentFromJson(json);
}

@freezed
class RegionalSettings with _$RegionalSettings {
  const factory RegionalSettings({
    required String regionId,
    required String regionName,
    required String defaultLanguage,
    required String defaultCurrency,
    required String defaultTimezone,
    required String dateFormat,
    required String timeFormat,
    required Map<String, dynamic> holidays,
    required Map<String, dynamic> businessHours,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _RegionalSettings;

  factory RegionalSettings.fromJson(Map<String, dynamic> json) => _$RegionalSettingsFromJson(json);
}

// Configuration Management
@freezed
class Configuration with _$Configuration {
  const factory Configuration({
    required String configId,
    required String configType, // 'system', 'company', 'user'
    required String configKey,
    required dynamic configValue,
    required String dataType, // 'string', 'number', 'boolean', 'json'
    required bool isEncrypted,
    required String scope, // 'global', 'company', 'user'
    String? companyId,
    String? userId,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Configuration;

  factory Configuration.fromJson(Map<String, dynamic> json) => _$ConfigurationFromJson(json);
}

// Error Handling
@freezed
class StandardError with _$StandardError {
  const factory StandardError({
    required String errorCode,
    required String message,
    required String details,
    required String timestamp,
    required String requestId,
    required Map<String, dynamic> context,
  }) = _StandardError;

  factory StandardError.fromJson(Map<String, dynamic> json) => _$StandardErrorFromJson(json);
}

// API Response Metadata
@freezed
class ApiResponseMetadata with _$ApiResponseMetadata {
  const factory ApiResponseMetadata({
    required String requestId,
    required DateTime timestamp,
    required int statusCode,
    required String statusMessage,
    required Map<String, dynamic> headers,
    required Map<String, dynamic> context,
  }) = _ApiResponseMetadata;

  factory ApiResponseMetadata.fromJson(Map<String, dynamic> json) => _$ApiResponseMetadataFromJson(json);
}

// API Pagination
@freezed
class ApiPagination with _$ApiPagination {
  const factory ApiPagination({
    required int page,
    required int limit,
    required int total,
    required int totalPages,
    required bool hasNext,
    required bool hasPrev,
  }) = _ApiPagination;

  factory ApiPagination.fromJson(Map<String, dynamic> json) => _$ApiPaginationFromJson(json);
}

// Audit Trail
@freezed
class AuditActor with _$AuditActor {
  const factory AuditActor({
    required String actorId,
    required String actorType, // 'user', 'system', 'api'
    required String actorName,
    required String actorEmail,
    required Map<String, dynamic> metadata,
  }) = _AuditActor;

  factory AuditActor.fromJson(Map<String, dynamic> json) => _$AuditActorFromJson(json);
}

@freezed
class AuditMetadata with _$AuditMetadata {
  const factory AuditMetadata({
    required String sessionId,
    required String ipAddress,
    required String userAgent,
    required String requestId,
    required Map<String, dynamic> context,
  }) = _AuditMetadata;

  factory AuditMetadata.fromJson(Map<String, dynamic> json) => _$AuditMetadataFromJson(json);
}

@freezed
class AuditChanges with _$AuditChanges {
  const factory AuditChanges({
    required Map<String, dynamic> before,
    required Map<String, dynamic> after,
    required List<String> changedFields,
  }) = _AuditChanges;

  factory AuditChanges.fromJson(Map<String, dynamic> json) => _$AuditChangesFromJson(json);
}

@freezed
class AuditTrail with _$AuditTrail {
  const factory AuditTrail({
    required String auditId,
    required String resourceType,
    required String resourceId,
    required String action,
    required AuditActor actor,
    required AuditMetadata metadata,
    AuditChanges? changes,
    required DateTime timestamp,
  }) = _AuditTrail;

  factory AuditTrail.fromJson(Map<String, dynamic> json) => _$AuditTrailFromJson(json);
} 