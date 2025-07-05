import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Paper,
  Stack
} from '@mui/material';
import {
  LocationOn,
  Save,
  Cancel,
  MyLocation,
  Business,
  
} from '@mui/icons-material';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { JobSite } from '@shared/types';
import { useNavigate } from 'react-router-dom';

// Google Maps styling
const mapOptions: google.maps.MapOptions = {
  center: { lat: 34.7071, lng: 33.0226 }, // Limassol, Cyprus default
  zoom: 13,
  mapTypeControl: true,
  streetViewControl: true,
  fullscreenControl: true,
  zoomControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

interface MapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  onMapClick: (event: google.maps.MapMouseEvent) => void;
  jobSiteLocation?: google.maps.LatLngLiteral;
  radius: number;
  onMarkerDrag: (position: google.maps.LatLngLiteral) => void;
}

const Map: React.FC<MapProps> = ({
  center,
  zoom,
  onMapClick,
  jobSiteLocation,
  radius,
  onMarkerDrag
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  React.useEffect(() => {
    if (mapRef.current && !googleMapRef.current) {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        ...mapOptions,
        center,
        zoom
      });

      googleMapRef.current.addListener('click', onMapClick);
    }
  }, [center, zoom, onMapClick]);

  // Update job site marker and geofence
  React.useEffect(() => {
    if (!googleMapRef.current) return;

    // Remove existing marker and circle
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    if (circleRef.current) {
      circleRef.current.setMap(null);
    }

    if (jobSiteLocation) {
      // Create marker
      markerRef.current = new google.maps.Marker({
        position: jobSiteLocation,
        map: googleMapRef.current,
        title: 'Job Site Location',
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#1976d2',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      // Add drag listener
      markerRef.current.addListener('dragend', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          const position = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
          };
          onMarkerDrag(position);
        }
      });

      // Create geofence circle
      circleRef.current = new google.maps.Circle({
        center: jobSiteLocation,
        radius: radius,
        map: googleMapRef.current,
        fillColor: '#1976d2',
        fillOpacity: 0.1,
        strokeColor: '#1976d2',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        editable: false
      });

      // Center map on job site
      googleMapRef.current.setCenter(jobSiteLocation);
    }
  }, [jobSiteLocation, radius, onMarkerDrag]);

  return <div ref={mapRef} style={{ width: '100%', height: '400px' }} />;
};

