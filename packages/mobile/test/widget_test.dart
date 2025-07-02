// This is a basic Flutter widget test for GeoWork Time Tracker.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/main.dart';

void main() {
  testWidgets('GeoWork app loads correctly', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: GeoWorkApp(),
      ),
    );

    // Verify that the loading screen appears initially
    expect(find.text('GeoWork'), findsOneWidget);
    expect(find.text('Loading...'), findsOneWidget);
  });
}
