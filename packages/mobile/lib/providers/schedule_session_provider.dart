import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import '../firebase/firebase_service.dart';
import '../utils/logger.dart';
import 'auth_provider.dart';
import 'location_provider.dart';
import 'jobsites_provider.dart';
import '../models/schedule_session.dart';

// ============================================================================
// SCHEDULE SESSION STATE MANAGEMENT
// ============================================================================

/// Enhanced state for automatic schedule-driven time tracking
class ScheduleSessionState {
  final ScheduleSession? currentSession;
  final List<ScheduleSession> todaySessions;
  final List<ScheduleSession> recentSessions;
  final List<ScheduleSession> upcomingSessions;
  final bool isLoading;
  final String? error;
  final bool isProcessingAction;
  final bool hasLocationPermission;
  final bool isBackgroundTrackingActive;
  final Map<String, dynamic>? realtimeUpdates;

  const ScheduleSessionState({
    this.currentSession,
    this.todaySessions = const [],
    this.recentSessions = const [],
    this.upcomingSessions = const [],
    this.isLoading = false,
    this.error,
    this.isProcessingAction = false,
    this.hasLocationPermission = false,
    this.isBackgroundTrackingActive = false,
    this.realtimeUpdates,
  });

  ScheduleSessionState copyWith({
    ScheduleSession? currentSession,
    List<ScheduleSession>? todaySessions,
    List<ScheduleSession>? recentSessions,
    List<ScheduleSession>? upcomingSessions,
    bool? isLoading,
    String? error,
    bool? isProcessingAction,
    bool? hasLocationPermission,
    bool? isBackgroundTrackingActive,
    Map<String, dynamic>? realtimeUpdates,
  }) {
    return ScheduleSessionState(
      currentSession: currentSession ?? this.currentSession,
      todaySessions: todaySessions ?? this.todaySessions,
      recentSessions: recentSessions ?? this.recentSessions,
      upcomingSessions: upcomingSessions ?? this.upcomingSessions,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      isProcessingAction: isProcessingAction ?? this.isProcessingAction,
      hasLocationPermission: hasLocationPermission ?? this.hasLocationPermission,
      isBackgroundTrackingActive: isBackgroundTrackingActive ?? this.isBackgroundTrackingActive,
      realtimeUpdates: realtimeUpdates ?? this.realtimeUpdates,
    );
  }

  // Convenience getters
  bool get hasActiveSession => currentSession?.isActive ?? false;
  bool get isClockedIn => currentSession?.clockedIn ?? false;
  bool get isOnBreak => currentSession?.currentlyOnBreak ?? false;
  bool get isInOvertime => currentSession?.isInOvertime ?? false;
  bool get needsAttention => currentSession?.needsAttention ?? false;
  
  String get currentStatusText => currentSession?.statusText ?? 'No Active Session';
  String get currentStatusColor => currentSession?.statusColor ?? 'gray';
  
  Duration get currentWorkDuration => currentSession?.currentWorkDuration ?? Duration.zero;
  bool get isLate => currentSession?.isLate ?? false;
}

// ============================================================================
// SCHEDULE SESSION PROVIDER
// ============================================================================

class ScheduleSessionNotifier extends StateNotifier<ScheduleSessionState> {
  ScheduleSessionNotifier(this._ref) : super(const ScheduleSessionState()) {
    _initialize();
  }

  final Ref _ref;
  final FirebaseService _firebaseService = FirebaseService.instance;
  
  // Real-time listeners
  StreamSubscription<QuerySnapshot>? _sessionsListener;
  StreamSubscription<DocumentSnapshot>? _currentSessionListener;
  StreamSubscription<Position>? _locationListener;
  
  // Background tracking
  Timer? _backgroundLocationTimer;
  Timer? _sessionSyncTimer;
  
  static const Duration _locationUpdateInterval = Duration(seconds: 30);
  static const Duration _sessionSyncInterval = Duration(minutes: 1);

  // ============================================================================
  // INITIALIZATION & LIFECYCLE
  // ============================================================================

  void _initialize() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return;

