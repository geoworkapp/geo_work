import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';
import 'package:shared/models.dart';
import '../firebase/firebase_service.dart';

// User role enum for backward compatibility
enum UserRole { superAdmin, companyAdmin, employee }

// Extended user class with company and role information
class GeoWorkUser {
  final firebase_auth.User firebaseUser;
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

  factory GeoWorkUser.fromFirebaseUser(firebase_auth.User user, {
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

  // Convert to shared User model
  User toSharedUser() {
    return User(
      id: uid,
      email: email ?? '',
      profile: UserProfile(
        firstName: displayName?.split(' ').first ?? '',
        lastName: displayName?.split(' ').skip(1).join(' ') ?? '',
      ),
      role: _mapRoleToString(role),
      companyId: companyId,
      isActive: true,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  String _mapRoleToString(UserRole? role) {
    switch (role) {
      case UserRole.superAdmin:
        return 'superadmin';
      case UserRole.companyAdmin:
        return 'company_admin';
      case UserRole.employee:
        return 'employee';
      default:
        return 'employee';
    }
  }
}

// Auth state class
class AuthState {
  final User? user;
  final bool loading;
  final String? error;

  const AuthState({
    this.user,
    this.loading = false,
    this.error,
  });

  AuthState copyWith({
    User? user,
    bool? loading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      loading: loading ?? this.loading,
      error: error ?? this.error,
    );
  }

  bool get isAuthenticated => user != null;
}

// Auth notifier class
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState(user: null, loading: true, error: null)) {
    _init();
  }

  final FirebaseService _firebaseService = FirebaseService.instance;
  final _logger = Logger('AuthNotifier');

  // Initialize auth listener
  void _init() {
    _firebaseService.authStateChanges.listen((firebase_auth.User? user) async {
      if (user != null) {
        await _loadUserData(user);
      } else {
        state = const AuthState(user: null, loading: false, error: null);
      }
    });
  }

  // Load user data from Firestore
  Future<void> _loadUserData(firebase_auth.User user) async {
    try {
      _logger.info('Loading user data for: ${user.uid}');
      state = state.copyWith(loading: true, error: null);

      _logger.info('Attempting to read user document from collection: users, doc: ${user.uid}');
      final userDoc = await _firebaseService.firestore
          .collection('users')
          .doc(user.uid)
          .get();

      _logger.info('User doc exists: ${userDoc.exists}');

      UserRole? role;
      String? companyId;
      String? companyName;

      if (userDoc.exists) {
        final data = userDoc.data()!;
        _logger.info('User data: $data');
        role = _parseUserRole(data['role']);
        companyId = data['companyId'];
        companyName = data['companyName'];
        _logger.info('Parsed - Role: $role, CompanyId: $companyId, CompanyName: $companyName');
      } else {
        _logger.warning('No user document found with UID as document ID');
        _logger.info('Searching for user by email: ${user.email}');
        
        // Try to find user document by email (for users created through web admin)
        if (user.email != null) {
          final emailQuery = await _firebaseService.firestore
              .collection('users')
              .where('email', isEqualTo: user.email!.toLowerCase())
              .limit(1)
              .get();
          
          _logger.info('Email query returned ${emailQuery.docs.length} results');
          
          if (emailQuery.docs.isNotEmpty) {
            final emailUserDoc = emailQuery.docs.first;
            final data = emailUserDoc.data();
            _logger.info('Found user by email: $data');
            role = _parseUserRole(data['role']);
            companyId = data['companyId'];
            companyName = data['companyName'];
            _logger.info('Parsed from email search - Role: $role, CompanyId: $companyId, CompanyName: $companyName');
          } else {
            _logger.warning('No user document found by email either');
          }
        }
      }

      final geoWorkUser = GeoWorkUser.fromFirebaseUser(
        user,
        role: role,
        companyId: companyId,
        companyName: companyName,
      );

      _logger.info('Created GeoWorkUser - CompanyId: ${geoWorkUser.companyId}');
      
      // Convert to shared User model
      final sharedUser = geoWorkUser.toSharedUser();
      state = AuthState(user: sharedUser, loading: false, error: null);
    } catch (e) {
      _logger.severe('Error loading user data: $e');
      _logger.severe('Error type: ${e.runtimeType}');
      if (e.toString().contains('PERMISSION_DENIED')) {
        _logger.severe('This is a Firestore permission error');
      }
      state = state.copyWith(
        loading: false,
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
      state = state.copyWith(loading: true, error: null);
      
      await _firebaseService.auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      
      // User data will be loaded automatically by auth state listener
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: _getErrorMessage(e),
      );
      rethrow;
    }
  }

  // Send password reset email
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      state = state.copyWith(loading: true, error: null);
      _logger.info('Sending password reset email to: $email');
      
      await _firebaseService.auth.sendPasswordResetEmail(email: email);
      
      state = state.copyWith(
        loading: false,
        error: null,
      );
      _logger.info('Password reset email sent successfully');
    } catch (e) {
      _logger.severe('Error sending password reset email: $e');
      state = state.copyWith(
        loading: false,
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
      state = state.copyWith(loading: true, error: null);
      
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
        loading: false,
        error: _getErrorMessage(e),
      );
      rethrow;
    }
  }

  // Sign out
  Future<void> signOut() async {
    try {
      state = state.copyWith(loading: true, error: null);
      await _firebaseService.auth.signOut();
      state = const AuthState(user: null, loading: false, error: null);
    } catch (e) {
      state = state.copyWith(
        loading: false,
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
    if (error is firebase_auth.FirebaseAuthException) {
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
final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authProvider).user;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isAuthenticated;
});

final authLoadingProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).loading;
});

final authErrorProvider = Provider<String?>((ref) {
  return ref.watch(authProvider).error;
}); 