import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../providers/time_tracking_provider.dart';

class TimesheetScreen extends ConsumerStatefulWidget {
  const TimesheetScreen({super.key});

  @override
  ConsumerState<TimesheetScreen> createState() => _TimesheetScreenState();
}

class _TimesheetScreenState extends ConsumerState<TimesheetScreen> 
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  DateTimeRange? _selectedDateRange;
  String _selectedFilter = 'all'; // 'all', 'clockIn', 'clockOut', 'break'

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
    final timeTrackingState = ref.watch(timeTrackingProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Timesheet'),
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
              ref.read(timeTrackingProvider.notifier).refresh();
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
          _buildTodayView(timeTrackingState),
          // This Week Tab
          _buildWeekView(timeTrackingState),
          // History Tab
          _buildHistoryView(timeTrackingState),
        ],
      ),
      floatingActionButton: timeTrackingState.currentShift == null
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.of(context).pop(); // Go back to dashboard to clock in
              },
              icon: const Icon(Icons.play_arrow),
              label: const Text('Clock In'),
            )
          : FloatingActionButton.extended(
              onPressed: () async {
                final scaffoldMessenger = ScaffoldMessenger.of(context);
                final success = await ref.read(timeTrackingProvider.notifier).clockOut();
                if (success && mounted) {
                  scaffoldMessenger.showSnackBar(
                    const SnackBar(
                      content: Text('Clocked out successfully'),
                      backgroundColor: Colors.green,
                    ),
                  );
                }
              },
              icon: const Icon(Icons.stop),
              label: const Text('Clock Out'),
              backgroundColor: Colors.red,
            ),
    );
  }

  Widget _buildTodayView(TimeTrackingState state) {
    final todayEntries = state.todayEntries;
    final currentShift = state.currentShift;

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(timeTrackingProvider.notifier).refresh();
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Today's Summary Card
            _buildTodaySummaryCard(currentShift, todayEntries),
            
            const SizedBox(height: 24),
            
            // Current Status
            if (currentShift != null) _buildCurrentStatusCard(currentShift),
            
            const SizedBox(height: 24),
            
            // Today's Entries
            Text(
              'Today\'s Activity',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            
            const SizedBox(height: 16),
            
            if (todayEntries.isEmpty)
              _buildEmptyState('No activity today', 'Clock in to start tracking your time')
            else
              ...todayEntries.map((entry) => _buildTimeEntryCard(entry)),
          ],
        ),
      ),
    );
  }

  Widget _buildWeekView(TimeTrackingState state) {
    // Calculate week's data
    final now = DateTime.now();
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final weeklyEntries = state.recentEntries.where((entry) {
      return entry.timestamp.isAfter(startOfWeek);
    }).toList();

    final dailySummaries = _calculateDailySummaries(weeklyEntries);

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(timeTrackingProvider.notifier).refresh();
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Week Summary Card
            _buildWeekSummaryCard(weeklyEntries),
            
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
              _buildDailySummaryCard(entry.key, entry.value)
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryView(TimeTrackingState state) {
    final filteredEntries = _filterEntries(state.recentEntries);

    return Column(
      children: [
        // Date Range Picker
        Container(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _selectDateRange,
                  icon: const Icon(Icons.date_range),
                  label: Text(
                    _selectedDateRange != null
                        ? '${DateFormat('MMM d').format(_selectedDateRange!.start)} - ${DateFormat('MMM d').format(_selectedDateRange!.end)}'
                        : 'Select Date Range',
                  ),
                ),
              ),
              const SizedBox(width: 8),
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
        
        // Entries List
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              await ref.read(timeTrackingProvider.notifier).refresh();
            },
            child: filteredEntries.isEmpty
                ? _buildEmptyState(
                    'No entries found',
                    'Try adjusting your date range or filters'
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filteredEntries.length,
                    itemBuilder: (context, index) {
                      return _buildTimeEntryCard(filteredEntries[index]);
                    },
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildTodaySummaryCard(CurrentShift? currentShift, List<TimeEntry> todayEntries) {
    final totalWorked = _calculateTotalWorkedToday(currentShift, todayEntries);
    final totalBreak = _calculateTotalBreakToday(todayEntries);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.today,
                  color: Theme.of(context).primaryColor,
                ),
                const SizedBox(width: 8),
                Text(
                  'Today - ${DateFormat('EEEE, MMM d').format(DateTime.now())}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(
                  child: _buildSummaryItem(
                    'Total Worked',
                    _formatDuration(totalWorked),
                    Icons.work,
                    Colors.green,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Break Time',
                    _formatDuration(totalBreak),
                    Icons.coffee,
                    Colors.orange,
                  ),
                ),
              ],
            ),
            
            if (currentShift != null) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildSummaryItem(
                      'Current Shift',
                      _formatDuration(
                        DateTime.now().difference(currentShift.startTime)
                      ),
                      Icons.timer,
                      Theme.of(context).primaryColor,
                    ),
                  ),
                  Expanded(
                    child: _buildSummaryItem(
                      'At Location',
                      currentShift.jobSiteName,
                      Icons.location_on,
                      Colors.blue,
                    ),
                  ),
                ],
              ),
            ]
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentStatusCard(CurrentShift currentShift) {
    return Card(
      color: Theme.of(context).primaryColor.withAlpha((0.1 * 255).round()),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.work,
                color: Colors.white,
                size: 24,
              ),
            ),
            
            const SizedBox(width: 16),
            
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Currently Working',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'At ${currentShift.jobSiteName}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  Text(
                    'Started ${DateFormat('h:mm a').format(currentShift.startTime)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: currentShift.isOnBreak ? Colors.orange : Colors.green,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                currentShift.isOnBreak ? 'ON BREAK' : 'ACTIVE',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimeEntryCard(TimeEntry entry) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _getStatusColor(entry.status).withAlpha((0.2 * 255).round()),
          child: Icon(
            _getStatusIcon(entry.status),
            color: _getStatusColor(entry.status),
          ),
        ),
        title: Text(
          _getStatusText(entry.status),
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(entry.jobSiteName),
            Text(
              DateFormat('h:mm:ss a').format(entry.timestamp),
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${entry.distanceFromJobSite.toInt()}m',
              style: TextStyle(
                fontSize: 12,
                color: entry.distanceFromJobSite <= 50 
                    ? Colors.green 
                    : Colors.orange,
                fontWeight: FontWeight.w500,
              ),
            ),
            Icon(
              Icons.location_on,
              size: 12,
              color: entry.distanceFromJobSite <= 50 
                  ? Colors.green 
                  : Colors.orange,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeekSummaryCard(List<TimeEntry> weeklyEntries) {
    final totalHours = _calculateTotalWeeklyHours(weeklyEntries);
    final avgDailyHours = totalHours / 7;
    final workDays = _calculateWorkDays(weeklyEntries);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This Week Summary',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            
            const SizedBox(height: 16),
            
            Row(
              children: [
                Expanded(
                  child: _buildSummaryItem(
                    'Total Hours',
                    '${totalHours.toStringAsFixed(1)}h',
                    Icons.schedule,
                    Colors.blue,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Daily Average',
                    '${avgDailyHours.toStringAsFixed(1)}h',
                    Icons.trending_up,
                    Colors.green,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Work Days',
                    '$workDays days',
                    Icons.calendar_today,
                    Colors.orange,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDailySummaryCard(DateTime date, DailySummary summary) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).primaryColor.withAlpha((0.2 * 255).round()),
          child: Text(
            '${date.day}',
            style: TextStyle(
              color: Theme.of(context).primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Text(
          DateFormat('EEEE, MMM d').format(date),
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        subtitle: Text(
          summary.totalHours > 0 
              ? '${summary.totalHours.toStringAsFixed(1)} hours worked'
              : 'No work recorded',
        ),
        trailing: summary.totalHours > 0
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${summary.clockIns} entries',
                    style: const TextStyle(fontSize: 12),
                  ),
                  Icon(
                    summary.totalHours >= 8 ? Icons.check_circle : Icons.schedule,
                    color: summary.totalHours >= 8 ? Colors.green : Colors.orange,
                    size: 16,
                  ),
                ],
              )
            : const Icon(Icons.remove_circle_outline, color: Colors.grey),
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
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildEmptyState(String title, String subtitle) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.schedule,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  // Helper methods
  IconData _getStatusIcon(TimeEntryStatus status) {
    switch (status) {
      case TimeEntryStatus.clockedIn:
        return Icons.play_arrow;
      case TimeEntryStatus.clockedOut:
        return Icons.stop;
      case TimeEntryStatus.onBreak:
        return Icons.coffee;
      case TimeEntryStatus.breakEnded:
        return Icons.work;
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

  String _getStatusText(TimeEntryStatus status) {
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

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes % 60;
    return '${hours}h ${minutes}m';
  }

  Duration _calculateTotalWorkedToday(CurrentShift? currentShift, List<TimeEntry> todayEntries) {
    // Implementation to calculate total worked time
    if (currentShift != null) {
      return DateTime.now().difference(currentShift.startTime) - currentShift.breakDuration;
    }
    
    // Calculate from completed shifts
    Duration total = Duration.zero;
    TimeEntry? lastClockIn;
    
    for (final entry in todayEntries.reversed) {
      if (entry.status == TimeEntryStatus.clockedIn) {
        lastClockIn = entry;
      } else if (entry.status == TimeEntryStatus.clockedOut && lastClockIn != null) {
        total = total + entry.timestamp.difference(lastClockIn.timestamp);
        lastClockIn = null;
      }
    }
    
    return total;
  }

  Duration _calculateTotalBreakToday(List<TimeEntry> todayEntries) {
    Duration total = Duration.zero;
    TimeEntry? breakStart;
    
    for (final entry in todayEntries.reversed) {
      if (entry.status == TimeEntryStatus.onBreak) {
        breakStart = entry;
      } else if (entry.status == TimeEntryStatus.breakEnded && breakStart != null) {
        total = total + entry.timestamp.difference(breakStart.timestamp);
        breakStart = null;
      }
    }
    
    return total;
  }

  double _calculateTotalWeeklyHours(List<TimeEntry> weeklyEntries) {
    // Implementation to calculate weekly hours
    return 35.5; // Placeholder
  }

  int _calculateWorkDays(List<TimeEntry> weeklyEntries) {
    final workDays = <DateTime>{};
    for (final entry in weeklyEntries) {
      if (entry.status == TimeEntryStatus.clockedIn) {
        final date = DateTime(entry.timestamp.year, entry.timestamp.month, entry.timestamp.day);
        workDays.add(date);
      }
    }
    return workDays.length;
  }

  Map<DateTime, DailySummary> _calculateDailySummaries(List<TimeEntry> entries) {
    final summaries = <DateTime, DailySummary>{};
    // Implementation to calculate daily summaries
    return summaries;
  }

  List<TimeEntry> _filterEntries(List<TimeEntry> entries) {
    var filtered = entries;
    
    if (_selectedDateRange != null) {
      filtered = filtered.where((entry) {
        return entry.timestamp.isAfter(_selectedDateRange!.start) &&
               entry.timestamp.isBefore(_selectedDateRange!.end.add(const Duration(days: 1)));
      }).toList();
    }
    
    if (_selectedFilter != 'all') {
      final targetStatus = TimeEntryStatus.values.firstWhere(
        (status) => status.name == _selectedFilter,
        orElse: () => TimeEntryStatus.clockedIn,
      );
      filtered = filtered.where((entry) => entry.status == targetStatus).toList();
    }
    
    return filtered;
  }

  Future<void> _selectDateRange() async {
    final picked = await showDateRangePicker(
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
        title: const Text('Filter Entries'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RadioListTile<String>(
              title: const Text('All Entries'),
              value: 'all',
              groupValue: _selectedFilter,
              onChanged: (value) {
                setState(() {
                  _selectedFilter = value!;
                });
                Navigator.pop(context);
              },
            ),
            RadioListTile<String>(
              title: const Text('Clock In Only'),
              value: 'clockedIn',
              groupValue: _selectedFilter,
              onChanged: (value) {
                setState(() {
                  _selectedFilter = value!;
                });
                Navigator.pop(context);
              },
            ),
            RadioListTile<String>(
              title: const Text('Clock Out Only'),
              value: 'clockedOut',
              groupValue: _selectedFilter,
              onChanged: (value) {
                setState(() {
                  _selectedFilter = value!;
                });
                Navigator.pop(context);
              },
            ),
            RadioListTile<String>(
              title: const Text('Breaks Only'),
              value: 'onBreak',
              groupValue: _selectedFilter,
              onChanged: (value) {
                setState(() {
                  _selectedFilter = value!;
                });
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
        content: const Text('Export functionality will be available in the next update.'),
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

// Helper class for daily summaries
class DailySummary {
  final double totalHours;
  final int clockIns;
  final int clockOuts;
  final Duration breakTime;

  DailySummary({
    required this.totalHours,
    required this.clockIns,
    required this.clockOuts,
    required this.breakTime,
  });
}