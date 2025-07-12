import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Popover,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Divider,
  Button,
  Fade,
  Badge,
  useTheme,
  alpha,
  Card,
  CardContent,

} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckCircleIcon,
  MarkEmailRead as MarkReadIcon,
  Settings as SettingsIcon,

} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';

import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notificationService';
import type { ScheduleNotification } from '@shared/types';

interface RealTimeNotificationsProps {
  maxNotifications?: number;
}

const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({
  maxNotifications = 50,
}) => {
  const { currentUser } = useAuth();
  const theme = useTheme();

  // State
  const [notifications, setNotifications] = useState<ScheduleNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const open = Boolean(anchorEl);
  const unreadCount = notifications.filter(n => !n.readAt).length;

  // Initialize notification subscription
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = notificationService.subscribeToNotifications(
      currentUser.companyId || '',
      (newNotifications: ScheduleNotification[]) => {
        // Filter notifications for current user
        const userNotifications = newNotifications.filter((n: ScheduleNotification) => 
          n.employeeId === currentUser.uid
        );
        
        // Sort by creation date (newest first)
        const sortedNotifications = userNotifications.sort((a: ScheduleNotification, b: ScheduleNotification) => {
          const aTime = a.createdAt || new Date();
          const bTime = b.createdAt || new Date();
          return bTime.getTime() - aTime.getTime();
        });

        const limitedNotifications = sortedNotifications.slice(0, maxNotifications);
        setNotifications(limitedNotifications);
        setLoading(false);

        // Check for new notifications
        const hasNew = limitedNotifications.some(n => !n.readAt);
        setHasNewNotifications(hasNew);

        // Show toast for new high-priority notifications
        userNotifications.forEach((notification: ScheduleNotification) => {
          if (notification.priority === 'high' || notification.priority === 'urgent') {
            showToast(notification);
          }
        });
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.uid, currentUser?.companyId, maxNotifications]);

  // Show toast notification
  const showToast = (notification: ScheduleNotification) => {
    const toastContent = (
      <Box>
        <Typography variant="subtitle2">{notification.title}</Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {notification.message}
        </Typography>
      </Box>
    );

    if (notification.priority === 'urgent') {
      toast.error(toastContent);
    } else if (notification.priority === 'high') {
      toast.warning(toastContent);
    } else {
      toast.info(toastContent);
    }
  };

  // Get notification icon and color
  const getNotificationIcon = (type: ScheduleNotification['type'], priority: ScheduleNotification['priority']) => {
    const getColor = () => {
      if (priority === 'urgent') return theme.palette.error.main;
      if (priority === 'high') return theme.palette.warning.main;
      return theme.palette.primary.main;
    };

    const iconProps = { 
      sx: { 
        fontSize: 20, 
        color: getColor()
      } 
    };
    
    switch (type) {
      case 'shift-assigned':
      case 'shift-updated':
        return <ScheduleIcon {...iconProps} />;
      case 'shift-cancelled':
        return <ErrorIcon {...iconProps} />;
      case 'shift-reminder':
        return <TimeIcon {...iconProps} />;
      case 'schedule-conflict':
        return <WarningIcon {...iconProps} />;
      default:
        return <InfoIcon {...iconProps} />;
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: ScheduleNotification) => {
    try {
      // Mark as read if needed (when the method exists)
      // await notificationService.markNotificationAsRead(notification.notificationId);
      
      // Handle notification actions
      if (notification.actions && notification.actions.length > 0) {
        const primaryAction = notification.actions[0];
        if (primaryAction.url) {
          window.location.href = primaryAction.url;
        }
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  // Handle bell icon click
  const handleBellClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setHasNewNotifications(false); // Reset the pulse animation
  };

  // Handle popover close
  const handleClose = () => {
    setAnchorEl(null);
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      // Implementation when service method exists
      // await notificationService.markAllAsRead(currentUser?.uid);
      console.log('Mark all as read clicked');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Get priority chip props
  const getPriorityChipProps = (priority: ScheduleNotification['priority']) => {
    switch (priority) {
      case 'urgent':
        return { 
          color: 'error' as const, 
          variant: 'filled' as const,
          sx: { fontWeight: 600 }
        };
      case 'high':
        return { 
          color: 'warning' as const, 
          variant: 'filled' as const,
          sx: { fontWeight: 600 }
        };
      case 'medium':
        return { 
          color: 'primary' as const, 
          variant: 'outlined' as const 
        };
      default:
        return { 
          color: 'default' as const, 
          variant: 'outlined' as const 
        };
    }
  };

  // Render notification item
  const renderNotification = (notification: ScheduleNotification, index: number) => {
    const isUnread = !notification.readAt;
    const timeAgo = notification.createdAt 
      ? formatDistanceToNow(notification.createdAt, { addSuffix: true })
      : 'Unknown time';

    return (
      <React.Fragment key={notification.notificationId}>
        <ListItem
          onClick={() => handleNotificationClick(notification)}
          sx={{
            py: 1.5,
            px: 2,
            cursor: 'pointer',
            position: 'relative',
            '&:hover': { 
              bgcolor: alpha(theme.palette.primary.main, 0.04)
            },
            '&:before': isUnread ? {
              content: '""',
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: theme.palette.primary.main,
            } : {}
          }}
        >
          <ListItemAvatar>
            <Avatar
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                width: 40,
                height: 40,
              }}
            >
              {getNotificationIcon(notification.type, notification.priority)}
            </Avatar>
          </ListItemAvatar>
          
          <ListItemText
            sx={{ ml: isUnread ? 1 : 0 }}
            primary={
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: isUnread ? 600 : 500,
                    flex: 1,
                    lineHeight: 1.4
                  }}
                >
                  {notification.title}
                </Typography>
                <Chip
                  label={notification.priority.toUpperCase()}
                  size="small"
                  {...getPriorityChipProps(notification.priority)}
                  sx={{ 
                    fontSize: '0.625rem', 
                    height: 18,
                    '& .MuiChip-label': { px: 0.75 }
                  }}
                />
              </Box>
            }
            secondary={
              <Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mb: 0.5,
                    color: 'text.secondary',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {notification.message}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: isUnread ? theme.palette.primary.main : 'text.disabled',
                    fontWeight: isUnread ? 500 : 400
                  }}
                >
                  {timeAgo}
                </Typography>
              </Box>
            }
          />
        </ListItem>
        {index < notifications.length - 1 && <Divider variant="middle" />}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* Notification Bell Icon */}
      <IconButton
        onClick={handleBellClick}
        sx={{
          color: 'inherit',
          position: 'relative',
          '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.1)
          }
        }}
      >
        <Badge 
          badgeContent={unreadCount} 
          color="error"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              animation: hasNewNotifications ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': {
                  transform: 'scale(1)',
                },
                '50%': {
                  transform: 'scale(1.2)',
                },
                '100%': {
                  transform: 'scale(1)',
                },
              },
            }
          }}
        >
          {unreadCount > 0 ? (
            <NotificationsIcon 
              sx={{ 
                fontSize: 24,
                animation: hasNewNotifications ? 'bell-ring 1s ease-in-out' : 'none',
                '@keyframes bell-ring': {
                  '0%, 100%': { transform: 'rotate(0deg)' },
                  '10%, 30%, 50%, 70%, 90%': { transform: 'rotate(-10deg)' },
                  '20%, 40%, 60%, 80%': { transform: 'rotate(10deg)' },
                }
              }} 
            />
          ) : (
            <NotificationsNoneIcon sx={{ fontSize: 24 }} />
          )}
        </Badge>
      </IconButton>

      {/* Notifications Popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 500,
            mt: 1,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            border: `1px solid ${alpha(theme.palette.divider, 0.12)}`
          }
        }}
      >
        <Fade in={open}>
          <Box>
            {/* Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.primary.main, 0.02)
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Notifications
                </Typography>
                <IconButton size="small" onClick={handleClose}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </Typography>
                
                {unreadCount > 0 && (
                  <Button
                    size="small"
                    startIcon={<MarkReadIcon fontSize="small" />}
                    onClick={handleMarkAllRead}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Mark all read
                  </Button>
                )}
              </Box>
            </Box>

            {/* Notifications List */}
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
              {loading ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading notifications...
                  </Typography>
                </Box>
              ) : notifications.length === 0 ? (
                <Card sx={{ m: 2, textAlign: 'center' }}>
                  <CardContent sx={{ py: 4 }}>
                    <CheckCircleIcon 
                      sx={{ 
                        fontSize: 48, 
                        color: theme.palette.success.main,
                        mb: 2 
                      }} 
                    />
                    <Typography variant="h6" gutterBottom>
                      All caught up!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      No new notifications to show.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                <List disablePadding>
                  {notifications.map(renderNotification)}
                </List>
              )}
            </Box>

            {/* Footer */}
            {notifications.length > 0 && (
              <Box
                sx={{
                  p: 1.5,
                  borderTop: `1px solid ${theme.palette.divider}`,
                  bgcolor: alpha(theme.palette.grey[50], 0.5)
                }}
              >
                <Button
                  fullWidth
                  variant="text"
                  size="small"
                  sx={{ 
                    textTransform: 'none',
                    fontWeight: 500,
                    color: theme.palette.primary.main
                  }}
                >
                  View all notifications
                </Button>
              </Box>
            )}
          </Box>
        </Fade>
      </Popover>
    </>
  );
};

export default RealTimeNotifications; 