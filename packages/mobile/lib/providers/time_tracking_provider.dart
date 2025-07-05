import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart';
// import 'package:shared/models.dart'; 
import '../firebase/firebase_service.dart';
import '../utils/logger.dart';
import 'auth_provider.dart';
import 'location_provider.dart';
import 'jobsites_provider.dart';

// Time entry status enum for backward compatibility
enum TimeEntryStatus {
  clockedIn,
  clockedOut,
  onBreak,
  breakEnded,
}

// Time entry model - temporary local definition
class TimeEntry {
  final String entryId;
  final String employeeId;
  final String companyId;
  final String jobSiteId;
  final String jobSiteName;
  final TimeEntryStatus status;
  final DateTime timestamp;
  final Position location;
  final double distanceFromJobSite;
  final Map<String, dynamic>? metadata;

  TimeEntry({
    required this.entryId,
    required this.employeeId,
    required this.companyId,
    required this.jobSiteId,
    required this.jobSiteName,
    required this.status,
    required this.timestamp,
    required this.location,
    required this.distanceFromJobSite,
    this.metadata,
  });

  Map<String, dynamic> toMap() {
    return {
      'employeeId': employeeId,
      'companyId': companyId,
      'jobSiteId': jobSiteId,
      'jobSiteName': jobSiteName,
      'status': status.name,
      'timestamp': Timestamp.fromDate(timestamp),
      'location': {
        'latitude': location.latitude,
        'longitude': location.longitude,
        'accuracy': location.accuracy,
      },
      'distanceFromJobSite': distanceFromJobSite,
      'metadata': metadata,
    };
  }
}

// Current shift information
class CurrentShift {
  final String shiftId;
  final String jobSiteId;
  final String jobSiteName;
  final DateTime startTime;
  final Duration workDuration;
  final Duration breakDuration;
  final TimeEntryStatus currentStatus;
  final bool isOnBreak;

  CurrentShift({
    required this.shiftId,
    required this.jobSiteId,
    required this.jobSiteName,
    required this.startTime,
    required this.workDuration,
    required this.breakDuration,
    required this.currentStatus,
    required this.isOnBreak,
  });
}

// Time tracking state
class TimeTrackingState {
  final CurrentShift? currentShift;
  final List<TimeEntry> todayEntries;
  final List<TimeEntry> recentEntries;
  final bool isLoading;
  final String? error;
  final bool isProcessingEntry;

  const TimeTrackingState({
    this.currentShift,
    this.todayEntries = const [],
    this.recentEntries = const [],
    this.isLoading = false,
    this.error,
    this.isProcessingEntry = false,
  });

  TimeTrackingState copyWith({
    CurrentShift? currentShift,
    List<TimeEntry>? todayEntries,
    List<TimeEntry>? recentEntries,
    bool? isLoading,
    String? error,
    bool? isProcessingEntry,
  }) {
    return TimeTrackingState(
      currentShift: currentShift ?? this.currentShift,
      todayEntries: todayEntries ?? this.todayEntries,
      recentEntries: recentEntries ?? this.recentEntries,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      isProcessingEntry: isProcessingEntry ?? this.isProcessingEntry,
    );
  }

  bool get isClockedIn => currentShift != null;
  bool get canClockOut => isClockedIn && !isProcessingEntry && currentShift?.currentStatus != TimeEntryStatus.clockedOut;
  bool get canTakeBreak => isClockedIn && !currentShift!.isOnBreak;
  bool get canEndBreak => isClockedIn && currentShift!.isOnBreak;
}

// Time tracking notifier
class TimeTrackingNotifier extends StateNotifier<TimeTrackingState> {
  TimeTrackingNotifier(this._ref) : super(const TimeTrackingState()) {
    _initialize();
  }

  final Ref _ref;
  final FirebaseService _firebaseService = FirebaseService.instance;

  // Initialize time tracking
  void _initialize() {
    final user = _ref.read(currentUserProvider);
    if (user != null) {
      loadTodayEntries();
      loadCurrentShift();
    }
  }

  // Load today's time entries using shared TimeEntry model
  Future<void> loadTodayEntries() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return;

    try {
      state = state.copyWith(isLoading: true, error: null);

      final today = DateTime.now();
      final startOfDay = DateTime(today.year, today.month, today.day);
      final endOfDay = startOfDay.add(const Duration(days: 1));

      final querySnapshot = await _firebaseService.firestore
          .collection('timeEntries')
          .where('employeeId', isEqualTo: user!.id)
          .where('timestamp', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfDay))
          .where('timestamp', isLessThan: Timestamp.fromDate(endOfDay))
          .orderBy('timestamp', descending: true)
          .get();

