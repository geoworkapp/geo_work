import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  closestCenter,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DragCancelEvent,
  DropAnimation,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';
import {
  Box,
  Paper,
  Typography,
  Chip,
  alpha,
  Avatar,
  AvatarGroup,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Group as GroupIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { format, differenceInMinutes, addHours } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalendar } from '../../contexts/CalendarContext';
import { ConflictDetectionService } from '../../services/conflictDetectionService';
import type { Schedule, ScheduleConflict } from '@shared/types';

// Enhanced drag data interface
export interface EnhancedDragData {
  id: string;
  type: 'schedule' | 'template' | 'bulk';
  data: Schedule | Schedule[] | any;
  sourceIndex?: number;
  sourceContainer?: string;
  isDuplicate?: boolean;
  selectedCount?: number;
}

// Enhanced drop data interface
export interface EnhancedDropData {
  id: string;
  type: 'slot' | 'container' | 'schedule' | 'employee' | 'jobsite';
  targetDate?: Date;
  targetTime?: string;
  targetResource?: string;
  targetIndex?: number;
  targetEmployeeId?: string;
  targetJobSiteId?: string;
  allowedOperations?: ('move' | 'copy' | 'swap')[];
}

// Drop zone validation result
export interface DropZoneValidation {
  canDrop: boolean;
  operation: 'move' | 'copy' | 'swap' | 'invalid';
  conflicts: ScheduleConflict[];
  warnings: ScheduleConflict[];
  suggestions: string[];
  estimatedDuration?: number;
}

// Enhanced drag overlay with conflict detection
const EnhancedDragOverlay: React.FC<{ 
  draggedItem: EnhancedDragData | null;
  validationResult: DropZoneValidation | null;
}> = ({ draggedItem, validationResult }) => {
  if (!draggedItem) return null;

  const isBulkDrag = draggedItem.type === 'bulk' || (draggedItem.selectedCount && draggedItem.selectedCount > 1);
  const schedules = isBulkDrag 
    ? (Array.isArray(draggedItem.data) ? draggedItem.data : [draggedItem.data]) as Schedule[]
    : [draggedItem.data as Schedule];

  const hasConflicts = validationResult?.conflicts && validationResult.conflicts.length > 0;
  const hasWarnings = validationResult?.warnings && validationResult.warnings.length > 0;

  return (
    <motion.div
      initial={{ scale: 1, rotate: 0 }}
      animate={{ 
        scale: isBulkDrag ? 1.05 : 1.02, 
        rotate: hasConflicts ? -2 : 3,
        y: [0, -5, 0]
      }}
      transition={{ 
        y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
        scale: { duration: 0.2 },
        rotate: { duration: 0.3 }
      }}
    >
      <Paper
        elevation={12}
        sx={{
          p: 2,
          minWidth: isBulkDrag ? 280 : 240,
          maxWidth: 320,
          opacity: 0.95,
          background: hasConflicts 
            ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
            : hasWarnings
            ? 'linear-gradient(135deg, #ed6c02 0%, #e65100 100%)'
            : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: hasConflicts ? '#f44336' : hasWarnings ? '#ff9800' : '#4caf50',
            opacity: 0.8,
          }
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isBulkDrag ? (
              <Badge badgeContent={schedules.length} color="secondary">
                <GroupIcon fontSize="small" />
              </Badge>
            ) : (
              <ScheduleIcon fontSize="small" />
            )}
            
            {draggedItem.isDuplicate && (
              <Tooltip title="Duplicating">
                <CopyIcon fontSize="small" sx={{ opacity: 0.7 }} />
              </Tooltip>
            )}
          </Box>

          {/* Status indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {hasConflicts && <ErrorIcon fontSize="small" />}
            {hasWarnings && !hasConflicts && <WarningIcon fontSize="small" />}
            {!hasConflicts && !hasWarnings && <CheckIcon fontSize="small" />}
          </Box>
        </Box>

        {/* Content */}
        {isBulkDrag ? (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {schedules.length} Schedules Selected
            </Typography>
            
            {/* Employee avatars */}
            <AvatarGroup max={4} sx={{ mb: 1.5, justifyContent: 'flex-start' }}>
              {[...new Set(schedules.map(s => s.employeeId))].map((employeeId) => {
                const employee = schedules.find(s => s.employeeId === employeeId);
                return (
                  <Avatar
                    key={employeeId}
                    sx={{ width: 24, height: 24, fontSize: '0.7rem' }}
                  >
                    {employee?.employeeName?.charAt(0) || 'E'}
                  </Avatar>
                );
              })}
            </AvatarGroup>

            {/* Summary info */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={`${Math.round(schedules.reduce((acc, s) => acc + differenceInMinutes(s.endDateTime || s.endTime?.toDate() || new Date(), s.startDateTime || s.startTime?.toDate() || new Date()), 0) / 60)}h total`}
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                label={`${[...new Set(schedules.map(s => s.jobSiteId))].length} sites`}
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '0.7rem' }}
              />
            </Box>
          </>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {schedules[0].employeeName}
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.9 }}>
              {schedules[0].jobSiteName}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={format(schedules[0].startDateTime || schedules[0].startTime?.toDate() || new Date(), 'MMM dd')}
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                label={`${format(schedules[0].startDateTime || schedules[0].startTime?.toDate() || new Date(), 'HH:mm')} - ${format(schedules[0].endDateTime || schedules[0].endTime?.toDate() || new Date(), 'HH:mm')}`}
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '0.7rem' }}
              />
              <Chip
                size="small"
                label={schedules[0].shiftType}
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '0.7rem' }}
              />
            </Box>
          </>
        )}

        {/* Validation feedback */}
        {validationResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                {validationResult.canDrop ? 'Can Drop' : 'Cannot Drop'}
              </Typography>
              
              {validationResult.suggestions.length > 0 && (
                <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}>
                  {validationResult.suggestions[0]}
                </Typography>
              )}
            </Box>
          </motion.div>
        )}
      </Paper>
    </motion.div>
  );
};

