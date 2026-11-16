// Street map of Prague from an OpenStreetMap extract in the Protomaps basemap schema.

import * as maplibregl from './vendor/maplibre-gl@6.16.0/maplibre-gl.mjs';

// TileJSON for the extract. Locally, `pmtiles serve` provides it (see AGENTS.md).
const TILES = 'http://localhost:8081/prague.json';
const FONTS = new URL('./vendor/jetbrains-mono@2.304/', location.href);

const COLOR = {
  bg: '#020a04',
  park: '#04130a',
  water: '#000000',
  waterEdge: '#0e3a1d',
  waterLine: '#0b2e17',
  building: '#031008',
  buildingEdge: '#0a2614',
  path: '#0c331a',
  other: '#0f3d1f',
  minor: '#155228',
  major: '#23803f',
  highway: '#36b85c',
  rail: '#1a6634',
  tram: '#7dffa0',
  label: '#2f9a52',
  labelDim: '#1f6b38',
  waterLabel: '#1a5c30',
  place: '#8dffb0',
  placeDim: '#3fbf63',
};

const GREEN_AREAS = [
  'park', 'forest', 'wood', 'grass', 'garden', 'meadow', 'scrub', 'grassland',
  'village_green', 'cemetery', 'nature_reserve', 'allotments', 'golf_course',
  'recreation_ground', 'playground', 'pitch',
];

const kind = (...kinds) => ['in', ['get', 'kind'], ['literal', kinds]];
const polygon = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const line = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]];
const tram = ['all', kind('rail'), ['==', ['get', 'kind_detail'], 'tram']];
const visibleAt = ['<=', ['coalesce', ['get', 'min_zoom'], 0], ['zoom']];
const tunnelOpacity = ['case', ['boolean', ['get', 'is_tunnel'], false], 0.35, 1];

// Line widths grow exponentially with zoom; stops are [zoom, width, zoom, width, ...].
const width = (...stops) => ['interpolate', ['exponential', 1.6], ['zoom'], ...stops];

function road(id, filter, color, lineWidth, extra = {}) {
  return {
    id,
    type: 'line',
    source: 'osm',
    'source-layer': 'roads',
    filter,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': lineWidth, 'line-opacity': tunnelOpacity, ...extra },
  };
}

// A wide, blurred, faint copy of a line, so it glows like phosphor.
function glow(id, filter, color, lineWidth, opacity) {
  return road(id, filter, color, lineWidth, { 'line-blur': lineWidth, 'line-opacity': opacity });
}

function label(id, sourceLayer, filter, layout, paint, minzoom) {
  return {
    id,
    type: 'symbol',
    source: 'osm',
    'source-layer': sourceLayer,
    minzoom,
    filter,
    layout: { 'text-field': ['get', 'name'], 'text-font': ['mono'], 'text-max-angle': 30, ...layout },
    paint: { 'text-halo-color': COLOR.bg, 'text-halo-width': 1.5, ...paint },
  };
}