      final entries = querySnapshot.docs
          .map((doc) => _timeEntryFromFirestore(doc))
          .toList();

      state = state.copyWith(
        todayEntries: entries,
        isLoading: false,
      );
    } catch (e) {
      // Log error - removed AppLogger import
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load today\'s entries: $e',
      );
    }
  }

  // Convert Firestore document to TimeEntry using local model
  TimeEntry _timeEntryFromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final locationData = data['location'] as Map<String, dynamic>? ?? {};
    
    return TimeEntry(
      entryId: doc.id,
      employeeId: data['employeeId'] ?? data['userId'] ?? '', // Support new field name
      companyId: data['companyId'] ?? '',
      jobSiteId: data['jobSiteId'] ?? data['siteId'] ?? '', // Support both field names
      jobSiteName: data['jobSiteName'] ?? '',
      status: _parseStatus(data['status']),
      timestamp: (data['timestamp'] as Timestamp).toDate(),
      location: Position(
        latitude: locationData['latitude'] ?? 0.0,
        longitude: locationData['longitude'] ?? 0.0,
        timestamp: (data['timestamp'] as Timestamp).toDate(),
        accuracy: locationData['accuracy'] ?? 0.0,
        altitude: locationData['altitude'] ?? 0.0,
        altitudeAccuracy: locationData['altitudeAccuracy'] ?? 0.0,
        heading: locationData['heading'] ?? 0.0,
        headingAccuracy: locationData['headingAccuracy'] ?? 0.0,
        speed: locationData['speed'] ?? 0.0,
        speedAccuracy: locationData['speedAccuracy'] ?? 0.0,
        isMocked: locationData['isMocked'] ?? false,
      ),
      distanceFromJobSite: (data['distanceFromJobSite'] ?? 0.0).toDouble(),
      metadata: data['metadata'],
    );
  }

  TimeEntryStatus _parseStatus(String? status) {
    switch (status) {
      case 'clockedIn':
        return TimeEntryStatus.clockedIn;
      case 'clockedOut':
        return TimeEntryStatus.clockedOut;
      case 'onBreak':
        return TimeEntryStatus.onBreak;
      case 'breakEnded':
        return TimeEntryStatus.breakEnded;
      default:
        return TimeEntryStatus.clockedOut;
    }
  }

  // Load current shift information
  Future<void> loadCurrentShift() async {
    final entries = state.todayEntries;
    if (entries.isEmpty) {
      state = state.copyWith(currentShift: null);
      return;
    }

    // Check the most recent entry to determine current status
    final latestEntry = entries.first; // entries are ordered descending (newest first)
    
    // If the most recent entry is a clock-out, user is not currently clocked in
    if (latestEntry.status == TimeEntryStatus.clockedOut) {
      state = state.copyWith(currentShift: null);
      return;
    }

    // Find the most recent clock-in entry
    TimeEntry? lastClockIn;
    for (final entry in entries) {
      if (entry.status == TimeEntryStatus.clockedIn) {
        lastClockIn = entry;
        break;
      }
    }

    // If no clock-in found, no active shift
    if (lastClockIn == null) {
      state = state.copyWith(currentShift: null);
      return;
    }

    // Check if there's a clock-out after this clock-in
    bool hasClockOutAfter = false;
    for (final entry in entries) {
      if (entry.timestamp.isAfter(lastClockIn.timestamp) && 
          entry.status == TimeEntryStatus.clockedOut) {
        hasClockOutAfter = true;
        break;
      }
    }

    if (hasClockOutAfter) {
      state = state.copyWith(currentShift: null);
      return;
    }

    // Calculate work and break durations
    final now = DateTime.now();
    final workDuration = _calculateWorkDuration(entries, lastClockIn.timestamp, now);
    final breakDuration = _calculateBreakDuration(entries, lastClockIn.timestamp, now);
    
    // Check if currently on break
    final isOnBreak = _isCurrentlyOnBreak(entries);

    final currentShift = CurrentShift(
      shiftId: lastClockIn.entryId,
      jobSiteId: lastClockIn.jobSiteId,
      jobSiteName: lastClockIn.jobSiteName,
      startTime: lastClockIn.timestamp,
      workDuration: workDuration,
      breakDuration: breakDuration,
      currentStatus: latestEntry.status,
      isOnBreak: isOnBreak,
    );

    state = state.copyWith(currentShift: currentShift);
  }

  // Clock in at a job site
  Future<bool> clockIn(String jobSiteId) async {
    final user = _ref.read(currentUserProvider);
    final jobSite = _ref.read(jobSitesProvider.notifier).getAssignedJobSiteById(jobSiteId);
    final position = await _ref.read(locationProvider.notifier).getCurrentLocation();

    if (user == null || jobSite == null || position == null) {
      state = state.copyWith(error: 'Unable to clock in: missing required data');
      return false;
    }

    try {
      state = state.copyWith(isProcessingEntry: true, error: null);

      // Validate geofence
      final distance = Geolocator.distanceBetween(
        position.latitude,
        position.longitude,
        jobSite.location.latitude,
        jobSite.location.longitude,
      );

      if (distance > jobSite.radius) {
        state = state.copyWith(
          isProcessingEntry: false,
          error: 'You are ${distance.toInt()}m away from ${jobSite.siteName}. You must be within ${jobSite.radius.toInt()}m to clock in.',
        );
        return false;
      }

      // Create time entry
      final timeEntry = TimeEntry(
        entryId: '',
        employeeId: user.id,
        companyId: user.companyId!,
        jobSiteId: jobSiteId,
        jobSiteName: jobSite.siteName,
        status: TimeEntryStatus.clockedIn,
        timestamp: DateTime.now(),
        location: position,
        distanceFromJobSite: distance,
        metadata: {
          'accuracy': position.accuracy,
          'clockInType': 'manual',
        },
      );

      // Save to Firestore
      final docRef = await _firebaseService.firestore
          .collection('timeEntries')
          .add(timeEntry.toMap());

      // Create current shift
      final currentShift = CurrentShift(
        shiftId: docRef.id,
        jobSiteId: jobSiteId,
        jobSiteName: jobSite.siteName,
        startTime: timeEntry.timestamp,
        workDuration: Duration.zero,
        breakDuration: Duration.zero,
        currentStatus: TimeEntryStatus.clockedIn,
        isOnBreak: false,
      );

      // Update state with new entry
      final updatedEntries = [timeEntry, ...state.todayEntries];
      state = state.copyWith(
        currentShift: currentShift,
        todayEntries: updatedEntries,
        isProcessingEntry: false,
      );

      return true;
    } catch (e) {
      state = state.copyWith(
        isProcessingEntry: false,
        error: 'Failed to clock in: $e',
      );
      return false;
    }
  }

  // Clock out
  Future<bool> clockOut() async {
    log.info('Clock out started - Current state: ${state.isClockedIn}');
    
    // Prevent multiple clock outs
    if (!state.canClockOut) {
      log.warning('Cannot clock out - canClockOut: false');
      return false;
    }

    final user = _ref.read(currentUserProvider);
    final currentShift = state.currentShift;
    final position = await _ref.read(locationProvider.notifier).getCurrentLocation();

    if (user == null || currentShift == null || position == null) {
      state = state.copyWith(error: 'Unable to clock out: missing required data');
      log.warning('Clock out failed - Missing data');
      return false;
    }

    try {
      // Set processing flag first
      state = state.copyWith(isProcessingEntry: true, error: null);
      log.info('Processing clock out - Setting processing flag');

      // Get job site for validation
      final jobSite = _ref.read(jobSitesProvider.notifier).getAssignedJobSiteById(currentShift.jobSiteId);
      
      double distance = 0;
      if (jobSite != null) {
        distance = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          jobSite.location.latitude,
          jobSite.location.longitude,
        );
      }

      // Create time entry
      final timeEntry = TimeEntry(
        entryId: '',
        employeeId: user.id,
        companyId: user.companyId!,
        jobSiteId: currentShift.jobSiteId,
        jobSiteName: currentShift.jobSiteName,
        status: TimeEntryStatus.clockedOut,
        timestamp: DateTime.now(),
        location: position,
        distanceFromJobSite: distance,
        metadata: {
          'accuracy': position.accuracy,
          'clockOutType': 'manual',
        },
      );

      log.info('Saving clock out entry to Firestore');
      // Save to Firestore
      await _firebaseService.firestore
          .collection('timeEntries')
          .add(timeEntry.toMap());

      // Update state with new entry and clear current shift
      final updatedEntries = [timeEntry, ...state.todayEntries];
      
      log.info('Updating state - Clearing current shift');
      // Important: Set currentShift to null since we're clocked out
      state = TimeTrackingState(
        currentShift: null,
        todayEntries: updatedEntries,
        isProcessingEntry: false,
        recentEntries: state.recentEntries,
      );

      log.info('Clock out complete - New state: isClockedIn=${state.isClockedIn}');
      return true;
    } catch (e) {
      log.severe('Clock out failed - Error: $e');
      state = state.copyWith(
        isProcessingEntry: false,
        error: 'Failed to clock out: $e',
      );
      return false;
    }
  }

  // Start break
  Future<bool> startBreak() async {
    final user = _ref.read(currentUserProvider);
    final currentShift = state.currentShift;
    final position = await _ref.read(locationProvider.notifier).getCurrentLocation();

    if (user == null || currentShift == null || position == null || !state.canTakeBreak) {
      state = state.copyWith(error: 'Unable to start break: invalid state');
      return false;
    }

    try {
      state = state.copyWith(isProcessingEntry: true, error: null);

      // Get job site for distance calculation
      final jobSite = _ref.read(jobSitesProvider.notifier).getAssignedJobSiteById(currentShift.jobSiteId);
      double distance = 0;
      if (jobSite != null) {
        distance = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          jobSite.location.latitude,
          jobSite.location.longitude,
        );
      }

      // Create break start entry
      final timeEntry = TimeEntry(
        entryId: '',
        employeeId: user.id,
        companyId: user.companyId!,
        jobSiteId: currentShift.jobSiteId,
        jobSiteName: currentShift.jobSiteName,
        status: TimeEntryStatus.onBreak,
        timestamp: DateTime.now(),
        location: position,
        distanceFromJobSite: distance,
        metadata: {
          'accuracy': position.accuracy,
          'clockInType': 'manual',
        },
      );

      // Save to Firestore
      await _firebaseService.firestore
          .collection('timeEntries')
          .add(timeEntry.toMap());

      // Update state
      final updatedEntries = [timeEntry, ...state.todayEntries];
      final updatedShift = CurrentShift(
        shiftId: currentShift.shiftId,
        jobSiteId: currentShift.jobSiteId,
        jobSiteName: currentShift.jobSiteName,
        startTime: currentShift.startTime,
        workDuration: currentShift.workDuration,
        breakDuration: currentShift.breakDuration,
        currentStatus: TimeEntryStatus.onBreak,
        isOnBreak: true,
      );

      state = state.copyWith(
        currentShift: updatedShift,
        todayEntries: updatedEntries,
        isProcessingEntry: false,
      );

      return true;
    } catch (e) {
      state = state.copyWith(
        isProcessingEntry: false,
        error: 'Failed to start break: $e',
      );
      return false;
    }
  }

  // End break
  Future<bool> endBreak() async {
    final user = _ref.read(currentUserProvider);
    final currentShift = state.currentShift;
    final position = await _ref.read(locationProvider.notifier).getCurrentLocation();

    if (user == null || currentShift == null || position == null || !state.canEndBreak) {
      state = state.copyWith(error: 'Unable to end break: invalid state');
      return false;
    }

    try {
      state = state.copyWith(isProcessingEntry: true, error: null);

      // Get job site for distance calculation
      final jobSite = _ref.read(jobSitesProvider.notifier).getAssignedJobSiteById(currentShift.jobSiteId);
      double distance = 0;
      if (jobSite != null) {
        distance = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          jobSite.location.latitude,
          jobSite.location.longitude,
        );
      }

      // Create break end entry
      final timeEntry = TimeEntry(
        entryId: '',
        employeeId: user.id,
        companyId: user.companyId!,
        jobSiteId: currentShift.jobSiteId,
        jobSiteName: currentShift.jobSiteName,
        status: TimeEntryStatus.breakEnded,
        timestamp: DateTime.now(),
        location: position,
        distanceFromJobSite: distance,
        metadata: {
          'accuracy': position.accuracy,
          'clockOutType': 'manual',
        },
      );

      // Save to Firestore
      await _firebaseService.firestore
          .collection('timeEntries')
          .add(timeEntry.toMap());

      // Update state
      final updatedEntries = [timeEntry, ...state.todayEntries];
      final updatedShift = CurrentShift(
        shiftId: currentShift.shiftId,
        jobSiteId: currentShift.jobSiteId,
        jobSiteName: currentShift.jobSiteName,
        startTime: currentShift.startTime,
        workDuration: currentShift.workDuration,
        breakDuration: currentShift.breakDuration,
        currentStatus: TimeEntryStatus.breakEnded,
        isOnBreak: false,
      );

      state = state.copyWith(
        currentShift: updatedShift,
        todayEntries: updatedEntries,
        isProcessingEntry: false,
      );

      return true;
    } catch (e) {
      state = state.copyWith(
        isProcessingEntry: false,
        error: 'Failed to end break: $e',
      );
      return false;
    }
  }

  // Calculate work duration excluding breaks
  Duration _calculateWorkDuration(List<TimeEntry> entries, DateTime startTime, DateTime endTime) {
    // Implementation for calculating actual work time excluding breaks
    // This is a simplified version - in production, this would be more complex
    Duration totalWork = endTime.difference(startTime);
    Duration totalBreaks = _calculateBreakDuration(entries, startTime, endTime);
    return totalWork - totalBreaks;
  }

  // Calculate total break duration
  Duration _calculateBreakDuration(List<TimeEntry> entries, DateTime startTime, DateTime endTime) {
    Duration totalBreaks = Duration.zero;
    
    // Find break periods and sum them up
    DateTime? breakStart;
    for (final entry in entries.reversed) {
      if (entry.timestamp.isBefore(startTime)) continue;
      
      if (entry.status == TimeEntryStatus.onBreak) {
        breakStart = entry.timestamp;
      } else if (entry.status == TimeEntryStatus.breakEnded && breakStart != null) {
        totalBreaks += entry.timestamp.difference(breakStart);
        breakStart = null;
      }
    }
    
    // If currently on break, add time since break started
    if (breakStart != null && _isCurrentlyOnBreak(entries)) {
      totalBreaks += DateTime.now().difference(breakStart);
    }
    
    return totalBreaks;
  }

  // Check if currently on break
  bool _isCurrentlyOnBreak(List<TimeEntry> entries) {
    if (entries.isEmpty) return false;
    final lastEntry = entries.first;
    return lastEntry.status == TimeEntryStatus.onBreak;
  }

  // Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  // Refresh all data
  Future<void> refresh() async {
    // Don't refresh if we're processing an entry
    if (state.isProcessingEntry) {
      return;
    }
    
    try {
      state = state.copyWith(isLoading: true, error: null);
      await loadTodayEntries();
      await loadRecentEntries();
      await loadCurrentShift();
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to refresh: $e',
      );
    }
  }

  // Load recent entries (last 30 days)
  Future<void> loadRecentEntries() async {
    final user = _ref.read(currentUserProvider);
    if (user == null) return;

    try {
      final thirtyDaysAgo = DateTime.now().subtract(const Duration(days: 30));

      final querySnapshot = await _firebaseService.firestore
          .collection('timeEntries')
          .where('employeeId', isEqualTo: user.id)
          .where('timestamp', isGreaterThanOrEqualTo: Timestamp.fromDate(thirtyDaysAgo))
          .orderBy('timestamp', descending: true)
          .limit(200) // Limit to prevent large data loads
          .get();

      final entries = querySnapshot.docs
          .map((doc) => _timeEntryFromFirestore(doc))
          .toList();

      state = state.copyWith(recentEntries: entries);
    } catch (e) {
      // Don't set error for recent entries, as it's not critical
      log.warning('Failed to load recent entries: $e');
    }
  }

  // Load entries for specific date range
  Future<List<TimeEntry>> loadEntriesForDateRange(DateTime start, DateTime end) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) return [];

    try {
      final querySnapshot = await _firebaseService.firestore
          .collection('timeEntries')
          .where('employeeId', isEqualTo: user.id)
          .where('timestamp', isGreaterThanOrEqualTo: Timestamp.fromDate(start))
          .where('timestamp', isLessThan: Timestamp.fromDate(end.add(const Duration(days: 1))))
          .orderBy('timestamp', descending: true)
          .get();

      return querySnapshot.docs
          .map((doc) => _timeEntryFromFirestore(doc))
          .toList();
    } catch (e) {
      throw Exception('Failed to load entries for date range: $e');
    }
  }
}

// Main provider
final timeTrackingProvider = StateNotifierProvider<TimeTrackingNotifier, TimeTrackingState>((ref) {
  return TimeTrackingNotifier(ref);
});

// Convenience providers
final currentShiftProvider = Provider<CurrentShift?>((ref) {
  return ref.watch(timeTrackingProvider).currentShift;
});

final isClockedInProvider = Provider<bool>((ref) {
  return ref.watch(timeTrackingProvider).isClockedIn;
});

final todayEntriesProvider = Provider<List<TimeEntry>>((ref) {
  return ref.watch(timeTrackingProvider).todayEntries;
}); 