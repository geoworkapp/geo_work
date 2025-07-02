import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  useTheme,
  Stack,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as ActiveIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'employee' | 'manager' | 'admin';
  isActive: boolean;
  jobSites: string[];
  createdAt: Date;
  companyId: string;
}

const EmployeesList: React.FC = () => {
  console.log('EmployeesList rendering');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Fetch employees
  useEffect(() => {
    async function fetchEmployees() {
      if (!currentUser?.companyId) {
        setError('No company ID found');
        setLoading(false);
        return;
      }

      try {
        const employeesRef = collection(db, 'users');
        const q = query(employeesRef, where('companyId', '==', currentUser.companyId));
        const querySnapshot = await getDocs(q);
        
        const employeesList: Employee[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          employeesList.push({
            id: doc.id,
            email: data.email,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            role: data.role || 'employee',
            isActive: data.isActive ?? true,
            jobSites: data.jobSites || [],
            createdAt: data.createdAt?.toDate() || new Date(),
            companyId: data.companyId
          });
        });

        setEmployees(employeesList);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Failed to load employees');
        setLoading(false);
      }
    }

    fetchEmployees();
  }, [currentUser?.companyId]);

  // Filter employees based on search
  const filteredEmployees = employees.filter(employee => 
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle employee status toggle
  const handleStatusToggle = async (employee: Employee) => {
    try {
      const employeeRef = doc(db, 'users', employee.id);
      await updateDoc(employeeRef, {
        isActive: !employee.isActive
      });

      setEmployees(employees.map(emp => 
        emp.id === employee.id ? { ...emp, isActive: !emp.isActive } : emp
      ));
    } catch (err) {
      console.error('Error updating employee status:', err);
      setError('Failed to update employee status');
    }
  };

  // Handle employee deletion
  const handleDelete = async () => {
    if (!selectedEmployee) return;

    try {
      await deleteDoc(doc(db, 'users', selectedEmployee.id));
      setEmployees(employees.filter(emp => emp.id !== selectedEmployee.id));
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
    } catch (err) {
      console.error('Error deleting employee:', err);
      setError('Failed to delete employee');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <Typography>Loading employees...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Employees
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage your team members and their access
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Actions Bar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          placeholder="Search employees..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
          }}
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/employees/new')}
        >
          Add Employee
        </Button>
      </Stack>

      {/* Employees Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Job Sites</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEmployees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  {employee.firstName} {employee.lastName}
                </TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>
                  <Chip
                    label={employee.role}
                    color={
                      employee.role === 'admin' ? 'primary' :
                      employee.role === 'manager' ? 'secondary' : 'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={employee.isActive ? 'Active' : 'Inactive'}
                    color={employee.isActive ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${employee.jobSites.length} sites`}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    onClick={() => navigate(`/employees/edit/${employee.id}`)}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleStatusToggle(employee)}
                    size="small"
                    color={employee.isActive ? 'error' : 'success'}
                  >
                    {employee.isActive ? <BlockIcon /> : <ActiveIcon />}
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setDeleteDialogOpen(true);
                    }}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filteredEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">
                    No employees found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Delete Employee
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Are you sure you want to delete {selectedEmployee?.firstName} {selectedEmployee?.lastName}?
            This action cannot be undone.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

export default EmployeesList; 