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
  Stack,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Business as BusinessIcon,
  Google as GoogleIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useAuth, type CompanyRegistrationData } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type RegistrationType = 'google' | 'email' | null;

const industries = [
  'Construction',
  'Healthcare',
  'Retail',
  'Manufacturing',
  'Transportation',
  'Technology',
  'Education',
  'Hospitality',
  'Professional Services',
  'Other'
];

const employeeCounts = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+'
];

const countries = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'GR', name: 'Greece' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'MT', name: 'Malta' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'PT', name: 'Portugal' },
  { code: 'LU', name: 'Luxembourg' }
];

const steps = ['Choose Method', 'Company Details', 'Complete Setup'];

export const CompanyRegistration: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [registrationType, setRegistrationType] = useState<RegistrationType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<CompanyRegistrationData & { confirmPassword?: string }>({
    companyName: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    phoneNumber: '',
    industry: '',
    employeeCount: '',
    country: 'GB'
  });

  const { registerCompanyWithGoogle, registerCompanyWithEmail, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (field: keyof typeof formData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
  };

  const handleSelectChange = (field: keyof typeof formData) => (
    event: SelectChangeEvent<string>
  ) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
  };

  const handleGoogleRegistration = async () => {
    if (activeStep !== 1) return;
    
    setIsLoading(true);
    clearError();

    try {
      const { confirmPassword, adminPassword, ...registrationData } = formData;
      await registerCompanyWithGoogle(registrationData);
      setActiveStep(2);
    } catch (error) {
      console.error('Google registration failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailRegistration = async () => {
    if (activeStep !== 1) return;
    
    setIsLoading(true);
    clearError();

    try {
      if (formData.adminPassword !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const { confirmPassword, ...registrationData } = formData;
      await registerCompanyWithEmail(registrationData);
      setActiveStep(2);
    } catch (error) {
      console.error('Email registration failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (registrationType === 'google') {
      await handleGoogleRegistration();
    } else if (registrationType === 'email') {
      await handleEmailRegistration();
    }
  };

  const isStepValid = () => {
    switch (activeStep) {
      case 0:
        return registrationType !== null;
      case 1:
        const basicValid = formData.companyName && formData.adminFirstName && 
                          formData.adminLastName && formData.adminEmail;
        if (registrationType === 'email') {
          return basicValid && formData.adminPassword && 
                 formData.confirmPassword && 
                 formData.adminPassword === formData.confirmPassword &&
                 formData.adminPassword.length >= 6;
        }
        return basicValid;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (activeStep === 1) {
      handleSubmit();
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep === 0) {
      navigate('/login');
    } else {
      setActiveStep(prev => prev - 1);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={3}>
            <Typography variant="h6" textAlign="center" gutterBottom>
              Choose your registration method
            </Typography>
            
            <Button
              fullWidth
              variant={registrationType === 'google' ? 'contained' : 'outlined'}
              onClick={() => setRegistrationType('google')}
              sx={{
                py: 2,
                borderRadius: 2,
                fontSize: '1rem',
                fontWeight: 500,
                borderColor: registrationType === 'google' ? '#DB4437' : '#DB4437',
                color: registrationType === 'google' ? 'white' : '#DB4437',
                backgroundColor: registrationType === 'google' ? '#DB4437' : 'transparent',
                '&:hover': {
                  backgroundColor: registrationType === 'google' ? '#C23321' : 'rgba(219, 68, 55, 0.04)',
                  borderColor: '#C23321',
                }
              }}
              startIcon={<GoogleIcon />}
            >
              Continue with Google (Recommended)
            </Button>

            <Button
              fullWidth
              variant={registrationType === 'email' ? 'contained' : 'outlined'}
              onClick={() => setRegistrationType('email')}
              sx={{
                py: 2,
                borderRadius: 2,
                fontSize: '1rem',
                fontWeight: 500,
              }}
              startIcon={<EmailIcon />}
            >
              Register with Email & Password
            </Button>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Google sign-in provides faster setup and enhanced security
            </Typography>
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <Typography variant="h6" textAlign="center" gutterBottom>
              Company Information
            </Typography>

            <TextField
              fullWidth
              label="Company Name"
              value={formData.companyName}
              onChange={handleInputChange('companyName')}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Admin First Name"
                value={formData.adminFirstName}
                onChange={handleInputChange('adminFirstName')}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Admin Last Name"
                value={formData.adminLastName}
                onChange={handleInputChange('adminLastName')}
                required
              />
            </Stack>

            {registrationType === 'email' && (
              <TextField
                fullWidth
                label="Admin Email"
                type="email"
                value={formData.adminEmail}
                onChange={handleInputChange('adminEmail')}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            )}

            {registrationType === 'email' && (
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.adminPassword}
                  onChange={handleInputChange('adminPassword')}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Minimum 6 characters"
                />
                <TextField
                  fullWidth
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  required
                  error={formData.confirmPassword !== '' && formData.adminPassword !== formData.confirmPassword}
                  helperText={
                    formData.confirmPassword !== '' && formData.adminPassword !== formData.confirmPassword
                      ? 'Passwords do not match'
                      : ''
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
            )}

            <TextField
              fullWidth
              label="Phone Number (Optional)"
              value={formData.phoneNumber}
              onChange={handleInputChange('phoneNumber')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Industry</InputLabel>
                <Select
                  value={formData.industry}
                  onChange={handleSelectChange('industry')}
                  label="Industry"
                >
                  {industries.map((industry) => (
                    <MenuItem key={industry} value={industry}>
                      {industry}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Employee Count</InputLabel>
                <Select
                  value={formData.employeeCount}
                  onChange={handleSelectChange('employeeCount')}
                  label="Employee Count"
                >
                  {employeeCounts.map((count) => (
                    <MenuItem key={count} value={count}>
                      {count}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <FormControl fullWidth>
              <InputLabel>Country</InputLabel>
              <Select
                value={formData.country}
                onChange={handleSelectChange('country')}
                label="Country"
              >
                {countries.map((country) => (
                  <MenuItem key={country.code} value={country.code}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3} alignItems="center">
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
            <Typography variant="h5" textAlign="center" gutterBottom>
              Welcome to GeoWork!
            </Typography>
            <Typography variant="body1" textAlign="center" color="text.secondary">
              Your company account has been successfully created. You can now start managing your team and tracking time.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/')}
              sx={{ mt: 2 }}
            >
              Go to Dashboard
            </Button>
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <Container component="main" maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%,rgb(255, 255, 255) 100%)',
          py: 4
        }}
      >
        <Paper
          elevation={12}
          sx={{
            width: '100%',
            maxWidth: 600,
            borderRadius: 3,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              color: 'white',
              py: 3,
              textAlign: 'center'
            }}
          >
            <BusinessIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h5" component="h1" fontWeight="bold">
              Register Your Company
            </Typography>
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
              Start your free GeoWork trial today
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && (
              <Alert 
                severity="error" 
                sx={{ mb: 3 }}
                onClose={clearError}
              >
                {error}
              </Alert>
            )}

            {renderStepContent()}

            {/* Navigation Buttons */}
            {activeStep !== 2 && (
              <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
                <Button
                  onClick={handleBack}
                  startIcon={<ArrowBackIcon />}
                  sx={{ flex: 1 }}
                >
                  {activeStep === 0 ? 'Back to Login' : 'Back'}
                </Button>
                
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!isStepValid() || isLoading}
                  sx={{ flex: 2 }}
                >
                  {isLoading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : activeStep === steps.length - 2 ? (
                    registrationType === 'google' ? 'Register with Google' : 'Create Account'
                  ) : (
                    'Next'
                  )}
                </Button>
              </Stack>
            )}
          </CardContent>
        </Paper>

        {/* Footer */}
        <Typography
          variant="body2"
          color="rgba(255, 255, 255, 0.8)"
          textAlign="center"
          sx={{ mt: 3 }}
        >
          Already have an account?{' '}
          <Link
            component="button"
            onClick={() => navigate('/login')}
            sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}
          >
            Sign In
          </Link>
        </Typography>
      </Box>
    </Container>
  );
}; 