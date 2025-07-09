import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Paper,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Slider,
  FormControlLabel,
  Switch,
  Checkbox,
  Badge,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Tune as TuneIcon,
  Save as SaveIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Psychology as SmartIcon,
  Close as CloseIcon,
  Bookmark as BookmarkIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  DateRange as DateIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker as MuiDatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

import { useAuth } from '../../contexts/AuthContext';
import type { Schedule, JobSite, User } from '@shared/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FilterCriteria {
  // Text search
  searchQuery?: string;
  smartSearch?: boolean;
  
  // Date filters
  dateRange?: {
    start: Date;
    end: Date;
  };
  quickDateRange?: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';
  
  // Employee filters
  employeeIds?: string[];
  employeeDepartments?: string[];
  employeeRoles?: string[];
  
  // Job site filters
  jobSiteIds?: string[];
  jobSiteTypes?: string[];
  
  // Schedule properties
  shiftTypes?: string[];
  statuses?: string[];
  priorities?: string[];
  
  // Advanced filters
  duration?: {
    min?: number;
    max?: number;
  };
  isOvertime?: boolean;
  isRecurring?: boolean;
  hasConflicts?: boolean;
  requiresApproval?: boolean;
  
  // Time-based filters
  timeSlots?: string[];
  daysOfWeek?: number[];
  
  // Custom fields
  customFields?: Record<string, any>;
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  criteria: FilterCriteria;
  isPublic: boolean;
  isFavorite: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  tags: string[];
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  criteria: FilterCriteria;
  icon: React.ReactNode;
  category: 'quick' | 'common' | 'advanced';
}

interface FilterManagerProps {
  open: boolean;
  onClose: () => void;
  onApplyFilters: (criteria: FilterCriteria) => void;
  currentFilters: FilterCriteria;
  schedules: Schedule[];
  employees: User[];
  jobSites: JobSite[];
  compact?: boolean;
}

// ============================================================================
// FILTER MANAGER COMPONENT
// ============================================================================