// Enhanced drop zone indicator
const EnhancedDropZoneIndicator: React.FC<{ 
  isActive: boolean; 
  validation: DropZoneValidation | null;
  targetResource?: string;
}> = ({ isActive, validation, targetResource }) => {
  if (!isActive || !validation) return null;

  const { canDrop, operation, conflicts, warnings } = validation;
  const hasConflicts = conflicts.length > 0;
  const hasWarnings = warnings.length > 0;

  const color = hasConflicts ? '#f44336' : hasWarnings ? '#ff9800' : '#4caf50';
  const bgColor = hasConflicts ? 'rgba(244, 67, 54, 0.1)' : hasWarnings ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bgColor,
        border: `3px dashed ${color}`,
        borderRadius: 8,
        backdropFilter: 'blur(2px)',
      }}
    >
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: hasConflicts ? [0, -5, 5, 0] : 0
        }}
        transition={{ 
          scale: { repeat: Infinity, duration: 1.5 },
          rotate: { repeat: Infinity, duration: 0.5 }
        }}
      >
        {hasConflicts ? (
          <ErrorIcon sx={{ fontSize: 32, color, mb: 1 }} />
        ) : hasWarnings ? (
          <WarningIcon sx={{ fontSize: 32, color, mb: 1 }} />
        ) : (
          <CheckIcon sx={{ fontSize: 32, color, mb: 1 }} />
        )}
      </motion.div>

      <Typography
        variant="body2"
        sx={{
          color,
          fontWeight: 600,
          textAlign: 'center',
          px: 2,
          py: 1,
          bgcolor: 'white',
          borderRadius: 1,
          boxShadow: 2,
          maxWidth: '80%',
        }}
      >
        {canDrop ? (
          <>
            {operation === 'move' && 'Move here'}
            {operation === 'copy' && 'Copy here'}
            {operation === 'swap' && 'Swap schedules'}
          </>
        ) : (
          'Cannot drop here'
        )}
        
        {targetResource && (
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
            {targetResource}
          </Typography>
        )}
      </Typography>

      {validation.suggestions.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            mt: 1,
            px: 2,
            py: 0.5,
            bgcolor: alpha('#fff', 0.9),
            borderRadius: 0.5,
            maxWidth: '90%',
          }}
        >
          {validation.suggestions[0]}
        </Typography>
      )}
    </motion.div>
  );
};

