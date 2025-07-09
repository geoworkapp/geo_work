import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { Schedule, ScheduleTemplate, ScheduleConflict, JobSite, User } from '@shared/types';

// Calendar view types
export type CalendarView = 'month' | 'week' | 'day' | 'timeline' | 'resource' | 'agenda';

// Filter and search state
export interface CalendarFilters {
  jobSiteIds: string[];
  employeeIds: string[];
  shiftTypes: Schedule['shiftType'][];
  status: Schedule['status'][];
  dateRange: {
    start: Date;
    end: Date;
  };
  searchQuery: string;
  showConflictsOnly: boolean;
  showTemplatesOnly: boolean;
}

// Selection and drag state
export interface SelectionState {
  selectedScheduleIds: string[];
  selectedSlot: {
    start: Date;
    end: Date;
    resourceId?: string;
  } | null;
  draggedSchedule: Schedule | null;
  dropTarget: {
    start: Date;
    end: Date;
    resourceId?: string;
  } | null;
}

// Template state
export interface TemplateState {
  activeTemplate: ScheduleTemplate | null;
  templateLibraryOpen: boolean;
  templateWizardOpen: boolean;
  templateCategories: string[];
}

// Bulk operations state
export interface BulkOperationsState {
  panelOpen: boolean;
  operation: 'move' | 'copy' | 'delete' | 'update' | null;
  targetDate: Date | null;
  targetEmployeeIds: string[];
  targetJobSiteIds: string[];
}

// Main calendar state
export interface CalendarState {
  // View state
  currentView: CalendarView;
  currentDate: Date;
  dateRange: { start: Date; end: Date };
  
  // Data
  schedules: Schedule[];
  templates: ScheduleTemplate[];
  conflicts: ScheduleConflict[];
  employees: User[];
  jobSites: JobSite[];
  
  // UI state
  loading: boolean;
  error: string | null;
  filters: CalendarFilters;
  selection: SelectionState;
  templateState: TemplateState;
  bulkOperations: BulkOperationsState;
  
  // Display options
  showWeekends: boolean;
  timeSlotDuration: number; // minutes
  dayStartTime: string; // HH:MM
  dayEndTime: string; // HH:MM
  conflictDetectionEnabled: boolean;
  autoSaveEnabled: boolean;
}

// Action types
type CalendarAction =
  | { type: 'SET_VIEW'; payload: CalendarView }
  | { type: 'SET_DATE'; payload: Date }
  | { type: 'SET_SCHEDULES'; payload: Schedule[] }
  | { type: 'SET_TEMPLATES'; payload: ScheduleTemplate[] }
  | { type: 'SET_CONFLICTS'; payload: ScheduleConflict[] }
  | { type: 'SET_EMPLOYEES'; payload: User[] }
  | { type: 'SET_JOB_SITES'; payload: JobSite[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_FILTERS'; payload: Partial<CalendarFilters> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SELECT_SCHEDULES'; payload: string[] }
  | { type: 'SELECT_SLOT'; payload: { start: Date; end: Date; resourceId?: string } | null }
  | { type: 'START_DRAG'; payload: Schedule }
  | { type: 'SET_DROP_TARGET'; payload: { start: Date; end: Date; resourceId?: string } | null }
  | { type: 'END_DRAG' }
  | { type: 'SET_ACTIVE_TEMPLATE'; payload: ScheduleTemplate | null }
  | { type: 'TOGGLE_TEMPLATE_LIBRARY'; payload?: boolean }
  | { type: 'TOGGLE_TEMPLATE_WIZARD'; payload?: boolean }
  | { type: 'SET_TEMPLATE_CATEGORIES'; payload: string[] }
  | { type: 'TOGGLE_BULK_PANEL'; payload?: boolean }
  | { type: 'SET_BULK_OPERATION'; payload: BulkOperationsState['operation'] }
  | { type: 'SET_BULK_TARGET_DATE'; payload: Date | null }
  | { type: 'SET_BULK_TARGET_EMPLOYEES'; payload: string[] }
  | { type: 'SET_BULK_TARGET_JOBSITES'; payload: string[] }
  | { type: 'TOGGLE_WEEKENDS'; payload?: boolean }
  | { type: 'SET_TIME_SLOT_DURATION'; payload: number }
  | { type: 'SET_DAY_HOURS'; payload: { start: string; end: string } }
  | { type: 'TOGGLE_CONFLICT_DETECTION'; payload?: boolean }
  | { type: 'TOGGLE_AUTO_SAVE'; payload?: boolean };

// Initial state
const initialState: CalendarState = {
  currentView: 'month',
  currentDate: new Date(),
  dateRange: {
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  },
  schedules: [],
  templates: [],
  conflicts: [],
  employees: [],
  jobSites: [],
  loading: false,
  error: null,
  filters: {
    jobSiteIds: [],
    employeeIds: [],
    shiftTypes: [],
    status: [],
    dateRange: {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date())
    },
    searchQuery: '',
    showConflictsOnly: false,
    showTemplatesOnly: false
  },
  selection: {
    selectedScheduleIds: [],
    selectedSlot: null,
    draggedSchedule: null,
    dropTarget: null
  },
  templateState: {
    activeTemplate: null,
    templateLibraryOpen: false,
    templateWizardOpen: false,
    templateCategories: []
  },
  bulkOperations: {
    panelOpen: false,
    operation: null,
    targetDate: null,
    targetEmployeeIds: [],
    targetJobSiteIds: []
  },
  showWeekends: true,
  timeSlotDuration: 30,
  dayStartTime: '08:00',
  dayEndTime: '18:00',
  conflictDetectionEnabled: true,
  autoSaveEnabled: true
};

