import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/jobsites_provider.dart';
import '../../providers/time_tracking_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider);
    final locationState = ref.watch(locationProvider);
    final jobSitesState = ref.watch(jobSitesProvider);
    final timeTrackingState = ref.watch(timeTrackingProvider);

    // Debug logging for time tracking state
    print('🔧 Dashboard build - Time tracking state:');
    print('  - Is clocked in: ${timeTrackingState.isClockedIn}');
    print('  - Current shift: ${timeTrackingState.currentShift?.jobSiteName}');
    print('  - Processing entry: ${timeTrackingState.isProcessingEntry}');
    print('  - Can clock out: ${timeTrackingState.canClockOut}');
    print('  - Today entries: ${timeTrackingState.todayEntries.length}');

    // Debug logging
    print('🔧 Dashboard build - Current user: ${currentUser?.uid}');
    print('🔧 Job sites state - assigned: ${jobSitesState.assignedJobSites.length}, all: ${jobSitesState.jobSites.length}');
    print('🔧 Job sites loading: ${jobSitesState.isLoading}');
    print('🔧 Job sites error: ${jobSitesState.error}');

    return Scaffold(
      appBar: AppBar(
        title: const Text('GeoWork Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () async {
              print('🔧 Manual refresh triggered');
              await ref.read(locationProvider.notifier).getCurrentLocation();
              await ref.read(jobSitesProvider.notifier).refresh();
              await ref.read(timeTrackingProvider.notifier).refresh();
              print('🔧 Manual refresh completed');
            },
          ),
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Notifications feature coming in Phase 4'),
                ),
              );
            },
          ),
          PopupMenuButton<String>(
            icon: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text(
                currentUser?.email?.substring(0, 1).toUpperCase() ?? 'U',
                style: const TextStyle(
                  color: Color(0xFF2196F3),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            onSelected: (value) async {
              if (value == 'logout') {
                await ref.read(authProvider.notifier).signOut();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    const Icon(Icons.person_outline),
                    const SizedBox(width: 12),
                    Text(currentUser?.email ?? 'User'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'settings',
                child: Row(
                  children: [
                    Icon(Icons.settings_outlined),
                    SizedBox(width: 12),
                    Text('Settings'),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: Colors.red),
                    SizedBox(width: 12),
                    Text('Logout', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(locationProvider.notifier).getCurrentLocation();
          await ref.read(jobSitesProvider.notifier).refresh();
          await ref.read(timeTrackingProvider.notifier).refresh();
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome card
              _buildWelcomeCard(context, currentUser),
              
              const SizedBox(height: 24),
              
              // Location status
              _buildLocationStatus(context, ref, locationState),
              
              const SizedBox(height: 24),
              
              // Current shift status
              if (timeTrackingState.currentShift != null)
                _buildCurrentShiftCard(context, timeTrackingState.currentShift!),
              
              const SizedBox(height: 24),
              
              // Clock In/Out Section
              Text(
                'Time Tracking',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Error display
              if (timeTrackingState.error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Card(
                    color: Colors.red.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red.shade700),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              timeTrackingState.error!,
                              style: TextStyle(color: Colors.red.shade700),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () {
                              ref.read(timeTrackingProvider.notifier).clearError();
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              
              // Clock in/out buttons
              if (!timeTrackingState.isClockedIn)
                _buildClockInSection(context, ref, jobSitesState, timeTrackingState)
              else
                _buildClockOutSection(context, ref, timeTrackingState),
              
              const SizedBox(height: 24),
              
              // Job Sites Section
              _buildJobSitesSection(context, jobSitesState),
              
              const SizedBox(height: 24),
              
              // Today's Time Entries
              _buildTodayEntriesSection(context, timeTrackingState),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeCard(BuildContext context, GeoWorkUser? currentUser) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: const Color(0xFF2196F3),
                  child: Text(
                    currentUser?.email?.substring(0, 1).toUpperCase() ?? 'U',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome back!',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        currentUser?.email ?? 'user@example.com',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: _getRoleColor(currentUser?.role).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _getRoleColor(currentUser?.role).withOpacity(0.3),
                          ),
                        ),
                        child: Text(
                          _getRoleLabel(currentUser?.role),
                          style: TextStyle(
                            color: _getRoleColor(currentUser?.role),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationStatus(BuildContext context, WidgetRef ref, LocationState locationState) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.location_on,
                  color: locationState.canAccessLocation ? Colors.green : Colors.orange,
                ),
                const SizedBox(width: 8),
                Text(
                  'Location Status',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (locationState.error != null)
              Text(
                locationState.error!,
                style: TextStyle(color: Colors.red.shade700),
              )
            else if (locationState.canAccessLocation && locationState.currentPosition != null)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Location: ${locationState.currentPosition!.latitude.toStringAsFixed(6)}, ${locationState.currentPosition!.longitude.toStringAsFixed(6)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  Text(
                    'Accuracy: ${ref.read(locationProvider.notifier).getLocationAccuracyInfo(locationState.currentPosition)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: Text(
                      locationState.isLocationServiceEnabled
                          ? 'Location permission required'
                          : 'Location services disabled',
                      style: TextStyle(color: Colors.orange.shade700),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: locationState.isLoading
                        ? null
                        : () async {
                            if (!locationState.isLocationServiceEnabled) {
                              await ref.read(locationProvider.notifier).openLocationSettings();
                            } else {
                              await ref.read(locationProvider.notifier).requestLocationPermission();
                            }
                          },
                    child: locationState.isLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            locationState.isLocationServiceEnabled ? 'Enable' : 'Settings',
                            style: const TextStyle(fontSize: 12),
                          ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentShiftCard(BuildContext context, CurrentShift shift) {
    final hours = shift.workDuration.inHours;
    final minutes = shift.workDuration.inMinutes % 60;
    
    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.work, color: Colors.green.shade700),
                const SizedBox(width: 8),
                Text(
                  'Current Shift',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Colors.green.shade700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Working at: ${shift.jobSiteName}',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Started: ${_formatTime(shift.startTime)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      Text(
                        'Duration: ${hours}h ${minutes}m',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                if (shift.isOnBreak)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.orange.shade300),
                    ),
                    child: Text(
                      'On Break',
                      style: TextStyle(
                        color: Colors.orange.shade700,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildClockInSection(BuildContext context, WidgetRef ref, JobSitesState jobSitesState, TimeTrackingState timeTrackingState) {
    if (jobSitesState.assignedJobSites.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              Icon(Icons.business, size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              Text(
                'No Job Sites Assigned',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Contact your administrator to assign job sites.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey.shade600,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: jobSitesState.activeAssignedJobSites.map((jobSite) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: Colors.green.shade100,
                    child: Icon(Icons.location_on, color: Colors.green.shade700),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          jobSite.siteName,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          jobSite.address,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey.shade600,
                          ),
                        ),
                        Text(
                          'Radius: ${jobSite.radius.toInt()}m',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton.icon(
                    onPressed: timeTrackingState.isProcessingEntry
                        ? null
                        : () async {
                            final success = await ref
                                .read(timeTrackingProvider.notifier)
                                .clockIn(jobSite.siteId);
                            
                            if (success && context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Clocked in at ${jobSite.siteName}'),
                                  backgroundColor: Colors.green,
                                ),
                              );
                            }
                          },
                    icon: timeTrackingState.isProcessingEntry
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.play_circle_filled),
                    label: const Text('Clock In'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildClockOutSection(BuildContext context, WidgetRef ref, TimeTrackingState timeTrackingState) {
    return Card(
      color: Colors.red.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: Colors.red.shade100,
              child: Icon(Icons.stop_circle, color: Colors.red.shade700),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Ready to clock out?',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'You are currently clocked in at ${timeTrackingState.currentShift?.jobSiteName}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            ElevatedButton.icon(
              onPressed: !timeTrackingState.canClockOut
                  ? null
                  : () async {
                      final success = await ref
                          .read(timeTrackingProvider.notifier)
                          .clockOut();
                      
                      if (success && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Successfully clocked out'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    },
              icon: timeTrackingState.isProcessingEntry
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.stop_circle),
              label: const Text('Clock Out'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildJobSitesSection(BuildContext context, JobSitesState jobSitesState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'My Job Sites',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        if (jobSitesState.isLoading)
          const Center(child: CircularProgressIndicator())
        else if (jobSitesState.assignedJobSites.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Center(
                child: Text(
                  'No job sites assigned yet.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
          )
        else
          ...jobSitesState.activeAssignedJobSites.map((jobSite) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              child: Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.blue.shade100,
                    child: Icon(Icons.business, color: Colors.blue.shade700),
                  ),
                  title: Text(jobSite.siteName),
                  subtitle: Text(jobSite.address),
                  trailing: Chip(
                    label: Text('${jobSite.radius.toInt()}m'),
                    backgroundColor: Colors.grey.shade200,
                  ),
                ),
              ),
            );
          }).toList(),
      ],
    );
  }

  Widget _buildTodayEntriesSection(BuildContext context, TimeTrackingState timeTrackingState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Today\'s Activity',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        if (timeTrackingState.todayEntries.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Center(
                child: Text(
                  'No time entries today.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
          )
        else
          ...timeTrackingState.todayEntries.map((entry) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              child: Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _getStatusColor(entry.status).withOpacity(0.2),
                    child: Icon(
                      _getStatusIcon(entry.status),
                      color: _getStatusColor(entry.status),
                    ),
                  ),
                  title: Text(_getStatusLabel(entry.status)),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(entry.jobSiteName),
                      Text(_formatTime(entry.timestamp)),
                    ],
                  ),
                  trailing: Text(
                    '${entry.distanceFromJobSite.toInt()}m',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),
            );
          }).toList(),
      ],
    );
  }

  Color _getRoleColor(UserRole? role) {
    switch (role) {
      case UserRole.superAdmin:
        return Colors.purple;
      case UserRole.companyAdmin:
        return Colors.blue;
      case UserRole.employee:
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  String _getRoleLabel(UserRole? role) {
    switch (role) {
      case UserRole.superAdmin:
        return 'Super Admin';
      case UserRole.companyAdmin:
        return 'Company Admin';
      case UserRole.employee:
        return 'Employee';
      default:
        return 'User';
    }
  }

  Color _getStatusColor(TimeEntryStatus status) {
    switch (status) {
      case TimeEntryStatus.clockedIn:
        return Colors.green;
      case TimeEntryStatus.clockedOut:
        return Colors.red;
      case TimeEntryStatus.onBreak:
        return Colors.orange;
      case TimeEntryStatus.breakEnded:
        return Colors.blue;
    }
  }

  IconData _getStatusIcon(TimeEntryStatus status) {
    switch (status) {
      case TimeEntryStatus.clockedIn:
        return Icons.play_circle_filled;
      case TimeEntryStatus.clockedOut:
        return Icons.stop_circle;
      case TimeEntryStatus.onBreak:
        return Icons.pause_circle;
      case TimeEntryStatus.breakEnded:
        return Icons.play_circle_outline;
    }
  }

  String _getStatusLabel(TimeEntryStatus status) {
    switch (status) {
      case TimeEntryStatus.clockedIn:
        return 'Clocked In';
      case TimeEntryStatus.clockedOut:
        return 'Clocked Out';
      case TimeEntryStatus.onBreak:
        return 'Break Started';
      case TimeEntryStatus.breakEnded:
        return 'Break Ended';
    }
  }

  String _formatTime(DateTime dateTime) {
    return '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
} 