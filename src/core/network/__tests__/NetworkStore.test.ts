/**
 * NetworkStore Tests
 *
 * Tests for the Zustand network state store.
 */

import { useNetworkStore, type ConnectionState } from '../NetworkStore';

describe('NetworkStore', () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        useNetworkStore.getState().reset();
    });

    describe('Initial State', () => {
        it('should have initial isOnline as true', () => {
            expect(useNetworkStore.getState().isOnline).toBe(true);
        });

        it('should have initial wsState as disconnected', () => {
            expect(useNetworkStore.getState().wsState).toBe('disconnected');
        });

        it('should have initial pendingOperations as 0', () => {
            expect(useNetworkStore.getState().pendingOperations).toBe(0);
        });

        it('should have initial lastError as null', () => {
            expect(useNetworkStore.getState().lastError).toBe(null);
        });

        it('should have initial lastOnlineAt as null', () => {
            expect(useNetworkStore.getState().lastOnlineAt).toBe(null);
        });
    });

    describe('setOnline()', () => {
        it('should set isOnline to true', () => {
            useNetworkStore.getState().setOnline(false); // First set to false
            useNetworkStore.getState().setOnline(true);

            expect(useNetworkStore.getState().isOnline).toBe(true);
        });

        it('should set isOnline to false', () => {
            useNetworkStore.getState().setOnline(false);

            expect(useNetworkStore.getState().isOnline).toBe(false);
        });

        it('should update lastOnlineAt when coming back online', () => {
            useNetworkStore.getState().setOnline(false);
            const before = new Date();

            useNetworkStore.getState().setOnline(true);
            const after = new Date();

            const lastOnlineAt = useNetworkStore.getState().lastOnlineAt;
            expect(lastOnlineAt).toBeTruthy();
            expect(lastOnlineAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(lastOnlineAt!.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });

    describe('setWsState()', () => {
        const states: ConnectionState[] = ['connected', 'connecting', 'disconnected', 'reconnecting'];

        states.forEach((state) => {
            it(`should set wsState to ${state}`, () => {
                useNetworkStore.getState().setWsState(state);
                expect(useNetworkStore.getState().wsState).toBe(state);
            });
        });
    });

    describe('Pending Operations', () => {
        it('should increment pending operations', () => {
            expect(useNetworkStore.getState().pendingOperations).toBe(0);

            useNetworkStore.getState().incrementPending();
            expect(useNetworkStore.getState().pendingOperations).toBe(1);

            useNetworkStore.getState().incrementPending();
            expect(useNetworkStore.getState().pendingOperations).toBe(2);
        });

        it('should decrement pending operations', () => {
            useNetworkStore.getState().incrementPending();
            useNetworkStore.getState().incrementPending();

            useNetworkStore.getState().decrementPending();
            expect(useNetworkStore.getState().pendingOperations).toBe(1);
        });

        it('should not go below 0 when decrementing', () => {
            useNetworkStore.getState().decrementPending();
            expect(useNetworkStore.getState().pendingOperations).toBe(0);
        });
    });

    describe('setLastError()', () => {
        it('should set error message', () => {
            useNetworkStore.getState().setLastError('Connection timeout');
            expect(useNetworkStore.getState().lastError).toBe('Connection timeout');
        });

        it('should clear error when set to null', () => {
            useNetworkStore.getState().setLastError('Some error');
            useNetworkStore.getState().setLastError(null);

            expect(useNetworkStore.getState().lastError).toBe(null);
        });
    });

    describe('reset()', () => {
        it('should reset all state to initial values', () => {
            // Change all state values
            useNetworkStore.getState().setOnline(false);
            useNetworkStore.getState().setWsState('connected');
            useNetworkStore.getState().incrementPending();
            useNetworkStore.getState().setLastError('Error');

            // Reset
            useNetworkStore.getState().reset();

            // Verify initial state
            const state = useNetworkStore.getState();
            expect(state.isOnline).toBe(true);
            expect(state.wsState).toBe('disconnected');
            expect(state.pendingOperations).toBe(0);
            expect(state.lastError).toBe(null);
        });
    });
});

describe('NetworkStore WebSocket State Transitions', () => {
    beforeEach(() => {
        useNetworkStore.getState().reset();
    });

    it('should support full reconnection cycle: disconnected → reconnecting → connecting → connected', () => {
        const { setWsState } = useNetworkStore.getState();

        // Start disconnected
        expect(useNetworkStore.getState().wsState).toBe('disconnected');

        // Auto-retry starts
        setWsState('reconnecting');
        expect(useNetworkStore.getState().wsState).toBe('reconnecting');

        // Connect attempt
        setWsState('connecting');
        expect(useNetworkStore.getState().wsState).toBe('connecting');

        // Success
        setWsState('connected');
        expect(useNetworkStore.getState().wsState).toBe('connected');
    });

    it('should support failed reconnection cycle: reconnecting → connecting → reconnecting (loop) → disconnected', () => {
        const { setWsState } = useNetworkStore.getState();

        // Attempt 1
        setWsState('reconnecting');
        setWsState('connecting');

        // Fail - back to reconnecting
        setWsState('reconnecting');
        expect(useNetworkStore.getState().wsState).toBe('reconnecting');

        // Attempt 2 (and so on...)
        setWsState('connecting');
        setWsState('reconnecting');

        // Eventually exhausted
        setWsState('disconnected');
        expect(useNetworkStore.getState().wsState).toBe('disconnected');
    });
});

describe('NetworkStore Selector Usage', () => {
    beforeEach(() => {
        useNetworkStore.getState().reset();
    });

    it('should work with individual selectors', () => {
        // This tests the pattern used in components
        const getIsOnline = () => useNetworkStore.getState().isOnline;
        const getWsState = () => useNetworkStore.getState().wsState;

        expect(getIsOnline()).toBe(true);
        expect(getWsState()).toBe('disconnected');

        useNetworkStore.getState().setOnline(false);
        useNetworkStore.getState().setWsState('connected');

        expect(getIsOnline()).toBe(false);
        expect(getWsState()).toBe('connected');
    });
});
