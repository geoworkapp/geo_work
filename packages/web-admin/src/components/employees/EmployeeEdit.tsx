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
  FormHelperText,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate, useParams } from 'react-router-dom';

interface JobSite {
  siteId: string;
  siteName: string;
  address: string;
  companyId: string;
  location: string;
  radius: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'employee' | 'manager' | 'admin';
  isActive: boolean;
  jobSites: string[];
  companyId: string;
}

const EmployeeEdit: React.FC = () => {
  console.log('EmployeeEdit rendering');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Form state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'employee' | 'manager' | 'admin'>('employee');
  const [selectedJobSites, setSelectedJobSites] = useState<JobSite[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [isActive, setIsActive] = useState(true);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch employee and job sites data
  useEffect(() => {
    async function fetchData() {
      if (!currentUser?.companyId || !id) return;

      try {
        // Fetch employee data
        const employeeDoc = await getDoc(doc(db, 'users', id));
        if (!employeeDoc.exists()) {
          setError('Employee not found');
          setLoading(false);
          return;
        }

        const employeeData = employeeDoc.data() as Employee;
        setEmail(employeeData.email);
        setFirstName(employeeData.firstName);
        setLastName(employeeData.lastName);
        setRole(employeeData.role);
        setIsActive(employeeData.isActive);

        // Fetch job sites
        const jobSitesRef = collection(db, 'jobSites');
        const q = query(jobSitesRef, where('companyId', '==', currentUser.companyId));
        const querySnapshot = await getDocs(q);
        
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

        setJobSites(sites);
        
        // Set selected job sites
        const selectedSites = sites.filter(site => 
          employeeData.jobSites.includes(site.siteId)
        );
        setSelectedJobSites(selectedSites);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load employee data');
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser?.companyId, id]);

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
    if (!currentUser?.companyId || !id) {
      setError('Missing required data');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const employeeRef = doc(db, 'users', id);
      await updateDoc(employeeRef, {
        email: email.toLowerCase(),
        firstName,
        lastName,
        role,
        isActive,
        jobSites: selectedJobSites.map(site => site.siteId),
        updatedAt: serverTimestamp()
      });

      setSuccess(true);
      
      // Navigate back after success
      setTimeout(() => {
        navigate('/employees');
      }, 2000);
    } catch (err) {
      console.error('Error updating employee:', err);
      setError('Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Edit Employee
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Update employee information and access
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
          Employee updated successfully! Redirecting...
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

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={isActive ? 'active' : 'inactive'}
              label="Status"
              onChange={(e) => setIsActive(e.target.value === 'active')}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            <FormHelperText>
              Inactive employees cannot log in or use the system
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
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!isFormValid() || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default EmployeeEdit; 