    try {
      // Check permissions first
      await _checkLocationPermissions();
      
      // Load employee notification settings
      await _loadNotificationSettings();
      
      // Set up real-time listeners
      await _setupRealtimeListeners();
      
      // Load initial data
      await _loadInitialSessions();
      
      // Start background services if user has consented
      await _startBackgroundServicesIfConsented();
      
    } catch (error) {
      log.severe('Failed to initialize ScheduleSessionProvider: $error');
      state = state.copyWith(error: 'Failed to initialize tracking system');
    }
  }

  @override
  void dispose() {
    _cleanup();
    super.dispose();
  }

  void _cleanup() {
    _sessionsListener?.cancel();
    _currentSessionListener?.cancel();
    _locationListener?.cancel();
    _backgroundLocationTimer?.cancel();
    _sessionSyncTimer?.cancel();
  }

  // ============================================================================
  // PERMISSIONS & CONSENT MANAGEMENT
  // ============================================================================

  Future<void> _checkLocationPermissions() async {
    try {
      final permission = await Geolocator.checkPermission();
      final hasPermission = permission == LocationPermission.always || 
                           permission == LocationPermission.whileInUse;
      
      state = state.copyWith(hasLocationPermission: hasPermission);
      
      if (!hasPermission) {
        await _requestLocationPermissions();
      }
    } catch (error) {
      log.severe('Error checking location permissions: $error');
    }
  }

  Future<void> _requestLocationPermissions() async {
    try {
      final permission = await Geolocator.requestPermission();
      final hasPermission = permission == LocationPermission.always || 
                           permission == LocationPermission.whileInUse;
      
      state = state.copyWith(hasLocationPermission: hasPermission);
      
      if (!hasPermission) {
        state = state.copyWith(
          error: 'Location permission required for automatic time tracking'
        );
      }
    } catch (error) {
      log.severe('Error requesting location permissions: $error');
      state = state.copyWith(
        error: 'Failed to request location permissions'
      );
    }
  }

  Future<void> _loadNotificationSettings() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return;

    try {
      final settingsDoc = await _firebaseService.firestore
          .collection('employeeNotificationSettings')
          .doc(user!.id)
          .get();

      if (!settingsDoc.exists) {
        // Create default settings
        await _createDefaultNotificationSettings(user.id);
      }
    } catch (error) {
      log.warning('Could not load notification settings: $error');
    }
  }

  Future<void> _createDefaultNotificationSettings(String userId) async {
    final defaultSettings = EmployeeNotificationSettings(
      autoTrackingEnabled: false, // Require explicit consent
      notifyOnSessionStart: true,
      notifyOnAutoClockIn: true,
      notifyOnAutoClockOut: true,
      notifyOnBreakDetection: true,
      notifyOnScheduleChange: true,
      notifyOnOvertimeStart: true,
      consentGiven: false,
      consentDate: DateTime.now(),
      consentVersion: '1.0',
    );

    await _firebaseService.firestore
        .collection('employeeNotificationSettings')
        .doc(userId)
        .set(defaultSettings.toJson());
  }

  // ============================================================================
  // REAL-TIME LISTENERS
  // ============================================================================

  Future<void> _setupRealtimeListeners() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return;

    // Listen to all sessions for this employee
    _sessionsListener = _firebaseService.firestore
        .collection('scheduleSessions')
        .where('employeeId', isEqualTo: user!.id)
        .orderBy('scheduledStartTime', descending: true)
        .snapshots()
        .listen(
          _handleSessionsUpdate,
          onError: (error) {
            log.severe('Sessions listener error: $error');
            state = state.copyWith(error: 'Real-time sync failed');
          },
        );
  }

  void _handleSessionsUpdate(QuerySnapshot snapshot) {
    try {
      final sessions = snapshot.docs
          .map((doc) => ScheduleSession.fromFirestore(doc))
          .toList();

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final tomorrow = today.add(const Duration(days: 1));

      // Categorize sessions
      final todaySessions = sessions.where((s) {
        final sessionDate = DateTime(
          s.scheduledStartTime.year,
          s.scheduledStartTime.month,
          s.scheduledStartTime.day,
        );
        return sessionDate == today;
      }).toList();

      final upcomingSessions = sessions.where((s) {
        return s.scheduledStartTime.isAfter(now) && 
               s.scheduledStartTime.isBefore(tomorrow.add(const Duration(days: 7)));
      }).toList();

      final recentSessions = sessions.where((s) {
        return s.scheduledStartTime.isBefore(now) && 
               s.scheduledStartTime.isAfter(today.subtract(const Duration(days: 7)));
      }).toList();

      // Find current active session
      final activeSessions = sessions.where((s) => s.isActive);
      final currentSession = activeSessions.isNotEmpty ? activeSessions.first : null;

      state = state.copyWith(
        currentSession: currentSession,
        todaySessions: todaySessions,
        upcomingSessions: upcomingSessions,
        recentSessions: recentSessions,
        isLoading: false,
      );

      // Start/stop background tracking based on active session
      _updateBackgroundTracking();

    } catch (error) {
      log.severe('Error processing sessions update: $error');
      state = state.copyWith(
        error: 'Failed to process session updates',
        isLoading: false,
      );
    }
  }

  // ============================================================================
  // BACKGROUND TRACKING MANAGEMENT
  // ============================================================================

  Future<void> _startBackgroundServicesIfConsented() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return;

    try {
      final settingsDoc = await _firebaseService.firestore
          .collection('employeeNotificationSettings')
          .doc(user!.id)
          .get();

      if (settingsDoc.exists) {
        final settings = EmployeeNotificationSettings.fromJson(settingsDoc.data()!);
        
        if (settings.consentGiven && settings.autoTrackingEnabled) {
          await _startBackgroundTracking();
        }
      }
    } catch (error) {
      log.warning('Could not check consent status: $error');
    }
  }

  Future<void> _startBackgroundTracking() async {
    if (!state.hasLocationPermission) {
      await _checkLocationPermissions();
      if (!state.hasLocationPermission) return;
    }

    // Start location monitoring
    _backgroundLocationTimer = Timer.periodic(_locationUpdateInterval, (_) {
      _updateLocationInBackground();
    });

    // Start session sync
    _sessionSyncTimer = Timer.periodic(_sessionSyncInterval, (_) {
      _syncSessionStatus();
    });

    state = state.copyWith(isBackgroundTrackingActive: true);
    log.info('Background tracking started');
  }

  void _stopBackgroundTracking() {
    _backgroundLocationTimer?.cancel();
    _sessionSyncTimer?.cancel();
    _locationListener?.cancel();
    
    state = state.copyWith(isBackgroundTrackingActive: false);
    log.info('Background tracking stopped');
  }

  void _updateBackgroundTracking() {
    final hasActiveSession = state.hasActiveSession;
    final isTrackingActive = state.isBackgroundTrackingActive;

    if (hasActiveSession && !isTrackingActive) {
      _startBackgroundTracking();
    } else if (!hasActiveSession && isTrackingActive) {
      _stopBackgroundTracking();
    }
  }

  // ============================================================================
  // LOCATION TRACKING
  // ============================================================================

  Future<void> _updateLocationInBackground() async {
    if (!state.hasActiveSession || !state.hasLocationPermission) return;

    try {
      final position = await _ref.read(locationProvider.notifier).getCurrentLocation();
      if (position == null) return;

      // Create heartbeat entry in timeEntries for Cloud Function processing
      await _createLocationHeartbeat(position);

    } catch (error) {
      log.warning('Background location update failed: $error');
    }
  }

  Future<void> _createLocationHeartbeat(Position position) async {
    final user = _ref.read(currentUserProvider);
    final currentSession = state.currentSession;
    
    if (user == null || currentSession == null) return;

    try {
      // Create heartbeat entry compatible with existing Cloud Function
      final heartbeatData = {
        'employeeId': user.id,
        'companyId': user.companyId,
        'jobSiteId': currentSession.jobSiteId,
        'jobSiteName': currentSession.jobSiteName,
        'status': _getTimeEntryStatus(),
        'timestamp': Timestamp.fromDate(DateTime.now()),
        'location': {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
        },
        'distanceFromJobSite': 0, // Will be calculated by Cloud Function
        'metadata': {
          'accuracy': position.accuracy,
          'sessionId': currentSession.id,
          'isHeartbeat': true,
          'source': 'schedule_session_provider',
        },
      };

      await _firebaseService.firestore
          .collection('timeEntries')
          .add(heartbeatData);

    } catch (error) {
      log.severe('Failed to create location heartbeat: $error');
    }
  }

  String _getTimeEntryStatus() {
    if (state.isOnBreak) return 'onBreak';
    if (state.isClockedIn) return 'clockedIn';
    return 'monitoring'; // Custom status for background monitoring
  }

  // ============================================================================
  // SESSION SYNCHRONIZATION
  // ============================================================================

  Future<void> _syncSessionStatus() async {
    if (!state.hasActiveSession) return;

    try {
      // Refresh current session from Firestore
      final sessionDoc = await _firebaseService.firestore
          .collection('scheduleSessions')
          .doc(state.currentSession!.id)
          .get();

      if (sessionDoc.exists) {
        final updatedSession = ScheduleSession.fromFirestore(sessionDoc);
        
        state = state.copyWith(
          currentSession: updatedSession,
          realtimeUpdates: {
            'lastSync': DateTime.now().toIso8601String(),
            'status': updatedSession.status,
          },
        );
      }
    } catch (error) {
      log.warning('Session sync failed: $error');
    }
  }

  // ============================================================================
  // EMPLOYEE ACTIONS & INTERACTIONS
  // ============================================================================

  /// Enable automatic tracking (requires employee consent)
  Future<bool> enableAutoTracking() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return false;

    try {
      state = state.copyWith(isProcessingAction: true, error: null);

      // Check location permissions
      if (!state.hasLocationPermission) {
        await _requestLocationPermissions();
        if (!state.hasLocationPermission) {
          state = state.copyWith(
            isProcessingAction: false,
            error: 'Location permission required for auto tracking'
          );
          return false;
        }
      }

      // Update notification settings with consent
      final consentSettings = EmployeeNotificationSettings(
        autoTrackingEnabled: true,
        notifyOnSessionStart: true,
        notifyOnAutoClockIn: true,
        notifyOnAutoClockOut: true,
        notifyOnBreakDetection: true,
        notifyOnScheduleChange: true,
        notifyOnOvertimeStart: true,
        consentGiven: true,
        consentDate: DateTime.now(),
        consentVersion: '1.0',
      );

      await _firebaseService.firestore
          .collection('employeeNotificationSettings')
          .doc(user!.id)
          .set(consentSettings.toJson());

      // Start background tracking
      await _startBackgroundTracking();

      state = state.copyWith(isProcessingAction: false);
      return true;

    } catch (error) {
      log.severe('Failed to enable auto tracking: $error');
      state = state.copyWith(
        isProcessingAction: false,
        error: 'Failed to enable automatic tracking'
      );
      return false;
    }
  }

  /// Disable automatic tracking
  Future<bool> disableAutoTracking() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return false;

    try {
      state = state.copyWith(isProcessingAction: true, error: null);

      // Update settings to disable auto tracking
      await _firebaseService.firestore
          .collection('employeeNotificationSettings')
          .doc(user!.id)
          .update({
            'autoTrackingEnabled': false,
            'consentGiven': false,
          });

      // Stop background tracking
      _stopBackgroundTracking();

      state = state.copyWith(isProcessingAction: false);
      return true;

    } catch (error) {
      log.severe('Failed to disable auto tracking: $error');
      state = state.copyWith(
        isProcessingAction: false,
        error: 'Failed to disable automatic tracking'
      );
      return false;
    }
  }

  /// Manual clock-in (for when auto clock-in didn't work)
  Future<bool> manualClockIn() async {
    final currentSession = state.currentSession;
    if (currentSession == null || currentSession.clockedIn) return false;

    try {
      state = state.copyWith(isProcessingAction: true, error: null);

      final position = await _ref.read(locationProvider.notifier).getCurrentLocation();
      if (position == null) {
        state = state.copyWith(
          isProcessingAction: false,
          error: 'Could not get current location'
        );
        return false;
      }

      // Validate geofence
      final jobSite = _ref.read(jobSitesProvider.notifier).getAssignedJobSiteById(currentSession.jobSiteId);
      if (jobSite == null) {
        state = state.copyWith(
          isProcessingAction: false,
          error: 'Job site not found'
        );
        return false;
      }

      final distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        jobSite.location.latitude,
        jobSite.location.longitude,
      );

      if (distance > jobSite.radius) {
        state = state.copyWith(
          isProcessingAction: false,
          error: 'You are ${distance.toInt()}m away from ${jobSite.siteName}. You must be within ${jobSite.radius.toInt()}m to clock in.',
        );
        return false;
      }

      // Update session with manual clock-in
      await _firebaseService.firestore
          .collection('scheduleSessions')
          .doc(currentSession.id)
          .update({
            'clockedIn': true,
            'clockInTime': Timestamp.fromDate(DateTime.now()),
            'status': 'clocked_in',
            'updatedAt': Timestamp.fromDate(DateTime.now()),
            'lastModifiedBy': 'employee_manual',
            'events': FieldValue.arrayUnion([
              {
                'id': _generateId(),
                'timestamp': Timestamp.fromDate(DateTime.now()),
                'eventType': 'manual_clock_in',
                'triggeredBy': 'employee',
                'details': 'Employee manually clocked in',
                'location': {
                  'latitude': position.latitude,
                  'longitude': position.longitude,
                  'accuracy': position.accuracy,
                },
                'metadata': {
                  'distanceFromJobSite': distance,
                  'accuracy': position.accuracy,
                },
              }
            ]),
          });

      state = state.copyWith(isProcessingAction: false);
      return true;

    } catch (error) {
      log.severe('Manual clock-in failed: $error');
      state = state.copyWith(
        isProcessingAction: false,
        error: 'Failed to clock in: $error'
      );
      return false;
    }
  }

  /// Manual clock-out
  Future<bool> manualClockOut() async {
    final currentSession = state.currentSession;
    if (currentSession == null || !currentSession.clockedIn) return false;

    try {
      state = state.copyWith(isProcessingAction: true, error: null);

      final position = await _ref.read(locationProvider.notifier).getCurrentLocation();
      final now = DateTime.now();

      // Update session with manual clock-out
      await _firebaseService.firestore
          .collection('scheduleSessions')
          .doc(currentSession.id)
          .update({
            'clockedIn': false,
            'clockOutTime': Timestamp.fromDate(now),
            'status': 'clocked_out',
            'updatedAt': Timestamp.fromDate(now),
            'lastModifiedBy': 'employee_manual',
            'events': FieldValue.arrayUnion([
              {
                'id': _generateId(),
                'timestamp': Timestamp.fromDate(now),
                'eventType': 'manual_clock_out',
                'triggeredBy': 'employee',
                'details': 'Employee manually clocked out',
                'location': position != null ? {
                  'latitude': position.latitude,
                  'longitude': position.longitude,
                  'accuracy': position.accuracy,
                } : null,
              }
            ]),
          });

      state = state.copyWith(isProcessingAction: false);
      return true;

    } catch (error) {
      log.severe('Manual clock-out failed: $error');
      state = state.copyWith(
        isProcessingAction: false,
        error: 'Failed to clock out: $error'
      );
      return false;
    }
  }

  /// Manual break start
  Future<bool> startBreak() async {
    final currentSession = state.currentSession;
    if (currentSession == null || !currentSession.clockedIn || currentSession.currentlyOnBreak) {
      return false;
    }

    try {
      state = state.copyWith(isProcessingAction: true, error: null);

      final position = await _ref.read(locationProvider.notifier).getCurrentLocation();
      final now = DateTime.now();

      final breakPeriod = {
        'id': _generateId(),
        'startTime': Timestamp.fromDate(now),
        'endTime': null,
        'type': 'manual',
        'triggeredBy': 'employee',
        'location': position != null ? {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
        } : null,
        'duration': null,
      };

      await _firebaseService.firestore
          .collection('scheduleSessions')
          .doc(currentSession.id)
          .update({
            'currentlyOnBreak': true,
            'status': 'on_break',
            'breakPeriods': FieldValue.arrayUnion([breakPeriod]),
            'updatedAt': Timestamp.fromDate(now),
            'lastModifiedBy': 'employee_manual',
            'events': FieldValue.arrayUnion([
              {
                'id': _generateId(),
                'timestamp': Timestamp.fromDate(now),
                'eventType': 'break_started',
                'triggeredBy': 'employee',
                'details': 'Employee started break manually',
                'location': position != null ? {
                  'latitude': position.latitude,
                  'longitude': position.longitude,
                  'accuracy': position.accuracy,
                } : null,
              }
            ]),
          });

      state = state.copyWith(isProcessingAction: false);
      return true;

    } catch (error) {
      log.severe('Start break failed: $error');
      state = state.copyWith(
        isProcessingAction: false,
        error: 'Failed to start break: $error'
      );
      return false;
    }
  }

  /// Manual break end
  Future<bool> endBreak() async {
    final currentSession = state.currentSession;
    if (currentSession == null || !currentSession.currentlyOnBreak) return false;

    try {
      state = state.copyWith(isProcessingAction: true, error: null);

      final position = await _ref.read(locationProvider.notifier).getCurrentLocation();
      final now = DateTime.now();

      // Find current break period and update it
      final updatedBreakPeriods = currentSession.breakPeriods.map((bp) {
        if (bp.endTime == null) {
          final duration = (now.millisecondsSinceEpoch - bp.startTime.millisecondsSinceEpoch) ~/ 60000;
          return bp.copyWith(
            endTime: now,
            duration: duration,
          );
        }
        return bp;
      }).toList();

      await _firebaseService.firestore
          .collection('scheduleSessions')
          .doc(currentSession.id)
          .update({
            'currentlyOnBreak': false,
            'status': 'clocked_in',
            'breakPeriods': updatedBreakPeriods.map((bp) => bp.toJson()).toList(),
            'updatedAt': Timestamp.fromDate(now),
            'lastModifiedBy': 'employee_manual',
            'events': FieldValue.arrayUnion([
              {
                'id': _generateId(),
                'timestamp': Timestamp.fromDate(now),
                'eventType': 'break_ended',
                'triggeredBy': 'employee',
                'details': 'Employee ended break manually',
                'location': position != null ? {
                  'latitude': position.latitude,
                  'longitude': position.longitude,
                  'accuracy': position.accuracy,
                } : null,
              }
            ]),
          });

      state = state.copyWith(isProcessingAction: false);
      return true;

    } catch (error) {
      log.severe('End break failed: $error');
      state = state.copyWith(
        isProcessingAction: false,
        error: 'Failed to end break: $error'
      );
      return false;
    }
  }

  // ============================================================================
  // DATA LOADING METHODS
  // ============================================================================

  Future<void> _loadInitialSessions() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return;

    try {
      state = state.copyWith(isLoading: true, error: null);

      final sessionsSnapshot = await _firebaseService.firestore
          .collection('scheduleSessions')
          .where('employeeId', isEqualTo: user!.id)
          .orderBy('scheduledStartTime', descending: true)
          .limit(50)
          .get();

      _handleSessionsUpdate(sessionsSnapshot);

    } catch (error) {
      log.severe('Failed to load initial sessions: $error');
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load schedule sessions'
      );
    }
  }

  /// Refresh all session data
  Future<void> refresh() async {
    await _loadInitialSessions();
    await _syncSessionStatus();
  }

  /// Clear error state
  void clearError() {
    state = state.copyWith(error: null);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  String _generateId() {
    return DateTime.now().millisecondsSinceEpoch.toString() + 
           (DateTime.now().microsecond % 1000).toString();
  }
}

// ============================================================================
// PROVIDER DEFINITION
// ============================================================================

final scheduleSessionProvider = StateNotifierProvider<ScheduleSessionNotifier, ScheduleSessionState>((ref) {
  return ScheduleSessionNotifier(ref);
}); 