// Helper function to calculate date range based on view
const calculateDateRange = (date: Date, view: CalendarView): { start: Date; end: Date } => {
  switch (view) {
    case 'month':
      return {
        start: startOfMonth(date),
        end: endOfMonth(date)
      };
    case 'week':
    case 'resource':
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 })
      };
    case 'day':
      return {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
      };
    default:
      return {
        start: startOfMonth(date),
        end: endOfMonth(date)
      };
  }
};

// Reducer function
const calendarReducer = (state: CalendarState, action: CalendarAction): CalendarState => {
  switch (action.type) {
    case 'SET_VIEW':
      const newDateRange = calculateDateRange(state.currentDate, action.payload);
      return {
        ...state,
        currentView: action.payload,
        dateRange: newDateRange,
        filters: {
          ...state.filters,
          dateRange: newDateRange
        }
      };

    case 'SET_DATE':
      const dateRange = calculateDateRange(action.payload, state.currentView);
      return {
        ...state,
        currentDate: action.payload,
        dateRange,
        filters: {
          ...state.filters,
          dateRange
        }
      };

    case 'SET_SCHEDULES':
      return { ...state, schedules: action.payload };

    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };

    case 'SET_CONFLICTS':
      return { ...state, conflicts: action.payload };

    case 'SET_EMPLOYEES':
      return { ...state, employees: action.payload };

    case 'SET_JOB_SITES':
      return { ...state, jobSites: action.payload };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'UPDATE_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };

    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: {
          ...initialState.filters,
          dateRange: state.filters.dateRange
        }
      };

    case 'SELECT_SCHEDULES':
      return {
        ...state,
        selection: {
          ...state.selection,
          selectedScheduleIds: action.payload
        }
      };

    case 'SELECT_SLOT':
      return {
        ...state,
        selection: {
          ...state.selection,
          selectedSlot: action.payload
        }
      };

    case 'START_DRAG':
      return {
        ...state,
        selection: {
          ...state.selection,
          draggedSchedule: action.payload
        }
      };

    case 'SET_DROP_TARGET':
      return {
        ...state,
        selection: {
          ...state.selection,
          dropTarget: action.payload
        }
      };

    case 'END_DRAG':
      return {
        ...state,
        selection: {
          ...state.selection,
          draggedSchedule: null,
          dropTarget: null
        }
      };

    case 'SET_ACTIVE_TEMPLATE':
      return {
        ...state,
        templateState: {
          ...state.templateState,
          activeTemplate: action.payload
        }
      };

    case 'TOGGLE_TEMPLATE_LIBRARY':
      return {
        ...state,
        templateState: {
          ...state.templateState,
          templateLibraryOpen: action.payload ?? !state.templateState.templateLibraryOpen
        }
      };

    case 'TOGGLE_TEMPLATE_WIZARD':
      return {
        ...state,
        templateState: {
          ...state.templateState,
          templateWizardOpen: action.payload ?? !state.templateState.templateWizardOpen
        }
      };

    case 'SET_TEMPLATE_CATEGORIES':
      return {
        ...state,
        templateState: {
          ...state.templateState,
          templateCategories: action.payload
        }
      };

    case 'TOGGLE_BULK_PANEL':
      return {
        ...state,
        bulkOperations: {
          ...state.bulkOperations,
          panelOpen: action.payload ?? !state.bulkOperations.panelOpen
        }
      };

    case 'SET_BULK_OPERATION':
      return {
        ...state,
        bulkOperations: {
          ...state.bulkOperations,
          operation: action.payload
        }
      };

    case 'SET_BULK_TARGET_DATE':
      return {
        ...state,
        bulkOperations: {
          ...state.bulkOperations,
          targetDate: action.payload
        }
      };

    case 'SET_BULK_TARGET_EMPLOYEES':
      return {
        ...state,
        bulkOperations: {
          ...state.bulkOperations,
          targetEmployeeIds: action.payload
        }
      };

    case 'SET_BULK_TARGET_JOBSITES':
      return {
        ...state,
        bulkOperations: {
          ...state.bulkOperations,
          targetJobSiteIds: action.payload
        }
      };

    case 'TOGGLE_WEEKENDS':
      return {
        ...state,
        showWeekends: action.payload ?? !state.showWeekends
      };

    case 'SET_TIME_SLOT_DURATION':
      return {
        ...state,
        timeSlotDuration: action.payload
      };

    case 'SET_DAY_HOURS':
      return {
        ...state,
        dayStartTime: action.payload.start,
        dayEndTime: action.payload.end
      };

    case 'TOGGLE_CONFLICT_DETECTION':
      return {
        ...state,
        conflictDetectionEnabled: action.payload ?? !state.conflictDetectionEnabled
      };

    case 'TOGGLE_AUTO_SAVE':
      return {
        ...state,
        autoSaveEnabled: action.payload ?? !state.autoSaveEnabled
      };

    default:
      return state;
  }
};

