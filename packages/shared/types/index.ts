// Core data models shared between React app and Cloud Functions
// These serve as the source of truth for data structure

export interface UserProfile {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatar?: string;
  department?: string;
  jobTitle?: string;
  startDate?: Date;
  hourlyWage?: number;
}

export interface UserLocale {
  id: string;
  userId: string;
  language: string; // 'en', 'el', 'ru' (English, Greek, Russian)
  country: string; // 'GB', 'GR', 'RU', 'CY', 'US', etc.
  timezone: string; // 'Europe/London', 'Europe/Athens', 'Europe/Moscow'
  currency: string; // 'EUR', 'GBP', 'RUB', 'USD'
  dateFormat: string; // 'dd/MM/yyyy' (EU), 'MM/dd/yyyy' (US)
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 'monday' | 'sunday';
  numberFormat: {
    decimalSeparator: '.' | ',';
    thousandsSeparator: ',' | '.' | ' ';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string; // Standardized from uid
  email: string;
  profile: UserProfile;
  role: 'superadmin' | 'company_admin' | 'manager' | 'employee';
  companyId?: string; // null for superadmin
  locale?: UserLocale;
  isActive: boolean;
  lastLoginAt?: Date;
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

// Simplified and clearer time tracking models
export interface TimeEvent {
  id: string;
  userId: string;
  companyId: string;
  jobSiteId: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  method: 'geofence' | 'manual' | 'admin';
  sessionId?: string; // groups related events
  deviceInfo?: {
    platform: string;
    appVersion: string;
    deviceId: string;
  };
  createdAt: Date;
}

export interface WorkSession {
  id: string;
  userId: string;
  companyId: string;
  jobSiteId: string;
  events: TimeEvent[];
  startTime: Date;
  endTime?: Date;
  totalMinutes?: number;
  breakMinutes?: number;
  status: 'active' | 'completed' | 'disputed';
  createdAt: Date;
  updatedAt: Date;
}

// Legacy TimeEntry interface - DEPRECATED, use TimeEvent instead
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
  id: string;
  userId: string; // Fixed: changed from employeeId to userId
  companyId: string;
  jobSiteId: string;
  workSessionId: string; // References the WorkSession
  startTime: Date;
  endTime: Date;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  breakTime?: number;
  approved: boolean;
  approvedBy?: string;
  notes?: string;
  customFields?: Record<string, any>; // Support for custom company fields
  createdAt: Date;
  updatedAt: Date;
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

// Enhanced Business Logic Models

export interface CompanySettings {
  id: string;
  companyId: string;
  // Work Rules
  standardWorkHours: number; // e.g., 8 hours per day
  overtimeThreshold: number; // hours before overtime kicks in
  overtimeRate: number; // multiplier (e.g., 1.5 for time-and-a-half)
  // Break Policies
  requiredBreakDuration?: number; // minutes
  requiredBreakInterval?: number; // hours before break required
  unpaidBreaks: boolean;
  // Geofencing Rules
  geofenceAccuracy: number; // meters
  minimumTimeAtSite: number; // minutes
  allowClockInEarly: boolean;
  allowClockOutEarly: boolean;
  // Scheduling
  weekStartDay: 'monday' | 'sunday';
  payPeriodType: 'weekly' | 'biweekly' | 'monthly';
  // Compliance
  requireBreakAcknowledgment: boolean;
  dataRetentionDays: number;
  timezoneOffset: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAssignment {
  id: string;
  userId: string; // Fixed: changed from employeeId to userId
  companyId: string;
  jobSiteId: string;
  role?: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  permissions: {
    canEditTimeEntries: boolean;
    canViewReports: boolean;
    canManageOtherUsers: boolean; // Fixed: changed from canManageOtherEmployees
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessRule {
  id: string;
  companyId: string;
  type: 'overtime' | 'break' | 'geofence' | 'validation';
  name: string;
  description: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  companyId: string;
  // Notification Types
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  // Event Triggers
  onClockIn: boolean;
  onClockOut: boolean;
  onMissedClockOut: boolean;
  onOvertimeAlert: boolean;
  onGeofenceError: boolean;
  onTimesheetApproval: boolean;
  // Frequency
  dailySummary: boolean;
  weeklySummary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: string; // 'create', 'update', 'delete', 'approve', 'login', etc.
  resourceType: 'user' | 'company' | 'jobsite' | 'timeentry' | 'settings';
  resourceId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface Subscription {
  id: string;
  companyId: string;
  planType: 'basic' | 'professional' | 'enterprise';
  employeeLimit: number;
  features: string[];
  monthlyPrice: number;
  status: 'active' | 'suspended' | 'cancelled';
  billingEmail: string;
  startDate: Date;
  endDate?: Date;
  trialEndDate?: Date;
  paymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Integration {
  id: string;
  companyId: string;
  type: 'payroll' | 'hr' | 'accounting';
  provider: 'quickbooks' | 'adp' | 'paychex' | 'workday' | 'bamboohr';
  credentials: Record<string, string>; // encrypted
  settings: Record<string, any>;
  isActive: boolean;
  lastSyncDate?: Date;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  companyId: string;
  employeeId?: string;
  type: 'overtime' | 'missed_clockout' | 'geofence_error' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// Extensibility & Future-Proof Architecture Models

export interface SystemConfiguration {
  id: string;
  companyId?: string; // null for global settings
  category: 'feature' | 'integration' | 'ui' | 'business' | 'system';
  key: string;
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  isPublic: boolean; // can be read by client-side code
  isEditable: boolean; // can be changed by admins
  validationRules?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomField {
  id: string;
  companyId: string;
  entityType: 'user' | 'jobsite' | 'timeentry' | 'shift';
  fieldName: string;
  displayName: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  options?: string[]; // for select/multiselect fields
  isRequired: boolean;
  defaultValue?: any;
  validationRules?: Record<string, any>;
  isActive: boolean;
  sortOrder: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomFieldValue {
  id: string;
  companyId: string;
  fieldId: string;
  entityType: string;
  entityId: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  companyId?: string; // null for system permissions
  name: string;
  description: string;
  category: 'user' | 'company' | 'jobsite' | 'timeentry' | 'report' | 'integration' | 'system';
  action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export' | 'admin';
  resource?: string; // specific resource if applicable
  conditions?: Record<string, any>; // dynamic conditions
  isSystem: boolean; // can't be deleted/modified
  createdAt: Date;
}

export interface Role {
  id: string;
  companyId?: string; // null for system roles
  name: string;
  description: string;
  permissions: string[]; // permission IDs
  isSystem: boolean;
  inheritsFrom?: string[]; // role IDs to inherit permissions from
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  companyId: string;
  roleId: string;
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface SystemEvent {
  id: string;
  companyId?: string;
  eventType: string; // 'user.created', 'timeentry.approved', 'geofence.entered', etc.
  source: 'mobile' | 'web' | 'api' | 'system';
  userId?: string;
  entityType?: string;
  entityId?: string;
  data: Record<string, any>;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
    version?: string;
  };
  timestamp: Date;
  processed: boolean;
  processedAt?: Date;
  retryCount: number;
}

export interface EventHandler {
  id: string;
  companyId?: string; // null for system handlers
  name: string;
  eventTypes: string[]; // which events trigger this handler
  handlerType: 'webhook' | 'function' | 'notification' | 'integration';
  configuration: Record<string, any>;
  isActive: boolean;
  priority: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackgroundJob {
  id: string;
  companyId?: string;
  type: string; // 'report.generate', 'integration.sync', 'notification.send', etc.
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'critical';
  data: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  progress?: number; // 0-100
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  createdBy?: string;
  createdAt: Date;
}

export interface ApiVersion {
  version: string; // e.g., "v1", "v2"
  isActive: boolean;
  isDeprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  supportedEndpoints: string[];
  migrationGuide?: string;
  createdAt: Date;
}

export interface CacheEntry {
  key: string;
  companyId?: string;
  data: any;
  ttl: number; // seconds
  tags: string[]; // for cache invalidation
  createdAt: Date;
  expiresAt: Date;
}

// Super Admin / Platform Owner Models

export interface PlatformAnalytics {
  id: string;
  date: Date;
  metrics: {
    // Business Metrics
    totalCompanies: number;
    activeCompanies: number;
    totalEmployees: number;
    activeEmployees: number;
    totalTimeEntries: number;
    // Revenue Metrics
    monthlyRecurringRevenue: number;
    annualRecurringRevenue: number;
    customerLifetimeValue: number;
    churnRate: number;
    // Usage Metrics
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    averageSessionDuration: number;
    geofenceAccuracy: number;
    // System Metrics
    systemUptime: number;
    averageResponseTime: number;
    errorRate: number;
    apiCallsPerDay: number;
  };
  trends: {
    userGrowthRate: number;
    revenueGrowthRate: number;
    churnTrend: number;
    usageGrowthRate: number;
  };
  createdAt: Date;
}

export interface CustomerMetrics {
  id: string;
  companyId: string;
  date: Date;
  metrics: {
    // Usage Metrics
    employeeCount: number;
    activeEmployees: number;
    timeEntriesCount: number;
    geofenceEvents: number;
    reportGenerations: number;
    integrationUsage: number;
    // Health Metrics
    loginFrequency: number;
    featureAdoptionRate: number;
    supportTicketsCount: number;
    lastActivityDate: Date;
    // Billing Metrics
    subscriptionPlan: string;
    monthlyRevenue: number;
    paymentStatus: 'current' | 'overdue' | 'failed';
    contractEndDate?: Date;
  };
  healthScore: number; // 0-100
  churnRisk: 'low' | 'medium' | 'high';
  createdAt: Date;
}

export interface SystemHealth {
  id: string;
  timestamp: Date;
  services: {
    firestore: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      errorRate: number;
    };
    functions: {
      status: 'healthy' | 'degraded' | 'down';
      coldStarts: number;
      averageExecutionTime: number;
      errorCount: number;
    };
    hosting: {
      status: 'healthy' | 'degraded' | 'down';
      uptime: number;
      loadTime: number;
    };
    storage: {
      status: 'healthy' | 'degraded' | 'down';
      usage: number;
      transferSpeed: number;
    };
  };
  overallHealth: 'healthy' | 'degraded' | 'critical';
  alerts: string[];
}

export interface SupportTicket {
  id: string;
  companyId: string;
  userId: string;
  type: 'bug' | 'feature_request' | 'help' | 'billing' | 'technical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  subject: string;
  description: string;
  category: string;
  tags: string[];
  assignedTo?: string;
  customerSatisfactionRating?: number; // 1-5
  resolutionTime?: number; // minutes
  firstResponseTime?: number; // minutes
  metadata: {
    browserInfo?: string;
    deviceInfo?: string;
    appVersion?: string;
    errorLogs?: string[];
    attachments?: string[];
  };
  conversation: {
    id: string;
    authorId: string;
    authorType: 'customer' | 'support' | 'system';
    message: string;
    timestamp: Date;
    isInternal: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface BusinessMetrics {
  id: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  revenue: {
    totalRevenue: number;
    newRevenue: number;
    expansion: number;
    contraction: number;
    churn: number;
    netRevenue: number;
  };
  customers: {
    newCustomers: number;
    churnedCustomers: number;
    totalCustomers: number;
    customerGrowthRate: number;
  };
  usage: {
    totalTimeEntries: number;
    totalGeofenceEvents: number;
    averageEmployeesPerCompany: number;
    featureUsageStats: Record<string, number>;
  };
  costs: {
    infrastructureCosts: number;
    supportCosts: number;
    acquisitionCosts: number;
    totalCosts: number;
  };
  profitability: {
    grossMargin: number;
    netMargin: number;
    customerAcquisitionCost: number;
    customerLifetimeValue: number;
    paybackPeriod: number;
  };
  createdAt: Date;
}

export interface ComplianceAudit {
  id: string;
  type: 'gdpr' | 'ccpa' | 'sox' | 'security' | 'data_retention';
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed';
  scope: string[];
  auditor?: string;
  findings: {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    evidence?: string[];
    remediation?: string;
    status: 'open' | 'in_progress' | 'resolved';
    dueDate?: Date;
  }[];
  recommendations: string[];
  overallScore?: number; // 0-100
  nextAuditDate?: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface FinancialReport {
  id: string;
  reportType: 'revenue' | 'churn' | 'cohort' | 'ltv' | 'cac' | 'mrr_movement';
  period: {
    startDate: Date;
    endDate: Date;
    granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  };
  data: Record<string, any>;
  visualizations: {
    chartType: 'line' | 'bar' | 'pie' | 'table' | 'funnel';
    config: Record<string, any>;
  }[];
  insights: string[];
  recommendations: string[];
  generatedBy: string;
  isScheduled: boolean;
  recipientEmails: string[];
  createdAt: Date;
}

export interface PlatformConfiguration {
  id: string;
  category: 'billing' | 'features' | 'limits' | 'maintenance' | 'security';
  key: string;
  value: any;
  description: string;
  isGlobal: boolean; // affects all companies
  allowCompanyOverride: boolean;
  validationRules: Record<string, any>;
  modifiedBy: string;
  modifiedAt: Date;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface CustomerSuccessActivity {
  id: string;
  companyId: string;
  activityType: 'onboarding' | 'training' | 'check_in' | 'renewal' | 'expansion' | 'support';
  status: 'scheduled' | 'completed' | 'cancelled' | 'overdue';
  assignedTo: string;
  subject: string;
  description?: string;
  outcome?: string;
  nextSteps?: string;
  dueDate?: Date;
  completedAt?: Date;
  customerFeedback?: {
    satisfaction: number; // 1-5
    comments?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Internationalization (i18n) Models

export interface Translation {
  id: string;
  key: string; // 'dashboard.welcome', 'errors.invalidEmail'
  namespace: string; // 'common', 'dashboard', 'mobile'
  translations: {
    [languageCode: string]: {
      value: string;
      context?: string;
      pluralForms?: Record<string, string>;
      lastModified: Date;
      translator?: string;
      reviewStatus: 'pending' | 'approved' | 'rejected';
    };
  };
  variables?: string[]; // ['userName', 'count']
  description?: string;
  isPlural: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalizedContent {
  id: string;
  contentType: 'email_template' | 'notification' | 'help_article' | 'legal_document';
  baseLanguage: string; // 'en'
  versions: {
    [languageCode: string]: {
      content: string;
      metadata: {
        title?: string;
        description?: string;
        keywords?: string[];
      };
      status: 'draft' | 'published' | 'archived';
      lastModified: Date;
      reviewer?: string;
    };
  };
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RegionalSettings {
  id: string;
  region: string; // 'western_europe', 'eastern_europe', 'uk_ireland'
  countries: string[]; // ['GB', 'GR', 'RU', 'CY', 'IE']
  supportedLanguages: string[]; // ['en', 'el', 'ru']
  defaultCurrency: string;
  taxConfiguration: {
    vatApplicable: boolean;
    vatRates: Record<string, number>; // Standard, reduced, zero rates
    taxRegistrationRequired: boolean;
  };
  legalRequirements: {
    dataResidency: boolean;
    gdprCompliance: boolean;
    localDataProtection: string[]; // Additional local requirements
    workingTimeDirectives: boolean;
  };
  businessHours: {
    timezone: string;
    schedule: Record<string, { open: string; close: string }>;
    publicHolidays: string[]; // ISO date strings
  };
  supportChannels: {
    email: string;
    phone?: string;
    chat: boolean;
    supportLanguages: string[]; // Languages for customer support
  };
  createdAt: Date;
  updatedAt: Date;
}

// Consolidated Configuration Model (replaces multiple config interfaces)
export interface Configuration {
  id: string;
  scope: 'global' | 'company' | 'user';
  scopeId?: string; // companyId or userId for non-global configs
  category: 'feature' | 'integration' | 'ui' | 'business' | 'system' | 'billing' | 'security';
  key: string;
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  isPublic: boolean; // can be read by client-side code
  isEditable: boolean; // can be changed by users
  allowOverride: boolean; // can be overridden at lower scopes
  validationRules?: Record<string, any>;
  modifiedBy: string;
  modifiedAt: Date;
  effectiveDate?: Date;
  expirationDate?: Date;
  createdAt: Date;
}

// Enhanced Error Handling
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  GEOFENCE_VIOLATION: 'GEOFENCE_VIOLATION',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface StandardError {
  code: ErrorCode;
  message: string;
  field?: string; // for validation errors
  context?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: StandardError;
  metadata: {
    timestamp: Date;
    requestId: string;
    version: string;
    processingTime?: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Enhanced Audit Trail
export interface AuditTrail {
  id: string;
  entity: string; // 'user', 'timeentry', 'company'
  entityId: string;
  action: string; // 'create', 'update', 'delete', 'approve'
  changes: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  actor: {
    userId: string;
    role: string;
    ipAddress?: string;
    userAgent?: string;
  };
  metadata: {
    source: 'web' | 'mobile' | 'api' | 'system';
    reason?: string;
    sessionId?: string;
  };
  timestamp: Date;
} 