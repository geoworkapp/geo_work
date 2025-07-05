import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:logging/logging.dart';
import '../firebase_options.dart';

class FirebaseService {
  static FirebaseService? _instance;
  static FirebaseService get instance => _instance ??= FirebaseService._internal();
  
  FirebaseService._internal();

  // Firebase instances
  late FirebaseApp _app;
  late FirebaseAuth _auth;
  late FirebaseFirestore _firestore;
  final _logger = Logger('FirebaseService');

  // Getters
  FirebaseApp get app => _app;
  FirebaseAuth get auth => _auth;
  FirebaseFirestore get firestore => _firestore;

  /// Initialize Firebase services
  Future<void> initialize() async {
    try {
      _app = await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      _auth = FirebaseAuth.instance;
      _firestore = FirebaseFirestore.instance;
      
      // 🛠️ Connect to emulators in debug mode (optional)
      // Uncomment these lines if you want to use Firebase emulators
      // if (kDebugMode) {
      //   await _auth.useAuthEmulator('localhost', 9099);
      //   _firestore.useFirestoreEmulator('localhost', 8080);
      // }
      
      _logger.info('Firebase initialized successfully');
    } catch (e) {
      _logger.severe('Firebase initialization failed: $e');
      rethrow;
    }
  }

  /// Get current user
  User? get currentUser => _auth.currentUser;

  /// Check if user is signed in
  bool get isSignedIn => currentUser != null;

  /// Stream of auth state changes
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  // Sign in with email and password
  Future<UserCredential> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      final result = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      _logger.info('User signed in: ${result.user?.email}');
      return result;
    } on FirebaseAuthException catch (e) {
      _logger.severe('Sign in error: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    }
  }
  
  // Create user with email and password
  Future<UserCredential> createUserWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      final result = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      _logger.info('User created: ${result.user?.email}');
      return result;
    } on FirebaseAuthException catch (e) {
      _logger.severe('Sign up error: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    }
  }
  
  // Sign out
  Future<void> signOut() async {
    try {
      await _auth.signOut();
      _logger.info('User signed out');
    } catch (e) {
      _logger.severe('Sign out error: $e');
      rethrow;
    }
  }
  
  // Handle Firebase Auth exceptions
  String _handleAuthException(FirebaseAuthException e) {
    switch (e.code) {
      case 'user-not-found':
        return 'No user found with this email address.';
      case 'wrong-password':
        return 'Incorrect password. Please try again.';
      case 'email-already-in-use':
        return 'This email address is already registered.';
      case 'weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'invalid-email':
        return 'Please enter a valid email address.';
      case 'too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return 'Authentication failed: ${e.message}';
    }
  }
} 