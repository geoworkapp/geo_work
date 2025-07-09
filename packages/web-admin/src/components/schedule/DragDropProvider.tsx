import React from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  type DragOverEvent,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  useDroppable as useDroppableCore,
  useDraggable as useDraggableCore,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToHorizontalAxis,
  restrictToWindowEdges,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import { Box, Paper, Typography, Chip, alpha } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { useCalendar } from '../../contexts/CalendarContext';
import type { Schedule } from '@shared/types';

// Types for drag and drop
export interface DragData {
  id: string;
  type: 'schedule' | 'template' | 'slot';
  data: Schedule | any;
  sourceIndex?: number;
  sourceContainer?: string;
}

export interface DropData {
  id: string;
  type: 'slot' | 'container' | 'schedule';
  targetDate?: Date;
  targetTime?: string;
  targetResource?: string;
  targetIndex?: number;
}

// Drag overlay component for visual feedback
const DragOverlayContent: React.FC<{ draggedItem: DragData | null }> = ({ draggedItem }) => {
  if (!draggedItem || draggedItem.type !== 'schedule') {
    return null;
  }

  const schedule = draggedItem.data as Schedule;

  return (
    <Paper
      elevation={8}
      sx={{
        p: 2,
        minWidth: 200,
        maxWidth: 300,
        opacity: 0.95,
        transform: 'rotate(5deg)',
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
        color: 'white',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <ScheduleIcon fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {schedule.employeeName}
        </Typography>
      </Box>
      
      <Typography variant="body2" sx={{ mb: 1, opacity: 0.9 }}>
        {schedule.jobSiteName}
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          size="small"
                          label={format(schedule.startDateTime || schedule.startTime?.toDate() || new Date(), 'MMM dd')}
          sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '0.7rem'
          }}
        />
        <Chip
          size="small"
                          label={`${format(schedule.startDateTime || schedule.startTime?.toDate() || new Date(), 'HH:mm')} - ${format(schedule.endDateTime || schedule.endTime?.toDate() || new Date(), 'HH:mm')}`}
          sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '0.7rem'
          }}
        />
        <Chip
          size="small"
          label={schedule.shiftType}
          sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '0.7rem'
          }}
        />
      </Box>
    </Paper>
  );
};

// Drop zone indicator component
const DropZoneIndicator: React.FC<{ 
  isActive: boolean; 
  canDrop: boolean;
  message?: string;
}> = ({ isActive, canDrop, message = 'Drop here' }) => {
  if (!isActive) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: canDrop 
          ? alpha('#4caf50', 0.1)
          : alpha('#f44336', 0.1),
        border: `2px dashed ${canDrop ? '#4caf50' : '#f44336'}`,
        borderRadius: 1,
        animation: 'pulse 1.5s ease-in-out infinite',
        '@keyframes pulse': {
          '0%': { opacity: 0.6 },
          '50%': { opacity: 1 },
          '100%': { opacity: 0.6 },
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: canDrop ? '#4caf50' : '#f44336',
          fontWeight: 600,
          textAlign: 'center',
          px: 2,
          py: 1,
          bgcolor: 'white',
          borderRadius: 1,
          boxShadow: 1,
        }}
      >
        {canDrop ? message : 'Cannot drop here'}
      </Typography>
    </Box>
  );
};

// Props interface
interface DragDropProviderProps {
  children: React.ReactNode;
  onScheduleMove?: (scheduleId: string, newDate: Date, newTime?: string) => void;
  onScheduleReorder?: (scheduleIds: string[], newOrder: string[]) => void;
  onBulkMove?: (scheduleIds: string[], targetDate: Date) => void;
  strategy?: 'vertical' | 'horizontal' | 'grid';
  restrictions?: 'vertical' | 'horizontal' | 'window' | 'parent' | 'none';
}

