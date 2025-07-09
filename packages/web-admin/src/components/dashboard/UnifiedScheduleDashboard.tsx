import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Tooltip,
  LinearProgress,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import {
  Work as WorkIcon,
  Schedule as ScheduleIcon,
  Coffee as BreakIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CompleteIcon,
  AccessTime as OvertimeIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Assessment as AnalyticsIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { ScheduleSession } from '@shared/types/schedule-session';

interface SessionStats {
  totalActive: number;
  totalScheduled: number;
  totalCompleted: number;
  totalOnBreak: number;
  totalInOvertime: number;
  totalNoShow: number;
  totalWithErrors: number;
  complianceRate: number;
  punctualityScore: number;
}

interface ComplianceViolation {
  sessionId: string;
  employeeId: string;
  employeeName: string;
  violationType: 'no_show' | 'late_arrival' | 'early_departure' | 'overtime_exceeded' | 'missed_break';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  scheduledTime: Date;
  actualTime?: Date;
  jobSiteName: string;
}

const UnifiedScheduleDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJobSite, setFilterJobSite] = useState('all');
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  // ============================================================================
  // DATA LOADING & REAL-TIME UPDATES
  // ============================================================================

  useEffect(() => {
    if (!currentUser?.companyId) return;

    setLoading(true);
    
    // Set up real-time listener for schedule sessions
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sessionsQuery = query(
      collection(db, 'scheduleSessions'),
      where('companyId', '==', currentUser.companyId),
      where('scheduledStartTime', '>=', Timestamp.fromDate(startOfDay)),
      where('scheduledStartTime', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('scheduledStartTime', 'desc')
    );

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const sessionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          scheduledStartTime: doc.data().scheduledStartTime.toDate(),
          scheduledEndTime: doc.data().scheduledEndTime.toDate(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        })) as ScheduleSession[];

        setSessions(sessionsData);
        setLoading(false);
        
        // Calculate compliance violations
        calculateViolations(sessionsData);
      },
      (error) => {
        console.error('Error fetching sessions:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.companyId, selectedDate]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Sessions are already live-updating via Firestore listener
      // This just updates the timestamp for display purposes
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 1000);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // ============================================================================
  // DATA PROCESSING & CALCULATIONS
  // ============================================================================

  const sessionStats = useMemo((): SessionStats => {
    const stats = sessions.reduce((acc, session) => {
      switch (session.status) {
        case 'scheduled':
        case 'monitoring_active':
          acc.totalScheduled++;
          break;
        case 'clocked_in':
          acc.totalActive++;
          break;
        case 'on_break':
          acc.totalOnBreak++;
          break;
        case 'completed':
          acc.totalCompleted++;
          break;
        case 'no_show':
          acc.totalNoShow++;
          break;
        case 'overtime':
          acc.totalInOvertime++;
          break;
        case 'error':
          acc.totalWithErrors++;
          break;
      }
      
      if (session.errors && session.errors.some((e: { resolved: any; }) => !e.resolved)) {
        acc.totalWithErrors++;
      }
      
      return acc;
    }, {
      totalActive: 0,
      totalScheduled: 0,
      totalCompleted: 0,
      totalOnBreak: 0,
      totalInOvertime: 0,
      totalNoShow: 0,
      totalWithErrors: 0,
      complianceRate: 0,
      punctualityScore: 0,
    });

    // Calculate compliance rate
    const totalSessions = sessions.length;
    const compliantSessions = sessions.filter(s => 
      s.status === 'completed' && 
      s.punctualityScore >= 80 && 
      s.attendanceRate >= 90
    ).length;
    
    stats.complianceRate = totalSessions > 0 ? (compliantSessions / totalSessions) * 100 : 100;
    
    // Calculate average punctuality score
    const punctualitySessions = sessions.filter(s => s.punctualityScore !== undefined);
    stats.punctualityScore = punctualitySessions.length > 0 
      ? punctualitySessions.reduce((sum, s) => sum + s.punctualityScore, 0) / punctualitySessions.length
      : 100;

    return stats;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (filterStatus !== 'all' && session.status !== filterStatus) {
        return false;
      }
      
      if (filterJobSite !== 'all' && session.jobSiteId !== filterJobSite) {
        return false;
      }
      
      return true;
    });
  }, [sessions, filterStatus, filterJobSite]);

  const jobSites = useMemo(() => {
    const sites = new Set(sessions.map(s => ({ id: s.jobSiteId, name: s.jobSiteName })));
    return Array.from(sites);
  }, [sessions]);

  const calculateViolations = (sessions: ScheduleSession[]) => {
    const violations: ComplianceViolation[] = [];
    const now = new Date();

    sessions.forEach(session => {
      // No-show detection (15+ minutes late without arrival)
      if (session.status === 'no_show' || 
          (!session.employeePresent && 
           now.getTime() - session.scheduledStartTime.getTime() > 15 * 60 * 1000)) {
        violations.push({
          sessionId: session.id,
          employeeId: session.employeeId,
          employeeName: session.employeeName,
          violationType: 'no_show',
          severity: 'high',
          description: `Employee has not arrived for scheduled shift`,
          scheduledTime: session.scheduledStartTime,
          jobSiteName: session.jobSiteName,
        });
      }

      // Late arrival detection
      if (session.arrivalTime && session.arrivalTime > session.scheduledStartTime) {
        const lateMinutes = Math.floor((session.arrivalTime.getTime() - session.scheduledStartTime.getTime()) / 60000);
        violations.push({
          sessionId: session.id,
          employeeId: session.employeeId,
          employeeName: session.employeeName,
          violationType: 'late_arrival',
          severity: lateMinutes > 30 ? 'high' : lateMinutes > 15 ? 'medium' : 'low',
          description: `Employee arrived ${lateMinutes} minutes late`,
          scheduledTime: session.scheduledStartTime,
          actualTime: session.arrivalTime,
          jobSiteName: session.jobSiteName,
        });
      }

      // Overtime detection
      if (session.isInOvertime) {
        violations.push({
          sessionId: session.id,
          employeeId: session.employeeId,
          employeeName: session.employeeName,
          violationType: 'overtime_exceeded',
          severity: 'medium',
          description: `Employee is in overtime (${session.totalOvertimeTime} minutes)`,
          scheduledTime: session.scheduledEndTime,
          jobSiteName: session.jobSiteName,
        });
      }

      // Missed break detection (worked 4+ hours without break)
      const workDuration = session.totalWorkedTime;
      const breakDuration = session.totalBreakTime;
      if (workDuration > 240 && breakDuration < 15) { // 4 hours work, less than 15 min break
        violations.push({
          sessionId: session.id,
          employeeId: session.employeeId,
          employeeName: session.employeeName,
          violationType: 'missed_break',
          severity: 'medium',
          description: `Employee worked ${Math.floor(workDuration / 60)}h without adequate break`,
          scheduledTime: session.scheduledStartTime,
          jobSiteName: session.jobSiteName,
        });
      }
    });

    setViolations(violations);
  };

  // ============================================================================
  // ADMIN ACTIONS & OVERRIDES
  // ============================================================================

  const handleAdminOverride = async (sessionId: string, action: string, reason: string) => {
    if (!currentUser) return;
    
    try {
      const sessionRef = doc(db, 'scheduleSessions', sessionId);
      const now = new Date();
      
      const override = {
        id: `override_${Date.now()}`,
        timestamp: Timestamp.fromDate(now),
        adminId: currentUser.uid,
        adminName: currentUser.profile?.firstName || currentUser.email || 'Unknown Admin',
        action,
        reason,
        originalState: {}, // Would need to capture current state
        newState: {}, // Would need to capture new state
      };

      let updates: any = {
        adminOverrides: [...(selectedSession?.adminOverrides || []), override],
        updatedAt: Timestamp.fromDate(now),
        lastModifiedBy: currentUser.uid,
      };

      // Apply specific action updates
      switch (action) {
        case 'force_clock_in':
          updates.clockedIn = true;
          updates.clockInTime = Timestamp.fromDate(now);
          updates.status = 'clocked_in';
          break;
        case 'force_clock_out':
          updates.clockedIn = false;
          updates.clockOutTime = Timestamp.fromDate(now);
          updates.status = 'clocked_out';
          break;
        case 'start_break':
          updates.currentlyOnBreak = true;
          updates.status = 'on_break';
          break;
        case 'end_break':
          updates.currentlyOnBreak = false;
          updates.status = 'clocked_in';
          break;
        case 'terminate_session':
          updates.status = 'completed';
          updates.clockedIn = false;
          break;
        case 'approve_overtime':
          // Update overtime periods to mark as approved
          break;
      }

      await updateDoc(sessionRef, updates);
      
      setOverrideDialogOpen(false);
      setOverrideAction('');
      setOverrideReason('');
      setSelectedSession(null);

      // Show success message
      setAlerts(prev => [...prev, `Successfully applied ${action.replace('_', ' ')} for ${selectedSession?.employeeName}`]);
      setTimeout(() => setAlerts(prev => prev.slice(1)), 5000);

    } catch (error) {
      console.error('Error applying admin override:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Data refreshes automatically via Firestore listener
    setTimeout(() => setRefreshing(false), 1000);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'monitoring_active':
        return 'info';
      case 'clocked_in':
        return 'success';
      case 'on_break':
        return 'warning';
      case 'completed':
        return 'default';
      case 'no_show':
      case 'error':
        return 'error';
      case 'overtime':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <ScheduleIcon />;
      case 'monitoring_active':
        return <LocationIcon />;
      case 'clocked_in':
        return <WorkIcon />;
      case 'on_break':
        return <BreakIcon />;
      case 'completed':
        return <CompleteIcon />;
      case 'no_show':
        return <WarningIcon />;
      case 'overtime':
        return <OvertimeIcon />;
      case 'error':
        return <ErrorIcon />;
      default:
        return <WorkIcon />;
    }
  };

  const getSeverityIconColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'inherit';
    }
  };

  const getSeverityChipColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Schedule Dashboard
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />
          
          <TextField
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            size="small"
            sx={{ width: 150 }}
          />
          
          <Button
            variant="outlined"
            onClick={handleRefresh}
            disabled={refreshing}
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {alerts.map((alert, index) => (
        <Alert key={index} severity="success" sx={{ mb: 2 }} onClose={() => setAlerts(prev => prev.filter((_, i) => i !== index))}>
          {alert}
        </Alert>
      ))}

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Active Sessions
                  </Typography>
                  <Typography variant="h4" component="div">
                    {sessionStats.totalActive}
                  </Typography>
                </Box>
                <WorkIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    On Break
                  </Typography>
                  <Typography variant="h4" component="div">
                    {sessionStats.totalOnBreak}
                  </Typography>
                </Box>
                <BreakIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Compliance Rate
                  </Typography>
                  <Typography variant="h4" component="div">
                    {Math.round(sessionStats.complianceRate)}%
                  </Typography>
                </Box>
                <AnalyticsIcon color={sessionStats.complianceRate >= 90 ? 'success' : 'error'} sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Issues
                  </Typography>
                  <Typography variant="h4" component="div" color={sessionStats.totalWithErrors > 0 ? 'error' : 'textPrimary'}>
                    {sessionStats.totalWithErrors + sessionStats.totalNoShow}
                  </Typography>
                </Box>
                <WarningIcon color={sessionStats.totalWithErrors > 0 ? 'error' : 'disabled'} sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab icon={<DashboardIcon />} label="Live Sessions" />
          <Tab icon={<WarningIcon />} label={`Violations (${violations.length})`} />
          <Tab icon={<AnalyticsIcon />} label="Analytics" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {selectedTab === 0 && (
        <Box>
          {/* Filters */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="monitoring_active">Monitoring</MenuItem>
                <MenuItem value="clocked_in">Active</MenuItem>
                <MenuItem value="on_break">On Break</MenuItem>
                <MenuItem value="overtime">Overtime</MenuItem>
                <MenuItem value="no_show">No Show</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Job Site</InputLabel>
              <Select
                value={filterJobSite}
                label="Job Site"
                onChange={(e) => setFilterJobSite(e.target.value)}
              >
                <MenuItem value="all">All Job Sites</MenuItem>
                {jobSites.map(site => (
                  <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Sessions Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Job Site</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Work Time</TableCell>
                  <TableCell>Compliance</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSessions.map((session) => {
                  // Calculate derived properties
                  const scheduledStart = session.scheduledStartTime;
                  const actualStart = session.clockInTime;
                  const isLate = scheduledStart && actualStart && actualStart > scheduledStart;
                  const hasErrors = session.errors && session.errors.length > 0;
                  const needsAttention = isLate || hasErrors;
                  const statusText = session.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                  
                  return (
                    <TableRow key={session.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {session.employeeName}
                          </Typography>
                          {needsAttention && (
                            <Chip
                              size="small"
                              label="Needs Attention"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </TableCell>
                      
                      <TableCell>{session.jobSiteName}</TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {formatTime(session.scheduledStartTime)} - {formatTime(session.scheduledEndTime)}
                        </Typography>
                        {isLate && (
                          <Chip size="small" label="Late" color="warning" />
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(session.status)}
                          label={statusText}
                          color={getStatusColor(session.status)}
                          size="small"
                        />
                      </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {formatDuration(session.totalWorkedTime)}
                      </Typography>
                      {session.isInOvertime && (
                        <Typography variant="caption" color="error">
                          +{formatDuration(session.totalOvertimeTime)} OT
                        </Typography>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={session.complianceScore}
                          sx={{ width: 60, height: 6 }}
                          color={session.complianceScore >= 80 ? 'success' : 'error'}
                        />
                        <Typography variant="caption">
                          {Math.round(session.complianceScore)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => setSelectedSession(session)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Admin Override">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedSession(session);
                              setOverrideDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {selectedTab === 1 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Compliance Violations
          </Typography>
          
          <List>
            {violations.map((violation, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    <WarningIcon color={getSeverityIconColor(violation.severity)} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${violation.employeeName} - ${violation.violationType.replace('_', ' ')}`}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          {violation.description}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {violation.jobSiteName} • {formatTime(violation.scheduledTime)}
                          {violation.actualTime && ` (actual: ${formatTime(violation.actualTime)})`}
                        </Typography>
                      </Box>
                    }
                  />
                  <Chip
                    label={violation.severity}
                    color={getSeverityChipColor(violation.severity)}
                    size="small"
                  />
                </ListItem>
                {index < violations.length - 1 && <Divider />}
              </React.Fragment>
            ))}
            
            {violations.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="No violations detected"
                  secondary="All employees are in compliance with their schedules"
                />
              </ListItem>
            )}
          </List>
        </Box>
      )}

      {selectedTab === 2 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Schedule Analytics
          </Typography>
          
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardHeader title="Daily Statistics" />
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography>Total Scheduled:</Typography>
                      <Typography fontWeight="bold">{sessionStats.totalScheduled}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography>Completed:</Typography>
                      <Typography fontWeight="bold">{sessionStats.totalCompleted}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography>No Shows:</Typography>
                      <Typography fontWeight="bold" color="error">{sessionStats.totalNoShow}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography>Overtime Sessions:</Typography>
                      <Typography fontWeight="bold" color="warning">{sessionStats.totalInOvertime}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardHeader title="Performance Metrics" />
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Average Punctuality Score</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={sessionStats.punctualityScore}
                        sx={{ mt: 1, height: 8 }}
                        color={sessionStats.punctualityScore >= 80 ? 'success' : 'error'}
                      />
                      <Typography variant="caption">{Math.round(sessionStats.punctualityScore)}%</Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="textSecondary">Overall Compliance Rate</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={sessionStats.complianceRate}
                        sx={{ mt: 1, height: 8 }}
                        color={sessionStats.complianceRate >= 90 ? 'success' : 'error'}
                      />
                      <Typography variant="caption">{Math.round(sessionStats.complianceRate)}%</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Admin Override Dialog */}
      <Dialog
        open={overrideDialogOpen}
        onClose={() => setOverrideDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Admin Override - {selectedSession?.employeeName}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Action</InputLabel>
              <Select
                value={overrideAction}
                label="Action"
                onChange={(e) => setOverrideAction(e.target.value)}
              >
                <MenuItem value="force_clock_in">Force Clock In</MenuItem>
                <MenuItem value="force_clock_out">Force Clock Out</MenuItem>
                <MenuItem value="start_break">Start Break</MenuItem>
                <MenuItem value="end_break">End Break</MenuItem>
                <MenuItem value="terminate_session">Terminate Session</MenuItem>
                <MenuItem value="approve_overtime">Approve Overtime</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason for Override"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why this override is necessary..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => handleAdminOverride(selectedSession!.id, overrideAction, overrideReason)}
            variant="contained"
            disabled={!overrideAction || !overrideReason.trim()}
          >
            Apply Override
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnifiedScheduleDashboard; 