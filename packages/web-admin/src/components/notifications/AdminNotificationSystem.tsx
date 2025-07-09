import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Typography,
  Button,
  Chip,
  Divider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,

  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as OvertimeIcon,
  PersonOff as NoShowIcon,
  Build as SystemIcon,
  CheckCircle as ResolvedIcon,
  Settings as SettingsIcon,
  Clear as ClearIcon,
  MarkAsUnread as UnreadIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  CheckCircle,
} from '@mui/icons-material';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
 
  Timestamp,
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';

interface AdminNotification {
  id: string;
  type: 'compliance_violation' | 'overtime_alert' | 'system_error' | 'no_show' | 'session_stuck' | 'geofence_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  details?: any;
  relatedSessionId?: string;
  relatedEmployeeId?: string;
  employeeName?: string;
  jobSiteName?: string;
  createdAt: Date;
  isRead: boolean;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  actionTaken?: string;
  companyId: string;
}

interface NotificationSettings {
  enableRealTimeAlerts: boolean;
  enableEmailAlerts: boolean;
  enableDesktopNotifications: boolean;
  severityFilter: string[];
  autoResolveMinor: boolean;
  escalationThreshold: number;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

const AdminNotificationSystem: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enableRealTimeAlerts: true,
    enableEmailAlerts: false,
    enableDesktopNotifications: true,
    severityFilter: ['medium', 'high', 'critical'],
    autoResolveMinor: true,
    escalationThreshold: 5,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '06:00',
    },
  });
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // ============================================================================
  // REAL-TIME NOTIFICATION LISTENER
  // ============================================================================

  useEffect(() => {
    if (!currentUser?.companyId) return;

    const notificationsQuery = query(
      collection(db, 'adminNotifications'),
      where('companyId', '==', currentUser.companyId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          resolvedAt: doc.data().resolvedAt?.toDate(),
        })) as AdminNotification[];

        setNotifications(notificationsData);
        
        // Show browser notification for new critical alerts
        const newCriticalNotifications = notificationsData.filter(n => 
          n.severity === 'critical' && 
          !n.isRead && 
          n.createdAt.getTime() > Date.now() - 30000 // Last 30 seconds
        );

        newCriticalNotifications.forEach(notification => {
          showBrowserNotification(notification);
        });
      },
      (error) => {
        console.error('Error fetching notifications:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.companyId]);

  // ============================================================================
  // BROWSER NOTIFICATIONS
  // ============================================================================

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  const showBrowserNotification = useCallback(async (notification: AdminNotification) => {
    if (!notificationSettings.enableDesktopNotifications) return;
    
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    // Check quiet hours
    if (notificationSettings.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = parseInt(notificationSettings.quietHours.start.replace(':', ''));
      const endTime = parseInt(notificationSettings.quietHours.end.replace(':', ''));
      
      if (startTime > endTime) {
        // Overnight quiet hours
        if (currentTime >= startTime || currentTime <= endTime) return;
      } else {
        // Same day quiet hours
        if (currentTime >= startTime && currentTime <= endTime) return;
      }
    }

    const notif = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      badge: '/notification-badge.png',
      tag: notification.id,
      requireInteraction: notification.severity === 'critical',
    });

    notif.onclick = () => {
      window.focus();
      setAnchorEl(document.querySelector('#notification-button') as HTMLButtonElement);
      notif.close();
    };

    // Auto-close after 10 seconds unless critical
    if (notification.severity !== 'critical') {
      setTimeout(() => notif.close(), 10000);
    }
  }, [notificationSettings, requestNotificationPermission]);

  // ============================================================================
  // NOTIFICATION MANAGEMENT
  // ============================================================================

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'adminNotifications', notificationId), {
        isRead: true,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAsResolved = async (notificationId: string, actionTaken?: string) => {
    try {
      await updateDoc(doc(db, 'adminNotifications', notificationId), {
        isResolved: true,
        resolvedBy: currentUser?.uid || 'unknown',
        resolvedAt: Timestamp.fromDate(new Date()),
        actionTaken: actionTaken || 'Manually resolved by admin',
      });
      
      setSnackbarMessage('Notification resolved successfully');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error resolving notification:', error);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      const promises = unreadNotifications.map(n => 
        updateDoc(doc(db, 'adminNotifications', n.id), { isRead: true })
      );
      
      await Promise.all(promises);
      setSnackbarMessage('All notifications marked as read');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearResolved = async () => {
    setLoading(true);
    try {
      const resolvedNotifications = notifications.filter(n => n.isResolved);
      const promises = resolvedNotifications.map(n => 
        deleteDoc(doc(db, 'adminNotifications', n.id))
      );
      
      await Promise.all(promises);
      setSnackbarMessage('Resolved notifications cleared');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error clearing resolved notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // FILTERING & CATEGORIZATION
  // ============================================================================

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const activeNotifications = notifications.filter(n => !n.isResolved);
  const resolvedNotifications = notifications.filter(n => n.isResolved);

  const criticalNotifications = notifications.filter(n => n.severity === 'critical' && !n.isResolved);
  const highNotifications = notifications.filter(n => n.severity === 'high' && !n.isResolved);

  const getNotificationsByTab = () => {
    switch (selectedTab) {
      case 0: return activeNotifications;
      case 1: return criticalNotifications.concat(highNotifications);
      case 2: return resolvedNotifications;
      default: return notifications;
    }
  };

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  const getNotificationIcon = (type: string, severity: string) => {
    const color = getSeverityColor(severity);
    
    switch (type) {
      case 'compliance_violation':
        return <WarningIcon sx={{ color }} />;
      case 'overtime_alert':
        return <OvertimeIcon sx={{ color }} />;
      case 'no_show':
        return <NoShowIcon sx={{ color }} />;
      case 'system_error':
      case 'session_stuck':
        return <SystemIcon sx={{ color }} />;
      case 'geofence_violation':
        return <ErrorIcon sx={{ color }} />;
      default:
        return <NotificationsIcon sx={{ color }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#ff5722';
      case 'low': return '#2196f3';
      default: return '#757575';
    }
  };

  const getSeverityChip = (severity: string) => {
    const color = severity === 'critical' || severity === 'high' ? 'error' : 
                  severity === 'medium' ? 'warning' : 'info';
    
    return (
      <Chip
        label={severity.toUpperCase()}
        size="small"
        color={color}
        variant="outlined"
      />
    );
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Notification Button */}
      <IconButton
        id="notification-button"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ 
          color: unreadNotifications.length > 0 ? 'error.main' : 'inherit',
          animation: criticalNotifications.length > 0 ? 'pulse 2s infinite' : 'none',
        }}
      >
        <Badge
          badgeContent={unreadNotifications.length}
          color={criticalNotifications.length > 0 ? 'error' : 'primary'}
          max={99}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>

      {/* Notification Popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 400, maxHeight: 600 }
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="div">
              Notifications
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => setSettingsOpen(true)}
                title="Notification Settings"
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setAnchorEl(null)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Tabs */}
          <Tabs
            value={selectedTab}
            onChange={(_, newValue) => setSelectedTab(newValue)}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab 
              label={
                <Badge badgeContent={activeNotifications.length} color="primary">
                  Active
                </Badge>
              } 
            />
            <Tab 
              label={
                <Badge badgeContent={criticalNotifications.length + highNotifications.length} color="error">
                  Priority
                </Badge>
              } 
            />
            <Tab label="Resolved" />
          </Tabs>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              size="small"
              startIcon={loading ? <CircularProgress size={16} /> : <UnreadIcon />}
              onClick={markAllAsRead}
              disabled={loading || unreadNotifications.length === 0}
            >
              Mark All Read
            </Button>
            
            {selectedTab === 2 && (
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={clearResolved}
                disabled={loading || resolvedNotifications.length === 0}
              >
                Clear
              </Button>
            )}
          </Box>

          {/* Notifications List */}
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {getNotificationsByTab().length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No notifications"
                  secondary={selectedTab === 0 ? "All caught up!" : "No notifications in this category"}
                />
              </ListItem>
            ) : (
              getNotificationsByTab().map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                      borderLeft: `4px solid ${getSeverityColor(notification.severity)}`,
                    }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type, notification.severity)}
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={notification.isRead ? 'normal' : 'bold'}>
                            {notification.title}
                          </Typography>
                          {getSeverityChip(notification.severity)}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          
                          {notification.employeeName && (
                            <Typography variant="caption" color="textSecondary">
                              Employee: {notification.employeeName}
                            </Typography>
                          )}
                          
                          {notification.jobSiteName && (
                            <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                              Site: {notification.jobSiteName}
                            </Typography>
                          )}
                          
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                            {formatTimeAgo(notification.createdAt)}
                          </Typography>
                          
                          {notification.isResolved && (
                            <Chip
                              icon={<ResolvedIcon />}
                              label="Resolved"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                      }
                    />
                    
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {!notification.isRead && (
                          <IconButton
                            size="small"
                            onClick={() => markAsRead(notification.id)}
                            title="Mark as Read"
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        )}
                        
                        {!notification.isResolved && (
                          <IconButton
                            size="small"
                            onClick={() => markAsResolved(notification.id)}
                            title="Mark as Resolved"
                          >
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  {index < getNotificationsByTab().length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>

          {/* View All Button */}
          {getNotificationsByTab().length > 0 && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button variant="outlined" fullWidth>
                View All Notifications
              </Button>
            </Box>
          )}
        </Box>
      </Popover>

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Notification Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.enableRealTimeAlerts}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    enableRealTimeAlerts: e.target.checked
                  }))}
                />
              }
              label="Enable Real-time Alerts"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.enableDesktopNotifications}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    enableDesktopNotifications: e.target.checked
                  }))}
                />
              }
              label="Enable Desktop Notifications"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.enableEmailAlerts}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    enableEmailAlerts: e.target.checked
                  }))}
                />
              }
              label="Enable Email Alerts"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.autoResolveMinor}
                  onChange={(e) => setNotificationSettings(prev => ({
                    ...prev,
                    autoResolveMinor: e.target.checked
                  }))}
                />
              }
              label="Auto-resolve Minor Issues"
            />
            
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2, mb: 1 }}>
              Notification Preferences
            </Typography>
            
            <Alert severity="info">
              Critical and high-priority notifications will always be shown.
              Desktop notifications require browser permission.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => setSettingsOpen(false)}>
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />

      {/* CSS for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </>
  );
};

export default AdminNotificationSystem; 