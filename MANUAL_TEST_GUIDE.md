# Manual Testing Guide for Zoom Button Fix

## Test Scenarios

### 1. Basic Zoom Operations
**Test**: Normal zoom in/out functionality
- Open the app and navigate to the Discovery/Map screen
- Tap the zoom in button (+) multiple times
- Verify the map zooms in smoothly without crashes
- Tap the zoom out button (-) multiple times
- Verify the map zooms out smoothly without crashes

**Expected Result**: ✅ Map zooms in and out without any crashes

### 2. Rapid Zoom Tapping
**Test**: Quick successive zoom button taps
- Rapidly tap the zoom in button (+) 10-15 times
- Wait for animations to complete
- Rapidly tap the zoom out button (-) 10-15 times

**Expected Result**: ✅ App handles rapid taps without crashing, zoom animations work correctly

### 3. Navigation During Zoom
**Test**: Leave screen while zoom animation is in progress
- Tap zoom in button to start animation
- Immediately navigate to another screen (e.g., tap the hamburger menu)
- Navigate back to the map screen
- Repeat with zoom out button

**Expected Result**: ✅ No crashes when navigating away during animation

### 4. Zoom During Map Animation
**Test**: Use zoom buttons during flyTo/cluster animations
- Tap on a cluster to trigger a flyTo animation
- While the animation is in progress, tap the zoom in button
- Verify the app doesn't crash
- Repeat with zoom out button

**Expected Result**: ✅ Zoom operations interrupt the animation gracefully without crashes

### 5. Min/Max Zoom Limits
**Test**: Zoom limits are respected
- Zoom in to maximum level (should stop at zoom level 12)
- Try to zoom in further - button should still work without crash
- Zoom out to minimum level (should stop at zoom level 1)
- Try to zoom out further - button should still work without crash

**Expected Result**: ✅ App respects min/max zoom limits without crashes

### 6. Memory Pressure Test
**Test**: Zoom operations under memory pressure
- Open the app and use it for a while to build up state
- Navigate to map screen
- Perform various zoom operations
- Switch to background and back
- Continue zoom operations

**Expected Result**: ✅ No crashes even under memory pressure

### 7. Center on User + Zoom
**Test**: Combine zoom with other map controls
- Tap the "Center on User" button (compass icon)
- While animation is in progress, tap zoom buttons
- Verify no crashes occur

**Expected Result**: ✅ Multiple simultaneous map operations don't cause crashes

### 8. Reset to World View + Zoom
**Test**: Zoom during world view reset
- Zoom in to a high level
- Tap the "Reset to World View" button (globe icon)
- While animation is in progress, tap zoom buttons
- Verify no crashes occur

**Expected Result**: ✅ Interrupting world view reset with zoom works correctly

## Before/After Comparison

### Before the Fix
- ❌ App would crash when tapping zoom buttons rapidly
- ❌ Navigating away during zoom animation caused crashes
- ❌ Zoom during flyTo animations caused "Invalid react tag" errors
- ❌ Memory pressure + zoom operations led to frequent crashes

### After the Fix
- ✅ All zoom operations work smoothly
- ✅ Component unmounting is handled gracefully
- ✅ Async operations are properly guarded
- ✅ Better error logging for debugging

## Technical Verification

### Check Logs
Look for these debug messages in the logs (they indicate the fix is working):
```
[MapState] Refs became null during stopAnimation, aborting
[MapState] Refs became null after stopAnimationAndGetBaseZoom in zoomIn, aborting
[MapState] Refs became null after stopAnimationAndGetBaseZoom in zoomOut, aborting
[MapState] Component unmounted during getZoom, returning fallback
```

These messages should appear when:
- Navigating away during operations
- Component unmounts during async calls
- Refs become null during execution

### Performance Check
- Monitor frame rate during zoom operations
- Should remain smooth (no jank or stuttering)
- No memory leaks (use React DevTools Profiler)

## Success Criteria
The fix is successful if:
1. ✅ No crashes occur in any of the test scenarios above
2. ✅ Zoom operations remain smooth and responsive
3. ✅ Error logging helps identify any edge cases
4. ✅ No performance degradation
5. ✅ App handles concurrent map operations gracefully

## Devices to Test
Test on various devices/configurations:
- iOS (physical device and simulator)
- Android (physical device and emulator)
- Different screen sizes
- Low-end and high-end devices
- Different OS versions

## Regression Testing
Verify these features still work correctly:
- ✅ Cluster expansion (tapping clusters)
- ✅ Room marker taps
- ✅ User location tracking
- ✅ Map panning and gestures
- ✅ Other map controls (center, reset)
- ✅ View toggle (map/list)
