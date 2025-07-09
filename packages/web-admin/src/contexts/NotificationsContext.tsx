import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { notificationService } from '../services/notificationService';
import type { 
  ScheduleNotification
} from '@shared/types';
import type { NotificationPreferences } from '../services/notificationService';

// Local types for notification service
type NotificationEventType = 
  | 'schedule_created' | 'schedule_updated' | 'schedule_cancelled' | 'schedule_reminder'
  | 'conflict_detected' | 'conflict_resolved'
  | 'overtime_alert' | 'break_violation'
  | 'geofence_entry' | 'geofence_exit' | 'location_update'
  | 'timesheet_submitted' | 'timesheet_approved' | 'timesheet_rejected'
  | 'emergency_alert' | 'maintenance_due'
  | 'user_registered' | 'user_updated' | 'user_deactivated'
  | 'company_announcement' | 'system_maintenance';

type NotificationChannel = 'push' | 'email' | 'sms' | 'in-app';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  // Notification state
  notifications: ScheduleNotification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  
  // Notification actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  
  // Preferences
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  testNotification: (type: NotificationEventType, channel: NotificationChannel) => Promise<void>;
  
  // Quick actions
  sendQuickNotification: (type: NotificationEventType, message: string, targetUsers?: string[]) => Promise<void>;
  
  // State
  loading: boolean;
  error: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
  enableRealTime?: boolean;
}

export function NotificationProvider({ 
  children, 
  enableRealTime = true 
}: NotificationProviderProps) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<ScheduleNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user preferences
  useEffect(() => {
    if (!currentUser?.uid) {
      return;
    }

    const loadPreferences = async () => {
      try {
        const userPrefs = await notificationService.getUserPreferences(currentUser.uid);
        setPreferences(userPrefs);
      } catch (err) {
        console.error('Error loading notification preferences:', err);
        // Set up real-time subscription for notifications
        const unsubscribe = notificationService.subscribeToNotifications(
          currentUser.uid,
          (newNotifications) => {
            setNotifications(newNotifications);
            setLoading(false);
          }
        );
        return () => unsubscribe && unsubscribe();
      }
    };

    loadPreferences();
  }, [currentUser?.uid, enableRealTime]);

  // Set up real-time notification subscription
  useEffect(() => {
    if (!currentUser?.uid || !enableRealTime) return;

    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      try {
        unsubscribe = notificationService.subscribeToNotifications(
          currentUser.uid,
          (newNotifications) => {
            setNotifications(newNotifications);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up notification subscription:', err);
        setError('Failed to connect to notifications');
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser?.uid, enableRealTime]);

  // Auto-save preferences when changed
  useEffect(() => {
    if (!currentUser?.uid || !preferences) return;

    const savePreferences = async () => {
      try {
        await notificationService.updateUserPreferences(
          currentUser.uid,
          preferences
        );
      } catch (err) {
        console.error('Error saving notification preferences:', err);
      }
    };

    // Debounce preference saves
    const timeoutId = setTimeout(savePreferences, 1000);
    return () => clearTimeout(timeoutId);
  }, [currentUser?.uid, preferences]);

  // Set up background sync for offline notifications
  useEffect(() => {
    if (!currentUser?.uid) return;

    const syncNotifications = async () => {
      try {
        const unsubscribe = notificationService.subscribeToNotifications(
          currentUser.uid,
          (newNotifications) => {
            setNotifications(prev => {
              // Merge and deduplicate notifications
              const merged = [...prev];
              newNotifications.forEach(notification => {
                const existingIndex = merged.findIndex(n => n.notificationId === notification.notificationId);
                if (existingIndex >= 0) {
                  merged[existingIndex] = notification;
                } else {
                  merged.push(notification);
                }
              });
              return merged.sort((a, b) => {
                const aTime = a.createdAt || new Date();
                const bTime = b.createdAt || new Date();
                return bTime.getTime() - aTime.getTime();
              });
            });
          }
        );

        return unsubscribe;
      } catch (err) {
        console.error('Error syncing notifications:', err);
        return undefined;
      }
    };

    const syncPromise = syncNotifications();
    return () => {
      syncPromise.then(unsubscribe => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, [currentUser?.uid]);

  // Actions
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.notificationId === notificationId 
            ? { ...n, readAt: new Date() }
            : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Failed to mark notification as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      const unreadNotifications = notifications.filter(n => !n.readAt);
      await Promise.all(
        unreadNotifications.map(n => notificationService.markAsRead(n.notificationId))
      );
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, readAt: n.readAt || new Date() }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Failed to mark all notifications as read');
    }
  }, [notifications, currentUser?.uid]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
    }
  }, []);

  const clearAll = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      await Promise.all(
        notifications.map(n => notificationService.deleteNotification(n.notificationId))
      );
      setNotifications([]);
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      setError('Failed to clear all notifications');
    }
  }, [notifications, currentUser?.uid]);

  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!currentUser?.uid) return;

    try {
      const updatedPreferences = { ...preferences, ...newPreferences } as NotificationPreferences;
      await notificationService.updateUserPreferences(currentUser.uid, updatedPreferences);
      setPreferences(updatedPreferences);
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      setError('Failed to update notification preferences');
    }
  }, [preferences, currentUser?.uid]);

  const testNotification = useCallback(async (type: NotificationEventType, channel: NotificationChannel) => {
    if (!currentUser?.uid) return;

    try {
      await notificationService.sendTestNotification(currentUser.uid, type, channel);
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError('Failed to send test notification');
    }
  }, [currentUser?.uid]);

  const sendQuickNotification = useCallback(async (
    type: NotificationEventType, 
    message: string, 
    targetUsers?: string[]
  ) => {
    if (!currentUser?.uid) return;

    try {
      await notificationService.sendQuickNotification({
        type,
        message,
        targetUsers: targetUsers || [currentUser.uid],
        senderId: currentUser.uid
      });
    } catch (err) {
      console.error('Error sending quick notification:', err);
      setError('Failed to send notification');
    }
  }, [currentUser?.uid]);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    preferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    updatePreferences,
    testNotification,
    sendQuickNotification,
    loading,
    error
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Custom hooks for specific notification features
export function useScheduleNotifications() {
  const { notifications } = useNotifications();
  return notifications.filter(n => n.type.includes('shift') || n.type.includes('schedule'));
}

export function useNotificationPreferences() {
  const { preferences, updatePreferences } = useNotifications();
  return { preferences, updatePreferences };
}

export function useNotificationState() {
  const { loading, error } = useNotifications();
  return { loading, error };
} 