const style = {
  version: 8,
  'font-faces': {
    mono: new URL('JetBrainsMono-Regular.woff2', FONTS).href,
    'mono-bold': new URL('JetBrainsMono-Bold.woff2', FONTS).href,
  },
  sources: {
    osm: {
      type: 'vector',
      url: TILES,
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': COLOR.bg } },

    {
      id: 'green-areas',
      type: 'fill',
      source: 'osm',
      'source-layer': 'landuse',
      filter: kind(...GREEN_AREAS),
      paint: { 'fill-color': COLOR.park },
    },

    {
      id: 'water',
      type: 'fill',
      source: 'osm',
      'source-layer': 'water',
      filter: polygon,
      paint: { 'fill-color': COLOR.water },
    },
    {
      id: 'water-edge',
      type: 'line',
      source: 'osm',
      'source-layer': 'water',
      minzoom: 11,
      filter: polygon,
      paint: { 'line-color': COLOR.waterEdge, 'line-width': width(11, 0.5, 18, 1.5) },
    },
    {
      id: 'waterways',
      type: 'line',
      source: 'osm',
      'source-layer': 'water',
      filter: ['all', line, kind('river', 'canal', 'stream')],
      paint: { 'line-color': COLOR.waterLine, 'line-width': width(10, 0.5, 18, 3) },
    },

    {
      id: 'buildings',
      type: 'fill',
      source: 'osm',
      'source-layer': 'buildings',
      minzoom: 13,
      filter: ['all', polygon, kind('building', 'building_part')],
      paint: { 'fill-color': COLOR.building, 'fill-outline-color': COLOR.buildingEdge },
    },

    road('aeroways', kind('aeroway'), COLOR.other, width(10, 0.5, 18, 12)),
    road(
      'paths',
      ['all', kind('path'), ['!=', ['get', 'kind_detail'], 'pedestrian']],
      COLOR.path,
      width(14, 0.5, 18, 2),
      { 'line-dasharray': [1, 1.5] },
    ),
    road('other-roads', ['all', kind('other'), ['!=', ['get', 'kind_detail'], 'living_street']], COLOR.other, width(13, 0.5, 18, 5)),
    // Most streets in the historic centre are pedestrian zones, so they're drawn as streets, not paths.
    road(
      'minor-roads',
      ['any', kind('minor_road'), ['in', ['get', 'kind_detail'], ['literal', ['pedestrian', 'living_street']]]],
      COLOR.minor,
      width(12, 0.3, 18, 7),
    ),
    road('major-roads', kind('major_road'), COLOR.major, width(8, 0.4, 18, 11)),
    glow('highway-glow', kind('highway'), COLOR.highway, width(6, 3, 18, 30), 0.12),
    road('highways', kind('highway'), COLOR.highway, width(6, 0.6, 18, 13)),
    road('ferries', kind('ferry'), COLOR.waterEdge, width(11, 0.5, 18, 2), { 'line-dasharray': [2, 2] }),
    road(
      'railways',
      ['all', kind('rail'), ['!=', ['get', 'kind_detail'], 'tram']],
      COLOR.rail,
      width(10, 0.4, 18, 2.5),
      { 'line-dasharray': [3, 2] },
    ),
    glow('tram-glow', tram, COLOR.tram, width(11, 3, 18, 12), 0.25),
    road('tram-tracks', tram, COLOR.tram, width(11, 0.6, 18, 2)),

    label(
      'waterway-names',
      'water',
      ['all', line, kind('river', 'canal')],
      { 'symbol-placement': 'line', 'text-size': 12, 'text-letter-spacing': 0.3, 'text-transform': 'uppercase' },
      { 'text-color': COLOR.waterLabel },
      12,
    ),
    label(
      'major-road-names',
      'roads',
      kind('highway', 'major_road'),
      { 'symbol-placement': 'line', 'text-size': width(13, 9, 18, 13) },
      { 'text-color': COLOR.label },
      13,
    ),
    label(
      'minor-road-names',
      'roads',
      ['any', kind('minor_road', 'other'), ['==', ['get', 'kind_detail'], 'pedestrian']],
      { 'symbol-placement': 'line', 'text-size': width(15, 9, 18, 12) },
      { 'text-color': COLOR.labelDim },
      15,
    ),
    label(
      'place-names',
      'places',
      ['all', kind('locality', 'macrohood', 'neighbourhood'), visibleAt],
      {
        'text-font': ['mono-bold'],
        'text-size': ['match', ['get', 'kind'], 'locality', 14, 11],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.2,
        'text-max-width': 8,
      },
      { 'text-color': ['match', ['get', 'kind'], 'locality', COLOR.place, COLOR.placeDim], 'text-halo-width': 2 },
      9,
    ),
  ],
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: [14.4205, 50.0875],
  zoom: 13,
  minZoom: 9,
  maxZoom: 19,
  maxBounds: [
    [13.85, 49.7],
    [15.1, 50.45],
  ],
  hash: true,
  attributionControl: { compact: false },
});

// Status line: map centre and zoom.
const hud = document.getElementById('hud');

function renderHud() {
  const { lng, lat } = map.getCenter();
  hud.textContent =
    `[ GRID // PRAGUE ]  N${lat.toFixed(5)} E${lng.toFixed(5)}  Z${map.getZoom().toFixed(1).padStart(4, '0')}`;
}

map.on('move', renderHud);
renderHud();