// Smart conflict detector during drag
const useConflictDetector = () => {
  const [validationCache, setValidationCache] = useState<Map<string, DropZoneValidation>>(new Map());
  const { state } = useCalendar();

  const validateDrop = useCallback(async (
    dragData: EnhancedDragData,
    dropData: EnhancedDropData
  ): Promise<DropZoneValidation> => {
    const cacheKey = `${dragData.id}_${dropData.id}_${dropData.targetDate?.getTime()}`;
    
    // Check cache first
    if (validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!;
    }

    // Basic validation
    if (!dropData.targetDate || !dragData.data) {
      return {
        canDrop: false,
        operation: 'invalid',
        conflicts: [],
        warnings: [],
        suggestions: ['Invalid drop target']
      };
    }

    const schedules = Array.isArray(dragData.data) ? dragData.data : [dragData.data as Schedule];
    const allConflicts: ScheduleConflict[] = [];
    const allWarnings: ScheduleConflict[] = [];
    const allSuggestions: string[] = [];

    // Validate each schedule
    for (const schedule of schedules) {
      const modifiedSchedule = {
        ...schedule,
        startDateTime: dropData.targetDate,
        endDateTime: addHours(dropData.targetDate, differenceInMinutes(
          schedule.endDateTime || schedule.endTime?.toDate() || new Date(), 
          schedule.startDateTime || schedule.startTime?.toDate() || new Date()
        ) / 60),
        ...(dropData.targetEmployeeId && { employeeId: dropData.targetEmployeeId }),
        ...(dropData.targetJobSiteId && { jobSiteId: dropData.targetJobSiteId })
      };

      try {
        const conflictService = ConflictDetectionService.getInstance();
        const conflicts = await conflictService.detectConflicts(
          modifiedSchedule,
          state.schedules
        );

        allConflicts.push(...conflicts);
        // Note: detectConflicts doesn't return warnings/suggestions separately
        // allWarnings.push(...result.warnings);
        // allSuggestions.push(...result.suggestions);
      } catch (error) {
        console.error('Error validating schedule:', error);
        allConflicts.push({
          conflictId: `validation_error_${Date.now()}`,
          type: 'overlap', // Changed from 'validation_error' to valid type
          severity: 'error',
          message: 'Error validating schedule',
          conflictingSchedules: [schedule.scheduleId],
          employeeId: schedule.employeeId,
          employeeName: schedule.employeeName
        });
      }
    }

    const validation: DropZoneValidation = {
      canDrop: allConflicts.length === 0,
      operation: dragData.isDuplicate ? 'copy' : 'move',
      conflicts: allConflicts,
      warnings: allWarnings,
      suggestions: [...new Set(allSuggestions)],
              estimatedDuration: schedules.reduce((acc, s) => acc + differenceInMinutes(
          s.endDateTime || s.endTime?.toDate() || new Date(), 
          s.startDateTime || s.startTime?.toDate() || new Date()
        ), 0)
    };

    // Cache the result
    setValidationCache(prev => new Map(prev.set(cacheKey, validation)));

    return validation;
  }, [validationCache, state.schedules, state.employees, state.jobSites]);

  const clearCache = useCallback(() => {
    setValidationCache(new Map());
  }, []);

  return { validateDrop, clearCache };
};

// Props interface
interface EnhancedDragDropProviderProps {
  children: React.ReactNode;
  onScheduleMove?: (scheduleIds: string[], targetDate: Date, targetEmployee?: string, targetJobSite?: string) => Promise<void>;
  onScheduleCopy?: (scheduleIds: string[], targetDate: Date, targetEmployee?: string, targetJobSite?: string) => Promise<void>;
  onScheduleSwap?: (scheduleId1: string, scheduleId2: string) => Promise<void>;
  enableMultiSelect?: boolean;
  enableConflictDetection?: boolean;
  enableSmartSuggestions?: boolean;
  restrictionPolicy?: 'strict' | 'warning' | 'none';
}

