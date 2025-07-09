import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../providers/schedule_session_provider.dart';
import '../../models/schedule_session.dart';

class ScheduleTimesheetScreen extends ConsumerStatefulWidget {
  const ScheduleTimesheetScreen({super.key});

  @override
  ConsumerState<ScheduleTimesheetScreen> createState() => _ScheduleTimesheetScreenState();
}

class _ScheduleTimesheetScreenState extends ConsumerState<ScheduleTimesheetScreen> 
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  DateTimeRange? _selectedDateRange;
  String _selectedFilter = 'all'; // 'all', 'active', 'completed', 'monitoring'

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _selectedDateRange = DateTimeRange(
      start: DateTime.now().subtract(const Duration(days: 7)),
      end: DateTime.now(),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(scheduleSessionProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Schedule Sessions'),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Today', icon: Icon(Icons.today)),
            Tab(text: 'This Week', icon: Icon(Icons.view_week)),
            Tab(text: 'History', icon: Icon(Icons.history)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.read(scheduleSessionProvider.notifier).refresh();
            },
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'export') {
                _showExportDialog();
              } else if (value == 'filter') {
                _showFilterDialog();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'filter',
                child: Row(
                  children: [
                    Icon(Icons.filter_list),
                    SizedBox(width: 8),
                    Text('Filter'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'export',
                child: Row(
                  children: [
                    Icon(Icons.download),
                    SizedBox(width: 8),
                    Text('Export'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Today Tab
          _buildTodayView(sessionState),
          // This Week Tab
          _buildWeekView(sessionState),
          // History Tab
          _buildHistoryView(sessionState),
        ],
      ),
      floatingActionButton: sessionState.hasActiveSession
          ? null // No manual actions needed - automatic system
          : FloatingActionButton.extended(
              onPressed: () {
                Navigator.of(context).pop(); // Go back to dashboard
              },
              icon: const Icon(Icons.schedule),
              label: const Text('View Schedules'),
            ),
    );
  }

  Widget _buildTodayView(ScheduleSessionState state) {
    final todaySessions = state.todaySessions;
    final currentSession = state.currentSession;

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(scheduleSessionProvider.notifier).refresh();
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Today's Summary Card
            _buildTodaySummaryCard(currentSession, todaySessions),
            
            const SizedBox(height: 24),
            
            // Current Session Status
            if (currentSession != null) _buildCurrentSessionCard(currentSession),
            
            const SizedBox(height: 24),
            
            // Today's Sessions
            Text(
              'Today\'s Schedule Sessions',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            
            const SizedBox(height: 16),
            
            if (todaySessions.isEmpty)
              _buildEmptyState('No scheduled sessions today', 'Check your schedule for upcoming sessions')
            else
              ...todaySessions.map((session) => _buildSessionCard(session)),
          ],
        ),
      ),
    );
  }

  Widget _buildWeekView(ScheduleSessionState state) {
    // Calculate week's data
    final now = DateTime.now();
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final weekSessions = state.recentSessions.where((session) {
      return session.scheduledStartTime.isAfter(startOfWeek);
    }).toList();

    final dailySummaries = _calculateDailySummaries(weekSessions);

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(scheduleSessionProvider.notifier).refresh();
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Week Summary Card
            _buildWeekSummaryCard(weekSessions),
            
            const SizedBox(height: 24),
            
            // Daily Breakdown
            Text(
              'Daily Breakdown',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            
            const SizedBox(height: 16),
            
            ...dailySummaries.entries.map((entry) => 
              _buildDailySummaryCard(entry.key, entry.value)),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryView(ScheduleSessionState state) {
    final recentSessions = state.recentSessions;
    final filteredSessions = _applyFilter(recentSessions);

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(scheduleSessionProvider.notifier).refresh();
      },
      child: Column(
        children: [
          // Date Range Picker
          Container(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _selectDateRange,
                    icon: const Icon(Icons.date_range),
                    label: Text(_selectedDateRange != null 
                        ? '${DateFormat.MMMd().format(_selectedDateRange!.start)} - ${DateFormat.MMMd().format(_selectedDateRange!.end)}'
                        : 'Select Date Range'),
                  ),
                ),
                const SizedBox(width: 16),
                IconButton(
                  onPressed: _showFilterDialog,
                  icon: Icon(
                    Icons.filter_list,
                    color: _selectedFilter != 'all' ? Theme.of(context).primaryColor : null,
                  ),
                ),
              ],
            ),
          ),
          
          // Sessions List
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: filteredSessions.length,
              itemBuilder: (context, index) {
                return _buildSessionCard(filteredSessions[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTodaySummaryCard(ScheduleSession? currentSession, List<ScheduleSession> todaySessions) {
    final totalScheduledMinutes = todaySessions.fold<int>(0, (sum, session) => sum + session.totalScheduledTime);
    final totalWorkedMinutes = todaySessions.fold<int>(0, (sum, session) => sum + session.totalWorkedTime);
    final completedSessions = todaySessions.where((s) => s.status == 'completed').length;

    return Card(
      color: Theme.of(context).primaryColor.withAlpha((0.05 * 255).round()),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Today\'s Summary',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildSummaryItem(
                    'Scheduled',
                    _formatDuration(Duration(minutes: totalScheduledMinutes)),
                    Icons.schedule,
                    Colors.blue,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Worked',
                    _formatDuration(Duration(minutes: totalWorkedMinutes)),
                    Icons.work,
                    Colors.green,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Sessions',
                    '$completedSessions/${todaySessions.length}',
                    Icons.checklist,
                    Colors.orange,
                  ),
                ),
              ],
            ),
            if (currentSession != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _getStatusColor(currentSession.status).withAlpha((0.1 * 255).round()),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: _getStatusColor(currentSession.status).withAlpha((0.3 * 255).round()),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _getStatusIcon(currentSession.status),
                      color: _getStatusColor(currentSession.status),
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Currently ${currentSession.statusText} at ${currentSession.jobSiteName}',
                      style: TextStyle(
                        color: _getStatusColor(currentSession.status),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentSessionCard(ScheduleSession session) {
    final now = DateTime.now();
    final sessionDuration = session.clockedIn && session.clockInTime != null
        ? now.difference(session.clockInTime!)
        : Duration.zero;

    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.work, color: Colors.green.shade700),
                const SizedBox(width: 8),
                Text(
                  'Current Session',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Colors.green.shade700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              session.jobSiteName,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.schedule, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  '${DateFormat.jm().format(session.scheduledStartTime)} - ${DateFormat.jm().format(session.scheduledEndTime)}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.timer, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  'Working for ${_formatDuration(sessionDuration)}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusColor(session.status),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    session.statusText,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (session.autoClockInTriggered) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.blue.withAlpha((0.1 * 255).round()),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.blue.withAlpha((0.3 * 255).round())),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.auto_mode, size: 12, color: Colors.blue),
                        SizedBox(width: 4),
                        Text(
                          'AUTO',
                          style: TextStyle(
                            color: Colors.blue,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSessionCard(ScheduleSession session) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.jobSiteName,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        DateFormat.yMMMd().add_jm().format(session.scheduledStartTime),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusColor(session.status),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    session.statusText,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildSessionMetric(
                    'Scheduled',
                    _formatDuration(Duration(minutes: session.totalScheduledTime)),
                    Icons.schedule,
                  ),
                ),
                Expanded(
                  child: _buildSessionMetric(
                    'Worked',
                    _formatDuration(Duration(minutes: session.totalWorkedTime)),
                    Icons.work,
                  ),
                ),
                if (session.punctualityScore < 100)
                  Expanded(
                    child: _buildSessionMetric(
                      'Punctuality',
                      '${session.punctualityScore.toInt()}%',
                      Icons.schedule,
                    ),
                  ),
              ],
            ),
            if (session.events.isNotEmpty) ...[
              const SizedBox(height: 12),
              ExpansionTile(
                title: Text('Session Events (${session.events.length})'),
                children: session.events.take(5).map((event) => 
                  ListTile(
                    dense: true,
                    leading: Icon(_getEventIcon(event.eventType), size: 16),
                    title: Text(event.details),
                    subtitle: Text(DateFormat.jm().format(event.timestamp)),
                  ),
                ).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildWeekSummaryCard(List<ScheduleSession> weekSessions) {
    final totalScheduledMinutes = weekSessions.fold<int>(0, (sum, session) => sum + session.totalScheduledTime);
    final totalWorkedMinutes = weekSessions.fold<int>(0, (sum, session) => sum + session.totalWorkedTime);
    final completedSessions = weekSessions.where((s) => s.status == 'completed').length;
    final averagePunctuality = weekSessions.isNotEmpty 
        ? weekSessions.fold<double>(0, (sum, session) => sum + session.punctualityScore) / weekSessions.length
        : 100.0;

    return Card(
      color: Theme.of(context).primaryColor.withAlpha((0.05 * 255).round()),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This Week\'s Summary',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildSummaryItem(
                    'Total Scheduled',
                    _formatDuration(Duration(minutes: totalScheduledMinutes)),
                    Icons.schedule,
                    Colors.blue,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Total Worked',
                    _formatDuration(Duration(minutes: totalWorkedMinutes)),
                    Icons.work,
                    Colors.green,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildSummaryItem(
                    'Completed',
                    '$completedSessions/${weekSessions.length}',
                    Icons.checklist,
                    Colors.orange,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Punctuality',
                    '${averagePunctuality.toInt()}%',
                    Icons.schedule,
                    averagePunctuality >= 90 ? Colors.green : averagePunctuality >= 75 ? Colors.orange : Colors.red,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildSessionMetric(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDailySummaryCard(DateTime date, Map<String, dynamic> summary) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              DateFormat.yMMMd().format(date),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildSessionMetric(
                    'Sessions',
                    '${summary['completed']}/${summary['total']}',
                    Icons.checklist,
                  ),
                ),
                Expanded(
                  child: _buildSessionMetric(
                    'Hours',
                    _formatDuration(Duration(minutes: summary['workedMinutes'])),
                    Icons.work,
                  ),
                ),
                if (summary['punctuality'] != null)
                  Expanded(
                    child: _buildSessionMetric(
                      'Punctuality',
                      '${summary['punctuality'].toInt()}%',
                      Icons.schedule,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(String title, String subtitle) {
    return Center(
      child: Column(
        children: [
          const SizedBox(height: 40),
          Icon(
            Icons.schedule,
            size: 80,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.grey[500],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // Helper Methods
  List<ScheduleSession> _applyFilter(List<ScheduleSession> sessions) {
    switch (_selectedFilter) {
      case 'active':
        return sessions.where((s) => ['monitoring_active', 'clocked_in', 'on_break'].contains(s.status)).toList();
      case 'completed':
        return sessions.where((s) => s.status == 'completed').toList();
      case 'monitoring':
        return sessions.where((s) => s.status == 'monitoring_active').toList();
      default:
        return sessions;
    }
  }

  Map<DateTime, Map<String, dynamic>> _calculateDailySummaries(List<ScheduleSession> sessions) {
    final Map<DateTime, Map<String, dynamic>> summaries = {};
    
    for (final session in sessions) {
      final date = DateTime(
        session.scheduledStartTime.year,
        session.scheduledStartTime.month,
        session.scheduledStartTime.day,
      );
      
      if (!summaries.containsKey(date)) {
        summaries[date] = {
          'total': 0,
          'completed': 0,
          'workedMinutes': 0,
          'punctualitySum': 0.0,
        };
      }
      
      summaries[date]!['total']++;
      summaries[date]!['workedMinutes'] += session.totalWorkedTime;
      summaries[date]!['punctualitySum'] += session.punctualityScore;
      
      if (session.status == 'completed') {
        summaries[date]!['completed']++;
      }
    }
    
    // Calculate average punctuality
    summaries.forEach((date, summary) {
      if (summary['total'] > 0) {
        summary['punctuality'] = summary['punctualitySum'] / summary['total'];
      }
    });
    
    return summaries;
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes % 60;
    
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    } else {
      return '${minutes}m';
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'scheduled':
        return Colors.blue;
      case 'monitoring_active':
        return Colors.orange;
      case 'clocked_in':
        return Colors.green;
      case 'on_break':
        return Colors.amber;
      case 'clocked_out':
        return Colors.grey;
      case 'completed':
        return Colors.green;
      case 'no_show':
        return Colors.red;
      case 'overtime':
        return Colors.purple;
      case 'error':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'scheduled':
        return Icons.schedule;
      case 'monitoring_active':
        return Icons.visibility;
      case 'clocked_in':
        return Icons.work;
      case 'on_break':
        return Icons.pause;
      case 'clocked_out':
        return Icons.work_off;
      case 'completed':
        return Icons.check_circle;
      case 'no_show':
        return Icons.error;
      case 'overtime':
        return Icons.access_time;
      case 'error':
        return Icons.error;
      default:
        return Icons.help;
    }
  }

  IconData _getEventIcon(String eventType) {
    switch (eventType) {
      case 'session_created':
        return Icons.add_circle;
      case 'monitoring_started':
        return Icons.visibility;
      case 'employee_arrived':
        return Icons.location_on;
      case 'auto_clock_in':
        return Icons.play_arrow;
      case 'manual_clock_in':
        return Icons.touch_app;
      case 'break_started':
        return Icons.pause;
      case 'break_ended':
        return Icons.play_arrow;
      case 'auto_clock_out':
        return Icons.stop;
      case 'manual_clock_out':
        return Icons.stop;
      case 'session_completed':
        return Icons.check_circle;
      case 'overtime_started':
        return Icons.access_time;
      case 'admin_override':
        return Icons.admin_panel_settings;
      case 'error_occurred':
        return Icons.error;
      default:
        return Icons.info;
    }
  }

  void _selectDateRange() async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
      initialDateRange: _selectedDateRange,
    );
    
    if (picked != null) {
      setState(() {
        _selectedDateRange = picked;
      });
    }
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Filter Sessions'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RadioListTile<String>(
              value: 'all',
              groupValue: _selectedFilter,
              title: const Text('All Sessions'),
              onChanged: (value) {
                setState(() => _selectedFilter = value!);
                Navigator.pop(context);
              },
            ),
            RadioListTile<String>(
              value: 'active',
              groupValue: _selectedFilter,
              title: const Text('Active Sessions'),
              onChanged: (value) {
                setState(() => _selectedFilter = value!);
                Navigator.pop(context);
              },
            ),
            RadioListTile<String>(
              value: 'completed',
              groupValue: _selectedFilter,
              title: const Text('Completed Sessions'),
              onChanged: (value) {
                setState(() => _selectedFilter = value!);
                Navigator.pop(context);
              },
            ),
            RadioListTile<String>(
              value: 'monitoring',
              groupValue: _selectedFilter,
              title: const Text('Monitoring Only'),
              onChanged: (value) {
                setState(() => _selectedFilter = value!);
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showExportDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Export Timesheet'),
        content: const Text('Export functionality will be available in a future update.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
} 