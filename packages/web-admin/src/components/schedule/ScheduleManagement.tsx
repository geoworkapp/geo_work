import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Snackbar,
  LinearProgress,
  IconButton,
  AppBar,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Card,
  CardContent
} from '@mui/material';

import {
  Add as AddIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  PlaylistAdd as PlaylistAddIcon,
  FilterList as FilterIcon,
  LibraryBooks as TemplateIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  Notes as NotesIcon
} from '@mui/icons-material';

import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import type { View } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './calendar-styles.css';
import './enhanced-calendar.css';

// Firebase imports
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';

// Local imports
import type { Schedule, ScheduleConflict, JobSite, User } from '@shared/types';
import { useAuth } from '../../contexts/AuthContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { ConflictDetectionService } from '../../services/conflictDetectionService';
import { notificationService } from '../../services/notificationService';
import { TemplateService } from '../../services/templateService';
import { BatchOperationsPanel } from './BatchOperationsPanel';
import type { BatchOperationType, BatchOperationConfig, BatchOperationResult } from './BatchOperationsPanel';
import TemplateLibrary from './TemplateLibrary';
import FilterManager from './FilterManager';
import type { FilterCriteria } from './FilterManager';
import { EnhancedDragDropProvider } from './EnhancedDragDropProvider';
import TemplateWizard from './TemplateWizard';

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

