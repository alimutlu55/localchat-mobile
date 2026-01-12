import { StyleSheet, Dimensions, Platform } from 'react-native';
import { theme } from '../../../core/theme';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    mapContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    map: {
        flex: 1,
    },
    mapLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#f9fafb',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    mapLoadingContent: {
        alignItems: 'center',
        gap: 16,
    },
    mapLoadingText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
    },
    listContainer: {
        ...StyleSheet.absoluteFillObject,
        paddingTop: 100,
        backgroundColor: theme.tokens.bg.canvas,
    },
    topContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 110,
    },
    header: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    filterBar: {
        backgroundColor: 'transparent',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    hamburgerButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: '#1f2937',
        textAlign: 'center',
        flex: 1,
    },
    headerCreateButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FF6410',
    },
    headerFilterButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    headerFilterButtonActive: {
        backgroundColor: '#fff7ed',
        borderColor: '#ffedd5',
    },
    mapControls: {
        position: 'absolute',
        // top is now set dynamically via prop
        right: 10,
        gap: 12,
    },
    controlButton: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    controlButtonActive: {
        backgroundColor: '#eff6ff',
    },
    zoomCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    zoomButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomDivider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 2,
    },
    eventsCounter: {
        position: 'absolute',
        // top is now set dynamically via prop
        left: 20,
        zIndex: 10,
    },
    eventsCounterText: {
        fontSize: 12,
        color: '#4b5563', // Softer slate grey
        fontWeight: '400', // Regular weight for smoothness
        opacity: 0.6, // Restored to a more subtle transparency
    },
    userLocationMarkerContainer: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userLocationDot: {
        width: 16,
        height: 16,
        backgroundColor: '#2563eb',
        borderRadius: 8,
        borderWidth: 4,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    userLocationPulse: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    viewToggleContainer: {
        position: 'absolute',
        bottom: 130, // Increased from 110px to ensure 20px+ gap from ad banner (Google policy compliance)
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: 4,
        // Sharper, more visible shadow for compact look
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb', // Solid border for better definition
    },
    viewToggleButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewToggleButtonActive: {
        backgroundColor: '#FF6410',
        // Feedback shadow
        shadowColor: '#FF6410',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    viewToggleText: {
        fontSize: 14,
        color: '#6b7280',
    },
    viewToggleTextActive: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '500',
    },
    emptyState: {
        position: 'absolute',
        bottom: 186, // Adjusted to maintain spacing above view toggle (was 166px)
        left: 20,
        right: 20,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    createButton: {
        backgroundColor: '#FF6410',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    createButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    adBannerContainer: {
        // Removed absolute positioning to create a dedicated footer space
        // No background or border to keep it seamless with the content
        zIndex: 50,
    },
});
