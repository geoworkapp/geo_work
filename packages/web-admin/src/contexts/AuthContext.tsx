import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  type User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// User role types
export type UserRole = 'super_admin' | 'company_admin' | 'manager' | 'employee';

// Extended user interface with company and role information
export interface GeoWorkUser extends User {
  role?: UserRole;
  companyId?: string;
  companyName?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  };
}

// Company registration interface
export interface CompanyRegistrationData {
  companyName: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword?: string; // Optional for Google sign-up
  phoneNumber?: string;
  industry?: string;
  employeeCount?: string;
  country?: string;
}

// Auth context interface
interface AuthContextType {
  currentUser: GeoWorkUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, role: UserRole, companyId?: string) => Promise<void>;
  registerCompanyWithGoogle: (companyData: CompanyRegistrationData) => Promise<void>;
  registerCompanyWithEmail: (companyData: CompanyRegistrationData) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

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
        loginWithGoogle: async () => {},
        register: async () => {},
        registerCompanyWithGoogle: async () => {},
        registerCompanyWithEmail: async () => {},
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

  // Helper function to create user document
  const createUserDocument = async (user: User, additionalData: any = {}) => {
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      ...additionalData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      lastLoginAt: serverTimestamp()
    };

    await setDoc(doc(db, 'users', user.uid), userData);
    return userData;
  };

  // Helper function to create company document
  const createCompanyDocument = async (companyData: CompanyRegistrationData, ownerUid: string) => {
    const company = {
      companyName: companyData.companyName,
      ownerUid,
      industry: companyData.industry || 'Other',
      employeeCount: companyData.employeeCount || '1-10',
      country: companyData.country || 'United Kingdom',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      settings: {
        timezone: 'Europe/London',
        currency: 'GBP',
        dateFormat: 'dd/MM/yyyy',
        timeFormat: '24h' as const,
        language: 'en'
      }
    };

    const companyRef = await addDoc(collection(db, 'companies'), company);
    return companyRef.id;
  };

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Update last login time
      await setDoc(doc(db, 'users', result.user.uid), {
        lastLoginAt: serverTimestamp()
      }, { merge: true });

      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentUser({
          ...result.user,
          role: userData.role,
          companyId: userData.companyId,
          companyName: userData.companyName,
          profile: userData.profile
        });
      }
    } catch (err) {
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError.code));
      throw authError;
    }
  };

  // Google Sign-in function
  const loginWithGoogle = async (): Promise<void> => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (userDoc.exists()) {
        // Existing user - update last login
        const userData = userDoc.data();
        await setDoc(doc(db, 'users', result.user.uid), {
          lastLoginAt: serverTimestamp()
        }, { merge: true });

        setCurrentUser({
          ...result.user,
          role: userData.role,
          companyId: userData.companyId,
          companyName: userData.companyName,
          profile: userData.profile
        });
      } else {
        // New user - needs company setup
        setError('Please complete company registration to continue');
        await signOut(auth);
        throw new Error('USER_NEEDS_ONBOARDING');
      }
    } catch (err: any) {
      if (err.message === 'USER_NEEDS_ONBOARDING') {
        throw err;
      }
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError.code));
      throw authError;
    }
  };

  // Register company with Google account
  const registerCompanyWithGoogle = async (companyData: CompanyRegistrationData): Promise<void> => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      
      // Create company first
      const companyId = await createCompanyDocument(companyData, result.user.uid);
      
      // Create user document
      const userData = await createUserDocument(result.user, {
        role: 'company_admin',
        companyId,
        companyName: companyData.companyName,
        profile: {
          firstName: companyData.adminFirstName,
          lastName: companyData.adminLastName,
          phoneNumber: companyData.phoneNumber
        }
      });

      setCurrentUser({
        ...result.user,
        role: 'company_admin',
        companyId,
        companyName: companyData.companyName,
        profile: userData.profile
      });
    } catch (err) {
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError.code));
      throw authError;
    }
  };

  // Register company with email/password
  const registerCompanyWithEmail = async (companyData: CompanyRegistrationData): Promise<void> => {
    try {
      setError(null);
      
      if (!companyData.adminPassword) {
        throw new Error('Password is required for email registration');
      }

      const result = await createUserWithEmailAndPassword(
        auth, 
        companyData.adminEmail, 
        companyData.adminPassword
      );
      
      // Create company first
      const companyId = await createCompanyDocument(companyData, result.user.uid);
      
      // Create user document
      const userData = await createUserDocument(result.user, {
        role: 'company_admin',
        companyId,
        companyName: companyData.companyName,
        profile: {
          firstName: companyData.adminFirstName,
          lastName: companyData.adminLastName,
          phoneNumber: companyData.phoneNumber
        }
      });

      setCurrentUser({
        ...result.user,
        role: 'company_admin',
        companyId,
        companyName: companyData.companyName,
        profile: userData.profile
      });
    } catch (err) {
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError.code));
      throw authError;
    }
  };

  // Register function (for adding employees)
  const register = async (
    email: string, 
    password: string, 
    role: UserRole, 
    companyId?: string
  ): Promise<void> => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document
      await createUserDocument(result.user, {
        role,
        companyId: companyId || null
      });
      
      setCurrentUser({
        ...result.user,
        role,
        companyId
      });
    } catch (err) {
      const authError = err as AuthError;
      setError(getAuthErrorMessage(authError.code));
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
      setError(getAuthErrorMessage(authError.code));
      throw authError;
    }
  };

  // Clear error function
  const clearError = (): void => {
    setError(null);
  };

  // Helper function to get user-friendly error messages
  const getAuthErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/invalid-email':
        return 'Please enter a valid email address';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled';
      case 'auth/popup-blocked':
        return 'Pop-up blocked. Please allow pop-ups and try again';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection';
      default:
        return 'An error occurred during authentication';
    }
  };

  // Auth state listener
  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Early return if component is unmounted
      if (!isMounted) return;
      
      try {
        if (user) {
          try {
            // Use a simple get operation instead of real-time listener
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            // Check if component is still mounted before setting state
            if (!isMounted) return;
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setCurrentUser({
                ...user,
                role: userData.role,
                companyId: userData.companyId,
                companyName: userData.companyName,
                profile: userData.profile
              });
            } else {
              // User document doesn't exist, create basic one
              const userData = {
                uid: user.uid,
                email: user.email,
                role: 'company_admin' as UserRole,
                companyId: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isActive: true
              };
              
              try {
                await setDoc(userDocRef, userData);
                if (isMounted) {
                  setCurrentUser({
                    ...user,
                    role: 'company_admin'
                  });
                }
              } catch (setDocError) {
                console.error('Error creating user document:', setDocError);
                if (isMounted) {
                  setCurrentUser({
                    ...user,
                    role: 'company_admin'
                  });
                }
              }
            }
          } catch (firestoreError: any) {
            console.error('Firestore error, using basic user data:', firestoreError);
            // If Firestore fails, still set user with basic data
            if (isMounted) {
              setCurrentUser({
                ...user,
                role: 'company_admin'
              });
            }
          }
        } else {
          if (isMounted) {
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        // Always set loading to false if component is still mounted
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    // Cleanup function
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []); // Empty dependency array - only run once

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    loginWithGoogle,
    register,
    registerCompanyWithGoogle,
    registerCompanyWithEmail,
    logout,
    error,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 