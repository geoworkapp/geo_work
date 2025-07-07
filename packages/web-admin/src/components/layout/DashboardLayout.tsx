import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Badge
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  CalendarMonth as ScheduleIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  Business as BusinessIcon,
  AdminPanelSettings as AdminIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';

interface DashboardLayoutProps {
  contentPadding?: any;
  children?: React.ReactNode;
}

const drawerWidth = 280;

const navigationItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Employees', icon: <PeopleIcon />, path: '/employees' },
  { text: 'Job Sites', icon: <LocationIcon />, path: '/jobsites' },
  { text: 'Schedule', icon: <ScheduleIcon />, path: '/schedule' },
  { text: 'Time Tracking', icon: <TimeIcon />, path: '/time-tracking' },
  { text: 'Reports', icon: <ReportsIcon />, path: '/reports' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const superAdminItems = [
  { text: 'Platform Analytics', icon: <AdminIcon />, path: '/platform/analytics' },
  { text: 'Customer Management', icon: <BusinessIcon />, path: '/platform/customers' },
  { text: 'System Health', icon: <SettingsIcon />, path: '/platform/health' },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  contentPadding = 0,
  children 
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { alerts, unread, markAllRead } = useNotifications();
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pages that need custom padding can override via props
  const shouldApplyPadding = contentPadding !== 0;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await logout();
  };

  const handleNotifClick = (e: React.MouseEvent<HTMLElement>) => {
    setNotifAnchor(e.currentTarget);
    markAllRead();
  };
  const handleNotifClose = () => setNotifAnchor(null);

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'company_admin':
        return 'primary';
      case 'employee':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'company_admin':
        return 'Company Admin';
      case 'employee':
        return 'Employee';
      default:
        return 'User';
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo Section */}
      <Box
        sx={{
          p: 3,
          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <BusinessIcon sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="h5" fontWeight="bold">
          GeoWork
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          Time Tracking Platform
        </Typography>
      </Box>

      {/* User Info */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {currentUser?.email?.charAt(0).toUpperCase()}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="subtitle2" noWrap>
              {currentUser?.email}
            </Typography>
            <Chip 
              label={getRoleLabel(currentUser?.role)} 
              size="small" 
              color={getRoleColor(currentUser?.role)}
              variant="outlined"
            />
          </Box>
        </Box>
        {currentUser?.companyName && (
          <Box mt={1}>
            <Typography variant="caption" color="text.secondary">
              Company: {currentUser.companyName}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation Items */}
      <List sx={{ flex: 1, py: 1 }}>
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/jobsites' && location.pathname.startsWith('/jobsites'));
          
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  backgroundColor: isActive ? 'primary.100' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive ? 'primary.200' : 'primary.50',
                  }
                }}
              >
                <ListItemIcon sx={{ 
                  color: isActive ? 'primary.main' : 'text.secondary' 
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'primary.main' : 'text.primary'
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
        
        {/* Super Admin Section */}
        {currentUser?.role === 'super_admin' && (
          <>
            <Divider sx={{ my: 2, mx: 2 }} />
            <Typography 
              variant="caption" 
              sx={{ 
                px: 3, 
                py: 1, 
                color: 'text.secondary',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: 1
              }}
            >
              Platform Operations
            </Typography>
            {superAdminItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      mx: 1,
                      borderRadius: 2,
                      backgroundColor: isActive ? 'error.100' : 'transparent',
                      '&:hover': {
                        backgroundColor: isActive ? 'error.200' : 'error.50',
                      }
                    }}
                  >
                    <ListItemIcon sx={{ 
                      color: isActive ? 'error.main' : 'text.secondary' 
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isActive ? 600 : 500,
                        fontSize: '0.875rem',
                        color: isActive ? 'error.main' : 'text.primary'
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          {/* Notifications */}
          <IconButton color="inherit" onClick={handleNotifClick}>
            <Badge badgeContent={unread} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          {/* Profile Menu */}
          <IconButton
            onClick={handleProfileMenuOpen}
            sx={{ ml: 2 }}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {currentUser?.email?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            onClick={handleProfileMenuClose}
          >
            <MenuItem onClick={() => navigate('/profile')}>Profile</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>

          <Menu
            anchorEl={notifAnchor}
            open={Boolean(notifAnchor)}
            onClose={handleNotifClose}
            sx={{ maxWidth: 360 }}
          >
            {alerts.length === 0 && (
              <MenuItem disabled>No alerts 🎉</MenuItem>
            )}
            {alerts.map((alert) => (
              <MenuItem key={alert.id} onClick={handleNotifClose} sx={{ whiteSpace: 'normal' }}>
                <ListItemIcon>
                  <NotificationsIcon color={alert.active ? 'error' : 'disabled'} />
                </ListItemIcon>
                <ListItemText
                  primary={`Emp ${alert.employeeId.substring(0, 6)}…`} 
                  secondary={
                    alert.active
                      ? `Outside geofence ${Math.round(alert.distance)}m`
                      : 'Resolved'
                  }
                />
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pt: '64px', // AppBar height
        }}
      >
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: shouldApplyPadding ? contentPadding : 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0, // Critical for nested flex containers
          }}
        >
          <Outlet />
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardLayout; 