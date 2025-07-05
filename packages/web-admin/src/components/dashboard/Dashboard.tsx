import React, { Suspense } from 'react';
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
import RealTimeMonitoring from './RealTimeMonitoring';
// Schedule management is now available at /schedule route

// Dashboard stats interface
interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalJobSites: number;
  hoursThisWeek: number;
  overtimeHours: number;
}

// Sample data - this will come from API later
const mockStats: DashboardStats = {
  totalEmployees: 45,
  activeEmployees: 32,
  totalJobSites: 8,
  hoursThisWeek: 1280,
  overtimeHours: 85
};

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

// Sample recent activity data
const recentActivity: RecentActivityItem[] = [
  {
    id: '1',
    user: 'John Smith',
    action: 'Clocked in at Construction Site A',
    time: '2 hours ago',
    status: 'clock-in'
  },
  {
    id: '2',
    user: 'Maria Garcia',
    action: 'Started overtime at Office Building',
    time: '3 hours ago',
    status: 'overtime'
  },
  {
    id: '3',
    user: 'David Johnson',
    action: 'Clocked out from Warehouse B',
    time: '4 hours ago',
    status: 'clock-out'
  },
  {
    id: '4',
    user: 'Sarah Wilson',
    action: 'Started break at Restaurant Site',
    time: '5 hours ago',
    status: 'break'
  }
];

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
  const [currentTab, setCurrentTab] = React.useState(0);
  
  console.log('Dashboard rendering', { mockStats, recentActivity });
  console.log('Current user:', currentUser);

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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
              <RealTimeMonitoring />
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
              {getWelcomeMessage()}, {currentUser?.profile?.firstName || 'User'}
            </Typography>
            
            {/* Stats Grid */}
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
                value={mockStats.totalEmployees}
                icon={<PeopleIcon />}
                color="primary"
                subtitle={`${mockStats.activeEmployees} active now`}
                progress={Math.round((mockStats.activeEmployees / mockStats.totalEmployees) * 100)}
              />
              <StatsCard
                title="Job Sites"
                value={mockStats.totalJobSites}
                icon={<LocationIcon />}
                color="secondary"
              />
              <StatsCard
                title="Hours This Week"
                value={mockStats.hoursThisWeek}
                icon={<TimeIcon />}
                color="success"
                subtitle={`${mockStats.overtimeHours} overtime hours`}
              />
              <StatsCard
                title="Productivity"
                value="92%"
                icon={<TrendingUpIcon />}
                color="warning"
                progress={92}
              />
            </Box>

            {/* Recent Activity */}
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Recent Activity</Typography>
                  <IconButton>
                    <MoreVertIcon />
                  </IconButton>
                </Box>
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
          <Tab label="Real-Time Monitoring" icon={<VisibilityIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {renderTabContent()}
      </Box>
    </Box>
  );
}; 