// Main DragDropProvider component
export const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  onScheduleMove,
  onScheduleReorder,
  onBulkMove,
  strategy = 'vertical',
  restrictions = 'window',
}) => {
  const {
    state,
    startDrag,
    setDropTarget,
    endDrag,
    selectSchedule,
    setError,
  } = useCalendar();

  // Sensors for different input methods
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum distance before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Current dragged item state
  const [draggedItem, setDraggedItem] = React.useState<DragData | null>(null);
  const [activeDropZone, setActiveDropZone] = React.useState<string | null>(null);

  // Determine sorting strategy
  const sortingStrategy = React.useMemo(() => {
    switch (strategy) {
      case 'horizontal':
        return horizontalListSortingStrategy;
      case 'vertical':
      default:
        return verticalListSortingStrategy;
    }
  }, [strategy]);

  // Determine movement restrictions
  const modifiers = React.useMemo(() => {
    const mods = [];
    
    switch (restrictions) {
      case 'vertical':
        mods.push(restrictToVerticalAxis);
        break;
      case 'horizontal':
        mods.push(restrictToHorizontalAxis);
        break;
      case 'parent':
        mods.push(restrictToParentElement);
        break;
      case 'window':
        mods.push(restrictToWindowEdges);
        break;
      case 'none':
      default:
        break;
    }
    
    return mods;
  }, [restrictions]);

  // Custom drop animation
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  // Drag start handler
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const scheduleId = active.id as string;
    
    // Find the schedule being dragged
    const schedule = state.schedules.find(s => s.scheduleId === scheduleId);
    if (!schedule) return;

    const dragData: DragData = {
      id: scheduleId,
      type: 'schedule',
      data: schedule,
      sourceContainer: active.data.current?.container,
      sourceIndex: active.data.current?.index,
    };

    setDraggedItem(dragData);
    startDrag(schedule);

    // Auto-select if not already selected
    if (!state.selection.selectedScheduleIds.includes(scheduleId)) {
      selectSchedule(scheduleId);
    }
  };

  // Drag move handler
  const handleDragMove = (event: DragMoveEvent) => {
    const { over } = event;
    
    if (over) {
      setActiveDropZone(over.id as string);
      
      // Set drop target in calendar state
      const dropData = over.data.current as DropData;
      if (dropData?.targetDate) {
        setDropTarget({
          start: dropData.targetDate,
          end: dropData.targetDate,
          resourceId: dropData.targetResource,
        });
      }
    } else {
      setActiveDropZone(null);
      setDropTarget(null);
    }
  };

  // Drag over handler
  const handleDragOver = (event: DragOverEvent) => {
    // Handle complex drop zone logic here if needed
    const { over } = event;
    
    if (over) {
      const dropData = over.data.current as DropData;
      
      // Validate drop zone
      const canDrop = validateDrop(draggedItem, dropData);
      
      if (!canDrop) {
        setDropTarget(null);
      }
    }
  };

  // Drag end handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    
    if (over && draggedItem) {
      const dropData = over.data.current as DropData;
      
      if (validateDrop(draggedItem, dropData)) {
        executeDrop(draggedItem, dropData);
      } else {
        setError('Cannot drop schedule in this location');
      }
    }

    // Cleanup
    setDraggedItem(null);
    setActiveDropZone(null);
    endDrag();
  };

  // Validate if drop is allowed
  const validateDrop = (dragData: DragData | null, dropData: DropData): boolean => {
    if (!dragData || !dropData) return false;

    // Basic validation rules
    switch (dragData.type) {
      case 'schedule':
        return dropData.type === 'slot' || dropData.type === 'container';
      default:
        return false;
    }
  };

  // Execute the drop operation
  const executeDrop = (dragData: DragData, dropData: DropData) => {
    switch (dragData.type) {
      case 'schedule':
        handleScheduleDrop(dragData, dropData);
        break;
      default:
        break;
    }
  };

  // Handle schedule drop
  const handleScheduleDrop = (dragData: DragData, dropData: DropData) => {
    const schedule = dragData.data as Schedule;
    
    if (dropData.targetDate) {
      // Single schedule move
      if (state.selection.selectedScheduleIds.length <= 1) {
        onScheduleMove?.(schedule.scheduleId, dropData.targetDate, dropData.targetTime);
      } else {
        // Bulk move selected schedules
        onBulkMove?.(state.selection.selectedScheduleIds, dropData.targetDate);
      }
    } else if (dropData.targetIndex !== undefined) {
      // Reorder schedules
      const scheduleIds = state.schedules.map(s => s.scheduleId);
      const oldIndex = scheduleIds.indexOf(schedule.scheduleId);
      const newIndex = dropData.targetIndex;
      
      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(scheduleIds, oldIndex, newIndex);
        onScheduleReorder?.(scheduleIds, newOrder);
      }
    }
  };

  // Create sortable items array for context
  const sortableItems = React.useMemo(() => {
    return state.schedules.map(schedule => schedule.scheduleId);
  }, [state.schedules]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={modifiers}
    >
      <SortableContext
        items={sortableItems}
        strategy={sortingStrategy}
      >
        <Box sx={{ position: 'relative' }}>
          {children}
          
          {/* Drop zone indicators */}
          <DropZoneIndicator
            isActive={!!activeDropZone}
            canDrop={!!state.selection.dropTarget}
            message={
              state.selection.selectedScheduleIds.length > 1
                ? `Move ${state.selection.selectedScheduleIds.length} schedules`
                : 'Move schedule'
            }
          />
        </Box>
      </SortableContext>

      {/* Drag overlay for visual feedback */}
      <DragOverlay dropAnimation={dropAnimation}>
        <DragOverlayContent draggedItem={draggedItem} />
      </DragOverlay>
    </DndContext>
  );
};

// Hook for droppable components
export const useDroppable = (id: string, data?: DropData) => {
  const { setNodeRef, isOver } = useDroppableCore({
    id,
    data,
  });

  return {
    setNodeRef,
    isOver,
  };
};

// Hook for draggable components  
export const useDraggableSchedule = (id: string, data?: DragData) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggableCore({
    id,
    data,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return {
    attributes,
    listeners,
    setNodeRef,
    style,
    isDragging,
  };
};

// Utility function to create drop zone data
export const createDropZoneData = (
  type: DropData['type'],
  targetDate?: Date,
  targetTime?: string,
  targetResource?: string,
  targetIndex?: number
): DropData => {
  return {
    id: `${type}-${Date.now()}-${Math.random()}`,
    type,
    targetDate,
    targetTime,
    targetResource,
    targetIndex,
  };
};

// Utility function to create drag data
export const createDragData = (
  type: DragData['type'],
  data: any,
  sourceContainer?: string,
  sourceIndex?: number
): DragData => {
  return {
    id: `${type}-${data.id || Date.now()}`,
    type,
    data,
    sourceContainer,
    sourceIndex,
  };
};

export default DragDropProvider; 