const ScheduleManagement: React.FC = () => {
  const { currentUser } = useAuth();
  
  // Use CalendarContext for all state management
  const {
    state: {
      schedules,
      employees,
      jobSites,
      loading,
      error,
      currentView,
      currentDate,
      bulkOperations: { panelOpen: batchPanelOpen }
    },
    // Actions from context
    setSchedules,
    setEmployees,
    setJobSites,
    setLoading,
    setError,
    setView,
    setDate,
    clearSelection,
    toggleBulkPanel: setBatchPanelOpen,
    filteredSchedules,
    selectedSchedules,
    hasSelection
  } = useCalendar();

  // Local state for UI
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  
  // Schedule creation dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    employeeId: '',
    jobSiteId: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    shiftType: 'regular' as Schedule['shiftType'],
    notes: ''
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    schedule: Schedule;
  } | null>(null);

  // Schedule details dialog state
  const [scheduleDetailsOpen, setScheduleDetailsOpen] = useState(false);
  const [selectedScheduleForDetails, setSelectedScheduleForDetails] = useState<Schedule | null>(null);

  // Schedule edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editForm, setEditForm] = useState({
    employeeId: '',
    jobSiteId: '',
    startDate: '',
    startTime: '',
    endTime: '',
    shiftType: 'regular' as Schedule['shiftType'],
    notes: '',
    status: 'scheduled' as Schedule['status']
  });

  // Enhanced UI state
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [templateWizardOpen, setTemplateWizardOpen] = useState(false);
  const [templateApplicationOpen, setTemplateApplicationOpen] = useState(false);
  const [selectedTemplateForApplication, setSelectedTemplateForApplication] = useState<any>(null);
  const [filterManagerOpen, setFilterManagerOpen] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FilterCriteria>({});
  
  // Template application form state
  const [templateApplicationForm, setTemplateApplicationForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    employeeIds: [] as string[],
    jobSiteId: '',
    skipConflicts: false,
    sendNotifications: true,
    customizations: {
      startTime: '',
      endTime: '',
      breakDuration: undefined as number | undefined,
      specialInstructions: ''
    }
  });

  // Add timeout to force show calendar after reasonable wait
  const [dataLoadTimeout, setDataLoadTimeout] = useState(false);
  
  // Initialize data on component mount
  useEffect(() => {
    if (currentUser?.companyId) {
      loadData();
      
      // Force show calendar after 3 seconds even if data isn't fully loaded
      const timeout = setTimeout(() => {
        setDataLoadTimeout(true);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [currentUser?.companyId]);

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadSchedules(),
        loadEmployees(), 
        loadJobSites()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Load schedules from Firestore
  const loadSchedules = async () => {
    if (!currentUser?.companyId) return;
    
    const schedulesRef = collection(db, 'schedules');
    const q = query(
      schedulesRef, 
      where('companyId', '==', currentUser.companyId),
      orderBy('startTime', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scheduleData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure both field types exist for compatibility
        const startTime = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
        const endTime = data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime);
        
        return {
          scheduleId: doc.id,
          ...data,
          // Ensure we have both Date objects and Timestamps
          startDateTime: startTime,     // Date object for legacy compatibility
          endDateTime: endTime,         // Date object for legacy compatibility
          startTime: data.startTime,    // Keep original Timestamp
          endTime: data.endTime,        // Keep original Timestamp
        };
      }) as Schedule[];
      setSchedules(scheduleData);
    }, (error) => {
      console.error('Error loading schedules:', error);
      setError(`Failed to load schedules: ${error.message}`);
    });

    return unsubscribe;
  };

  // Load employees
  const loadEmployees = async () => {
    if (!currentUser?.companyId) return;
    
    const employeesRef = collection(db, 'users');
    const q = query(
      employeesRef, 
      where('companyId', '==', currentUser.companyId),
      where('role', '==', 'employee')
    );
    const snapshot = await getDocs(q);
    const employeeData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
    setEmployees(employeeData);
  };

  // Load job sites
  const loadJobSites = async () => {
    if (!currentUser?.companyId) return;
    
    const jobSitesRef = collection(db, 'jobSites');
    const q = query(jobSitesRef, where('companyId', '==', currentUser.companyId));
    const snapshot = await getDocs(q);
    const jobSiteData = snapshot.docs.map(doc => ({
      siteId: doc.id,
      ...doc.data()
    })) as JobSite[];
    setJobSites(jobSiteData);
  };

  // Validate schedule conflicts
  const validateScheduleConflicts = async (schedule: Schedule): Promise<ScheduleConflict[]> => {
    try {
      const service = ConflictDetectionService.getInstance();
      const employee = employees.find(e => e.id === schedule.employeeId);
      const jobSite = jobSites.find(j => j.siteId === schedule.jobSiteId);
      
      if (!employee || !jobSite) {
        return [];
      }
      
      const conflicts = await service.detectConflicts(schedule, schedules);
      return conflicts;
    } catch (error) {
      console.error('Error validating schedule conflicts:', error);
      return [];
    }
  };

  // Handle schedule updates
  const handleScheduleUpdate = async (scheduleId: string, updates: Partial<Schedule>) => {
    try {
      const schedule = schedules.find(s => s.scheduleId === scheduleId);
      if (!schedule) {
        throw new Error('Schedule not found');
      }

      // If employee or job site ID is being updated, also update the corresponding names
      const finalUpdates = { ...updates };
      
      if (updates.employeeId && updates.employeeId !== schedule.employeeId) {
        const employee = employees.find(e => e.id === updates.employeeId);
        finalUpdates.employeeName = employee?.profile?.firstName + ' ' + employee?.profile?.lastName || 'Unknown';
      }
      
      if (updates.jobSiteId && updates.jobSiteId !== schedule.jobSiteId) {
        const jobSite = jobSites.find(j => j.siteId === updates.jobSiteId);
        finalUpdates.jobSiteName = jobSite?.siteName || 'Unknown';
      }

      const scheduleRef = doc(db, 'schedules', scheduleId);
      await updateDoc(scheduleRef, finalUpdates);
      
      await notificationService.sendNotification('schedule_updated', [schedule.employeeId], {
        schedule: {
          ...schedule,
          ...finalUpdates
        },
        originalScheduleId: scheduleId,
        updatedBy: currentUser?.uid || 'unknown'
      });
      
      showSnackbar('Schedule updated successfully', 'success');
    } catch (error) {
      console.error('Error updating schedule:', error);
      setError('Failed to update schedule');
    }
  };

  // Handle schedule creation
  const handleScheduleCreate = async () => {
    try {
      if (!newSchedule.employeeId || !newSchedule.jobSiteId) {
        showSnackbar('Please select employee and job site', 'error');
        return;
      }

      const startDateTime = new Date(`${newSchedule.startDate}T${newSchedule.startTime}`);
      const endDateTime = new Date(`${newSchedule.startDate}T${newSchedule.endTime}`);
      
      const employee = employees.find(e => e.id === newSchedule.employeeId);
      const jobSite = jobSites.find(j => j.siteId === newSchedule.jobSiteId);

      const scheduleData = {
        companyId: currentUser?.companyId,
        employeeId: newSchedule.employeeId,
        employeeName: employee?.profile?.firstName + ' ' + employee?.profile?.lastName || 'Unknown',
        jobSiteId: newSchedule.jobSiteId,
        jobSiteName: jobSite?.siteName || 'Unknown',
        startTime: Timestamp.fromDate(startDateTime),
        endTime: Timestamp.fromDate(endDateTime),
        shiftType: newSchedule.shiftType,
        status: 'scheduled' as Schedule['status'],
        notes: newSchedule.notes || '',
        createdAt: Timestamp.now(),
        createdBy: currentUser?.uid || 'unknown'
      };

      await addDoc(collection(db, 'schedules'), scheduleData);
      
      await notificationService.sendNotification('schedule_created', [newSchedule.employeeId], {
        schedule: scheduleData,
        createdBy: currentUser?.uid || 'unknown'
      });
      
      setCreateDialogOpen(false);
      resetNewScheduleForm();
      showSnackbar('Schedule created successfully', 'success');
    } catch (error) {
      console.error('Error creating schedule:', error);
      setError('Failed to create schedule');
    }
  };

  const resetNewScheduleForm = () => {
    setNewSchedule({
      employeeId: '',
      jobSiteId: '',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      shiftType: 'regular',
      notes: ''
    });
  };

  // Handle filter application
  const handleApplyFilters = (filters: FilterCriteria) => {
    setCurrentFilters(filters);
    // Apply filters through the CalendarContext if needed
    // For now, we'll handle filtering locally
    setFilterManagerOpen(false);
  };

  // Handle template selection from library
  const handleTemplateSelect = (template: any) => {
    console.log('Template selected for application:', template);
    setSelectedTemplateForApplication(template);
    setTemplateLibraryOpen(false);
    setTemplateApplicationOpen(true);
  };

  // Handle template creation
  const handleCreateTemplate = () => {
    setTemplateLibraryOpen(false);
    setTemplateWizardOpen(true);
  };

  // Handle template save from wizard
  const handleTemplateSave = (template: any) => {
    console.log('Template saved:', template);
    setTemplateWizardOpen(false);
    showSnackbar(`Template "${template.templateName}" created successfully!`, 'success');
    // Optionally refresh template library or add to local state
  };

  // Handle template application
  const handleTemplateApplication = async (applicationData: any) => {
    try {
      setLoading(true);
      
      // Validate input
      if (!selectedTemplateForApplication?.templateId) {
        showSnackbar('No template selected', 'error');
        return;
      }
      
      if (!applicationData.employeeIds || applicationData.employeeIds.length === 0) {
        showSnackbar('Please select at least one employee', 'error');
        return;
      }
      
      console.log('Applying template:', selectedTemplateForApplication.templateId, 'with data:', applicationData);
      
      const templateService = TemplateService.getInstance();
      const result = await templateService.applyTemplate(
        selectedTemplateForApplication.templateId,
        {
          targetDate: applicationData.startDate,
          endDate: applicationData.endDate,
          employeeIds: applicationData.employeeIds,
          jobSiteId: applicationData.jobSiteId,
          customizations: applicationData.customizations,
          skipConflicts: applicationData.skipConflicts,
          sendNotifications: applicationData.sendNotifications
        },
        currentUser?.uid || 'unknown'
      );

      if (result.errors.length > 0) {
        showSnackbar(`Template applied with ${result.errors.length} errors. Check console for details.`, 'warning');
        console.error('Template application errors:', result.errors);
      } else {
        showSnackbar(`Template "${selectedTemplateForApplication.templateName}" applied successfully! Created ${result.createdSchedules.length} schedules.`, 'success');
      }

      if (result.conflicts.length > 0) {
        showSnackbar(`${result.conflicts.length} conflicts detected during application`, 'warning');
      }

      // Refresh schedules to show newly created ones
      await loadSchedules();
      
      setTemplateApplicationOpen(false);
      setSelectedTemplateForApplication(null);
      
    } catch (error) {
      console.error('Error applying template:', error);
      showSnackbar(`Failed to apply template: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced drag and drop handlers
  const handleScheduleMove = async (scheduleIds: string[], targetDate: Date, targetEmployee?: string, targetJobSite?: string) => {
    try {
      // Move schedules to new time/employee/jobsite
      for (const scheduleId of scheduleIds) {
        const schedule = schedules.find(s => s.scheduleId === scheduleId);
        if (schedule) {
          const updates: Partial<Schedule> = {
            startTime: Timestamp.fromDate(targetDate),
            endTime: Timestamp.fromDate(new Date(targetDate.getTime() + (schedule.endTime.toMillis() - schedule.startTime.toMillis())))
          };
          
          if (targetEmployee) updates.employeeId = targetEmployee;
          if (targetJobSite) updates.jobSiteId = targetJobSite;
          
          await handleScheduleUpdate(scheduleId, updates);
        }
      }
      showSnackbar(`Moved ${scheduleIds.length} schedule(s)`, 'success');
    } catch (error) {
      console.error('Error moving schedules:', error);
      showSnackbar('Failed to move schedules', 'error');
    }
  };

  const handleScheduleCopy = async (scheduleIds: string[], targetDate: Date, targetEmployee?: string, targetJobSite?: string) => {
    try {
      // Copy schedules to new time/employee/jobsite
      for (const scheduleId of scheduleIds) {
        const schedule = schedules.find(s => s.scheduleId === scheduleId);
        if (schedule) {
          // Get updated employee and job site names if IDs changed
          const finalEmployeeId = targetEmployee || schedule.employeeId;
          const finalJobSiteId = targetJobSite || schedule.jobSiteId;
          
          const employee = employees.find(e => e.id === finalEmployeeId);
          const jobSite = jobSites.find(j => j.siteId === finalJobSiteId);
          
          const newSchedule = {
            ...schedule,
            startTime: Timestamp.fromDate(targetDate),
            endTime: Timestamp.fromDate(new Date(targetDate.getTime() + (schedule.endTime.toMillis() - schedule.startTime.toMillis()))),
            employeeId: finalEmployeeId,
            employeeName: employee?.profile?.firstName + ' ' + employee?.profile?.lastName || 'Unknown',
            jobSiteId: finalJobSiteId,
            jobSiteName: jobSite?.siteName || 'Unknown',
            createdAt: Timestamp.now(),
            createdBy: currentUser?.uid || 'unknown'
          };
          delete (newSchedule as any).scheduleId; // Remove ID for new document
          
          await addDoc(collection(db, 'schedules'), newSchedule);
        }
      }
      showSnackbar(`Copied ${scheduleIds.length} schedule(s)`, 'success');
    } catch (error) {
      console.error('Error copying schedules:', error);
      showSnackbar('Failed to copy schedules', 'error');
    }
  };



  // Handle bulk operations
  const handleBulkDelete = async (scheduleIds: string[]) => {
    try {
      for (const scheduleId of scheduleIds) {
        const scheduleRef = doc(db, 'schedules', scheduleId);
        await deleteDoc(scheduleRef);
      }
      
      const affectedEmployeeIds = scheduleIds.map(id => {
        const schedule = schedules.find(s => s.scheduleId === id);
        return schedule?.employeeId;
      }).filter(Boolean) as string[];

      await notificationService.sendNotification('schedule_updated', affectedEmployeeIds, {
        affectedScheduleIds: scheduleIds,
        updatedBy: currentUser?.uid || 'unknown'
      });
      
      clearSelection();
      showSnackbar(`Deleted ${scheduleIds.length} schedules`, 'success');
    } catch (error) {
      console.error('Error in bulk delete:', error);
      setError('Failed to delete schedules');
    }
  };

  const handleBulkMove = async (scheduleIds: string[], targetDate: Date, targetJobSiteId?: string) => {
    try {
      for (const scheduleId of scheduleIds) {
        const updates: Partial<Schedule> = {};
        if (targetDate) {
          const schedule = schedules.find(s => s.id === scheduleId);
          if (schedule) {
            const duration = schedule.endTime.toMillis() - schedule.startTime.toMillis();
            updates.startTime = Timestamp.fromDate(targetDate);
            updates.endTime = Timestamp.fromDate(new Date(targetDate.getTime() + duration));
          }
        }
        if (targetJobSiteId) {
          updates.jobSiteId = targetJobSiteId;
        }
        
        await handleScheduleUpdate(scheduleId, updates);
      }
      
      clearSelection();
      showSnackbar(`Moved ${scheduleIds.length} schedules`, 'success');
    } catch (error) {
      console.error('Error in bulk move:', error);
      setError('Failed to move schedules');
    }
  };

  // Handle batch operations
  const handleBatchOperation = async (operation: BatchOperationType, config: BatchOperationConfig): Promise<BatchOperationResult> => {
    try {
      const scheduleIds = selectedSchedules.map(s => s.scheduleId);
      
      switch (operation) {
        case 'delete':
          await handleBulkDelete(scheduleIds);
          break;
        case 'move':
          if (config.targetDate) {
            await handleBulkMove(scheduleIds, config.targetDate, config.targetJobSiteIds?.[0]);
          }
          break;
        default:
          throw new Error(`Operation ${operation} not implemented`);
      }

      return {
        success: true,
        processedCount: scheduleIds.length,
        skippedCount: 0,
        errorCount: 0,
        conflicts: [],
        warnings: [],
        messages: [`Successfully processed ${scheduleIds.length} schedules`]
      };
    } catch (error) {
      console.error('Error in batch operation:', error);
      return {
        success: false,
        processedCount: 0,
        skippedCount: 0,
        errorCount: selectedSchedules.length,
        conflicts: [],
        warnings: [],
        messages: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  };

  // Calendar event handlers
  const handleViewChange = (view: View) => {
    setView(view as any);
  };

  const handleSelectEvent = (event: any) => {
    // Left click - show schedule details
    const schedule = schedules.find(s => s.scheduleId === event.id);
    if (schedule) {
      setSelectedScheduleForDetails(schedule);
      setScheduleDetailsOpen(true);
    }
  };

  // Right-click context menu handler
  const handleEventContextMenu = (event: any, e: React.MouseEvent) => {
    e.preventDefault();
    const schedule = schedules.find(s => s.scheduleId === event.id);
    if (schedule) {
      setContextMenu({
        mouseX: e.clientX - 2,
        mouseY: e.clientY - 4,
        schedule,
      });
    }
  };

  // Close context menu
  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  // Drag and drop handlers
  const handleEventDrop = async ({ event, start, end }: any) => {
    try {
      const schedule = schedules.find(s => s.scheduleId === event.id);
      if (!schedule) return;

      const updates: Partial<Schedule> = {
        startTime: Timestamp.fromDate(new Date(start)),
        endTime: Timestamp.fromDate(new Date(end))
      };

      // Check for conflicts before moving
      const updatedSchedule = { ...schedule, ...updates };
      const conflicts = await validateScheduleConflicts(updatedSchedule);
      
      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(c => c.message).join(', ');
        showSnackbar(`Warning: ${conflictMessages}`, 'warning');
      }

      await handleScheduleUpdate(schedule.scheduleId, updates);
      showSnackbar('Schedule moved successfully', 'success');
    } catch (error) {
      console.error('Error moving schedule:', error);
      showSnackbar('Failed to move schedule', 'error');
    }
  };

  const handleEventResize = async ({ event, start, end }: any) => {
    try {
      const schedule = schedules.find(s => s.scheduleId === event.id);
      if (!schedule) return;

      const updates: Partial<Schedule> = {
        startTime: Timestamp.fromDate(new Date(start)),
        endTime: Timestamp.fromDate(new Date(end))
      };

      // Check for conflicts before resizing
      const updatedSchedule = { ...schedule, ...updates };
      const conflicts = await validateScheduleConflicts(updatedSchedule);
      
      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(c => c.message).join(', ');
        showSnackbar(`Warning: ${conflictMessages}`, 'warning');
      }

      await handleScheduleUpdate(schedule.scheduleId, updates);
      showSnackbar('Schedule resized successfully', 'success');
    } catch (error) {
      console.error('Error resizing schedule:', error);
      showSnackbar('Failed to resize schedule', 'error');
    }
  };

  const handleSelectSlot = ({ start, end }: any) => {
    // Quick schedule creation on empty slot selection
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    setNewSchedule({
      ...newSchedule,
      startDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().slice(0, 5),
      endTime: endDate.toTimeString().slice(0, 5)
    });
    
    setCreateDialogOpen(true);
  };

  // Context menu actions
  const handleViewDetails = () => {
    if (contextMenu) {
      setSelectedScheduleForDetails(contextMenu.schedule);
      setScheduleDetailsOpen(true);
    }
    handleContextMenuClose();
  };

  const handleEditSchedule = () => {
    if (contextMenu) {
      const schedule = contextMenu.schedule;
      setEditingSchedule(schedule);
      
      // Pre-populate edit form
      const startDate = schedule.startTime?.toDate ? schedule.startTime.toDate() : new Date(schedule.startTime);
      const endDate = schedule.endTime?.toDate ? schedule.endTime.toDate() : new Date(schedule.endTime);
      
      setEditForm({
        employeeId: schedule.employeeId,
        jobSiteId: schedule.jobSiteId,
        startDate: startDate.toISOString().split('T')[0],
        startTime: startDate.toTimeString().slice(0, 5),
        endTime: endDate.toTimeString().slice(0, 5),
        shiftType: schedule.shiftType,
        notes: schedule.notes || '',
        status: schedule.status
      });
      
      setEditDialogOpen(true);
    }
    handleContextMenuClose();
  };

  const handleDuplicateSchedule = async () => {
    if (contextMenu) {
      try {
        const schedule = contextMenu.schedule;
        const startDate = schedule.startTime?.toDate ? schedule.startTime.toDate() : new Date(schedule.startTime);
        const endDate = schedule.endTime?.toDate ? schedule.endTime.toDate() : new Date(schedule.endTime);
        
        // Create duplicate for next day
        const nextDayStart = new Date(startDate);
        nextDayStart.setDate(nextDayStart.getDate() + 1);
        
        const nextDayEnd = new Date(endDate);
        nextDayEnd.setDate(nextDayEnd.getDate() + 1);

        const duplicateSchedule = {
          companyId: schedule.companyId,
          employeeId: schedule.employeeId,
          employeeName: schedule.employeeName,
          jobSiteId: schedule.jobSiteId,
          jobSiteName: schedule.jobSiteName,
          startTime: Timestamp.fromDate(nextDayStart),
          endTime: Timestamp.fromDate(nextDayEnd),
          shiftType: schedule.shiftType,
          status: 'scheduled' as Schedule['status'],
          notes: schedule.notes || '',
          createdBy: currentUser?.uid || 'unknown',
          createdAt: Timestamp.now()
        };

        await addDoc(collection(db, 'schedules'), duplicateSchedule);
        showSnackbar('Schedule duplicated successfully', 'success');
      } catch (error) {
        console.error('Error duplicating schedule:', error);
        showSnackbar('Failed to duplicate schedule', 'error');
      }
    }
    handleContextMenuClose();
  };

  const handleDeleteSchedule = async () => {
    if (contextMenu) {
      try {
        const scheduleRef = doc(db, 'schedules', contextMenu.schedule.scheduleId);
        await deleteDoc(scheduleRef);
        
        await notificationService.sendNotification('schedule_updated', [contextMenu.schedule.employeeId], {
          message: 'Your schedule has been cancelled',
          scheduleId: contextMenu.schedule.scheduleId,
          updatedBy: currentUser?.uid || 'unknown'
        });
        
        showSnackbar('Schedule deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting schedule:', error);
        showSnackbar('Failed to delete schedule', 'error');
      }
    }
    handleContextMenuClose();
  };

  // Handle schedule edit form submission
  const handleEditFormSubmit = async () => {
    if (!editingSchedule) return;

    try {
      const startDateTime = new Date(`${editForm.startDate}T${editForm.startTime}`);
      const endDateTime = new Date(`${editForm.startDate}T${editForm.endTime}`);
      
      const updates: Partial<Schedule> = {
        employeeId: editForm.employeeId,
        jobSiteId: editForm.jobSiteId,
        startTime: Timestamp.fromDate(startDateTime),
        endTime: Timestamp.fromDate(endDateTime),
        shiftType: editForm.shiftType,
        status: editForm.status,
        notes: editForm.notes
      };

      // Create updated schedule for conflict validation
      const updatedSchedule = { ...editingSchedule, ...updates };
      
      // Check for conflicts before saving
      const conflicts = await validateScheduleConflicts(updatedSchedule);
      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(c => c.message).join(', ');
        showSnackbar(`Warning: ${conflictMessages}`, 'warning');
        // Still proceed with update but warn user
      }

      await handleScheduleUpdate(editingSchedule.scheduleId, updates);
      setEditDialogOpen(false);
      setEditingSchedule(null);
      showSnackbar('Schedule updated successfully', 'success');
    } catch (error) {
      console.error('Error updating schedule:', error);
      showSnackbar('Failed to update schedule', 'error');
    }
  };



  const eventStyleGetter = (event: any) => {
    const schedule = event.resource?.schedule;
    let backgroundColor = '#3174ad';
    
    if (schedule) {
      switch (schedule.status) {
        case 'completed':
          backgroundColor = '#4caf50';
          break;
        case 'cancelled':
          backgroundColor = '#f44336';
          break;
        case 'in-progress':
          backgroundColor = '#ff9800';
          break;
        case 'pending':
          backgroundColor = '#9c27b0';
          break;
        default:
          backgroundColor = '#3174ad';
      }
      
      // Different colors for different shift types
      switch (schedule.shiftType) {
        case 'overtime':
          backgroundColor = '#ff5722';
          break;
        case 'emergency':
          backgroundColor = '#e91e63';
          break;
        case 'training':
          backgroundColor = '#795548';
          break;
      }
    }

    const style = {
      backgroundColor,
      borderRadius: '6px',
      opacity: 0.9,
      color: 'white',
      border: '1px solid rgba(255,255,255,0.2)',
      display: 'block',
      fontSize: '0.75rem',
      padding: 0
    };
    return { style };
  };

  // Utility functions
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Apply additional filters to schedules
  const applyAdditionalFilters = (schedules: Schedule[], filters: FilterCriteria): Schedule[] => {
    let filtered = schedules;

    // Text search
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(schedule => 
        schedule.employeeName?.toLowerCase().includes(query) ||
        schedule.jobSiteName?.toLowerCase().includes(query) ||
        schedule.notes?.toLowerCase().includes(query)
      );
    }

    // Employee filter
    if (filters.employeeIds && filters.employeeIds.length > 0) {
      filtered = filtered.filter(schedule => 
        filters.employeeIds!.includes(schedule.employeeId)
      );
    }

    // Job site filter
    if (filters.jobSiteIds && filters.jobSiteIds.length > 0) {
      filtered = filtered.filter(schedule => 
        filters.jobSiteIds!.includes(schedule.jobSiteId)
      );
    }

    // Shift type filter
    if (filters.shiftTypes && filters.shiftTypes.length > 0) {
      filtered = filtered.filter(schedule => 
        filters.shiftTypes!.includes(schedule.shiftType)
      );
    }

    // Status filter
    if (filters.statuses && filters.statuses.length > 0) {
      filtered = filtered.filter(schedule => 
        filters.statuses!.includes(schedule.status)
      );
    }

    // Date range filter
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      filtered = filtered.filter(schedule => {
        const scheduleStart = schedule.startTime.toDate();
        return scheduleStart >= start && scheduleStart <= end;
      });
    }

    return filtered;
  };

  // Check if all required data is loaded
  const isDataLoaded = useMemo(() => {
    // If there are no schedules, we're ready to show empty calendar
    if (schedules.length === 0) return true;
    
    // If timeout has elapsed, show calendar anyway to prevent infinite loading
    if (dataLoadTimeout) return true;
    
    // If there are schedules, ensure we have employee and job site data loaded
    return employees.length > 0 && jobSites.length > 0;
  }, [schedules.length, employees.length, jobSites.length, dataLoadTimeout]);

  // Convert schedules to calendar events with enhanced filtering
  const calendarEvents = useMemo(() => {
    // Don't render events if we don't have employee/job site data yet (unless timeout)
    if (!isDataLoaded && !dataLoadTimeout) {
      return [];
    }

    const baseFiltered = filteredSchedules;
    const additionalFiltered = applyAdditionalFilters(baseFiltered, currentFilters);
    
    const events = additionalFiltered.map((schedule: Schedule) => {
      // All schedules now have consistent startTime/endTime fields
      const startDate = schedule.startTime?.toDate ? schedule.startTime.toDate() :
                       schedule.startTime ? new Date(schedule.startTime) : new Date();
                       
      const endDate = schedule.endTime?.toDate ? schedule.endTime.toDate() :
                     schedule.endTime ? new Date(schedule.endTime) : new Date();

      // Create a robust title with fallbacks - check if data is still loading
      let employeeName = schedule.employeeName;
      let jobSiteName = schedule.jobSiteName;

      // If names are not stored in schedule, look them up
      if (!employeeName && employees.length > 0) {
        const employee = employees.find(emp => emp.id === schedule.employeeId);
        if (employee) {
          employeeName = `${employee.profile?.firstName || ''} ${employee.profile?.lastName || ''}`.trim() || 
                        employee.email || 
                        'Unknown Employee';
        } else {
          employeeName = 'Unknown Employee';
        }
      }

      if (!jobSiteName && jobSites.length > 0) {
        const jobSite = jobSites.find(site => site.siteId === schedule.jobSiteId);
        jobSiteName = jobSite?.siteName || 'Unknown Job Site';
      }

      // Final fallbacks
      employeeName = employeeName || 'Loading...';
      jobSiteName = jobSiteName || 'Loading...';

      const title = `${employeeName} - ${jobSiteName}`;

      return {
        id: schedule.scheduleId,
        title,
        start: startDate,
        end: endDate,
        resource: {
          schedule,
          type: 'schedule',
          employeeId: schedule.employeeId,
          jobSiteId: schedule.jobSiteId,
        },
      };
    });

    return events;
  }, [filteredSchedules, currentFilters, employees, jobSites, isDataLoaded, dataLoadTimeout]);

  if (loading || !isDataLoaded) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography>
            {loading ? 'Loading schedules...' : 'Loading employee and job site data...'}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <ScheduleIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Schedule Management
          </Typography>
          
          {/* Action buttons */}
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setFilterManagerOpen(true)}
            sx={{ mr: 1 }}
          >
            Filters
          </Button>

          <Button
            variant="outlined"
            startIcon={<TemplateIcon />}
            onClick={() => setTemplateLibraryOpen(true)}
            sx={{ mr: 1 }}
          >
            Templates
          </Button>

          {hasSelection && (
            <Button
              variant="contained"
              startIcon={<PlaylistAddIcon />}
              onClick={() => setBatchPanelOpen(true)}
              sx={{ mr: 1 }}
            >
              Bulk Actions ({selectedSchedules.length})
            </Button>
          )}
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Add Schedule
          </Button>
          
          <IconButton>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, p: 2, minHeight: 0 }}>
        <Paper sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <EnhancedDragDropProvider
              onScheduleMove={handleScheduleMove}
              onScheduleCopy={handleScheduleCopy}
              enableMultiSelect={true}
              enableConflictDetection={true}
              enableSmartSuggestions={true}
              restrictionPolicy="warning"
            >
              <DragAndDropCalendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor={(event: any) => event.start}
                endAccessor={(event: any) => event.end}
                style={{ height: '100%', minHeight: '500px' }}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onView={handleViewChange}
                views={['month', 'week', 'day', 'agenda']}
                view={currentView as View}
                date={currentDate}
                onNavigate={setDate}
                eventPropGetter={eventStyleGetter}
                selectable
                resizable
                components={{
                  event: ({ event }: { event: any }) => (
                    <div
                      onContextMenu={(e) => handleEventContextMenu(event, e)}
                      style={{ height: '100%', cursor: 'grab' }}
                    >
                      {event.title}
                    </div>
                  )
                }}
                popup
                showMultiDayTimes
                step={30}
                timeslots={2}
              />
            </EnhancedDragDropProvider>
          </Box>
        </Paper>
      </Box>

      {/* Batch Operations Panel */}
      {hasSelection && (
        <BatchOperationsPanel
          open={batchPanelOpen}
          onClose={() => setBatchPanelOpen(false)}
          selectedSchedules={selectedSchedules}
          onExecute={handleBatchOperation}
        />
      )}

      {/* Template Library */}
      <TemplateLibrary
        open={templateLibraryOpen}
        onClose={() => setTemplateLibraryOpen(false)}
        onSelectTemplate={handleTemplateSelect}
        onCreateTemplate={handleCreateTemplate}
      />

      {/* Filter Manager */}
      <FilterManager
        open={filterManagerOpen}
        onClose={() => setFilterManagerOpen(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={currentFilters}
        schedules={schedules}
        employees={employees}
        jobSites={jobSites}
      />

      {/* Template Wizard */}
      <TemplateWizard
        open={templateWizardOpen}
        onClose={() => setTemplateWizardOpen(false)}
        onSave={handleTemplateSave}
        mode="create"
      />

      {/* Template Application Dialog */}
      <Dialog open={templateApplicationOpen} onClose={() => setTemplateApplicationOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Apply Template: {selectedTemplateForApplication?.templateName}
          <Typography variant="body2" color="text.secondary">
            {selectedTemplateForApplication?.description}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '500px' }}>
            <TextField
              label="Start Date"
              type="date"
              value={templateApplicationForm.startDate}
              onChange={(e) => setTemplateApplicationForm({ ...templateApplicationForm, startDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              required
            />
            
            <TextField
              label="End Date (Optional)"
              type="date"
              value={templateApplicationForm.endDate}
              onChange={(e) => setTemplateApplicationForm({ ...templateApplicationForm, endDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Leave empty for single application or set for recurring applications"
            />

            <FormControl fullWidth required>
              <InputLabel id="employees-label">Select Employees</InputLabel>
              <Select
                labelId="employees-label"
                multiple
                value={templateApplicationForm.employeeIds}
                onChange={(e) => setTemplateApplicationForm({ 
                  ...templateApplicationForm, 
                  employeeIds: typeof e.target.value === 'string' ? [e.target.value] : e.target.value 
                })}
                label="Select Employees"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const employee = employees.find(emp => emp.id === value);
                      return employee ? `${employee.profile?.firstName} ${employee.profile?.lastName}` : value;
                    }).join(', ')}
                  </Box>
                )}
              >
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.profile?.firstName} {employee.profile?.lastName} ({employee.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="job-site-override-label">Job Site (Override)</InputLabel>
              <Select
                labelId="job-site-override-label"
                value={templateApplicationForm.jobSiteId}
                onChange={(e) => setTemplateApplicationForm({ ...templateApplicationForm, jobSiteId: e.target.value })}
                label="Job Site (Override)"
              >
                <MenuItem value="">
                  <em>Use template default: {selectedTemplateForApplication?.jobSiteId || 'None'}</em>
                </MenuItem>
                {jobSites.map((jobSite) => (
                  <MenuItem key={jobSite.siteId} value={jobSite.siteId}>
                    {jobSite.siteName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="h6" sx={{ mt: 2 }}>Customizations (Override Template Defaults)</Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Custom Start Time"
                type="time"
                value={templateApplicationForm.customizations.startTime}
                onChange={(e) => setTemplateApplicationForm({ 
                  ...templateApplicationForm, 
                  customizations: { ...templateApplicationForm.customizations, startTime: e.target.value }
                })}
                InputLabelProps={{ shrink: true }}
                helperText={`Template default: ${selectedTemplateForApplication?.defaultStartTime || 'N/A'}`}
              />
              
              <TextField
                label="Custom End Time"
                type="time"
                value={templateApplicationForm.customizations.endTime}
                onChange={(e) => setTemplateApplicationForm({ 
                  ...templateApplicationForm, 
                  customizations: { ...templateApplicationForm.customizations, endTime: e.target.value }
                })}
                InputLabelProps={{ shrink: true }}
                helperText={`Template default: ${selectedTemplateForApplication?.defaultEndTime || 'N/A'}`}
              />
            </Box>

            <TextField
              label="Custom Break Duration (minutes)"
              type="number"
              value={templateApplicationForm.customizations.breakDuration || ''}
              onChange={(e) => setTemplateApplicationForm({ 
                ...templateApplicationForm, 
                customizations: { 
                  ...templateApplicationForm.customizations, 
                  breakDuration: e.target.value ? parseInt(e.target.value) : undefined 
                }
              })}
              fullWidth
              helperText={`Template default: ${selectedTemplateForApplication?.breakDuration || 0} minutes`}
            />

            <TextField
              label="Special Instructions"
              multiline
              rows={3}
              value={templateApplicationForm.customizations.specialInstructions}
              onChange={(e) => setTemplateApplicationForm({ 
                ...templateApplicationForm, 
                customizations: { ...templateApplicationForm.customizations, specialInstructions: e.target.value }
              })}
              fullWidth
              placeholder="Additional instructions or override template instructions..."
            />

            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
              <FormControl component="fieldset">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={templateApplicationForm.skipConflicts}
                    onChange={(e) => setTemplateApplicationForm({ ...templateApplicationForm, skipConflicts: e.target.checked })}
                  />
                  <Typography sx={{ ml: 1 }}>Skip schedules with conflicts</Typography>
                </Box>
              </FormControl>
              
              <FormControl component="fieldset">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={templateApplicationForm.sendNotifications}
                    onChange={(e) => setTemplateApplicationForm({ ...templateApplicationForm, sendNotifications: e.target.checked })}
                  />
                  <Typography sx={{ ml: 1 }}>Send notifications to employees</Typography>
                </Box>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateApplicationOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              handleTemplateApplication({
                startDate: new Date(templateApplicationForm.startDate),
                endDate: templateApplicationForm.endDate ? new Date(templateApplicationForm.endDate) : undefined,
                employeeIds: templateApplicationForm.employeeIds,
                jobSiteId: templateApplicationForm.jobSiteId || undefined,
                customizations: templateApplicationForm.customizations,
                skipConflicts: templateApplicationForm.skipConflicts,
                sendNotifications: templateApplicationForm.sendNotifications
              });
            }}
            variant="contained"
            disabled={templateApplicationForm.employeeIds.length === 0}
          >
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>

              {/* Schedule Creation Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Schedule</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel id="employee-label">Employee</InputLabel>
                <Select
                  labelId="employee-label"
                  id="employee"
                  value={newSchedule.employeeId}
                  label="Employee"
                  onChange={(e) => setNewSchedule({ ...newSchedule, employeeId: e.target.value })}
                >
                  {employees.map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.profile?.firstName} {employee.profile?.lastName} ({employee.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="job-site-label">Job Site</InputLabel>
                <Select
                  labelId="job-site-label"
                  id="jobSite"
                  value={newSchedule.jobSiteId}
                  label="Job Site"
                  onChange={(e) => setNewSchedule({ ...newSchedule, jobSiteId: e.target.value })}
                >
                  {jobSites.map((jobSite) => (
                    <MenuItem key={jobSite.siteId} value={jobSite.siteId}>
                      {jobSite.siteName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Start Date"
                type="date"
                value={newSchedule.startDate}
                onChange={(e) => setNewSchedule({ ...newSchedule, startDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Start Time"
                type="time"
                value={newSchedule.startTime}
                onChange={(e) => setNewSchedule({ ...newSchedule, startTime: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="End Time"
                type="time"
                value={newSchedule.endTime}
                onChange={(e) => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />

              <FormControl fullWidth>
                <InputLabel id="shift-type-label">Shift Type</InputLabel>
                <Select
                  labelId="shift-type-label"
                  id="shiftType"
                  value={newSchedule.shiftType}
                  label="Shift Type"
                  onChange={(e) => setNewSchedule({ ...newSchedule, shiftType: e.target.value as Schedule['shiftType'] })}
                >
                  <MenuItem value="regular">Regular</MenuItem>
                  <MenuItem value="overtime">Overtime</MenuItem>
                  <MenuItem value="emergency">Emergency</MenuItem>
                  <MenuItem value="training">Training</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Notes"
                multiline
                rows={3}
                value={newSchedule.notes}
                onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })}
                fullWidth
                placeholder="Optional notes for this schedule..."
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleCreate} variant="contained">Create Schedule</Button>
          </DialogActions>
        </Dialog>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEditSchedule}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Schedule</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDuplicateSchedule}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteSchedule} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Schedule Details Dialog */}
      <Dialog open={scheduleDetailsOpen} onClose={() => setScheduleDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon color="primary" />
            Schedule Details
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedScheduleForDetails && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Employee Information
                    </Typography>
                    <Typography variant="body1">
                      <strong>Name:</strong> {selectedScheduleForDetails.employeeName || 'Unknown'}
                    </Typography>
                    <Typography variant="body1">
                      <strong>ID:</strong> {selectedScheduleForDetails.employeeId}
                    </Typography>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Job Site Information
                    </Typography>
                    <Typography variant="body1">
                      <strong>Site:</strong> {selectedScheduleForDetails.jobSiteName || 'Unknown'}
                    </Typography>
                    <Typography variant="body1">
                      <strong>ID:</strong> {selectedScheduleForDetails.jobSiteId}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <TimeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Schedule Information
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <Typography variant="body1">
                      <strong>Start:</strong> {selectedScheduleForDetails.startTime?.toDate ? 
                        selectedScheduleForDetails.startTime.toDate().toLocaleString() : 
                        new Date(selectedScheduleForDetails.startTime).toLocaleString()}
                    </Typography>
                    <Typography variant="body1">
                      <strong>End:</strong> {selectedScheduleForDetails.endTime?.toDate ? 
                        selectedScheduleForDetails.endTime.toDate().toLocaleString() : 
                        new Date(selectedScheduleForDetails.endTime).toLocaleString()}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Shift Type:</strong> {selectedScheduleForDetails.shiftType}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        <strong>Status:</strong>
                      </Typography>
                      <Chip 
                        label={selectedScheduleForDetails.status}
                        size="small"
                        color={
                          selectedScheduleForDetails.status === 'completed' ? 'success' :
                          selectedScheduleForDetails.status === 'cancelled' ? 'error' :
                          selectedScheduleForDetails.status === 'in-progress' ? 'warning' :
                          'default'
                        }
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {selectedScheduleForDetails.notes && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <NotesIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Notes
                    </Typography>
                    <Typography variant="body1">
                      {selectedScheduleForDetails.notes}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDetailsOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setScheduleDetailsOpen(false);
              if (selectedScheduleForDetails) {
                setContextMenu({
                  mouseX: 0,
                  mouseY: 0,
                  schedule: selectedScheduleForDetails
                });
                handleEditSchedule();
              }
            }}
          >
            Edit Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Schedule</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="edit-employee-label">Employee</InputLabel>
              <Select
                labelId="edit-employee-label"
                value={editForm.employeeId}
                label="Employee"
                onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
              >
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.profile?.firstName} {employee.profile?.lastName} ({employee.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="edit-job-site-label">Job Site</InputLabel>
              <Select
                labelId="edit-job-site-label"
                value={editForm.jobSiteId}
                label="Job Site"
                onChange={(e) => setEditForm({ ...editForm, jobSiteId: e.target.value })}
              >
                {jobSites.map((jobSite) => (
                  <MenuItem key={jobSite.siteId} value={jobSite.siteId}>
                    {jobSite.siteName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Date"
              type="date"
              value={editForm.startDate}
              onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Time"
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End Time"
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel id="edit-shift-type-label">Shift Type</InputLabel>
              <Select
                labelId="edit-shift-type-label"
                value={editForm.shiftType}
                label="Shift Type"
                onChange={(e) => setEditForm({ ...editForm, shiftType: e.target.value as Schedule['shiftType'] })}
              >
                <MenuItem value="regular">Regular</MenuItem>
                <MenuItem value="overtime">Overtime</MenuItem>
                <MenuItem value="emergency">Emergency</MenuItem>
                <MenuItem value="training">Training</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="edit-status-label">Status</InputLabel>
              <Select
                labelId="edit-status-label"
                value={editForm.status}
                label="Status"
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Schedule['status'] })}
              >
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Notes"
              multiline
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              fullWidth
              placeholder="Optional notes for this schedule..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditFormSubmit} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ScheduleManagement; 