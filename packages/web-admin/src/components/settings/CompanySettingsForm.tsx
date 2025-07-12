import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';

interface CompanySettings {
  minimumTimeAtSite: number;
  allowClockInEarly: boolean;
  allowClockOutEarly: boolean;
  clockInBuffer: number;
  clockOutBuffer: number;
  overtimeThreshold: number;
  requiredBreakDuration: number;
  requiredBreakInterval: number;
  geofenceExitGracePeriod: number;
}

const defaultSettings: CompanySettings = {
  minimumTimeAtSite: 5,
  allowClockInEarly: false,
  allowClockOutEarly: false,
  clockInBuffer: 15,
  clockOutBuffer: 30,
  overtimeThreshold: 8,
  requiredBreakDuration: 30,
  requiredBreakInterval: 4,
  geofenceExitGracePeriod: 5,
};

export const CompanySettingsForm: React.FC = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!currentUser?.companyId) return;
      try {
        const docRef = doc(db, 'companySettings', currentUser.companyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings({ ...defaultSettings, ...(docSnap.data() as Partial<CompanySettings>) });
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load company settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [currentUser?.companyId]);

  const handleChange = (field: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!currentUser?.companyId) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await setDoc(doc(db, 'companySettings', currentUser.companyId), {
        ...settings,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Company Settings</Typography>
      <Stack spacing={2} maxWidth={400}>
        <TextField
          label="Minimum Time At Site (minutes)"
          type="number"
          value={settings.minimumTimeAtSite}
          onChange={handleChange('minimumTimeAtSite')}
        />
        <TextField
          label="Clock-In Buffer (minutes)"
          type="number"
          value={settings.clockInBuffer}
          onChange={handleChange('clockInBuffer')}
        />
        <TextField
          label="Clock-Out Buffer (minutes)"
          type="number"
          value={settings.clockOutBuffer}
          onChange={handleChange('clockOutBuffer')}
        />
        <TextField
          label="Overtime Threshold (hours)"
          type="number"
          value={settings.overtimeThreshold}
          onChange={handleChange('overtimeThreshold')}
        />
        <TextField
          label="Required Break Duration (minutes)"
          type="number"
          value={settings.requiredBreakDuration}
          onChange={handleChange('requiredBreakDuration')}
        />
        <TextField
          label="Required Break Interval (hours)"
          type="number"
          value={settings.requiredBreakInterval}
          onChange={handleChange('requiredBreakInterval')}
        />
        <TextField
          label="Geofence Exit Grace Period (minutes)"
          type="number"
          value={settings.geofenceExitGracePeriod}
          onChange={handleChange('geofenceExitGracePeriod')}
        />

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Settings updated</Alert>}

        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Stack>
    </Box>
  );
};

export default CompanySettingsForm; 