import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Avatar,
  AvatarGroup,
  Badge,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoveToInbox as MoveIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PlayArrow as ExecuteIcon,
  Undo as UndoIcon,
  SwapHoriz as SwapIcon,
  Update as UpdateIcon,
  DateRange as DateRangeIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addHours, differenceInHours } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalendar } from '../../contexts/CalendarContext';
import { validateSchedule } from './utils/conflictDetection';

import type { Schedule, User, JobSite, ScheduleConflict } from '@shared/types';

// Batch operation types
export type BatchOperationType = 
  | 'move' 
  | 'copy' 
  | 'delete' 
  | 'update' 
  | 'swap' 
  | 'merge' 
  | 'split'
  | 'reschedule'
  | 'reassign';

// Batch operation configuration
export interface BatchOperationConfig {
  type: BatchOperationType;
  targetDate?: Date;
  targetEmployeeIds?: string[];
  targetJobSiteIds?: string[];
  shiftType?: Schedule['shiftType'];
  status?: Schedule['status'];
  duration?: number; // in hours
  startTime?: string;
  endTime?: string;
  preserveRelativeTimings?: boolean;
  distributeEvenly?: boolean;
  respectWorkingHours?: boolean;
  avoidConflicts?: boolean;
  createRecurrence?: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  recurrenceCount?: number;
}

// Operation result
export interface BatchOperationResult {
  success: boolean;
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  conflicts: ScheduleConflict[];
  warnings: ScheduleConflict[];
  messages: string[];
  createdScheduleIds?: string[];
  modifiedScheduleIds?: string[];
  deletedScheduleIds?: string[];
}

// Operation preview
export interface OperationPreview {
  scheduleId: string;
  originalSchedule: Schedule;
  previewSchedule: Schedule;
  conflicts: ScheduleConflict[];
  warnings: ScheduleConflict[];
  willCreate: boolean;
  willModify: boolean;
  willDelete: boolean;
}



