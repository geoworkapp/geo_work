import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Schedule, ScheduleNotification } from '@shared/types';

// Enhanced notification types
export type NotificationEventType = 
  | 'schedule_created' | 'schedule_updated' | 'schedule_cancelled' | 'schedule_reminder'
  | 'conflict_detected' | 'conflict_resolved'
  | 'overtime_alert' | 'break_violation'
  | 'geofence_entry' | 'geofence_exit' | 'location_update'
  | 'timesheet_submitted' | 'timesheet_approved' | 'timesheet_rejected'
  | 'emergency_alert' | 'maintenance_due'
  | 'user_registered' | 'user_updated' | 'user_deactivated'
  | 'company_announcement' | 'system_maintenance';

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in-app' | 'webhook';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationTemplate {
  id: string;
  type: NotificationEventType;
  name: string;
  subject: string;
  bodyTemplate: string;
  variables: string[];
  channels: NotificationChannel[];
  priority: NotificationPriority;
  companyId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  companyId: string;
  channels: {
    [K in NotificationEventType]?: NotificationChannel[];
  };
  eventTypes: {
    [K in NotificationEventType]?: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "07:00"
    timezone: string;
  };
  frequency: {
    immediate: NotificationEventType[];
    digest: NotificationEventType[];
    weekly: NotificationEventType[];
  };
  sound: {
    enabled: boolean;
    urgentOnly: boolean;
  };
  autoMarkRead: {
    enabled: boolean;
    afterMinutes: number;
  };
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  deliveredAt: Date;
  metadata?: Record<string, any>;
}

class NotificationService {
  private templates: Map<NotificationEventType, NotificationTemplate> = new Map();
  private userSubscriptions: Map<string, () => void> = new Map();

