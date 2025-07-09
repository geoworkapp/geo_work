import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fab,
  Zoom,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Save as SaveIcon,
  Preview as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  Repeat as RepeatIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ViewModule as GridIcon,
  Close as CloseIcon,
  FileCopy as CopyIcon,
  DragIndicator as DragIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';


import { useAuth } from '../../contexts/AuthContext';
import templateService from '../../services/templateService';
import type { ScheduleTemplate } from '@shared/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface TemplateEditorProps {
  open: boolean;
  onClose: () => void;
  template: ScheduleTemplate;
  onSave: (template: ScheduleTemplate) => void;
  readOnly?: boolean;
}

interface TemplateSection {
  id: string;
  type: 'basic' | 'schedule' | 'recurrence' | 'requirements' | 'advanced';
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  visible: boolean;
  editable: boolean;
  order: number;
}

interface HistoryEntry {
  id: string;
  timestamp: Date;
  changes: Partial<ScheduleTemplate>;
  description: string;
}

interface VisualProperty {
  id: string;
  label: string;
  type: 'text' | 'number' | 'time' | 'select' | 'boolean' | 'array' | 'color' | 'slider';
  value: any;
  options?: any[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  validation?: (value: any) => string | null;
}

// ============================================================================
// SORTABLE SECTION COMPONENT
// ============================================================================

const SortableSection: React.FC<{
  section: TemplateSection;
  properties: VisualProperty[];
  onPropertyChange: (propertyId: string, value: any) => void;
  onToggleExpanded: (sectionId: string) => void;
  onToggleVisible: (sectionId: string) => void;
}> = ({ section, properties, onPropertyChange, onToggleExpanded, onToggleVisible }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderPropertyInput = (property: VisualProperty) => {
    switch (property.type) {
      case 'text':
        return (
          <TextField
            label={property.label}
            value={property.value || ''}
            onChange={(e) => onPropertyChange(property.id, e.target.value)}
            fullWidth
            size="small"
            required={property.required}
          />
        );

      case 'number':
        return (
          <TextField
            label={property.label}
            type="number"
            value={property.value || 0}
            onChange={(e) => onPropertyChange(property.id, Number(e.target.value))}
            fullWidth
            size="small"
            inputProps={{ min: property.min, max: property.max, step: property.step }}
            required={property.required}
          />
        );

      case 'slider':
        return (
          <Box>
            <Typography variant="caption" gutterBottom>
              {property.label}: {property.value}
            </Typography>
            <Slider
              value={property.value || 0}
              onChange={(_, value) => onPropertyChange(property.id, value)}
              min={property.min || 0}
              max={property.max || 100}
              step={property.step || 1}
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>
        );

      case 'select':
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{property.label}</InputLabel>
            <Select
              value={property.value || ''}
              onChange={(e) => onPropertyChange(property.id, e.target.value)}
              label={property.label}
            >
              {property.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={property.value || false}
                onChange={(e) => onPropertyChange(property.id, e.target.checked)}
                size="small"
              />
            }
            label={property.label}
          />
        );

      case 'array':
        return (
          <Box>
            <Typography variant="caption" gutterBottom>
              {property.label}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(property.value || []).map((item: string, index: number) => (
                <Chip
                  key={index}
                  label={item}
                  size="small"
                  onDelete={() => {
                    const newArray = [...(property.value || [])];
                    newArray.splice(index, 1);
                    onPropertyChange(property.id, newArray);
                  }}
                />
              ))}
            </Box>
          </Box>
        );

      case 'color':
        return (
          <Box>
            <Typography variant="caption" gutterBottom>
              {property.label}
            </Typography>
            <Box
              sx={{
                width: 40,
                height: 30,
                backgroundColor: property.value || '#1976d2',
                border: '1px solid #ccc',
                borderRadius: 1,
                cursor: 'pointer',
              }}
              onClick={() => {
                // In a real implementation, this would open a color picker
                const colors = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#7b1fa2'];
                const currentIndex = colors.indexOf(property.value);
                const nextIndex = (currentIndex + 1) % colors.length;
                onPropertyChange(property.id, colors[nextIndex]);
              }}
            />
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        mb: 2,
        opacity: section.visible ? 1 : 0.5,
        border: isDragging ? '2px dashed #1976d2' : 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{ mr: 1, cursor: 'grab' }}
        >
          <DragIcon />
        </IconButton>
        
        <Box sx={{ mr: 1 }}>{section.icon}</Box>
        
        <Typography variant="h6" sx={{ flex: 1 }}>
          {section.title}
        </Typography>
        
        <IconButton
          size="small"
          onClick={() => onToggleVisible(section.id)}
        >
          {section.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
        </IconButton>
        
        <IconButton
          size="small"
          onClick={() => onToggleExpanded(section.id)}
        >
          {section.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={section.expanded && section.visible}>
        <Grid container spacing={2}>
          {properties.map((property) => (
            <Grid size={{ xs: 12, sm: 6 }} key={property.id}>
              {renderPropertyInput(property)}
            </Grid>
          ))}
        </Grid>
      </Collapse>
    </Paper>
  );
};

// ============================================================================
// TEMPLATE EDITOR COMPONENT
// ============================================================================

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  open,
  onClose,
  template,
  onSave,
  readOnly = false,
}) => {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Editor state
  const [editedTemplate, setEditedTemplate] = useState<ScheduleTemplate>(template);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (open) {
      initializeEditor();
    }
  }, [open, template]);

  const initializeEditor = () => {
    setEditedTemplate(template);
    setHasChanges(false);
    setHistory([]);
    setHistoryIndex(-1);
    
    setSections([
      {
        id: 'basic',
        type: 'basic',
        title: 'Basic Information',
        icon: <EditIcon />,
        expanded: true,
        visible: true,
        editable: true,
        order: 0,
      },
      {
        id: 'schedule',
        type: 'schedule',
        title: 'Schedule Details',
        icon: <ScheduleIcon />,
        expanded: true,
        visible: true,
        editable: true,
        order: 1,
      },
      {
        id: 'recurrence',
        type: 'recurrence',
        title: 'Recurrence Pattern',
        icon: <RepeatIcon />,
        expanded: false,
        visible: true,
        editable: true,
        order: 2,
      },
      {
        id: 'requirements',
        type: 'requirements',
        title: 'Requirements',
        icon: <PeopleIcon />,
        expanded: false,
        visible: true,
        editable: true,
        order: 3,
      },
      {
        id: 'advanced',
        type: 'advanced',
        title: 'Advanced Settings',
        icon: <SettingsIcon />,
        expanded: false,
        visible: false,
        editable: true,
        order: 4,
      },
    ]);
  };

  // ============================================================================
  // TEMPLATE PROPERTIES
  // ============================================================================

  const getPropertiesForSection = (sectionId: string): VisualProperty[] => {
    switch (sectionId) {
      case 'basic':
        return [
          {
            id: 'templateName',
            label: 'Template Name',
            type: 'text',
            value: editedTemplate.templateName,
            required: true,
            validation: (value) => value?.length < 3 ? 'Name must be at least 3 characters' : null,
          },
          {
            id: 'description',
            label: 'Description',
            type: 'text',
            value: editedTemplate.description,
          },
          {
            id: 'shiftType',
            label: 'Shift Type',
            type: 'select',
            value: editedTemplate.shiftType,
            options: [
              { value: 'regular', label: 'Regular Shift' },
              { value: 'overtime', label: 'Overtime' },
              { value: 'emergency', label: 'Emergency' },
              { value: 'training', label: 'Training' },
            ],
          },
        ];

      case 'schedule':
        return [
          {
            id: 'duration',
            label: 'Duration (hours)',
            type: 'slider',
            value: editedTemplate.duration,
            min: 1,
            max: 24,
            step: 0.5,
          },
          {
            id: 'breakDuration',
            label: 'Break Duration (minutes)',
            type: 'slider',
            value: editedTemplate.breakDuration,
            min: 0,
            max: 120,
            step: 15,
          },
          {
            id: 'defaultStartTime',
            label: 'Start Time',
            type: 'text',
            value: editedTemplate.defaultStartTime,
          },
          {
            id: 'defaultEndTime',
            label: 'End Time',
            type: 'text',
            value: editedTemplate.defaultEndTime,
          },
        ];

      case 'recurrence':
        return [
          {
            id: 'recurrenceType',
            label: 'Recurrence Type',
            type: 'select',
            value: editedTemplate.recurrence.type,
            options: [
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ],
          },
          {
            id: 'recurrenceInterval',
            label: 'Interval',
            type: 'number',
            value: editedTemplate.recurrence.interval,
            min: 1,
            max: 30,
          },
        ];

      case 'requirements':
        return [
          {
            id: 'skillsRequired',
            label: 'Skills Required',
            type: 'array',
            value: editedTemplate.skillsRequired,
          },
          {
            id: 'equipmentNeeded',
            label: 'Equipment Needed',
            type: 'array',
            value: editedTemplate.equipmentNeeded,
          },
          {
            id: 'specialInstructions',
            label: 'Special Instructions',
            type: 'text',
            value: editedTemplate.specialInstructions,
          },
        ];

      case 'advanced':
        return [
          {
            id: 'isActive',
            label: 'Active Template',
            type: 'boolean',
            value: editedTemplate.isActive,
          },
          {
            id: 'color',
            label: 'Template Color',
            type: 'color',
            value: '#1976d2',
          },
        ];

      default:
        return [];
    }
  };

  // ============================================================================
  // CHANGE TRACKING & HISTORY
  // ============================================================================

  const addToHistory = (changes: Partial<ScheduleTemplate>, description: string) => {
    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      changes,
      description,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newEntry);
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handlePropertyChange = (propertyId: string, value: any) => {
    const oldValue = getPropertyValue(propertyId);
    
    if (oldValue !== value) {
      setEditedTemplate(prev => {
        const updated = updateNestedProperty(prev, propertyId, value);
        return updated;
      });
      
      setHasChanges(true);
      addToHistory({ [propertyId]: value }, `Changed ${propertyId}`);
    }
  };

  const getPropertyValue = (propertyId: string): any => {
    switch (propertyId) {
      case 'recurrenceType':
        return editedTemplate.recurrence.type;
      case 'recurrenceInterval':
        return editedTemplate.recurrence.interval;
      default:
        return (editedTemplate as any)[propertyId];
    }
  };

  const updateNestedProperty = (template: ScheduleTemplate, propertyId: string, value: any): ScheduleTemplate => {
    switch (propertyId) {
      case 'recurrenceType':
        return {
          ...template,
          recurrence: {
            ...template.recurrence,
            type: value,
          },
        };
      case 'recurrenceInterval':
        return {
          ...template,
          recurrence: {
            ...template.recurrence,
            interval: value,
          },
        };
      default:
        return {
          ...template,
          [propertyId]: value,
        };
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      // Apply the previous state
      // In a real implementation, you'd restore the full state from history
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      // Apply the next state
      // In a real implementation, you'd restore the full state from history
    }
  };

  // ============================================================================
  // SECTION MANAGEMENT
  // ============================================================================

  const handleToggleExpanded = (sectionId: string) => {
    setSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, expanded: !section.expanded }
          : section
      )
    );
  };

  const handleToggleVisible = (sectionId: string) => {
    setSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, visible: !section.visible }
          : section
      )
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveSection(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSection(null);

    if (active.id !== over?.id) {
      setSections((sections) => {
        const oldIndex = sections.findIndex(section => section.id === active.id);
        const newIndex = sections.findIndex(section => section.id === over?.id);

        return arrayMove(sections, oldIndex, newIndex);
      });
    }
  };

  // ============================================================================
  // SAVE FUNCTIONALITY
  // ============================================================================

  const handleSave = async () => {
    if (!currentUser?.uid || readOnly) return;

    try {
      setSaving(true);
      
      const updatedTemplate = await templateService.updateTemplate(
        editedTemplate.templateId,
        editedTemplate,
        currentUser.uid
      );

      onSave(updatedTemplate);
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  const renderToolbar = () => (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1, 
      p: 2, 
      borderBottom: '1px solid',
      borderColor: 'divider' 
    }}>
      <Tooltip title="Undo">
        <span>
          <IconButton
            size="small"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
          >
            <UndoIcon />
          </IconButton>
        </span>
      </Tooltip>
      
      <Tooltip title="Redo">
        <span>
          <IconButton
            size="small"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
          >
            <RedoIcon />
          </IconButton>
        </span>
      </Tooltip>
      
      <Divider orientation="vertical" flexItem />
      
      <Tooltip title={previewMode ? 'Edit Mode' : 'Preview Mode'}>
        <IconButton
          size="small"
          onClick={() => setPreviewMode(!previewMode)}
          color={previewMode ? 'primary' : 'default'}
        >
          <PreviewIcon />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Grid View">
        <IconButton size="small">
          <GridIcon />
        </IconButton>
      </Tooltip>
      
      <Box sx={{ flex: 1 }} />
      
      {hasChanges && (
        <Chip
          label="Unsaved Changes"
          color="warning"
          size="small"
          variant="outlined"
        />
      )}
    </Box>
  );

  const renderPreview = () => (
    <Paper elevation={2} sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        {editedTemplate.templateName}
      </Typography>
      
      {editedTemplate.description && (
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {editedTemplate.description}
        </Typography>
      )}
      
      <Divider sx={{ my: 2 }} />
      
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Schedule Details</Typography>
            <Typography variant="body2">
              <strong>Type:</strong> {editedTemplate.shiftType}
            </Typography>
            <Typography variant="body2">
              <strong>Duration:</strong> {editedTemplate.duration} hours
            </Typography>
            <Typography variant="body2">
              <strong>Time:</strong> {editedTemplate.defaultStartTime} - {editedTemplate.defaultEndTime}
            </Typography>
          </Stack>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Requirements</Typography>
            {editedTemplate.skillsRequired && editedTemplate.skillsRequired.length > 0 && (
              <Box>
                <Typography variant="caption">Skills:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {editedTemplate.skillsRequired.map((skill) => (
                    <Chip key={skill} label={skill} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );

  const renderEditor = () => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map(s => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <Box sx={{ p: 2 }}>
          {sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              properties={getPropertiesForSection(section.id)}
              onPropertyChange={handlePropertyChange}
              onToggleExpanded={handleToggleExpanded}
              onToggleVisible={handleToggleVisible}
            />
          ))}
        </Box>
      </SortableContext>

      <DragOverlay>
        {activeSection ? (
          <Paper sx={{ opacity: 0.8, transform: 'rotate(5deg)' }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6">
                {sections.find(s => s.id === activeSection)?.title}
              </Typography>
            </Box>
          </Paper>
        ) : null}
      </DragOverlay>
    </DndContext>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          height: isMobile ? '100%' : '90vh',
          maxHeight: isMobile ? '100%' : '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">
              Template Editor
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {editedTemplate.templateName}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {renderToolbar()}

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', overflow: 'auto' }}>
          <AnimatePresence mode="wait">
            {previewMode ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {renderPreview()}
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {renderEditor()}
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          {hasChanges ? 'Cancel' : 'Close'}
        </Button>
        
        <Box sx={{ flex: 1 }} />
        
        {!readOnly && (
          <>
            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              disabled={saving}
            >
              Duplicate
            </Button>
            
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        )}
      </DialogActions>

      {/* Floating Action Button for mobile */}
      {isMobile && !readOnly && (
        <Zoom in={hasChanges}>
          <Fab
            color="primary"
            onClick={handleSave}
            disabled={saving}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: theme.zIndex.modal + 1,
            }}
          >
            <SaveIcon />
          </Fab>
        </Zoom>
      )}
    </Dialog>
  );
};

export default TemplateEditor; 