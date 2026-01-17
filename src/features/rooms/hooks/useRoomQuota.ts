import { useCallback, useEffect } from 'react';
import { roomService } from '../../../services/room';
import { useRoomStore } from '../store';
import { useMembership } from '../../user/hooks/useMembership';
import { ROOM_CONFIG } from '../../../constants';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useRoomQuota');

/**
 * Hook to manage room creation quota
 */
export function useRoomQuota() {
    const quota = useRoomStore((s) => s.quota);
    const setQuota = useRoomStore((s) => s.setQuota);
    const isLoading = useRoomStore((s) => s.isLoading);
    const setLoading = useRoomStore((s) => s.setLoading);
    const { isPro, hasEntitlement, limits } = useMembership();

    const fetchQuota = useCallback(async () => {
        try {
            setLoading(true);
            const data = await roomService.getQuota();
            setQuota({
                ...data,
                resetAt: new Date(data.resetAt),
            });
        } catch (error) {
            log.error('Failed to fetch quota', { error });
        } finally {
            setLoading(false);
        }
    }, [setLoading, setQuota]);

    // Initial fetch
    useEffect(() => {
        if (!quota) {
            fetchQuota();
        }
    }, [quota, fetchQuota]);

    const effectiveLimit = hasEntitlement('INCREASED_QUOTA')
        ? limits.dailyRoomLimit
        : (quota?.limit ?? 3);

    return {
        quota: quota ? { ...quota, limit: effectiveLimit } : null,
        isLoading,
        refreshQuota: fetchQuota,
        isLimitReached: quota ? quota.used >= effectiveLimit : false,
    };
}