// Main Enhanced DragDrop Provider
export const EnhancedDragDropProvider: React.FC<EnhancedDragDropProviderProps> = ({
  children,
  onScheduleMove,
  onScheduleCopy,
  onScheduleSwap,
  enableMultiSelect = true,
  enableConflictDetection = true,

  restrictionPolicy = 'warning',
}) => {
  const { state, setError, startDrag, endDrag } = useCalendar();
  const { validateDrop, clearCache } = useConflictDetector();
  
  const [draggedItem, setDraggedItem] = useState<EnhancedDragData | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<EnhancedDropData | null>(null);
  const [currentValidation, setCurrentValidation] = useState<DropZoneValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Sensors for touch, mouse, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const dragData = active.data.current as EnhancedDragData;
    
    if (!dragData) return;

    setDraggedItem(dragData);
    clearCache();

    // Handle multi-select drag
    if (enableMultiSelect && state.selection.selectedScheduleIds.length > 1) {
      const selectedSchedules = state.schedules.filter(s => 
        state.selection.selectedScheduleIds.includes(s.scheduleId)
      );
      
      setDraggedItem({
        ...dragData,
        type: 'bulk',
        data: selectedSchedules,
        selectedCount: selectedSchedules.length
      });
    }

    startDrag(dragData.data as Schedule);
  }, [enableMultiSelect, state.selection.selectedScheduleIds, state.schedules, startDrag, clearCache]);

  // Handle drag over with real-time validation
  const handleDragOver = useCallback(async (event: DragOverEvent) => {
    const { over } = event;
    
    if (!over || !draggedItem) {
      setActiveDropZone(null);
      setCurrentValidation(null);
      return;
    }

    const dropData = over.data.current as EnhancedDropData;
    if (!dropData) return;

    setActiveDropZone(dropData);

    // Perform real-time validation if enabled
    if (enableConflictDetection && !isValidating) {
      setIsValidating(true);
      try {
        const validation = await validateDrop(draggedItem, dropData);
        setCurrentValidation(validation);
      } catch (error) {
        console.error('Error validating drop:', error);
        setCurrentValidation({
          canDrop: false,
          operation: 'invalid',
          conflicts: [],
          warnings: [],
          suggestions: ['Validation error occurred']
        });
      } finally {
        setIsValidating(false);
      }
    }
  }, [draggedItem, enableConflictDetection, isValidating, validateDrop]);

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { over } = event;
    
    if (!over || !draggedItem) {
      setDraggedItem(null);
      setActiveDropZone(null);
      setCurrentValidation(null);
      endDrag();
      return;
    }

    const dropData = over.data.current as EnhancedDropData;
    
    // Validate final drop
    let finalValidation = currentValidation;
    if (enableConflictDetection && (!finalValidation || !finalValidation.canDrop)) {
      finalValidation = await validateDrop(draggedItem, dropData);
    }

    // Check restriction policy
    const hasBlockingConflicts = finalValidation?.conflicts && finalValidation.conflicts.length > 0;
    const hasWarnings = finalValidation?.warnings && finalValidation.warnings.length > 0;

    if (restrictionPolicy === 'strict' && (hasBlockingConflicts || hasWarnings)) {
      setError(`Cannot complete operation: ${finalValidation?.conflicts[0]?.message || finalValidation?.warnings[0]?.message}`);
      setDraggedItem(null);
      setActiveDropZone(null);
      setCurrentValidation(null);
      endDrag();
      return;
    }

    // Execute the drop operation
    try {
      const schedules = Array.isArray(draggedItem.data) ? draggedItem.data : [draggedItem.data as Schedule];
      const scheduleIds = schedules.map(s => s.scheduleId);

      if (draggedItem.isDuplicate && onScheduleCopy) {
        await onScheduleCopy(
          scheduleIds,
          dropData.targetDate!,
          dropData.targetEmployeeId,
          dropData.targetJobSiteId
        );
      } else if (finalValidation?.operation === 'swap' && onScheduleSwap) {
        await onScheduleSwap(scheduleIds[0], dropData.id);
      } else if (onScheduleMove) {
        await onScheduleMove(
          scheduleIds,
          dropData.targetDate!,
          dropData.targetEmployeeId,
          dropData.targetJobSiteId
        );
      }

      // Show success message
      const operationText = draggedItem.isDuplicate ? 'copied' : 'moved';
      const scheduleText = scheduleIds.length > 1 ? `${scheduleIds.length} schedules` : 'schedule';
      setError(`Successfully ${operationText} ${scheduleText}`);

      // Show warnings if any
      if (hasWarnings && restrictionPolicy === 'warning') {
        setTimeout(() => {
          setError(`Warning: ${finalValidation?.warnings[0]?.message}`);
        }, 2000);
      }

    } catch (error) {
      console.error('Error executing drop operation:', error);
      setError('Failed to complete the operation');
    }

    // Cleanup
    setDraggedItem(null);
    setActiveDropZone(null);
    setCurrentValidation(null);
    endDrag();
  }, [
    draggedItem, 
    currentValidation, 
    enableConflictDetection, 
    restrictionPolicy,
    validateDrop,
    onScheduleMove,
    onScheduleCopy,
    onScheduleSwap,
    setError,
    endDrag
  ]);

  // Handle drag cancel
  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setDraggedItem(null);
    setActiveDropZone(null);
    setCurrentValidation(null);
    endDrag();
  }, [endDrag]);

  // Drop animation
  const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToWindowEdges]}
    >
      {children}
      
      <DragOverlay dropAnimation={dropAnimationConfig}>
        <EnhancedDragOverlay 
          draggedItem={draggedItem} 
          validationResult={currentValidation}
        />
      </DragOverlay>

      {/* Enhanced drop zone indicator */}
      <AnimatePresence>
        {activeDropZone && (
          <EnhancedDropZoneIndicator
            isActive={true}
            validation={currentValidation}
            targetResource={activeDropZone.targetResource}
          />
        )}
      </AnimatePresence>
    </DndContext>
  );
};

