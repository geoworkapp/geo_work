import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  type User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// User role types
export type UserRole = 'super_admin' | 'company_admin' | 'employee';

// Extended user interface with company and role information
export interface GeoWorkUser extends User {
  role?: UserRole;
  companyId?: string;
  companyName?: string;
}

// Auth context interface
interface AuthContextType {
  currentUser: GeoWorkUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: UserRole, companyId?: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.warn('useAuth called outside AuthProvider - this may be a hot reload issue');
      return {
        currentUser: null,
        loading: false,
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        error: null,
        clearError: () => {}
      } as AuthContextType;
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<GeoWorkUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentUser({
          ...result.user,
          role: userData.role,
          companyId: userData.companyId,
          companyName: userData.companyName
        });
      }
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
      throw authError;
    }
  };

  // Register function
  const register = async (
    email: string, 
    password: string, 
    role: UserRole, 
    companyId?: string
  ): Promise<void> => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document in Firestore
      const userData = {
        uid: result.user.uid,
        email: result.user.email,
        role,
        companyId: companyId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      await setDoc(doc(db, 'users', result.user.uid), userData);
      
      setCurrentUser({
        ...result.user,
        role,
        companyId
      });
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
      throw authError;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setError(null);
      await signOut(auth);
      setCurrentUser(null);
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
      throw authError;
    }
  };

  // Clear error function
  const clearError = (): void => {
    setError(null);
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          try {
            // Get user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setCurrentUser({
                ...user,
                role: userData.role,
                companyId: userData.companyId,
                companyName: userData.companyName
              });
            } else {
              // User document doesn't exist, create basic one
              const userData = {
                uid: user.uid,
                email: user.email,
                role: 'company_admin' as UserRole,
                companyId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true
              };
              await setDoc(doc(db, 'users', user.uid), userData);
              setCurrentUser({
                ...user,
                role: 'company_admin'
              });
            }
          } catch (firestoreError) {
            console.error('Firestore error, using basic user data:', firestoreError);
            // If Firestore fails, still set user with basic data
            setCurrentUser({
              ...user,
              role: 'company_admin'
            });
          }
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setCurrentUser(null);
      } finally {
        // Always set loading to false
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    register,
    logout,
    error,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 