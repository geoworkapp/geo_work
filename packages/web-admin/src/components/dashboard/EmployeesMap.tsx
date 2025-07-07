import React, { useEffect, useRef } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { Box, CircularProgress, Typography } from '@mui/material';

type LatLng = { latitude: number; longitude: number };

type EmployeeMarker = {
  id: string;
  name: string;
  location: LatLng;
};

interface EmployeesMapProps {
  employees: EmployeeMarker[];
}

const MapComponent: React.FC<EmployeesMapProps> = ({ employees }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (mapRef.current && !googleMapRef.current) {
      const center = employees.length
        ? { lat: employees[0].location.latitude, lng: employees[0].location.longitude }
        : { lat: 51.5074, lng: -0.1278 };
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 10,
      });
    }

    if (googleMapRef.current) {
      // Clear previous markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = employees.map(emp => {
        return new google.maps.Marker({
          map: googleMapRef.current!,
          position: { lat: emp.location.latitude, lng: emp.location.longitude },
          title: emp.name,
        });
      });
    }
  }, [employees]);

  return <div ref={mapRef} style={{ width: '100%', height: '400px' }} />;
};

const EmployeesMap: React.FC<EmployeesMapProps> = ({ employees }) => {
  const render = (status: Status) => {
    if (status === Status.LOADING) {
      return (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress />
        </Box>
      );
    }
    if (status === Status.FAILURE) {
      return <Typography color="error">Failed to load Google Maps</Typography>;
    }
    return <MapComponent employees={employees} />;
  };

  return (
    <Wrapper apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string} render={render} />
  );
};

export default React.memo(EmployeesMap); 