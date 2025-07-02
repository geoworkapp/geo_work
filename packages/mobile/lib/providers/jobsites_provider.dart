import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../firebase/firebase_service.dart';
import 'auth_provider.dart';
import 'dart:math' as math;

// Job Site model for mobile app
class JobSite {
  final String siteId;
  final String companyId;
  final String siteName;
  final String address;
  final JobSiteLocation location;
  final double radius;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  JobSite({
    required this.siteId,
    required this.companyId,
    required this.siteName,
    required this.address,
    required this.location,
    required this.radius,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  factory JobSite.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return JobSite(
      siteId: doc.id,
      companyId: data['companyId'] ?? '',
      siteName: data['siteName'] ?? '',
      address: data['address'] ?? '',
      location: JobSiteLocation.fromMap(data['location'] ?? {}),
      radius: (data['radius'] ?? 100).toDouble(),
      isActive: data['isActive'] ?? true,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'siteId': siteId,
      'companyId': companyId,
      'siteName': siteName,
      'address': address,
      'location': location.toMap(),
      'radius': radius,
      'isActive': isActive,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': Timestamp.fromDate(updatedAt),
    };
  }
}

// Job Site Location model
class JobSiteLocation {
  final double latitude;
  final double longitude;

  JobSiteLocation({
    required this.latitude,
    required this.longitude,
  });

  factory JobSiteLocation.fromMap(Map<String, dynamic> map) {
    return JobSiteLocation(
      latitude: (map['latitude'] ?? 0.0).toDouble(),
      longitude: (map['longitude'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'latitude': latitude,
      'longitude': longitude,
    };
  }
}

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

  // Initialize job sites loading
  void _initialize() {
    // Listen to auth changes to load job sites when user is ready
    _ref.listen(currentUserProvider, (previous, next) {
      print('🔄 Auth state changed - Previous: ${previous?.uid}, Next: ${next?.uid}');
      print('🏢 Previous companyId: ${previous?.companyId}, Next companyId: ${next?.companyId}');
      
      if (next?.companyId != null && next?.companyId != previous?.companyId) {
        print('✅ User with companyId available, loading job sites');
        loadJobSites();
        loadAssignedJobSites();
      } else if (next?.companyId == null) {
        print('⚠️ No companyId available');
      }
    });

    // Also try immediate load if user is already available
    final user = _ref.read(currentUserProvider);
    print('🏗️ JobSitesNotifier initializing - User: ${user?.uid}, Company: ${user?.companyId}');
    if (user?.companyId != null) {
      print('✅ User already available, loading job sites immediately');
      loadJobSites();
      loadAssignedJobSites();
    } else {
      print('⚠️ Cannot initialize immediately - no user or companyId available');
    }
  }

  // Load all company job sites
  Future<void> loadJobSites() async {
    final user = _ref.read(currentUserProvider);
    if (user?.companyId == null) {
      print('❌ Cannot load job sites - no companyId');
      return;
    }

    try {
      print('🔄 Loading job sites for company: ${user!.companyId}');
      state = state.copyWith(isLoading: true, error: null);

      final querySnapshot = await _firebaseService.firestore
          .collection('jobSites')
          .where('companyId', isEqualTo: user.companyId)
          .get();

      print('📊 Found ${querySnapshot.docs.length} job sites');
      final jobSites = querySnapshot.docs
          .map((doc) => JobSite.fromFirestore(doc))
          .toList();

      for (final jobSite in jobSites) {
        print('📍 Job site: ${jobSite.siteName} (${jobSite.siteId})');
      }

      state = state.copyWith(
        jobSites: jobSites,
        isLoading: false,
      );
    } catch (e) {
      print('❌ Error loading job sites: $e');
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load job sites: $e',
      );
    }
  }

  // Load job sites assigned to current employee
  Future<void> loadAssignedJobSites() async {
    final user = _ref.read(currentUserProvider);
    if (user?.uid == null) return;

    try {
      print('🔍 Loading assigned job sites for user: ${user!.uid}');
      print('🏢 User company: ${user.companyId}');
      
      // Get user document to find assigned job sites (stored in 'users' collection as 'jobSites')
      // First try by UID, then by email if not found
      var userDoc = await _firebaseService.firestore
          .collection('users')
          .doc(user.uid)
          .get();

      print('📋 User doc exists by UID: ${userDoc.exists}');
      
      Map<String, dynamic>? userData;
      
      if (userDoc.exists) {
        userData = userDoc.data()!;
      } else {
        print('🔍 User doc not found by UID, searching by email: ${user.email}');
        // Try to find by email
        if (user.email != null) {
          final emailQuery = await _firebaseService.firestore
              .collection('users')
              .where('email', isEqualTo: user.email!.toLowerCase())
              .limit(1)
              .get();
          
          if (emailQuery.docs.isNotEmpty) {
            userData = emailQuery.docs.first.data();
            print('📧 Found user data by email: $userData');
          }
        }
      }
      
      if (userData == null) {
        print('⚠️ No user record found by UID or email, user might be admin - show all job sites');
        // If no user record, user might be admin - show all job sites
        state = state.copyWith(assignedJobSites: state.jobSites);
        return;
      }
      print('👤 User data: $userData');
      
      // Check if user is admin/manager - if so, show all job sites
      final userRole = userData!['role'];
      if (userRole == 'admin' || userRole == 'manager') {
        print('🔐 User is admin/manager, showing all job sites');
        state = state.copyWith(assignedJobSites: state.jobSites);
        return;
      }
      
      final assignedSiteIds = List<String>.from(userData!['jobSites'] ?? []);
      print('🎯 Assigned job site IDs: $assignedSiteIds');

      if (assignedSiteIds.isEmpty) {
        print('⚠️ No job sites assigned to employee');
        state = state.copyWith(assignedJobSites: []);
        return;
      }

      // Fetch assigned job sites
      final assignedSites = <JobSite>[];
      for (final siteId in assignedSiteIds) {
        print('🔄 Fetching job site: $siteId');
        final siteDoc = await _firebaseService.firestore
            .collection('jobSites')
            .doc(siteId)
            .get();

        print('📍 Job site $siteId exists: ${siteDoc.exists}');
        if (siteDoc.exists) {
          final jobSite = JobSite.fromFirestore(siteDoc);
          print('✅ Loaded job site: ${jobSite.siteName}');
          assignedSites.add(jobSite);
        }
      }

      print('📊 Total assigned sites loaded: ${assignedSites.length}');
      state = state.copyWith(assignedJobSites: assignedSites);
    } catch (e) {
      print('❌ Error loading assigned job sites: $e');
      state = state.copyWith(
        error: 'Failed to load assigned job sites: $e',
      );
    }
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