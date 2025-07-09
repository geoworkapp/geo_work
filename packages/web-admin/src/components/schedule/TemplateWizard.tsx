import React, { useState, useEffect } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Button,
  TextField,
  Grid,
  Paper,
  IconButton,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Slider,
  Autocomplete,
  Chip,
  Stack,
  LinearProgress,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateNext as NextIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Schedule as ScheduleIcon,
  Repeat as RepeatIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Assignment as TaskIcon,
} from '@mui/icons-material';
import { LocalizationProvider, TimePicker as MuiTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { motion, AnimatePresence } from 'framer-motion';
import { format, setHours, setMinutes } from 'date-fns';

import { useAuth } from '../../contexts/AuthContext';
import { useCalendar } from '../../contexts/CalendarContext';
import templateService, { type CreateTemplateData } from '../../services/templateService';
import type { ScheduleTemplate } from '@shared/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface TemplateWizardProps {
  open: boolean;
  onClose: () => void;
  onSave?: (template: ScheduleTemplate) => void;
  editTemplate?: ScheduleTemplate | null;
  mode?: 'create' | 'edit' | 'duplicate';
}

interface WizardStep {
  label: string;
  description: string;
  icon: React.ReactNode;
  optional?: boolean;
}

interface TemplateFormData extends Omit<CreateTemplateData, 'defaultStartTime' | 'defaultEndTime'> {
  defaultStartTime: Date;
  defaultEndTime: Date;
}

interface ValidationErrors {
  [key: string]: string;
}

interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: Date;
  occurrences?: number;
}

// ============================================================================
// TEMPLATE WIZARD COMPONENT
// ============================================================================

