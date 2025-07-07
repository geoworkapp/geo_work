import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  CircularProgress
} from '@mui/material';

// Context and Components
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { CompanyRegistration } from './components/auth/CompanyRegistration';
import DashboardLayout from './components/layout/DashboardLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import JobSitesList from './components/jobsites/JobSitesList';
import JobSiteCreation from './components/jobsites/JobSiteCreation';
import EmployeesList from './components/employees/EmployeesList';
import EmployeeCreation from './components/employees/EmployeeCreation';
import EmployeeEdit from './components/employees/EmployeeEdit';
import ScheduleManagement from './components/schedule/ScheduleManagement';
import ErrorBoundary from './components/ErrorBoundary';
import { NotificationsProvider } from './contexts/NotificationsContext';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196F3',
      light: '#64B5F6',
      dark: '#1976D2',
    },
    secondary: {
      main: '#FF9800',
      light: '#FFB74D',
      dark: '#F57C00',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px 0 rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    // Ensure CssBaseline doesn't interfere with our full-viewport layout
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          height: '100%',
          width: '100%',
        },
        body: {
          height: '100%',
          width: '100%',
          margin: 0,
          padding: 0,
          overflow: 'hidden', // Prevent body scroll
        },
        '#root': {
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
        },
      },
    },
  },
});

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return currentUser ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to dashboard if already logged in)
interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return currentUser ? <Navigate to="/" replace /> : <>{children}</>;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationsProvider>
          <ErrorBoundary>
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <LoginForm />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register-company"
                  element={
                    <PublicRoute>
                      <CompanyRegistration />
                    </PublicRoute>
                  }
                />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  
                  {/* Job Sites Routes */}
                  <Route path="jobsites" element={<JobSitesList />} />
                  <Route path="jobsites/new" element={<JobSiteCreation />} />
                  
                  {/* Employee Routes */}
                  <Route path="employees" element={<EmployeesList />} />
                  <Route path="employees/new" element={<EmployeeCreation />} />
                  <Route path="employees/edit/:id" element={<EmployeeEdit />} />

                  {/* Schedule Routes */}
                  <Route path="schedule" element={<ScheduleManagement />} />

                  {/* Time Tracking */}
                  <Route path="time-tracking" element={
                    <Box>
                      <h1>Time Tracking Page</h1>
                      <p>Time tracking overview will be implemented in Phase 2</p>
                    </Box>
                  } />

                  {/* Reports */}
                  <Route path="reports" element={
                    <Box>
                      <h1>Reports Page</h1>
                      <p>Reporting dashboard will be implemented in Phase 4</p>
                    </Box>
                  } />

                  {/* Settings */}
                  <Route path="settings" element={
                    <Box>
                      <h1>Settings Page</h1>
                      <p>Settings and configuration will be implemented in Phase 2</p>
                    </Box>
                  } />

                  {/* Super Admin Routes */}
                  <Route path="platform/analytics" element={
                    <Box>
                      <h1>Platform Analytics</h1>
                      <p>Super admin analytics will be implemented in Phase 7</p>
                    </Box>
                  } />

                  <Route path="platform/customers" element={
                    <Box>
                      <h1>Customer Management</h1>
                      <p>Customer management will be implemented in Phase 7</p>
                    </Box>
                  } />

                  <Route path="platform/health" element={
                    <Box>
                      <h1>System Health</h1>
                      <p>System health monitoring will be implemented in Phase 7</p>
                    </Box>
                  } />
                </Route>

                {/* Catch all redirect to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </ErrorBoundary>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