// Custom hooks for drag and drop
export const useEnhancedDraggable = (id: string, data: EnhancedDragData) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data,
  });

  return {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
    style: {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      opacity: isDragging ? 0.5 : 1,
      cursor: isDragging ? 'grabbing' : 'grab',
    }
  };
};

export const useEnhancedDroppable = (id: string, data: EnhancedDropData) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data,
  });

  return {
    setNodeRef,
    isOver,
    style: {
      backgroundColor: isOver ? alpha('#2196f3', 0.1) : undefined,
      transition: 'background-color 0.2s ease',
    }
  };
};

// Utility functions
export const createEnhancedDragData = (
  id: string,
  type: EnhancedDragData['type'],
  data: any,
  options?: {
    sourceContainer?: string;
    sourceIndex?: number;
    isDuplicate?: boolean;
    selectedCount?: number;
  }
): EnhancedDragData => ({
  id,
  type,
  data,
  sourceContainer: options?.sourceContainer,
  sourceIndex: options?.sourceIndex,
  isDuplicate: options?.isDuplicate,
  selectedCount: options?.selectedCount,
});

export const createEnhancedDropData = (
  id: string,
  type: EnhancedDropData['type'],
  options?: {
    targetDate?: Date;
    targetTime?: string;
    targetResource?: string;
    targetIndex?: number;
    targetEmployeeId?: string;
    targetJobSiteId?: string;
    allowedOperations?: ('move' | 'copy' | 'swap')[];
  }
): EnhancedDropData => ({
  id,
  type,
  targetDate: options?.targetDate,
  targetTime: options?.targetTime,
  targetResource: options?.targetResource,
  targetIndex: options?.targetIndex,
  targetEmployeeId: options?.targetEmployeeId,
  targetJobSiteId: options?.targetJobSiteId,
  allowedOperations: options?.allowedOperations || ['move', 'copy'],
}); 