const TemplateWizard: React.FC<TemplateWizardProps> = ({
  open,
  onClose,
  onSave,
  editTemplate,
  mode = 'create',
}) => {
  const { currentUser } = useAuth();
  const { state } = useCalendar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  const [skipped, setSkipped] = useState(new Set<number>());
  const [loading, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Form data
  const [formData, setFormData] = useState<TemplateFormData>({
    templateName: '',
    description: '',
    jobSiteId: '',
    shiftType: 'regular',
    duration: 8,
    breakDuration: 30,
    defaultStartTime: setHours(setMinutes(new Date(), 0), 9), // 9:00 AM
    defaultEndTime: setHours(setMinutes(new Date(), 0), 17), // 5:00 PM
    recurrence: {
      type: 'daily',
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    },
    skillsRequired: [],
    equipmentNeeded: [],
    specialInstructions: '',
    tags: [],
    isPublic: false,
  });

  // Additional wizard state
  const [availableSkills] = useState<string[]>([
    'Forklift Operation',
    'Safety Certified',
    'Heavy Lifting',
    'Quality Control',
    'Team Leadership'
  ]);
  const [availableEquipment] = useState<string[]>([
    'Forklift',
    'Safety Gear',
    'Hand Tools',
    'Measuring Equipment',
    'Computer/Tablet'
  ]);
  const [suggestedTags] = useState<string[]>([
    'urgent',
    'training',
    'overtime',
    'weekend',
    'holiday',
    'maintenance'
  ]);

  // ============================================================================
  // WIZARD STEPS CONFIGURATION
  // ============================================================================

  const steps: WizardStep[] = [
    {
      label: 'Basic Information',
      description: 'Template name, description, and job site',
      icon: <InfoIcon />,
    },
    {
      label: 'Schedule Details',
      description: 'Shift type, duration, and timing',
      icon: <ScheduleIcon />,
    },
    {
      label: 'Recurrence Pattern',
      description: 'How often this template repeats',
      icon: <RepeatIcon />,
      optional: true,
    },
    {
      label: 'Requirements',
      description: 'Skills, equipment, and special instructions',
      icon: <TaskIcon />,
      optional: true,
    },
    {
      label: 'Review & Save',
      description: 'Preview and save your template',
      icon: <CheckIcon />,
    },
  ];

  // ============================================================================
  // INITIALIZATION & EFFECTS
  // ============================================================================

  useEffect(() => {
    if (editTemplate && (mode === 'edit' || mode === 'duplicate')) {
      populateFormFromTemplate(editTemplate);
    } else if (!open) {
      resetForm();
    }
  }, [editTemplate, mode, open]);

  const populateFormFromTemplate = (template: ScheduleTemplate) => {
    setFormData({
      templateName: mode === 'duplicate' ? `${template.templateName} (Copy)` : template.templateName,
      description: template.description,
      jobSiteId: template.jobSiteId,
      shiftType: template.shiftType,
      duration: template.duration,
      breakDuration: template.breakDuration,
      defaultStartTime: parseTimeString(template.defaultStartTime),
      defaultEndTime: parseTimeString(template.defaultEndTime),
      recurrence: template.recurrence,
      skillsRequired: template.skillsRequired || [],
      equipmentNeeded: template.equipmentNeeded || [],
      specialInstructions: template.specialInstructions,
      tags: [],
      isPublic: false,
    });
  };

  const resetForm = () => {
    setFormData({
      templateName: '',
      description: '',
      jobSiteId: '',
      shiftType: 'regular',
      duration: 8,
      breakDuration: 30,
      defaultStartTime: setHours(setMinutes(new Date(), 0), 9),
      defaultEndTime: setHours(setMinutes(new Date(), 0), 17),
      recurrence: {
        type: 'daily',
        interval: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      skillsRequired: [],
      equipmentNeeded: [],
      specialInstructions: '',
      tags: [],
      isPublic: false,
    });
    setActiveStep(0);
    setSkipped(new Set());
    setErrors({});
  };

  const parseTimeString = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return setHours(setMinutes(new Date(), minutes), hours);
  };

  const formatTimeToString = (date: Date): string => {
    return format(date, 'HH:mm');
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validateStep = (step: number): boolean => {
    const newErrors: ValidationErrors = {};

    switch (step) {
      case 0: // Basic Information
        if (!formData.templateName.trim()) {
          newErrors.templateName = 'Template name is required';
        } else if (formData.templateName.length < 3) {
          newErrors.templateName = 'Template name must be at least 3 characters';
        }
        break;

      case 1: // Schedule Details
        if (formData.duration <= 0) {
          newErrors.duration = 'Duration must be greater than 0';
        }
        if (formData.breakDuration < 0) {
          newErrors.breakDuration = 'Break duration cannot be negative';
        }
        if (formData.defaultStartTime >= formData.defaultEndTime) {
          newErrors.defaultEndTime = 'End time must be after start time';
        }
        break;

      case 2: // Recurrence Pattern
        if (formData.recurrence.interval <= 0) {
          newErrors.recurrenceInterval = 'Interval must be greater than 0';
        }
        if (formData.recurrence.type === 'weekly' && 
            (!formData.recurrence.daysOfWeek || formData.recurrence.daysOfWeek.length === 0)) {
          newErrors.daysOfWeek = 'At least one day must be selected for weekly recurrence';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const isStepOptional = (step: number) => {
    return steps[step]?.optional || false;
  };

  const isStepSkipped = (step: number) => {
    return skipped.has(step);
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      let newActiveStep = activeStep + 1;
      
      if (isStepSkipped(newActiveStep)) {
        newActiveStep++;
      }
      
      setActiveStep(newActiveStep);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSkip = () => {
    if (!isStepOptional(activeStep)) {
      throw new Error("You can't skip a step that isn't optional.");
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setSkipped((prevSkipped) => {
      const newSkipped = new Set(prevSkipped.values());
      newSkipped.add(activeStep);
      return newSkipped;
    });
  };

  const handleStepClick = (step: number) => {
    // Allow jumping to any previous step or current step
    if (step <= activeStep) {
      setActiveStep(step);
    }
  };

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const handleInputChange = (field: keyof TemplateFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear related errors
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleArrayAdd = (field: 'skillsRequired' | 'equipmentNeeded' | 'tags', value: string) => {
    const currentArray = formData[field] || [];
    if (value && !currentArray.includes(value)) {
      handleInputChange(field, [...currentArray, value]);
    }
  };

  const handleArrayRemove = (field: 'skillsRequired' | 'equipmentNeeded' | 'tags', value: string) => {
    const currentArray = formData[field] || [];
    handleInputChange(field, currentArray.filter(item => item !== value));
  };

  const handleRecurrenceChange = (updates: Partial<RecurrencePattern>) => {
    handleInputChange('recurrence', {
      ...formData.recurrence,
      ...updates,
    });
  };

  const handleDaysOfWeekChange = (day: number) => {
    const currentDays = formData.recurrence.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    
    handleRecurrenceChange({ daysOfWeek: newDays });
  };

  // ============================================================================
  // SAVE FUNCTIONALITY
  // ============================================================================

  const handleSave = async () => {
    if (!currentUser?.companyId || !validateStep(activeStep)) return;

    try {
      setSaving(true);

      const templateData: CreateTemplateData = {
        ...formData,
        defaultStartTime: formatTimeToString(formData.defaultStartTime),
        defaultEndTime: formatTimeToString(formData.defaultEndTime),
      };

      let savedTemplate: ScheduleTemplate;

      if (mode === 'edit' && editTemplate) {
        savedTemplate = await templateService.updateTemplate(
          editTemplate.templateId,
          templateData,
          currentUser.uid
        );
      } else {
        savedTemplate = await templateService.createTemplate(
          currentUser.companyId,
          currentUser.uid,
          templateData
        );
      }

      if (onSave) {
        onSave(savedTemplate);
      }

      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      setErrors({ general: 'Failed to save template. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // RENDER STEP CONTENT
  // ============================================================================

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBasicInformation();
      case 1:
        return renderScheduleDetails();
      case 2:
        return renderRecurrencePattern();
      case 3:
        return renderRequirements();
      case 4:
        return renderReviewAndSave();
      default:
        return null;
    }
  };

  const renderBasicInformation = () => (
    <Stack spacing={3}>
      <TextField
        label="Template Name"
        value={formData.templateName}
        onChange={(e) => handleInputChange('templateName', e.target.value)}
        error={!!errors.templateName}
        helperText={errors.templateName || 'Choose a descriptive name for your template'}
        fullWidth
        required
      />

      <TextField
        label="Description"
        value={formData.description}
        onChange={(e) => handleInputChange('description', e.target.value)}
        multiline
        rows={3}
        fullWidth
        helperText="Optional description to help identify this template"
      />

      <FormControl fullWidth>
        <InputLabel>Job Site</InputLabel>
        <Select
          value={formData.jobSiteId}
          onChange={(e) => handleInputChange('jobSiteId', e.target.value)}
          label="Job Site"
        >
          <MenuItem value="">
            <em>Any Job Site</em>
          </MenuItem>
          {state.jobSites.map((jobSite) => (
            <MenuItem key={jobSite.siteId} value={jobSite.siteId}>
              {jobSite.siteName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );

  const renderScheduleDetails = () => (
    <Stack spacing={3}>
      <FormControl fullWidth>
        <InputLabel>Shift Type</InputLabel>
        <Select
          value={formData.shiftType}
          onChange={(e) => handleInputChange('shiftType', e.target.value)}
          label="Shift Type"
        >
          <MenuItem value="regular">Regular Shift</MenuItem>
          <MenuItem value="overtime">Overtime</MenuItem>
          <MenuItem value="emergency">Emergency</MenuItem>
          <MenuItem value="training">Training</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <Typography gutterBottom>Duration: {formData.duration} hours</Typography>
        <Slider
          value={formData.duration}
          onChange={(_, value: number | number[], __) => handleInputChange('duration', Array.isArray(value) ? value[0] : value)}
          min={1}
          max={24}
          step={0.5}
          marks={[
            { value: 4, label: '4h' },
            { value: 8, label: '8h' },
            { value: 12, label: '12h' },
            { value: 16, label: '16h' },
            { value: 24, label: '24h' },
          ]}
        />
        {errors.duration && (
          <Typography variant="caption" color="error">
            {errors.duration}
          </Typography>
        )}
      </Box>

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <MuiTimePicker
              label="Start Time"
              value={formData.defaultStartTime}
              onChange={(newValue) => newValue && handleInputChange('defaultStartTime', newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.defaultStartTime,
                  helperText: errors.defaultStartTime,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <MuiTimePicker
              label="End Time"
              value={formData.defaultEndTime}
              onChange={(newValue) => newValue && handleInputChange('defaultEndTime', newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.defaultEndTime,
                  helperText: errors.defaultEndTime,
                },
              }}
            />
          </Grid>
        </Grid>
      </LocalizationProvider>

      <Box>
        <Typography gutterBottom>Break Duration: {formData.breakDuration} minutes</Typography>
        <Slider
          value={formData.breakDuration}
          onChange={(_, value: number | number[], __) => handleInputChange('breakDuration', Array.isArray(value) ? value[0] : value)}
          min={0}
          max={120}
          step={15}
          marks={[
            { value: 0, label: 'None' },
            { value: 30, label: '30m' },
            { value: 60, label: '1h' },
            { value: 90, label: '1.5h' },
            { value: 120, label: '2h' },
          ]}
        />
      </Box>
    </Stack>
  );

  const renderRecurrencePattern = () => (
    <Stack spacing={3}>
      <FormControl fullWidth>
        <InputLabel>Recurrence Type</InputLabel>
        <Select
          value={formData.recurrence.type}
          onChange={(e) => handleRecurrenceChange({ type: e.target.value as any })}
          label="Recurrence Type"
        >
          <MenuItem value="daily">Daily</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <Typography gutterBottom>
          Repeat every {formData.recurrence.interval} {formData.recurrence.type.slice(0, -2)}
          {formData.recurrence.interval > 1 ? 's' : ''}
        </Typography>
        <Slider
          value={formData.recurrence.interval}
          onChange={(_, value: number | number[], __) => handleRecurrenceChange({ interval: Array.isArray(value) ? value[0] : value })}
          min={1}
          max={formData.recurrence.type === 'daily' ? 30 : formData.recurrence.type === 'weekly' ? 12 : 6}
          step={1}
          valueLabelDisplay="auto"
        />
      </Box>

      {formData.recurrence.type === 'weekly' && (
        <Box>
          <Typography gutterBottom>Days of the Week</Typography>
          <ToggleButtonGroup
            value={formData.recurrence.daysOfWeek || []}
            onChange={(_, newDays) => handleRecurrenceChange({ daysOfWeek: newDays })}
            size="small"
            sx={{ flexWrap: 'wrap' }}
          >
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <ToggleButton
                key={day}
                value={index + 1}
                onClick={() => handleDaysOfWeekChange(index + 1)}
              >
                {day}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {errors.daysOfWeek && (
            <Typography variant="caption" color="error">
              {errors.daysOfWeek}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );

  const renderRequirements = () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Skills Required
        </Typography>
        <Autocomplete
          multiple
          options={availableSkills}
          value={formData.skillsRequired}
          onChange={(_, newValue) => handleInputChange('skillsRequired', newValue)}
          freeSolo
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                variant="outlined"
                label={option}
                {...getTagProps({ index })}
                key={option}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Add skills..."
              helperText="Select or type skills required for this template"
            />
          )}
        />
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Equipment Needed
        </Typography>
        <Autocomplete
          multiple
          options={availableEquipment}
          value={formData.equipmentNeeded}
          onChange={(_, newValue) => handleInputChange('equipmentNeeded', newValue)}
          freeSolo
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                variant="outlined"
                label={option}
                {...getTagProps({ index })}
                key={option}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Add equipment..."
              helperText="Specify equipment or tools needed"
            />
          )}
        />
      </Box>

      <TextField
        label="Special Instructions"
        value={formData.specialInstructions}
        onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
        multiline
        rows={4}
        fullWidth
        helperText="Any special instructions or notes for this template"
      />

      <Box>
        <Typography variant="h6" gutterBottom>
          Tags
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {suggestedTags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              variant={(formData.tags || []).includes(tag) ? 'filled' : 'outlined'}
              onClick={() => 
                (formData.tags || []).includes(tag) 
                  ? handleArrayRemove('tags', tag)
                  : handleArrayAdd('tags', tag)
              }
              size="small"
            />
          ))}
        </Box>
        <Autocomplete
          multiple
          options={[]}
          value={formData.tags || []}
          onChange={(_, newValue) => handleInputChange('tags', newValue)}
          freeSolo
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                variant="filled"
                label={option}
                {...getTagProps({ index })}
                key={option}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Add custom tags..."
              size="small"
            />
          )}
        />
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={formData.isPublic}
            onChange={(e) => handleInputChange('isPublic', e.target.checked)}
          />
        }
        label="Make this template public (visible to other users in your organization)"
      />
    </Stack>
  );

  const renderReviewAndSave = () => (
    <Stack spacing={3}>
      <Alert severity="info" icon={<PreviewIcon />}>
        Review your template settings below. You can go back to any step to make changes.
      </Alert>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {formData.templateName}
        </Typography>
        
        {formData.description && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {formData.description}
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="subtitle2" gutterBottom>Schedule Details</Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Type:</strong> {formData.shiftType}
              </Typography>
              <Typography variant="body2">
                <strong>Duration:</strong> {formData.duration} hours
              </Typography>
              <Typography variant="body2">
                <strong>Time:</strong> {formatTimeToString(formData.defaultStartTime)} - {formatTimeToString(formData.defaultEndTime)}
              </Typography>
              <Typography variant="body2">
                <strong>Break:</strong> {formData.breakDuration} minutes
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="subtitle2" gutterBottom>Recurrence</Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Type:</strong> {formData.recurrence.type}
              </Typography>
              <Typography variant="body2">
                <strong>Interval:</strong> Every {formData.recurrence.interval} {formData.recurrence.type.slice(0, -2)}{formData.recurrence.interval > 1 ? 's' : ''}
              </Typography>
              {formData.recurrence.type === 'weekly' && formData.recurrence.daysOfWeek && (
                <Typography variant="body2">
                  <strong>Days:</strong> {formData.recurrence.daysOfWeek.map(day => 
                    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]
                  ).join(', ')}
                </Typography>
              )}
            </Stack>
          </Grid>

          {((formData.skillsRequired?.length || 0) > 0 || (formData.equipmentNeeded?.length || 0) > 0) && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" gutterBottom>Requirements</Typography>
              {(formData.skillsRequired?.length || 0) > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" component="span" sx={{ mr: 1 }}>
                    <strong>Skills:</strong>
                  </Typography>
                  {formData.skillsRequired?.map((skill) => (
                    <Chip key={skill} label={skill} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
              )}
              {(formData.equipmentNeeded?.length || 0) > 0 && (
                <Box>
                  <Typography variant="body2" component="span" sx={{ mr: 1 }}>
                    <strong>Equipment:</strong>
                  </Typography>
                  {formData.equipmentNeeded?.map((equipment) => (
                    <Chip key={equipment} label={equipment} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
              )}
            </Grid>
          )}
        </Grid>

        {formData.specialInstructions && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Special Instructions</Typography>
            <Typography variant="body2">{formData.specialInstructions}</Typography>
          </>
        )}
      </Paper>

      {errors.general && (
        <Alert severity="error">{errors.general}</Alert>
      )}
    </Stack>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {mode === 'edit' ? 'Edit Template' :
             mode === 'duplicate' ? 'Duplicate Template' :
             'Create New Template'}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} orientation={isMobile ? 'vertical' : 'horizontal'}>
            {steps.map((step, index) => (
              <Step key={step.label} completed={index < activeStep}>
                <StepLabel
                  optional={step.optional && (
                    <Typography variant="caption">Optional</Typography>
                  )}
                  onClick={() => handleStepClick(index)}
                  sx={{ cursor: index <= activeStep ? 'pointer' : 'default' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {step.icon}
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {step.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    </Box>
                  </Box>
                </StepLabel>
                
                {isMobile && (
                  <StepContent>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Box sx={{ py: 2 }}>
                        {renderStepContent(index)}
                      </Box>
                    </motion.div>
                  </StepContent>
                )}
              </Step>
            ))}
          </Stepper>

          {!isMobile && (
            <Box sx={{ mt: 4 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderStepContent(activeStep)}
                </motion.div>
              </AnimatePresence>
            </Box>
          )}
        </Box>

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        
        <Box sx={{ flex: 1 }} />
        
        {activeStep !== 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        
        {isStepOptional(activeStep) && (
          <Button onClick={handleSkip} disabled={loading}>
            Skip
          </Button>
        )}
        
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={loading}
            startIcon={loading ? null : <SaveIcon />}
          >
            {loading ? 'Saving...' : 'Save Template'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
            endIcon={<NextIcon />}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TemplateWizard; 