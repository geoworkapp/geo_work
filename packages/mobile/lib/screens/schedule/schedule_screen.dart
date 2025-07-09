import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../providers/auth_provider.dart';
import '../../providers/jobsites_provider.dart';
import 'package:shared/models.dart' show JobSite;
import 'package:flutter/foundation.dart';

// Schedule models matching the shared types
class Schedule {
  final String scheduleId;
  final String companyId;
  final String employeeId;
  final String employeeName;
  final String jobSiteId;
  final String jobSiteName;
  final DateTime startDateTime;
  final DateTime endDateTime;
  final String shiftType;
  final String status;
  final String? notes;
  final int breakDuration;
  final double expectedHours;
  final bool isRecurring;
  final Map<String, dynamic>? recurrence;
  final List<String>? skillsRequired;
  final List<String>? equipmentNeeded;
  final String? specialInstructions;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;

  Schedule({
    required this.scheduleId,
    required this.companyId,
    required this.employeeId,
    required this.employeeName,
    required this.jobSiteId,
    required this.jobSiteName,
    required this.startDateTime,
    required this.endDateTime,
    required this.shiftType,
    required this.status,
    this.notes,
    required this.breakDuration,
    required this.expectedHours,
    required this.isRecurring,
    this.recurrence,
    this.skillsRequired,
    this.equipmentNeeded,
    this.specialInstructions,
    this.metadata,
    required this.createdAt,
  });

  factory Schedule.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Schedule(
      scheduleId: doc.id,
      companyId: data['companyId'] ?? '',
      employeeId: data['employeeId'] ?? '',
      employeeName: data['employeeName'] ?? '',
      jobSiteId: data['jobSiteId'] ?? '',
      jobSiteName: data['jobSiteName'] ?? '',
      // Handle both old (startDateTime) and new (startTime) field formats
      startDateTime: data['startDateTime'] != null
          ? (data['startDateTime'] as Timestamp).toDate()
          : data['startTime'] != null
              ? (data['startTime'] as Timestamp).toDate()
              : DateTime.now(),
      endDateTime: data['endDateTime'] != null
          ? (data['endDateTime'] as Timestamp).toDate()
          : data['endTime'] != null
              ? (data['endTime'] as Timestamp).toDate()
              : DateTime.now().add(const Duration(hours: 8)),
      shiftType: data['shiftType'] ?? 'regular',
      status: data['status'] ?? 'scheduled',
      notes: data['notes'],
      breakDuration: data['breakDuration'] ?? 60,
      expectedHours: (data['expectedHours'] ?? 8.0).toDouble(),
      isRecurring: data['isRecurring'] ?? false,
      recurrence: data['recurrence'],
      skillsRequired: data['skillsRequired']?.cast<String>(),
      equipmentNeeded: data['equipmentNeeded']?.cast<String>(),
      specialInstructions: data['specialInstructions'],
      metadata: data['metadata'],
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    );
  }

  Duration get duration {
    return endDateTime.difference(startDateTime);
  }

  bool get isToday {
    final now = DateTime.now();
    return startDateTime.year == now.year &&
        startDateTime.month == now.month &&
        startDateTime.day == now.day;
  }

  bool get isUpcoming {
    return startDateTime.isAfter(DateTime.now());
  }

  bool get isActive {
    final now = DateTime.now();
    return now.isAfter(startDateTime) && now.isBefore(endDateTime);
  }

  Color get statusColor {
    switch (status) {
      case 'scheduled':
        return Colors.blue;
      case 'confirmed':
        return Colors.green;
      case 'in-progress':
        return Colors.orange;
      case 'completed':
        return Colors.green.shade700;
      case 'cancelled':
        return Colors.red;
      case 'no-show':
        return Colors.red.shade700;
      default:
        return Colors.grey;
    }
  }

  IconData get shiftTypeIcon {
    switch (shiftType) {
      case 'regular':
        return Icons.work;
      case 'overtime':
        return Icons.schedule;
      case 'emergency':
        return Icons.warning;
      case 'training':
        return Icons.school;
      default:
        return Icons.work;
    }
  }
}

