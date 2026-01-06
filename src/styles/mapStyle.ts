/**
 * Optimized Custom Map Style for BubbleUp
 * 
 * A clean, subtle map style using reliable tile sources.
 * Features:
 * - Soft, muted colors
 * - Subtle country/city labels (not bold)
 * - Smooth transitions
 * - Optimized for performance
 * - Uses STABLE tile servers
 */

export const HUDDLE_MAP_STYLE = {
  version: 8,
  name: 'BubbleUp Map Style',
  sources: {
    'carto-raster': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
      minzoom: 0,
      maxzoom: 20
    }
  },
  layers: [
    {
      id: 'carto-light',
      type: 'raster',
      source: 'carto-raster',
      minzoom: 0,
      maxzoom: 22,
      paint: {
        'raster-opacity': 0.95, // Slightly transparent for softer look
        'raster-brightness-min': 0.1, // Brighten shadows
        'raster-brightness-max': 1.0,
        'raster-contrast': -0.1, // Reduce contrast for smoother colors
        'raster-saturation': -0.2 // Desaturate for muted colors
      }
    }
  ]
};
