import React from 'react';
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
} from '@mui/material';
import {
  People as PeopleIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingUpIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

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

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  console.log('Dashboard rendering', { mockStats, recentActivity });
  console.log('Current user:', currentUser);

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Box>
      {/* Welcome Header */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          {getWelcomeMessage()}, {currentUser?.email?.split('@')[0]}! 👋
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Here's what's happening with your team today
        </Typography>
      </Box>

      {/* Statistics Cards */}
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
        <StatsCard
          title="Total Employees"
          value={mockStats.totalEmployees}
          subtitle={`${mockStats.activeEmployees} currently active`}
          icon={<PeopleIcon />}
          color="primary"
          progress={Math.round((mockStats.activeEmployees / mockStats.totalEmployees) * 100)}
        />
        
        <StatsCard
          title="Job Sites"
          value={mockStats.totalJobSites}
          subtitle="Active locations"
          icon={<LocationIcon />}
          color="secondary"
        />
        
        <StatsCard
          title="Hours This Week"
          value={mockStats.hoursThisWeek}
          subtitle="Total tracked hours"
          icon={<TimeIcon />}
          color="success"
        />
        
        <StatsCard
          title="Overtime Hours"
          value={mockStats.overtimeHours}
          subtitle="This week"
          icon={<TrendingUpIcon />}
          color="warning"
        />
      </Box>

      {/* Content Grid */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, 
        gap: 3 
      }}>
        {/* Recent Activity */}
        <Box>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" fontWeight="bold">
                Recent Activity
              </Typography>
              <IconButton>
                <MoreVertIcon />
              </IconButton>
            </Box>
            
            <Box>
              {recentActivity.map((item, index) => (
                <Box 
                  key={item.id}
                  display="flex" 
                  alignItems="center" 
                  py={2}
                  borderBottom={index < recentActivity.length - 1 ? 1 : 0}
                  borderColor="divider"
                >
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    {item.user.split(' ').map(n => n[0]).join('')}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {item.user}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.action}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Chip 
                      label={item.status.replace('-', ' ')} 
                      size="small" 
                      color={getStatusColor(item.status)}
                      variant="outlined"
                    />
                    <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
                      {item.time}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        {/* Quick Actions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight="bold" mb={3}>
            Quick Actions
          </Typography>
          
          <Box display="flex" flexDirection="column" gap={2}>
            <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <CardContent sx={{ py: 2 }}>
                <Box display="flex" alignItems="center">
                  <PeopleIcon color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Add New Employee
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Invite team members
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <CardContent sx={{ py: 2 }}>
                <Box display="flex" alignItems="center">
                  <LocationIcon color="secondary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Create Job Site
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Set up geofences
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <CardContent sx={{ py: 2 }}>
                <Box display="flex" alignItems="center">
                  <TrendingUpIcon color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Generate Report
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Weekly summary
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}; 