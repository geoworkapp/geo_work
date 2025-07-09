import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme, useMediaQuery, Alert, Badge, Fab, Pagination, Skeleton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Stack,
  Card,
  CardContent,
  CardActions,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,

  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  AccessTime as TimeIcon,
    Clear as ClearIcon,
  PlayArrow as ApplyIcon,
  TrendingUp as TrendingIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Close as CloseIcon,
  ViewModule as GridIcon,
  ViewList as ListIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

import { useAuth } from '../../contexts/AuthContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { templateService } from '../../services/templateService';
import type { ScheduleTemplate } from '@shared/types';

// Define missing types locally for now
interface TemplateFilters {
  searchQuery?: string;
  isActive?: boolean;
  shiftType?: string[];
}

interface TemplateSortOptions {
  field: 'templateName' | 'updatedAt' | 'usage_count' | 'rating';
  direction: 'asc' | 'desc';
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface TemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: ScheduleTemplate) => void;
  onCreateTemplate?: () => void;
  selectionMode?: boolean;
}

interface TemplateCategory {
  id: string;
  name: string;
  count: number;
  color: string;
}

type ViewMode = 'grid' | 'list';

// ============================================================================
// TEMPLATE LIBRARY COMPONENT
// ============================================================================

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  open,
  onClose,
  onSelectTemplate,
  onCreateTemplate,
  selectionMode = false,
}) => {
  const { currentUser } = useAuth();
  const { toggleTemplateWizard } = useCalendar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<TemplateSortOptions>({ 
    field: 'updatedAt', 
    direction: 'desc' 
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

  // Mock categories - in production, these would come from the service
  const categories: TemplateCategory[] = [
    { id: 'all', name: 'All Templates', count: templates.length, color: '#1976d2' },
    { id: 'regular', name: 'Regular Shifts', count: 0, color: '#2e7d32' },
    { id: 'overtime', name: 'Overtime', count: 0, color: '#ed6c02' },
    { id: 'emergency', name: 'Emergency', count: 0, color: '#d32f2f' },
    { id: 'training', name: 'Training', count: 0, color: '#7b1fa2' },
  ];

  const pageSize = 12;

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadTemplates = useCallback(async () => {
    if (!currentUser?.companyId) return;

    try {
      setLoading(true);
      setError(null);

      const filters: TemplateFilters = {
        searchQuery: searchQuery || undefined,
        isActive: true,
      };

      if (selectedCategory !== 'all') {
        filters.shiftType = [selectedCategory];
      }

      if (showFavoritesOnly) {
        // Would filter by favorites in production
      }

      const result = await templateService.getTemplates(
        currentUser.companyId,
        filters,
        sortBy,
        pageSize,
        page > 1 ? undefined : undefined // In production, implement pagination
      );

      setTemplates(result.templates);
      setTotalPages(Math.ceil(result.templates.length / pageSize) || 1);

    } catch (error) {
      console.error('Error loading templates:', error);
      setError('Failed to load templates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.companyId, searchQuery, selectedCategory, sortBy, page, pageSize, showFavoritesOnly]);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, loadTemplates]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(1); // Reset to first page
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };

  const handleSortChange = (field: TemplateSortOptions['field']) => {
    setSortBy(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
    setPage(1);
  };

  const handleToggleFavorite = (templateId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(templateId)) {
        newFavorites.delete(templateId);
      } else {
        newFavorites.add(templateId);
      }
      return newFavorites;
    });
  };

  const handleApplyTemplate = (template: ScheduleTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
    onClose();
  };

  const handleEditTemplate = (template: ScheduleTemplate) => {
    setSelectedTemplate(template);
    toggleTemplateWizard(true);
    setTemplateMenuAnchor(null);
  };

  const handleDeleteTemplate = async (template: ScheduleTemplate) => {
    if (!currentUser?.uid) return;

    if (window.confirm(`Are you sure you want to delete "${template.templateName}"?`)) {
      try {
        await templateService.deleteTemplate(template.templateId, currentUser.uid);
        await loadTemplates(); // Refresh the list
      } catch (error) {
        setError('Failed to delete template');
      }
    }
    setTemplateMenuAnchor(null);
  };

  const handleCreateTemplate = () => {
    if (onCreateTemplate) {
      onCreateTemplate();
    } else {
      toggleTemplateWizard(true);
    }
    onClose();
  };

  // ============================================================================
  // FILTERED AND SORTED TEMPLATES
  // ============================================================================

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (showFavoritesOnly) {
      filtered = filtered.filter(template => favorites.has(template.templateId));
    }

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filtered.slice(startIndex, endIndex);
  }, [templates, favorites, showFavoritesOnly, page, pageSize]);

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  const renderTemplateCard = (template: ScheduleTemplate) => {
    const isFavorite = favorites.has(template.templateId);
    
    return (
      <motion.div
        key={template.templateId}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        layout
      >
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            cursor: selectionMode ? 'pointer' : 'default',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: theme.shadows[8],
            },
          }}
          onClick={selectionMode ? () => handleApplyTemplate(template) : undefined}
        >
          <CardContent sx={{ flex: 1 }}>
            {/* Header with title and favorite */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="h6" component="h3" sx={{ flex: 1, mr: 1 }}>
                {template.templateName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(template.templateId);
                  }}
                  color={isFavorite ? 'warning' : 'default'}
                >
                  {isFavorite ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>
                {!selectionMode && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTemplate(template);
                      setTemplateMenuAnchor(e.currentTarget);
                    }}
                  >
                    <MoreIcon />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Description */}
            {template.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {template.description}
              </Typography>
            )}

            {/* Template details */}
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={template.shiftType}
                  size="small"
                  color={getShiftTypeColor(template.shiftType)}
                  variant="outlined"
                />
                <Chip
                  label={`${template.duration}h`}
                  size="small"
                  icon={<TimeIcon />}
                  variant="outlined"
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {template.defaultStartTime} - {template.defaultEndTime}
                  </Typography>
                </Box>
                {template.breakDuration > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {template.breakDuration}min break
                  </Typography>
                )}
              </Box>

              {/* Skills and equipment */}
              {(template.skillsRequired && template.skillsRequired.length > 0) && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {template.skillsRequired.slice(0, 3).map((skill) => (
                    <Chip
                      key={skill}
                      label={skill}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  ))}
                  {template.skillsRequired.length > 3 && (
                    <Chip
                      label={`+${template.skillsRequired.length - 3} more`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  )}
                </Box>
              )}
            </Stack>
          </CardContent>

          <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Updated {format(template.updatedAt, 'MMM d, yyyy')}
              </Typography>
            </Box>
            {selectionMode && (
              <Button
                size="small"
                variant="contained"
                startIcon={<ApplyIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyTemplate(template);
                }}
              >
                Apply
              </Button>
            )}
          </CardActions>
        </Card>
      </motion.div>
    );
  };

  const renderFilters = () => (
    <Box sx={{ mb: 3 }}>
      {/* Search and view controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search templates..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, minWidth: 200 }}
        />

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, newMode) => newMode && setViewMode(newMode)}
          size="small"
        >
          <ToggleButton value="grid">
            <GridIcon />
          </ToggleButton>
          <ToggleButton value="list">
            <ListIcon />
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant="outlined"
          startIcon={<FilterIcon />}
          onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
        >
          Sort & Filter
        </Button>
      </Box>

      {/* Category chips */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={`${category.name} (${category.count})`}
            onClick={() => handleCategoryChange(category.id)}
            color={selectedCategory === category.id ? 'primary' : 'default'}
            variant={selectedCategory === category.id ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {/* Quick filters */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          size="small"
          variant={showFavoritesOnly ? 'contained' : 'outlined'}
          startIcon={showFavoritesOnly ? <StarIcon /> : <StarBorderIcon />}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          Favorites {favorites.size > 0 && `(${favorites.size})`}
        </Button>
      </Box>
    </Box>
  );

  const getShiftTypeColor = (shiftType: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (shiftType) {
      case 'regular': return 'primary';
      case 'overtime': return 'warning';
      case 'emergency': return 'error';
      case 'training': return 'info';
      default: return 'default';
    }
  };

  // ============================================================================
  // RENDER MAIN COMPONENT
  // ============================================================================

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
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
              <Typography variant="h6" component="span">
                Template Library
              </Typography>
              <Badge badgeContent={templates.length} color="primary" sx={{ ml: 2 }}>
                <BookmarkIcon />
              </Badge>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {renderFilters()}

          {loading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={index}>
                  <Card>
                    <CardContent>
                      <Skeleton variant="text" height={32} />
                      <Skeleton variant="text" height={20} sx={{ mt: 1 }} />
                      <Skeleton variant="text" height={20} />
                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Skeleton variant="rectangular" width={80} height={24} />
                        <Skeleton variant="rectangular" width={60} height={24} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <Grid container spacing={2}>
                  {filteredTemplates.map((template) => (
                    <Grid 
                      size={{ 
                        xs: 12, 
                        sm: viewMode === 'grid' ? 6 : 12, 
                        md: viewMode === 'grid' ? 4 : 12, 
                        lg: viewMode === 'grid' ? 3 : 12 
                      }}
                      key={template.templateId}
                    >
                      {renderTemplateCard(template)}
                    </Grid>
                  ))}
                </Grid>
              </AnimatePresence>

              {filteredTemplates.length === 0 && !loading && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <BookmarkBorderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {searchQuery || selectedCategory !== 'all' || showFavoritesOnly
                      ? 'No templates match your filters'
                      : 'No templates yet'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {searchQuery || selectedCategory !== 'all' || showFavoritesOnly
                      ? 'Try adjusting your search or filters'
                      : 'Create your first template to get started'}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateTemplate}
                  >
                    Create Template
                  </Button>
                </Box>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, newPage) => setPage(newPage)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateTemplate}
          >
            Create New Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for mobile */}
      {isMobile && open && (
        <Fab
          color="primary"
          onClick={handleCreateTemplate}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: theme.zIndex.modal + 1,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleSortChange('templateName')}>
          <SortIcon sx={{ mr: 1 }} />
          Sort by Name
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('updatedAt')}>
          <TimeIcon sx={{ mr: 1 }} />
          Sort by Updated
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('usage_count')}>
          <TrendingIcon sx={{ mr: 1 }} />
          Sort by Usage
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('rating')}>
          <StarIcon sx={{ mr: 1 }} />
          Sort by Rating
        </MenuItem>
      </Menu>

      {/* Template Actions Menu */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={() => setTemplateMenuAnchor(null)}
      >
        <MenuItem onClick={() => selectedTemplate && handleApplyTemplate(selectedTemplate)}>
          <ApplyIcon sx={{ mr: 1 }} />
          Apply Template
        </MenuItem>
        <MenuItem onClick={() => selectedTemplate && handleEditTemplate(selectedTemplate)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Template
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => selectedTemplate && handleDeleteTemplate(selectedTemplate)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Template
        </MenuItem>
      </Menu>
    </>
  );
};

export default TemplateLibrary; 