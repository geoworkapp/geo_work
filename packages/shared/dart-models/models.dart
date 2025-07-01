// Dart models that mirror the TypeScript interfaces
// These should be kept in sync with packages/shared/types/index.ts

import 'package:json_annotation/json_annotation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'models.freezed.dart';
part 'models.g.dart';

@freezed
class User with _$User {
  const factory User({
    required String uid,
    required String email,
    required String displayName,
    required String companyId,
    required String role, // 'admin' | 'employee'
    double? hourlyWage,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

@freezed
class Company with _$Company {
  const factory Company({
    required String companyId,
    required String companyName,
    required String ownerUid,
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Company;

  factory Company.fromJson(Map<String, dynamic> json) => _$CompanyFromJson(json);
}

@freezed
class Location with _$Location {
  const factory Location({
    required double latitude,
    required double longitude,
  }) = _Location;

  factory Location.fromJson(Map<String, dynamic> json) => _$LocationFromJson(json);
}

@freezed
class JobSite with _$JobSite {
  const factory JobSite({
    required String siteId,
    required String companyId,
    required String siteName,
    required String address,
    required Location location,
    required int radius, // in meters
    required bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _JobSite;

  factory JobSite.fromJson(Map<String, dynamic> json) => _$JobSiteFromJson(json);
}

@freezed
class DeviceInfo with _$DeviceInfo {
  const factory DeviceInfo({
    required String platform,
    required String appVersion,
  }) = _DeviceInfo;

  factory DeviceInfo.fromJson(Map<String, dynamic> json) => _$DeviceInfoFromJson(json);
}

@freezed
class TimeEntry with _$TimeEntry {
  const factory TimeEntry({
    required String entryId,
    required String userId,
    required String siteId,
    required String companyId,
    required String eventType, // 'enter' | 'exit'
    required DateTime timestamp,
    required String method, // 'automatic' | 'manual'
    DeviceInfo? deviceInfo,
    required DateTime createdAt,
  }) = _TimeEntry;

  factory TimeEntry.fromJson(Map<String, dynamic> json) => _$TimeEntryFromJson(json);
}

@freezed
class CompletedShift with _$CompletedShift {
  const factory CompletedShift({
    required String shiftId,
    required String userId,
    required String siteId,
    required String companyId,
    required DateTime enterTime,
    required DateTime exitTime,
    required int durationMinutes,
    required double hourlyWage,
    required double totalPay,
    required bool isApproved,
    String? notes,
    required DateTime createdAt,
  }) = _CompletedShift;

  factory CompletedShift.fromJson(Map<String, dynamic> json) => _$CompletedShiftFromJson(json);
}

// API Request/Response classes
@freezed
class CreateJobSiteRequest with _$CreateJobSiteRequest {
  const factory CreateJobSiteRequest({
    required String siteName,
    required String address,
    required double latitude,
    required double longitude,
    required int radius,
  }) = _CreateJobSiteRequest;

  factory CreateJobSiteRequest.fromJson(Map<String, dynamic> json) => _$CreateJobSiteRequestFromJson(json);
}

@freezed
class GenerateReportRequest with _$GenerateReportRequest {
  const factory GenerateReportRequest({
    required String userId,
    required DateTime startDate,
    required DateTime endDate,
  }) = _GenerateReportRequest;

  factory GenerateReportRequest.fromJson(Map<String, dynamic> json) => _$GenerateReportRequestFromJson(json);
}

@freezed
class GenerateReportResponse with _$GenerateReportResponse {
  const factory GenerateReportResponse({
    required List<CompletedShift> shifts,
    required double totalHours,
    required double totalPay,
    required List<TimeEntry> anomalies,
  }) = _GenerateReportResponse;

  factory GenerateReportResponse.fromJson(Map<String, dynamic> json) => _$GenerateReportResponseFromJson(json);
}

// State management classes
@freezed
class AuthState with _$AuthState {
  const factory AuthState({
    User? user,
    required bool loading,
    String? error,
  }) = _AuthState;

  factory AuthState.fromJson(Map<String, dynamic> json) => _$AuthStateFromJson(json);
}

@freezed
class MapCenter with _$MapCenter {
  const factory MapCenter({
    required double lat,
    required double lng,
  }) = _MapCenter;

  factory MapCenter.fromJson(Map<String, dynamic> json) => _$MapCenterFromJson(json);
}

@freezed
class MapState with _$MapState {
  const factory MapState({
    required MapCenter center,
    required double zoom,
    JobSite? selectedSite,
  }) = _MapState;

  factory MapState.fromJson(Map<String, dynamic> json) => _$MapStateFromJson(json);
} 