// Dart models that mirror the TypeScript interfaces
// These should be kept in sync with packages/shared/types/index.ts

import 'package:json_annotation/json_annotation.dart';
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
    required Map<String, String> numberFormat,
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
  }) = _DeviceInfo;

  factory DeviceInfo.fromJson(Map<String, dynamic> json) => _$DeviceInfoFromJson(json);
}

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
    required String employeeId,
    required String companyId,
    required String jobSiteId,
    required DateTime startTime,
    required DateTime endTime,
    required double totalHours,
    required double regularHours,
    required double overtimeHours,
    double? breakTime,
    required bool approved,
    String? approvedBy,
    String? notes,
    required DateTime createdAt,
  }) = _CompletedShift;

  factory CompletedShift.fromJson(Map<String, dynamic> json) =>
      _$CompletedShiftFromJson(json);
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
    required double lat,
    required double lng,
  }) = _MapCenter;

  factory MapCenter.fromJson(Map<String, dynamic> json) => _$MapCenterFromJson(json);
}

@freezed
class MapState with _$MapState {
  const factory MapState({
    required MapCenter center,
    required double zoom,
    JobSite? selectedSite,
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
    required double standardWorkHours,
    required double overtimeThreshold,
    required double overtimeRate,
    // Break Policies
    double? requiredBreakDuration,
    double? requiredBreakInterval,
    required bool unpaidBreaks,
    // Geofencing Rules
    required double geofenceAccuracy,
    required double minimumTimeAtSite,
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

  factory CompanySettings.fromJson(Map<String, dynamic> json) =>
      _$CompanySettingsFromJson(json);
}

@freezed
class EmployeePermissions with _$EmployeePermissions {
  const factory EmployeePermissions({
    required bool canEditTimeEntries,
    required bool canViewReports,
    required bool canManageOtherEmployees,
  }) = _EmployeePermissions;

  factory EmployeePermissions.fromJson(Map<String, dynamic> json) =>
      _$EmployeePermissionsFromJson(json);
}

@freezed
class EmployeeAssignment with _$EmployeeAssignment {
  const factory EmployeeAssignment({
    required String id,
    required String employeeId,
    required String companyId,
    required String jobSiteId,
    String? role,
    required DateTime startDate,
    DateTime? endDate,
    required bool isActive,
    required EmployeePermissions permissions,
    required String createdBy,
    required DateTime createdAt,
  }) = _EmployeeAssignment;

  factory EmployeeAssignment.fromJson(Map<String, dynamic> json) =>
      _$EmployeeAssignmentFromJson(json);
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

  factory BusinessRule.fromJson(Map<String, dynamic> json) =>
      _$BusinessRuleFromJson(json);
}

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

  factory NotificationPreference.fromJson(Map<String, dynamic> json) =>
      _$NotificationPreferenceFromJson(json);
}

@freezed
class AuditLog with _$AuditLog {
  const factory AuditLog({
    required String id,
    required String companyId,
    required String userId,
    required String action,
    required String resourceType, // 'user' | 'company' | 'jobsite' | 'timeentry' | 'settings'
    required String resourceId,
    Map<String, dynamic>? oldValue,
    Map<String, dynamic>? newValue,
    String? ipAddress,
    String? userAgent,
    required DateTime timestamp,
  }) = _AuditLog;