// Context type
interface CalendarContextType {
  state: CalendarState;
  
  // View actions
  setView: (view: CalendarView) => void;
  setDate: (date: Date) => void;
  navigateDate: (direction: 'prev' | 'next' | 'today') => void;
  
  // Data actions
  setSchedules: (schedules: Schedule[]) => void;
  setTemplates: (templates: ScheduleTemplate[]) => void;
  setConflicts: (conflicts: ScheduleConflict[]) => void;
  setEmployees: (employees: User[]) => void;
  setJobSites: (jobSites: JobSite[]) => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Filter actions
  updateFilters: (filters: Partial<CalendarFilters>) => void;
  clearFilters: () => void;
  
  // Selection actions
  selectSchedules: (scheduleIds: string[]) => void;
  selectSchedule: (scheduleId: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  selectSlot: (slot: { start: Date; end: Date; resourceId?: string } | null) => void;
  
  // Drag and drop actions
  startDrag: (schedule: Schedule) => void;
  setDropTarget: (target: { start: Date; end: Date; resourceId?: string } | null) => void;
  endDrag: () => void;
  
  // Template actions
  setActiveTemplate: (template: ScheduleTemplate | null) => void;
  toggleTemplateLibrary: (open?: boolean) => void;
  toggleTemplateWizard: (open?: boolean) => void;
  setTemplateCategories: (categories: string[]) => void;
  
  // Bulk operations actions
  toggleBulkPanel: (open?: boolean) => void;
  setBulkOperation: (operation: BulkOperationsState['operation']) => void;
  setBulkTargetDate: (date: Date | null) => void;
  setBulkTargetEmployees: (employeeIds: string[]) => void;
  setBulkTargetJobSites: (jobSiteIds: string[]) => void;
  
  // Settings actions
  toggleWeekends: (show?: boolean) => void;
  setTimeSlotDuration: (duration: number) => void;
  setDayHours: (start: string, end: string) => void;
  toggleConflictDetection: (enabled?: boolean) => void;
  toggleAutoSave: (enabled?: boolean) => void;
  
  // Computed values
  filteredSchedules: Schedule[];
  selectedSchedules: Schedule[];
  hasSelection: boolean;
  hasConflicts: boolean;
  canDrop: boolean;
}

// Context
const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

// Provider component
export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(calendarReducer, initialState);

