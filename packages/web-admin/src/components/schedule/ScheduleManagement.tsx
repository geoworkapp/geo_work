import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Alert,
  Tab,
  Tabs,
  Avatar,
  Menu,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  SpeedDial,
  SpeedDialAction,
  Skeleton,
  Paper,
  Portal,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  ViewWeek as WeekIcon,
  ViewDay as DayIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Notifications as NotificationIcon,
  Assignment as TemplateIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { Calendar, dateFnsLocalizer, type View, type Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isSameDay } from 'date-fns';
import { enUS } from 'date-fns/locale';

import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  query, 
  where, 
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Schedule, JobSite, User } from '@shared/types';
import PageContainer from '../layout/PageContainer';

// Custom calendar styles
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar-styles.css';

// Date-fns localizer for react-big-calendar
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday start
  getDay,
  locales,
});

// Calendar event interface
interface CalendarEvent extends Event {
  id: string;
  schedule: Schedule;
  employees: User[];
  color: string;
}

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
      sx={{
        height: '100%',
        width: '100%',
        display: value === index ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      {...other}
    >
      {value === index && children}
    </Box>
  );
}

// Custom toolbar component
const CustomToolbar: React.FC<any> = (toolbar) => {
  return (
    <Box sx={{ 
      p: 2,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 2,
      alignItems: 'center',
      borderBottom: 1,
      borderColor: 'divider'
    }}>
      <Box sx={{ 
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap'
      }}>
        <Button
          variant={toolbar.view === 'month' ? 'contained' : 'outlined'}
          size="small"
          startIcon={<CalendarIcon />}
          onClick={() => toolbar.onView('month')}
        >
          Month
        </Button>
        <Button
          variant={toolbar.view === 'week' ? 'contained' : 'outlined'}
          size="small"
          startIcon={<WeekIcon />}
          onClick={() => toolbar.onView('week')}
        >
          Week
        </Button>
        <Button
          variant={toolbar.view === 'day' ? 'contained' : 'outlined'}
          size="small"
          startIcon={<DayIcon />}
          onClick={() => toolbar.onView('day')}
        >
          Day
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ 
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <IconButton
          onClick={() => toolbar.onNavigate('PREV')}
          size="small"
        >
          <ChevronLeftIcon />
        </IconButton>

        <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
          {toolbar.label}
        </Typography>

        <IconButton
          onClick={() => toolbar.onNavigate('NEXT')}
          size="small"
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      <Button
        variant="outlined"
        size="small"
        onClick={() => toolbar.onNavigate('TODAY')}
      >
        Today
      </Button>
    </Box>
  );
};

// Event style getter
const eventStyleGetter = (event: CalendarEvent) => {
  return {
    style: {
      backgroundColor: event.color || '#1976d2',
      borderRadius: '4px',
      opacity: 1,
      color: '#fff',
      border: 'none',
      display: 'block'
    }
  };
};

// Day style getter
const dayPropGetter = (date: Date) => {
  const today = new Date();
  return {
    style: {
      backgroundColor: isSameDay(date, today) ? '#e3f2fd' : undefined
    }
  };
};

