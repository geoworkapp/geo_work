import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/models.dart' as shared;
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/jobsites_provider.dart';
import '../../providers/schedule_session_provider.dart';
import '../../models/schedule_session.dart';
import '../timesheet/schedule_timesheet_screen.dart';
import '../schedule/schedule_screen.dart';

class AutomaticDashboardScreen extends ConsumerWidget {
  const AutomaticDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider);
    final locationState = ref.watch(locationProvider);
    final jobSitesState = ref.watch(jobSitesProvider);
    final sessionState = ref.watch(scheduleSessionProvider);

    // Listen for important state changes
    ref.listen<ScheduleSessionState>(scheduleSessionProvider, (previous, next) {
      _handleStateChanges(context, previous, next);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('GeoWork Dashboard'),
        backgroundColor: _getAppBarColor(sessionState),
        actions: [
          // Auto-tracking status indicator
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  sessionState.isBackgroundTrackingActive 
                    ? Icons.gps_fixed 
                    : Icons.gps_off,
                  size: 16,
                  color: sessionState.isBackgroundTrackingActive 
                    ? Colors.green 
                    : Colors.grey,
                ),
                const SizedBox(width: 4),
                Text(
                  sessionState.isBackgroundTrackingActive ? 'AUTO' : 'MANUAL',
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () async {
              await ref.read(scheduleSessionProvider.notifier).refresh();
              await ref.read(locationProvider.notifier).getCurrentLocation();
              await ref.read(jobSitesProvider.notifier).refresh();
            },
          ),
          PopupMenuButton<String>(
            icon: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text(
                currentUser?.email.substring(0, 1).toUpperCase() ?? 'U',
                style: const TextStyle(
                  color: Color(0xFF2196F3),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            onSelected: (value) async {
              if (value == 'logout') {
                await ref.read(authProvider.notifier).signOut();
              } else if (value == 'tracking_settings') {
                _showTrackingSettingsDialog(context, ref, sessionState);
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
                value: 'tracking_settings',
                child: Row(
                  children: [
                    Icon(Icons.track_changes_outlined),
                    SizedBox(width: 12),
                    Text('Tracking Settings'),
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
          await ref.read(scheduleSessionProvider.notifier).refresh();
          await ref.read(locationProvider.notifier).getCurrentLocation();
          await ref.read(jobSitesProvider.notifier).refresh();
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome & status card
              _buildWelcomeCard(context, currentUser, sessionState),
              
              const SizedBox(height: 24),
              
              // Auto tracking consent banner
              if (!sessionState.isBackgroundTrackingActive)
                _buildAutoTrackingBanner(context, ref, sessionState),
              
              const SizedBox(height: 16),
              
              // Current session status
              if (sessionState.hasActiveSession)
                _buildCurrentSessionCard(context, ref, sessionState)
              else
                _buildNoActiveSessionCard(context, sessionState),
              
              const SizedBox(height: 24),
              
              // Quick actions
              _buildQuickActionsSection(context, ref, sessionState),
              
              const SizedBox(height: 24),
              
              // Today's sessions summary
              _buildTodaySessionsSection(context, sessionState),
              
              const SizedBox(height: 24),
              
              // Upcoming sessions
              _buildUpcomingSessionsSection(context, sessionState),
              
              const SizedBox(height: 24),
              
              // Location & job sites status
              _buildLocationSection(context, ref, locationState, jobSitesState),
            ],
          ),
        ),
      ),
    );
  }

  // ============================================================================
  // STATE CHANGE HANDLERS
  // ============================================================================

  void _handleStateChanges(BuildContext context, ScheduleSessionState? previous, ScheduleSessionState next) {
    // Handle errors
    if (next.error != null && next.error != previous?.error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(next.error!),
          backgroundColor: Colors.red,
          action: SnackBarAction(
            label: 'Dismiss',
            textColor: Colors.white,
            onPressed: () {
              ScaffoldMessenger.of(context).hideCurrentSnackBar();
            },
          ),
        ),
      );
    }

    // Handle automatic clock-in/out notifications
    if (next.currentSession?.autoClockInTriggered == true && 
        previous?.currentSession?.autoClockInTriggered != true) {
      _showNotification(context, 'Automatically Clocked In', 
        'You\'ve been clocked in at ${next.currentSession?.jobSiteName}', 
        Icons.work, Colors.green);
    }

    if (next.currentSession?.autoClockOutTriggered == true && 
        previous?.currentSession?.autoClockOutTriggered != true) {
      _showNotification(context, 'Automatically Clocked Out', 
        'You\'ve been clocked out from ${next.currentSession?.jobSiteName}', 
        Icons.work_off, Colors.orange);
    }

    // Handle overtime alerts
    if (next.isInOvertime && (previous?.isInOvertime != true)) {
      _showNotification(context, 'Overtime Alert', 
        'You are now in overtime. Consider clocking out soon.', 
        Icons.schedule, Colors.purple);
    }

    // Handle session completion
    if (next.currentSession?.status == 'completed' && 
        previous?.currentSession?.status != 'completed') {
      _showNotification(context, 'Schedule Completed', 
        'Your scheduled shift has ended. Great work!', 
        Icons.check_circle, Colors.green);
    }
  }

  void _showNotification(BuildContext context, String title, String message, IconData icon, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(message),
                ],
              ),
            ),
          ],
        ),
        backgroundColor: color,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  // ============================================================================
  // UI BUILDERS
  // ============================================================================

  Color _getAppBarColor(ScheduleSessionState sessionState) {
    if (sessionState.isInOvertime) return Colors.purple;
    if (sessionState.isClockedIn) return Colors.green;
    if (sessionState.hasActiveSession) return Colors.orange;
    return const Color(0xFF2196F3);
  }

  Widget _buildWelcomeCard(BuildContext context, shared.User? currentUser, ScheduleSessionState sessionState) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: Theme.of(context).primaryColor,
                  child: Text(
                    currentUser?.email.substring(0, 1).toUpperCase() ?? 'U',
                    style: const TextStyle(
                      color: Colors.white,
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
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        currentUser?.email ?? 'Employee',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _getStatusColor(sessionState),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    sessionState.currentStatusText,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            
            if (sessionState.hasActiveSession) ...[
              const SizedBox(height: 16),
              _buildWorkStatusRow(context, sessionState),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildWorkStatusRow(BuildContext context, ScheduleSessionState sessionState) {
    return Row(
      children: [
        _buildStatusItem('Work Time', _formatDuration(sessionState.currentWorkDuration), Icons.work),
        const SizedBox(width: 24),
        if (sessionState.isOnBreak)
          _buildStatusItem('On Break', 'Active', Icons.coffee)
        else if (sessionState.isInOvertime)
          _buildStatusItem('Overtime', 'Active', Icons.schedule)
        else if (sessionState.isLate)
          _buildStatusItem('Status', 'Late', Icons.schedule_outlined),
      ],
    );
  }

  Widget _buildStatusItem(String label, String value, IconData icon) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      ],
    );
  }

  Widget _buildAutoTrackingBanner(BuildContext context, WidgetRef ref, ScheduleSessionState sessionState) {
    return Card(
      color: Colors.blue.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.auto_mode, color: Colors.blue.shade700),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Enable Automatic Time Tracking',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue.shade700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Automatically clock in/out based on your schedule and location. No more manual time tracking!',
              style: TextStyle(color: Colors.blue.shade600),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: sessionState.isProcessingAction 
                      ? null 
                      : () => _enableAutoTracking(context, ref),
                    icon: sessionState.isProcessingAction 
                      ? const SizedBox(
                          width: 16, 
                          height: 16, 
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check),
                    label: Text(sessionState.isProcessingAction ? 'Enabling...' : 'Enable Auto Tracking'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue.shade700,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                TextButton(
                  onPressed: () => _showAutoTrackingInfo(context),
                  child: const Text('Learn More'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentSessionCard(BuildContext context, WidgetRef ref, ScheduleSessionState sessionState) {
    final session = sessionState.currentSession!;
    
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _getSessionIcon(session.status),
                  color: _getStatusColorFromString(sessionState.currentStatusColor),
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Current Schedule',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        session.jobSiteName,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      Text(
                        '${_formatTime(session.scheduledStartTime)} - ${_formatTime(session.scheduledEndTime)}',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _getStatusColorFromString(sessionState.currentStatusColor),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    sessionState.currentStatusText,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            // Session metrics
            Row(
              children: [
                Expanded(
                  child: _buildMetricCard('Scheduled', '${session.totalScheduledTime ~/ 60}h ${session.totalScheduledTime % 60}m'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricCard('Worked', _formatDuration(sessionState.currentWorkDuration)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricCard('Breaks', '${session.totalBreakTime ~/ 60}h ${session.totalBreakTime % 60}m'),
                ),
              ],
            ),
            
            // Alerts/warnings
            if (sessionState.needsAttention) ...[
              const SizedBox(height: 16),
              _buildAttentionCard(context, session),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNoActiveSessionCard(BuildContext context, ScheduleSessionState sessionState) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Icon(
              Icons.schedule_outlined,
              size: 48,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'No Active Schedule',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'You don\'t have any active scheduled sessions right now.',
              style: TextStyle(color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            if (sessionState.upcomingSessions.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                'Next: ${sessionState.upcomingSessions.first.jobSiteName}',
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              Text(
                'at ${_formatTime(sessionState.upcomingSessions.first.scheduledStartTime)}',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionsSection(BuildContext context, WidgetRef ref, ScheduleSessionState sessionState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Actions',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            // Manual clock-in/out
            if (sessionState.hasActiveSession && !sessionState.isClockedIn)
              Expanded(
                child: _buildActionButton(
                  context,
                  'Clock In',
                  Icons.work,
                  Colors.green,
                  sessionState.isProcessingAction ? null : () => _manualClockIn(context, ref),
                ),
              )
            else if (sessionState.isClockedIn)
              Expanded(
                child: _buildActionButton(
                  context,
                  'Clock Out',
                  Icons.work_off,
                  Colors.red,
                  sessionState.isProcessingAction ? null : () => _manualClockOut(context, ref),
                ),
              ),
            
            if (sessionState.hasActiveSession) const SizedBox(width: 12),
            
            // Break management
            if (sessionState.isClockedIn && !sessionState.isOnBreak)
              Expanded(
                child: _buildActionButton(
                  context,
                  'Start Break',
                  Icons.coffee,
                  Colors.orange,
                  sessionState.isProcessingAction ? null : () => _startBreak(context, ref),
                ),
              )
            else if (sessionState.isOnBreak)
              Expanded(
                child: _buildActionButton(
                  context,
                  'End Break',
                  Icons.work,
                  Colors.blue,
                  sessionState.isProcessingAction ? null : () => _endBreak(context, ref),
                ),
              ),
            
            if (!sessionState.hasActiveSession) ...[
              Expanded(
                child: _buildActionButton(
                  context,
                  'View Schedule',
                  Icons.calendar_today,
                  Colors.blue,
                  () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (context) => const ScheduleScreen()),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionButton(
                  context,
                  'Time History',
                  Icons.history,
                  Colors.grey,
                  () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (context) => const ScheduleTimesheetScreen()),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }

  Widget _buildActionButton(BuildContext context, String label, IconData icon, Color color, VoidCallback? onPressed) {
    return ElevatedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 12),
      ),
    );
  }

  Widget _buildTodaySessionsSection(BuildContext context, ScheduleSessionState sessionState) {
    if (sessionState.todaySessions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Today\'s Sessions',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (context) => const ScheduleTimesheetScreen()),
              ),
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ...sessionState.todaySessions.take(3).map((session) => 
          _buildSessionSummaryCard(context, session),
        ),
      ],
    );
  }

  Widget _buildUpcomingSessionsSection(BuildContext context, ScheduleSessionState sessionState) {
    if (sessionState.upcomingSessions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Upcoming Sessions',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        ...sessionState.upcomingSessions.take(2).map((session) => 
          _buildUpcomingSessionCard(context, session),
        ),
      ],
    );
  }

  Widget _buildSessionSummaryCard(BuildContext context, ScheduleSession session) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _getStatusColorFromString(session.statusColor).withAlpha((0.2 * 255).round()),
          child: Icon(
            _getSessionIcon(session.status),
            color: _getStatusColorFromString(session.statusColor),
          ),
        ),
        title: Text(session.jobSiteName),
        subtitle: Text('${_formatTime(session.scheduledStartTime)} - ${_formatTime(session.scheduledEndTime)}'),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: _getStatusColorFromString(session.statusColor),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            session.statusText,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUpcomingSessionCard(BuildContext context, ScheduleSession session) {
    final timeUntil = session.scheduledStartTime.difference(DateTime.now());
    
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blue.withAlpha((0.2 * 255).round()),
          child: const Icon(Icons.schedule, color: Colors.blue),
        ),
        title: Text(session.jobSiteName),
        subtitle: Text('${_formatTime(session.scheduledStartTime)} - ${_formatTime(session.scheduledEndTime)}'),
        trailing: Text(
          _formatTimeUntil(timeUntil),
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.blue,
          ),
        ),
      ),
    );
  }

  Widget _buildLocationSection(BuildContext context, WidgetRef ref, LocationState locationState, JobSitesState jobSitesState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Location & Job Sites',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    Icon(
                      locationState.canAccessLocation ? Icons.location_on : Icons.location_off,
                      color: locationState.canAccessLocation ? Colors.green : Colors.red,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        locationState.canAccessLocation 
                          ? 'Location services enabled'
                          : 'Location permission required',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                    if (!locationState.canAccessLocation)
                      TextButton(
                        onPressed: () async {
                          await ref.read(locationProvider.notifier).requestLocationPermission();
                        },
                        child: const Text('Enable'),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      Icons.work_outline,
                      color: jobSitesState.assignedJobSites.isNotEmpty ? Colors.green : Colors.orange,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '${jobSitesState.assignedJobSites.length} assigned job sites',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCard(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAttentionCard(BuildContext context, ScheduleSession session) {
    IconData icon;
    String message;
    Color color;

    if (session.status == 'no_show') {
      icon = Icons.warning;
      message = 'You appear to be late for your scheduled shift';
      color = Colors.red;
    } else if (session.isInOvertime) {
      icon = Icons.schedule;
      message = 'You are currently in overtime';
      color = Colors.purple;
    } else if (session.healthStatus == 'error') {
      icon = Icons.error;
      message = 'There was an issue with automatic tracking';
      color = Colors.orange;
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withAlpha((0.1 * 255).round()),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha((0.3 * 255).round())),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================================
  // DIALOGS & INTERACTIONS
  // ============================================================================

  void _showTrackingSettingsDialog(BuildContext context, WidgetRef ref, ScheduleSessionState sessionState) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tracking Settings'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(
                sessionState.isBackgroundTrackingActive 
                  ? Icons.toggle_on 
                  : Icons.toggle_off,
                color: sessionState.isBackgroundTrackingActive 
                  ? Colors.green 
                  : Colors.grey,
              ),
              title: const Text('Automatic Tracking'),
              subtitle: Text(
                sessionState.isBackgroundTrackingActive 
                  ? 'Enabled - Automatic clock in/out based on schedule'
                  : 'Disabled - Manual time tracking required'
              ),
              onTap: () {
                Navigator.of(context).pop();
                if (sessionState.isBackgroundTrackingActive) {
                  _disableAutoTracking(context, ref);
                } else {
                  _enableAutoTracking(context, ref);
                }
              },
            ),
            ListTile(
              leading: Icon(
                sessionState.hasLocationPermission 
                  ? Icons.location_on 
                  : Icons.location_off,
                color: sessionState.hasLocationPermission 
                  ? Colors.green 
                  : Colors.red,
              ),
              title: const Text('Location Permission'),
              subtitle: Text(
                sessionState.hasLocationPermission 
                  ? 'Enabled - Location tracking active'
                  : 'Required for automatic tracking'
              ),
              onTap: !sessionState.hasLocationPermission ? () async {
                Navigator.of(context).pop();
                await ref.read(locationProvider.notifier).requestLocationPermission();
              } : null,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showAutoTrackingInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Automatic Time Tracking'),
        content: const SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'How it works:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text('• Automatically starts monitoring when your schedule begins'),
              Text('• Clocks you in when you arrive at the job site'),
              Text('• Tracks your location during work hours'),
              Text('• Manages breaks based on company policy'),
              Text('• Clocks you out when you leave or schedule ends'),
              SizedBox(height: 16),
              Text(
                'Privacy & Control:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text('• Location tracking only during scheduled hours'),
              Text('• You can disable auto-tracking anytime'),
              Text('• Manual override available when needed'),
              Text('• Your data is secure and encrypted'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  Future<void> _enableAutoTracking(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Enable Automatic Tracking'),
        content: const Text(
          'This will enable automatic clock in/out based on your schedule and location. '
          'Location tracking will only be active during your scheduled work hours.\n\n'
          'Do you consent to automatic time tracking?'
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Enable'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final success = await ref.read(scheduleSessionProvider.notifier).enableAutoTracking();
      if (success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Automatic tracking enabled successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Future<void> _disableAutoTracking(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Disable Automatic Tracking'),
        content: const Text(
          'This will disable automatic clock in/out. You will need to manually track your time.\n\n'
          'Are you sure you want to disable automatic tracking?'
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Disable'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final success = await ref.read(scheduleSessionProvider.notifier).disableAutoTracking();
      if (success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Automatic tracking disabled'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  Future<void> _manualClockIn(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(scheduleSessionProvider.notifier).manualClockIn();
    if (success && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Clocked in successfully'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _manualClockOut(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(scheduleSessionProvider.notifier).manualClockOut();
    if (success && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Clocked out successfully'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  Future<void> _startBreak(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(scheduleSessionProvider.notifier).startBreak();
    if (success && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Break started'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  Future<void> _endBreak(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(scheduleSessionProvider.notifier).endBreak();
    if (success && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Break ended'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  Color _getStatusColor(ScheduleSessionState sessionState) {
    if (sessionState.isInOvertime) return Colors.purple;
    if (sessionState.isClockedIn) return Colors.green;
    if (sessionState.hasActiveSession) return Colors.orange;
    return Colors.blue;
  }

  Color _getStatusColorFromString(String colorName) {
    switch (colorName) {
      case 'green': return Colors.green;
      case 'red': return Colors.red;
      case 'orange': return Colors.orange;
      case 'blue': return Colors.blue;
      case 'purple': return Colors.purple;
      case 'amber': return Colors.amber;
      case 'gray': return Colors.grey;
      default: return Colors.grey;
    }
  }

  IconData _getSessionIcon(String status) {
    switch (status) {
      case 'scheduled': return Icons.schedule;
      case 'monitoring_active': return Icons.radar;
      case 'clocked_in': return Icons.work;
      case 'on_break': return Icons.coffee;
      case 'clocked_out': return Icons.work_off;
      case 'completed': return Icons.check_circle;
      case 'no_show': return Icons.warning;
      case 'overtime': return Icons.schedule;
      case 'error': return Icons.error;
      default: return Icons.help;
    }
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes % 60;
    return '${hours}h ${minutes}m';
  }

  String _formatTime(DateTime time) {
    final hour = time.hour;
    final minute = time.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
    return '$displayHour:$minute $period';
  }

  String _formatTimeUntil(Duration duration) {
    if (duration.inDays > 0) {
      return 'in ${duration.inDays}d';
    } else if (duration.inHours > 0) {
      return 'in ${duration.inHours}h';
    } else if (duration.inMinutes > 0) {
      return 'in ${duration.inMinutes}m';
    } else {
      return 'now';
    }
  }
} 