// Selected schedules summary
const SelectedSchedulesSummary: React.FC<{
  schedules: Schedule[];
  employees: User[];
  jobSites: JobSite[];
}> = ({ schedules, employees }) => {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => {
    const employeeCount = new Set(schedules.map(s => s.employeeId)).size;
    const jobSiteCount = new Set(schedules.map(s => s.jobSiteId)).size;
    const totalHours = schedules.reduce((acc, s) => 
                    acc + differenceInHours(s.endDateTime || s.endTime?.toDate() || new Date(), s.startDateTime || s.startTime?.toDate() || new Date()), 0
    );
    const shiftTypes = new Set(schedules.map(s => s.shiftType));

    return { employeeCount, jobSiteCount, totalHours, shiftTypes };
  }, [schedules]);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6">
          {schedules.length} Schedules Selected
        </Typography>
        <IconButton onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Chip
          icon={<PersonIcon />}
          label={`${summary.employeeCount} Employees`}
          size="small"
          variant="outlined"
        />
        <Chip
          icon={<LocationIcon />}
          label={`${summary.jobSiteCount} Job Sites`}
          size="small"
          variant="outlined"
        />
        <Chip
          icon={<TimeIcon />}
          label={`${summary.totalHours}h Total`}
          size="small"
          variant="outlined"
        />
        <Chip
          icon={<ScheduleIcon />}
          label={`${summary.shiftTypes.size} Shift Types`}
          size="small"
          variant="outlined"
        />
      </Stack>

      <Collapse in={expanded}>
        <Divider sx={{ mb: 2 }} />
        
        {/* Employee avatars */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Employees
          </Typography>
          <AvatarGroup max={10}>
            {[...new Set(schedules.map(s => s.employeeId))].map(employeeId => {
              const employee = employees.find(e => e.id === employeeId);
              const employeeScheduleCount = schedules.filter(s => s.employeeId === employeeId).length;
              
              return (
                <Tooltip 
                  key={employeeId} 
                  title={`${employee?.profile?.firstName || employee?.email || 'Unknown'} (${employeeScheduleCount} schedules)`}
                >
                  <Badge badgeContent={employeeScheduleCount} color="primary" max={99}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {employee?.profile?.firstName?.charAt(0) || employee?.email?.charAt(0) || 'E'}
                    </Avatar>
                  </Badge>
                </Tooltip>
              );
            })}
          </AvatarGroup>
        </Box>

        {/* Schedule list */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Schedules
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
            {schedules.slice(0, 10).map(schedule => (
              <ListItem key={schedule.scheduleId}>
                <ListItemIcon>
                  <ScheduleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`${schedule.employeeName} - ${schedule.jobSiteName}`}
                  secondary={`${format(schedule.startDateTime || schedule.startTime?.toDate() || new Date(), 'MMM dd, HH:mm')} - ${format(schedule.endDateTime || schedule.endTime?.toDate() || new Date(), 'HH:mm')}`}
                />
                <ListItemSecondaryAction>
                  <Chip 
                    label={schedule.shiftType} 
                    size="small" 
                    variant="outlined"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {schedules.length > 10 && (
              <ListItem>
                <ListItemText 
                  primary={`And ${schedules.length - 10} more schedules...`}
                  sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                />
              </ListItem>
            )}
          </List>
        </Box>
      </Collapse>
    </Paper>
  );
};

// Operation configuration form
const OperationConfigForm: React.FC<{
  operation: BatchOperationType;
  config: BatchOperationConfig;
  onChange: (config: BatchOperationConfig) => void;
  employees: User[];
  jobSites: JobSite[];
}> = ({ operation, config, onChange, employees, jobSites }) => {
  const handleChange = (field: keyof BatchOperationConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <Stack spacing={3}>
      {/* Target Date/Time */}
      {['move', 'copy', 'reschedule'].includes(operation) && (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            label="Target Date & Time"
            value={config.targetDate || new Date()}
            onChange={(date) => handleChange('targetDate', date)}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </LocalizationProvider>
      )}

      {/* Target Employees */}
      {['reassign', 'copy'].includes(operation) && (
        <FormControl fullWidth>
          <InputLabel>Target Employees</InputLabel>
          <Select
            multiple
            value={config.targetEmployeeIds || []}
            onChange={(e) => handleChange('targetEmployeeIds', e.target.value)}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map(value => {
                  const employee = employees.find(e => e.id === value);
                  return (
                    <Chip
                      key={value}
                      label={employee?.profile?.firstName || employee?.email || value}
                      size="small"
                    />
                  );
                })}
              </Box>
            )}
          >
            {employees.map(employee => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.profile?.firstName || employee.email}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Target Job Sites */}
      {['move', 'copy', 'reassign'].includes(operation) && (
        <FormControl fullWidth>
          <InputLabel>Target Job Sites</InputLabel>
          <Select
            multiple
            value={config.targetJobSiteIds || []}
            onChange={(e) => handleChange('targetJobSiteIds', e.target.value)}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map(value => {
                  const jobSite = jobSites.find(js => js.siteId === value);
                  return (
                    <Chip
                      key={value}
                      label={jobSite?.siteName || value}
                      size="small"
                    />
                  );
                })}
              </Box>
            )}
          >
            {jobSites.map(jobSite => (
              <MenuItem key={jobSite.siteId} value={jobSite.siteId}>
                {jobSite.siteName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Shift Type */}
      {['update', 'copy'].includes(operation) && (
        <FormControl fullWidth>
          <InputLabel>Shift Type</InputLabel>
          <Select
            value={config.shiftType || ''}
            onChange={(e) => handleChange('shiftType', e.target.value)}
          >
            <MenuItem value="regular">Regular</MenuItem>
            <MenuItem value="overtime">Overtime</MenuItem>
            <MenuItem value="emergency">Emergency</MenuItem>
            <MenuItem value="training">Training</MenuItem>
          </Select>
        </FormControl>
      )}

      {/* Duration */}
      {['update', 'split'].includes(operation) && (
        <TextField
          fullWidth
          label="Duration (hours)"
          type="number"
          value={config.duration || ''}
          onChange={(e) => handleChange('duration', parseFloat(e.target.value))}
          inputProps={{ min: 0.5, max: 24, step: 0.5 }}
        />
      )}

      {/* Options */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Options
        </Typography>
        
        <Stack spacing={1}>
          {['move', 'copy'].includes(operation) && (
            <FormControlLabel
              control={
                <Switch
                  checked={config.preserveRelativeTimings || false}
                  onChange={(e) => handleChange('preserveRelativeTimings', e.target.checked)}
                />
              }
              label="Preserve relative timings"
            />
          )}

          {['move', 'copy', 'reassign'].includes(operation) && (
            <FormControlLabel
              control={
                <Switch
                  checked={config.distributeEvenly || false}
                  onChange={(e) => handleChange('distributeEvenly', e.target.checked)}
                />
              }
              label="Distribute evenly across targets"
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={config.respectWorkingHours || true}
                onChange={(e) => handleChange('respectWorkingHours', e.target.checked)}
              />
            }
            label="Respect working hours"
          />

          <FormControlLabel
            control={
              <Switch
                checked={config.avoidConflicts || true}
                onChange={(e) => handleChange('avoidConflicts', e.target.checked)}
              />
            }
            label="Avoid conflicts"
          />

          {['copy'].includes(operation) && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.createRecurrence || false}
                    onChange={(e) => handleChange('createRecurrence', e.target.checked)}
                  />
                }
                label="Create recurring schedules"
              />

              {config.createRecurrence && (
                <Box sx={{ ml: 3, mt: 1 }}>
                  <Stack direction="row" spacing={2}>
                    <FormControl size="small">
                      <InputLabel>Pattern</InputLabel>
                      <Select
                        value={config.recurrencePattern || 'weekly'}
                        onChange={(e) => handleChange('recurrencePattern', e.target.value)}
                      >
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="weekly">Weekly</MenuItem>
                        <MenuItem value="monthly">Monthly</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <TextField
                      size="small"
                      label="Count"
                      type="number"
                      value={config.recurrenceCount || 1}
                      onChange={(e) => handleChange('recurrenceCount', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 52 }}
                    />
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  );
};

// Operation preview component
const OperationPreviewPanel: React.FC<{
  previews: OperationPreview[];
  onExecute: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ previews, onExecute, onCancel, loading }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const summary = useMemo(() => {
    const creates = previews.filter(p => p.willCreate).length;
    const modifies = previews.filter(p => p.willModify).length;
    const deletes = previews.filter(p => p.willDelete).length;
    const conflicts = previews.filter(p => p.conflicts.length > 0).length;
    const warnings = previews.filter(p => p.warnings.length > 0).length;

    return { creates, modifies, deletes, conflicts, warnings };
  }, [previews]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Operation Preview
      </Typography>

      {/* Summary */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {summary.creates > 0 && (
            <Chip
              icon={<CheckIcon />}
              label={`${summary.creates} Create`}
              color="success"
              size="small"
            />
          )}
          {summary.modifies > 0 && (
            <Chip
              icon={<EditIcon />}
              label={`${summary.modifies} Modify`}
              color="info"
              size="small"
            />
          )}
          {summary.deletes > 0 && (
            <Chip
              icon={<DeleteIcon />}
              label={`${summary.deletes} Delete`}
              color="warning"
              size="small"
            />
          )}
          {summary.conflicts > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${summary.conflicts} Conflicts`}
              color="error"
              size="small"
            />
          )}
          {summary.warnings > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${summary.warnings} Warnings`}
              color="warning"
              size="small"
            />
          )}
        </Stack>
      </Paper>

      {/* Preview list */}
      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
        {previews.map((preview, index) => (
          <motion.div
            key={preview.scheduleId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <ListItem
              component="button"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              sx={{
                border: 1,
                borderColor: preview.conflicts.length > 0 ? 'error.light' : 'grey.300',
                borderRadius: 1,
                mb: 1,
                backgroundColor: preview.conflicts.length > 0 ? 'error.light' : 'background.paper',
                cursor: 'pointer',
              }}
            >
              <ListItemIcon>
                {preview.willCreate ? (
                  <CheckIcon color="success" />
                ) : preview.willModify ? (
                  <EditIcon color="info" />
                ) : preview.willDelete ? (
                  <DeleteIcon color="warning" />
                ) : (
                  <ScheduleIcon />
                )}
              </ListItemIcon>
              
              <ListItemText
                primary={`${preview.originalSchedule.employeeName} - ${preview.originalSchedule.jobSiteName}`}
                secondary={
                  preview.willCreate 
                    ? `Create new schedule on ${format(preview.previewSchedule.startDateTime || preview.previewSchedule.startTime?.toDate() || new Date(), 'MMM dd, HH:mm')}`
                    : preview.willModify
                    ? `Move to ${format(preview.previewSchedule.startDateTime || preview.previewSchedule.startTime?.toDate() || new Date(), 'MMM dd, HH:mm')}`
                    : preview.willDelete
                    ? 'Will be deleted'
                    : 'No changes'
                }
              />
              
              <ListItemSecondaryAction>
                <Stack direction="row" spacing={1} alignItems="center">
                  {preview.conflicts.length > 0 && (
                    <Chip
                      icon={<ErrorIcon />}
                      label={preview.conflicts.length}
                      color="error"
                      size="small"
                    />
                  )}
                  {preview.warnings.length > 0 && (
                    <Chip
                      icon={<WarningIcon />}
                      label={preview.warnings.length}
                      color="warning"
                      size="small"
                    />
                  )}
                  <IconButton size="small">
                    {expandedIndex === index ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>
              </ListItemSecondaryAction>
            </ListItem>

            {/* Expanded details */}
            <Collapse in={expandedIndex === index}>
              <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                {/* Conflicts */}
                {preview.conflicts.length > 0 && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Conflicts ({preview.conflicts.length})
                    </Typography>
                    {preview.conflicts.map((conflict, i) => (
                      <Typography key={i} variant="body2">
                        • {conflict.message}
                      </Typography>
                    ))}
                  </Alert>
                )}

                {/* Warnings */}
                {preview.warnings.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Warnings ({preview.warnings.length})
                    </Typography>
                    {preview.warnings.map((warning, i) => (
                      <Typography key={i} variant="body2">
                        • {warning.message}
                      </Typography>
                    ))}
                  </Alert>
                )}

                {/* Schedule details */}
                <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Original:</strong> {format(preview.originalSchedule.startDateTime || preview.originalSchedule.startTime?.toDate() || new Date(), 'MMM dd, HH:mm')} - {format(preview.originalSchedule.endDateTime || preview.originalSchedule.endTime?.toDate() || new Date(), 'HH:mm')}
                  </Typography>
                  {!preview.willDelete && (
                    <Typography variant="body2">
                      <strong>New:</strong> {format(preview.previewSchedule.startDateTime || preview.previewSchedule.startTime?.toDate() || new Date(), 'MMM dd, HH:mm')} - {format(preview.previewSchedule.endDateTime || preview.previewSchedule.endTime?.toDate() || new Date(), 'HH:mm')}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Collapse>
          </motion.div>
        ))}
      </List>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onExecute}
          disabled={loading || summary.conflicts > 0}
          startIcon={loading ? undefined : <ExecuteIcon />}
        >
          {loading ? 'Executing...' : 'Execute Operation'}
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mt: 2 }} />}
    </Box>
  );
};

// Main Batch Operations Panel
export const BatchOperationsPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  selectedSchedules: Schedule[];
  onExecute: (operation: BatchOperationType, config: BatchOperationConfig) => Promise<BatchOperationResult>;
}> = ({ open, onClose, selectedSchedules, onExecute }) => {
  const { state } = useCalendar();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOperation, setSelectedOperation] = useState<BatchOperationType>('move');
  const [operationConfig, setOperationConfig] = useState<BatchOperationConfig>({ type: 'move' });
  const [previews, setPreviews] = useState<OperationPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchOperationResult | null>(null);

  const operations = [
    { type: 'move' as BatchOperationType, label: 'Move Schedules', icon: <MoveIcon />, description: 'Move schedules to a new date/time' },
    { type: 'copy' as BatchOperationType, label: 'Copy Schedules', icon: <CopyIcon />, description: 'Create copies of schedules' },
    { type: 'delete' as BatchOperationType, label: 'Delete Schedules', icon: <DeleteIcon />, description: 'Remove selected schedules' },
    { type: 'update' as BatchOperationType, label: 'Update Properties', icon: <UpdateIcon />, description: 'Update schedule properties' },
    { type: 'reassign' as BatchOperationType, label: 'Reassign', icon: <SwapIcon />, description: 'Reassign to different employees/sites' },
    { type: 'reschedule' as BatchOperationType, label: 'Reschedule', icon: <DateRangeIcon />, description: 'Reschedule to different times' },
  ];

  const steps = [
    'Select Operation',
    'Configure Settings',
    'Preview Changes',
    'Execute & Review'
  ];

  // Generate preview
  const generatePreview = useCallback(async () => {
    setLoading(true);
    try {
      const previewList: OperationPreview[] = [];

      for (const schedule of selectedSchedules) {
        let previewSchedule = { ...schedule };
        let willCreate = false;
        let willModify = false;
        let willDelete = false;

        // Apply operation logic
        switch (selectedOperation) {
          case 'move':
          case 'reschedule':
            if (operationConfig.targetDate) {
              const startDateTime = schedule.startDateTime || schedule.startTime?.toDate() || new Date();
              const endDateTime = schedule.endDateTime || schedule.endTime?.toDate() || new Date();
              const duration = endDateTime.getTime() - startDateTime.getTime();
              previewSchedule.startDateTime = operationConfig.targetDate;
              previewSchedule.endDateTime = new Date(operationConfig.targetDate.getTime() + duration);
              willModify = true;
            }
            break;

          case 'copy':
            willCreate = true;
            if (operationConfig.targetDate) {
              const startDateTime = schedule.startDateTime || schedule.startTime?.toDate() || new Date();
              const endDateTime = schedule.endDateTime || schedule.endTime?.toDate() || new Date();
              const duration = endDateTime.getTime() - startDateTime.getTime();
              previewSchedule.startDateTime = operationConfig.targetDate;
              previewSchedule.endDateTime = new Date(operationConfig.targetDate.getTime() + duration);
            }
            break;

          case 'delete':
            willDelete = true;
            break;

          case 'update':
            willModify = true;
            if (operationConfig.shiftType) previewSchedule.shiftType = operationConfig.shiftType;
            if (operationConfig.duration) {
              const startDateTime = previewSchedule.startDateTime || previewSchedule.startTime?.toDate() || new Date();
              const newEndTime = addHours(startDateTime, operationConfig.duration);
              previewSchedule.endDateTime = newEndTime;
            }
            break;

          case 'reassign':
            willModify = true;
            if (operationConfig.targetEmployeeIds?.[0]) {
              const employee = state.employees.find(e => e.id === operationConfig.targetEmployeeIds![0]);
              if (employee) {
                previewSchedule.employeeId = employee.id;
                previewSchedule.employeeName = employee.profile?.firstName || employee.email;
              }
            }
            if (operationConfig.targetJobSiteIds?.[0]) {
              const jobSite = state.jobSites.find(js => js.siteId === operationConfig.targetJobSiteIds![0]);
              if (jobSite) {
                previewSchedule.jobSiteId = jobSite.siteId;
                previewSchedule.jobSiteName = jobSite.siteName;
              }
            }
            break;
        }

        // Validate the preview
        let conflicts: ScheduleConflict[] = [];
        let warnings: ScheduleConflict[] = [];

        if (!willDelete && operationConfig.avoidConflicts) {
          try {
            const detectedConflicts = validateSchedule(
              previewSchedule,
              state.schedules,
              state.employees,
              { 
                maxDailyHours: 8,
                minBreakMinutes: 30,
                maxWeeklyHours: 40
              }
            );
            // Separate conflicts by severity
            conflicts = detectedConflicts.filter(c => c.severity === 'error');
            warnings = detectedConflicts.filter(c => c.severity === 'warning');
          } catch (error) {
            console.error('Error validating preview:', error);
          }
        }

        previewList.push({
          scheduleId: schedule.scheduleId,
          originalSchedule: schedule,
          previewSchedule,
          conflicts,
          warnings,
          willCreate,
          willModify,
          willDelete,
        });
      }

      setPreviews(previewList);
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSchedules, selectedOperation, operationConfig, state.employees, state.jobSites, state.schedules]);

  // Execute operation
  const executeOperation = useCallback(async () => {
    setLoading(true);
    try {
      const result = await onExecute(selectedOperation, operationConfig);
      setResult(result);
      setCurrentStep(3);
    } catch (error) {
      console.error('Error executing operation:', error);
    } finally {
      setLoading(false);
    }
  }, [onExecute, selectedOperation, operationConfig]);

  // Handle next step
  const handleNext = () => {
    if (currentStep === 1) {
      generatePreview();
    }
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  // Reset wizard
  const handleReset = () => {
    setCurrentStep(0);
    setSelectedOperation('move');
    setOperationConfig({ type: 'move' });
    setPreviews([]);
    setResult(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Batch Operations
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Stepper */}
        <Stepper activeStep={currentStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SelectedSchedulesSummary
                schedules={selectedSchedules}
                employees={state.employees}
                jobSites={state.jobSites}
              />

              <Typography variant="h6" gutterBottom>
                Select Operation
              </Typography>

              <Stack spacing={2}>
                {operations.map((operation) => (
                  <Paper
                    key={operation.type}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: 1,
                      borderColor: selectedOperation === operation.type ? 'primary.main' : 'grey.300',
                      backgroundColor: selectedOperation === operation.type ? 'primary.light' : 'background.paper',
                      '&:hover': {
                        backgroundColor: selectedOperation === operation.type ? 'primary.light' : 'grey.50',
                      },
                    }}
                    onClick={() => {
                      setSelectedOperation(operation.type);
                      setOperationConfig({ type: operation.type });
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {operation.icon}
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {operation.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {operation.description}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </motion.div>
          )}

          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Typography variant="h6" gutterBottom>
                Configure Operation
              </Typography>

              <OperationConfigForm
                operation={selectedOperation}
                config={operationConfig}
                onChange={setOperationConfig}
                employees={state.employees}
                jobSites={state.jobSites}
              />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <OperationPreviewPanel
                previews={previews}
                onExecute={executeOperation}
                onCancel={() => setCurrentStep(1)}
                loading={loading}
              />
            </motion.div>
          )}

          {currentStep === 3 && result && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Typography variant="h6" gutterBottom>
                Operation Complete
              </Typography>

              <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                <Typography variant="subtitle1">
                  {result.success ? 'Operation completed successfully!' : 'Operation completed with errors'}
                </Typography>
                <Typography variant="body2">
                  Processed: {result.processedCount}, Skipped: {result.skippedCount}, Errors: {result.errorCount}
                </Typography>
              </Alert>

              {result.messages.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Messages
                  </Typography>
                  <List dense>
                    {result.messages.map((message, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={message} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {result.conflicts.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Conflicts Found ({result.conflicts.length})
                  </Typography>
                  {result.conflicts.slice(0, 5).map((conflict, index) => (
                    <Typography key={index} variant="body2">
                      • {conflict.message}
                    </Typography>
                  ))}
                  {result.conflicts.length > 5 && (
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      And {result.conflicts.length - 5} more conflicts...
                    </Typography>
                  )}
                </Alert>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      <DialogActions>
        <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'space-between' }}>
          <Box>
            {currentStep > 0 && currentStep < 3 && (
              <Button onClick={handlePrevious} disabled={loading}>
                Previous
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {currentStep === 3 && (
              <Button onClick={handleReset} startIcon={<UndoIcon />}>
                Start Over
              </Button>
            )}
            
            {currentStep < 2 && (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={loading || (currentStep === 0 && !selectedOperation)}
              >
                Next
              </Button>
            )}

            <Button onClick={onClose}>
              {currentStep === 3 ? 'Close' : 'Cancel'}
            </Button>
          </Box>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}; 