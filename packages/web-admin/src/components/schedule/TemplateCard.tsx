import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Rating,
  LinearProgress,
  Skeleton,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  PlayArrow as ApplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Schedule as ScheduleIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingIcon,
  Visibility as PreviewIcon,
  Share as ShareIcon,
  FileCopy as DuplicateIcon,
  Warning as WarningIcon,
  Work as WorkIcon,
  Build as EquipmentIcon,
  School as SkillIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';

import templateService from '../../services/templateService';
import type { ScheduleTemplate } from '@shared/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TemplateCardProps {
  template: ScheduleTemplate;
  onApply?: (template: ScheduleTemplate) => void;
  onEdit?: (template: ScheduleTemplate) => void;
  onDelete?: (template: ScheduleTemplate) => void;
  onToggleFavorite?: (templateId: string) => void;
  onPreview?: (template: ScheduleTemplate) => void;
  isFavorite?: boolean;
  showActions?: boolean;
  showStats?: boolean;
  showPreview?: boolean;
  compact?: boolean;
  selectionMode?: boolean;
  variant?: 'default' | 'minimal' | 'detailed';
  elevation?: number;
  onClick?: (template: ScheduleTemplate) => void;
}

interface TemplatePreviewData {
  estimatedDuration: string;
  complexity: 'Simple' | 'Moderate' | 'Complex';
  compatibility: number; // 0-100%
  lastUsed?: Date;
  usageCount: number;
  averageRating: number;
  successRate: number; // % of successful applications
}

