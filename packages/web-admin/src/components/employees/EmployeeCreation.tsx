import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Autocomplete,
  Chip,
  FormHelperText
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';

interface JobSite {
  siteId: string;
  siteName: string;
  address: string;
  companyId: string;
  location: string;
  radius: string;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

const EmployeeCreation: React.FC = () => {
  console.log('EmployeeCreation rendering');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>('employee');
  const [selectedJobSites, setSelectedJobSites] = useState<JobSite[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch available job sites
  useEffect(() => {
    async function fetchJobSites() {
      if (!currentUser?.companyId) {
        console.log('No company ID found in currentUser:', currentUser);
        return;
      }

      console.log('Fetching job sites for company:', currentUser.companyId);
      
      try {
        const jobSitesRef = collection(db, 'jobSites');
        const q = query(jobSitesRef, where('companyId', '==', currentUser.companyId));
        const querySnapshot = await getDocs(q);
        
        console.log('Job sites query snapshot:', querySnapshot.size, 'results');
        
        const sites: JobSite[] = [];
        querySnapshot.forEach((doc) => {
          sites.push({
            siteId: doc.id,
            siteName: doc.data().siteName,
            address: doc.data().address,
            companyId: doc.data().companyId,
            location: doc.data().location,
            radius: doc.data().radius,
            isActive: doc.data().isActive,
            createdAt: doc.data().createdAt,
            updatedAt: doc.data().updatedAt
          });
        });

        console.log('Loaded job sites:', sites);
        setJobSites(sites);
      } catch (err) {
        console.error('Error fetching job sites:', err);
        setError('Failed to load job sites');
      }
    }

    fetchJobSites();
  }, [currentUser?.companyId]);

  // Form validation
  const isFormValid = () => {
    return (
      email.trim() !== '' &&
      firstName.trim() !== '' &&
      lastName.trim() !== '' &&
      (role === 'employee' || role === 'manager' || role === 'admin') &&
      selectedJobSites.length > 0
    );
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!currentUser?.companyId) {
      setError('No company ID found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create the user document
      const userRef = collection(db, 'users');
      await addDoc(userRef, {
        email: email.toLowerCase(),
        firstName,
        lastName,
        role,
        companyId: currentUser.companyId,
        jobSites: selectedJobSites.map(site => site.siteId),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccess(true);
      // Reset form
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('employee');
      setSelectedJobSites([]);

      // Navigate back after success
      setTimeout(() => {
        navigate('/employees');
      }, 2000);
    } catch (err) {
      console.error('Error creating employee:', err);
      setError('Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Add New Employee
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Create a new employee account and assign job sites
        </Typography>
      </Box>

      {/* Error/Success Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Employee created successfully! Redirecting...
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            helperText="Employee will receive an invitation email"
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              fullWidth
            />
          </Stack>

          <FormControl fullWidth required>
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={(e) => setRole(e.target.value as 'employee' | 'manager' | 'admin')}
            >
              <MenuItem value="employee">Employee</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
            <FormHelperText>
              {role === 'admin' ? 'Full access to company settings and employee management' :
               role === 'manager' ? 'Can manage employees and view reports' :
               'Basic time tracking and job site access'}
            </FormHelperText>
          </FormControl>

          <FormControl fullWidth required>
            <Autocomplete
              multiple
              options={jobSites}
              getOptionLabel={(option) => option.siteName || ''}
              isOptionEqualToValue={(option, value) => option.siteId === value.siteId}
              value={selectedJobSites}
              onChange={(_, newValue) => setSelectedJobSites(newValue)}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.siteId}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', py: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      {option.siteName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.address}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Assigned Job Sites"
                  required
                  error={selectedJobSites.length === 0}
                  placeholder={selectedJobSites.length === 0 ? "Select job sites" : ""}
                  helperText="Select the job sites this employee can clock in/out from"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.siteName || 'Unnamed Site'}
                    {...getTagProps({ index })}
                    key={option.siteId}
                    sx={{ maxWidth: '200px' }}
                  />
                ))
              }
              sx={{
                '& .MuiAutocomplete-input': {
                  padding: '8px !important'
                }
              }}
              ListboxProps={{
                sx: { 
                  maxHeight: '300px',
                  '& li': {
                    padding: '8px 16px'
                  }
                }
              }}
            />
          </FormControl>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              onClick={() => navigate('/employees')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!isFormValid() || loading}
            >
              {loading ? 'Creating...' : 'Create Employee'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default EmployeeCreation; 