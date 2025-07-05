import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Schedule as ScheduleIcon,
  Repeat as RepeatIcon,
  Warning as WarningIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { Schedule, JobSite, User, ScheduleTemplate, ScheduleConflict } from '@shared/types';
import { format, isWithinInterval } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

type ScheduleFormState = {
  employeeId: string;
  employeeName: string;
  jobSiteId: string;
  jobSiteName: string;
  startDateTime: Date;
  endDateTime: Date;
  shiftType: Schedule['shiftType'];
  breakDuration: number;
  expectedHours: number;
  notes: string;
  isRecurring: boolean;
  recurrence?: Schedule['recurrence'];
  requiresApproval: boolean;
  skillsRequired: string[];
  equipmentNeeded: string[];
  specialInstructions: string;
  metadata: {
    priority: 'low' | 'medium' | 'high' | 'urgent';
    color: string;
  };
};

const ScheduleManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form states
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    employeeId: '',
    employeeName: '',
    jobSiteId: '',
    jobSiteName: '',
    startDateTime: new Date(),
    endDateTime: new Date(),
    shiftType: 'regular',
    breakDuration: 60,
    expectedHours: 8,
    notes: '',
    isRecurring: false,
    recurrence: undefined,
    requiresApproval: false,
    skillsRequired: [],
    equipmentNeeded: [],
    specialInstructions: '',
    metadata: {
      priority: 'medium',
      color: '#1976d2',
    },
  });

  // Load data
  useEffect(() => {
    if (!currentUser?.companyId) return;

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    // Load schedules with better error handling and simpler query
    // First try without orderBy to avoid index requirement
    const schedulesQuery = query(
      collection(db, 'schedules'),
      where('companyId', '==', currentUser.companyId)
    );
    
    const schedulesUnsubscribe = onSnapshot(
      schedulesQuery, 
      {
        next: (snapshot) => {
          if (!isMounted) return;
          
          const schedulesData = snapshot.docs.map(doc => ({
            ...doc.data(),
            scheduleId: doc.id,
            startDateTime: doc.data().startDateTime?.toDate(),
            endDateTime: doc.data().endDateTime?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
          })) as Schedule[];
          
          // Sort in memory by startDateTime (newest first)
          schedulesData.sort((a, b) => b.startDateTime.getTime() - a.startDateTime.getTime());
          setSchedules(schedulesData);
        },
        error: (error) => {
          if (!isMounted) return;
          
          console.error('Error fetching schedules:', error);
          setError('Error loading schedules. Please try refreshing the page.');
        }
      }
    );
    unsubscribes.push(schedulesUnsubscribe);

    // Load employees with error handling
    const employeesQuery = query(
      collection(db, 'users'),
      where('companyId', '==', currentUser.companyId),
      where('role', 'in', ['employee', 'manager'])
    );
    
    const employeesUnsubscribe = onSnapshot(
      employeesQuery, 
      (snapshot) => {
        if (!isMounted) return;
        
        const employeesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            // Ensure profile exists with fallback values
            profile: {
              firstName: data.profile?.firstName || data.firstName || 'No',
              lastName: data.profile?.lastName || data.lastName || 'Name',
              phoneNumber: data.profile?.phoneNumber || data.phoneNumber || '',
              ...data.profile
            }
          };
        }) as User[];
        
        console.log('Loaded employees:', employeesData);
        setEmployees(employeesData);
        setLoading(false);
      },
      (error) => {
        if (!isMounted) return;
        console.error('Error loading employees:', error);
        setError('Error loading employees. Please check your permissions.');
        setLoading(false);
      }
    );
    unsubscribes.push(employeesUnsubscribe);

    // Load job sites with error handling
    const jobSitesQuery = query(
      collection(db, 'jobsites'),
      where('companyId', '==', currentUser.companyId),
      where('isActive', '==', true)
    );
    
    const jobSitesUnsubscribe = onSnapshot(
      jobSitesQuery, 
      (snapshot) => {
        if (!isMounted) return;
        
        const jobSitesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            siteId: doc.id,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            // Ensure siteName exists
            siteName: data.siteName || data.name || 'Unnamed Site'
          };
        }) as JobSite[];
        
        console.log('Loaded job sites:', jobSitesData);
        setJobSites(jobSitesData);
      },
      (error) => {
        if (!isMounted) return;
        console.error('Error loading job sites:', error);
        setError('Error loading job sites. Please check your permissions.');
      }
    );
    unsubscribes.push(jobSitesUnsubscribe);

    // Load templates with error handling
    const templatesQuery = query(
      collection(db, 'scheduleTemplates'),
      where('companyId', '==', currentUser.companyId),
      where('isActive', '==', true)
    );
    
    const templatesUnsubscribe = onSnapshot(
      templatesQuery, 
      (snapshot) => {
        if (!isMounted) return;
        
        const templatesData = snapshot.docs.map(doc => ({
          ...doc.data(),
          templateId: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as ScheduleTemplate[];
        setTemplates(templatesData);
      },
      (error) => {
        if (!isMounted) return;
        console.error('Error loading templates:', error);
      }
    );
    unsubscribes.push(templatesUnsubscribe);

    // Cleanup function
    return () => {
      isMounted = false;
      unsubscribes.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.log('Cleanup completed for listener');
        }
      });
    };
  }, [currentUser?.companyId]);

  // Check for schedule conflicts
  useEffect(() => {
    const detectConflicts = () => {
      const conflictsList: ScheduleConflict[] = [];
      
      schedules.forEach((schedule, index) => {
        schedules.slice(index + 1).forEach(otherSchedule => {
          if (
            schedule.employeeId === otherSchedule.employeeId &&
            schedule.status !== 'cancelled' &&
            otherSchedule.status !== 'cancelled' &&
            isWithinInterval(schedule.startDateTime, {
              start: otherSchedule.startDateTime,
              end: otherSchedule.endDateTime
            })
          ) {
            conflictsList.push({
              conflictId: `${schedule.scheduleId}-${otherSchedule.scheduleId}`,
              type: 'overlap',
              employeeId: schedule.employeeId,
              employeeName: schedule.employeeName,
              conflictingSchedules: [schedule.scheduleId, otherSchedule.scheduleId],
              severity: 'error',
              message: `Schedule overlap detected for ${schedule.employeeName}`,
              suggestions: ['Adjust shift times', 'Reassign to different employee'],
            });
          }
        });
      });

      setConflicts(conflictsList);
    };

    if (schedules.length > 1) {
      detectConflicts();
    }
  }, [schedules]);

  const handleCreateSchedule = async () => {
    if (!currentUser?.companyId) return;

    try {
      setError(null);

      const selectedEmployee = employees.find(emp => emp.id === scheduleForm.employeeId);
      const selectedJobSite = jobSites.find(site => site.siteId === scheduleForm.jobSiteId);

      if (!selectedEmployee || !selectedJobSite) {
        throw new Error('Please select both employee and job site');
      }

      const scheduleData: any = {
        companyId: currentUser.companyId,
        employeeId: scheduleForm.employeeId,
        employeeName: `${selectedEmployee.profile.firstName} ${selectedEmployee.profile.lastName}`,
        jobSiteId: scheduleForm.jobSiteId,
        jobSiteName: selectedJobSite.siteName,
        startDateTime: Timestamp.fromDate(scheduleForm.startDateTime),
        endDateTime: Timestamp.fromDate(scheduleForm.endDateTime),
        shiftType: scheduleForm.shiftType,
        status: 'scheduled' as Schedule['status'],
        notes: scheduleForm.notes,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isRecurring: scheduleForm.isRecurring,
        breakDuration: scheduleForm.breakDuration,
        expectedHours: scheduleForm.expectedHours,
        requiresApproval: scheduleForm.requiresApproval,
        skillsRequired: scheduleForm.skillsRequired,
        equipmentNeeded: scheduleForm.equipmentNeeded,
        specialInstructions: scheduleForm.specialInstructions,
        metadata: {
          color: scheduleForm.metadata?.color ?? '#1976d2',
          priority: scheduleForm.metadata?.priority ?? 'medium',
        },
      };

      if (scheduleForm.isRecurring && scheduleForm.recurrence) {
        scheduleData.recurrence = {
          ...scheduleForm.recurrence,
          endDate: scheduleForm.recurrence.endDate ? Timestamp.fromDate(scheduleForm.recurrence.endDate) : undefined,
        };
      }

      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.scheduleId), scheduleData);
        setSuccess('Schedule updated successfully');
      } else {
        await addDoc(collection(db, 'schedules'), scheduleData);
        setSuccess('Schedule created successfully');
      }

      handleCloseScheduleDialog();
    } catch (err) {
      console.error('Error saving schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await deleteDoc(doc(db, 'schedules', scheduleId));
      setSuccess('Schedule deleted successfully');
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError('Failed to delete schedule');
    }
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      employeeId: schedule.employeeId,
      employeeName: schedule.employeeName,
      jobSiteId: schedule.jobSiteId,
      jobSiteName: schedule.jobSiteName,
      startDateTime: schedule.startDateTime,
      endDateTime: schedule.endDateTime,
      shiftType: schedule.shiftType,
      breakDuration: schedule.breakDuration,
      expectedHours: schedule.expectedHours,
      notes: schedule.notes || '',
      isRecurring: schedule.isRecurring,
      recurrence: schedule.recurrence,
      requiresApproval: schedule.requiresApproval,
      skillsRequired: schedule.skillsRequired || [],
      equipmentNeeded: schedule.equipmentNeeded || [],
      specialInstructions: schedule.specialInstructions || '',
      metadata: {
        color: schedule.metadata?.color ?? '#1976d2',
        priority: schedule.metadata?.priority ?? 'medium',
      },
    });
    setScheduleDialogOpen(true);
  };

  const handleCloseScheduleDialog = () => {
    setScheduleDialogOpen(false);
    setEditingSchedule(null);
    setScheduleForm({
      employeeId: '',
      employeeName: '',
      jobSiteId: '',
      jobSiteName: '',
      startDateTime: new Date(),
      endDateTime: new Date(),
      shiftType: 'regular',
      breakDuration: 60,
      expectedHours: 8,
      notes: '',
      isRecurring: false,
      recurrence: undefined,
      requiresApproval: false,
      skillsRequired: [],
      equipmentNeeded: [],
      specialInstructions: '',
      metadata: {
        priority: 'medium',
        color: '#1976d2',
      },
    });
  };

  const getStatusColor = (status: Schedule['status']) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'confirmed': return 'success';
      case 'in-progress': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      case 'no-show': return 'error';
      default: return 'default';
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ width: '100%' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {conflicts.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Schedule Conflicts Detected ({conflicts.length})
            </Typography>
            {conflicts.slice(0, 3).map(conflict => (
              <Typography key={conflict.conflictId} variant="body2">
                • {conflict.message}
              </Typography>
            ))}
            {conflicts.length > 3 && (
              <Typography variant="body2">
                ... and {conflicts.length - 3} more conflicts
              </Typography>
            )}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab icon={<ScheduleIcon />} label="All Schedules" />
            <Tab icon={<CalendarIcon />} label="Calendar View" />
            <Tab icon={<RepeatIcon />} label="Templates" />
            <Tab icon={<WarningIcon />} label={`Conflicts (${conflicts.length})`} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5">Schedule Management</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setScheduleDialogOpen(true)}
            >
              Create Schedule
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Job Site</TableCell>
                  <TableCell>Start Date/Time</TableCell>
                  <TableCell>End Date/Time</TableCell>
                  <TableCell>Shift Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.scheduleId}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon color="action" />
                        {schedule.employeeName}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WorkIcon color="action" />
                        {schedule.jobSiteName}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {format(schedule.startDateTime, 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {format(schedule.endDateTime, 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={schedule.shiftType}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={schedule.status}
                        size="small"
                        color={getStatusColor(schedule.status)}
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit Schedule">
                        <IconButton
                          size="small"
                          onClick={() => handleEditSchedule(schedule)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Schedule">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteSchedule(schedule.scheduleId)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Calendar View
          </Typography>
          <Typography color="text.secondary">
            Calendar view implementation coming soon...
          </Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Schedule Templates</Typography>
          </Box>
          
          <Grid container spacing={{ xs: 2, sm: 6, md: 4 }}>
            {templates.map((template) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={template.templateId}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {template.templateName}
                    </Typography>
                    <Typography color="text.secondary" gutterBottom>
                      {template.description}
                    </Typography>
                    <Stack spacing={1}>
                      <Chip label={`${template.duration}h shift`} size="small" />
                      <Chip label={template.shiftType} size="small" variant="outlined" />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Schedule Conflicts
          </Typography>
          
          {conflicts.length === 0 ? (
            <Alert severity="success">
              <Typography>No schedule conflicts detected.</Typography>
            </Alert>
          ) : (
            <Stack spacing={2}>
              {conflicts.map((conflict) => (
                <Card key={conflict.conflictId}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <WarningIcon color={conflict.severity === 'error' ? 'error' : 'warning'} />
                      <Typography variant="h6">
                        {conflict.type.replace('-', ' ').toUpperCase()}
                      </Typography>
                      <Chip
                        label={conflict.severity}
                        size="small"
                        color={conflict.severity === 'error' ? 'error' : 'warning'}
                      />
                    </Box>
                    <Typography gutterBottom>{conflict.message}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Employee: {conflict.employeeName}
                    </Typography>
                    {conflict.suggestions && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Suggestions:
                        </Typography>
                        <Stack spacing={1}>
                          {conflict.suggestions.map((suggestion, index) => (
                            <Typography key={index} variant="body2" color="text.secondary">
                              • {suggestion}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </TabPanel>

        {/* Create/Edit Schedule Dialog */}
        <Dialog
          open={scheduleDialogOpen}
          onClose={handleCloseScheduleDialog}
          maxWidth="md"
          fullWidth
          disableScrollLock
          aria-labelledby="schedule-dialog-title"
          aria-describedby="schedule-dialog-description"
        >
          <DialogTitle id="schedule-dialog-title">
            {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
          </DialogTitle>
          <DialogContent>
            <Box id="schedule-dialog-description" sx={{ position: 'absolute', left: '-10000px' }}>
              {editingSchedule ? 'Edit the selected schedule details' : 'Create a new work schedule for an employee'}
            </Box>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Grid container spacing={{ xs: 2, sm: 6 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Employee</InputLabel>
                    <Select
                      value={scheduleForm.employeeId}
                      onChange={(e) => {
                        const employee = employees.find(emp => emp.id === e.target.value);
                        setScheduleForm(prev => ({
                          ...prev,
                          employeeId: e.target.value,
                          employeeName: employee ? 
                            `${employee.profile?.firstName || 'No'} ${employee.profile?.lastName || 'Name'}`.trim() : 
                            'Unknown Employee',
                        }));
                      }}
                      disabled={employees.length === 0}
                    >
                      {employees.length === 0 ? (
                        <MenuItem disabled>
                          {loading ? 'Loading employees...' : 'No employees available'}
                        </MenuItem>
                      ) : (
                        employees.map((employee) => (
                          <MenuItem key={employee.id} value={employee.id}>
                            {employee.profile?.firstName || 'No'} {employee.profile?.lastName || 'Name'}
                            {employee.profile?.phoneNumber && ` (${employee.profile.phoneNumber})`}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Job Site</InputLabel>
                    <Select
                      value={scheduleForm.jobSiteId}
                      onChange={(e) => {
                        const jobSite = jobSites.find(site => site.siteId === e.target.value);
                        setScheduleForm(prev => ({
                          ...prev,
                          jobSiteId: e.target.value,
                          jobSiteName: jobSite?.siteName || 'Unnamed Site',
                        }));
                      }}
                      disabled={jobSites.length === 0}
                    >
                      {jobSites.length === 0 ? (
                        <MenuItem disabled>
                          {loading ? 'Loading job sites...' : 'No job sites available'}
                        </MenuItem>
                      ) : (
                        jobSites.map((jobSite) => (
                          <MenuItem key={jobSite.siteId} value={jobSite.siteId}>
                            {jobSite.siteName || 'Unnamed Site'}
                            {jobSite.address && ` - ${jobSite.address}`}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Grid container spacing={{ xs: 2, sm: 6 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DateTimePicker
                    label="Start Date & Time"
                    value={scheduleForm.startDateTime}
                    onChange={(date) => {
                      if (date) {
                        setScheduleForm(prev => ({ ...prev, startDateTime: date }));
                      }
                    }}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DateTimePicker
                    label="End Date & Time"
                    value={scheduleForm.endDateTime}
                    onChange={(date) => {
                      if (date) {
                        setScheduleForm(prev => ({ ...prev, endDateTime: date }));
                      }
                    }}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={{ xs: 2, sm: 4 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Shift Type</InputLabel>
                    <Select
                      value={scheduleForm.shiftType}
                      onChange={(e) => setScheduleForm(prev => ({ 
                        ...prev, 
                        shiftType: e.target.value as Schedule['shiftType'] 
                      }))}
                    >
                      <MenuItem value="regular">Regular</MenuItem>
                      <MenuItem value="overtime">Overtime</MenuItem>
                      <MenuItem value="emergency">Emergency</MenuItem>
                      <MenuItem value="training">Training</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Expected Hours"
                    type="number"
                    value={scheduleForm.expectedHours}
                    onChange={(e) => setScheduleForm(prev => ({ 
                      ...prev, 
                      expectedHours: parseFloat(e.target.value) || 0 
                    }))}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Break Duration (minutes)"
                    type="number"
                    value={scheduleForm.breakDuration}
                    onChange={(e) => setScheduleForm(prev => ({ 
                      ...prev, 
                      breakDuration: parseInt(e.target.value) || 0 
                    }))}
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleForm.isRecurring}
                    onChange={(e) => setScheduleForm(prev => ({ 
                      ...prev, 
                      isRecurring: e.target.checked 
                    }))}
                  />
                }
                label="Recurring Schedule"
              />

              {scheduleForm.isRecurring && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Recurrence Settings
                    </Typography>
                    <Grid container spacing={{ xs: 2, sm: 6 }}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth>
                          <InputLabel>Frequency</InputLabel>
                          <Select
                            value={scheduleForm.recurrence?.type ?? 'weekly'}
                            onChange={(e) => setScheduleForm(prev => ({
                              ...prev,
                              recurrence: {
                                type: e.target.value as 'daily' | 'weekly' | 'monthly',
                                interval: prev.recurrence?.interval ?? 1,
                                daysOfWeek: prev.recurrence?.daysOfWeek ?? [],
                                endDate: prev.recurrence?.endDate,
                                maxOccurrences: prev.recurrence?.maxOccurrences,
                              } as Schedule['recurrence']
                            }))}
                          >
                            <MenuItem value="daily">Daily</MenuItem>
                            <MenuItem value="weekly">Weekly</MenuItem>
                            <MenuItem value="monthly">Monthly</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Repeat Every"
                          type="number"
                          value={scheduleForm.recurrence?.interval ?? 1}
                          onChange={(e) => setScheduleForm(prev => ({
                            ...prev,
                            recurrence: prev.recurrence ? {
                              ...prev.recurrence,
                              interval: parseInt(e.target.value) || 1
                            } as Schedule['recurrence'] : {
                              type: 'weekly' as const,
                              interval: parseInt(e.target.value) || 1,
                              daysOfWeek: [],
                              endDate: undefined,
                              maxOccurrences: undefined,
                            } as Schedule['recurrence']
                          }))}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseScheduleDialog}>Cancel</Button>
            <Button
              onClick={handleCreateSchedule}
              variant="contained"
              disabled={!scheduleForm.employeeId || !scheduleForm.jobSiteId}
            >
              {editingSchedule ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ScheduleManagement;