  // View actions
  const setView = useCallback((view: CalendarView) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  }, []);

  const setDate = useCallback((date: Date) => {
    dispatch({ type: 'SET_DATE', payload: date });
  }, []);

  const navigateDate = useCallback((direction: 'prev' | 'next' | 'today') => {
    const { currentDate, currentView } = state;
    let newDate: Date;

    if (direction === 'today') {
      newDate = new Date();
    } else {
      const increment = direction === 'next' ? 1 : -1;
      
      switch (currentView) {
        case 'month':
          newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + increment, 1);
          break;
        case 'week':
        case 'resource':
          newDate = new Date(currentDate.getTime() + (7 * 24 * 60 * 60 * 1000 * increment));
          break;
        case 'day':
          newDate = new Date(currentDate.getTime() + (24 * 60 * 60 * 1000 * increment));
          break;
        default:
          newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + increment, 1);
      }
    }

    dispatch({ type: 'SET_DATE', payload: newDate });
  }, [state.currentDate, state.currentView]);

  // Data actions
  const setSchedules = useCallback((schedules: Schedule[]) => {
    dispatch({ type: 'SET_SCHEDULES', payload: schedules });
  }, []);

  const setTemplates = useCallback((templates: ScheduleTemplate[]) => {
    dispatch({ type: 'SET_TEMPLATES', payload: templates });
  }, []);

  const setConflicts = useCallback((conflicts: ScheduleConflict[]) => {
    dispatch({ type: 'SET_CONFLICTS', payload: conflicts });
  }, []);

  const setEmployees = useCallback((employees: User[]) => {
    dispatch({ type: 'SET_EMPLOYEES', payload: employees });
  }, []);

  const setJobSites = useCallback((jobSites: JobSite[]) => {
    dispatch({ type: 'SET_JOB_SITES', payload: jobSites });
  }, []);

  // UI actions
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  // Filter actions
  const updateFilters = useCallback((filters: Partial<CalendarFilters>) => {
    dispatch({ type: 'UPDATE_FILTERS', payload: filters });
  }, []);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  // Selection actions
  const selectSchedules = useCallback((scheduleIds: string[]) => {
    dispatch({ type: 'SELECT_SCHEDULES', payload: scheduleIds });
  }, []);

  const selectSchedule = useCallback((scheduleId: string, multiSelect = false) => {
    const { selectedScheduleIds } = state.selection;
    let newSelection: string[];

    if (multiSelect) {
      newSelection = selectedScheduleIds.includes(scheduleId)
        ? selectedScheduleIds.filter(id => id !== scheduleId)
        : [...selectedScheduleIds, scheduleId];
    } else {
      newSelection = [scheduleId];
    }

    dispatch({ type: 'SELECT_SCHEDULES', payload: newSelection });
  }, [state.selection.selectedScheduleIds]);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'SELECT_SCHEDULES', payload: [] });
  }, []);

  const selectSlot = useCallback((slot: { start: Date; end: Date; resourceId?: string } | null) => {
    dispatch({ type: 'SELECT_SLOT', payload: slot });
  }, []);

  // Drag and drop actions
  const startDrag = useCallback((schedule: Schedule) => {
    dispatch({ type: 'START_DRAG', payload: schedule });
  }, []);

  const setDropTarget = useCallback((target: { start: Date; end: Date; resourceId?: string } | null) => {
    dispatch({ type: 'SET_DROP_TARGET', payload: target });
  }, []);

  const endDrag = useCallback(() => {
    dispatch({ type: 'END_DRAG' });
  }, []);

  // Template actions
  const setActiveTemplate = useCallback((template: ScheduleTemplate | null) => {
    dispatch({ type: 'SET_ACTIVE_TEMPLATE', payload: template });
  }, []);

  const toggleTemplateLibrary = useCallback((open?: boolean) => {
    dispatch({ type: 'TOGGLE_TEMPLATE_LIBRARY', payload: open });
  }, []);

  const toggleTemplateWizard = useCallback((open?: boolean) => {
    dispatch({ type: 'TOGGLE_TEMPLATE_WIZARD', payload: open });
  }, []);

  const setTemplateCategories = useCallback((categories: string[]) => {
    dispatch({ type: 'SET_TEMPLATE_CATEGORIES', payload: categories });
  }, []);

  // Bulk operations actions
  const toggleBulkPanel = useCallback((open?: boolean) => {
    dispatch({ type: 'TOGGLE_BULK_PANEL', payload: open });
  }, []);

  const setBulkOperation = useCallback((operation: BulkOperationsState['operation']) => {
    dispatch({ type: 'SET_BULK_OPERATION', payload: operation });
  }, []);

  const setBulkTargetDate = useCallback((date: Date | null) => {
    dispatch({ type: 'SET_BULK_TARGET_DATE', payload: date });
  }, []);

  const setBulkTargetEmployees = useCallback((employeeIds: string[]) => {
    dispatch({ type: 'SET_BULK_TARGET_EMPLOYEES', payload: employeeIds });
  }, []);

  const setBulkTargetJobSites = useCallback((jobSiteIds: string[]) => {
    dispatch({ type: 'SET_BULK_TARGET_JOBSITES', payload: jobSiteIds });
  }, []);

  // Settings actions
  const toggleWeekends = useCallback((show?: boolean) => {
    dispatch({ type: 'TOGGLE_WEEKENDS', payload: show });
  }, []);

  const setTimeSlotDuration = useCallback((duration: number) => {
    dispatch({ type: 'SET_TIME_SLOT_DURATION', payload: duration });
  }, []);

  const setDayHours = useCallback((start: string, end: string) => {
    dispatch({ type: 'SET_DAY_HOURS', payload: { start, end } });
  }, []);

  const toggleConflictDetection = useCallback((enabled?: boolean) => {
    dispatch({ type: 'TOGGLE_CONFLICT_DETECTION', payload: enabled });
  }, []);

  const toggleAutoSave = useCallback((enabled?: boolean) => {
    dispatch({ type: 'TOGGLE_AUTO_SAVE', payload: enabled });
  }, []);

  // Computed values
  const filteredSchedules = useMemo(() => {
    const { schedules, filters } = state;
    
    return schedules.filter(schedule => {
      // Date range filter - All schedules now have consistent startTime field
      const scheduleStartDate = schedule.startTime?.toDate ? schedule.startTime.toDate() : 
                               schedule.startTime ? new Date(schedule.startTime) : null;
      
      if (!scheduleStartDate) {
        return false;
      }
      
      if (scheduleStartDate < filters.dateRange.start || 
          scheduleStartDate > filters.dateRange.end) {
        return false;
      }

      // Job site filter
      if (filters.jobSiteIds.length > 0 && !filters.jobSiteIds.includes(schedule.jobSiteId)) {
        return false;
      }

      // Employee filter
      if (filters.employeeIds.length > 0 && !filters.employeeIds.includes(schedule.employeeId)) {
        return false;
      }

      // Shift type filter
      if (filters.shiftTypes.length > 0 && !filters.shiftTypes.includes(schedule.shiftType)) {
        return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(schedule.status)) {
        return false;
      }

      // Search query filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        return (
          schedule.employeeName?.toLowerCase().includes(searchLower) ||
          schedule.jobSiteName?.toLowerCase().includes(searchLower) ||
          schedule.notes?.toLowerCase().includes(searchLower)
        );
      }

      // Conflicts filter
      if (filters.showConflictsOnly) {
        return state.conflicts.some(conflict => 
          conflict.conflictingSchedules.includes(schedule.scheduleId || schedule.id)
        );
      }

      return true;
    });
  }, [state.schedules, state.filters, state.conflicts]);

  const selectedSchedules = useMemo(() => {
    return state.schedules.filter(schedule => 
      state.selection.selectedScheduleIds.includes(schedule.scheduleId)
    );
  }, [state.schedules, state.selection.selectedScheduleIds]);

  const hasSelection = useMemo(() => {
    return state.selection.selectedScheduleIds.length > 0 || state.selection.selectedSlot !== null;
  }, [state.selection.selectedScheduleIds, state.selection.selectedSlot]);

  const hasConflicts = useMemo(() => {
    return state.conflicts.length > 0;
  }, [state.conflicts]);

  const canDrop = useMemo(() => {
    return state.selection.draggedSchedule !== null && state.selection.dropTarget !== null;
  }, [state.selection.draggedSchedule, state.selection.dropTarget]);

  const contextValue: CalendarContextType = {
    state,
    
    // View actions
    setView,
    setDate,
    navigateDate,
    
    // Data actions
    setSchedules,
    setTemplates,
    setConflicts,
    setEmployees,
    setJobSites,
    
    // UI actions
    setLoading,
    setError,
    
    // Filter actions
    updateFilters,
    clearFilters,
    
    // Selection actions
    selectSchedules,
    selectSchedule,
    clearSelection,
    selectSlot,
    
    // Drag and drop actions
    startDrag,
    setDropTarget,
    endDrag,
    
    // Template actions
    setActiveTemplate,
    toggleTemplateLibrary,
    toggleTemplateWizard,
    setTemplateCategories,
    
    // Bulk operations actions
    toggleBulkPanel,
    setBulkOperation,
    setBulkTargetDate,
    setBulkTargetEmployees,
    setBulkTargetJobSites,
    
    // Settings actions
    toggleWeekends,
    setTimeSlotDuration,
    setDayHours,
    toggleConflictDetection,
    toggleAutoSave,
    
    // Computed values
    filteredSchedules,
    selectedSchedules,
    hasSelection,
    hasConflicts,
    canDrop,
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
};

// Hook to use calendar context
export const useCalendar = (): CalendarContextType => {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}; 