  factory AuditLog.fromJson(Map<String, dynamic> json) =>
      _$AuditLogFromJson(json);
}

@freezed
class Subscription with _$Subscription {
  const factory Subscription({
    required String id,
    required String companyId,
    required String planType, // 'basic' | 'professional' | 'enterprise'
    required int employeeLimit,
    required List<String> features,
    required double monthlyPrice,
    required String status, // 'active' | 'suspended' | 'cancelled'
    required String billingEmail,
    required DateTime startDate,
    DateTime? endDate,
    DateTime? trialEndDate,
    String? paymentMethodId,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Subscription;

  factory Subscription.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionFromJson(json);
}

@freezed
class Integration with _$Integration {
  const factory Integration({
    required String id,
    required String companyId,
    required String type, // 'payroll' | 'hr' | 'accounting'
    required String provider, // 'quickbooks' | 'adp' | 'paychex' | 'workday' | 'bamboohr'
    required Map<String, String> credentials, // encrypted
    required Map<String, dynamic> settings,
    required bool isActive,
    DateTime? lastSyncDate,
    required String syncFrequency, // 'realtime' | 'hourly' | 'daily' | 'weekly'
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Integration;

  factory Integration.fromJson(Map<String, dynamic> json) =>
      _$IntegrationFromJson(json);
}

@freezed
class Alert with _$Alert {
  const factory Alert({
    required String id,
    required String companyId,
    String? employeeId,
    required String type, // 'overtime' | 'missed_clockout' | 'geofence_error' | 'policy_violation'
    required String severity, // 'low' | 'medium' | 'high' | 'critical'
    required String title,
    required String message,
    required Map<String, dynamic> data,
    required bool isRead,
    required bool isResolved,
    String? resolvedBy,
    DateTime? resolvedAt,
    required DateTime createdAt,
  }) = _Alert;

  factory Alert.fromJson(Map<String, dynamic> json) =>
      _$AlertFromJson(json);
}

// Extensibility & Future-Proof Architecture Models

@freezed
class SystemConfiguration with _$SystemConfiguration {
  const factory SystemConfiguration({
    required String id,
    String? companyId,
    required String category, // 'feature' | 'integration' | 'ui' | 'business' | 'system'
    required String key,
    required dynamic value,
    required String dataType, // 'string' | 'number' | 'boolean' | 'object' | 'array'
    String? description,
    required bool isPublic,
    required bool isEditable,
    Map<String, dynamic>? validationRules,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _SystemConfiguration;

  factory SystemConfiguration.fromJson(Map<String, dynamic> json) =>
      _$SystemConfigurationFromJson(json);
}

@freezed
class CustomField with _$CustomField {
  const factory CustomField({
    required String id,
    required String companyId,
    required String entityType, // 'user' | 'jobsite' | 'timeentry' | 'shift'
    required String fieldName,
    required String displayName,
    required String fieldType, // 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect'
    List<String>? options,
    required bool isRequired,
    dynamic defaultValue,
    Map<String, dynamic>? validationRules,
    required bool isActive,
    required int sortOrder,
    required String createdBy,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _CustomField;

  factory CustomField.fromJson(Map<String, dynamic> json) =>
      _$CustomFieldFromJson(json);
}

@freezed
class CustomFieldValue with _$CustomFieldValue {
  const factory CustomFieldValue({
    required String id,
    required String companyId,
    required String fieldId,
    required String entityType,
    required String entityId,
    required dynamic value,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _CustomFieldValue;

  factory CustomFieldValue.fromJson(Map<String, dynamic> json) =>
      _$CustomFieldValueFromJson(json);
}

@freezed
class Permission with _$Permission {
  const factory Permission({
    required String id,
    String? companyId,
    required String name,
    required String description,
    required String category, // 'user' | 'company' | 'jobsite' | 'timeentry' | 'report' | 'integration' | 'system'
    required String action, // 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export' | 'admin'
    String? resource,
    Map<String, dynamic>? conditions,
    required bool isSystem,
    required DateTime createdAt,
  }) = _Permission;

  factory Permission.fromJson(Map<String, dynamic> json) =>
      _$PermissionFromJson(json);
}

@freezed
class Role with _$Role {
  const factory Role({
    required String id,
    String? companyId,
    required String name,
    required String description,
    required List<String> permissions,
    required bool isSystem,
    List<String>? inheritsFrom,
    required bool isActive,
    String? createdBy,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Role;

  factory Role.fromJson(Map<String, dynamic> json) =>
      _$RoleFromJson(json);
}

@freezed
class UserRole with _$UserRole {
  const factory UserRole({
    required String id,
    required String userId,
    required String companyId,
    required String roleId,
    required String grantedBy,
    required DateTime grantedAt,
    DateTime? expiresAt,
    required bool isActive,
  }) = _UserRole;

  factory UserRole.fromJson(Map<String, dynamic> json) =>
      _$UserRoleFromJson(json);
}

@freezed
class EventMetadata with _$EventMetadata {
  const factory EventMetadata({
    String? userAgent,
    String? ipAddress,
    String? deviceId,
    String? version,
  }) = _EventMetadata;

  factory EventMetadata.fromJson(Map<String, dynamic> json) =>
      _$EventMetadataFromJson(json);
}

@freezed
class SystemEvent with _$SystemEvent {
  const factory SystemEvent({
    required String id,
    String? companyId,
    required String eventType,
    required String source, // 'mobile' | 'web' | 'api' | 'system'
    String? userId,
    String? entityType,
    String? entityId,
    required Map<String, dynamic> data,
    required EventMetadata metadata,
    required DateTime timestamp,
    required bool processed,
    DateTime? processedAt,
    required int retryCount,
  }) = _SystemEvent;

  factory SystemEvent.fromJson(Map<String, dynamic> json) =>
      _$SystemEventFromJson(json);
}

@freezed
class RetryPolicy with _$RetryPolicy {
  const factory RetryPolicy({
    required int maxRetries,
    required int backoffMs,
  }) = _RetryPolicy;

  factory RetryPolicy.fromJson(Map<String, dynamic> json) =>
      _$RetryPolicyFromJson(json);
}

@freezed
class EventHandler with _$EventHandler {
  const factory EventHandler({
    required String id,
    String? companyId,
    required String name,
    required List<String> eventTypes,
    required String handlerType, // 'webhook' | 'function' | 'notification' | 'integration'
    required Map<String, dynamic> configuration,
    required bool isActive,
    required int priority,
    required RetryPolicy retryPolicy,
    String? createdBy,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _EventHandler;

  factory EventHandler.fromJson(Map<String, dynamic> json) =>
      _$EventHandlerFromJson(json);
}

@freezed
class BackgroundJob with _$BackgroundJob {
  const factory BackgroundJob({
    required String id,
    String? companyId,
    required String type,
    required String status, // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    required String priority, // 'low' | 'normal' | 'high' | 'critical'
    required Map<String, dynamic> data,
    Map<String, dynamic>? result,
    String? error,
    double? progress,
    DateTime? scheduledFor,
    DateTime? startedAt,
    DateTime? completedAt,
    required int retryCount,
    required int maxRetries,
    String? createdBy,
    required DateTime createdAt,
  }) = _BackgroundJob;

  factory BackgroundJob.fromJson(Map<String, dynamic> json) =>
      _$BackgroundJobFromJson(json);
}

@freezed
class ApiVersion with _$ApiVersion {
  const factory ApiVersion({
    required String version,
    required bool isActive,
    required bool isDeprecated,
    DateTime? deprecationDate,
    DateTime? sunsetDate,
    required List<String> supportedEndpoints,
    String? migrationGuide,
    required DateTime createdAt,
  }) = _ApiVersion;

  factory ApiVersion.fromJson(Map<String, dynamic> json) =>
      _$ApiVersionFromJson(json);
}

@freezed
class CacheEntry with _$CacheEntry {
  const factory CacheEntry({
    required String key,
    String? companyId,
    required dynamic data,
    required int ttl,
    required List<String> tags,
    required DateTime createdAt,
    required DateTime expiresAt,
  }) = _CacheEntry;

  factory CacheEntry.fromJson(Map<String, dynamic> json) =>
      _$CacheEntryFromJson(json);
}

// Super Admin / Platform Owner Models

@freezed
class PlatformMetrics with _$PlatformMetrics {
  const factory PlatformMetrics({
    // Business Metrics
    required int totalCompanies,
    required int activeCompanies,
    required int totalEmployees,
    required int activeEmployees,
    required int totalTimeEntries,
    // Revenue Metrics
    required double monthlyRecurringRevenue,
    required double annualRecurringRevenue,
    required double customerLifetimeValue,
    required double churnRate,
    // Usage Metrics
    required int dailyActiveUsers,
    required int monthlyActiveUsers,
    required double averageSessionDuration,
    required double geofenceAccuracy,
    // System Metrics
    required double systemUptime,
    required double averageResponseTime,
    required double errorRate,
    required int apiCallsPerDay,
  }) = _PlatformMetrics;

  factory PlatformMetrics.fromJson(Map<String, dynamic> json) =>
      _$PlatformMetricsFromJson(json);
}

@freezed
class PlatformTrends with _$PlatformTrends {
  const factory PlatformTrends({
    required double userGrowthRate,
    required double revenueGrowthRate,
    required double churnTrend,
    required double usageGrowthRate,
  }) = _PlatformTrends;

  factory PlatformTrends.fromJson(Map<String, dynamic> json) =>
      _$PlatformTrendsFromJson(json);
}

@freezed
class PlatformAnalytics with _$PlatformAnalytics {
  const factory PlatformAnalytics({
    required String id,
    required DateTime date,
    required PlatformMetrics metrics,
    required PlatformTrends trends,
    required DateTime createdAt,
  }) = _PlatformAnalytics;

  factory PlatformAnalytics.fromJson(Map<String, dynamic> json) =>
      _$PlatformAnalyticsFromJson(json);
}

@freezed
class CustomerMetricsData with _$CustomerMetricsData {
  const factory CustomerMetricsData({
    // Usage Metrics
    required int employeeCount,
    required int activeEmployees,
    required int timeEntriesCount,
    required int geofenceEvents,
    required int reportGenerations,
    required int integrationUsage,
    // Health Metrics
    required int loginFrequency,
    required double featureAdoptionRate,
    required int supportTicketsCount,
    required DateTime lastActivityDate,
    // Billing Metrics
    required String subscriptionPlan,
    required double monthlyRevenue,
    required String paymentStatus, // 'current' | 'overdue' | 'failed'
    DateTime? contractEndDate,
  }) = _CustomerMetricsData;

  factory CustomerMetricsData.fromJson(Map<String, dynamic> json) =>
      _$CustomerMetricsDataFromJson(json);
}

@freezed
class CustomerMetrics with _$CustomerMetrics {
  const factory CustomerMetrics({
    required String id,
    required String companyId,
    required DateTime date,
    required CustomerMetricsData metrics,
    required int healthScore, // 0-100
    required String churnRisk, // 'low' | 'medium' | 'high'
    required DateTime createdAt,
  }) = _CustomerMetrics;

  factory CustomerMetrics.fromJson(Map<String, dynamic> json) =>
      _$CustomerMetricsFromJson(json);
}

@freezed
class ServiceHealth with _$ServiceHealth {
  const factory ServiceHealth({
    required String status, // 'healthy' | 'degraded' | 'down'
    required double responseTime,
    required double errorRate,
  }) = _ServiceHealth;

  factory ServiceHealth.fromJson(Map<String, dynamic> json) =>
      _$ServiceHealthFromJson(json);
}

@freezed
class SystemHealth with _$SystemHealth {
  const factory SystemHealth({
    required String id,
    required DateTime timestamp,
    required Map<String, ServiceHealth> services,
    required String overallHealth, // 'healthy' | 'degraded' | 'critical'
    required List<String> alerts,
  }) = _SystemHealth;

  factory SystemHealth.fromJson(Map<String, dynamic> json) =>
      _$SystemHealthFromJson(json);
}

@freezed
class SupportTicketMetadata with _$SupportTicketMetadata {
  const factory SupportTicketMetadata({
    String? browserInfo,
    String? deviceInfo,
    String? appVersion,
    List<String>? errorLogs,
    List<String>? attachments,
  }) = _SupportTicketMetadata;

  factory SupportTicketMetadata.fromJson(Map<String, dynamic> json) =>
      _$SupportTicketMetadataFromJson(json);
}

@freezed
class SupportConversation with _$SupportConversation {
  const factory SupportConversation({
    required String id,
    required String authorId,
    required String authorType, // 'customer' | 'support' | 'system'
    required String message,
    required DateTime timestamp,
    required bool isInternal,
  }) = _SupportConversation;

  factory SupportConversation.fromJson(Map<String, dynamic> json) =>
      _$SupportConversationFromJson(json);
}

@freezed
class SupportTicket with _$SupportTicket {
  const factory SupportTicket({
    required String id,
    required String companyId,
    required String userId,
    required String type, // 'bug' | 'feature_request' | 'help' | 'billing' | 'technical'
    required String priority, // 'low' | 'medium' | 'high' | 'critical'
    required String status, // 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
    required String subject,
    required String description,
    required String category,
    required List<String> tags,
    String? assignedTo,
    int? customerSatisfactionRating,
    int? resolutionTime,
    int? firstResponseTime,
    required SupportTicketMetadata metadata,
    required List<SupportConversation> conversation,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? resolvedAt,
  }) = _SupportTicket;

  factory SupportTicket.fromJson(Map<String, dynamic> json) =>
      _$SupportTicketFromJson(json);
}

// Internationalization (i18n) Models

@freezed
class Translation with _$Translation {
  const factory Translation({
    required String id,
    required String key, // 'dashboard.welcome', 'errors.invalidEmail'
    required String namespace, // 'common', 'dashboard', 'mobile'
    required Map<String, Map<String, dynamic>> translations,
    List<String>? variables, // ['userName', 'count']
    String? description,
    required bool isPlural,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Translation;

  factory Translation.fromJson(Map<String, dynamic> json) =>
      _$TranslationFromJson(json);
}

@freezed
class LocalizedContent with _$LocalizedContent {
  const factory LocalizedContent({
    required String id,
    required String contentType, // 'email_template' | 'notification' | 'help_article' | 'legal_document'
    required String baseLanguage, // 'en'
    required Map<String, Map<String, dynamic>> versions,
    required List<String> variables,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _LocalizedContent;

  factory LocalizedContent.fromJson(Map<String, dynamic> json) =>
      _$LocalizedContentFromJson(json);
}

@freezed
class RegionalSettings with _$RegionalSettings {
  const factory RegionalSettings({
    required String id,
    required String region, // 'north_america', 'europe', 'asia_pacific'
    required List<String> countries, // ['US', 'CA', 'MX']
    required List<String> supportedLanguages,
    required String defaultCurrency,
    required Map<String, dynamic> taxConfiguration,
    required Map<String, dynamic> legalRequirements,
    required Map<String, dynamic> businessHours,
    required Map<String, dynamic> supportChannels,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _RegionalSettings;

  factory RegionalSettings.fromJson(Map<String, dynamic> json) =>
      _$RegionalSettingsFromJson(json);
}

// Consolidated Configuration Model
@freezed
class Configuration with _$Configuration {
  const factory Configuration({
    required String id,
    required String scope, // 'global' | 'company' | 'user'
    String? scopeId, // companyId or userId for non-global configs
    required String category, // 'feature' | 'integration' | 'ui' | 'business' | 'system' | 'billing' | 'security'
    required String key,
    required dynamic value,
    required String dataType, // 'string' | 'number' | 'boolean' | 'object' | 'array'
    String? description,
    required bool isPublic, // can be read by client-side code
    required bool isEditable, // can be changed by users
    required bool allowOverride, // can be overridden at lower scopes
    Map<String, dynamic>? validationRules,
    required String modifiedBy,
    required DateTime modifiedAt,
    DateTime? effectiveDate,
    DateTime? expirationDate,
    required DateTime createdAt,
  }) = _Configuration;

  factory Configuration.fromJson(Map<String, dynamic> json) =>
      _$ConfigurationFromJson(json);
}

// Enhanced Error Models
enum ErrorCodes {
  validationError,
  unauthorized,
  forbidden,
  resourceNotFound,
  geofenceViolation,
  businessRuleViolation,
  rateLimitExceeded,
  maintenanceMode,
  internalError,
}

@freezed
class StandardError with _$StandardError {
  const factory StandardError({
    required ErrorCodes code,
    required String message,
    String? field, // for validation errors
    Map<String, dynamic>? context,
    required DateTime timestamp,
    String? requestId,
  }) = _StandardError;

  factory StandardError.fromJson(Map<String, dynamic> json) =>
      _$StandardErrorFromJson(json);
}

@freezed
class ApiResponseMetadata with _$ApiResponseMetadata {
  const factory ApiResponseMetadata({
    required DateTime timestamp,
    required String requestId,
    required String version,
    double? processingTime,
  }) = _ApiResponseMetadata;

  factory ApiResponseMetadata.fromJson(Map<String, dynamic> json) =>
      _$ApiResponseMetadataFromJson(json);
}

@freezed
class ApiPagination with _$ApiPagination {
  const factory ApiPagination({
    required int page,
    required int limit,
    required int total,
    required bool hasNext,
    required bool hasPrev,
  }) = _ApiPagination;

  factory ApiPagination.fromJson(Map<String, dynamic> json) =>
      _$ApiPaginationFromJson(json);
}

@freezed
class ApiResponse<T> with _$ApiResponse<T> {
  const factory ApiResponse({
    required bool success,
    T? data,
    StandardError? error,
    required ApiResponseMetadata metadata,
    ApiPagination? pagination,
  }) = _ApiResponse<T>;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Object?) fromJsonT,
  ) => _$ApiResponseFromJson(json, fromJsonT);
}

// Enhanced Audit Trail
@freezed
class AuditActor with _$AuditActor {
  const factory AuditActor({
    required String userId,
    required String role,
    String? ipAddress,
    String? userAgent,
  }) = _AuditActor;

  factory AuditActor.fromJson(Map<String, dynamic> json) =>
      _$AuditActorFromJson(json);
}

@freezed
class AuditMetadata with _$AuditMetadata {
  const factory AuditMetadata({
    required String source, // 'web' | 'mobile' | 'api' | 'system'
    String? reason,
    String? sessionId,
  }) = _AuditMetadata;

  factory AuditMetadata.fromJson(Map<String, dynamic> json) =>
      _$AuditMetadataFromJson(json);
}

@freezed
class AuditChanges with _$AuditChanges {
  const factory AuditChanges({
    Map<String, dynamic>? before,
    Map<String, dynamic>? after,
  }) = _AuditChanges;

  factory AuditChanges.fromJson(Map<String, dynamic> json) =>
      _$AuditChangesFromJson(json);
}

@freezed
class AuditTrail with _$AuditTrail {
  const factory AuditTrail({
    required String id,
    required String entity, // 'user', 'timeentry', 'company'
    required String entityId,
    required String action, // 'create', 'update', 'delete', 'approve'
    required AuditChanges changes,
    required AuditActor actor,
    required AuditMetadata metadata,
    required DateTime timestamp,
  }) = _AuditTrail;

  factory AuditTrail.fromJson(Map<String, dynamic> json) =>
      _$AuditTrailFromJson(json);
} 