const FilterManager: React.FC<FilterManagerProps> = ({
  open,
  onClose,
  onApplyFilters,
  currentFilters,
  schedules,
  employees,
  compact = false,
}) => {
  const { currentUser } = useAuth();

  // State management
  const [filters, setFilters] = useState<FilterCriteria>(currentFilters);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['search', 'quick']));
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterToSave, setFilterToSave] = useState<Partial<SavedFilter>>({});
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [smartSearchSuggestions, setSmartSearchSuggestions] = useState<string[]>([]);
  const [recentFilters, setRecentFilters] = useState<FilterCriteria[]>([]);
  const [filterStats, setFilterStats] = useState<any>({});

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (open) {
      initializeFilterManager();
    }
  }, [open]);

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  const initializeFilterManager = async () => {
    await Promise.all([
      loadSavedFilters(),
      loadFilterPresets(),
      loadRecentFilters(),
      generateSmartSuggestions(),
      calculateFilterStats(),
    ]);
  };

  const loadSavedFilters = async () => {
    try {
      // In production, this would load from Firestore
      const mockSavedFilters: SavedFilter[] = [
        {
          id: '1',
          name: 'This Week\'s Schedules',
          description: 'All schedules for the current week',
          criteria: {
            quickDateRange: 'thisWeek',
            statuses: ['scheduled', 'in_progress']
          },
          isPublic: true,
          isFavorite: true,
          createdBy: currentUser?.uid || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 45,
          tags: ['weekly', 'common']
        },
        {
          id: '2',
          name: 'Overtime Shifts',
          description: 'All overtime shifts requiring approval',
          criteria: {
            isOvertime: true,
            requiresApproval: true,
            shiftTypes: ['overtime']
          },
          isPublic: false,
          isFavorite: false,
          createdBy: currentUser?.uid || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 12,
          tags: ['overtime', 'approval']
        }
      ];
      setSavedFilters(mockSavedFilters);
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const loadFilterPresets = () => {
    const presets: FilterPreset[] = [
      {
        id: 'today',
        name: 'Today',
        description: 'Schedules for today',
        criteria: { quickDateRange: 'today' },
        icon: <DateIcon />,
        category: 'quick'
      },
      {
        id: 'this-week',
        name: 'This Week',
        description: 'All schedules this week',
        criteria: { quickDateRange: 'thisWeek' },
        icon: <TimelineIcon />,
        category: 'quick'
      },
      {
        id: 'active',
        name: 'Active',
        description: 'Currently active schedules',
        criteria: { statuses: ['in_progress', 'clocked_in'] },
        icon: <TrendingIcon />,
        category: 'common'
      },
      {
        id: 'pending-approval',
        name: 'Pending Approval',
        description: 'Schedules awaiting approval',
        criteria: { requiresApproval: true, statuses: ['pending'] },
        icon: <ScheduleIcon />,
        category: 'common'
      },
      {
        id: 'conflicts',
        name: 'Conflicts',
        description: 'Schedules with conflicts',
        criteria: { hasConflicts: true },
        icon: <TrendingIcon />,
        category: 'advanced'
      }
    ];
    setFilterPresets(presets);
  };

  const loadRecentFilters = () => {
    // Load from localStorage or API
    const recent = JSON.parse(localStorage.getItem('recentFilters') || '[]');
    setRecentFilters(recent.slice(0, 5)); // Keep last 5
  };

  const generateSmartSuggestions = () => {
    const suggestions = [
      'overtime this week',
      'construction projects',
      'pending approval',
      'john smith schedules',
      'emergency shifts',
      'weekend work',
      'remote assignments'
    ];
    setSmartSearchSuggestions(suggestions);
  };

  const calculateFilterStats = () => {
    const stats = {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.status === 'in-progress').length,
      pendingApproval: schedules.filter(s => s.requiresApproval).length,
      conflicts: 0, // TODO: Implement conflict detection
    };
    setFilterStats(stats);
  };

  // ============================================================================
  // FILTER OPERATIONS
  // ============================================================================

  const handleFilterChange = (key: keyof FilterCriteria, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleArrayFilterChange = (key: keyof FilterCriteria, value: string, checked: boolean) => {
    setFilters(prev => {
      const currentArray = (prev[key] as string[]) || [];
      const newArray = checked 
        ? [...currentArray, value]
        : currentArray.filter(item => item !== value);
      
      return {
        ...prev,
        [key]: newArray.length > 0 ? newArray : undefined
      };
    });
  };

  const handleQuickDateRange = (range: string) => {
    const now = new Date();
    let dateRange;

    switch (range) {
      case 'today':
        dateRange = { start: startOfDay(now), end: endOfDay(now) };
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        dateRange = { start: startOfDay(yesterday), end: endOfDay(yesterday) };
        break;
      case 'thisWeek':
        dateRange = { start: startOfWeek(now), end: endOfWeek(now) };
        break;
      case 'lastWeek':
        const lastWeekStart = subDays(startOfWeek(now), 7);
        dateRange = { start: lastWeekStart, end: endOfWeek(lastWeekStart) };
        break;
      case 'thisMonth':
        dateRange = { start: startOfMonth(now), end: endOfMonth(now) };
        break;
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(now), 1);
        dateRange = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
        break;
      default:
        dateRange = undefined;
    }

    setFilters(prev => ({
      ...prev,
      quickDateRange: range as any,
      dateRange
    }));
  };



  const applyFilters = () => {
    // Save to recent filters
    const updatedRecent = [filters, ...recentFilters.filter(f => 
      JSON.stringify(f) !== JSON.stringify(filters)
    )].slice(0, 5);
    setRecentFilters(updatedRecent);
    localStorage.setItem('recentFilters', JSON.stringify(updatedRecent));

    onApplyFilters(filters);
    if (!compact) {
      onClose();
    }
  };

  const clearFilters = () => {
    const emptyFilters: FilterCriteria = {};
    setFilters(emptyFilters);
    onApplyFilters(emptyFilters);
  };

  const applyPreset = (preset: FilterPreset) => {
    setFilters(preset.criteria);
    setSelectedPreset(preset.id);
    if (preset.criteria.quickDateRange) {
      handleQuickDateRange(preset.criteria.quickDateRange);
    }
  };

  // ============================================================================
  // SAVED FILTERS
  // ============================================================================

  const handleSaveFilter = () => {
    setFilterToSave({
      name: '',
      description: '',
      criteria: filters,
      isPublic: false,
      isFavorite: false,
      tags: []
    });
    setSaveDialogOpen(true);
  };

  const saveFilter = async () => {
    if (!filterToSave.name || !currentUser?.uid) return;

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterToSave.name,
      description: filterToSave.description,
      criteria: filterToSave.criteria || filters,
      isPublic: filterToSave.isPublic || false,
      isFavorite: filterToSave.isFavorite || false,
              createdBy: currentUser.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      tags: filterToSave.tags || []
    };

    setSavedFilters(prev => [...prev, newFilter]);
    setSaveDialogOpen(false);
    setFilterToSave({});
  };

  const applySavedFilter = (savedFilter: SavedFilter) => {
    setFilters(savedFilter.criteria);
    
    // Update usage count
    setSavedFilters(prev => 
      prev.map(f => 
        f.id === savedFilter.id 
          ? { ...f, usageCount: f.usageCount + 1 }
          : f
      )
    );
  };

  const toggleFavoriteFilter = (filterId: string) => {
    setSavedFilters(prev =>
      prev.map(f =>
        f.id === filterId ? { ...f, isFavorite: !f.isFavorite } : f
      )
    );
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getActiveFilterCount = () => {
    return Object.keys(filters).filter(key => {
      const value = filters[key as keyof FilterCriteria];
      return value !== undefined && value !== null && 
        (Array.isArray(value) ? value.length > 0 : true);
    }).length;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  const renderSearchSection = () => (
    <Accordion 
      expanded={expandedSections.has('search')}
      onChange={() => toggleSection('search')}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon />
          <Typography variant="h6">Search & Quick Filters</Typography>
          {filters.searchQuery && (
            <Badge badgeContent="1" color="primary" />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {/* Smart Search */}
          <Autocomplete
            freeSolo
            options={smartSearchSuggestions}
            value={filters.searchQuery || ''}
            onInputChange={(_, value) => handleFilterChange('searchQuery', value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Smart Search"
                placeholder="Try 'overtime this week' or 'john smith'"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SmartIcon color={filters.smartSearch ? 'primary' : 'inherit'} />
                    </InputAdornment>
                  ),
                  endAdornment: filters.searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => handleFilterChange('searchQuery', '')}
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />

          <FormControlLabel
            control={
              <Switch
                checked={filters.smartSearch || false}
                onChange={(e) => handleFilterChange('smartSearch', e.target.checked)}
              />
            }
            label="Enable smart search (AI-powered)"
          />

          {/* Quick Date Presets */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Quick Date Ranges</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {filterPresets.filter(p => p.category === 'quick').map((preset) => (
                <Chip
                  key={preset.id}
                  icon={preset.icon as React.ReactElement}
                  label={preset.name}
                  onClick={() => applyPreset(preset)}
                  color={selectedPreset === preset.id ? 'primary' : 'default'}
                  variant={selectedPreset === preset.id ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );

  const renderDateFilters = () => (
    <Accordion 
      expanded={expandedSections.has('dates')}
      onChange={() => toggleSection('dates')}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DateIcon />
          <Typography variant="h6">Date Range</Typography>
          {filters.dateRange && (
            <Badge badgeContent="1" color="primary" />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <MuiDatePicker
                label="Start Date"
                value={filters.dateRange?.start || null}
                onChange={(date) => 
                  handleFilterChange('dateRange', {
                    ...filters.dateRange,
                    start: date || undefined
                  })
                }
                slotProps={{ textField: { fullWidth: true } }}
              />
              <MuiDatePicker
                label="End Date"
                value={filters.dateRange?.end || null}
                onChange={(date) =>
                  handleFilterChange('dateRange', {
                    ...filters.dateRange,
                    end: date || undefined
                  })
                }
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Box>
          </Stack>
        </LocalizationProvider>
      </AccordionDetails>
    </Accordion>
  );

  const renderEmployeeFilters = () => (
    <Accordion 
      expanded={expandedSections.has('employees')}
      onChange={() => toggleSection('employees')}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon />
          <Typography variant="h6">Employees</Typography>
          {(filters.employeeIds?.length || 0) > 0 && (
            <Badge badgeContent={filters.employeeIds?.length} color="primary" />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Autocomplete
            multiple
            options={employees}
            getOptionLabel={(employee) => `${employee.profile?.firstName || ''} ${employee.profile?.lastName || ''}`}
            value={employees.filter(emp => filters.employeeIds?.includes(emp.id))}
            onChange={(_, selectedEmployees) =>
              handleFilterChange('employeeIds', selectedEmployees.map(emp => emp.id))
            }
            renderInput={(params) => (
              <TextField {...params} label="Select Employees" />
            )}
            renderTags={(employees, getTagProps) =>
              employees.map((employee, index) => (
                <Chip
                  {...getTagProps({ index })}
                  label={`${employee.profile?.firstName || ''} ${employee.profile?.lastName || ''}`}
                  size="small"
                  key={employee.id}
                />
              ))
            }
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );

  const renderScheduleFilters = () => (
    <Accordion 
      expanded={expandedSections.has('schedule')}
      onChange={() => toggleSection('schedule')}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon />
          <Typography variant="h6">Schedule Properties</Typography>
          {(filters.shiftTypes?.length || 0 + (filters.statuses?.length || 0)) > 0 && (
            <Badge badgeContent={(filters.shiftTypes?.length || 0) + (filters.statuses?.length || 0)} color="primary" />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          {/* Shift Types */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Shift Types</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {['regular', 'overtime', 'emergency', 'training'].map((type) => (
                <FormControlLabel
                  key={type}
                  control={
                    <Checkbox
                      checked={filters.shiftTypes?.includes(type) || false}
                      onChange={(e) => handleArrayFilterChange('shiftTypes', type, e.target.checked)}
                    />
                  }
                  label={type.charAt(0).toUpperCase() + type.slice(1)}
                />
              ))}
            </Stack>
          </Box>

          {/* Statuses */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Status</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {['scheduled', 'in_progress', 'completed', 'cancelled', 'pending'].map((status) => (
                <FormControlLabel
                  key={status}
                  control={
                    <Checkbox
                      checked={filters.statuses?.includes(status) || false}
                      onChange={(e) => handleArrayFilterChange('statuses', status, e.target.checked)}
                    />
                  }
                  label={status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1)}
                />
              ))}
            </Stack>
          </Box>

          {/* Duration Range */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Duration: {filters.duration?.min || 0}h - {filters.duration?.max || 24}h
            </Typography>
            <Slider
              value={[filters.duration?.min || 0, filters.duration?.max || 24]}
              onChange={(_, value) => {
                const [min, max] = value as number[];
                handleFilterChange('duration', { min, max });
              }}
              min={0}
              max={24}
              step={0.5}
              marks={[
                { value: 0, label: '0h' },
                { value: 8, label: '8h' },
                { value: 16, label: '16h' },
                { value: 24, label: '24h' },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Boolean Filters */}
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.isOvertime || false}
                  onChange={(e) => handleFilterChange('isOvertime', e.target.checked || undefined)}
                />
              }
              label="Overtime Only"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filters.isRecurring || false}
                  onChange={(e) => handleFilterChange('isRecurring', e.target.checked || undefined)}
                />
              }
              label="Recurring Schedules"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filters.hasConflicts || false}
                  onChange={(e) => handleFilterChange('hasConflicts', e.target.checked || undefined)}
                />
              }
              label="Has Conflicts"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filters.requiresApproval || false}
                  onChange={(e) => handleFilterChange('requiresApproval', e.target.checked || undefined)}
                />
              }
              label="Requires Approval"
            />
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );

  const renderSavedFilters = () => (
    <Accordion 
      expanded={expandedSections.has('saved')}
      onChange={() => toggleSection('saved')}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BookmarkIcon />
          <Typography variant="h6">Saved Filters</Typography>
          <Badge badgeContent={savedFilters.length} color="primary" />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {savedFilters.map((savedFilter) => (
            <Card key={savedFilter.id} variant="outlined" sx={{ cursor: 'pointer' }}>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }} onClick={() => applySavedFilter(savedFilter)}>
                    <Typography variant="subtitle2" gutterBottom>
                      {savedFilter.name}
                    </Typography>
                    {savedFilter.description && (
                      <Typography variant="body2" color="text.secondary">
                        {savedFilter.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      {savedFilter.isPublic ? <PublicIcon fontSize="small" /> : <PrivateIcon fontSize="small" />}
                      <Typography variant="caption" color="text.secondary">
                        Used {savedFilter.usageCount} times
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteFilter(savedFilter.id);
                    }}
                    color={savedFilter.isFavorite ? 'warning' : 'default'}
                  >
                    {savedFilter.isFavorite ? <StarIcon /> : <StarBorderIcon />}
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
          
          {savedFilters.length === 0 && (
            <Alert severity="info">
              No saved filters yet. Apply some filters and save them for quick access.
            </Alert>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );

  const renderFilterStats = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Filter Results</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Chip label={`${filterStats.totalSchedules} Total`} />
        <Chip label={`${filterStats.activeSchedules} Active`} color="success" />
        <Chip label={`${filterStats.pendingApproval} Pending`} color="warning" />
        {filterStats.conflicts > 0 && (
          <Chip label={`${filterStats.conflicts} Conflicts`} color="error" />
        )}
      </Box>
    </Paper>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {!compact && renderFilterStats()}
      
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {renderSearchSection()}
        {renderDateFilters()}
        {renderEmployeeFilters()}
        {renderScheduleFilters()}
        {renderSavedFilters()}
      </Box>

      {/* Action Buttons */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button
            variant="outlined"
            onClick={clearFilters}
            disabled={getActiveFilterCount() === 0}
          >
            Clear All
          </Button>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSaveFilter}
              disabled={getActiveFilterCount() === 0}
            >
              Save
            </Button>
            <Button
              variant="contained"
              onClick={applyFilters}
              disabled={getActiveFilterCount() === 0}
            >
              Apply Filters ({getActiveFilterCount()})
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );

  if (compact) {
    return (
      <Paper elevation={2} sx={{ height: 400, overflow: 'hidden' }}>
        {content}
      </Paper>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh', maxHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon />
              <Typography variant="h6">Advanced Filters</Typography>
              {getActiveFilterCount() > 0 && (
                <Badge badgeContent={getActiveFilterCount()} color="primary" />
              )}
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {content}
        </DialogContent>
      </Dialog>

      {/* Save Filter Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Filter</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Filter Name"
              value={filterToSave.name || ''}
              onChange={(e) => setFilterToSave(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Description (Optional)"
              value={filterToSave.description || ''}
              onChange={(e) => setFilterToSave(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filterToSave.isPublic || false}
                  onChange={(e) => setFilterToSave(prev => ({ ...prev, isPublic: e.target.checked }))}
                />
              }
              label="Make this filter public (visible to other users)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={filterToSave.isFavorite || false}
                  onChange={(e) => setFilterToSave(prev => ({ ...prev, isFavorite: e.target.checked }))}
                />
              }
              label="Add to favorites"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveFilter} disabled={!filterToSave.name}>
            Save Filter
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FilterManager; 