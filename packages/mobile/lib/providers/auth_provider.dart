import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../firebase/firebase_service.dart';

// User role enum
enum UserRole { superAdmin, companyAdmin, employee }

// Extended user class with company and role information
class GeoWorkUser {
  final User firebaseUser;
  final UserRole? role;
  final String? companyId;
  final String? companyName;

  GeoWorkUser({
    required this.firebaseUser,
    this.role,
    this.companyId,
    this.companyName,
  });

  String get uid => firebaseUser.uid;
  String? get email => firebaseUser.email;
  String? get displayName => firebaseUser.displayName;

  factory GeoWorkUser.fromFirebaseUser(User user, {
    UserRole? role,
    String? companyId,
    String? companyName,
  }) {
    return GeoWorkUser(
      firebaseUser: user,
      role: role,
      companyId: companyId,
      companyName: companyName,
    );
  }
}

// Auth state class
class AuthState {
  final GeoWorkUser? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    GeoWorkUser? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }

  bool get isAuthenticated => user != null;
}

// Auth notifier class
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState(isLoading: true)) {
    _init();
  }

  final FirebaseService _firebaseService = FirebaseService.instance;

  // Initialize auth listener
  void _init() {
    _firebaseService.authStateChanges.listen((User? user) async {
      if (user != null) {
        await _loadUserData(user);
      } else {
        state = const AuthState(isLoading: false);
      }
    });
  }

  // Load user data from Firestore
  Future<void> _loadUserData(User user) async {
    try {
      print('🔍 Loading user data for: ${user.uid}');
      state = state.copyWith(isLoading: true, error: null);

      print('🔍 Attempting to read user document from collection: users, doc: ${user.uid}');
      final userDoc = await _firebaseService.firestore
          .collection('users')
          .doc(user.uid)
          .get();

      print('📋 User doc exists: ${userDoc.exists}');

      UserRole? role;
      String? companyId;
      String? companyName;

      if (userDoc.exists) {
        final data = userDoc.data()!;
        print('👤 User data: $data');
        role = _parseUserRole(data['role']);
        companyId = data['companyId'];
        companyName = data['companyName'];
        print('🏢 Parsed - Role: $role, CompanyId: $companyId, CompanyName: $companyName');
      } else {
        print('⚠️ No user document found with UID as document ID');
        print('🔍 Searching for user by email: ${user.email}');
        
        // Try to find user document by email (for users created through web admin)
        if (user.email != null) {
          final emailQuery = await _firebaseService.firestore
              .collection('users')
              .where('email', isEqualTo: user.email!.toLowerCase())
              .limit(1)
              .get();
          
          print('📧 Email query returned ${emailQuery.docs.length} results');
          
          if (emailQuery.docs.isNotEmpty) {
            final emailUserDoc = emailQuery.docs.first;
            final data = emailUserDoc.data();
            print('👤 Found user by email: $data');
            role = _parseUserRole(data['role']);
            companyId = data['companyId'];
            companyName = data['companyName'];
            print('🏢 Parsed from email search - Role: $role, CompanyId: $companyId, CompanyName: $companyName');
          } else {
            print('❌ No user document found by email either');
          }
        }
      }

      final geoWorkUser = GeoWorkUser.fromFirebaseUser(
        user,
        role: role,
        companyId: companyId,
        companyName: companyName,
      );

      print('✅ Created GeoWorkUser - CompanyId: ${geoWorkUser.companyId}');
      state = AuthState(user: geoWorkUser, isLoading: false);
    } catch (e) {
      print('❌ Error loading user data: $e');
      print('❌ Error type: ${e.runtimeType}');
      if (e.toString().contains('PERMISSION_DENIED')) {
        print('❌ This is a Firestore permission error');
      }
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load user data: $e',
      );
    }
  }

  // Parse user role from string
  UserRole? _parseUserRole(String? roleString) {
    switch (roleString) {
      case 'super_admin':
        return UserRole.superAdmin;
      case 'company_admin':
        return UserRole.companyAdmin;
      case 'employee':
        return UserRole.employee;
      default:
        return null;
    }
  }

  // Sign in with email and password
  Future<void> signInWithEmailAndPassword(String email, String password) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      
      await _firebaseService.auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      
      // User data will be loaded automatically by auth state listener
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _getErrorMessage(e),
      );
      rethrow;
    }
  }

  // Register new user
  Future<void> registerWithEmailAndPassword(
    String email,
    String password,
    UserRole role,
    String? companyId,
  ) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      
      final userCredential = await _firebaseService.auth
          .createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      // Create user document in Firestore
      await _firebaseService.firestore
          .collection('users')
          .doc(userCredential.user!.uid)
          .set({
        'uid': userCredential.user!.uid,
        'email': userCredential.user!.email,
        'role': _roleToString(role),
        'companyId': companyId,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
        'isActive': true,
      });

      // User data will be loaded automatically by auth state listener
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _getErrorMessage(e),
      );
      rethrow;
    }
  }

  // Sign out
  Future<void> signOut() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      await _firebaseService.auth.signOut();
      state = const AuthState(isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to sign out: $e',
      );
    }
  }

  // Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  // Convert role enum to string
  String _roleToString(UserRole role) {
    switch (role) {
      case UserRole.superAdmin:
        return 'super_admin';
      case UserRole.companyAdmin:
        return 'company_admin';
      case UserRole.employee:
        return 'employee';
    }
  }

  // Get user-friendly error message
  String _getErrorMessage(dynamic error) {
    if (error is FirebaseAuthException) {
      switch (error.code) {
        case 'user-not-found':
          return 'No user found with this email address.';
        case 'wrong-password':
          return 'Incorrect password.';
        case 'email-already-in-use':
          return 'An account already exists with this email.';
        case 'weak-password':
          return 'Password is too weak.';
        case 'invalid-email':
          return 'Invalid email address.';
        case 'network-request-failed':
          return 'Network error. Please check your connection.';
        default:
          return error.message ?? 'Authentication failed.';
      }
    }
    return error.toString();
  }
}

// Provider definitions
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

// Convenience providers
final currentUserProvider = Provider<GeoWorkUser?>((ref) {
  return ref.watch(authProvider).user;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isAuthenticated;
});

final authLoadingProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isLoading;
});

final authErrorProvider = Provider<String?>((ref) {
  return ref.watch(authProvider).error;
}); 