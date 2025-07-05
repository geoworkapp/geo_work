import React, { useState } from 'react';
import {
  Box,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Paper,
  InputAdornment,
  IconButton,
  Divider,
  Stack,
  Link
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Business as BusinessIcon,
  Google as GoogleIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const { login, loginWithGoogle, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      await login(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    clearError();

    try {
      await loginWithGoogle();
    } catch (error: any) {
      if (error.message === 'USER_NEEDS_ONBOARDING') {
        // Redirect to company registration
        navigate('/register-company');
      } else {
        console.error('Google sign-in failed:', error);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isFormLoading = isLoading || isGoogleLoading;

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'color(srgb 0.98 0.98 0.98)',
          py: 4
        }}
      >
        <Paper
          elevation={12}
          sx={{
            width: '100%',
            maxWidth: 480,
            borderRadius: 3,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              color: 'white',
              py: 4,
              textAlign: 'center'
            }}
          >
            <BusinessIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h4" component="h1" fontWeight="bold">
              GeoWork
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              Time Tracking Admin Dashboard
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              textAlign="center"
              color="text.primary"
              mb={3}
            >
              Welcome Back
            </Typography>

            {error && (
              <Alert 
                severity="error" 
                sx={{ mb: 3 }}
                onClose={clearError}
              >
                {error}
              </Alert>
            )}

            {/* Google Sign-in Button */}
            <Button
              fullWidth
              variant="outlined"
              onClick={handleGoogleSignIn}
              disabled={isFormLoading}
              sx={{
                mb: 3,
                py: 1.5,
                borderRadius: 2,
                borderColor: '#DB4437',
                color: '#DB4437',
                fontSize: '1rem',
                fontWeight: 500,
                '&:hover': {
                  borderColor: '#C23321',
                  backgroundColor: 'rgba(219, 68, 55, 0.04)',
                },
                '&:disabled': {
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                  color: 'rgba(0, 0, 0, 0.26)',
                }
              }}
              startIcon={
                isGoogleLoading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <GoogleIcon />
                )
              }
            >
              {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
            </Button>

            {/* Divider */}
            <Box sx={{ position: 'relative', mb: 3 }}>
              <Divider />
              <Typography
                variant="body2"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'background.paper',
                  px: 2,
                  color: 'text.secondary'
                }}
              >
                or
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit}>
              {/* Email Field */}
              <TextField
                fullWidth
                id="email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                margin="normal"
                autoComplete="email"
                autoFocus
                disabled={isFormLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />

              {/* Password Field */}
              <TextField
                fullWidth
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                autoComplete="current-password"
                disabled={isFormLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePasswordVisibility}
                        edge="end"
                        disabled={isFormLoading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />

              {/* Login Button */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isFormLoading || !email || !password}
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1976D2 30%, #0288D1 90%)',
                  }
                }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </Button>

              {/* Company Registration Link */}
              <Stack spacing={2} alignItems="center" sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Don't have a company account yet?
                </Typography>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={() => navigate('/register-company')}
                  sx={{
                    color: 'primary.main',
                    fontWeight: 600,
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    }
                  }}
                >
                  Register Your Company
                </Link>
              </Stack>
            </Box>
          </CardContent>
        </Paper>

        {/* Footer */}
        <Typography
          variant="body2"
          color="rgba(255, 255, 255, 0.8)"
          textAlign="center"
          sx={{ mt: 4 }}
        >
          Secure geofence-based time tracking for European businesses
        </Typography>
      </Box>
    </Container>
  );
}; 