const ScheduleManagement: React.FC = () => {
  const { currentUser } = useAuth();
  
  // State management
  const [currentView, setCurrentView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tabValue, setTabValue] = useState(0);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [selectedJobSite, setSelectedJobSite] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; event: CalendarEvent } | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form state for quick scheduling
  const [quickForm, setQuickForm] = useState({
    jobSiteId: '',
    employeeIds: [] as string[],
    startTime: '09:00',
    endTime: '17:00',
    shiftType: 'regular' as Schedule['shiftType'],
    isRecurring: false,
    notes: '',
  });

  // Load data from Firestore
  useEffect(() => {
    if (!currentUser?.companyId) return;

    const unsubscribes: (() => void)[] = [];

    // Load employees
    const employeesQuery = query(
      collection(db, 'users'),
      where('companyId', '==', currentUser.companyId),
      where('role', 'in', ['employee', 'manager'])
    );
    const employeesUnsub = onSnapshot(employeesQuery, (snapshot) => {
      const employeesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as User[];
      setEmployees(employeesData);
    });
    unsubscribes.push(employeesUnsub);

    // Load job sites
    const jobSitesQuery = query(
      collection(db, 'jobSites'),
      where('companyId', '==', currentUser.companyId)
    );
    const jobSitesUnsub = onSnapshot(jobSitesQuery, (snapshot) => {
      const jobSitesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        siteId: doc.id,
      })) as JobSite[];
      setJobSites(jobSitesData);
    });
    unsubscribes.push(jobSitesUnsub);

    // Load schedules
    const schedulesQuery = query(
      collection(db, 'schedules'),
      where('companyId', '==', currentUser.companyId)
    );
    const schedulesUnsub = onSnapshot(schedulesQuery, (snapshot) => {
      const schedulesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        scheduleId: doc.id,
        startDateTime: doc.data().startDateTime?.toDate(),
        endDateTime: doc.data().endDateTime?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Schedule[];
      setSchedules(schedulesData);
      setLoading(false);
    });
    unsubscribes.push(schedulesUnsub);

    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser?.companyId]);

  // Convert schedules to calendar events
  const calendarEvents = useMemo(() => {
    if (!schedules.length || !employees.length) return [];

    return schedules
      .filter(schedule => {
        // Filter by selected job site
        if (selectedJobSite !== 'all' && schedule.jobSiteId !== selectedJobSite) return false;
        
        // Filter by selected employees
        if (selectedEmployees.length > 0 && !selectedEmployees.includes(schedule.employeeId)) return false;
        
        return true;
      })
      .map(schedule => {
        const employee = employees.find(emp => emp.id === schedule.employeeId);
        const jobSite = jobSites.find(site => site.siteId === schedule.jobSiteId);
        
        return {
          id: schedule.scheduleId,
          title: (() => {
            const raw = `${employee?.profile?.firstName || 'Unknown'} - ${jobSite?.siteName || 'Unknown Site'}`;
            return raw.length > 22 ? `${raw.slice(0, 22)}…` : raw;
          })(),
          start: schedule.startDateTime,
          end: schedule.endDateTime,
          schedule,
          employees: employee ? [employee] : [],
          color: schedule.metadata?.color || getShiftTypeColor(schedule.shiftType),
          resource: {
            shiftType: schedule.shiftType,
            status: schedule.status,
            jobSite: jobSite?.siteName,
            employee: employee?.profile?.firstName,
          }
        } as CalendarEvent;
      });
  }, [schedules, employees, jobSites, selectedJobSite, selectedEmployees]);

  // Helper function to get shift type colors
  function getShiftTypeColor(shiftType: Schedule['shiftType']): string {
    switch (shiftType) {
      case 'regular': return '#2196F3';
      case 'overtime': return '#FF9800';
      case 'emergency': return '#F44336';
      case 'training': return '#4CAF50';
      default: return '#9E9E9E';
    }
  }

  // Handle calendar slot selection
  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setSelectedSlot({ start, end });
    setQuickForm(prev => ({
      ...prev,
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm'),
    }));
    setQuickScheduleOpen(true);
  }, []);

  // Handle calendar event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    console.log('Selected event:', event);
  }, []);

  // Handle context menu
  const handleContextMenu = useCallback((event: React.MouseEvent, calendarEvent: CalendarEvent) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      event: calendarEvent,
    });
  }, []);

  // Handle quick schedule creation or update
  const handleQuickSchedule = async () => {
    if (!currentUser?.companyId || !selectedSlot) return;

    try {
      setError(null);
      
      const jobSite = jobSites.find(site => site.siteId === quickForm.jobSiteId);
      if (!jobSite) throw new Error('Please select a job site');
      if (quickForm.employeeIds.length === 0) throw new Error('Please select at least one employee');

      if (editingSchedule) {
        // Update existing schedule
        const employee = employees.find(emp => emp.id === quickForm.employeeIds[0]);
        if (!employee) throw new Error('Employee not found');

        const startDateTime = new Date(selectedSlot.start);
        // Ensure we stay on the same calendar day when user picked a single-day slot
        const endDateTime = new Date(selectedSlot.start);
        
        // Apply selected times
        const [startHour, startMinute] = quickForm.startTime.split(':').map(Number);
        const [endHour, endMinute] = quickForm.endTime.split(':').map(Number);
        
        startDateTime.setHours(startHour, startMinute, 0, 0);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        const updateData = {
          employeeId: quickForm.employeeIds[0],
          employeeName: `${employee.profile.firstName} ${employee.profile.lastName}`,
          jobSiteId: quickForm.jobSiteId,
          jobSiteName: jobSite.siteName,
          startDateTime: Timestamp.fromDate(startDateTime),
          endDateTime: Timestamp.fromDate(endDateTime),
          shiftType: quickForm.shiftType,
          notes: quickForm.notes,
          updatedAt: serverTimestamp(),
          isRecurring: quickForm.isRecurring,
          expectedHours: (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60),
          metadata: {
            color: getShiftTypeColor(quickForm.shiftType),
            priority: 'medium' as const,
          },
        };

        await updateDoc(doc(db, 'schedules', editingSchedule.scheduleId), updateData);
        setSuccess('Schedule updated successfully');
      } else {
        // Create schedules for each selected employee
        const schedulePromises = quickForm.employeeIds.map(async (employeeId) => {
          const employee = employees.find(emp => emp.id === employeeId);
          if (!employee) return;

          const startDateTime = new Date(selectedSlot.start);
          // For quick-schedule we default to the same day; user can create multi-day by dragging days, handled elsewhere
          const endDateTime = new Date(selectedSlot.start);
          
          // Apply selected times
          const [startHour, startMinute] = quickForm.startTime.split(':').map(Number);
          const [endHour, endMinute] = quickForm.endTime.split(':').map(Number);
          
          startDateTime.setHours(startHour, startMinute, 0, 0);
          endDateTime.setHours(endHour, endMinute, 0, 0);

          const scheduleData = {
            companyId: currentUser.companyId,
            employeeId,
            employeeName: `${employee.profile.firstName} ${employee.profile.lastName}`,
            jobSiteId: quickForm.jobSiteId,
            jobSiteName: jobSite.siteName,
            startDateTime: Timestamp.fromDate(startDateTime),
            endDateTime: Timestamp.fromDate(endDateTime),
            shiftType: quickForm.shiftType,
            status: 'scheduled' as Schedule['status'],
            notes: quickForm.notes,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isRecurring: quickForm.isRecurring,
            breakDuration: 60,
            expectedHours: (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60),
            requiresApproval: false,
            metadata: {
              color: getShiftTypeColor(quickForm.shiftType),
              priority: 'medium' as const,
            },
          };

          return addDoc(collection(db, 'schedules'), scheduleData);
        });

        await Promise.all(schedulePromises);
        setSuccess(`Created ${quickForm.employeeIds.length} schedule(s) successfully`);
      }
      
      handleCloseQuickSchedule();
    } catch (err) {
      console.error('Error saving schedules:', err);
      setError(err instanceof Error ? err.message : 'Failed to save schedules');
    }
  };

  // Close quick schedule dialog
  const handleCloseQuickSchedule = () => {
    setQuickScheduleOpen(false);
    setSelectedSlot(null);
    setEditingSchedule(null);
    setQuickForm({
      jobSiteId: '',
      employeeIds: [],
      startTime: '09:00',
      endTime: '17:00',
      shiftType: 'regular',
      isRecurring: false,
      notes: '',
    });
  };

  // Handle schedule deletion
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteDoc(doc(db, 'schedules', scheduleId));
      setSuccess('Schedule deleted successfully');
      setContextMenu(null);
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError('Failed to delete schedule');
    }
  };

  // Handle schedule duplication
  const handleDuplicateSchedule = async (schedule: Schedule) => {
    try {
      const newScheduleData = {
        ...schedule,
        scheduleId: undefined, // Remove the ID so Firestore creates a new one
        startDateTime: Timestamp.fromDate(new Date(schedule.startDateTime.getTime() + 7 * 24 * 60 * 60 * 1000)), // Add 1 week
        endDateTime: Timestamp.fromDate(new Date(schedule.endDateTime.getTime() + 7 * 24 * 60 * 60 * 1000)), // Add 1 week
        status: 'scheduled' as Schedule['status'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid || '',
        notes: `${schedule.notes || ''} (Duplicated)`.trim(),
      };

      // Remove undefined fields
      const cleanedData = Object.fromEntries(
        Object.entries(newScheduleData).filter(([_, value]) => value !== undefined)
      );

      await addDoc(collection(db, 'schedules'), cleanedData);
      setSuccess('Schedule duplicated successfully (moved 1 week forward)');
      setContextMenu(null);
    } catch (err) {
      console.error('Error duplicating schedule:', err);
      setError('Failed to duplicate schedule');
    }
  };

  // Handle schedule editing (opens the quick schedule dialog with pre-filled data)
  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setQuickForm({
      jobSiteId: schedule.jobSiteId,
      employeeIds: [schedule.employeeId],
      startTime: format(schedule.startDateTime, 'HH:mm'),
      endTime: format(schedule.endDateTime, 'HH:mm'),
      shiftType: schedule.shiftType,
      isRecurring: schedule.isRecurring,
      notes: schedule.notes || '',
    });
    
    setSelectedSlot({
      start: schedule.startDateTime,
      end: schedule.endDateTime,
    });
    
    setQuickScheduleOpen(true);
    setContextMenu(null);
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const handleEventContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleContextMenu(e, event);
    };

    const isSmallEvent = currentView === 'month';
    const employee = event.resource?.employee || 'Unknown';
    const jobSite = event.resource?.jobSite || 'Unknown Site';
    const timeRange = `${format(event.start!, 'HH:mm')}-${format(event.end!, 'HH:mm')}`;
    const shiftType = event.resource?.shiftType || 'regular';
    const status = event.resource?.status || 'scheduled';

    return (
      <Box
        onContextMenu={handleEventContextMenu}
        sx={{
          backgroundColor: event.color,
          color: 'white',
          borderRadius: 1,
          p: isSmallEvent ? 0.5 : 1,
          height: '100%',
          cursor: 'pointer',
          fontSize: isSmallEvent ? '0.65rem' : '0.75rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          minHeight: isSmallEvent ? '24px' : '40px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          position: 'relative',
          '&:hover': {
            transform: 'scale(1.02)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 2,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            backgroundColor: status === 'completed' ? '#4caf50' : 
                           status === 'cancelled' ? '#f44336' :
                           status === 'in_progress' ? '#ff9800' : 
                           'rgba(255,255,255,0.5)',
            borderRadius: '2px 0 0 2px'
          },
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {isSmallEvent ? (
          // Compact layout for month view
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                fontSize: '0.7rem'
              }}
            >
              {employee}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.9,
                whiteSpace: 'nowrap',
                fontSize: '0.65rem',
                ml: 1
              }}
            >
              {timeRange}
            </Typography>
          </Box>
        ) : (
          // Full layout for week/day view
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  lineHeight: 1.2
                }}
              >
                {employee}
              </Typography>
              <Chip 
                label={shiftType}
                size="small"
                sx={{ 
                  height: '16px',
                  fontSize: '0.6rem',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'inherit',
                  '.MuiChip-label': { px: 1 }
                }}
              />
            </Box>
            
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.7rem',
                opacity: 0.9,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              {timeRange}
            </Typography>
            
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.7rem',
                opacity: 0.9,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {jobSite}
            </Typography>
            
            {event.schedule.notes && (
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.65rem',
                  opacity: 0.8,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontStyle: 'italic'
                }}
              >
                {event.schedule.notes}
              </Typography>
            )}
          </>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ height: '100%', width: '100%', p: 2 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height="calc(100% - 80px)" sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  return (
    <PageContainer fullWidth disablePadding>
      <Box 
        sx={{ 
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'background.default'
        }}
      >
      {/* Tabs Section */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ 
            px: 3,
            '& .MuiTab-root': {
              minWidth: 120,
              fontWeight: 600,
              textTransform: 'none'
            }
          }}
        >
          <Tab label="Calendar View" />
          <Tab label="List View" />
        </Tabs>
      </Box>

      {/* Calendar Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box 
          sx={{ 
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0, // Critical for nested flex
          }}
        >
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ 
              flex: 1,
              height: '100%',
              width: '100%',
              minHeight: 0,
            }}
            views={['month', 'week', 'day']}
            view={currentView as any}
            onView={(view) => setCurrentView(view as View)}
            date={currentDate}
            onNavigate={date => setCurrentDate(date)}
            components={{
              toolbar: CustomToolbar,
              event: EventComponent
            }}
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            showMultiDayTimes
          />
        </Box>
      </TabPanel>

      {/* List View Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{
          flex: 1,
          width: '100%',
          overflow: 'auto',
          p: 3
        }}>
          {/* Filters Content */}
          <Paper elevation={0} variant="outlined">
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom>
                Filters & Display Options
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                gap: 3 
              }}>
                <FormControl fullWidth>
                  <InputLabel>Job Site Filter</InputLabel>
                  <Select
                    value={selectedJobSite}
                    onChange={(e) => setSelectedJobSite(e.target.value)}
                    label="Job Site Filter"
                  >
                    <MenuItem value="all">All Job Sites</MenuItem>
                    {jobSites.map(site => (
                      <MenuItem key={site.siteId} value={site.siteId}>
                        {site.siteName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth>
                  <InputLabel>Employee Filter</InputLabel>
                  <Select
                    multiple
                    value={selectedEmployees}
                    onChange={(e) => setSelectedEmployees(e.target.value as string[])}
                    label="Employee Filter"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const employee = employees.find(emp => emp.id === value);
                          return (
                            <Chip 
                              key={value} 
                              label={employee ? `${employee.profile.firstName} ${employee.profile.lastName}` : value}
                              size="small"
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {employees.map(employee => (
                      <MenuItem key={employee.id} value={employee.id}>
                        {employee.profile.firstName} {employee.profile.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Paper>
        </Box>
      </TabPanel>

      {/* Portal for Alerts */}
      {(error || success) && (
        <Portal>
          <Box sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 2000
          }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}
          </Box>
        </Portal>
      )}

      {/* Quick Schedule Dialog */}
      <Dialog 
        open={quickScheduleOpen} 
        onClose={handleCloseQuickSchedule}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box>
            <Typography variant="h6" component="div">
              {editingSchedule ? 'Edit Schedule' : 'Quick Schedule Creation'}
            </Typography>
            {selectedSlot && (
              <Typography variant="subtitle2" color="text.secondary" component="div">
                {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
              </Typography>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Job Site *</InputLabel>
              <Select
                value={quickForm.jobSiteId}
                onChange={(e) => setQuickForm(prev => ({ ...prev, jobSiteId: e.target.value }))}
                label="Job Site *"
              >
                {jobSites.map(site => (
                  <MenuItem key={site.siteId} value={site.siteId}>
                    {site.siteName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Employees *</InputLabel>
              <Select
                multiple
                value={quickForm.employeeIds}
                onChange={(e) => setQuickForm(prev => ({ ...prev, employeeIds: e.target.value as string[] }))}
                label="Employees *"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const employee = employees.find(emp => emp.id === value);
                      return (
                        <Chip 
                          key={value} 
                          label={employee ? `${employee.profile.firstName} ${employee.profile.lastName}` : value}
                          size="small"
                          avatar={<Avatar sx={{ width: 24, height: 24 }}>{employee?.profile.firstName[0]}</Avatar>}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {employees.map(employee => (
                  <MenuItem key={employee.id} value={employee.id}>
                    <Avatar sx={{ width: 32, height: 32, mr: 2 }}>
                      {employee.profile.firstName[0]}
                    </Avatar>
                    {employee.profile.firstName} {employee.profile.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                fullWidth
                label="Start Time"
                type="time"
                value={quickForm.startTime}
                onChange={(e) => setQuickForm(prev => ({ ...prev, startTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="End Time"
                type="time"
                value={quickForm.endTime}
                onChange={(e) => setQuickForm(prev => ({ ...prev, endTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel>Shift Type</InputLabel>
              <Select
                value={quickForm.shiftType}
                onChange={(e) => setQuickForm(prev => ({ ...prev, shiftType: e.target.value as Schedule['shiftType'] }))}
                label="Shift Type"
              >
                <MenuItem value="regular">Regular</MenuItem>
                <MenuItem value="overtime">Overtime</MenuItem>
                <MenuItem value="emergency">Emergency</MenuItem>
                <MenuItem value="training">Training</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Notes (Optional)"
              multiline
              rows={3}
              value={quickForm.notes}
              onChange={(e) => setQuickForm(prev => ({ ...prev, notes: e.target.value }))}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={quickForm.isRecurring}
                  onChange={(e) => setQuickForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                />
              }
              label="Make this a recurring schedule"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseQuickSchedule}>Cancel</Button>
          <Button
            onClick={handleQuickSchedule}
            variant="contained"
            disabled={!quickForm.jobSiteId || quickForm.employeeIds.length === 0}
          >
            {editingSchedule ? 'Update Schedule' : `Create Schedule${quickForm.employeeIds.length > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => contextMenu && handleEditSchedule(contextMenu.event.schedule)}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Schedule</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => contextMenu && handleDuplicateSchedule(contextMenu.event.schedule)}>
          <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Duplicate Schedule</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => {
            if (contextMenu && window.confirm('Are you sure you want to delete this schedule?')) {
              handleDeleteSchedule(contextMenu.event.schedule.scheduleId);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Schedule</ListItemText>
        </MenuItem>
      </Menu>

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Schedule actions"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        icon={<AddIcon />}
      >
        <SpeedDialAction
          icon={<PersonIcon />}
          tooltipTitle="Quick Schedule"
          onClick={() => setQuickScheduleOpen(true)}
        />
        <SpeedDialAction
          icon={<TemplateIcon />}
          tooltipTitle="Use Template"
          onClick={() => {}}
        />
        <SpeedDialAction
          icon={<NotificationIcon />}
          tooltipTitle="Send Notifications"
          onClick={() => {}}
        />
      </SpeedDial>
    </Box>
    </PageContainer>
  );
};

export default ScheduleManagement; 