// Provider for schedule data
final scheduleProvider = StateNotifierProvider.family<ScheduleNotifier, AsyncValue<List<Schedule>>, String>(
  (ref, userId) => ScheduleNotifier(userId),
);

class ScheduleNotifier extends StateNotifier<AsyncValue<List<Schedule>>> {
  final String userId;
  
  ScheduleNotifier(this.userId) : super(const AsyncValue.loading()) {
    loadSchedules();
  }

  Future<void> loadSchedules() async {
    try {
      state = const AsyncValue.loading();
      
      // Fetch schedules for this employee ordered by start time.
      // Filtering out past data (>30 days) is done client-side to avoid the
      // composite-index requirement that the previous query triggered.
      final querySnapshot = await FirebaseFirestore.instance
          .collection('schedules')
          .where('employeeId', isEqualTo: userId)
          .get();

      final thirtyDaysAgo = DateTime.now().subtract(const Duration(days: 30));
      final schedules = querySnapshot.docs
          .map((doc) => Schedule.fromFirestore(doc))
          .where((s) => s.endDateTime.isAfter(thirtyDaysAgo))
          .toList()
        ..sort((a, b) => a.startDateTime.compareTo(b.startDateTime));

      state = AsyncValue.data(schedules);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  List<Schedule> getSchedulesForDate(DateTime date) {
    final schedules = state.asData?.value ?? [];
    return schedules.where((schedule) {
      return schedule.startDateTime.year == date.year &&
          schedule.startDateTime.month == date.month &&
          schedule.startDateTime.day == date.day;
    }).toList();
  }

  List<Schedule> getUpcomingSchedules() {
    final schedules = state.asData?.value ?? [];
    return schedules.where((schedule) => schedule.isUpcoming).take(5).toList();
  }

  List<Schedule> getWeeklySchedules(DateTime weekStart) {
    final schedules = state.asData?.value ?? [];
    final weekEnd = weekStart.add(const Duration(days: 7));
    
    return schedules.where((schedule) {
      return schedule.startDateTime.isAfter(weekStart) &&
          schedule.startDateTime.isBefore(weekEnd);
    }).toList();
  }
}

class ScheduleScreen extends ConsumerStatefulWidget {
  const ScheduleScreen({super.key});

  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  DateTime _selectedDate = DateTime.now();
  DateTime _weekStart = DateTime.now().subtract(Duration(days: DateTime.now().weekday - 1));

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    
    if (user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final schedulesAsync = ref.watch(scheduleProvider(user.id));

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Schedule'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.today), text: 'Today'),
            Tab(icon: Icon(Icons.view_week), text: 'This Week'),
            Tab(icon: Icon(Icons.calendar_month), text: 'Monthly'),
          ],
        ),
      ),
      body: schedulesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
              const SizedBox(height: 16),
              Text('Error loading schedules', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(error.toString(), style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.refresh(scheduleProvider(user.id)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (schedules) => TabBarView(
          controller: _tabController,
          children: [
            _buildTodayView(schedules),
            _buildWeeklyView(schedules),
            _buildMonthlyView(schedules),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => ref.refresh(scheduleProvider(user.id)),
        tooltip: 'Refresh Schedule',
        child: const Icon(Icons.refresh),
      ),
    );
  }

  Widget _buildTodayView(List<Schedule> allSchedules) {
    final todaySchedules = allSchedules.where((s) => s.isToday).toList();
    
    return RefreshIndicator(
      onRefresh: () async {
        final user = ref.read(authProvider).user;
        if (user != null) {
          await ref.read(scheduleProvider(user.id).notifier).loadSchedules();
        }
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Today's Summary
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Today - ${DateFormat('EEEE, MMMM d').format(DateTime.now())}',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildSummaryItem(
                          'Shifts',
                          todaySchedules.length.toString(),
                          Icons.work,
                          Colors.blue,
                        ),
                        const SizedBox(width: 24),
                        _buildSummaryItem(
                          'Hours',
                          todaySchedules.fold<double>(0, (total, s) => total + s.expectedHours).toStringAsFixed(1),
                          Icons.access_time,
                          Colors.green,
                        ),
                        const SizedBox(width: 24),
                        _buildSummaryItem(
                          'Active',
                          todaySchedules.where((s) => s.isActive).length.toString(),
                          Icons.play_circle,
                          Colors.orange,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Today's Schedules
            if (todaySchedules.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    children: [
                      Icon(Icons.free_breakfast, size: 64, color: Colors.grey.shade400),
                      const SizedBox(height: 16),
                      Text(
                        'No shifts scheduled for today',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Enjoy your free time!',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...todaySchedules.map((schedule) => _buildScheduleCard(schedule)),
          ],
        ),
      ),
    );
  }

  Widget _buildWeeklyView(List<Schedule> allSchedules) {
    final weeklySchedules = allSchedules.where((schedule) {
      final weekEnd = _weekStart.add(const Duration(days: 7));
      return schedule.startDateTime.isAfter(_weekStart) &&
          schedule.startDateTime.isBefore(weekEnd);
    }).toList();

    return Column(
      children: [
        // Week Navigation
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: () {
                  setState(() {
                    _weekStart = _weekStart.subtract(const Duration(days: 7));
                  });
                },
                icon: const Icon(Icons.chevron_left),
              ),
              Text(
                '${DateFormat('MMM d').format(_weekStart)} - ${DateFormat('MMM d').format(_weekStart.add(const Duration(days: 6)))}',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                onPressed: () {
                  setState(() {
                    _weekStart = _weekStart.add(const Duration(days: 7));
                  });
                },
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
        
        // Weekly Summary
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildSummaryItem(
                    'Total Shifts',
                    weeklySchedules.length.toString(),
                    Icons.work,
                    Colors.blue,
                  ),
                  _buildSummaryItem(
                    'Total Hours',
                    weeklySchedules.fold<double>(0, (total, s) => total + s.expectedHours).toStringAsFixed(1),
                    Icons.schedule,
                    Colors.green,
                  ),
                  _buildSummaryItem(
                    'Job Sites',
                    weeklySchedules.map((s) => s.jobSiteId).toSet().length.toString(),
                    Icons.location_on,
                    Colors.orange,
                  ),
                ],
              ),
            ),
          ),
        ),
        
        // Daily Breakdown
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: 7,
            itemBuilder: (context, index) {
              final date = _weekStart.add(Duration(days: index));
              final daySchedules = weeklySchedules.where((schedule) {
                return schedule.startDateTime.year == date.year &&
                    schedule.startDateTime.month == date.month &&
                    schedule.startDateTime.day == date.day;
              }).toList();

              return _buildDayCard(date, daySchedules);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMonthlyView(List<Schedule> allSchedules) {
    final monthStart = DateTime(_selectedDate.year, _selectedDate.month, 1);
    final monthEnd = DateTime(_selectedDate.year, _selectedDate.month + 1, 0);
    
    final monthlySchedules = allSchedules.where((schedule) {
      return schedule.startDateTime.isAfter(monthStart) &&
          schedule.startDateTime.isBefore(monthEnd.add(const Duration(days: 1)));
    }).toList();

    return Column(
      children: [
        // Month Navigation
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: () {
                  setState(() {
                    _selectedDate = DateTime(_selectedDate.year, _selectedDate.month - 1);
                  });
                },
                icon: const Icon(Icons.chevron_left),
              ),
              Text(
                DateFormat('MMMM yyyy').format(_selectedDate),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                onPressed: () {
                  setState(() {
                    _selectedDate = DateTime(_selectedDate.year, _selectedDate.month + 1);
                  });
                },
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
        
        // Monthly Summary
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Monthly Summary',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildSummaryItem(
                        'Shifts',
                        monthlySchedules.length.toString(),
                        Icons.event,
                        Colors.blue,
                      ),
                      _buildSummaryItem(
                        'Hours',
                        monthlySchedules.fold<double>(0, (total, s) => total + s.expectedHours).toStringAsFixed(0),
                        Icons.access_time,
                        Colors.green,
                      ),
                      _buildSummaryItem(
                        'Sites',
                        monthlySchedules.map((s) => s.jobSiteId).toSet().length.toString(),
                        Icons.business,
                        Colors.orange,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        
        // Schedule List
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: monthlySchedules.length,
            itemBuilder: (context, index) {
              return _buildScheduleCard(monthlySchedules[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.grey.shade600,
          ),
        ),
      ],
    );
  }

  Widget _buildDayCard(DateTime date, List<Schedule> schedules) {
    final isToday = date.year == DateTime.now().year &&
        date.month == DateTime.now().month &&
        date.day == DateTime.now().day;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: isToday ? 4 : 1,
      color: isToday ? Theme.of(context).colorScheme.primaryContainer : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  DateFormat('EEEE, MMM d').format(date),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: isToday ? Theme.of(context).colorScheme.onPrimaryContainer : null,
                  ),
                ),
                if (isToday) ...[
                  const SizedBox(width: 8),
                  Chip(
                    label: const Text('Today'),
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    labelStyle: TextStyle(
                      color: Theme.of(context).colorScheme.onPrimary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            if (schedules.isEmpty)
              Text(
                'No shifts scheduled',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey.shade600,
                ),
              )
            else
              ...schedules.map((schedule) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => _showScheduleDetails(schedule),
                  borderRadius: BorderRadius.circular(8),
                  child: Row(
                    children: [
                      Icon(
                        schedule.shiftTypeIcon,
                        size: 16,
                        color: schedule.statusColor,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${DateFormat('HH:mm').format(schedule.startDateTime)} - ${DateFormat('HH:mm').format(schedule.endDateTime)} at ${schedule.jobSiteName}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                      Chip(
                        label: Text(schedule.status),
                        backgroundColor: schedule.statusColor.withAlpha((0.1 * 255).round()),
                        labelStyle: TextStyle(
                          color: schedule.statusColor,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              )),
          ],
        ),
      ),
    );
  }

  Widget _buildScheduleCard(Schedule schedule) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: schedule.isActive ? 4 : 2,
      child: InkWell(
        onTap: () => _showScheduleDetails(schedule),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    schedule.shiftTypeIcon,
                    color: schedule.statusColor,
                    size: 24,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          schedule.jobSiteName,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${schedule.shiftType.toUpperCase()} • ${schedule.expectedHours}h',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Chip(
                    label: Text(schedule.status),
                    backgroundColor: schedule.statusColor.withAlpha((0.1 * 255).round()),
                    labelStyle: TextStyle(
                      color: schedule.statusColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              
              Row(
                children: [
                  Icon(Icons.access_time, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Text(
                    '${DateFormat('MMM d, HH:mm').format(schedule.startDateTime)} - ${DateFormat('HH:mm').format(schedule.endDateTime)}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
              
              if (schedule.notes != null && schedule.notes!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.note, size: 16, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        schedule.notes!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.grey.shade700,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],

              if (schedule.isActive) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.green.withAlpha((0.1 * 255).round()),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.green.withAlpha((0.3 * 255).round())),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.play_circle, size: 16, color: Colors.green.shade700),
                      const SizedBox(width: 4),
                      Text(
                        'Currently Active',
                        style: TextStyle(
                          color: Colors.green.shade700,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showScheduleDetails(Schedule schedule) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Header
                Row(
                  children: [
                    Icon(
                      schedule.shiftTypeIcon,
                      color: schedule.statusColor,
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            schedule.jobSiteName,
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            schedule.shiftType.toUpperCase(),
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Chip(
                      label: Text(schedule.status),
                      backgroundColor: schedule.statusColor.withAlpha((0.1 * 255).round()),
                      labelStyle: TextStyle(
                        color: schedule.statusColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 24),
                
                // Map preview if job site has coordinates
                Builder(builder: (_) {
                  final jobSitesState = ref.read(jobSitesProvider);
                  JobSite? site;
                  final combinedSites = [
                    ...jobSitesState.jobSites,
                    ...jobSitesState.assignedJobSites,
                  ];
                  try {
                    site = combinedSites.firstWhere((js) => js.siteId == schedule.jobSiteId);
                  } catch (e) {
                    site = null;
                  }

                  if (site == null) return const SizedBox.shrink();

                  final position = LatLng(site.location.latitude, site.location.longitude);
                  final circleId = CircleId(site.siteId);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Location',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      kIsWeb
                          ? Container(
                              height: 200.0,
                              decoration: BoxDecoration(
                                color: Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              alignment: Alignment.center,
                              child: const Text('Map preview unavailable on Web'),
                            )
                          : ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: SizedBox(
                                height: 200.0,
                                child: GoogleMap(
                                  initialCameraPosition: CameraPosition(
                                    target: position,
                                    zoom: 16.0,
                                  ),
                                  markers: {
                                    Marker(
                                      markerId: MarkerId(site.siteId),
                                      position: position,
                                      infoWindow: InfoWindow(title: site.siteName),
                                    ),
                                  },
                                  circles: {
                                    Circle(
                                      circleId: circleId,
                                      center: position,
                                      radius: site.radius.toDouble(),
                                      fillColor: Colors.blue.withAlpha((0.2 * 255).round()),
                                      strokeColor: Colors.blueAccent,
                                      strokeWidth: 2,
                                    ),
                                  },
                                  myLocationButtonEnabled: false,
                                  zoomControlsEnabled: false,
                                  liteModeEnabled: true,
                                ),
                              ),
                            ),
                      const SizedBox(height: 24),
                    ],
                  );
                }),
                
                // Details
                _buildDetailItem(
                  'Date & Time',
                  '${DateFormat('EEEE, MMMM d, yyyy').format(schedule.startDateTime)}\n${DateFormat('HH:mm').format(schedule.startDateTime)} - ${DateFormat('HH:mm').format(schedule.endDateTime)}',
                  Icons.schedule,
                ),
                
                _buildDetailItem(
                  'Duration',
                  '${schedule.expectedHours} hours (${schedule.breakDuration} min break)',
                  Icons.timer,
                ),
                
                if (schedule.notes != null && schedule.notes!.isNotEmpty)
                  _buildDetailItem('Notes', schedule.notes!, Icons.note),
                
                if (schedule.specialInstructions != null && schedule.specialInstructions!.isNotEmpty)
                  _buildDetailItem('Special Instructions', schedule.specialInstructions!, Icons.info),
                
                if (schedule.skillsRequired != null && schedule.skillsRequired!.isNotEmpty)
                  _buildDetailItem(
                    'Required Skills',
                    schedule.skillsRequired!.join(', '),
                    Icons.star,
                  ),
                
                if (schedule.equipmentNeeded != null && schedule.equipmentNeeded!.isNotEmpty)
                  _buildDetailItem(
                    'Equipment Needed',
                    schedule.equipmentNeeded!.join(', '),
                    Icons.build,
                  ),
                
                const SizedBox(height: 24),
                
                // Action buttons
                if (schedule.isUpcoming && schedule.status == 'scheduled')
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        _confirmSchedule(schedule);
                      },
                      icon: const Icon(Icons.check),
                      label: const Text('Confirm Attendance'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailItem(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Colors.grey.shade600),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _confirmSchedule(Schedule schedule) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Attendance'),
        content: Text('Confirm your attendance for the shift at ${schedule.jobSiteName}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              final scaffoldMessenger = ScaffoldMessenger.of(context);
              
              // Update schedule status to confirmed
              await FirebaseFirestore.instance
                  .collection('schedules')
                  .doc(schedule.scheduleId)
                  .update({'status': 'confirmed'});
              
              // Refresh the data
              final user = ref.read(authProvider).user;
              if (user != null) {
                await ref.read(scheduleProvider(user.id).notifier).loadSchedules();
              }
              
              if (mounted) {
                scaffoldMessenger.showSnackBar(
                  const SnackBar(
                    content: Text('Attendance confirmed successfully'),
                    backgroundColor: Colors.green,
                  ),
                );
              }
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}