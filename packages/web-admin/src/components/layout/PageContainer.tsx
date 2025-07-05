import React from 'react';
import { Box } from '@mui/material';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: string | number;
  fullWidth?: boolean;
  disablePadding?: boolean;
}

/**
 * PageContainer - A reusable layout component for dashboard pages
 * 
 * Features:
 * - Full width by default with sensible max-width for readability
 * - Responsive padding
 * - Centered content
 * - Consistent spacing across all dashboard pages
 */
const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = '1400px',
  fullWidth = false,
  disablePadding = false
}) => {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: fullWidth ? '100%' : maxWidth,
        mx: 'auto',
        p: disablePadding ? 0 : { xs: 2, sm: 3, md: 4 },
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </Box>
  );
};

export default PageContainer; 