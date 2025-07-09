import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Button,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  PhoneIphone as PushIcon,
  Apps as InAppIcon,
  Webhook as WebhookIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Science as TestIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { 
  notificationService, 
  type NotificationPreferences as NotificationPrefsType,
  type NotificationEventType,
  type NotificationChannel
} from '../../services/notificationService';

interface NotificationPreferencesProps {
  userId?: string; // If provided, manage preferences for specific user (admin view)
  isAdminView?: boolean;
}

const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ 
  userId: targetUserId, 
  isAdminView = false 
}) => {
  const { currentUser } = useAuth();
  const userId = targetUserId || currentUser?.uid || '';
  
  const [preferences, setPreferences] = useState<NotificationPrefsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<NotificationChannel | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [selectedTab, setSelectedTab] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    channels: true,
    events: true,
    timing: false,
    advanced: false,
  });

  // Load user preferences
  useEffect(() => {
    if (!userId) return;
    
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const prefs = await notificationService.getUserPreferences(userId);
        setPreferences(prefs);
      } catch (error) {
        console.error('Error loading preferences:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load notification preferences',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [userId]);

  // Save preferences
  const savePreferences = async () => {
    if (!preferences || !userId) return;

    try {
      setSaving(true);
      
      const docRef = doc(db, 'notificationPreferences', userId);
      await setDoc(docRef, {
        ...preferences,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSnackbar({
        open: true,
        message: 'Notification preferences saved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save notification preferences',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // Test notification delivery
  const testNotification = async (channel: NotificationChannel) => {
    if (!userId) return;

    try {
      setTesting(channel);
      
      await notificationService.sendNotification(
        'schedule_reminder',
        [userId],
        {
          companyId: currentUser?.companyId || '',
          jobSiteName: 'Test Job Site',
          startTime: '09:00 AM',
          scheduleDate: new Date().toLocaleDateString(),
        },
        {
          priority: 'low',
          channels: [channel],
          metadata: {
            testNotification: true,
            title: 'Test Notification',
            message: `This is a test ${channel} notification from GeoWork.`,
          }
        }
      );

      setSnackbar({
        open: true,
        message: `Test ${channel} notification sent successfully`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      setSnackbar({
        open: true,
        message: `Failed to send test ${channel} notification`,
        severity: 'error'
      });
    } finally {
      setTesting(null);
    }
  };

  // Update preferences
  const updatePreference = (section: keyof NotificationPrefsType, key: string, value: any) => {
    if (!preferences) return;

    setPreferences(prev => {
      if (!prev) return null;
      const currentSection = prev[section];
      if (!currentSection || typeof currentSection !== 'object') return prev;
      return {
        ...prev,
        [section]: {
          ...currentSection,
          [key]: value,
        },
      };
    });
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Get channel icon
  const getChannelIcon = (channel: NotificationChannel) => {
    switch (channel) {
      case 'push': return <PushIcon />;
      case 'email': return <EmailIcon />;
      case 'sms': return <SmsIcon />;
      case 'in-app': return <InAppIcon />;
      case 'webhook': return <WebhookIcon />;
      default: return <NotificationsIcon />;
    }
  };

  // Get event type description
  const getEventDescription = (eventType: NotificationEventType): string => {
    const descriptions: Record<NotificationEventType, string> = {
      schedule_created: 'When a new schedule is assigned to you',
      schedule_updated: 'When your schedule is modified',
      schedule_cancelled: 'When your schedule is cancelled',
      schedule_reminder: 'Reminders before your shift starts',
      conflict_detected: 'When scheduling conflicts are found',
      conflict_resolved: 'When scheduling conflicts are resolved',
      overtime_alert: 'When you approach overtime hours',
      break_violation: 'When break policies are violated',
      geofence_entry: 'When entering a job site',
      geofence_exit: 'When leaving a job site',
      location_update: 'Location tracking updates',
      timesheet_submitted: 'When timesheet is submitted',
      timesheet_approved: 'When timesheet is approved',
      timesheet_rejected: 'When timesheet is rejected',
      emergency_alert: 'Emergency notifications',
      maintenance_due: 'When maintenance is due',
      user_registered: 'When new user registers',
      user_updated: 'When user profile is updated',
      user_deactivated: 'When user is deactivated',
      company_announcement: 'Company announcements',
      system_maintenance: 'System maintenance notifications',
    };
    return descriptions[eventType] || eventType;
  };

  // Group event types by category
  const eventCategories = {
    'Schedule Changes': [
      'schedule_created',
      'schedule_updated', 
      'schedule_cancelled',
    ] as NotificationEventType[],
    'Shift Reminders': [
      'schedule_reminder',
    ] as NotificationEventType[],
    'Alerts & Warnings': [
      'overtime_alert',
      'conflict_detected',
      'conflict_resolved',
      'break_violation',
    ] as NotificationEventType[],
    'Management': [
      'timesheet_submitted',
      'timesheet_approved',
      'timesheet_rejected',
    ] as NotificationEventType[],
    'System': [
      'emergency_alert',
      'system_maintenance',
    ] as NotificationEventType[],
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (!preferences) {
    return (
      <Alert severity="error">
        Failed to load notification preferences. Please try refreshing the page.
      </Alert>
    );
  }

  return (
    <Box>
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 3, pb: 0 }}>
          <Typography variant="h5" gutterBottom>
            {isAdminView ? 'User Notification Preferences' : 'Notification Preferences'}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Customize when and how you receive notifications about schedule changes, reminders, and alerts.
          </Typography>
        </Box>

        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
        >
          <Tab label="Delivery Channels" />
          <Tab label="Event Types" />
          <Tab label="Timing & Frequency" />
          <Tab label="Advanced Settings" />
        </Tabs>
      </Paper>

      {/* Delivery Channels Tab */}
      {selectedTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Delivery Channels
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Choose how you want to receive notifications. You can enable multiple channels.
          </Typography>

          <Grid container spacing={3}>
            {(Object.keys(preferences.channels) as NotificationChannel[]).map(channel => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={channel}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    height: '100%',
                    bgcolor: (preferences.channels as any)[channel] ? 'primary.50' : 'background.paper',
                    borderColor: (preferences.channels as any)[channel] ? 'primary.main' : 'divider',
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getChannelIcon(channel)}
                        <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                          {channel === 'in-app' ? 'In-App' : channel}
                        </Typography>
                      </Box>
                      <Switch
                        checked={(preferences.channels as any)[channel]}
                        onChange={(e) => updatePreference('channels', channel, e.target.checked)}
                      />
                    </Box>
                    
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {channel === 'push' && 'Mobile push notifications'}
                      {channel === 'email' && 'Email notifications'}
                      {channel === 'sms' && 'Text message notifications'}
                      {channel === 'in-app' && 'Notifications within the app'}
                      {channel === 'webhook' && 'API webhook notifications'}
                    </Typography>

                    {(preferences.channels as any)[channel] && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={testing === channel ? <CircularProgress size={16} /> : <TestIcon />}
                        onClick={() => testNotification(channel)}
                        disabled={testing !== null}
                        fullWidth
                      >
                        Test {testing === channel ? 'Sending...' : 'Notification'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Event Types Tab */}
      {selectedTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Event Types
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Choose which types of events you want to be notified about.
          </Typography>

          {Object.entries(eventCategories).map(([category, events]) => (
            <Accordion 
              key={category}
              expanded={expandedSections[category.toLowerCase().replace(/\s+/g, '_')]}
              onChange={() => toggleSection(category.toLowerCase().replace(/\s+/g, '_'))}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">{category}</Typography>
                <Chip 
                  label={`${events.filter(e => preferences.eventTypes[e]).length}/${events.length}`}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {events.map(eventType => (
                    <FormControlLabel
                      key={eventType}
                      control={
                        <Switch
                          checked={preferences.eventTypes[eventType]}
                          onChange={(e) => updatePreference('eventTypes', eventType, e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {getEventDescription(eventType)}
                          </Typography>
                        </Box>
                      }
                      sx={{ mb: 1, alignItems: 'flex-start' }}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      )}

      {/* Timing & Frequency Tab */}
      {selectedTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Timing & Frequency
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Control when and how often you receive notifications.
          </Typography>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardHeader
                  avatar={<ScheduleIcon />}
                  title="Quiet Hours"
                  subheader="Disable notifications during these hours"
                />
                <CardContent>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.quietHours.enabled}
                        onChange={(e) => updatePreference('quietHours', 'enabled', e.target.checked)}
                      />
                    }
                    label="Enable quiet hours"
                    sx={{ mb: 2 }}
                  />

                  {preferences.quietHours.enabled && (
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <Box display="flex" gap={2} flexWrap="wrap">
                        <TextField
                          label="Start Time"
                          type="time"
                          value={preferences.quietHours.start}
                          onChange={(e) => updatePreference('quietHours', 'start', e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          size="small"
                        />
                        <TextField
                          label="End Time"
                          type="time"
                          value={preferences.quietHours.end}
                          onChange={(e) => updatePreference('quietHours', 'end', e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          size="small"
                        />
                      </Box>
                    </LocalizationProvider>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardHeader
                  avatar={<ScheduleIcon />}
                  title="Frequency Settings"
                  subheader="Control notification frequency"
                />
                <CardContent>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Digest Frequency</InputLabel>
                    <Select
                      value={preferences.frequency.digest}
                      onChange={(e) => updatePreference('frequency', 'digest', e.target.value)}
                      label="Digest Frequency"
                    >
                      <MenuItem value="none">No Digest</MenuItem>
                      <MenuItem value="daily">Daily Digest</MenuItem>
                      <MenuItem value="weekly">Weekly Digest</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.frequency.immediate.length > 0}
                        onChange={(e) => updatePreference('frequency', 'immediate', e.target.checked ? ['schedule_created'] : [])}
                      />
                    }
                    label="Immediate notifications"
                    sx={{ mb: 2 }}
                  />

                  <Typography variant="body2" color="textSecondary">
                    Configure notification batching and timing preferences above.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Advanced Settings Tab */}
      {selectedTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Advanced Settings
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Advanced notification configuration and testing options.
          </Typography>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Notification Templates"
                  subheader="Preview and test notification templates"
                />
                <CardContent>
                  <List>
                    {[
                      { title: 'Schedule Assignment', message: 'You have been assigned a new shift', priority: 'medium' },
                      { title: 'Schedule Updated', message: 'Your shift schedule has been changed', priority: 'high' },
                      { title: 'Overtime Alert', message: 'You are approaching overtime hours', priority: 'medium' }
                    ].map((template: any, index: number) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={template.title}
                          secondary={template.message}
                        />
                        <ListItemSecondaryAction>
                          <Chip 
                            label={template.priority} 
                            size="small"
                            color={template.priority === 'high' ? 'warning' : 'default'}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                  <Button variant="outlined" size="small" sx={{ mt: 2 }}>
                    View All Templates
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Export/Import"
                  subheader="Backup or restore your preferences"
                />
                <CardContent>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <Button variant="outlined" size="small">
                      Export Settings
                    </Button>
                    <Button variant="outlined" size="small">
                      Import Settings
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Reset Settings"
                  subheader="Restore default notification preferences"
                />
                <CardContent>
                  <Button 
                    variant="outlined" 
                    color="warning" 
                    size="small"
                    onClick={async () => {
                      const defaultPrefs = await notificationService.getUserPreferences(userId);
                      setPreferences(defaultPrefs);
                    }}
                  >
                    Reset to Defaults
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Action Buttons */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => window.location.reload()}
          disabled={saving}
        >
          Reset Changes
        </Button>
        
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={savePreferences}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NotificationPreferences; 