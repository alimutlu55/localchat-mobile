# Room State Architecture Migration Guide

## Overview

The room state management is being migrated from a monolithic `RoomContext` to smaller, focused hooks in `features/rooms`. This guide helps developers understand and adopt the new patterns.

## Quick Reference

| Old Pattern | New Pattern | Notes |
|-------------|-------------|-------|
| `useRooms().getRoomById(id)` | `useRoom(id).room` | Auto-fetches, caches, subscribes to updates |
| `useRooms().joinRoom(room)` | `useJoinRoom().join(room)` | Returns typed errors |
| `useRooms().leaveRoom(id)` | `useJoinRoom().leave(id)` | Handles WebSocket cleanup |
| `useRooms().myRooms` | `useMyRooms().rooms` | Includes active/expired filtering |
| `useIsRoomJoined(id)` | `useMyRooms().isJoined(id)` | Same functionality |
| `useRooms().fetchDiscoveredRooms()` | `useRoomDiscovery().refresh()` | Includes pagination |

## New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     RoomCacheContext                             │
│   • Map<id, {room, cachedAt}> - with TTL (5 min default)        │
│   • get/set/update/remove operations                             │
│   • isStale() for TTL checking                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │ useRoom │ │useMyRms │ │useJoin  │
              │ Fetch & │ │ User's  │ │ Join &  │
              │ cache   │ │ rooms   │ │ leave   │
              └─────────┘ └─────────┘ └─────────┘
```

## Migration Examples

### Example 1: Room Details Screen

**Before:**
```typescript
import { useRooms, useRoomById, useIsRoomJoined } from '@/context/RoomContext';

function RoomDetailsScreen({ route }) {
  const { room: initialRoom } = route.params;
  const room = useRoomById(initialRoom.id) || initialRoom;
  const hasJoined = useIsRoomJoined(room.id);
  const { joinRoom } = useRooms();
  
  const handleJoin = async () => {
    const success = await joinRoom(room);
    if (!success) {
      Alert.alert('Error', 'Something went wrong');
    }
  };
}
```

**After:**
```typescript
import { useRoom, useJoinRoom } from '@/features/rooms';

function RoomDetailsScreen({ route }) {
  const { room: initialRoom } = route.params;
  const { room, isLoading } = useRoom(initialRoom.id);
  const { join, isJoining } = useJoinRoom();
  
  const handleJoin = async () => {
    const result = await join(room || initialRoom);
    if (!result.success) {
      if (result.error?.code === 'BANNED') {
        Alert.alert('Banned', 'You are banned from this room');
      } else if (result.error?.code === 'ROOM_FULL') {
        Alert.alert('Full', 'This room is at capacity');
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to join');
      }
    }
  };
  
  if (isLoading && !room) return <Loading />;
}
```

### Example 2: My Rooms List

**Before:**
```typescript
import { useRooms } from '@/context/RoomContext';

function MyRoomsList() {
  const { myRooms, fetchMyRooms } = useRooms();
  
  useEffect(() => {
    fetchMyRooms();
  }, []);
  
  return <FlatList data={myRooms} ... />;
}
```

**After:**
```typescript
import { useMyRooms } from '@/features/rooms';

function MyRoomsList() {
  const { rooms, activeRooms, expiredRooms, isLoading, refresh } = useMyRooms();
  
  // Auto-fetches on mount!
  
  return (
    <FlatList 
      data={activeRooms} 
      refreshing={isLoading}
      onRefresh={refresh}
      ...
    />
  );
}
```

### Example 3: Room Discovery

**Before:**
```typescript
import { useRooms } from '@/context/RoomContext';

function MapScreen() {
  const { discoveredRooms, fetchDiscoveredRooms, loadMoreRooms, hasMoreRooms } = useRooms();
  
  useEffect(() => {
    if (userLocation) {
      fetchDiscoveredRooms(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);
}
```

**After:**
```typescript
import { useRoomDiscovery } from '@/features/rooms';

function MapScreen() {
  const { 
    rooms, 
    isLoading, 
    hasMore, 
    refresh, 
    loadMore 
  } = useRoomDiscovery({
    latitude: userLocation?.lat || 0,
    longitude: userLocation?.lng || 0,
    autoFetch: !!userLocation,
  });
}
```

## Benefits of New Architecture

### 1. Typed Error Handling
```typescript
const result = await join(room);
if (result.error?.code === 'BANNED') { ... }
if (result.error?.code === 'ROOM_FULL') { ... }
if (result.error?.code === 'ROOM_CLOSED') { ... }
```

### 2. Automatic TTL & Caching
```typescript
// Data is automatically refreshed if stale (>5 min)
const { room } = useRoom(roomId);
```

### 3. WebSocket Integration
```typescript
// Automatically subscribes to room updates
const { room } = useRoom(roomId, { subscribeToUpdates: true });
```

### 4. Loading States
```typescript
const { room, isLoading, isRefreshing, error, refresh } = useRoom(roomId);
```

### 5. Pagination Built-in
```typescript
const { rooms, hasMore, loadMore, isLoadingMore } = useRoomDiscovery({ ... });
```

## Coexistence

During migration, both systems work together:

1. **RoomContext syncs to RoomCacheContext** - Updates in old code are reflected in new hooks
2. **New hooks use RoomCacheContext** - Same source of truth
3. **No breaking changes** - Existing screens continue to work

## Migration Steps

1. **New screens**: Use `useRoom`, `useJoinRoom`, `useMyRooms` from `@/features/rooms`
2. **Existing screens**: Migrate one at a time, test thoroughly
3. **Remove RoomContext usage**: Once all screens are migrated
4. **Simplify RoomContext**: Keep only WebSocket handlers if needed

## Testing

New hooks have unit tests:
```bash
npm test src/features/rooms/hooks/__tests__/
```

Run tests before and after migration to ensure behavior is preserved.
