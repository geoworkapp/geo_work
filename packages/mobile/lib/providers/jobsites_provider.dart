import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:logging/logging.dart';
import 'package:shared/models.dart';
import '../firebase/firebase_service.dart';
import 'auth_provider.dart';
import 'dart:math' as math;

// Job Sites state
class JobSitesState {
  final List<JobSite> jobSites;
  final List<JobSite> assignedJobSites;
  final bool isLoading;
  final String? error;

  const JobSitesState({
    this.jobSites = const [],
    this.assignedJobSites = const [],
    this.isLoading = false,
    this.error,
  });

  JobSitesState copyWith({
    List<JobSite>? jobSites,
    List<JobSite>? assignedJobSites,
    bool? isLoading,
    String? error,
  }) {
    return JobSitesState(
      jobSites: jobSites ?? this.jobSites,
      assignedJobSites: assignedJobSites ?? this.assignedJobSites,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }

  List<JobSite> get activeJobSites => jobSites.where((site) => site.isActive).toList();
  List<JobSite> get activeAssignedJobSites => assignedJobSites.where((site) => site.isActive).toList();
}

// Job Sites notifier
class JobSitesNotifier extends StateNotifier<JobSitesState> {
  JobSitesNotifier(this._ref) : super(const JobSitesState()) {
    _initialize();
  }

  final Ref _ref;
  final FirebaseService _firebaseService = FirebaseService.instance;
  final _logger = Logger('JobSitesNotifier');

  // Initialize job sites loading
  void _initialize() {
    // Listen to auth changes to load job sites when user is ready
    _ref.listen(currentUserProvider, (previous, next) {
      _logger.info('Auth state changed - Previous: ${previous?.id}, Next: ${next?.id}');
      _logger.info('Previous companyId: ${previous?.companyId}, Next companyId: ${next?.companyId}');
      
      if (next?.companyId != null && next?.companyId != previous?.companyId) {
        _logger.info('User with companyId available, loading job sites');
        loadJobSites();
        loadAssignedJobSites();
      } else if (next?.companyId == null) {
        _logger.warning('No companyId available');
      }
    });

    // Also try immediate load if user is already available
    final user = _ref.read(currentUserProvider);
    _logger.info('JobSitesNotifier initializing - User: ${user?.id}, Company: ${user?.companyId}');
    if (user?.companyId != null) {
      _logger.info('User already available, loading job sites immediately');
      loadJobSites();
      loadAssignedJobSites();
    } else {
      _logger.warning('Cannot initialize immediately - no user or companyId available');
    }
  }

  // Load all company job sites
  Future<void> loadJobSites() async {
    final user = _ref.read(currentUserProvider);
    if (user?.companyId == null) {
      _logger.warning('Cannot load job sites - no companyId');
      return;
    }

    try {
      _logger.info('Loading job sites for company: ${user!.companyId}');
      state = state.copyWith(isLoading: true, error: null);

      final querySnapshot = await _firebaseService.firestore
          .collection('jobSites')
          .where('companyId', isEqualTo: user.companyId)
          .get();

      _logger.info('Found ${querySnapshot.docs.length} job sites');
      final jobSites = querySnapshot.docs
          .map((doc) => _jobSiteFromFirestore(doc))
          .toList();

      for (final jobSite in jobSites) {
        _logger.info('Job site: ${jobSite.siteName} (${jobSite.siteId})');
      }

      state = state.copyWith(
        jobSites: jobSites,
        isLoading: false,
      );
    } catch (e) {
      _logger.severe('Error loading job sites: $e');
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load job sites: $e',
      );
    }
  }

