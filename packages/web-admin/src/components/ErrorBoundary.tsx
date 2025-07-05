import { Component, type ReactNode } from 'react';
import { Box, Typography, Button, Alert, Container } from '@mui/material';
import { RefreshRounded as RefreshIcon } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log Firebase assertion errors differently
    if (error.message.includes('FIRESTORE') && error.message.includes('INTERNAL ASSERTION FAILED')) {
      console.warn('Firebase internal assertion error caught by boundary:', error.message);
      // Don't show UI error for internal Firebase errors in development
      if (import.meta.env.DEV) {
        this.setState({ hasError: false, error: null, errorInfo: null });
        return;
      }
    }

    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      hasError: true,
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="60vh"
            textAlign="center"
          >
            <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Something went wrong
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                An unexpected error occurred. Please try refreshing the page.
              </Typography>
              {import.meta.env.DEV && this.state.error && (
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    overflow: 'auto',
                    textAlign: 'left'
                  }}
                >
                  {this.state.error.message}
                </Typography>
              )}
            </Alert>

            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                onClick={this.handleReset}
                color="primary"
              >
                Try Again
              </Button>
              <Button
                variant="contained"
                onClick={this.handleReload}
                startIcon={<RefreshIcon />}
                color="primary"
              >
                Refresh Page
              </Button>
            </Box>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 