const JobSiteCreation: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [siteName, setSiteName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [radius, setRadius] = useState(100); // meters
  const [siteType, setSiteType] = useState<'office' | 'warehouse' | 'retail' | 'construction' | 'other'>('office');
  const [location, setLocation] = useState<google.maps.LatLngLiteral | null>(null);
  
  // Google Places state
  const [addressSuggestions, setAddressSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [placesService, setPlacesService] = useState<google.maps.places.AutocompleteService | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize Google Places service
  React.useEffect(() => {
    function tryInitPlaces() {
      if (window.google && window.google.maps && window.google.maps.places) {
        setPlacesService(new window.google.maps.places.AutocompleteService());
      } else {
        setTimeout(tryInitPlaces, 100); // Try again in 100ms
      }
    }
    tryInitPlaces();
  }, []);

  // Handle address autocomplete
  const handleAddressChange = useCallback((value: string) => {
    setAddress(value);
    
    if (value.length > 2 && placesService) {
      placesService.getPlacePredictions(
        {
          input: value,
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: ['gb', 'gr', 'ru', 'cy', 'ie'] } // European focus
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setAddressSuggestions(predictions.slice(0, 5));
          } else {
            setAddressSuggestions([]);
          }
        }
      );
    } else {
      setAddressSuggestions([]);
    }
  }, [placesService]);

  // Geocode address to coordinates
  const geocodeAddress = useCallback((address: string) => {
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const location = results[0].geometry.location;
        setLocation({
          lat: location.lat(),
          lng: location.lng()
        });
        setAddress(results[0].formatted_address);
        setAddressSuggestions([]);
      } else {
        setError('Could not find the specified address. Please try a different address.');
      }
    });
  }, []);

  // Handle map click
  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const position = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      setLocation(position);
      
      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: position }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          setAddress(results[0].formatted_address);
        }
      });
    }
  }, []);

  // Handle marker drag
  const handleMarkerDrag = useCallback((position: google.maps.LatLngLiteral) => {
    setLocation(position);
    
    // Reverse geocode to update address
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: position }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        setAddress(results[0].formatted_address);
      }
    });
  }, []);

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(userLocation);
          
          // Reverse geocode
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: userLocation }, (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
              setAddress(results[0].formatted_address);
            }
          });
        },
        () => {
          setError('Could not get your current location. Please set location manually.');
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  }, []);

  // Validate form
  const isFormValid = siteName.trim() !== '' && address.trim() !== '' && location !== null;

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid || !currentUser?.companyId || !location) {
      setError('Please fill in all required fields and select a location.');
      return;
    }

    console.log('Creating job site with company ID:', currentUser.companyId);
    setLoading(true);
    setError(null);

    try {
      const jobSiteData: Omit<JobSite, 'siteId'> = {
        companyId: currentUser.companyId,
        siteName: siteName.trim(),
        address: address.trim(),
        location: {
          latitude: location.lat,
          longitude: location.lng
        },
        radius: radius,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('Job site data:', jobSiteData);
      
      const docRef = await addDoc(collection(db, 'jobSites'), {
        ...jobSiteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Job site created with ID:', docRef.id);

      setSuccess(true);
      // Reset form
      setSiteName('');
      setAddress('');
      setDescription('');
      setLocation(null);
      setRadius(100);
      setSiteType('office');
      
      setTimeout(() => {
        navigate('/jobsites');
      }, 2000);
    } catch (err) {
      console.error('Error creating job site:', err);
      setError('Failed to create job site. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const render = (status: Status) => {
    if (status === Status.LOADING) return <CircularProgress />;
    if (status === Status.FAILURE) return <Alert severity="error">Error loading Google Maps</Alert>;
    return <Map
      center={location || { lat: 34.7071, lng: 33.0226 }}
      zoom={location ? 15 : mapOptions.zoom!}
      onMapClick={handleMapClick}
      jobSiteLocation={location || undefined}
      radius={radius}
      onMarkerDrag={handleMarkerDrag}
    />;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Business />
        Create New Job Site
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Define a new job site with geofence boundaries for employee time tracking.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Job site created successfully! Redirecting...
        </Alert>
      )}

      {/* Map Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn />
            Location & Geofence
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click on the map to set the job site location. Drag the marker to adjust.
          </Typography>
          <Box sx={{ height: '400px', width: '100%', borderRadius: 1, overflow: 'hidden' }}>
            <Wrapper apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY!} render={render} />
          </Box>
          <Button
            startIcon={<MyLocation />}
            onClick={getCurrentLocation}
            variant="outlined"
            sx={{ mt: 2 }}
          >
            Use Current Location
          </Button>
        </CardContent>
      </Card>

      {/* Form Section */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Left Column - Basic Details */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Basic Details
            </Typography>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Site Name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
                placeholder="e.g., Downtown Office, Warehouse A"
                helperText="Enter a descriptive name for this job site"
              />

              <FormControl fullWidth>
                <InputLabel>Site Type</InputLabel>
                <Select
                  value={siteType}
                  label="Site Type"
                  onChange={(e) => setSiteType(e.target.value as any)}
                >
                  <MenuItem value="office">Office</MenuItem>
                  <MenuItem value="warehouse">Warehouse</MenuItem>
                  <MenuItem value="retail">Retail Store</MenuItem>
                  <MenuItem value="construction">Construction Site</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Description (Optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={3}
                placeholder="Additional details about this job site..."
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Right Column - Location Details */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Location Details
            </Typography>
            <Stack spacing={3}>
              <Box>
                <TextField
                  fullWidth
                  label="Address"
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  required
                  placeholder="Start typing to search for addresses..."
                  helperText="Enter the job site address or click on the map"
                />
                
                {/* Address Suggestions */}
                {addressSuggestions.length > 0 && (
                  <Paper sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                    {addressSuggestions.map((suggestion) => (
                      <Box
                        key={suggestion.place_id}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          borderBottom: '1px solid',
                          borderColor: 'divider'
                        }}
                        onClick={() => geocodeAddress(suggestion.description)}
                      >
                        <Typography variant="body2">
                          {suggestion.description}
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                )}
              </Box>

              <Box sx={{ 
                p: 2, 
                bgcolor: 'background.default', 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                  Geofence Radius
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {radius}
                  </Typography>
                  <Typography variant="body1" sx={{ ml: 1, color: 'text.secondary' }}>
                    meters
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Employees must be within this radius to clock in/out
                </Typography>
                <Slider
                  value={radius}
                  onChange={(_, value) => setRadius(value as number)}
                  min={50}
                  max={500}
                  step={10}
                  marks={[
                    { value: 50, label: '50m' },
                    { value: 100, label: '100m' },
                    { value: 200, label: '200m' },
                    { value: 500, label: '500m' }
                  ]}
                  valueLabelDisplay="auto"
                  sx={{
                    '& .MuiSlider-rail': {
                      height: 8,
                      bgcolor: 'action.hover'
                    },
                    '& .MuiSlider-track': {
                      height: 8
                    },
                    '& .MuiSlider-thumb': {
                      width: 24,
                      height: 24,
                      '&:before': {
                        boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)'
                      },
                      '&:hover, &.Mui-focusVisible': {
                        boxShadow: '0 0 0 8px rgba(33, 150, 243, 0.16)'
                      }
                    },
                    '& .MuiSlider-mark': {
                      width: 4,
                      height: 4,
                      borderRadius: '50%'
                    },
                    '& .MuiSlider-markLabel': {
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }
                  }}
                />
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  mt: 1,
                  px: 1
                }}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    Minimum (50m)
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    Maximum (500m)
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<Cancel />}
          onClick={() => navigate('/jobsites')}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSubmit}
          disabled={loading || !isFormValid}
        >
          {loading ? <CircularProgress size={24} /> : 'Create Job Site'}
        </Button>
      </Box>
    </Box>
  );
};

export default JobSiteCreation; 