// ============================================================================
// TEMPLATE CARD COMPONENT
// ============================================================================

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onApply,
  onEdit,
  onDelete,
  onToggleFavorite,
  onPreview,
  isFavorite = false,
  showActions = true,
  showStats = true,
  showPreview = false,
  compact = false,
  selectionMode = false,
  variant = 'default',
  elevation = 1,
  onClick,
}) => {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [templateStats, setTemplateStats] = useState<TemplatePreviewData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [] = useState<any>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (showStats || showPreview) {
      loadTemplateAnalytics();
    }
  }, [template.templateId, showStats, showPreview]);

  const loadTemplateAnalytics = async () => {
    if (!showStats && !showPreview) return;

    try {
      setStatsLoading(true);
      const analytics = await templateService.getTemplateAnalytics(template.templateId);
      
      if (analytics) {
        setTemplateStats({
          estimatedDuration: `${template.duration}h`,
          complexity: calculateComplexity(template),
          compatibility: calculateCompatibility(template),
          lastUsed: analytics.usage.lastUsed || undefined,
          usageCount: analytics.usage.totalUsage,
          averageRating: analytics.usage.averageRating,
          successRate: analytics.performance.accuracy,
        });
      } else {
        // Fallback to basic data if analytics not available
        setTemplateStats({
          estimatedDuration: `${template.duration}h`,
          complexity: calculateComplexity(template),
          compatibility: calculateCompatibility(template),
          usageCount: 0,
          averageRating: 0,
          successRate: 0,
        });
      }
    } catch (error) {
      console.error('Error loading template analytics:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const calculateComplexity = (template: ScheduleTemplate): 'Simple' | 'Moderate' | 'Complex' => {
    let complexityScore = 0;
    
    if (template.skillsRequired && template.skillsRequired.length > 0) complexityScore += 1;
    if (template.equipmentNeeded && template.equipmentNeeded.length > 0) complexityScore += 1;
    if (template.recurrence.type !== 'daily') complexityScore += 1;
    if (template.duration > 8) complexityScore += 1;
    if (template.specialInstructions) complexityScore += 1;

    if (complexityScore <= 1) return 'Simple';
    if (complexityScore <= 3) return 'Moderate';
    return 'Complex';
  };

  const calculateCompatibility = (template: ScheduleTemplate): number => {
    // Mock compatibility calculation based on template properties
    let score = 85; // Base score
    
    if (template.skillsRequired && template.skillsRequired.length > 3) score -= 10;
    if (template.duration > 12) score -= 15;
    if (template.shiftType === 'emergency') score -= 5;
    
    return Math.max(0, Math.min(100, score));
  };

  const getShiftTypeColor = (shiftType: string) => {
    switch (shiftType) {
      case 'regular': return theme.palette.success.main;
      case 'overtime': return theme.palette.warning.main;
      case 'emergency': return theme.palette.error.main;
      case 'training': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  const getShiftTypeIcon = (shiftType: string) => {
    switch (shiftType) {
      case 'regular': return <WorkIcon />;
      case 'overtime': return <TrendingIcon />;
      case 'emergency': return <WarningIcon />;
      case 'training': return <SkillIcon />;
      default: return <ScheduleIcon />;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Simple': return theme.palette.success.main;
      case 'Moderate': return theme.palette.warning.main;
      case 'Complex': return theme.palette.error.main;
      default: return theme.palette.grey[500];
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleCardClick = () => {
    if (selectionMode && onApply) {
      onApply(template);
    } else if (onClick) {
      onClick(template);
    }
  };

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onApply) {
      onApply(template);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(template);
    }
    setMenuAnchor(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(template);
    }
    setMenuAnchor(null);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(template.templateId);
    }
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreview) {
      onPreview(template);
    }
    setMenuAnchor(null);
  };

  const handleMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget as HTMLElement);
  };

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  const renderHeader = () => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
      <Box sx={{ flex: 1, mr: 1 }}>
        <Typography 
          variant={compact ? "subtitle2" : "h6"} 
          component="h3" 
          sx={{ 
            fontWeight: 600,
            color: theme.palette.text.primary,
            display: '-webkit-box',
            WebkitLineClamp: compact ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {template.templateName}
        </Typography>
        {!compact && template.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {template.description}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {onToggleFavorite && (
          <Tooltip title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
            <IconButton
              size="small"
              onClick={handleToggleFavorite}
              color={isFavorite ? 'warning' : 'default'}
            >
              {isFavorite ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
        )}
        
        {showActions && !selectionMode && (
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );

  const renderDetails = () => (
    <Stack spacing={compact ? 1 : 1.5}>
      {/* Main details */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          icon={getShiftTypeIcon(template.shiftType)}
          label={template.shiftType}
          size="small"
          sx={{
            backgroundColor: alpha(getShiftTypeColor(template.shiftType), 0.1),
            color: getShiftTypeColor(template.shiftType),
            fontWeight: 500,
          }}
        />
        <Chip
          icon={<TimeIcon />}
          label={`${template.duration}h`}
          size="small"
          variant="outlined"
        />
        {templateStats && (
          <Chip
            label={templateStats.complexity}
            size="small"
            variant="outlined"
            sx={{
              color: getComplexityColor(templateStats.complexity),
              borderColor: getComplexityColor(templateStats.complexity),
            }}
          />
        )}
      </Box>

      {/* Time details */}
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
      {!compact && (template.skillsRequired && template.skillsRequired.length > 0) && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <SkillIcon sx={{ fontSize: 14 }} />
            Skills Required:
          </Typography>
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
        </Box>
      )}

      {!compact && (template.equipmentNeeded && template.equipmentNeeded.length > 0) && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <EquipmentIcon sx={{ fontSize: 14 }} />
            Equipment:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {template.equipmentNeeded.slice(0, 2).map((equipment) => (
              <Chip
                key={equipment}
                label={equipment}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
            {template.equipmentNeeded.length > 2 && (
              <Chip
                label={`+${template.equipmentNeeded.length - 2} more`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
        </Box>
      )}
    </Stack>
  );

  const renderStats = () => {
    if (!showStats || !templateStats) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ mb: 1.5 }} />
        <Stack spacing={1}>
          {/* Usage and rating */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                Used {templateStats.usageCount} times
              </Typography>
            </Box>
            {templateStats.averageRating > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Rating
                  value={templateStats.averageRating}
                  precision={0.1}
                  size="small"
                  readOnly
                />
                <Typography variant="caption" color="text.secondary">
                  ({templateStats.averageRating.toFixed(1)})
                </Typography>
              </Box>
            )}
          </Box>

          {/* Success rate */}
          {templateStats.successRate > 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Success Rate
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {templateStats.successRate}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={templateStats.successRate}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.grey[400], 0.3),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: templateStats.successRate > 80 ? theme.palette.success.main :
                                  templateStats.successRate > 60 ? theme.palette.warning.main :
                                  theme.palette.error.main,
                  },
                }}
              />
            </Box>
          )}

          {/* Last used */}
          {templateStats.lastUsed && (
            <Typography variant="caption" color="text.secondary">
              Last used {formatDistanceToNow(templateStats.lastUsed, { addSuffix: true })}
            </Typography>
          )}
        </Stack>
      </Box>
    );
  };

  const renderActions = () => {
    if (!showActions) return null;

    return (
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Updated {format(template.updatedAt, 'MMM d, yyyy')}
        </Typography>
        
        {selectionMode && onApply && (
          <Button
            size="small"
            variant="contained"
            startIcon={<ApplyIcon />}
            onClick={handleApply}
          >
            Apply
          </Button>
        )}
      </CardActions>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const cardContent = (
    <Card
      elevation={elevation}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: (selectionMode || onClick) ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        overflow: 'visible',
        '&:hover': {
          transform: (selectionMode || onClick) ? 'translateY(-2px)' : 'none',
          boxShadow: (selectionMode || onClick) ? theme.shadows[4] : undefined,
        },
      }}
      onClick={handleCardClick}
    >
      {/* Premium indicator */}
      {templateStats?.averageRating && templateStats.averageRating >= 4.5 && (
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            right: 16,
            zIndex: 1,
          }}
        >
          <Chip
            label="⭐ Premium"
            size="small"
            sx={{
              backgroundColor: theme.palette.warning.main,
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
        </Box>
      )}

      <CardContent sx={{ flex: 1, pb: showActions ? 1 : 2 }}>
        {renderHeader()}
        {renderDetails()}
        {statsLoading ? (
          <Box sx={{ mt: 2 }}>
            <Skeleton variant="text" height={20} width="60%" />
            <Skeleton variant="rectangular" height={4} sx={{ mt: 1 }} />
          </Box>
        ) : (
          renderStats()
        )}
      </CardContent>

      {renderActions()}
    </Card>
  );

  return (
    <>
      {variant === 'minimal' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {cardContent}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          layout
          whileHover={{ 
            scale: (selectionMode || onClick) ? 1.02 : 1,
            transition: { duration: 0.2 }
          }}
        >
          {cardContent}
        </motion.div>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        PaperProps={{
          elevation: 8,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
          },
        }}
      >
        {onApply && (
          <MenuItem onClick={handleApply}>
            <ApplyIcon sx={{ mr: 1, fontSize: 20 }} />
            Apply Template
          </MenuItem>
        )}
        {onPreview && (
          <MenuItem onClick={handlePreview}>
            <PreviewIcon sx={{ mr: 1, fontSize: 20 }} />
            Preview
          </MenuItem>
        )}
        {onEdit && (
          <MenuItem onClick={handleEdit}>
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            Edit Template
          </MenuItem>
        )}
        <MenuItem onClick={() => setMenuAnchor(null)}>
          <DuplicateIcon sx={{ mr: 1, fontSize: 20 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => setMenuAnchor(null)}>
          <ShareIcon sx={{ mr: 1, fontSize: 20 }} />
          Share
        </MenuItem>
        <Divider />
        {onDelete && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
            Delete
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default TemplateCard; 