  // Load job sites assigned to current employee
  Future<void> loadAssignedJobSites() async {
    final user = _ref.read(currentUserProvider);
    if (user?.id == null) return;

    try {
      _logger.info('Loading assigned job sites for user: ${user!.id}');

      // First query using current field name
      final assignmentsSnapshot = await _firebaseService.firestore
          .collection('userAssignments')
          .where('userId', isEqualTo: user.id)
          .where('isActive', isEqualTo: true)
          .get();

      // Fallback query for legacy field name (employeeId) – avoids OR limitation
      final legacySnapshot = await _firebaseService.firestore
          .collection('userAssignments')
          .where('employeeId', isEqualTo: user.id)
          .where('isActive', isEqualTo: true)
          .get();

      _logger.info('Found ${assignmentsSnapshot.docs.length} assignments (userId) & ${legacySnapshot.docs.length} legacy assignments (employeeId)');

      final allAssignmentDocs = [...assignmentsSnapshot.docs, ...legacySnapshot.docs];

      if (allAssignmentDocs.isEmpty) {
        state = state.copyWith(assignedJobSites: []);
        return;
      }

      final jobSiteIds = allAssignmentDocs
          .map((doc) => doc.data()['jobSiteId'] as String)
          .toSet()
          .toList();

      _logger.info('Assigned job site IDs: $jobSiteIds');

      // Firestore whereIn supports max 10 elements – split into chunks if needed
      List<JobSite> assignedJobSites = [];
      for (var i = 0; i < jobSiteIds.length; i += 10) {
        final chunk = jobSiteIds.sublist(i, math.min(i + 10, jobSiteIds.length));

        _logger.info('Fetching jobSites batch: ${chunk.length} IDs');

        final snapshot = await _firebaseService.firestore
            .collection('jobSites')
            .where(FieldPath.documentId, whereIn: chunk)
            .get();

        _logger.info('Batch returned ${snapshot.docs.length} docs');

        assignedJobSites.addAll(
          snapshot.docs.map((doc) => _jobSiteFromFirestore(doc)),
        );
      }

      _logger.info('Total assigned job sites after batching: ${assignedJobSites.length}');

      for (final jobSite in assignedJobSites) {
        _logger.info('Assigned job site: ${jobSite.siteName} (${jobSite.siteId})');
      }

      state = state.copyWith(assignedJobSites: assignedJobSites);
    } catch (e) {
      _logger.severe('Error loading assigned job sites: $e');
    }
  }

  // Convert Firestore document to JobSite using shared model
  JobSite _jobSiteFromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final locationData = data['location'] as Map<String, dynamic>;
    
    return JobSite(
      siteId: doc.id,
      companyId: data['companyId'] ?? '',
      siteName: data['siteName'] ?? '',
      address: data['address'] ?? '',
      location: Location(
        latitude: (locationData['latitude'] ?? 0.0).toDouble(),
        longitude: (locationData['longitude'] ?? 0.0).toDouble(),
      ),
      radius: ((data['radius'] ?? 100) as num).round(),
      isActive: data['isActive'] ?? true,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  // Refresh job sites
  Future<void> refresh() async {
    await Future.wait([
      loadJobSites(),
      loadAssignedJobSites(),
    ]);
  }

  // Get job site by ID
  JobSite? getJobSiteById(String siteId) {
    try {
      return state.jobSites.firstWhere((site) => site.siteId == siteId);
    } catch (e) {
      return null;
    }
  }

  // Get assigned job site by ID
  JobSite? getAssignedJobSiteById(String siteId) {
    try {
      return state.assignedJobSites.firstWhere((site) => site.siteId == siteId);
    } catch (e) {
      return null;
    }
  }

  // Check if user can clock in at a specific job site
  bool canClockInAtJobSite(String siteId) {
    final jobSite = getAssignedJobSiteById(siteId);
    return jobSite != null && jobSite.isActive;
  }

  // Find nearest job site to current location
  JobSite? findNearestJobSite(double currentLat, double currentLon) {
    if (state.activeAssignedJobSites.isEmpty) return null;

    JobSite? nearest;
    double minDistance = double.infinity;

    for (final jobSite in state.activeAssignedJobSites) {
      // Calculate distance using Haversine formula (approximate)
      final distance = _calculateDistance(
        currentLat,
        currentLon,
        jobSite.location.latitude,
        jobSite.location.longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = jobSite;
      }
    }

    return nearest;
  }

  // Calculate distance between two points in meters
  double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double earthRadius = 6371000; // Earth radius in meters
    final double dLat = _degreesToRadians(lat2 - lat1);
    final double dLon = _degreesToRadians(lon2 - lon1);
    
    final double a = (math.sin(dLat / 2) * math.sin(dLat / 2)) +
        (math.cos(_degreesToRadians(lat1)) * math.cos(_degreesToRadians(lat2)) *
            math.sin(dLon / 2) * math.sin(dLon / 2));
    
    final double c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    
    return earthRadius * c;
  }

  double _degreesToRadians(double degrees) {
    return degrees * (math.pi / 180);
  }

  // Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }
}

// Providers
final jobSitesProvider = StateNotifierProvider<JobSitesNotifier, JobSitesState>((ref) {
  return JobSitesNotifier(ref);
});

// Convenience providers
final assignedJobSitesProvider = Provider<List<JobSite>>((ref) {
  return ref.watch(jobSitesProvider).activeAssignedJobSites;
});

final allJobSitesProvider = Provider<List<JobSite>>((ref) {
  return ref.watch(jobSitesProvider).activeJobSites;
}); 