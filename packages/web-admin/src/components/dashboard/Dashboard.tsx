import React, { Suspense, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  LinearProgress,
  Chip,
  Paper,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingUpIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import UnifiedScheduleDashboard from './UnifiedScheduleDashboard';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
// Schedule management is now available at /schedule route

// Dashboard stats interface
interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalJobSites: number;
  hoursThisWeek: number;
  overtimeHours: number;
}

// Statistics card component
interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  progress?: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color, 
  progress 
}) => {
  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      <CardContent>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: `${color}.main`, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
        
        {progress !== undefined && (
          <Box mt={2}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              color={color}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Recent activity item interface
interface RecentActivityItem {
  id: string;
  user: string;
  action: string;
  time: string;
  status: 'clock-in' | 'clock-out' | 'break' | 'overtime';
}

// Helper to convert Firestore Timestamp to JS Date consistently
const toDate = (ts: Timestamp | Date) => (ts instanceof Timestamp ? ts.toDate() : ts as Date);

const getStatusColor = (status: string) => {
  switch (status) {
    case 'clock-in':
      return 'success';
    case 'clock-out':
      return 'primary';
    case 'overtime':
      return 'warning';
    case 'break':
      return 'info';
    default:
      return 'default';
  }
};

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            Something went wrong loading this component.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please try refreshing the page or contact support if the issue persists.
          </Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [entriesData, setEntriesData] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // Listen for dashboard data
  useEffect(() => {
    if (!currentUser?.companyId) return;

    const companyId = currentUser.companyId;

    // Employees collection
    const usersQ = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubUsers = onSnapshot(usersQ, (snapshot) => {
      const totalEmployees = snapshot.size;

      // Build UID -> Name map
      const map: Record<string, string> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const name = data.profile?.firstName || data.profile?.lastName
          ? `${data.profile?.firstName ?? ''} ${data.profile?.lastName ?? ''}`.trim()
                          : data.profile?.firstName || data.email || doc.id;
        map[doc.id] = name;
      });
      setUserMap(map);

      // We'll update activeEmployees later using timeEntries
      setStats((prev) => ({
        totalEmployees,
        activeEmployees: prev?.activeEmployees ?? 0,
        totalJobSites: prev?.totalJobSites ?? 0,
        hoursThisWeek: prev?.hoursThisWeek ?? 0,
        overtimeHours: prev?.overtimeHours ?? 0,
      }));
      setLoadingStats(false);
    });

    // Job sites collection
    const jobSitesQ = query(collection(db, 'jobSites'), where('companyId', '==', companyId));
    const unsubSites = onSnapshot(jobSitesQ, (snapshot) => {
      setStats((prev) => ({
        totalEmployees: prev?.totalEmployees ?? 0,
        activeEmployees: prev?.activeEmployees ?? 0,
        totalJobSites: snapshot.size,
        hoursThisWeek: prev?.hoursThisWeek ?? 0,
        overtimeHours: prev?.overtimeHours ?? 0,
      }));
    });

    // Time Entries (recent)
    const entriesQ = query(
      collection(db, 'timeEntries'),
      where('companyId', '==', companyId),
      orderBy('employeeId'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubEntries = onSnapshot(entriesQ, (snapshot) => {
      const entries: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({ id: doc.id, ...data });
      });

      // Build recent activity list (latest 10)
      setEntriesData(entries);
      setLoadingActivity(false);

      // Calculate active employees (latest status per employee)
      const latestStatusMap = new Map<string, string>();
      entries.forEach((entry) => {
        if (!latestStatusMap.has(entry.employeeId)) {
          latestStatusMap.set(entry.employeeId, entry.status);
        }
      });
      let activeEmployees = 0;
      latestStatusMap.forEach((status) => {
        if (status === 'clockedIn' || status === 'breakEnded') {
          activeEmployees += 1;
        }
      });

      setStats((prev) => ({
        totalEmployees: prev?.totalEmployees ?? 0,
        activeEmployees,
        totalJobSites: prev?.totalJobSites ?? 0,
        hoursThisWeek: prev?.hoursThisWeek ?? 0,
        overtimeHours: prev?.overtimeHours ?? 0,
      }));
    });

    return () => {
      unsubUsers();
      unsubSites();
      unsubEntries();
    };
  }, [currentUser?.companyId]);

  // Recompute recent activity whenever entriesData or userMap changes
  useEffect(() => {
    if (entriesData.length === 0) return;
    const activity: RecentActivityItem[] = entriesData.slice(0, 10).map((entry) => ({
      id: entry.id,
      user: entry.metadata?.employeeName || userMap[entry.employeeId] || `Employee ${entry.employeeId?.slice(-4)}`,
      action: entry.status === 'clockedIn' ? `Clocked in at ${entry.jobSiteName}` : entry.status === 'clockedOut' ? `Clocked out from ${entry.jobSiteName}` : entry.status === 'onBreak' ? `Started break at ${entry.jobSiteName}` : `Resumed at ${entry.jobSiteName}`,
      time: timeAgo(toDate(entry.timestamp)),
      status: mapStatus(entry.status),
    }));
    setRecentActivity(activity);
  }, [entriesData, userMap]);

  // Helpers
  const timeAgo = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  };

  const mapStatus = (status: string): RecentActivityItem['status'] => {
    switch (status) {
      case 'clockedIn':
      case 'breakEnded':
        return 'clock-in';
      case 'clockedOut':
        return 'clock-out';
      case 'onBreak':
        return 'break';
      default:
        return 'overtime';
    }
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getDisplayName = () => {
    if (currentUser?.profile?.firstName || currentUser?.profile?.lastName) {
      return `${currentUser.profile?.firstName ?? ''} ${currentUser.profile?.lastName ?? ''}`.trim();
    }
    if (currentUser?.profile?.firstName) return `${currentUser.profile.firstName} ${currentUser.profile.lastName || ''}`.trim();
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'User';
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 1:
        return (
          <ErrorBoundary>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>}>
              <UnifiedScheduleDashboard />
            </Suspense>
          </ErrorBoundary>
        );

      default:
        return (
          <Box sx={{ 
            width: '100%',
            maxWidth: '1400px', // Max width for content readability
            mx: 'auto', // Center the content
            p: { xs: 2, sm: 3, md: 4 }, // Responsive padding
          }}>
            {/* Welcome Message */}
            <Typography variant="h4" gutterBottom>
              {getWelcomeMessage()}, {getDisplayName()}
            </Typography>
            
            {/* Stats Grid */}
            {loadingStats || !stats ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box 
                display="grid" 
                gridTemplateColumns={{
                  xs: "repeat(1, 1fr)",
                  sm: "repeat(2, 1fr)", 
                  md: "repeat(4, 1fr)"
                }}
                gap={3} 
                my={3}
              >
                <StatsCard
                  title="Total Employees"
                  value={stats.totalEmployees}
                  icon={<PeopleIcon />}
                  color="primary"
                  subtitle={`${stats.activeEmployees} active now`}
                  progress={stats.totalEmployees > 0 ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100) : 0}
                />
                <StatsCard
                  title="Job Sites"
                  value={stats.totalJobSites}
                  icon={<LocationIcon />}
                  color="secondary"
                />
                <StatsCard
                  title="Hours This Week"
                  value={stats.hoursThisWeek}
                  icon={<TimeIcon />}
                  color="success"
                  subtitle={`${stats.overtimeHours} overtime hours`}
                />
                <StatsCard
                  title="Productivity"
                  value={stats.totalEmployees > 0 ? `${Math.round((stats.activeEmployees / stats.totalEmployees) * 100)}%` : 'N/A'}
                  icon={<TrendingUpIcon />}
                  color="warning"
                  progress={stats.totalEmployees > 0 ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100) : 0}
                />
              </Box>
            )}

            {/* Recent Activity */}
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Recent Activity</Typography>
                  <IconButton>
                    <MoreVertIcon />
                  </IconButton>
                </Box>
                {loadingActivity ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : (
                  <Box>
                    {recentActivity.map((activity) => (
                      <Paper
                        key={activity.id}
                        sx={{
                          p: 2,
                          mb: 2,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle1">{activity.user}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {activity.action}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Chip
                            label={activity.status}
                            color={getStatusColor(activity.status) as any}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {activity.time}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        );
    }
  };

  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '100%',
      height: '100%'
    }}>
      {/* Tab Navigation */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider', 
        mb: 0,
        px: 3,
        backgroundColor: 'background.paper'
      }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Schedule Sessions" icon={<VisibilityIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {renderTabContent()}
      </Box>
    </Box>
  );
}; 