import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Paper,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Work as WorkIcon,
  Stop as StopIcon,
  Coffee as CoffeeIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import EmployeesMap from './EmployeesMap';

interface TimeEntry {
  id: string;
  employeeId: string;
  employeeName?: string;
  companyId: string;
  jobSiteId: string;
  jobSiteName: string;
  status: 'clockedIn' | 'clockedOut' | 'onBreak' | 'breakEnded';
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
  };
  distanceFromJobSite: number;
  metadata?: any;
}

interface EmployeeStatus {
  employeeId: string;
  employeeName: string;
  status: 'active' | 'onBreak' | 'clockedOut';
  currentJobSite?: string;
  lastActivity: Date;
  shiftDuration?: number;
  location?: { latitude: number; longitude: number };
}

interface LiveStats {
  totalActive: number;
  totalOnBreak: number;
  totalOffline: number;
  todayEntries: number;
  avgShiftDuration: number;
}

const RealTimeMonitoring: React.FC = () => {
  const { currentUser } = useAuth();
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [liveStats, setLiveStats] = useState<LiveStats>({
    totalActive: 0,
    totalOnBreak: 0,
    totalOffline: 0,
    todayEntries: 0,
    avgShiftDuration: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [liveOnly, setLiveOnly] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.companyId) return;

    // Listen for users to build id -> name map
    const usersQ = query(collection(db, 'users'), where('companyId', '==', currentUser.companyId));
    const unsubUsers = onSnapshot(usersQ, snap => {
      const map: Record<string, string> = {};
      snap.forEach(doc => {
        const d = doc.data();
        const name = d.profile?.firstName || d.profile?.lastName
          ? `${d.profile?.firstName ?? ''} ${d.profile?.lastName ?? ''}`.trim()
                            : d.profile?.firstName || d.email || doc.id;
        map[doc.id] = name;
      });
      setUserMap(map);
    });

    setLoading(true);
    
    // Real-time listener for recent time entries
    const entriesQuery = query(
      collection(db, 'timeEntries'),
      where('companyId', '==', currentUser.companyId),
      orderBy('employeeId'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribeEntries = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const entries: TimeEntry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data?.metadata?.heartbeat) return; // skip heartbeat
          entries.push({
            id: doc.id,
            employeeId: data.employeeId,
            companyId: data.companyId,
            jobSiteId: data.jobSiteId,
            jobSiteName: data.jobSiteName,
            status: data.status,
            timestamp: data.timestamp.toDate(),
            location: data.location,
            distanceFromJobSite: data.distanceFromJobSite || 0,
            metadata: data.metadata,
          });
        });
        
        setRecentEntries(entries);
        updateEmployeeStatuses(entries);
        updateLiveStats(entries);
        setLastUpdate(new Date());
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error listening to time entries:', err);
        setError('Failed to load real-time data');
        setLoading(false);
      }
    );

    return () => {
      unsubUsers();
      unsubscribeEntries();
    };
  }, [currentUser?.companyId]);

  const updateEmployeeStatuses = (entries: TimeEntry[]) => {
    const statusMap = new Map<string, EmployeeStatus>();

    // Process entries to determine current status
    entries.forEach((entry) => {
      const existing = statusMap.get(entry.employeeId);
      
      if (!existing || entry.timestamp > existing.lastActivity) {
        let status: 'active' | 'onBreak' | 'clockedOut' = 'clockedOut';
        
        if (entry.status === 'clockedIn' || entry.status === 'breakEnded') {
          status = 'active';
        } else if (entry.status === 'onBreak') {
          status = 'onBreak';
        }

        statusMap.set(entry.employeeId, {
          employeeId: entry.employeeId,
          employeeName: entry.metadata?.employeeName || `Employee ${entry.employeeId.slice(-4)}`,
          status,
          currentJobSite: status !== 'clockedOut' ? entry.jobSiteName : undefined,
          lastActivity: entry.timestamp,
          shiftDuration: status !== 'clockedOut' ? calculateShiftDuration(entry.employeeId, entries) : undefined,
          location: entry.location,
        });
      }
    });

    setEmployeeStatuses(Array.from(statusMap.values()));
  };

  const updateLiveStats = (entries: TimeEntry[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEntries = entries.filter(entry => entry.timestamp >= today);
    
    // Calculate current employee statuses
    const uniqueEmployees = new Set(entries.map(e => e.employeeId));
    const employeeCurrentStatus = new Map();
    
    uniqueEmployees.forEach(employeeId => {
      const employeeEntries = entries.filter(e => e.employeeId === employeeId);
      if (employeeEntries.length > 0) {
        const latestEntry = employeeEntries[0]; // Already sorted by timestamp desc
        let status = 'clockedOut';
        if (latestEntry.status === 'clockedIn' || latestEntry.status === 'breakEnded') {
          status = 'active';
        } else if (latestEntry.status === 'onBreak') {
          status = 'onBreak';
        }
        employeeCurrentStatus.set(employeeId, status);
      }
    });

    const statusCounts = {
      active: 0,
      onBreak: 0,
      clockedOut: 0,
    };

    employeeCurrentStatus.forEach(status => {
      statusCounts[status as keyof typeof statusCounts]++;
    });

    setLiveStats({
      totalActive: statusCounts.active,
      totalOnBreak: statusCounts.onBreak,
      totalOffline: statusCounts.clockedOut,
      todayEntries: todayEntries.length,
      avgShiftDuration: calculateAverageShiftDuration(),
    });
  };

  const calculateShiftDuration = (employeeId: string, entries: TimeEntry[]): number => {
    const employeeEntries = entries.filter(e => e.employeeId === employeeId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEntries = employeeEntries.filter(e => e.timestamp >= today);
    
    // Find the most recent clock-in
    const latestClockIn = todayEntries.find(e => e.status === 'clockedIn');
    if (latestClockIn) {
      return Math.floor((Date.now() - latestClockIn.timestamp.getTime()) / 1000 / 60); // minutes
    }
    
    return 0;
  };

  const calculateAverageShiftDuration = (): number => {
    // Simplified calculation for demo
    return 450; // 7.5 hours in minutes
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clockedIn':
      case 'breakEnded':
        return 'success';
      case 'clockedOut':
        return 'error';
      case 'onBreak':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'clockedIn':
      case 'breakEnded':
        return <WorkIcon />;
      case 'clockedOut':
        return <StopIcon />;
      case 'onBreak':
        return <CoffeeIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleRefresh = () => {
    setLastUpdate(new Date());
    // The real-time listener will automatically refresh data
  };

  const baseStatuses = liveOnly
    ? employeeStatuses.filter(e => e.status !== 'clockedOut')
    : employeeStatuses;

  const visibleStatuses = selectedEmployeeId
    ? baseStatuses.filter(e => e.employeeId === selectedEmployeeId)
    : baseStatuses;

  const activeMarkers = visibleStatuses
    .filter(e => e.location && e.status === 'active')
    .map(e => ({
      id: e.employeeId,
      name: userMap[e.employeeId] || e.employeeName,
      location: e.location as any
    }));

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Real-Time Monitoring
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {formatTime(lastUpdate)}
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Live Statistics Cards */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: 'repeat(1, 1fr)', 
          sm: 'repeat(2, 1fr)', 
          md: 'repeat(4, 1fr)' 
        }, 
        gap: 3, 
        mb: 4 
      }}>
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
          <WorkIcon sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h4" component="div" fontWeight="bold">
            {liveStats.totalActive}
          </Typography>
          <Typography variant="body2">
            Currently Working
          </Typography>
        </Paper>
        
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
          <CoffeeIcon sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h4" component="div" fontWeight="bold">
            {liveStats.totalOnBreak}
          </Typography>
          <Typography variant="body2">
            On Break
          </Typography>
        </Paper>
        
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light', color: 'error.contrastText' }}>
          <StopIcon sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h4" component="div" fontWeight="bold">
            {liveStats.totalOffline}
          </Typography>
          <Typography variant="body2">
            Clocked Out
          </Typography>
        </Paper>
        
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
          <TrendingUpIcon sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h4" component="div" fontWeight="bold">
            {liveStats.todayEntries}
          </Typography>
          <Typography variant="body2">
            Today's Entries
          </Typography>
        </Paper>
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
        gap: 3 
      }}>
        {/* Employee Status */}
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6">
                {selectedEmployeeId ? `Real-Time – ${userMap[selectedEmployeeId] || selectedEmployeeId}` : 'Employee Status'}
              </Typography>
              {selectedEmployeeId && (
                <Chip label="Back to all" size="small" onClick={() => setSelectedEmployeeId(null)} />
              )}
              <FormControlLabel
                control={<Switch size="small" checked={liveOnly} onChange={e => setLiveOnly(e.target.checked)} />}
                label="Live only"
              />
            </Box>
            
            {visibleStatuses.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No employee activity today
              </Typography>
            ) : (
              <List>
                {visibleStatuses.map((employee, index) => (
                  <React.Fragment key={employee.employeeId}>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => setSelectedEmployeeId(employee.employeeId)}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: employee.status === 'active' ? 'success.main' : employee.status === 'onBreak' ? 'warning.main' : 'error.main' }}>
                            {getStatusIcon(employee.status)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText disableTypography primary={<Typography variant="subtitle2" fontWeight={500}>{userMap[employee.employeeId] || employee.employeeName}</Typography>} secondary={<Box><Typography variant="body2" sx={{ display: 'block' }}>{employee.status === 'active' ? 'Working' : employee.status === 'onBreak' ? 'On Break' : 'Clocked Out'}{employee.currentJobSite && ` at ${employee.currentJobSite}`}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Last activity: {formatTime(employee.lastActivity)}</Typography>{employee.shiftDuration && (<Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Shift duration: {formatDuration(employee.shiftDuration)}</Typography>)}</Box>} />
                      </ListItemButton>
                    </ListItem>
                    {index < visibleStatuses.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Recent Activity
            </Typography>
            
            {recentEntries.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No recent activity
              </Typography>
            ) : (
              <List>
                {recentEntries
                  .filter(e => !selectedEmployeeId || e.employeeId === selectedEmployeeId)
                  .slice(0, 10)
                  .map((entry, index, arr) => (
                  <React.Fragment key={entry.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>
                          {getStatusIcon(entry.status)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        disableTypography
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2">
                              {entry.metadata?.employeeName || userMap[entry.employeeId] || `Employee ${entry.employeeId.slice(-4)}`}
                            </Typography>
                            <Chip
                              label={entry.status === 'clockedIn' ? 'Clocked In' :
                                    entry.status === 'clockedOut' ? 'Clocked Out' :
                                    entry.status === 'onBreak' ? 'Break Start' : 'Break End'}
                              size="small"
                              color={getStatusColor(entry.status) as any}
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" sx={{ display: 'block' }}>
                              <LocationIcon sx={{ fontSize: 12, mr: 0.5 }} />
                              {entry.jobSiteName} ({entry.distanceFromJobSite.toFixed(0)}m away)
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              <TimeIcon sx={{ fontSize: 12, mr: 0.5 }} />
                              {formatTime(entry.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < arr.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Map of active employees */}
        {activeMarkers.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Active Employees Map</Typography>
              <EmployeesMap employees={activeMarkers} />
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default RealTimeMonitoring;