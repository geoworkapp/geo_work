import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack
} from '@mui/material';
import {
  Add,
  Search,
  LocationOn,
  Edit,
  Delete,
  People,
  Business
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import type { JobSite } from '../../../../shared/types/index';

const JobSitesList: React.FC = () => {
  console.log('JobSitesList rendering');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Fetch job sites in real-time
  useEffect(() => {
    if (!currentUser?.companyId) return;

    const q = query(
      collection(db, 'jobSites'),
      where('companyId', '==', currentUser.companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sites: JobSite[] = [];
      snapshot.forEach((doc) => {
        sites.push({ siteId: doc.id, ...doc.data() } as JobSite);
      });
      setJobSites(sites);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.companyId]);

  // Filter job sites
  const filteredJobSites = jobSites.filter(site => {
    const matchesSearch = site.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && site.isActive) ||
                         (statusFilter === 'inactive' && !site.isActive);
    return matchesSearch && matchesStatus;
  });

  // Statistics
  const stats = {
    total: jobSites.length,
    active: jobSites.filter(site => site.isActive).length,
    inactive: jobSites.filter(site => !site.isActive).length
  };

  // Toggle job site status
  const toggleSiteStatus = async (siteId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'jobSites', siteId), {
        isActive: !currentStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating job site status:', error);
    }
  };

  // Delete job site
  const deleteSite = async (siteId: string) => {
    if (window.confirm('Are you sure you want to delete this job site? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'jobSites', siteId));
      } catch (error) {
        console.error('Error deleting job site:', error);
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business />
            Job Sites
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your company's job sites and geofence boundaries.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/jobsites/new')}
        >
          Create Job Site
        </Button>
      </Box>

      {/* Statistics */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 120, flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {stats.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Sites
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 120, flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {stats.active}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Sites
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 120, flex: 1 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {stats.inactive}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inactive Sites
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search job sites..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
          sx={{ flex: 1, minWidth: 250 }}
        />
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <MenuItem value="all">All Sites</MenuItem>
            <MenuItem value="active">Active Only</MenuItem>
            <MenuItem value="inactive">Inactive Only</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Job Sites List */}
      {filteredJobSites.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Business sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {jobSites.length === 0 ? 'No job sites yet' : 'No job sites match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {jobSites.length === 0 
                ? 'Create your first job site to start tracking employee attendance with geofencing.'
                : 'Try adjusting your search terms or filters to find the job sites you\'re looking for.'
              }
            </Typography>
            {jobSites.length === 0 && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/jobsites/new')}
              >
                Create Your First Job Site
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {filteredJobSites.map((site) => (
            <Card key={site.siteId}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6">
                        {site.siteName}
                      </Typography>
                      <Chip
                        label={site.isActive ? 'Active' : 'Inactive'}
                        color={site.isActive ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocationOn fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {site.address}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      Geofence: {site.radius}m radius • Created recently
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<People />}
                      onClick={() => navigate(`/job-sites/${site.siteId}/employees`)}
                    >
                      Manage Employees
                    </Button>
                    
                    <IconButton
                      onClick={() => toggleSiteStatus(site.siteId, site.isActive)}
                      color={site.isActive ? 'warning' : 'success'}
                    >
                      <Edit />
                    </IconButton>
                    
                    <IconButton
                      onClick={() => deleteSite(site.siteId)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default JobSitesList; 