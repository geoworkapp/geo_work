import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

// Location permission status enum
enum LocationPermissionStatus {
  granted,
  denied,
  deniedForever,
  restricted,
  limited,
  unableToDetermine,
}

// Location state class
class LocationState {
  final Position? currentPosition;
  final bool isLoading;
  final LocationPermissionStatus permissionStatus;
  final String? error;
  final bool isLocationServiceEnabled;

  const LocationState({
    this.currentPosition,
    this.isLoading = false,
    this.permissionStatus = LocationPermissionStatus.unableToDetermine,
    this.error,
    this.isLocationServiceEnabled = false,
  });

  LocationState copyWith({
    Position? currentPosition,
    bool? isLoading,
    LocationPermissionStatus? permissionStatus,
    String? error,
    bool? isLocationServiceEnabled,
  }) {
    return LocationState(
      currentPosition: currentPosition ?? this.currentPosition,
      isLoading: isLoading ?? this.isLoading,
      permissionStatus: permissionStatus ?? this.permissionStatus,
      error: error,
      isLocationServiceEnabled: isLocationServiceEnabled ?? this.isLocationServiceEnabled,
    );
  }

  bool get hasValidLocation => currentPosition != null;
  bool get canAccessLocation => 
      permissionStatus == LocationPermissionStatus.granted && 
      isLocationServiceEnabled;
}

// Location service notifier
class LocationNotifier extends StateNotifier<LocationState> {
  LocationNotifier() : super(const LocationState()) {
    _initialize();
  }

  // Initialize location services
  Future<void> _initialize() async {
    await checkLocationServiceStatus();
    await checkLocationPermission();
  }

  // Check if location services are enabled
  Future<void> checkLocationServiceStatus() async {
    try {
      final isEnabled = await Geolocator.isLocationServiceEnabled();
      state = state.copyWith(
        isLocationServiceEnabled: isEnabled,
        error: isEnabled ? null : 'Location services are disabled',
      );
    } catch (e) {
      state = state.copyWith(
        error: 'Failed to check location service status: $e',
      );
    }
  }

  // Check current location permission status
  Future<void> checkLocationPermission() async {
    try {
      final permission = await Geolocator.checkPermission();
      final status = _mapGeolocatorPermission(permission);
      
      state = state.copyWith(
        permissionStatus: status,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        error: 'Failed to check location permission: $e',
      );
    }
  }

  // Request location permission
  Future<bool> requestLocationPermission() async {
    try {
      state = state.copyWith(isLoading: true, error: null);

      // First check if location services are enabled
      if (!state.isLocationServiceEnabled) {
        await checkLocationServiceStatus();
        if (!state.isLocationServiceEnabled) {
          state = state.copyWith(
            isLoading: false,
            error: 'Please enable location services in your device settings',
          );
          return false;
        }
      }

      // Request permission
      final permission = await Geolocator.requestPermission();
      final status = _mapGeolocatorPermission(permission);
      
      state = state.copyWith(
        permissionStatus: status,
        isLoading: false,
        error: status == LocationPermissionStatus.granted 
            ? null 
            : 'Location permission is required for time tracking',
      );

      return status == LocationPermissionStatus.granted;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to request location permission: $e',
      );
      return false;
    }
  }

  // Get current location
  Future<Position?> getCurrentLocation() async {
    try {
      state = state.copyWith(isLoading: true, error: null);

      // Check permissions first
      if (!state.canAccessLocation) {
        final hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          state = state.copyWith(isLoading: false);
          return null;
        }
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      state = state.copyWith(
        currentPosition: position,
        isLoading: false,
        error: null,
      );

      return position;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to get current location: $e',
      );
      return null;
    }
  }

  // Calculate distance between two points
  double calculateDistance(
    double lat1, 
    double lon1, 
    double lat2, 
    double lon2,
  ) {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2);
  }

  // Check if current location is within geofence
  Future<bool> isWithinGeofence({
    required double targetLat,
    required double targetLon,
    required double radiusInMeters,
  }) async {
    final position = await getCurrentLocation();
    if (position == null) return false;

    final distance = calculateDistance(
      position.latitude,
      position.longitude,
      targetLat,
      targetLon,
    );

    return distance <= radiusInMeters;
  }

  // Get location accuracy info
  String getLocationAccuracyInfo(Position? position) {
    if (position == null) return 'No location data';
    
    final accuracy = position.accuracy;
    if (accuracy < 5) return 'Excellent (±${accuracy.toStringAsFixed(1)}m)';
    if (accuracy < 10) return 'Good (±${accuracy.toStringAsFixed(1)}m)';
    if (accuracy < 20) return 'Fair (±${accuracy.toStringAsFixed(1)}m)';
    return 'Poor (±${accuracy.toStringAsFixed(1)}m)';
  }

  // Open device location settings
  Future<void> openLocationSettings() async {
    try {
      await Geolocator.openLocationSettings();
    } catch (e) {
      state = state.copyWith(
        error: 'Failed to open location settings: $e',
      );
    }
  }

  // Open app settings for permission
  Future<void> openAppSettings() async {
    try {
      await Geolocator.openAppSettings();
    } catch (e) {
      state = state.copyWith(
        error: 'Failed to open app settings: $e',
      );
    }
  }

  // Map Geolocator permission to our enum
  LocationPermissionStatus _mapGeolocatorPermission(LocationPermission permission) {
    switch (permission) {
      case LocationPermission.always:
      case LocationPermission.whileInUse:
        return LocationPermissionStatus.granted;
      case LocationPermission.denied:
        return LocationPermissionStatus.denied;
      case LocationPermission.deniedForever:
        return LocationPermissionStatus.deniedForever;
      case LocationPermission.unableToDetermine:
        return LocationPermissionStatus.unableToDetermine;
    }
  }

  // Clear any errors
  void clearError() {
    state = state.copyWith(error: null);
  }
}

// Providers
final locationProvider = StateNotifierProvider<LocationNotifier, LocationState>((ref) {
  return LocationNotifier();
});

// Convenience providers
final currentPositionProvider = Provider<Position?>((ref) {
  return ref.watch(locationProvider).currentPosition;
});

final locationPermissionStatusProvider = Provider<LocationPermissionStatus>((ref) {
  return ref.watch(locationProvider).permissionStatus;
});

final canAccessLocationProvider = Provider<bool>((ref) {
  return ref.watch(locationProvider).canAccessLocation;
}); 