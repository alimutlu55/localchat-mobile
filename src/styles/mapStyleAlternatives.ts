/**
 * Alternative Map Styles
 * 
 * Multiple reliable tile server options for BubbleUp mobile app.
 * Use these if the primary style has issues.
 */

/**
 * Option 1: CartoDB Positron (Light) - RECOMMENDED
 * - Most reliable (free, no rate limits)
 * - Fast CDN
 * - Clean, subtle style
 */
export const CARTO_LIGHT_STYLE = {
  version: 8,
  name: 'CartoDB Positron',
  sources: {
    'carto': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    }
  },
  layers: [
    {
      id: 'carto-layer',
      type: 'raster',
      source: 'carto',
      minzoom: 0,
      maxzoom: 22,
      paint: {
        'raster-opacity': 0.95,
        'raster-brightness-min': 0.1,
        'raster-contrast': -0.1,
        'raster-saturation': -0.2
      }
    }
  ]
};

/**
 * Option 2: Stamen Toner Lite
 * - Very minimal, clean
 * - Good for showing custom markers
 */
export const STAMEN_TONER_LITE = {
  version: 8,
  name: 'Stamen Toner Lite',
  sources: {
    'stamen': {
      type: 'raster',
      tiles: [
        'https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 256,
      attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
    }
  },
  layers: [
    {
      id: 'stamen-layer',
      type: 'raster',
      source: 'stamen',
      minzoom: 0,
      maxzoom: 20,
    }
  ]
};

/**
 * Option 3: OSM Standard
 * - Direct from OpenStreetMap
 * - Fallback option if others fail
 */
export const OSM_STANDARD = {
  version: 8,
  name: 'OpenStreetMap Standard',
  sources: {
    'osm': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    }
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    }
  ]
};

/**
 * Option 4: Mapbox Streets (Requires API Key)
 * - Best quality and performance
 * - Costs money after free tier
 */
export const MAPBOX_STREETS = (accessToken: string) => ({
  version: 8,
  name: 'Mapbox Streets',
  sources: {
    'mapbox': {
      type: 'raster',
      tiles: [
        `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}@2x?access_token=${accessToken}`
      ],
      tileSize: 512,
      attribution: '© Mapbox © OpenStreetMap',
    }
  },
  layers: [
    {
      id: 'mapbox-layer',
      type: 'raster',
      source: 'mapbox',
      minzoom: 0,
      maxzoom: 22,
    }
  ]
});

/**
 * Default export - Most reliable option
 */
export const HUDDLE_MAP_STYLE = CARTO_LIGHT_STYLE;