  // Initialize default templates
  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    const defaultTemplates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        type: 'schedule_created',
        name: 'New Schedule Assignment',
        subject: 'New Shift Assignment',
        bodyTemplate: 'You have been assigned a new shift at {{jobSiteName}} on {{date}} from {{startTime}} to {{endTime}}.',
        variables: ['jobSiteName', 'date', 'startTime', 'endTime'],
        channels: ['push', 'email'],
        priority: 'medium',
        isActive: true
      },
      {
        type: 'schedule_updated',
        name: 'Schedule Updated',
        subject: 'Shift Schedule Changed',
        bodyTemplate: 'Your shift at {{jobSiteName}} has been updated. New time: {{date}} from {{startTime}} to {{endTime}}.',
        variables: ['jobSiteName', 'date', 'startTime', 'endTime'],
        channels: ['push', 'email'],
        priority: 'high',
        isActive: true
      },
      {
        type: 'schedule_cancelled',
        name: 'Schedule Cancelled',
        subject: 'Shift Cancelled',
        bodyTemplate: 'Your shift at {{jobSiteName}} on {{date}} has been cancelled.',
        variables: ['jobSiteName', 'date'],
        channels: ['push', 'email', 'sms'],
        priority: 'high',
        isActive: true
      },
      {
        type: 'conflict_detected',
        name: 'Schedule Conflict',
        subject: 'Schedule Conflict Detected',
        bodyTemplate: 'A scheduling conflict has been detected: {{conflictMessage}}',
        variables: ['conflictMessage'],
        channels: ['push', 'email'],
        priority: 'urgent',
        isActive: true
      },
      {
        type: 'overtime_alert',
        name: 'Overtime Alert',
        subject: 'Overtime Hours Alert',
        bodyTemplate: 'You are approaching overtime hours. Current total: {{totalHours}} hours.',
        variables: ['totalHours'],
        channels: ['push'],
        priority: 'medium',
        isActive: true
      }
    ];

    defaultTemplates.forEach(template => {
      const fullTemplate: NotificationTemplate = {
        ...template,
        id: template.type,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.templates.set(template.type, fullTemplate);
    });
  }

  // Core notification methods
  async sendNotification(
    type: NotificationEventType,
    recipientIds: string[],
    data: Record<string, any>,
    options?: {
      priority?: NotificationPriority;
      channels?: NotificationChannel[];
      scheduleFor?: Date;
      companyId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string[]> {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Template not found for notification type: ${type}`);
    }

    const { priority = template.priority, channels = template.channels, scheduleFor, metadata } = options || {};
    const activeChannels = await this.getActiveChannelsForUsers(recipientIds, type, channels);
    
    // Create schedule notification
    const notification: Omit<ScheduleNotification, 'notificationId'> = {
      type: this.mapToScheduleNotificationType(type),
      title: template.subject,
      message: this.processTemplate(template.bodyTemplate, data),
      priority,
      channels: activeChannels.filter(ch => ch !== 'webhook') as ('email' | 'push' | 'sms' | 'in-app')[],
      employeeId: recipientIds[0] || '',
      scheduleId: data.schedule?.scheduleId || '',
      deliveryStatus: activeChannels.reduce((status, channel) => ({
        ...status,
        [channel]: 'pending' as const
      }), {} as { [channel: string]: 'pending' | 'sent' | 'delivered' | 'failed' }),
      metadata: {
        scheduleDetails: data.schedule as Partial<Schedule>,
        originalScheduleId: data.originalScheduleId,
        ...metadata
      },
      createdAt: scheduleFor || new Date(),
      scheduledFor: scheduleFor || null
    };

    try {
      // Clean notification data - remove undefined fields recursively
      const cleanNotification = this.cleanUndefinedFields(notification);

      // Save to database
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...cleanNotification,
        timestamp: serverTimestamp()
      });

      // Send through various channels
      const deliveryPromises = activeChannels.map(channel => 
        this.deliverNotification(notification, channel, docRef.id)
      );

      await Promise.allSettled(deliveryPromises);

      return [docRef.id];
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  private mapToScheduleNotificationType(type: NotificationEventType): ScheduleNotification['type'] {
    switch (type) {
      case 'schedule_created':
        return 'shift-assigned';
      case 'schedule_updated':
        return 'shift-updated';
      case 'schedule_cancelled':
        return 'shift-cancelled';
      case 'schedule_reminder':
        return 'shift-reminder';
      case 'conflict_detected':
        return 'schedule-conflict';
      default:
        return 'shift-assigned'; // Default fallback
    }
  }

  // Delivery methods for different channels
  private async deliverNotification(
    notification: Omit<ScheduleNotification, 'notificationId'>,
    channel: NotificationChannel,
    notificationId: string
  ): Promise<NotificationDeliveryResult> {
    try {
      let result: any;

      switch (channel) {
        case 'push':
          result = await this.sendPushNotification(notification, notificationId);
          break;
        case 'email':
          result = await this.sendEmailNotification(notification, notificationId);
          break;
        case 'sms':
          result = await this.sendSMSNotification(notification, notificationId);
          break;
        case 'in-app':
          // In-app notifications are handled by real-time subscription
          result = { success: true, messageId: notificationId };
          break;
        case 'webhook':
          result = await this.sendWebhookNotification(notification, notificationId);
          break;
        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }

      return {
        success: true,
        channel,
        messageId: result.messageId || notificationId,
        deliveredAt: new Date(),
        metadata: result.data as Record<string, any>
      };
    } catch (error) {
      console.error(`Error delivering ${channel} notification:`, error);
      return {
        success: false,
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveredAt: new Date(),
        metadata: {} as Record<string, any>
      };
    }
  }

  private async sendPushNotification(_notification: any, notificationId: string) {
    // Implement push notification logic
    // This would integrate with Firebase Cloud Messaging or similar service
    return { success: true, messageId: notificationId, data: {} };
  }

  private async sendEmailNotification(_notification: any, notificationId: string) {
    // Implement email notification logic
    // This would integrate with SendGrid, AWS SES, or similar service
    return { success: true, messageId: notificationId, data: {} };
  }

  private async sendSMSNotification(_notification: any, notificationId: string) {
    // Implement SMS notification logic
    // This would integrate with Twilio, AWS SNS, or similar service
    return { success: true, messageId: notificationId, data: {} };
  }

  private async sendWebhookNotification(notification: any, notificationId: string) {
    // Implement webhook notification logic
    const webhookUrl = process.env.VITE_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
        type: notification.type,
        message: notification.message,
        timestamp: notification.timestamp,
        metadata: notification.metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.statusText}`);
    }

    return { success: true, messageId: notificationId, data: {} };
  }

  // Helper methods
  private processTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private cleanUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedFields(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          const cleanedValue = this.cleanUndefinedFields(value);
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  private async getActiveChannelsForUsers(
    _userIds: string[],
    _eventType: NotificationEventType,
    requestedChannels: NotificationChannel[]
  ): Promise<NotificationChannel[]> {
    // Get user preferences and filter channels
    // For now, return requested channels
    return requestedChannels;
  }

  // Subscription management
  subscribeToNotifications(
    userId: string,
    callback: (notifications: ScheduleNotification[]) => void
  ): () => void {
    const q = query(
      collection(db, 'notifications'),
      where('recipientIds', 'array-contains', userId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: ScheduleNotification[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          notificationId: doc.id,
          employeeId: data.employeeId || '',
          scheduleId: data.scheduleId || '',
          type: data.type || 'shift-assigned',
          title: data.title || '',
          message: data.message || '',
          priority: data.priority || 'medium',
          channels: data.channels || [],
          deliveryStatus: data.deliveryStatus || {},
          metadata: data.metadata || {},
          createdAt: data.timestamp?.toDate() || data.createdAt?.toDate() || new Date(),
          readAt: data.readAt?.toDate() || undefined,
          sentAt: data.sentAt?.toDate() || undefined,
          scheduledFor: data.scheduledFor?.toDate() || undefined,
          actions: data.actions || []
        } as ScheduleNotification;
      });

      callback(notifications);
    });

    this.userSubscriptions.set(userId, unsubscribe);
    return unsubscribe;
  }

  // User preferences management
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const prefsDoc = await getDocs(query(
      collection(db, 'notificationPreferences'),
      where('userId', '==', userId)
    ));

    if (!prefsDoc.empty) {
      return { ...prefsDoc.docs[0].data(), id: prefsDoc.docs[0].id } as NotificationPreferences;
    }

    // Return default preferences if none exist
    return this.createDefaultPreferences(userId);
  }

  async updateUserPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    const prefsDoc = await getDocs(query(
      collection(db, 'notificationPreferences'),
      where('userId', '==', userId)
    ));

    if (!prefsDoc.empty) {
      await updateDoc(doc(db, 'notificationPreferences', prefsDoc.docs[0].id), {
        ...preferences,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'notificationPreferences'), {
        ...preferences,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }

  private createDefaultPreferences(userId: string): NotificationPreferences {
    return {
      id: '',
      userId,
      companyId: '',
      channels: {},
      eventTypes: {},
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
        timezone: 'UTC'
      },
      frequency: {
        immediate: ['schedule_created', 'schedule_cancelled', 'conflict_detected'],
        digest: ['overtime_alert'],
        weekly: ['schedule_reminder']
      },
      sound: {
        enabled: true,
        urgentOnly: false
      },
      autoMarkRead: {
        enabled: false,
        afterMinutes: 0
      },
      language: 'en',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Notification actions
  async markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notificationId), {
      readAt: serverTimestamp()
    });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notificationId), {
      deletedAt: serverTimestamp()
    });
  }

  // Test and utility methods
  async sendTestNotification(userId: string, type: NotificationEventType, channel: NotificationChannel): Promise<void> {
    await this.sendNotification(
      type,
      [userId],
      {
        jobSiteName: 'Test Site',
        date: new Date().toLocaleDateString(),
        startTime: '09:00',
        endTime: '17:00'
      },
      {
        channels: [channel],
        priority: 'low'
      }
    );
  }

  async sendQuickNotification(params: {
    type: NotificationEventType;
    message: string;
    targetUsers: string[];
    senderId: string;
  }): Promise<void> {
    await this.sendNotification(
      params.type,
      params.targetUsers,
      { message: params.message },
      {
        priority: 'medium',
        channels: ['push', 'in-app']
      }
    );
  }

  // Clean up subscriptions
  cleanup(): void {
    this.userSubscriptions.forEach(unsubscribe => unsubscribe());
    this.userSubscriptions.clear();
  }
}

export const notificationService = new NotificationService(); 