# Mobile App Setup Instructions

## 🔧 Fixing Current Linter Errors

The current linter errors in `schedule_session_provider.dart` and `schedule_session.dart` are **expected** and will be resolved by running Dart code generation.

### Quick Fix (Run in packages/mobile/):

```bash
# Install dependencies
flutter pub get

# Generate missing code files
flutter packages pub run build_runner build

# Or for continuous generation during development
flutter packages pub run build_runner watch
```

### What This Generates:

The `build_runner` will create these missing files:
- `lib/models/schedule_session.freezed.dart` - Freezed generated classes
- `lib/models/schedule_session.g.dart` - JSON serialization methods

### Expected Results:

✅ All linter errors in `schedule_session.dart` will be resolved  
✅ All linter errors in `schedule_session_provider.dart` will be resolved  
✅ Code generation provides:
- Immutable data classes with `copyWith()` methods
- JSON serialization (`toJson()`, `fromJson()`)
- Equality and `toString()` implementations
- Type-safe constructors and properties

### Important Notes:

1. **Always run `flutter packages pub run build_runner build` after:**
   - Adding new `@freezed` classes
   - Modifying existing `@freezed` classes
   - Pulling code changes that affect model files

2. **The generated files should NOT be edited manually** - they will be overwritten

3. **Use `flutter packages pub run build_runner watch`** during development to automatically regenerate on file changes

### Alternative Commands:

```bash
# Clean and rebuild all generated files
flutter packages pub run build_runner build --delete-conflicting-outputs

# Clean generated files only
flutter packages pub run build_runner clean
```

## 📱 Running the App After Setup

Once code generation is complete:

```bash
# Run the app
flutter run

# Run with auto-tracking dashboard
flutter run --dart-define=USE_AUTO_TRACKING=true
```

## 🚀 Development Workflow

1. Make changes to model files
2. Run `flutter packages pub run build_runner build`
3. Verify no linter errors remain
4. Test the app functionality
5. Commit both source and generated files to git

The automatic schedule tracking system will be fully functional once these setup steps are completed! 