import { useCallback, useEffect } from 'react';
import { roomService } from '../../../services/room';
import { useRoomStore } from '../store';
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

    return {
        quota,
        isLoading,
        refreshQuota: fetchQuota,
        isLimitReached: quota ? quota.used >= quota.limit : false,
    };
}
