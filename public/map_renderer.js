// Hamburg Map Renderer - Canvas2D with Zoom/Pan/Tooltips
// VERSION: 2024-POI-CATEGORIES

// Import theme system
import { getColor, toRGBA, toRGB } from "./map_theme.js";

// Tunnel opacity constants (alpha 0-255)
const TUNNEL_ROAD_ALPHA = 80; // ~30% opacity for road/rail tunnels
const TUNNEL_WATER_ALPHA = 51; // ~20% opacity for water tunnels

// POI category definitions with tag mappings
const POI_CATEGORIES = {
  cafe: {
    label: "Cafes & Coffee",
    color: getColor("poi", "foodDrink"),
    amenity: new Set(["cafe"]),
    shop: new Set(["coffee", "tea"]),
  },
  restaurant: {
    label: "Restaurants & Food",
    color: getColor("poi", "foodDrink"),
    amenity: new Set(["restaurant", "fast_food", "food_court", "bbq"]),
    shop: new Set([
      "deli",
      "confectionery",
      "butcher",
      "cheese",
      "seafood",
      "wine",
      "beverages",
      "alcohol",
    ]),
  },
  bakery: {
    label: "Bakeries",
    color: getColor("poi", "foodDrink"),
    shop: new Set(["bakery", "pastry"]),
  },
  ice_cream: {
    label: "Ice Cream",
    color: getColor("poi", "foodDrink"),
    amenity: new Set(["ice_cream"]),
    shop: new Set(["ice_cream"]),
  },
  shopping: {
    label: "Shopping",
    color: getColor("poi", "shopping"),
    shop: new Set([
      "hairdresser",
      "clothes",
      "kiosk",
      "beauty",
      "jewelry",
      "florist",
      "chemist",
      "mobile_phone",
      "optician",
      "shoes",
      "furniture",
      "books",
      "bicycle",
      "car_repair",
      "tailor",
      "tattoo",
      "massage",
      "interior_decoration",
      "electronics",
      "hardware",
      "sports",
      "toys",
      "gift",
      "stationery",
      "pet",
      "photo",
      "music",
      "art",
      "bag",
      "fabric",
      "garden_centre",
      "hearing_aids",
      "travel_agency",
      "dry_cleaning",
      "laundry",
      "car",
      "car_parts",
      "tyres",
      "motorcycle",
    ]),
    amenity: new Set(["marketplace", "vending_machine"]),
  },
  supermarket: {
    label: "Supermarkets",
    color: getColor("poi", "shopping"),
    shop: new Set(["supermarket", "convenience"]),
  },
  health: {
    label: "Health",
    color: getColor("poi", "health"),
    amenity: new Set([
      "doctors",
      "dentist",
      "pharmacy",
      "hospital",
      "clinic",
      "veterinary",
      "nursing_home",
    ]),
  },
  tourism: {
    label: "Tourism",
    color: getColor("poi", "tourism"),
    tourism: new Set([
      "artwork",
      "hotel",
      "museum",
      "viewpoint",
      "information",
      "attraction",
      "guest_house",
      "hostel",
      "gallery",
      "camp_site",
      "picnic_site",
      "zoo",
      "theme_park",
      "motel",
      "apartment",
    ]),
  },
  historic: {
    label: "Historic",
    color: getColor("poi", "historic"),
    historic: new Set([
      "memorial",
      "boundary_stone",
      "monument",
      "castle",
      "ruins",
      "archaeological_site",
      "building",
      "church",
      "manor",
      "city_gate",
      "wayside_cross",
      "wayside_shrine",
      "heritage",
      "milestone",
      "tomb",
      "technical_monument",
      "highwater_mark",
    ]),
  },
  services: {
    label: "Services",
    color: getColor("poi", "services"),
    amenity: new Set([
      "bank",
      "post_office",
      "library",
      "police",
      "fire_station",
      "townhall",
      "courthouse",
      "embassy",
      "community_centre",
      "social_facility",
      "place_of_worship",
      "cinema",
      "theatre",
      "arts_centre",
      "driving_school",
      "recycling",
      "post_box",
      "atm",
      "bureau_de_change",
      "toilets",
      "events_venue",
      "childcare",
    ]),
  },
  transport: {
    label: "Transport",
    color: getColor("poi", "transport"),
    amenity: new Set([
      "bicycle_rental",
      "parking",
      "parking_entrance",
      "fuel",
      "charging_station",
      "car_sharing",
      "taxi",
      "bus_station",
      "ferry_terminal",
      "car_rental",
      "boat_rental",
    ]),
  },
  education: {
    label: "Education",
    color: getColor("poi", "education"),
    amenity: new Set([
      "kindergarten",
      "school",
      "university",
      "college",
      "music_school",
      "language_school",
      "training",
    ]),
  },
  nightlife: {
    label: "Nightlife",
    color: getColor("poi", "nightlife"),
    amenity: new Set([
      "bar",
      "pub",
      "nightclub",
      "biergarten",
      "casino",
      "gambling",
      "hookah_lounge",
    ]),
  },
  recreation: {
    label: "Recreation",
    color: getColor("poi", "services"),
    sport: new Set(["table_tennis"]),
  },
};

// Classification priority order for amenity tags
const POI_AMENITY_PRIORITY = [
  "cafe",
  "ice_cream",
  "bakery",
  "restaurant",
  "nightlife",
  "health",
  "education",
  "transport",
  "services",
];

class MapRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.mapData = null;
    this.canvasWidth = 1200;
    this.canvasHeight = 800;

    // Discrete logarithmic zoom levels (in meters)
    // Roughly sqrt(2) steps for smooth progression
    this.zoomLevels = [
      100, // 0: Street detail
      150, // 1
      200, // 2
      300, // 3
      500, // 4: Block level
      700, // 5
      1000, // 6: Neighborhood
      1500, // 7
      2000, // 8
      3000, // 9
      5000, // 10: District
      7000, // 11
      10000, // 12: City area
      15000, // 13
      20000, // 14
      30000, // 15
      50000, // 16: Regional
      70000, // 17
      100000, // 18: Wide regional
      150000, // 19
      200000, // 20: Full extent
    ];

    // Viewport state (in real-world meters)
    this.viewWidthMeters = 10000; // Initial view: 10km across
    this.currentZoomIndex = 12; // Index into zoomLevels array
    this.scrollAccumulator = 0; // Accumulate scroll wheel deltas for discrete zoom
    this.targetZoomIndex = 12; // Target zoom level during scroll
    this.zoomTimeout = null; // Debounce timer for zoom rendering
    this.isZooming = false; // Track if currently in zoom animation
    this.offsetX = 0;
    this.offsetY = 0;
    this.minViewWidthMeters = this.zoomLevels[0]; // Max zoom
    this.maxViewWidthMeters = this.zoomLevels[this.zoomLevels.length - 1]; // Min zoom

    // Hamburg city center coordinates
    this.centerLat = 53.55;
    this.centerLon = 9.99;

    // Pan state
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;

    // Feature detection for tooltips and selection
    this.renderedFeatures = [];
    this.hoveredFeature = null;
    this.selectedFeature = null;
    this.hoverInfoEnabled = false; // Toggle for hover info mode
    this.showTileEdges = false; // Toggle for tile edge visualization

    // POI category state and glyph cache
    this.glyphCache = {}; // categoryId -> { canvas, size }
    this.poiCategoryState = {}; // categoryId -> boolean
    for (const catId of Object.keys(POI_CATEGORIES)) {
      this.poiCategoryState[catId] = true; // all enabled by default
    }
    this._poiRenderQueue = [];

    // Pattern cache for textures (scrub, wetland, etc.)
    this.patternCache = {}; // patternId -> CanvasPattern

    // Performance optimizations
    this.renderTimeout = null;
    this.renderDelay = 50; // ms delay for debouncing
    this.isRendering = false;

    // Tile system
    this.tileCache = new Map(); // Cache for loaded tiles
    this.tileIndex = null; // Tile index metadata
    this.loadingTiles = new Set(); // Track in-flight tile requests
    this.tileBounds = {
      minLon: 8.48,
      maxLon: 11.5,
      minLat: 52.65,
      maxLat: 54.45,
    };

    // Object pools to reduce GC pressure
    this._pointPool = []; // Reusable {x, y} objects
    this._pointPoolIndex = 0;
    this._coordArrayPool = []; // Reusable coordinate arrays
    this._rgbaCache = new Map(); // Cache rgba() strings to avoid recreating

    // Canvas panning optimization
    this._offscreenCanvas = null; // Store last rendered frame
    this._lastRenderOffset = { x: 0, y: 0 }; // Track offset when last rendered

    // Pre-allocate point objects for pooling
    for (let i = 0; i < 10000; i++) {
      this._pointPool.push({ x: 0, y: 0 });
    }
  }

  async init() {
    try {
      // Set up HTML canvas
      this.canvas = document.getElementById("mapCanvas");
      this.ctx = this.canvas.getContext("2d");

      // Load tileset configuration
      const response = await fetch("tileset_config.json");
      if (!response.ok) {
        throw new Error(
          "Failed to load tileset_config.json. Run: cd preprocessing && python export_config.py",
        );
      }
      const config = await response.json();
      this.tilesets = config.tilesets;
      console.log("Loaded tileset configuration:", this.tilesets);

      // Set up event listeners for zoom and pan
      this.setupInteractions();

      // Pre-render POI glyph sprites and create toggle buttons
      this.initGlyphCache();
      this.initPatternCache();
      this.initPOIToggles();

      return true;
    } catch (error) {
      console.error("Failed to initialize canvas:", error);
      return false;
    }
  }

  initGlyphCache() {
    // Render glyphs at high resolution for crisp display at all sizes
    const dpr = window.devicePixelRatio || 1;
    const glyphSize = 32 * dpr; // Large enough for 20px display on high-DPI
    for (const [catId, catDef] of Object.entries(POI_CATEGORIES)) {
      const offscreen = document.createElement("canvas");
      offscreen.width = glyphSize;
      offscreen.height = glyphSize;
      const ctx = offscreen.getContext("2d");
      ctx.scale(dpr, dpr);
      this.drawGlyph(ctx, catId, catDef.color, 32);
      this.glyphCache[catId] = { canvas: offscreen, size: glyphSize };
    }
  }

  initPatternCache() {
    // Create pattern canvases for natural features
    const patterns = {
      scrub: this.createScrubPattern(),
      wetland: this.createWetlandPattern(),
      broadleaf_forest: this.createBroadleafForestPattern(),
      needleleaf_forest: this.createNeedleleafForestPattern(),
      mixed_forest: this.createMixedForestPattern(),
      playground: this.createPlaygroundPattern(),
      swimming_pool: this.createSwimmingPoolPattern(),
      beach: this.createBeachPattern(),
      beach_volleyball: this.createBeachVolleyballPattern(),
      picnic_site: this.createPicnicSitePattern(),
    };

    // Convert canvases to CanvasPattern objects
    for (const [patternId, canvas] of Object.entries(patterns)) {
      this.patternCache[patternId] = this.ctx.createPattern(canvas, "repeat");
    }
  }

  createScrubPattern() {
    // Scrubland pattern: scattered bush clusters with visible stems
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = toRGBA(getColor("patterns", "scrubBush"));
    ctx.strokeStyle = toRGBA(getColor("patterns", "scrubStem"));

    const bushes = [
      { x: 6, y: 7, r: 3.5 },
      { x: 24, y: 5, r: 3 },
      { x: 35, y: 18, r: 2.8 },
      { x: 14, y: 22, r: 3.2 },
      { x: 30, y: 32, r: 3.5 },
      { x: 8, y: 35, r: 2.5 },
    ];

    for (const bush of bushes) {
      // Multi-lobe bush shape
      ctx.beginPath();
      ctx.arc(
        bush.x - bush.r * 0.4,
        bush.y - bush.r * 0.2,
        bush.r * 0.7,
        0,
        Math.PI * 2,
      );
      ctx.arc(
        bush.x + bush.r * 0.4,
        bush.y - bush.r * 0.2,
        bush.r * 0.7,
        0,
        Math.PI * 2,
      );
      ctx.arc(bush.x, bush.y - bush.r * 0.6, bush.r * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Stem
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bush.x, bush.y + bush.r * 0.3);
      ctx.lineTo(bush.x, bush.y + bush.r * 0.3 + 3);
      ctx.stroke();
    }

    return canvas;
  }

  createWetlandPattern() {
    // Wetland pattern: wavy water lines with grass tufts
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Wavy water lines
    ctx.strokeStyle = toRGBA(getColor("patterns", "wetlandWater"));
    ctx.lineWidth = 1.5;

    for (let y = 5; y < size; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 1) {
        const wave = Math.sin((x / size) * Math.PI * 3) * 1.5;
        ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    // Grass tufts (larger, more visible)
    ctx.strokeStyle = toRGBA(getColor("patterns", "wetlandGrass"));
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";

    const tufts = [
      { x: 8, y: 10 },
      { x: 28, y: 6 },
      { x: 18, y: 22 },
      { x: 35, y: 28 },
      { x: 6, y: 34 },
    ];

    for (const tuft of tufts) {
      // 5 grass blades fanning out
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(tuft.x, tuft.y + 3);
        ctx.quadraticCurveTo(
          tuft.x + i * 1.5,
          tuft.y - 2,
          tuft.x + i * 2.5,
          tuft.y - 6,
        );
        ctx.stroke();
      }
    }

    return canvas;
  }

  createBroadleafForestPattern() {
    // Broadleaf forest pattern: rounded tree canopy circles
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const color = getColor("patterns", "broadleafForest");
    ctx.fillStyle = toRGBA(color);
    ctx.strokeStyle = toRGBA(color);
    ctx.lineWidth = 0.8;

    // Tree canopies as rounded shapes
    const trees = [
      { x: 8, y: 8, r: 5, angle: 0.3 },
      { x: 28, y: 6, r: 4.5, angle: -0.2 },
      { x: 18, y: 20, r: 5.5, angle: 0.5 },
      { x: 6, y: 30, r: 4, angle: -0.4 },
      { x: 34, y: 28, r: 5, angle: 0.1 },
      { x: 22, y: 36, r: 4.5, angle: 0.7 },
    ];

    for (const tree of trees) {
      ctx.save();
      ctx.translate(tree.x, tree.y);
      ctx.rotate(tree.angle);

      ctx.beginPath();
      ctx.ellipse(0, 0, tree.r * 0.7, tree.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    return canvas;
  }

  createNeedleleafForestPattern() {
    // Needleleaf forest pattern: triangular conifer tree shapes
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = toRGBA(getColor("patterns", "needleleafForest"));
    ctx.strokeStyle = toRGBA(getColor("patterns", "needleleafForest"));
    ctx.lineWidth = 1;

    const trees = [
      { x: 8, y: 10, h: 10 },
      { x: 28, y: 7, h: 9 },
      { x: 18, y: 24, h: 11 },
      { x: 35, y: 30, h: 8 },
      { x: 6, y: 34, h: 9 },
    ];

    for (const tree of trees) {
      // Triangle pine tree
      ctx.beginPath();
      ctx.moveTo(tree.x, tree.y - tree.h / 2);
      ctx.lineTo(tree.x - tree.h / 2.5, tree.y + tree.h / 2);
      ctx.lineTo(tree.x + tree.h / 2.5, tree.y + tree.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Trunk
      ctx.fillStyle = toRGBA(getColor("patterns", "needleleafTrunk"));
      ctx.fillRect(tree.x - 1, tree.y + tree.h / 2, 2, 3);
      ctx.fillStyle = toRGBA(getColor("patterns", "needleleafForest"));
    }

    return canvas;
  }

  createMixedForestPattern() {
    // Mixed forest pattern: combination of rounded canopies and conifer triangles
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Broadleaf canopies
    ctx.fillStyle = toRGBA(getColor("patterns", "mixedForestLeaf"));
    ctx.strokeStyle = toRGBA(getColor("patterns", "mixedForestLeaf"));
    ctx.lineWidth = 0.8;

    const leaves = [
      { x: 8, y: 8, r: 5 },
      { x: 30, y: 28, r: 4.5 },
      { x: 10, y: 34, r: 4 },
    ];

    for (const leaf of leaves) {
      ctx.beginPath();
      ctx.ellipse(leaf.x, leaf.y, leaf.r * 0.7, leaf.r, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Conifer triangles
    ctx.fillStyle = toRGBA(getColor("patterns", "mixedForestNeedle"));
    ctx.strokeStyle = toRGBA(getColor("patterns", "mixedForestNeedle"));
    ctx.lineWidth = 1;

    const trees = [
      { x: 24, y: 8, h: 10 },
      { x: 14, y: 22, h: 9 },
      { x: 36, y: 16, h: 8 },
    ];

    for (const tree of trees) {
      ctx.beginPath();
      ctx.moveTo(tree.x, tree.y - tree.h / 2);
      ctx.lineTo(tree.x - tree.h / 2.5, tree.y + tree.h / 2);
      ctx.lineTo(tree.x + tree.h / 2.5, tree.y + tree.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    return canvas;
  }

  createPlaygroundPattern() {
    // Playground pattern: colorful shapes representing play equipment
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const shapes = [
      {
        x: 8,
        y: 8,
        r: 4,
        color: toRGBA(getColor("patterns", "playgroundRed")),
      },
      {
        x: 28,
        y: 10,
        r: 3.5,
        color: toRGBA(getColor("patterns", "playgroundBlue")),
      },
      {
        x: 16,
        y: 28,
        r: 4.5,
        color: toRGBA(getColor("patterns", "playgroundOrange")),
      },
      {
        x: 34,
        y: 32,
        r: 3,
        color: toRGBA(getColor("patterns", "playgroundPurple")),
      },
    ];

    for (const shape of shapes) {
      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Swing frame
    ctx.strokeStyle = toRGBA(getColor("patterns", "playgroundSwing"));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(5, 22);
    ctx.lineTo(5, 16);
    ctx.moveTo(12, 22);
    ctx.lineTo(12, 16);
    ctx.stroke();
    ctx.fillStyle = toRGBA(getColor("patterns", "playgroundSwingSeat"));
    ctx.fillRect(4, 22, 9, 2.5);

    return canvas;
  }

  createSwimmingPoolPattern() {
    // Swimming pool pattern: waves with tile grid
    const size = 36;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Wave pattern
    ctx.strokeStyle = toRGBA(getColor("patterns", "swimmingPoolWave"));
    ctx.lineWidth = 1.5;

    for (let y = 4; y < size; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 1) {
        const wave = Math.sin((x / size) * Math.PI * 3) * 2;
        ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    // Tile grid
    ctx.strokeStyle = toRGBA(getColor("patterns", "swimmingPoolTile"));
    ctx.lineWidth = 0.8;

    for (let x = 0; x <= size; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    return canvas;
  }

  createBeachPattern() {
    // Beach pattern: scattered sand dots
    const size = 36;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Sand grain dots
    ctx.fillStyle = toRGBA(getColor("patterns", "beachSand"));

    const dots = [];
    for (let i = 0; i < 25; i++) {
      const x = (i * 13) % 36;
      const y = (i * 17) % 36;
      const r = 0.7 + ((i * 3) % 5) * 0.15;
      dots.push({ x, y, r });
    }

    for (const dot of dots) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Larger sand particles
    ctx.fillStyle = toRGBA(getColor("patterns", "beachSandLarge"));
    const largeDots = [
      { x: 8, y: 12, r: 1.5 },
      { x: 24, y: 6, r: 1.3 },
      { x: 16, y: 26, r: 1.6 },
      { x: 30, y: 20, r: 1.2 },
      { x: 4, y: 32, r: 1.4 },
    ];

    for (const dot of largeDots) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  }

  createBeachVolleyballPattern() {
    // Beach volleyball pattern: ball in top-left corner with empty space
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const cx = 5;
    const cy = 5;
    const r = 4;

    // Ball outline
    ctx.strokeStyle = toRGBA(getColor("patterns", "beachVolleyballNet"));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Volleyball seams
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx + 1.5, cy, cx, cy + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.87, cy - r * 0.5);
    ctx.quadraticCurveTo(cx - 0.5, cy + 1, cx - r * 0.87, cy + r * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.87, cy - r * 0.5);
    ctx.quadraticCurveTo(cx + 0.5, cy + 1, cx + r * 0.87, cy + r * 0.5);
    ctx.stroke();

    return canvas;
  }

  createPicnicSitePattern() {
    // Picnic site pattern: table symbols
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = toRGBA(getColor("patterns", "picnicWood"));
    ctx.strokeStyle = toRGBA(getColor("patterns", "picnicWoodStroke"));
    ctx.lineWidth = 1.2;

    const tables = [
      { x: 12, y: 12 },
      { x: 30, y: 30 },
    ];

    for (const table of tables) {
      // Table top
      ctx.fillRect(table.x - 5, table.y - 1, 10, 2);
      ctx.strokeRect(table.x - 5, table.y - 1, 10, 2);

      // Bench seats
      ctx.fillRect(table.x - 5, table.y - 5, 10, 1.2);
      ctx.strokeRect(table.x - 5, table.y - 5, 10, 1.2);
      ctx.fillRect(table.x - 5, table.y + 3.5, 10, 1.2);
      ctx.strokeRect(table.x - 5, table.y + 3.5, 10, 1.2);

      // Table legs
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(table.x - 3, table.y - 1);
      ctx.lineTo(table.x - 3, table.y + 3);
      ctx.moveTo(table.x + 3, table.y - 1);
      ctx.lineTo(table.x + 3, table.y + 3);
      ctx.stroke();
      ctx.lineWidth = 1.2;
    }

    return canvas;
  }

  drawGlyph(ctx, categoryId, color, size) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.35;
    const colorStr = `rgb(${color.r},${color.g},${color.b})`;

    // Helper: stroke white halo then colored fill for a path
    const haloStroke = (lineWidth) => {
      ctx.lineWidth = lineWidth + 2;
      ctx.strokeStyle = "white";
      ctx.stroke();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = colorStr;
      ctx.stroke();
    };
    const haloFill = () => {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "white";
      ctx.stroke();
      ctx.fillStyle = colorStr;
      ctx.fill();
    };

    switch (categoryId) {
      case "cafe": {
        // Coffee cup
        const cw = r * 1.0,
          ch = r * 0.8;
        ctx.beginPath();
        ctx.rect(cx - cw / 2, cy - ch / 2 + 1, cw, ch);
        haloFill();
        // Handle
        ctx.beginPath();
        ctx.arc(cx + cw / 2, cy + 1, ch * 0.35, -Math.PI * 0.4, Math.PI * 0.4);
        haloStroke(1.5);
        // Steam
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.2, cy - ch / 2 - 1);
        ctx.quadraticCurveTo(
          cx - r * 0.3,
          cy - ch / 2 - r * 0.5,
          cx - r * 0.1,
          cy - ch / 2 - r * 0.7,
        );
        ctx.moveTo(cx + r * 0.2, cy - ch / 2 - 1);
        ctx.quadraticCurveTo(
          cx + r * 0.1,
          cy - ch / 2 - r * 0.5,
          cx + r * 0.3,
          cy - ch / 2 - r * 0.7,
        );
        haloStroke(0.8);
        break;
      }
      case "restaurant": {
        // Plate with fork and knife (🍽️ style)
        // Plate — filled circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
        haloFill();
        // Fork — left side, 3 tines + handle
        const forkX = cx - r * 1.15;
        ctx.beginPath();
        ctx.moveTo(forkX, cy + r);
        ctx.lineTo(forkX, cy - r * 0.1);
        // Tines
        ctx.moveTo(forkX - r * 0.2, cy - r * 0.1);
        ctx.lineTo(forkX - r * 0.2, cy - r * 0.7);
        ctx.moveTo(forkX, cy - r * 0.1);
        ctx.lineTo(forkX, cy - r * 0.7);
        ctx.moveTo(forkX + r * 0.2, cy - r * 0.1);
        ctx.lineTo(forkX + r * 0.2, cy - r * 0.7);
        haloStroke(1.2);
        // Knife — right side, blade + handle
        const knifeX = cx + r * 1.15;
        ctx.beginPath();
        ctx.moveTo(knifeX, cy + r);
        ctx.lineTo(knifeX, cy - r * 0.2);
        // Blade widens slightly
        ctx.lineTo(knifeX + r * 0.15, cy - r * 0.5);
        ctx.lineTo(knifeX, cy - r * 0.8);
        haloStroke(1.2);
        break;
      }
      case "ice_cream": {
        // Ice cream sundae in a bowl (🍨 style)
        // Bowl — wide arc at bottom
        const bowlW = r * 1.1,
          bowlH = r * 0.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.3, bowlW, bowlH, 0, 0, Math.PI);
        haloFill();
        // Scoop on top of bowl
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.15, r * 0.7, 0, Math.PI * 2);
        haloFill();
        // Small scoop on top
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.8, r * 0.4, 0, Math.PI * 2);
        haloFill();
        break;
      }
      case "bakery": {
        // Croissant (🥐) — crescent body tapering to pointed ends
        ctx.beginPath();
        // Start at left tip
        const lx = cx - r * 1.2,
          ly = cy + r * 0.1;
        const rx = cx + r * 1.2,
          ry = cy + r * 0.1;
        ctx.moveTo(lx, ly);
        // Top curve (outer arc, bows upward)
        ctx.bezierCurveTo(
          cx - r * 0.6,
          cy - r * 1.0,
          cx + r * 0.6,
          cy - r * 1.0,
          rx,
          ry,
        );
        // Bottom curve (inner arc, shallower)
        ctx.bezierCurveTo(
          cx + r * 0.5,
          cy + r * 0.3,
          cx - r * 0.5,
          cy + r * 0.3,
          lx,
          ly,
        );
        ctx.closePath();
        haloFill();
        // Score lines on the croissant body
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 0.8;
        for (let i = -1; i <= 1; i++) {
          const ox = cx + i * r * 0.35;
          ctx.beginPath();
          ctx.moveTo(ox, cy - r * 0.5);
          ctx.lineTo(ox, cy + r * 0.05);
          ctx.stroke();
        }
        break;
      }
      case "shopping": {
        // Shopping bag
        const bw = r * 1.3,
          bh = r * 1.2;
        ctx.beginPath();
        ctx.rect(cx - bw / 2, cy - bh / 2 + 1, bw, bh);
        haloFill();
        // Handle
        ctx.beginPath();
        ctx.arc(cx, cy - bh / 2 + 1, bw * 0.28, Math.PI, 0);
        haloStroke(1.5);
        break;
      }
      case "supermarket": {
        // Shopping cart
        const cartW = r * 1.0,
          cartH = r * 0.7;
        const cartL = cx - r * 0.6,
          cartT = cy - r * 0.3;
        // Cart basket (trapezoid)
        ctx.beginPath();
        ctx.moveTo(cartL, cartT);
        ctx.lineTo(cartL + cartW * 1.2, cartT);
        ctx.lineTo(cartL + cartW * 1.0, cartT + cartH);
        ctx.lineTo(cartL + cartW * 0.15, cartT + cartH);
        ctx.closePath();
        haloFill();
        // Handle bar extending left
        ctx.beginPath();
        ctx.moveTo(cartL, cartT);
        ctx.lineTo(cartL - r * 0.4, cartT - r * 0.3);
        haloStroke(1.5);
        // Wheels
        ctx.beginPath();
        ctx.arc(
          cartL + cartW * 0.3,
          cartT + cartH + r * 0.25,
          r * 0.2,
          0,
          Math.PI * 2,
        );
        haloFill();
        ctx.beginPath();
        ctx.arc(
          cartL + cartW * 0.85,
          cartT + cartH + r * 0.25,
          r * 0.2,
          0,
          Math.PI * 2,
        );
        haloFill();
        break;
      }
      case "health": {
        // Medical cross
        const cw = r * 0.5,
          ch = r * 1.3;
        ctx.beginPath();
        ctx.rect(cx - cw / 2, cy - ch / 2, cw, ch);
        ctx.rect(cx - ch / 2, cy - cw / 2, ch, cw);
        haloFill();
        break;
      }
      case "tourism": {
        // Info "i" in circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
        haloFill();
        // White "i"
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.35, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - r * 0.12, cy - r * 0.1, r * 0.24, r * 0.7);
        break;
      }
      case "historic": {
        // Monument/obelisk
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.35, cy + r);
        ctx.lineTo(cx + r * 0.35, cy + r);
        ctx.lineTo(cx + r * 0.2, cy - r * 0.4);
        ctx.lineTo(cx, cy - r);
        ctx.lineTo(cx - r * 0.2, cy - r * 0.4);
        ctx.closePath();
        haloFill();
        break;
      }
      case "services": {
        // Gear circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
        haloFill();
        // White inner circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        break;
      }
      case "transport": {
        // Bus front view
        const bw2 = r * 1.2,
          bh2 = r * 1.3;
        ctx.beginPath();
        ctx.roundRect(cx - bw2 / 2, cy - bh2 / 2, bw2, bh2, 2);
        haloFill();
        // Windshield (white rect)
        ctx.fillStyle = "white";
        ctx.fillRect(cx - bw2 * 0.35, cy - bh2 * 0.3, bw2 * 0.7, bh2 * 0.35);
        break;
      }
      case "education": {
        // Book shape
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r * 0.3);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        haloFill();
        break;
      }
      case "nightlife": {
        // Cocktail glass
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.75, cy - r * 0.6);
        ctx.lineTo(cx + r * 0.75, cy - r * 0.6);
        ctx.lineTo(cx, cy + r * 0.2);
        ctx.closePath();
        haloFill();
        // Stem
        ctx.beginPath();
        ctx.moveTo(cx, cy + r * 0.2);
        ctx.lineTo(cx, cy + r * 0.8);
        ctx.moveTo(cx - r * 0.35, cy + r * 0.8);
        ctx.lineTo(cx + r * 0.35, cy + r * 0.8);
        haloStroke(1.2);
        break;
      }
      case "recreation": {
        // Table tennis paddle
        const pr = r * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.15, pr, 0, Math.PI * 2);
        haloFill();
        // Handle
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.15, cy + pr * 0.6);
        ctx.lineTo(cx + r * 0.15, cy + pr * 0.6);
        ctx.lineTo(cx + r * 0.12, cy + r);
        ctx.lineTo(cx - r * 0.12, cy + r);
        ctx.closePath();
        haloFill();
        break;
      }
    }
  }

  setupInteractions() {
    // Mouse drag for pan
    let mouseDownPos = null;

    this.canvas.addEventListener("mousedown", (e) => {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      mouseDownPos = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = "grabbing";
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastPanX;
        const dy = e.clientY - this.lastPanY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;

        // Instant canvas translation while dragging
        this.translateCanvas(dx, dy);

        // Schedule full redraw after user stops moving
        this.debouncedRender();
      } else {
        // Check for feature hover (only if hover info is enabled and nothing is selected)
        if (this.hoverInfoEnabled && !this.selectedFeature) {
          this.checkFeatureHover(e);
        }
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      // Check if this was a click (not a drag)
      if (
        mouseDownPos &&
        Math.abs(e.clientX - mouseDownPos.x) < 5 &&
        Math.abs(e.clientY - mouseDownPos.y) < 5
      ) {
        // It's a click, not a drag
        if (this.hoveredFeature) {
          // Store the feature reference for persistent selection
          this.selectedFeature = this.hoveredFeature;
          this.updateInfoPanel(this.selectedFeature);
          this.renderMap(); // Re-render to show selection highlight
        } else if (this.selectedFeature) {
          // Clicked on empty space - deselect
          this.selectedFeature = null;
          this.clearInfoPanel();
          this.renderMap();
        }
      }

      this.isPanning = false;
      this.canvas.style.cursor = "crosshair";
      mouseDownPos = null;
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "crosshair";
      if (!this.selectedFeature) {
        this.hideTooltip();
      }
    });

    // ESC key to deselect
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.selectedFeature) {
        this.selectedFeature = null;
        this.hideTooltip();
        this.renderMap(); // Re-render to remove selection highlight
      }
    });

    // Touch support for mobile
    let touchStartDist = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
      }
    });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        this.offsetX += dx;
        this.offsetY += dy;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.renderMap();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const zoomFactor = dist / touchStartDist;
        this.setViewWidth(this.viewWidthMeters / zoomFactor); // inverted: larger distance = zoom in
        touchStartDist = dist;
      }
    });

    // Scroll wheel zoom with instant preview and debounced render
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();

        // Accumulate scroll deltas (deltaY is typically ~100 per scroll notch)
        this.scrollAccumulator += e.deltaY;

        // Threshold: step zoom level every ~100 units (one scroll notch)
        const threshold = 100;

        if (Math.abs(this.scrollAccumulator) >= threshold) {
          const steps = Math.floor(
            Math.abs(this.scrollAccumulator) / threshold,
          );

          // Update target zoom index
          if (this.scrollAccumulator > 0) {
            // Scroll down = zoom out
            this.targetZoomIndex = Math.min(
              this.zoomLevels.length - 1,
              this.targetZoomIndex + steps,
            );
          } else {
            // Scroll up = zoom in
            this.targetZoomIndex = Math.max(0, this.targetZoomIndex - steps);
          }

          // Instant canvas scale preview (no rerender)
          this.previewZoom();

          // Debounce actual render (300ms after last scroll)
          clearTimeout(this.zoomTimeout);
          this.zoomTimeout = setTimeout(() => {
            this.finalizeZoom();
          }, 300);

          // Reset accumulator (keep remainder for smooth feel)
          this.scrollAccumulator = this.scrollAccumulator % threshold;
        }
      },
      { passive: false },
    );
  }

  // Helper to convert viewWidthMeters to old zoom factor for calculations
  getZoomFactor() {
    // BASE_LAT_RANGE = 1.8 degrees ≈ 200km at zoom=1
    // viewWidthMeters = 200000 / zoom, so zoom = 200000 / viewWidthMeters
    return 200000 / this.viewWidthMeters;
  }

  setViewWidth(newWidthMeters) {
    // Snap to nearest discrete zoom level
    let nearestIndex = 0;
    let minDiff = Math.abs(this.zoomLevels[0] - newWidthMeters);

    for (let i = 1; i < this.zoomLevels.length; i++) {
      const diff = Math.abs(this.zoomLevels[i] - newWidthMeters);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIndex = i;
      }
    }

    const snappedWidth = this.zoomLevels[nearestIndex];

    // Don't update if already at this zoom level
    if (snappedWidth === this.viewWidthMeters) return;

    const scale = this.viewWidthMeters / snappedWidth;
    this.offsetX *= scale;
    this.offsetY *= scale;
    this.viewWidthMeters = snappedWidth;
    this.currentZoomIndex = nearestIndex;
    this.updateZoomSlider();
    this.updateStats();
    this.debouncedRender();
  }

  previewZoom() {
    // Instant canvas scaling for zoom preview (no rerender)
    if (!this._offscreenCanvas) return;

    const currentWidth = this.zoomLevels[this.currentZoomIndex];
    const targetWidth = this.zoomLevels[this.targetZoomIndex];
    const scale = currentWidth / targetWidth;

    this.isZooming = true;

    // Clear and scale the canvas to show preview
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();

    // Scale around center point
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-centerX, -centerY);

    // Draw last rendered frame scaled
    this.ctx.drawImage(this._offscreenCanvas, 0, 0);

    this.ctx.restore();
  }

  finalizeZoom() {
    // Actually perform the zoom with proper render
    this.isZooming = false;

    if (this.targetZoomIndex !== this.currentZoomIndex) {
      const oldWidth = this.viewWidthMeters;
      const newWidth = this.zoomLevels[this.targetZoomIndex];

      // Update offset to zoom around center
      const scale = oldWidth / newWidth;
      this.offsetX *= scale;
      this.offsetY *= scale;

      // Update state
      this.currentZoomIndex = this.targetZoomIndex;
      this.viewWidthMeters = newWidth;

      // Trigger proper render
      this.updateZoomSlider();
      this.updateStats();
      this.renderMap();
    }
  }

  zoomIn() {
    // Step to next smaller zoom level (more detail)
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
      this.targetZoomIndex = this.currentZoomIndex;
      this.setViewWidth(this.zoomLevels[this.currentZoomIndex]);
    }
  }

  zoomOut() {
    // Step to next larger zoom level (less detail)
    if (this.currentZoomIndex < this.zoomLevels.length - 1) {
      this.currentZoomIndex++;
      this.targetZoomIndex = this.currentZoomIndex;
      this.setViewWidth(this.zoomLevels[this.currentZoomIndex]);
    }
  }

  updateZoomSlider() {
    const slider = document.getElementById("zoomSlider");
    if (slider) {
      // Map viewWidthMeters to slider (log scale, inverted)
      const logMin = Math.log2(this.minViewWidthMeters);
      const logMax = Math.log2(this.maxViewWidthMeters);
      const logCurrent = Math.log2(this.viewWidthMeters);
      // Invert: small viewWidth (zoomed in) = high slider value
      slider.value = logMax + logMin - logCurrent;
    }
  }

  checkFeatureHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find feature at this position (iterate reverse so topmost features match first)
    let found = null;
    for (let i = this.renderedFeatures.length - 1; i >= 0; i--) {
      if (this.isPointNearFeature(x, y, this.renderedFeatures[i])) {
        found = this.renderedFeatures[i];
        break;
      }
    }

    if (found !== this.hoveredFeature) {
      const previousHover = this.hoveredFeature;
      this.hoveredFeature = found;

      if (found) {
        this.showTooltip(e.clientX, e.clientY, found);
        this.updateInfoPanel(found);
      } else {
        this.hideTooltip();
        this.clearInfoPanel();
      }

      // Re-render to show/hide highlight (only if hover changed)
      if (previousHover || found) {
        this.renderMap();
      }
    }
  }

  isPointNearFeature(x, y, feature) {
    const threshold = 10; // pixels

    if (feature.type === "Point") {
      const dx = x - feature.screenX;
      const dy = y - feature.screenY;
      return Math.sqrt(dx * dx + dy * dy) < threshold;
    } else if (feature.type === "LineString" || feature.type === "Polygon") {
      // Check if point is near any line segment
      for (let i = 0; i < feature.screenCoords.length - 1; i++) {
        const p1 = feature.screenCoords[i];
        const p2 = feature.screenCoords[i + 1];
        const dist = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
        if (dist < threshold) return true;
      }
    }
    return false;
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0)
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }

  showTooltip(x, y, feature) {
    let tooltip = document.getElementById("mapTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "mapTooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        max-width: 200px;
      `;
      document.body.appendChild(tooltip);
    }

    const props = feature.properties;
    let text = "";

    if (props.name) text += `<strong>${props.name}</strong><br>`;
    if (props.highway) text += `Highway: ${props.highway}<br>`;
    if (props.building) text += `Building: ${props.building}<br>`;
    if (props.natural) text += `Natural: ${props.natural}<br>`;
    if (props.water || props.waterway)
      text += `Water: ${props.water || props.waterway}<br>`;
    if (props.amenity) text += `Amenity: ${props.amenity}<br>`;

    if (!text) text = `Feature type: ${feature.type}`;

    tooltip.innerHTML = text;
    tooltip.style.left = x + 15 + "px";
    tooltip.style.top = y + 15 + "px";
    tooltip.style.display = "block";
  }

  hideTooltip() {
    const tooltip = document.getElementById("mapTooltip");
    if (tooltip) tooltip.style.display = "none";
  }

  updateInfoPanel(feature) {
    const panel = document.getElementById("infoPanel");
    if (!panel) return;

    const props = feature.properties;
    let html = "<h3>Feature Information</h3>";

    html += `<div class="info-item"><span class="label">Type:</span> ${feature.type}</div>`;

    Object.keys(props).forEach((key) => {
      if (props[key]) {
        html += `<div class="info-item"><span class="label">${key}:</span> ${props[key]}</div>`;
      }
    });

    panel.innerHTML = html;
    panel.style.display = "block";
  }

  clearInfoPanel() {
    const panel = document.getElementById("infoPanel");
    if (panel) {
      panel.innerHTML =
        "<h3>Feature Information</h3><p>Hover over map features to see details</p>";
    }
  }

  updateFeatureScreenCoords(feature, bounds) {
    // Recalculate screen coordinates for a feature based on current viewport
    // Uses the stored renderedFeature type (not geom.type, which may differ for Multi* types)
    if (!feature.feature || !feature.feature.geometry) return;

    const geom = feature.feature.geometry;

    if (feature.type === "Point") {
      const [lon, lat] = geom.coordinates;
      const screenPos = this.latLonToScreen(lat, lon, bounds);
      feature.screenX = screenPos.x;
      feature.screenY = screenPos.y;
    } else if (feature.type === "LineString") {
      // For MultiLineString, geom.coordinates is array of line arrays
      // The renderedFeature was created from one line, but we stored the full geometry
      // Use the screenCoords length to find the matching ring
      const coords =
        geom.type === "LineString"
          ? geom.coordinates
          : this.findMatchingCoords(
              feature.screenCoords.length,
              geom.coordinates,
            );
      if (coords) {
        feature.screenCoords = coords.map(([lon, lat]) =>
          this.latLonToScreen(lat, lon, bounds),
        );
      }
    } else if (feature.type === "Polygon") {
      // For MultiPolygon, each polygon's outer ring was stored separately
      const ring =
        geom.type === "Polygon"
          ? geom.coordinates[0]
          : this.findMatchingCoords(
              feature.screenCoords.length,
              geom.coordinates.map((p) => p[0]),
            );
      if (ring) {
        feature.screenCoords = ring.map(([lon, lat]) =>
          this.latLonToScreen(lat, lon, bounds),
        );
      }
    }
  }

  findMatchingCoords(targetLength, coordArrays) {
    // Find the coordinate array that matches the expected length
    for (const coords of coordArrays) {
      if (coords.length === targetLength) return coords;
    }
    return coordArrays[0]; // Fallback to first
  }

  highlightFeature(feature, bounds, mode) {
    // mode: "hovered" or "selected"
    const isSelected = mode === "selected";

    // Recalculate screen coordinates for current viewport
    if (feature.feature) {
      this.updateFeatureScreenCoords(feature, bounds);
    }

    // Highlight color: yellow for hover, orange for selected
    const highlightColor = isSelected
      ? toRGBA(getColor("highlight", "selected")) // Orange for selected
      : toRGBA(getColor("highlight", "hovered")); // Yellow for hover

    const highlightWidth = isSelected ? 6 : 4;

    if (feature.type === "Point") {
      // Highlight point with a circle
      this.ctx.strokeStyle = highlightColor;
      this.ctx.lineWidth = highlightWidth;
      this.ctx.fillStyle = isSelected
        ? toRGBA(getColor("highlight", "selectedFill"))
        : toRGBA(getColor("highlight", "hoveredFill"));
      this.ctx.beginPath();
      this.ctx.arc(feature.screenX, feature.screenY, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (feature.type === "LineString" && feature.screenCoords) {
      // Highlight line with thicker stroke
      this.ctx.strokeStyle = highlightColor;
      this.ctx.lineWidth = highlightWidth;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();

      for (let i = 0; i < feature.screenCoords.length; i++) {
        const coord = feature.screenCoords[i];
        if (i === 0) {
          this.ctx.moveTo(coord.x, coord.y);
        } else {
          this.ctx.lineTo(coord.x, coord.y);
        }
      }
      this.ctx.stroke();
    } else if (feature.type === "Polygon" && feature.screenCoords) {
      // Highlight polygon with thicker outline
      this.ctx.strokeStyle = highlightColor;
      this.ctx.lineWidth = highlightWidth;
      this.ctx.fillStyle = isSelected
        ? toRGBA(getColor("highlight", "selectedFill"))
        : toRGBA(getColor("highlight", "hoveredFill"));
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();

      for (let i = 0; i < feature.screenCoords.length; i++) {
        const coord = feature.screenCoords[i];
        if (i === 0) {
          this.ctx.moveTo(coord.x, coord.y);
        } else {
          this.ctx.lineTo(coord.x, coord.y);
        }
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  debouncedRender() {
    // Clear any pending render
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }

    // Schedule new render
    this.renderTimeout = setTimeout(() => {
      this.renderMap();
    }, this.renderDelay);
  }

  computeBoundingBox(geom) {
    // Compute bounding box for a geometry
    let minLon = Infinity,
      maxLon = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;

    const updateBounds = (coord) => {
      const [lon, lat] = coord;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };

    const coords = geom.coordinates;
    const type = geom.type;

    if (type === "Point") {
      updateBounds(coords);
    } else if (type === "LineString") {
      for (const coord of coords) updateBounds(coord);
    } else if (type === "Polygon") {
      for (const coord of coords[0]) updateBounds(coord);
    } else if (type === "MultiLineString") {
      for (const line of coords) {
        for (const coord of line) updateBounds(coord);
      }
    } else if (type === "MultiPolygon") {
      for (const polygon of coords) {
        for (const coord of polygon[0]) updateBounds(coord);
      }
    }

    return { minLon, maxLon, minLat, maxLat };
  }

  isFeatureInViewport(feature, bounds) {
    // Quick viewport culling - check if feature overlaps visible area
    if (!feature.geometry || !feature.geometry.coordinates) return false;

    // Use cached bounding box if available (much faster than checking every coordinate)
    if (feature._bbox) {
      const bbox = feature._bbox;
      // Quick rejection: if feature bbox doesn't overlap viewport, skip
      if (
        bbox.maxLon < bounds.minLon ||
        bbox.minLon > bounds.maxLon ||
        bbox.maxLat < bounds.minLat ||
        bbox.minLat > bounds.maxLat
      ) {
        return false;
      }
      // Bbox overlaps, feature is likely visible
      return true;
    }

    // Fallback: check coordinates (slower)
    const checkCoord = (coord) => {
      const [lon, lat] = coord;
      return (
        lon >= bounds.minLon &&
        lon <= bounds.maxLon &&
        lat >= bounds.minLat &&
        lat <= bounds.maxLat
      );
    };

    const type = feature.geometry.type;
    if (type === "Point") {
      return checkCoord(feature.geometry.coordinates);
    } else if (type === "LineString") {
      return feature.geometry.coordinates.some(checkCoord);
    } else if (type === "Polygon") {
      return feature.geometry.coordinates[0].some(checkCoord);
    } else if (type === "MultiLineString") {
      return feature.geometry.coordinates.some((line) => line.some(checkCoord));
    } else if (type === "MultiPolygon") {
      return feature.geometry.coordinates.some((polygon) =>
        polygon[0].some(checkCoord),
      );
    }
    return false;
  }

  getTilesetForView() {
    // Find tileset whose view range contains current view width
    for (const tileset of this.tilesets) {
      const [min, max] = tileset.view_range_meters;
      if (this.viewWidthMeters >= min && this.viewWidthMeters <= max) {
        return tileset.id;
      }
    }

    // Fallback to closest tileset
    if (this.viewWidthMeters < 2000) return "t1";
    if (this.viewWidthMeters < 15000) return "t2";
    if (this.viewWidthMeters < 150000) return "t3";
    return "t4";
  }

  getVisibleTiles(bounds) {
    // Calculate which tiles are visible in the current viewport using custom tile sizes
    const tilesetId = this.getTilesetForView();
    const tileset = this.tilesets.find((ts) => ts.id === tilesetId);
    const tileSizeM = tileset.tile_size_meters;

    // Convert bounds to tile coordinates using custom tile size
    const latAvg = (bounds.minLat + bounds.maxLat) / 2;
    const metersPerDegLon = 111320 * Math.cos((latAvg * Math.PI) / 180);
    const metersPerDegLat = 111320;

    const tileWidthDeg = tileSizeM / metersPerDegLon;
    const tileHeightDeg = tileSizeM / metersPerDegLat;

    const minX = Math.floor(bounds.minLon / tileWidthDeg);
    const maxX = Math.floor(bounds.maxLon / tileWidthDeg);
    const minY = Math.floor(bounds.minLat / tileHeightDeg);
    const maxY = Math.floor(bounds.maxLat / tileHeightDeg);

    const tiles = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ tileset: tilesetId, x, y });
      }
    }
    return tiles;
  }

  getTileKey(tileset, x, y) {
    return `${tileset}/${x}/${y}`;
  }

  async loadTile(tileset, x, y) {
    const key = this.getTileKey(tileset, x, y);

    // Check cache first
    if (this.tileCache.has(key)) {
      return this.tileCache.get(key);
    }

    // Check if already loading
    if (this.loadingTiles.has(key)) {
      // Wait for existing load to complete
      while (this.loadingTiles.has(key)) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return this.tileCache.get(key);
    }

    // Start loading
    this.loadingTiles.add(key);

    try {
      // Add cache-busting parameter based on tile index generation time
      const cacheBuster = this.tileIndex?.generated || Date.now();
      const fetchStart = performance.now();
      const response = await fetch(
        `tiles/${tileset}/${x}/${y}.json?v=${cacheBuster}`,
      );
      const fetchTime = performance.now() - fetchStart;

      if (!response.ok) {
        // Tile doesn't exist (no data in this area)
        this.loadingTiles.delete(key);
        this.tileCache.set(key, { type: "FeatureCollection", features: [] });
        return this.tileCache.get(key);
      }

      // Parse JSON directly (no decompression needed)
      const parseStart = performance.now();
      const tileData = await response.json();
      const parseTime = performance.now() - parseStart;

      // Track per-tile timing for instrumentation
      if (!this._tileFetchStats) this._tileFetchStats = [];
      this._tileFetchStats.push({
        key,
        fetchTime,
        parseTime,
        features: tileData.features?.length || 0,
      });

      this.tileCache.set(key, tileData);
      this.loadingTiles.delete(key);

      return tileData;
    } catch (error) {
      console.warn(`Failed to load tile ${key}:`, error);
      this.loadingTiles.delete(key);
      this.tileCache.set(key, { type: "FeatureCollection", features: [] });
      return this.tileCache.get(key);
    }
  }

  analyzeTileContent(tileData, tileKey) {
    // Use pre-computed metadata if available (optimization)
    if (tileData && tileData._meta) {
      return {
        hasCoastline: tileData._meta.hasCoastline,
        hasLandFeatures: tileData._meta.hasLandFeatures,
        isEmpty:
          !tileData._meta.hasCoastline &&
          !tileData._meta.hasLandFeatures &&
          (!tileData.features || tileData.features.length === 0),
      };
    }

    console.warn("No tile metadata", tileKey);

    // Fallback: analyze tile features (for tiles without metadata)
    if (!tileData || !tileData.features || tileData.features.length === 0) {
      return { hasCoastline: false, hasLandFeatures: false, isEmpty: true };
    }

    let hasCoastline = false;
    let hasLandFeatures = false;

    for (const feature of tileData.features) {
      const props = feature.properties || {};

      // Check for coastline
      if (props.natural === "coastline") {
        hasCoastline = true;
      }

      // Check for land-specific features
      // Roads, buildings, landuse, etc indicate land
      if (
        props.highway ||
        props.building ||
        props.landuse ||
        props.railway ||
        props.amenity ||
        props.shop ||
        (props.natural &&
          props.natural !== "coastline" &&
          props.natural !== "water")
      ) {
        hasLandFeatures = true;
      }

      // Early exit if we found both
      if (hasCoastline && hasLandFeatures) {
        break;
      }
    }

    return {
      hasCoastline,
      hasLandFeatures,
      isEmpty: false,
    };
  }

  renderTileBackgrounds(visibleTiles, bounds) {
    // Colors from theme
    const OCEAN_COLOR = toRGB(getColor("background", "ocean"));
    const LAND_COLOR = toRGB(getColor("background", "land"));
    const COASTLINE_COLOR = toRGB(getColor("background", "coastline"));

    // Analyze tiles
    const tileAnalyses = new Map();
    for (const tile of visibleTiles) {
      const tileKey = this.getTileKey(tile.tileset, tile.x, tile.y);
      const tileData = this.tileCache.get(tileKey);
      // tile does not exist(?)
      if (!tileData) continue;

      const analysis = this.analyzeTileContent(tileData, tileKey);
      tileAnalyses.set(tileKey, analysis);
    }

    // Default background is always ocean
    this.ctx.fillStyle = OCEAN_COLOR;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Now render specific tile backgrounds as needed
    for (const tile of visibleTiles) {
      const tileKey = this.getTileKey(tile.tileset, tile.x, tile.y);
      const analysis = tileAnalyses.get(tileKey);
      if (!analysis) {
        console.log("No analysis for tile", tileKey, bounds);
        continue;
      }

      const tileBounds = this.getTileBounds(tile.tileset, tile.x, tile.y);

      // Coastline tiles get very light ocean color
      if (analysis.hasCoastline) {
        this.fillTileBounds(tileBounds, COASTLINE_COLOR, bounds);
        // TODO: fill ocean side of coastline and revert to land background color
      }
      // Land tiles (no coastline) get land color
      else if (analysis.hasLandFeatures) {
        this.fillTileBounds(tileBounds, LAND_COLOR, bounds);
      }
      // Ocean tiles (empty) already have ocean background from default
    }
  }

  getTileBounds(tilesetId, x, y) {
    // Calculate geographic bounds of a tile using the tileset's meter-based grid
    const tileset = this.tilesets.find((ts) => ts.id === tilesetId);
    const tileSizeM = tileset.tile_size_meters;

    // Use same latitude approximation as tile generation
    const latApprox = y * (tileSizeM / 111320) + tileSizeM / 111320 / 2;
    const metersPerDegLon = 111320 * Math.cos((latApprox * Math.PI) / 180);
    const metersPerDegLat = 111320;

    const tileWidthDeg = tileSizeM / metersPerDegLon;
    const tileHeightDeg = tileSizeM / metersPerDegLat;

    const minLon = x * tileWidthDeg;
    const maxLon = (x + 1) * tileWidthDeg;
    const minLat = y * tileHeightDeg;
    const maxLat = (y + 1) * tileHeightDeg;

    return { minLon, maxLon, minLat, maxLat };
  }

  fillTileBounds(tileBounds, color, viewBounds) {
    // Convert tile geographic bounds to screen coordinates and fill
    const minX = this.lonToScreenX(tileBounds.minLon, viewBounds);
    const maxX = this.lonToScreenX(tileBounds.maxLon, viewBounds);
    const minY = this.latToScreenY(tileBounds.maxLat, viewBounds); // Note: Y is inverted
    const maxY = this.latToScreenY(tileBounds.minLat, viewBounds);

    this.ctx.fillStyle = color;
    this.ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  }

  lonToScreenX(lon, bounds) {
    const lonRange = bounds.maxLon - bounds.minLon;
    return ((lon - bounds.minLon) / lonRange) * this.canvasWidth;
  }

  latToScreenY(lat, bounds) {
    const latRange = bounds.maxLat - bounds.minLat;
    return ((bounds.maxLat - lat) / latRange) * this.canvasHeight;
  }

  async loadVisibleTiles(bounds) {
    const tiles = this.getVisibleTiles(bounds);

    // Tile loading stats reported in renderMap instrumentation

    // Load all visible tiles in parallel
    const loadStart = performance.now();
    const tilePromises = tiles.map((tile) =>
      this.loadTile(tile.tileset, tile.x, tile.y),
    );
    const tileData = await Promise.all(tilePromises);
    const loadTime = performance.now() - loadStart;
    // loadTime reported in renderMap instrumentation

    // Merge all tile features into a single GeoJSON
    const mergeStart = performance.now();
    const features = [];
    const seenFeatures = new Set(); // Track seen features to avoid duplicates

    // Get current LOD for early filtering
    const currentLOD = this.getLOD();
    let lodFilteredCount = 0;
    let bboxTime = 0;

    // Geometry type to numeric ID mapping for hash
    const geomTypeId = {
      Point: 1,
      LineString: 2,
      Polygon: 3,
      MultiLineString: 4,
      MultiPolygon: 5,
    };

    for (const tile of tileData) {
      if (tile && tile.features) {
        for (const feature of tile.features) {
          // Early LOD filtering: skip features that won't be rendered at current zoom
          if (feature._render && feature._render.minLOD > currentLOD) {
            lodFilteredCount++;
            continue;
          }
          // Fast deduplication: use multiple coordinates + vertex count + geometry type as string key
          // GeoJSON polygons are closed rings (first == last coord), so we use
          // first coord, a midpoint, and vertex count for better discrimination
          const geom = feature.geometry;
          let featureKey;

          if (geom && geom.coordinates) {
            const coords = geom.coordinates;
            const typeId = geomTypeId[geom.type] || 0;
            let keyParts;

            if (geom.type === "Point") {
              keyParts = `${typeId},${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;
            } else if (geom.type === "LineString") {
              const mid = coords[Math.floor(coords.length / 2)];
              keyParts = `${typeId},${coords.length},${coords[0][0].toFixed(6)},${coords[0][1].toFixed(6)},${mid[0].toFixed(6)},${mid[1].toFixed(6)}`;
            } else if (geom.type === "Polygon") {
              const ring = coords[0];
              const mid = ring[Math.floor(ring.length / 2)];
              keyParts = `${typeId},${ring.length},${ring[0][0].toFixed(6)},${ring[0][1].toFixed(6)},${mid[0].toFixed(6)},${mid[1].toFixed(6)}`;
            } else if (geom.type === "MultiLineString") {
              const first = coords[0][0];
              const lastLine = coords[coords.length - 1];
              const last = lastLine[lastLine.length - 1];
              const totalVerts = coords.reduce((s, c) => s + c.length, 0);
              keyParts = `${typeId},${totalVerts},${first[0].toFixed(6)},${first[1].toFixed(6)},${last[0].toFixed(6)},${last[1].toFixed(6)}`;
            } else if (geom.type === "MultiPolygon") {
              const first = coords[0][0][0];
              const lastPoly = coords[coords.length - 1][0];
              const mid = lastPoly[Math.floor(lastPoly.length / 2)];
              const totalVerts = coords.reduce((s, p) => s + p[0].length, 0);
              keyParts = `${typeId},${totalVerts},${first[0].toFixed(6)},${first[1].toFixed(6)},${mid[0].toFixed(6)},${mid[1].toFixed(6)}`;
            }

            // Include feature ID if available
            if (feature.id) {
              keyParts += `,${feature.id}`;
            }

            featureKey = keyParts;
          } else {
            // Fallback for features without geometry - use object reference
            featureKey = Math.random();
          }

          // Only add if we haven't seen this feature before
          if (!seenFeatures.has(featureKey)) {
            seenFeatures.add(featureKey);

            // Pre-compute bounding box for fast viewport culling
            if (geom && geom.coordinates) {
              const bboxStart = performance.now();
              feature._bbox = this.computeBoundingBox(geom);
              bboxTime += performance.now() - bboxStart;
            }

            features.push(feature);
          }
        }
      }
    }
    const mergeTime = performance.now() - mergeStart;
    const totalLoaded = tileData.reduce(
      (sum, t) => sum + (t?.features?.length || 0),
      0,
    );
    const duplicatesRemoved =
      seenFeatures.size > 0
        ? totalLoaded - features.length - lodFilteredCount
        : 0;

    // Store merge stats for render instrumentation
    this._lastMergeStats = {
      mergeTime,
      totalLoaded,
      features: features.length,
      lodFiltered: lodFilteredCount,
      duplicatesRemoved,
      bboxTime,
    };

    return {
      type: "FeatureCollection",
      features: features,
    };
  }

  async loadMapData() {
    try {
      // Load tile index (with cache buster to always get latest)
      const indexResponse = await fetch(`tiles/index.json?t=${Date.now()}`);
      if (indexResponse.ok) {
        this.tileIndex = await indexResponse.json();

        // Use bounds from index.json
        if (this.tileIndex.bounds) {
          this.tileBounds = this.tileIndex.bounds;
          console.log("[TILES] Loaded bounds from index:", this.tileBounds);
        }

        // Use center from index.json for initial view
        if (this.tileIndex.center) {
          this.centerLat = this.tileIndex.center.lat;
          this.centerLon = this.tileIndex.center.lon;
          console.log(
            `[TILES] Loaded center: ${this.centerLat}, ${this.centerLon}`,
          );
        }

        // Log tile generation time for cache debugging
        if (this.tileIndex.generated) {
          const genDate = new Date(this.tileIndex.generated);
          console.log(`[TILES] Generated: ${genDate.toLocaleString()}`);
        }
      }

      // Initialize with empty data - tiles will be loaded progressively
      this.mapData = {
        type: "FeatureCollection",
        features: [],
      };

      // Tile system ready
      return true;
    } catch (error) {
      console.error("Failed to load tile index:", error);
      return false;
    }
  }

  calculateBounds() {
    // Hamburg city center: 53.55°N, 9.99°E
    // Initial view: ~10km radius (suitable for city exploration)
    if (!this.mapData || !this.mapData.features.length) {
      return {
        minLon: 9.85,
        maxLon: 10.13,
        minLat: 53.46,
        maxLat: 53.64,
      };
    }

    let minLon = Infinity,
      maxLon = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;

    for (const feature of this.mapData.features) {
      if (!feature.geometry || !feature.geometry.coordinates) continue;

      const processCoord = (coord) => {
        const [lon, lat] = coord;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      };

      if (feature.geometry.type === "Point") {
        processCoord(feature.geometry.coordinates);
      } else if (feature.geometry.type === "LineString") {
        feature.geometry.coordinates.forEach(processCoord);
      } else if (feature.geometry.type === "Polygon") {
        feature.geometry.coordinates[0].forEach(processCoord);
      } else if (feature.geometry.type === "MultiLineString") {
        feature.geometry.coordinates.forEach((line) => {
          line.forEach(processCoord);
        });
      } else if (feature.geometry.type === "MultiPolygon") {
        feature.geometry.coordinates.forEach((polygon) => {
          polygon[0].forEach(processCoord);
        });
      }
    }

    // Add 5% padding
    const lonPadding = (maxLon - minLon) * 0.05;
    const latPadding = (maxLat - minLat) * 0.05;

    return {
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding,
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
    };
  }

  // Get a pooled point object (reduces allocations)
  _getPooledPoint(x, y) {
    if (this._pointPoolIndex >= this._pointPool.length) {
      // Pool exhausted, allocate new (shouldn't happen often)
      return { x, y };
    }
    const point = this._pointPool[this._pointPoolIndex++];
    point.x = x;
    point.y = y;
    return point;
  }

  // Reset point pool for next frame
  _resetPointPool() {
    this._pointPoolIndex = 0;
  }

  // Get cached rgba string (reduces string allocations)
  _getRGBA(r, g, b, a) {
    const key = `${r},${g},${b},${a}`;
    let rgba = this._rgbaCache.get(key);
    if (!rgba) {
      rgba = `rgba(${r},${g},${b},${a})`;
      this._rgbaCache.set(key, rgba);
    }
    return rgba;
  }

  latLonToScreen(lat, lon, bounds) {
    // Bounds are already adjusted for zoom and pan in renderMap
    // Just do a simple normalized transformation
    const x =
      ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) *
      this.canvasWidth;
    const y =
      this.canvasHeight -
      ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) *
        this.canvasHeight;

    return this._getPooledPoint(x, y);
  }

  async renderMap() {
    const startTime = performance.now();
    const perfTimings = {}; // Track performance of each step

    // Reset object pools for this frame
    this._resetPointPool();

    // Calculate and set map bounds
    const boundsStart = performance.now();
    const bounds = this.calculateBounds();
    perfTimings.bounds = performance.now() - boundsStart;

    const viewKm =
      this.viewWidthMeters >= 1000
        ? `${(this.viewWidthMeters / 1000).toFixed(1)}km`
        : `${this.viewWidthMeters.toFixed(0)}m`;

    // Adjust bounds for zoom and pan
    // The key insight: we want to zoom/pan around the GEOGRAPHIC center, not the bounds center
    // Use fixed Hamburg center coordinates
    const centerLon = this.centerLon; // 9.99
    const centerLat = this.centerLat; // 53.55

    // Calculate aspect ratio correction for Mercator projection at this latitude
    // At Hamburg (53.55°N), we need to correct for the cos(latitude) factor
    const latRad = (centerLat * Math.PI) / 180;
    const aspectCorrection = 1 / Math.cos(latRad);

    // Canvas aspect ratio (width/height)
    const canvasAspect = this.canvasWidth / this.canvasHeight; // 1.5 for 1200x800

    // Use fixed base ranges for consistent zoom behavior
    // These match the Hamburg region bounds (~100km radius)
    const BASE_LAT_RANGE = 1.8; // Hamburg region latitude range
    const BASE_LON_RANGE = 3.02; // Hamburg region longitude range
    const baseLatRange = BASE_LAT_RANGE;
    const baseLonRange = BASE_LON_RANGE;

    // Calculate visible range accounting for zoom
    // We need to maintain aspect ratio: lonRange should be canvasAspect times latRange (in screen space)
    // But in geographic space, we need to account for Mercator distortion
    const latRange = baseLatRange / this.getZoomFactor();
    const lonRange = latRange * canvasAspect * aspectCorrection;

    // Calculate approximate scale (km across the view)
    const kmPerDegLat = 111; // Roughly 111km per degree latitude
    const viewHeightKm = latRange * kmPerDegLat;
    const viewWidthKm = lonRange * kmPerDegLat * Math.cos(latRad);
    // viewWidthKm/viewHeightKm available for debug if needed

    // Adjust for pan (convert screen offset to geo offset)
    // offsetX/Y represent how much we've shifted the view
    // Positive offsetX = dragged right = need to shift center west (negative lon)
    // Positive offsetY = dragged down = need to shift center south (negative lat) because screen Y is inverted
    const lonOffset = -(this.offsetX / this.canvasWidth) * lonRange;
    const latOffset = (this.offsetY / this.canvasHeight) * latRange;

    const adjustedBounds = {
      minLon: centerLon - lonRange / 2 + lonOffset,
      maxLon: centerLon + lonRange / 2 + lonOffset,
      minLat: centerLat - latRange / 2 + latOffset,
      maxLat: centerLat + latRange / 2 + latOffset,
    };

    // Load visible tiles
    const tileLoadStart = performance.now();
    const visibleTiles = this.getVisibleTiles(adjustedBounds);
    const cachedCount = visibleTiles.filter(({ tileset, x, y }) =>
      this.tileCache.has(this.getTileKey(tileset, x, y)),
    ).length;

    this.mapData = await this.loadVisibleTiles(adjustedBounds);
    perfTimings.tileLoad = performance.now() - tileLoadStart;

    // Update tile stats
    document.getElementById("tileCount").textContent = visibleTiles.length;
    document.getElementById("cachedTiles").textContent = cachedCount;
    document.getElementById("tileLoadTime").textContent =
      perfTimings.tileLoad.toFixed(2);

    // Tile loading stats available in UI

    let featureCount = 0;
    let culledCount = 0;
    let lodCulledCount = 0;
    this.renderedFeatures.length = 0;

    // Determine LOD (Level of Detail) based on zoom
    // At low zoom: only major features
    // At high zoom: all details
    const lod = this.getLOD();

    // Start feature classification timing
    const classifyStart = performance.now();

    // Reuse layer arrays (avoid reallocating every frame)
    if (!this._layers) {
      this._layers = {
        natural_background: [],
        forests: [],
        water_areas: [],
        islands: [],
        landuse_areas: [],
        buildings: [],
        aeroways: [],
        tunnels: [],
        waterways: [],
        tunnel_waterways: [],
        surface_roads: [],
        bridge_roads: [],
        surface_railways: [],
        bridge_railways: [],
        boundaries: [],
        coastline: [], // Coastline visualization (magenta with arrows)
        points: [],
        place_labels: [], // City/town/village names
        water_labels: [], // Lake/pond/canal/river names
        building_labels: [], // House numbers
      };
    }
    const layers = this._layers;
    for (const key in layers) layers[key].length = 0;

    // Classify and filter features by LOD
    for (const feature of this.mapData.features) {
      if (!feature.geometry || !feature.geometry.coordinates) continue;

      // Viewport culling - skip features not in view
      if (!this.isFeatureInViewport(feature, adjustedBounds)) {
        culledCount++;
        continue;
      }

      const props = feature.properties || {};
      const type = feature.geometry.type;

      // Classification cache, but invalidate if view width changed significantly
      // (width calculation is view-dependent on metersPerPixel)
      let featureInfo = feature._classCache;
      const currentViewWidth = this.viewWidthMeters;

      // Invalidate cache if view width changed by >20% (width needs recalculation)
      // This catches zoom changes within same tile zoom level
      if (featureInfo && feature._cachedViewWidth) {
        const viewWidthRatio = currentViewWidth / feature._cachedViewWidth;
        if (viewWidthRatio < 0.8 || viewWidthRatio > 1.25) {
          featureInfo = null;
          feature._classCache = null;
        }
      }

      if (!featureInfo) {
        featureInfo = this.classifyFeature(props, type);
        feature._classCache = featureInfo;
        feature._cachedViewWidth = currentViewWidth;
      }

      // Precompute batch keys to avoid string allocations in render loop
      if (featureInfo.color) {
        const c = featureInfo.color;
        const w = featureInfo.width || 1;
        const dash = featureInfo.dashPattern
          ? `|d${featureInfo.dashPattern.join(",")}`
          : "";
        featureInfo._lineKey = `${c.r},${c.g},${c.b},${c.a}|${w}${dash}`;
        featureInfo._fillKey = this._getRGBA(c.r, c.g, c.b, c.a / 255);
      }

      // For POIs, check toggle state dynamically (it can change without re-classifying)
      if (
        featureInfo.poiCategory &&
        !this.poiCategoryState[featureInfo.poiCategory]
      ) {
        continue;
      }

      if (featureInfo.minLOD > lod) {
        lodCulledCount++;
        continue;
      }

      // Add to appropriate layer
      if (featureInfo.layer) {
        layers[featureInfo.layer].push({
          feature,
          props,
          type,
          color: featureInfo.color,
          fill: featureInfo.fill,
          width: featureInfo.width,
          borderWidth: featureInfo.borderWidth,
          borderColor: featureInfo.borderColor,
          isRailway: featureInfo.isRailway,
          roadPriority: featureInfo.roadPriority,
          isConstruction: featureInfo.isConstruction,
          poiCategory: featureInfo.poiCategory,
          stroke: featureInfo.stroke,
          strokeColor: featureInfo.strokeColor,
          strokeWidth: featureInfo.strokeWidth,
          _lineKey: featureInfo._lineKey,
          _fillKey: featureInfo._fillKey,
          showDirection: featureInfo.showDirection,
          pattern: featureInfo.pattern,
          bridgeLayer: featureInfo.bridgeLayer,
          dashPattern: featureInfo.dashPattern,
          isBicycleRoad: featureInfo.isBicycleRoad,
          isRunway: featureInfo.isRunway,
          runwayRef: featureInfo.runwayRef,
          runwayLit: featureInfo.runwayLit,
          runwayLength: featureInfo.runwayLength,
          isHelipad: featureInfo.isHelipad,
          placePriority: featureInfo.placePriority,
          fontSize: featureInfo.fontSize,
          placeType: featureInfo.placeType,
          population: featureInfo.population,
          isPlatform: featureInfo.isPlatform,
        });

        // Add water labels
        if (featureInfo.waterLabel) {
          layers.water_labels.push({
            feature,
            props,
            type,
            name: featureInfo.waterLabel.name,
            waterType: featureInfo.waterLabel.waterType,
          });
        }

        // Add building labels (house numbers)
        if (featureInfo.houseNumber) {
          layers.building_labels.push({
            feature,
            props,
            type,
            number: featureInfo.houseNumber.number,
            color: featureInfo.color,
          });
        }
      }
    }

    perfTimings.classify = performance.now() - classifyStart;

    // Start rendering timing
    const renderStart = performance.now();

    // Smart tile background rendering based on content
    // Analyze each tile and render appropriate background
    this.renderTileBackgrounds(visibleTiles, adjustedBounds);

    perfTimings.clearCanvas = performance.now() - renderStart;

    // Render all layers in correct z-order using Canvas2D
    // Background to foreground (bottom to top)
    const layerTimings = {};

    // 1. Natural background (parks, farmland, meadows)
    let layerStart = performance.now();
    this.renderLayer(layers.natural_background, adjustedBounds, true);
    layerTimings.natural = performance.now() - layerStart;

    // 1b. Forests (on top of parks so they're visible inside parks)
    layerStart = performance.now();
    this.renderLayer(layers.forests, adjustedBounds, true);
    layerTimings.forests = performance.now() - layerStart;

    // 2. Landuse areas (commercial, industrial, residential)
    layerStart = performance.now();
    this.renderLayer(layers.landuse_areas, adjustedBounds, true);
    layerTimings.landuse = performance.now() - layerStart;

    // 3. Surface waterways (rivers, streams — drawn before water polygons so lakes cover them)
    layerStart = performance.now();
    this.renderLayer(layers.waterways, adjustedBounds, false);
    layerTimings.waterways = performance.now() - layerStart;

    // 3b. Water areas (lakes, rivers as polygons — on top of waterway lines)
    layerStart = performance.now();
    this.renderLayer(layers.water_areas, adjustedBounds, true);
    layerTimings.water = performance.now() - layerStart;

    // 3c. Islands
    layerStart = performance.now();
    this.renderLayer(layers.islands, adjustedBounds, true);
    layerTimings.islands = performance.now() - layerStart;

    // 4a. Aeroway areas (aprons — under buildings)
    layerStart = performance.now();
    this.renderAeroways(layers.aeroways, adjustedBounds, "areas");
    layerTimings.aerowayAreas = performance.now() - layerStart;

    // 4b. Buildings (on top of aprons)
    layerStart = performance.now();
    this.renderLayer(layers.buildings, adjustedBounds, true);
    layerTimings.buildings = performance.now() - layerStart;

    // 5. Tunnels (underground, semi-transparent)
    layerStart = performance.now();
    this.renderRoadLayer(layers.tunnels, adjustedBounds, TUNNEL_ROAD_ALPHA);
    layerTimings.tunnels = performance.now() - layerStart;

    // 6. Tunneled waterways (semi-transparent, after road tunnels)
    layerStart = performance.now();
    this.renderLayer(layers.tunnel_waterways, adjustedBounds, false);
    layerTimings.tunnelWaterways = performance.now() - layerStart;

    // 7. Surface roads (sorted by priority, with outlines)
    layerStart = performance.now();
    this.renderRoadLayer(layers.surface_roads, adjustedBounds);
    layerTimings.roads = performance.now() - layerStart;

    // 7b. Street names (rendered on top of roads)
    layerStart = performance.now();
    this.renderStreetNames(layers.surface_roads, adjustedBounds);
    layerTimings.streetNames = performance.now() - layerStart;

    // 8. Surface railways
    layerStart = performance.now();
    this.renderLayer(layers.surface_railways, adjustedBounds, false);
    layerTimings.railways = performance.now() - layerStart;

    // 8b. Bridge roads and railways — rendered on top of surface, sorted by ascending layer value
    layerStart = performance.now();
    this.renderBridges(
      layers.bridge_roads,
      layers.bridge_railways,
      adjustedBounds,
    );
    layerTimings.bridges = performance.now() - layerStart;

    // 8c. Street names on bridges
    if (layers.bridge_roads.length > 0) {
      this.renderStreetNames(layers.bridge_roads, adjustedBounds);
    }

    // 9. Country boundaries
    layerStart = performance.now();
    this.renderLayer(layers.boundaries, adjustedBounds, false);
    layerTimings.boundaries = performance.now() - layerStart;

    // 9b. Coastline with direction arrows (for debugging/visualization)
    layerStart = performance.now();
    this.renderCoastlineWithArrows(layers.coastline, adjustedBounds);
    layerTimings.coastline = performance.now() - layerStart;

    // 9c. Aeroway lines (runways, taxiways — on top of roads but under labels/POIs)
    layerStart = performance.now();
    this.renderAeroways(layers.aeroways, adjustedBounds, "lines");
    layerTimings.aerowayLines = performance.now() - layerStart;

    // 10. Points (always on top)
    layerStart = performance.now();
    this.renderLayer(layers.points, adjustedBounds, false);
    layerTimings.points = performance.now() - layerStart;

    // 10b. Water labels (lake/pond/canal/river names)
    layerStart = performance.now();
    this.renderWaterLabels(layers.water_labels, adjustedBounds);
    layerTimings.waterLabels = performance.now() - layerStart;

    // 10c. Place labels (city/town/village names on top of everything except highlights)
    layerStart = performance.now();
    this.renderPlaceLabels(layers.place_labels, adjustedBounds);
    layerTimings.placeLabels = performance.now() - layerStart;

    // 10d. Building labels (house numbers, only at very high zoom)
    layerStart = performance.now();
    this.renderBuildingLabels(
      layers.building_labels,
      adjustedBounds,
      layers.surface_roads,
    );
    layerTimings.buildingLabels = performance.now() - layerStart;

    // 11. Highlight hovered or selected feature on top of everything
    layerStart = performance.now();
    if (this.selectedFeature) {
      this.highlightFeature(this.selectedFeature, adjustedBounds, "selected");
    } else if (this.hoveredFeature) {
      this.highlightFeature(this.hoveredFeature, adjustedBounds, "hovered");
    }
    layerTimings.highlight = performance.now() - layerStart;

    perfTimings.totalRender = performance.now() - renderStart;

    featureCount = Object.values(layers).reduce(
      (sum, layer) => sum + layer.length,
      0,
    );

    const endTime = performance.now();
    const renderTime = (endTime - startTime).toFixed(2);

    // Comprehensive performance instrumentation
    const ms = this._lastMergeStats || {};
    const fetchStats = this._tileFetchStats || [];
    this._tileFetchStats = []; // reset for next frame

    // Count cache hits vs network fetches
    const networkFetches = fetchStats.length;
    const cacheHits = visibleTiles.length - networkFetches;
    const totalFetchTime = fetchStats.reduce((s, t) => s + t.fetchTime, 0);
    const totalParseTime = fetchStats.reduce((s, t) => s + t.parseTime, 0);

    // Build layer size + timing table
    const layerRows = Object.entries(layerTimings)
      .map(([name, time]) => ({
        name,
        time,
        count: layers[name]?.length || 0,
      }))
      .filter((r) => r.count > 0 || r.time > 1);

    // Output structured performance report
    console.group(
      `[PERF] Frame ${renderTime}ms | ${featureCount} features | ${viewKm}`,
    );

    // Phase 1: Tile identification & loading
    console.group(`1. Tiles — ${perfTimings.tileLoad.toFixed(1)}ms`);
    console.log(
      `Tileset: ${visibleTiles[0]?.tileset || "?"} | ${visibleTiles.length} tiles (${cacheHits} cached, ${networkFetches} fetched)`,
    );
    if (networkFetches > 0) {
      console.log(
        `Network fetch: ${totalFetchTime.toFixed(1)}ms | JSON parse: ${totalParseTime.toFixed(1)}ms`,
      );
      for (const s of fetchStats) {
        console.log(
          `  ${s.key}: fetch ${s.fetchTime.toFixed(1)}ms, parse ${s.parseTime.toFixed(1)}ms, ${s.features} features`,
        );
      }
    }
    console.groupEnd();

    // Phase 2: Merge & dedup
    const mergeTotal = ms.mergeTime || 0;
    console.group(`2. Merge & dedup — ${mergeTotal.toFixed(1)}ms`);
    console.log(
      `${ms.totalLoaded || 0} raw → ${ms.features || 0} unique (${ms.duplicatesRemoved || 0} dupes, ${ms.lodFiltered || 0} LOD filtered)`,
    );
    console.log(
      `Dedup + merge: ${(mergeTotal - (ms.bboxTime || 0)).toFixed(1)}ms | Bbox compute: ${(ms.bboxTime || 0).toFixed(1)}ms`,
    );
    console.groupEnd();

    // Phase 3: Classification
    console.group(`3. Classify — ${perfTimings.classify.toFixed(1)}ms`);
    console.log(
      `${featureCount} classified, ${culledCount} viewport culled, ${lodCulledCount} LOD culled`,
    );
    console.groupEnd();

    // Phase 4: Rendering layers
    console.group(`4. Render layers — ${perfTimings.totalRender.toFixed(1)}ms`);
    const sortedLayers = layerRows.sort((a, b) => b.time - a.time);
    for (const { name, time, count } of sortedLayers) {
      const bar = "█".repeat(Math.max(1, Math.round(time / 2)));
      console.log(
        `${name.padEnd(18)} ${String(count).padStart(5)} features  ${time.toFixed(1).padStart(7)}ms  ${bar}`,
      );
    }
    console.groupEnd();

    console.groupEnd();

    document.getElementById("featureCount").textContent = featureCount;
    document.getElementById("renderTime").textContent = renderTime;
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Rendered";

    // Save rendered frame for canvas translation optimization
    this.saveOffscreenCanvas();
    this._lastRenderOffset = { x: this.offsetX, y: this.offsetY };

    // Draw tile edges if enabled (after save so they're always on top)
    if (this.showTileEdges) {
      this.drawTileEdges(adjustedBounds);
    }

    // Render stats available in UI
  }

  // Save current canvas to offscreen buffer for panning optimization
  saveOffscreenCanvas() {
    if (!this._offscreenCanvas) {
      this._offscreenCanvas = document.createElement("canvas");
    }
    this._offscreenCanvas.width = this.canvas.width;
    this._offscreenCanvas.height = this.canvas.height;
    const offCtx = this._offscreenCanvas.getContext("2d");
    offCtx.drawImage(this.canvas, 0, 0);
  }

  // Instantly translate canvas during drag (smooth panning)
  translateCanvas(dx, dy) {
    if (!this._offscreenCanvas) return;

    // Calculate total offset since last full render
    const totalDx = this.offsetX - this._lastRenderOffset.x;
    const totalDy = this.offsetY - this._lastRenderOffset.y;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw saved frame translated by total accumulated offset
    this.ctx.drawImage(this._offscreenCanvas, totalDx, totalDy);
  }

  getLOD() {
    // Return LOD level based on view width
    // 0: Very zoomed out (show only major features) - >20km
    // 1: Medium zoom (show major + secondary features) - 7.5-20km
    // 2: Zoomed in (show most features) - 3-7.5km
    // 3: More zoomed in (show buildings, more roads) - 1-3km
    // 4: Very zoomed in (show all details including POIs) - <1km
    if (this.viewWidthMeters > 20000) return 0;
    if (this.viewWidthMeters > 7500) return 1;
    if (this.viewWidthMeters > 3000) return 2;
    if (this.viewWidthMeters > 1000) return 3;
    return 4;
  }

  classifyPOI(props) {
    const amenity = props.amenity;
    const shop = props.shop;
    const tourism = props.tourism;
    const historic = props.historic;

    // Check amenity tags first (highest priority)
    if (amenity) {
      for (const catId of POI_AMENITY_PRIORITY) {
        const catDef = POI_CATEGORIES[catId];
        if (catDef.amenity && catDef.amenity.has(amenity)) return catId;
      }
      // Also check shopping's amenity set
      if (POI_CATEGORIES.shopping.amenity.has(amenity)) return "shopping";
    }
    // Check shop tags
    if (shop) {
      for (const [catId, catDef] of Object.entries(POI_CATEGORIES)) {
        if (catDef.shop && catDef.shop.has(shop)) return catId;
      }
      return "shopping"; // fallback for unrecognized shops
    }
    // Check tourism tags
    if (tourism) {
      if (POI_CATEGORIES.tourism.tourism.has(tourism)) return "tourism";
      return "tourism"; // fallback
    }
    // Check historic tags
    if (historic) {
      if (POI_CATEGORIES.historic.historic.has(historic)) return "historic";
      return "historic"; // fallback
    }
    // Unmatched amenity -> services
    if (amenity) return "services";
    return null;
  }

  parseMeters(value) {
    if (value) {
      let valueMeters = parseFloat(value);
      if (!isNaN(valueMeters)) {
        // Check for unit suffixes and convert to meters
        const valueStr = value.toString().trim().toLowerCase();
        if (valueStr.includes("cm") || valueStr.includes("centimeter")) {
          valueMeters = valueMeters / 100; // Convert cm to m
        } else if (valueStr.includes("mm") || valueStr.includes("millimeter")) {
          valueMeters = valueMeters / 1000; // Convert mm to m
        } else if (valueStr.includes("km") || valueStr.includes("kilometer")) {
          valueMeters = valueMeters * 1000; // Convert km to m
        } else if (
          valueStr.includes("ft") ||
          valueStr.includes("feet") ||
          valueStr.includes("'")
        ) {
          valueMeters = valueMeters * 0.3048; // Convert feet to m
        }
        // else assume meters (or already parsed as meters)

        return valueMeters;
      }
    }
    return null;
  }

  classifyFeature(props, type) {
    // Classify feature and determine: color, layer, minLOD (minimum zoom to show), fill
    // minLOD: 0=always show, 1=medium zoom, 2=high zoom, 3=very high zoom

    // Detect vertical position (tunnel/bridge/surface)
    const isTunnel =
      props.tunnel === "yes" ||
      props.tunnel === "true" ||
      (props.layer && parseInt(props.layer) < 0);
    const isBridge =
      props.bridge === "yes" ||
      props.bridge === "true" ||
      (props.layer && parseInt(props.layer) > 0 && !isTunnel);

    // Detect islands - landusage or forrestes to be drawn on top of water
    const isIsland = props.place === "islet" || props.place === "island";

    // === FILLED AREAS (polygons) ===

    // Water areas (filled polygons)
    // Note: coastline is handled separately as a LineString with direction arrows
    if (
      props.natural === "water" ||
      props.water ||
      props.waterway === "riverbank" ||
      props.landuse === "basin" ||
      props.landuse === "reservoir"
    ) {
      const result = {
        layer: "water_areas",
        color: getColor("water", "area"),
        minLOD: 0,
        fill: true,
      };

      // If water body has a name, also add to water_labels layer
      if (props.name && type === "Polygon") {
        result.waterLabel = {
          name: props.name,
          waterType: props.water || props.natural || "water",
        };
      }

      return result;
    }

    // Beach (sandy areas)
    if (props.natural === "beach") {
      return {
        layer: "natural_background",
        color: getColor("natural", "beach"),
        minLOD: 1,
        fill: true,
        pattern: "beach",
      };
    }

    // Scrubland (bushy vegetation)
    if (props.natural === "scrub" || props.natural === "heath") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("natural", "scrub"),
        minLOD: 1,
        fill: true,
        pattern: "scrub", // Draw scrub pattern
      };
    }

    // Wetlands (marshes, swamps, bogs)
    if (props.natural === "wetland") {
      const wetlandType = props.wetland; // marsh, swamp, bog, etc.
      return {
        layer: "natural_background",
        color: getColor("natural", "wetland"),
        minLOD: 1,
        fill: true,
        pattern: "wetland", // Draw wetland pattern
      };
    }

    // Forests (managed woodland)
    if (props.landuse === "forest" || props.natural === "wood") {
      // Check for forest type (leaf_type tag)
      const leafType = props.leaf_type;
      let pattern = null;

      if (leafType === "broadleaved") {
        pattern = null; // TODO: "broadleaf_forest" — pattern needs redesign
      } else if (leafType === "needleleaved") {
        pattern = null; // TODO: "needleleaf_forest" — pattern needs redesign
      } else if (leafType === "mixed") {
        pattern = null; // TODO: "mixed_forest" — pattern needs redesign
      }
      // If no leaf_type tag, use default (no pattern, solid color)

      return {
        layer: isIsland ? "islands" : "forests",
        color: getColor("natural", "forest"),
        minLOD: 0,
        fill: true,
        pattern: pattern,
      };
    }

    // Parks (leisure areas with facilities)
    if (props.leisure === "park") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("natural", "park"),
        minLOD: 1,
        fill: true,
      };
    }

    // Grass areas (mowed/maintained grass)
    if (props.landuse === "grass") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("natural", "grass"),
        minLOD: 1,
        fill: true,
      };
    }

    // Village greens (community grass areas)
    if (props.landuse === "village_green") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("natural", "park"),
        minLOD: 1,
        fill: true,
      };
    }

    // Meadows (natural grassland)
    if (props.landuse === "meadow") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("natural", "meadow"),
        minLOD: 1,
        fill: true,
      };
    }

    // Farmland (crop fields)
    if (props.landuse === "farmland") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("agriculture", "farmland"),
        minLOD: 1,
        fill: true,
      };
    }

    // Orchards (fruit trees)
    if (props.landuse === "orchard") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("agriculture", "orchard"),
        minLOD: 1,
        fill: true,
      };
    }

    // Vineyards (grape cultivation)
    if (props.landuse === "vineyard") {
      return {
        layer: isIsland ? "islands" : "natural_background",
        color: getColor("agriculture", "vineyard"),
        minLOD: 1,
        fill: true,
      };
    }

    // Flowerbeds (decorative planting)
    if (props.landuse === "flowerbed") {
      return {
        layer: "natural_background",
        color: getColor("agriculture", "flowerbed"),
        minLOD: 2,
        fill: true,
      };
    }

    // Landuse areas - residential
    if (props.landuse === "residential") {
      return {
        layer: "landuse_areas",
        color: getColor("landuse", "residential"),
        minLOD: 1,
        fill: true,
      };
    }

    // Landuse areas - commercial/retail
    if (props.landuse === "commercial" || props.landuse === "retail") {
      return {
        layer: "landuse_areas",
        color: getColor(
          "landuse",
          props.landuse === "retail" ? "retail" : "commercial",
        ),
        minLOD: 1,
        fill: true,
      };
    }

    // Landuse areas - industrial
    if (props.landuse === "industrial") {
      return {
        layer: "landuse_areas",
        color: getColor("landuse", "industrial"),
        minLOD: 1,
        fill: true,
      };
    }

    // Landuse areas - cemetery (subtle green-gray)
    if (props.landuse === "cemetery") {
      return {
        layer: "landuse_areas",
        color: getColor("specialPurpose", "cemetery"),
        minLOD: 1,
        fill: true,
      };
    }

    // Landuse areas - allotments (lighter green than parks)
    if (props.landuse === "allotments") {
      return {
        layer: "landuse_areas",
        color: getColor("agriculture", "allotments"),
        minLOD: 2,
        fill: true,
      };
    }

    // Landuse areas - railway yards
    if (props.landuse === "railway") {
      return {
        layer: "landuse_areas",
        color: getColor("specialPurpose", "railway"),
        minLOD: 1,
        fill: true,
      };
    }

    // Landuse areas - construction/brownfield/greenfield
    if (
      props.landuse === "construction" ||
      props.landuse === "brownfield" ||
      props.landuse === "greenfield"
    ) {
      return {
        layer: "landuse_areas",
        color: getColor("landuse", "construction"),
        minLOD: 2,
        fill: true,
      };
    }

    // Landuse areas - military
    if (props.landuse === "military") {
      return {
        layer: "landuse_areas",
        color: getColor("landuse", "military"),
        minLOD: 1,
        fill: true,
      };
    }

    // Landuse areas - education
    if (props.landuse === "education") {
      return {
        layer: "landuse_areas",
        color: getColor("specialPurpose", "education"),
        minLOD: 2,
        fill: true,
      };
    }

    // Landuse areas - religious
    if (props.landuse === "religious") {
      return {
        layer: "landuse_areas",
        color: getColor("specialPurpose", "religious"),
        minLOD: 2,
        fill: true,
      };
    }

    // Landuse areas - institutional (government, universities, hospitals)
    if (props.landuse === "institutional") {
      return {
        layer: "landuse_areas",
        color: getColor("landuse", "institutional"),
        minLOD: 1,
        fill: true,
      };
    }

    // Landuse areas - quarry
    if (props.landuse === "quarry") {
      return {
        layer: "landuse_areas",
        color: getColor("specialPurpose", "quarry"),
        minLOD: 2,
        fill: true,
      };
    }

    // Landfill — rendered early (natural_background) so forests on top aren't covered
    if (props.landuse === "landfill") {
      return {
        layer: "natural_background",
        color: getColor("specialPurpose", "quarry"),
        minLOD: 2,
        fill: true,
      };
    }

    // Landuse areas - port (harbor/dock areas)
    if (props.landuse === "port") {
      return {
        layer: "landuse_areas",
        color: getColor("landuse", "port"),
        minLOD: 1,
        fill: true,
      };
    }

    // Highway areas - rest area and services (polygon features)
    if (props.highway === "rest_area" || props.highway === "services") {
      return {
        layer: "landuse_areas",
        color: getColor("specialPurpose", "services"),
        minLOD: 1,
        fill: true,
      };
    }

    // Playgrounds (with colorful pattern)
    if (props.leisure === "playground") {
      return {
        layer: "landuse_areas",
        color: getColor("recreation", "playground"),
        minLOD: 1,
        fill: true,
        pattern: "playground",
      };
    }

    // Beach volleyball courts
    if (props.leisure === "pitch" && props.sport === "beachvolleyball") {
      return {
        layer: "landuse_areas",
        color: getColor("recreation", "beachVolleyball"),
        minLOD: 2,
        fill: true,
        pattern: "beach_volleyball",
      };
    }

    // Table tennis is handled as a Point marker, not a polygon

    // Swimming pools and public baths
    if (props.leisure === "swimming_pool" || props.amenity === "public_bath") {
      return {
        layer: "landuse_areas",
        color: getColor("recreation", "swimmingPool"),
        minLOD: 2,
        fill: true,
        pattern: "swimming_pool",
      };
    }

    // Picnic sites and shelters
    if (
      props.tourism === "picnic_site" ||
      props.amenity === "picnic_table" ||
      props.amenity === "shelter"
    ) {
      if (props.amenity == "shelter") {
        console.log("Shelter", props);
      }
      return {
        layer: "landuse_areas",
        color: getColor("recreation", "picnicSite"),
        minLOD: 2,
        fill: true,
        pattern: "picnic_site",
      };
    }

    // Leisure areas - recreation grounds, gardens, sports (without specific patterns)
    if (
      props.landuse === "recreation_ground" ||
      props.leisure === "garden" ||
      props.leisure === "pitch" ||
      props.leisure === "sports_centre"
    ) {
      return {
        layer: "landuse_areas",
        color: getColor("specialPurpose", "recreation"),
        minLOD: 1,
        fill: true,
      };
    }

    // Aeroways — runways, taxiways, aprons, helipads
    if (props.aeroway) {
      const aeroway = props.aeroway;
      const isLine = type === "LineString" || type === "MultiLineString";
      const isPoly = type === "Polygon" || type === "MultiPolygon";

      const mpp = this.viewWidthMeters / this.canvasWidth;

      if (aeroway === "runway" && isLine) {
        // Width from OSM data (meters), default 45m for major runways
        const widthM = this.parseMeters(props.width) || 45;
        const widthPx = Math.max(4, widthM / mpp);
        return {
          layer: "aeroways",
          color: { r: 80, g: 80, b: 80, a: 255 },
          minLOD: 0,
          width: widthPx,
          fill: false,
          isRunway: true,
          runwayRef: props.ref,
          runwayLit: props.lit === "yes",
          runwayLength: this.parseMeters(props.length),
        };
      }
      if (aeroway === "taxiway" && isLine) {
        const widthM = this.parseMeters(props.width) || 15;
        const widthPx = Math.max(2, widthM / mpp);
        return {
          layer: "aeroways",
          color: { r: 120, g: 120, b: 120, a: 255 },
          minLOD: 2,
          width: widthPx,
          fill: false,
        };
      }
      if (aeroway === "apron") {
        return {
          layer: "aeroways",
          color: { r: 160, g: 160, b: 160, a: 255 },
          minLOD: 2,
          fill: isPoly,
          width: isPoly ? undefined : 3,
        };
      }
      if (aeroway === "helipad") {
        return {
          layer: "aeroways",
          color: { r: 100, g: 100, b: 100, a: 255 },
          minLOD: 3,
          fill: isPoly,
          isHelipad: true,
        };
      }
    }

    // Buildings - color by type
    if (props.building) {
      let buildingColor;
      const buildingType = props.building;

      // Commercial/retail buildings - reddish
      if (
        buildingType === "commercial" ||
        buildingType === "retail" ||
        buildingType === "supermarket"
      ) {
        buildingColor = getColor("buildings", "commercial");
      }
      // Industrial buildings - purple-gray
      else if (buildingType === "industrial" || buildingType === "warehouse") {
        buildingColor = getColor("buildings", "industrial");
      }
      // Public/civic buildings - blue-gray
      else if (
        buildingType === "public" ||
        buildingType === "civic" ||
        buildingType === "government"
      ) {
        buildingColor = getColor("buildings", "public");
      }
      // Religious buildings - darker tan
      else if (
        buildingType === "church" ||
        buildingType === "cathedral" ||
        buildingType === "mosque" ||
        buildingType === "temple" ||
        buildingType === "synagogue"
      ) {
        buildingColor = getColor("buildings", "religious");
      }
      // Schools/universities - yellow-tan
      else if (
        buildingType === "school" ||
        buildingType === "university" ||
        buildingType === "college" ||
        buildingType === "kindergarten"
      ) {
        buildingColor = getColor("buildings", "education");
      }
      // Residential buildings - default beige
      else {
        buildingColor = getColor("buildings", "default");
      }

      const result = {
        layer: "buildings",
        color: buildingColor,
        minLOD: 2,
        fill: true,
        stroke: true,
        strokeColor: getColor("buildings", "border"),
        strokeWidth: 1.0,
      };

      // Add house number label if available (addr:housenumber)
      if (props["addr:housenumber"]) {
        result.houseNumber = {
          number: props["addr:housenumber"],
          street: props["addr:street"],
        };
      }

      return result;
    }

    // === LINEAR FEATURES (lines) ===

    // Coastline (for visualization and debugging)
    if (
      props.natural === "coastline" &&
      type !== "Polygon" &&
      type !== "MultiPolygon"
    ) {
      return {
        layer: "coastline",
        color: getColor("boundaries", "coastline"),
        minLOD: 0,
        fill: false,
        width: 3,
        showDirection: true, // Draw direction arrows
      };
    }

    // Waterways (rivers, streams, ditches as lines)
    if (props.waterway && props.waterway !== "riverbank") {
      // Classify by waterway type for importance and width
      const waterwayType = props.waterway;
      let importance, minWidth, borderWidth;

      // Major waterways (always visible)
      if (waterwayType === "river" || waterwayType === "canal") {
        importance = 0; // Show at all zoom levels
        minWidth = 3; // Rivers are wider
        borderWidth = 0; // No border for wide rivers
      }
      // Medium waterways
      else if (waterwayType === "stream") {
        importance = 1; // Show at medium zoom
        minWidth = 2; // Smaller than rivers
        borderWidth = 0.5; // Slight border for definition
      }
      // Small waterways (ditches, drains)
      else if (waterwayType === "ditch" || waterwayType === "drain") {
        importance = 2; // Only when zoomed in
        minWidth = 1.5; // Very narrow
        borderWidth = 0.5; // Border to make them visible
      }
      // Other waterways (default)
      else {
        importance = 1;
        minWidth = 2;
        borderWidth = 0.5;
      }

      let waterColor = getColor("water", "line");
      let waterBorder = getColor("water", "border");
      if (isTunnel) {
        waterColor = { ...waterColor, a: TUNNEL_WATER_ALPHA };
        waterBorder = { ...waterBorder, a: TUNNEL_WATER_ALPHA };
      }

      const result = {
        layer: isTunnel ? "tunnel_waterways" : "waterways",
        color: waterColor,
        minLOD: importance,
        fill: false,
        width: minWidth,
        borderWidth: borderWidth,
        borderColor: waterBorder,
      };

      // If waterway has a name, add label info
      if (props.name) {
        result.waterLabel = {
          name: props.name,
          waterType: props.waterway,
        };
      }

      return result;
    }

    // Roads - determine layer based on tunnel/bridge/surface
    if (props.highway) {
      // Skip point-like highway features (street lamps, traffic signals, crossings, etc.)
      const skipTypes = [
        "street_lamp",
        "traffic_signals",
        "crossing",
        "stop",
        "give_way",
        "speed_camera",
        "turning_circle",
        "mini_roundabout",
        "motorway_junction",
        "bus_stop",
      ];
      // TODO: find a good way to draw bus_stops (maybe introduce a toggle)
      if (skipTypes.includes(props.highway)) {
        return { layer: null, minLOD: 999, fill: false };
      }

      // Also skip if it's a Point geometry - highways should be LineStrings
      if (type === "Point") {
        return { layer: null, minLOD: 999, fill: false };
      }

      // Remap construction/planned roads to their target type
      let isConstruction = false;
      let effectiveHighway = props.highway;
      if (props.highway === "construction" && props.construction) {
        effectiveHighway = props.construction;
        isConstruction = true;
      } else if (props.highway === "planned" && props.planned) {
        effectiveHighway = props.planned;
        isConstruction = true;
      } else if (props.highway === "proposed" && props.proposed) {
        effectiveHighway = props.proposed;
        isConstruction = true;
      }

      // Determine color and base width based on road type
      // Real lane widths: ~3.5m per lane
      // Motorway: 2-4 lanes = 7-14m
      // Primary: 2 lanes = 7m
      // Tertiary/residential: 1-2 lanes = 3.5-7m
      // Service: 1 lane = 3.5m

      let color;
      let minLOD;
      let realWidthMeters = this.parseMeters(props.width); // Real-world width in meters

      let roadPriority; // Lower = drawn first (underneath), higher = drawn on top
      let lanes = props.lanes;
      let laneWidth;

      if (
        effectiveHighway === "motorway" ||
        effectiveHighway === "trunk" ||
        effectiveHighway === "motorway_link" ||
        effectiveHighway === "trunk_link"
      ) {
        // was: 14m, 4 lanes
        color = getColor("roads", "motorway");
        laneWidth = 3.5;
        lanes = lanes || 4;
        minLOD = 0;
        roadPriority = 7;
      } else if (
        effectiveHighway === "primary" ||
        effectiveHighway === "primary_link"
      ) {
        // was: 7m, 2 lanes
        color = getColor("roads", "primary");
        laneWidth = 3.5;
        lanes = lanes || 2;
        minLOD = 0; // Show at all zoom levels (including 25km)
        roadPriority = 6;
      } else if (
        effectiveHighway === "secondary" ||
        effectiveHighway === "secondary_link"
      ) {
        // was: 7m, 2 lanes
        color = getColor("roads", "secondary");
        laneWidth = 3.5;
        lanes = lanes || 2;
        minLOD = 1;
        roadPriority = 5;
      } else if (
        effectiveHighway === "tertiary" ||
        effectiveHighway === "ternary_link"
      ) {
        // was: 6m, 2 lanes
        color = getColor("roads", "tertiary");
        laneWidth = 3;
        lanes = lanes || 2;
        minLOD = 1;
        roadPriority = 4;
      } else if (
        effectiveHighway === "residential" ||
        effectiveHighway === "unclassified"
      ) {
        // was: 5m, 1-2 lanes
        color = getColor("roads", "residential");
        laneWidth = 3;
        lanes = lanes || 1.666; // 1-2?
        minLOD = 2;
        roadPriority = 3;
      } else if (effectiveHighway === "living_street") {
        // Residential street where pedestrians have priority
        color = getColor("roads", "residential");
        laneWidth = 3;
        lanes = lanes || 1.5;
        minLOD = 2;
        roadPriority = 3;
      } else if (
        effectiveHighway === "service" ||
        effectiveHighway === "track"
      ) {
        // was: 3.5m, 1 lane
        color = getColor("roads", "service");
        laneWidth = 2.8;
        lanes = lanes || 1.1;
        minLOD = 2;
        roadPriority = 2;
      } else if (effectiveHighway === "busway") {
        // Dedicated bus rapid transit lanes
        color = getColor("roads", "service");
        laneWidth = 3;
        lanes = lanes || 1;
        minLOD = 2;
        roadPriority = 2;
      } else if (
        effectiveHighway === "footway" ||
        effectiveHighway === "path" ||
        effectiveHighway === "pedestrian" ||
        effectiveHighway === "steps" ||
        effectiveHighway === "corridor"
      ) {
        color = getColor("roads", "footway");
        laneWidth = 2;
        // Steps/corridors: ignore OSM width/lanes when zoomed out (>500m) to avoid oversized rendering
        if (
          (effectiveHighway === "steps" || effectiveHighway === "corridor") &&
          this.viewWidthMeters > 500
        ) {
          realWidthMeters = null;
          lanes = 1;
        } else {
          lanes = lanes || 1;
        }
        minLOD = 2;
        roadPriority = 0;
      } else if (effectiveHighway === "cycleway") {
        // was: 2m
        color = getColor("roads", "cycleway");
        laneWidth = 2;
        lanes = lanes || 1;
        minLOD = 2;
        roadPriority = 1;
      } else if (effectiveHighway === "bridleway") {
        // Horse riding paths
        color = getColor("roads", "footway");
        laneWidth = 2.5;
        lanes = lanes || 1;
        minLOD = 2;
        roadPriority = 0;
      } else if (effectiveHighway === "raceway") {
        // Motor racing tracks
        color = getColor("roads", "service");
        laneWidth = 8;
        lanes = lanes || 2;
        minLOD = 2;
        roadPriority = 2;
      } else {
        console.log("Unknown highway", props);
        // Unknown highway type - skip it to avoid rendering unexpected features
        return { layer: null, minLOD: 999, fill: false };
      }

      //if (realWidthMeters) {
      //  console.log(
      //    "Real Meters",
      //    realWidthMeters,
      //    "Lanes X Width",
      //    lanes * laneWidth,
      //    props,
      //  );
      //}
      realWidthMeters = realWidthMeters || lanes * laneWidth;

      // Calculate width based on view and real-world size
      // Width should scale: 1px minimum, real width when zoomed in enough
      const metersPerPixel = this.viewWidthMeters / this.canvasWidth;
      const calculatedWidth = realWidthMeters / metersPerPixel;
      // TODO: allow higher max width in more zoomed in views.
      let width = Math.max(1, Math.min(10, calculatedWidth)); // Clamp between 1-10px

      // Assign to appropriate layer based on vertical position
      if (isTunnel) {
        return {
          layer: "tunnels",
          color,
          minLOD,
          width,
          fill: false,
          roadPriority,
          isConstruction,
        };
      } else {
        // Check for bicycle_road marking
        const isBicycleRoad =
          props.bicycle_road === "yes" || props.cyclestreet === "yes";

        const result = {
          layer: isBridge ? "bridge_roads" : "surface_roads",
          color,
          minLOD,
          width,
          fill: false,
          roadPriority,
          isConstruction,
          isBicycleRoad,
        };
        if (isBridge) {
          result.bridgeLayer = parseInt(props.layer) || 1;
        }
        return result;
      }
    }

    // Railways - determine layer based on tunnel/bridge/surface
    if (props.railway && type !== "Point") {
      const trackTypes = [
        "rail",
        "light_rail",
        "subway",
        "tram",
        "monorail",
        "narrow_gauge",
        "preserved",
        "construction",
        "planned",
        "proposed",
      ];

      // Remap construction/planned/proposed railways to their target type
      let effectiveRailway = props.railway;
      let isPlannedRailway = false;
      if (effectiveRailway === "construction" && props.construction) {
        effectiveRailway = props.construction;
        isPlannedRailway = true;
      } else if (effectiveRailway === "planned" && props.planned) {
        effectiveRailway = props.planned;
        isPlannedRailway = true;
      } else if (effectiveRailway === "proposed" && props.proposed) {
        effectiveRailway = props.proposed;
        isPlannedRailway = true;
      } else if (
        effectiveRailway === "construction" ||
        effectiveRailway === "planned" ||
        effectiveRailway === "proposed"
      ) {
        // No target type specified — treat as generic rail
        effectiveRailway = "rail";
        isPlannedRailway = true;
      }

      if (trackTypes.includes(props.railway) || !props.railway) {
        // Regular rail color with red tint for planned/construction
        let color = isPlannedRailway
          ? { r: 180, g: 120, b: 120, a: 255 }
          : getColor("railways", "rail");

        // Railway width based on type (controls spacing between rails and tie length)
        let width = 8; // Standard railway (~5-6m wide including tracks and bed)
        let minLOD = 0; // Long distance/regional rail: show at all zoom levels

        if (effectiveRailway === "tram") {
          width = 6; // Trams are narrower
          minLOD = 2; // Trams: only show at close zoom
        } else if (
          effectiveRailway === "light_rail" ||
          effectiveRailway === "subway"
        ) {
          width = 6; // Light rail/subway narrower than main rail
          minLOD = 1; // Subway/light rail: show at medium zoom
        } else if (effectiveRailway === "narrow_gauge") {
          width = 6; // Narrow gauge railways
          minLOD = 0; // Still long distance, just narrower track
        }

        if (isTunnel) {
          return {
            layer: "tunnels",
            color,
            minLOD,
            width,
            fill: false,
            isRailway: true,
          };
        } else {
          const result = {
            layer: isBridge ? "bridge_railways" : "surface_railways",
            color,
            minLOD,
            width,
            fill: false,
            isRailway: true,
          };
          if (isBridge) {
            result.bridgeLayer = parseInt(props.layer) || 1;
          }
          return result;
        }
      }
    }

    // Railway platforms (polygon or line)
    if (props.railway === "platform" || props.public_transport === "platform") {
      if (type === "Polygon" || type === "MultiPolygon") {
        return {
          layer: "surface_railways",
          color: { r: 160, g: 160, b: 160, a: 255 },
          minLOD: 2,
          fill: true,
          stroke: true,
          strokeColor: { r: 120, g: 120, b: 120, a: 255 },
          strokeWidth: 1,
          isPlatform: true,
        };
      } else if (type === "LineString" || type === "MultiLineString") {
        return {
          layer: "surface_railways",
          color: { r: 140, g: 140, b: 140, a: 255 },
          minLOD: 2,
          width: 3,
          fill: false,
          isPlatform: true,
        };
      }
    }

    // Railway stations and halts
    if (
      props.railway === "station" ||
      props.railway === "halt" ||
      props.public_transport === "station"
    ) {
      if (type === "Polygon" || type === "MultiPolygon") {
        return {
          layer: "buildings",
          color: { r: 180, g: 170, b: 160, a: 255 },
          minLOD: 1,
          fill: true,
          stroke: true,
          strokeColor: { r: 120, g: 110, b: 100, a: 255 },
          strokeWidth: 1,
        };
      } else if (type === "Point" && props.name) {
        // Station points rendered as place labels
        return {
          layer: "place_labels",
          color: { r: 80, g: 80, b: 80, a: 255 },
          minLOD: 1,
          fill: false,
          placeType: "station",
          placePriority: 7,
          fontSize: 11,
        };
      }
    }

    // === POINTS ===

    if (type === "Point") {
      // Skip all highway-related points (street lamps, traffic signals, etc.)
      if (props.highway) {
        return { layer: null, minLOD: 999, fill: false };
      }

      // Place names (cities, towns, villages, suburbs, etc.)
      if (props.place && props.name) {
        const placeType = props.place;
        const population = props.population ? parseInt(props.population) : 0;

        // Classify place importance (matches preprocessing logic)
        let minLOD, placePriority, fontSize;

        if (placeType === "city") {
          minLOD = 0; // Always visible
          placePriority = 1;
          fontSize = 18;
        } else if (placeType === "town") {
          if (population >= 50000) {
            minLOD = 0;
            placePriority = 2;
          } else {
            minLOD = 1;
            placePriority = 3;
          }
          fontSize = 16;
        } else if (placeType === "village") {
          if (population >= 5000) {
            minLOD = 1;
            placePriority = 4;
          } else {
            minLOD = 2;
            placePriority = 5;
          }
          fontSize = 14;
        } else if (
          placeType === "suburb" ||
          placeType === "borough" ||
          placeType === "quarter"
        ) {
          minLOD = 2;
          placePriority = 6;
          fontSize = 13;
        } else if (placeType === "hamlet" || placeType === "neighbourhood") {
          minLOD = 3;
          placePriority = 7;
          fontSize = 12;
        } else if (
          placeType === "locality" ||
          placeType === "isolated_dwelling"
        ) {
          minLOD = 4;
          placePriority = 8;
          fontSize = 11;
        } else {
          console.log("Unhandled place type:", placeType, props);
          minLOD = 3;
          placePriority = 9;
          fontSize = 12;
        }

        return {
          layer: "place_labels",
          color: getColor("text", "places"),
          minLOD,
          fill: false,
          placeType,
          placePriority,
          fontSize,
          population,
        };
      }

      // Table tennis tables (leisure=pitch + sport=table_tennis, usually points)
      if (props.sport === "table_tennis" && props.leisure === "pitch") {
        const catDef = POI_CATEGORIES.recreation;
        return {
          layer: "points",
          color: {
            r: catDef.color.r,
            g: catDef.color.g,
            b: catDef.color.b,
            a: 255,
          },
          minLOD: 3,
          fill: false,
          poiCategory: "recreation",
        };
      }

      // Categorize named POIs
      if (
        props.name &&
        (props.amenity || props.shop || props.tourism || props.historic)
      ) {
        const poiCategory = this.classifyPOI(props);
        if (poiCategory) {
          const catDef = POI_CATEGORIES[poiCategory];
          return {
            layer: "points",
            color: {
              r: catDef.color.r,
              g: catDef.color.g,
              b: catDef.color.b,
              a: 255,
            },
            minLOD: 4,
            fill: false,
            poiCategory,
          };
        }
      }
      return { layer: null, minLOD: 999, fill: false }; // Skip other points
    }

    // === ADMINISTRATIVE BOUNDARIES ===
    if (props.boundary === "administrative" && props.admin_level) {
      // Maritime admin boundaries (territorial waters) — subtler style
      if (props.maritime === "yes") {
        return {
          layer: "boundaries",
          color: getColor("boundaries", "maritime"),
          minLOD: 0,
          fill: false,
          width: 1.5,
          dashPattern: [6, 6],
        };
      }
      const level = parseInt(props.admin_level);
      if (level === 2) {
        // Country borders — always visible, thick dashed line
        return {
          layer: "boundaries",
          color: getColor("boundaries", "country"),
          minLOD: 0,
          fill: false,
          width: 2.5,
          dashPattern: [8, 4],
        };
      } else if (level === 4) {
        // State borders (Bundesländer) — visible at medium zoom
        return {
          layer: "boundaries",
          color: getColor("boundaries", "state"),
          minLOD: 0,
          fill: false,
          width: 1.5,
          dashPattern: [6, 4],
        };
      } else if (level === 6) {
        // District borders (Kreise) — visible at closer zoom
        return {
          layer: "boundaries",
          color: getColor("boundaries", "district"),
          minLOD: 1,
          fill: false,
          width: 1,
          dashPattern: [4, 4],
        };
      }
    }

    // EEZ / maritime boundaries
    if (props.boundary === "maritime") {
      return {
        layer: "boundaries",
        color: getColor("boundaries", "eez"),
        minLOD: 0,
        fill: false,
        width: 1,
        dashPattern: [8, 8],
      };
    }

    // Default: skip
    return { layer: null, minLOD: 999, fill: false };
  }

  renderAeroways(layerFeatures, bounds, mode = "all") {
    // mode: "areas" = only polygons (aprons), "lines" = only lines (runways/taxiways), "all" = both
    if (!layerFeatures || layerFeatures.length === 0) return;

    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    // Separate polygon features (aprons) from line features (runways, taxiways)
    const polygons = [];
    const lines = [];
    for (const item of layerFeatures) {
      const t = item.type;
      if (t === "Polygon" || t === "MultiPolygon") {
        polygons.push(item);
      } else {
        lines.push(item);
      }
    }

    // 1. Render polygon features (aprons) as background
    if (mode === "lines") polygons.length = 0;
    if (mode === "areas") lines.length = 0;

    for (const item of polygons) {
      const geom = item.feature.geometry;
      const rings =
        geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
      const c = item.color;
      this.ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
      for (const poly of rings) {
        this.ctx.beginPath();
        const outer = poly[0];
        for (let i = 0; i < outer.length; i++) {
          const sx = toScreenX(outer[i][0]);
          const sy = toScreenY(outer[i][1]);
          if (i === 0) this.ctx.moveTo(sx, sy);
          else this.ctx.lineTo(sx, sy);
        }
        this.ctx.closePath();
        this.ctx.fill();
      }
    }

    // 2. Render line features — multi-pass for proper intersections
    // Pre-compute screen coordinates for all line features
    const taxiways = [];
    const runways = [];
    for (const item of lines) {
      const geom = item.feature.geometry;
      const coordArrays =
        geom.type === "LineString" ? [geom.coordinates] : geom.coordinates;
      const screenPaths = [];
      for (const coords of coordArrays) {
        const pts = [];
        for (let i = 0; i < coords.length; i++) {
          pts.push({ x: toScreenX(coords[i][0]), y: toScreenY(coords[i][1]) });
        }
        screenPaths.push(pts);
      }
      const entry = {
        item,
        screenPaths,
        w: item.width || (item.isRunway ? 4 : 2),
        c: item.color,
      };
      if (item.isRunway) runways.push(entry);
      else taxiways.push(entry);
    }

    const tracePath = (pts) => {
      this.ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) this.ctx.moveTo(pts[i].x, pts[i].y);
        else this.ctx.lineTo(pts[i].x, pts[i].y);
      }
    };

    // --- Taxiways: multi-pass (border, fill, centerline) ---
    // Pass 1: taxiway borders
    this.ctx.lineCap = "butt";
    this.ctx.lineJoin = "round";
    this.ctx.setLineDash([]);
    for (const { screenPaths, w, c } of taxiways) {
      if (w > 4) {
        this.ctx.strokeStyle = "rgba(255,255,255,0.4)";
        this.ctx.lineWidth = w;
        for (const pts of screenPaths) {
          tracePath(pts);
          this.ctx.stroke();
        }
      }
    }
    // Pass 2: taxiway fill
    for (const { screenPaths, w, c } of taxiways) {
      this.ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
      this.ctx.lineWidth = w > 4 ? w - 2 : w;
      for (const pts of screenPaths) {
        tracePath(pts);
        this.ctx.stroke();
      }
    }
    // Pass 3: taxiway centerline
    for (const { screenPaths, w } of taxiways) {
      if (w > 6) {
        const dashLen = Math.max(3, w * 0.4);
        this.ctx.strokeStyle = "rgba(255,255,200,0.5)";
        this.ctx.lineWidth = Math.max(1, w * 0.05);
        this.ctx.setLineDash([dashLen, dashLen]);
        for (const pts of screenPaths) {
          tracePath(pts);
          this.ctx.stroke();
        }
        this.ctx.setLineDash([]);
      }
    }

    // --- Runways: multi-pass (edge lines, surface, centerline, labels, lighting) ---
    // Pass 1: runway edge lines (white outline — drawn widest first)
    this.ctx.lineCap = "butt";
    this.ctx.lineJoin = "round";
    this.ctx.setLineDash([]);
    for (const { screenPaths, w } of runways) {
      if (w > 6) {
        this.ctx.strokeStyle = "rgba(255,255,255,0.6)";
        this.ctx.lineWidth = w;
        for (const pts of screenPaths) {
          tracePath(pts);
          this.ctx.stroke();
        }
      }
    }

    // Pass 2: runway surface fill (slightly narrower to leave edge lines visible)
    for (const { screenPaths, w, c } of runways) {
      this.ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${c.a / 255})`;
      this.ctx.lineWidth = w > 6 ? w - 3 : w;
      for (const pts of screenPaths) {
        tracePath(pts);
        this.ctx.stroke();
      }
    }

    // Pass 3: runway centerline dashes
    for (const { screenPaths, w } of runways) {
      const dashLen = Math.max(4, w * 0.6);
      this.ctx.strokeStyle = "rgba(255,255,255,0.8)";
      this.ctx.lineWidth = Math.max(1, w * 0.06);
      this.ctx.setLineDash([dashLen, dashLen]);
      for (const pts of screenPaths) {
        tracePath(pts);
        this.ctx.stroke();
      }
    }
    this.ctx.setLineDash([]);

    // Pass 4: runway designation labels
    for (const { item, screenPaths, w } of runways) {
      if (item.runwayRef && w > 10) {
        for (const pts of screenPaths) {
          const first = pts[0];
          const last = pts[pts.length - 1];
          const refs = item.runwayRef.split("/");
          const fontSize = Math.max(8, Math.min(14, w * 0.25));
          this.ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          this.ctx.fillStyle = "rgba(255,255,255,0.9)";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          const dx = last.x - first.x;
          const dy = last.y - first.y;
          const angle = Math.atan2(dy, dx);
          if (refs[0]) {
            this.ctx.save();
            this.ctx.translate(first.x + dx * 0.08, first.y + dy * 0.08);
            this.ctx.rotate(angle);
            this.ctx.fillText(refs[0], 0, 0);
            this.ctx.restore();
          }
          if (refs[1]) {
            this.ctx.save();
            this.ctx.translate(last.x - dx * 0.08, last.y - dy * 0.08);
            this.ctx.rotate(angle + Math.PI);
            this.ctx.fillText(refs[1], 0, 0);
            this.ctx.restore();
          }
        }
      }
    }

    // Pass 5: runway edge lighting
    for (const { item, screenPaths, w } of runways) {
      if (item.runwayLit && w > 8) {
        const spacing = Math.max(6, w * 0.5);
        this.ctx.fillStyle = "rgba(255, 255, 200, 0.7)";
        const halfW = w * 0.48;
        const dotR = Math.max(1, w * 0.04);
        for (const pts of screenPaths) {
          for (let i = 0; i < pts.length - 1; i++) {
            const segDx = pts[i + 1].x - pts[i].x;
            const segDy = pts[i + 1].y - pts[i].y;
            const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
            if (segLen < 1) continue;
            const nx = -segDy / segLen,
              ny = segDx / segLen;
            const steps = Math.floor(segLen / spacing);
            for (let s = 0; s <= steps; s++) {
              const t = s / Math.max(1, steps);
              const px = pts[i].x + segDx * t;
              const py = pts[i].y + segDy * t;
              this.ctx.beginPath();
              this.ctx.arc(
                px + nx * halfW,
                py + ny * halfW,
                dotR,
                0,
                Math.PI * 2,
              );
              this.ctx.fill();
              this.ctx.beginPath();
              this.ctx.arc(
                px - nx * halfW,
                py - ny * halfW,
                dotR,
                0,
                Math.PI * 2,
              );
              this.ctx.fill();
            }
          }
        }
      }
    }
  }

  renderBridges(bridgeRoads, bridgeRailways, bounds) {
    // Combine bridge roads and railways, then sort by ascending OSM layer value
    // so layer=1 bridges render first (bottom), layer=2+ on top
    const allBridges = [];
    for (const item of bridgeRoads) {
      allBridges.push({ ...item, _isBridgeRoad: true });
    }
    for (const item of bridgeRailways) {
      allBridges.push({ ...item, _isBridgeRailway: true });
    }
    if (allBridges.length === 0) return;

    // Group by bridge layer value
    const byLayer = new Map();
    for (const item of allBridges) {
      const lv = item.bridgeLayer || 1;
      if (!byLayer.has(lv)) byLayer.set(lv, { roads: [], railways: [] });
      const group = byLayer.get(lv);
      if (item._isBridgeRoad) group.roads.push(item);
      else group.railways.push(item);
    }

    // Render in ascending layer order
    const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
    for (const lv of sortedLayers) {
      const { roads, railways } = byLayer.get(lv);
      // Render roads for this layer level (with full multi-pass casing/fill, butt cap for bridge borders)
      if (roads.length > 0) {
        this.renderRoadLayer(roads, bounds, null, { bridgeMode: true });
      }
      // Render railways for this layer level
      if (railways.length > 0) {
        this.renderLayer(railways, bounds, false);
      }
    }
  }

  renderRoadLayer(
    layerFeatures,
    bounds,
    alphaOverride = null,
    { bridgeMode = false } = {},
  ) {
    const casingCap = bridgeMode ? "butt" : "round";

    // Apply alpha override for tunnels etc.
    const prevAlpha = this.ctx.globalAlpha;
    if (alphaOverride !== null) {
      this.ctx.globalAlpha = alphaOverride / 255;
    }

    // Separate railways from roads (construction roads stay with normal roads)
    const roads = [];
    const railways = [];
    for (const item of layerFeatures) {
      if (item.isRailway) {
        railways.push(item);
      } else {
        roads.push(item);
      }
    }

    // Render railways via the standard layer renderer
    if (railways.length > 0) {
      this.renderLayer(railways, bounds, false);
    }

    // Sort roads by priority: lower priority drawn first (underneath)
    const sorted = roads.sort(
      (a, b) => (a.roadPriority || 0) - (b.roadPriority || 0),
    );

    // Group features by priority level
    const byPriority = new Map();
    for (const item of sorted) {
      const p = item.roadPriority || 0;
      if (!byPriority.has(p)) byPriority.set(p, []);
      byPriority.get(p).push(item);
    }

    // Pre-compute bounds scaling
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    // Collect all road geometry first, organized by priority
    // Then do two-pass rendering: all casings, then all fills
    // This ensures higher-priority roads visually go "through" lower-priority ones at intersections
    const roadDataByPriority = new Map();

    for (const [priority, items] of byPriority) {
      // Collect flat screen coords for each feature in this priority group
      const featureCoords = [];
      for (const item of items) {
        const { feature, props, type, color, width } = item;
        const geom = feature.geometry;
        if (!geom || !geom.coordinates) continue;

        const coordArrays =
          type === "LineString"
            ? [geom.coordinates]
            : type === "MultiLineString"
              ? geom.coordinates
              : null;
        if (!coordArrays) continue;

        for (const coords of coordArrays) {
          if (coords.length < 2) continue;
          const flat = new Array(coords.length * 2);
          const screenCoords =
            this.hoverInfoEnabled || this.selectedFeature
              ? new Array(coords.length)
              : null;
          for (let i = 0; i < coords.length; i++) {
            const sx = toScreenX(coords[i][0]);
            const sy = toScreenY(coords[i][1]);
            flat[i * 2] = sx;
            flat[i * 2 + 1] = sy;
            if (screenCoords) screenCoords[i] = { x: sx, y: sy };
          }
          featureCoords.push({
            flat,
            color,
            width: width || 1,
            isConstruction: item.isConstruction,
            isBicycleRoad: item.isBicycleRoad,
          });
          if (screenCoords) {
            this.renderedFeatures.push({
              type: "LineString",
              screenCoords,
              properties: props,
              feature,
              geometry: geom,
            });
          }
        }
      }

      if (featureCoords.length === 0) continue;

      // Store this priority level's data for later rendering
      const roadFeatures = [];
      const constructionFlats = [];
      for (const fc of featureCoords) {
        if (fc.isConstruction) {
          constructionFlats.push(fc);
        } else {
          roadFeatures.push(fc);
        }
      }

      roadDataByPriority.set(priority, { roadFeatures, constructionFlats });
    }

    // RENDERING PASS 1: Draw all road casings (borders) in priority order
    for (const [priority, data] of roadDataByPriority) {
      const { roadFeatures, constructionFlats } = data;

      if (roadFeatures.length > 0) {
        // Pass 1: border stroke
        // Blend factor: 0 at width=1 (pure darkened color), 1 at width>=6 (pure black)
        const borderBatches = new Map();
        for (const fc of roadFeatures) {
          const t = Math.min(1, Math.max(0, (fc.width - 1) / 5));
          const r = Math.round(Math.max(0, fc.color.r - 40) * (1 - t));
          const g = Math.round(Math.max(0, fc.color.g - 40) * (1 - t));
          const b = Math.round(Math.max(0, fc.color.b - 40) * (1 - t));
          const a = (0.6 + 0.4 * t) * (fc.color.a / 255);
          const outlineWidth = fc.width + 2;
          const key = `${r},${g},${b},${a.toFixed(2)}|${outlineWidth}`;
          if (!borderBatches.has(key))
            borderBatches.set(key, {
              style: `rgba(${r},${g},${b},${a})`,
              width: outlineWidth,
              flats: [],
            });
          borderBatches.get(key).flats.push(fc.flat);
        }
        for (const [key, batch] of borderBatches) {
          this.ctx.strokeStyle = batch.style;
          this.ctx.lineWidth = batch.width;
          this.ctx.lineCap = casingCap;
          this.ctx.lineJoin = "round";
          this.ctx.beginPath();
          for (const flat of batch.flats) {
            this.ctx.moveTo(flat[0], flat[1]);
            for (let i = 2; i < flat.length; i += 2) {
              this.ctx.lineTo(flat[i], flat[i + 1]);
            }
          }
          this.ctx.stroke();
        }
      }

      // Construction roads: borders only in pass 1
      if (constructionFlats.length > 0) {
        for (const cf of constructionFlats) {
          const t = Math.min(1, Math.max(0, (cf.width - 1) / 5));
          const r = Math.round(Math.max(0, cf.color.r - 40) * (1 - t));
          const g = Math.round(Math.max(0, cf.color.g - 40) * (1 - t));
          const b = Math.round(Math.max(0, cf.color.b - 40) * (1 - t));
          const a = (0.6 + 0.4 * t) * (cf.color.a / 255);
          this.ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
          this.ctx.lineWidth = cf.width + 2;
          this.ctx.lineCap = casingCap;
          this.ctx.lineJoin = "round";
          this.ctx.beginPath();
          this.ctx.moveTo(cf.flat[0], cf.flat[1]);
          for (let i = 2; i < cf.flat.length; i += 2) {
            this.ctx.lineTo(cf.flat[i], cf.flat[i + 1]);
          }
          this.ctx.stroke();
        }
      }
    }

    // RENDERING PASS 2: Draw all road fills in priority order
    for (const [priority, data] of roadDataByPriority) {
      const { roadFeatures, constructionFlats } = data;

      if (roadFeatures.length > 0) {
        const fillBatches = new Map();
        for (const fc of roadFeatures) {
          const key = `${fc.color.r},${fc.color.g},${fc.color.b},${fc.color.a}|${fc.width}`;
          if (!fillBatches.has(key))
            fillBatches.set(key, {
              color: fc.color,
              width: fc.width,
              flats: [],
            });
          fillBatches.get(key).flats.push(fc.flat);
        }
        for (const [key, batch] of fillBatches) {
          this.ctx.strokeStyle = this._getRGBA(
            batch.color.r,
            batch.color.g,
            batch.color.b,
            batch.color.a / 255,
          );
          this.ctx.lineWidth = batch.width;
          this.ctx.lineCap = "round";
          this.ctx.lineJoin = "round";
          this.ctx.beginPath();
          for (const flat of batch.flats) {
            this.ctx.moveTo(flat[0], flat[1]);
            for (let i = 2; i < flat.length; i += 2) {
              this.ctx.lineTo(flat[i], flat[i + 1]);
            }
          }
          this.ctx.stroke();
        }
      }

      // Construction roads: fills in pass 2
      if (constructionFlats.length > 0) {
        const dashLen = 7;

        for (const cf of constructionFlats) {
          // White base
          //this.ctx.strokeStyle = "rgba(255,255,255,1)";
          this.ctx.strokeStyle = "rgba(200,60,60,0.8)";
          this.ctx.lineWidth = cf.width;
          this.ctx.lineCap = "butt";
          this.ctx.lineJoin = "round";
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.moveTo(cf.flat[0], cf.flat[1]);
          for (let i = 2; i < cf.flat.length; i += 2) {
            this.ctx.lineTo(cf.flat[i], cf.flat[i + 1]);
          }
          this.ctx.stroke();

          // Red dashes
          //this.ctx.strokeStyle = "rgba(200,60,60,0.8)";
          //this.ctx.strokeStyle = cf.color;
          this.ctx.strokeStyle = this._getRGBA(
            cf.color.r,
            cf.color.g,
            cf.color.b,
            cf.color.a / 255,
          );
          this.ctx.lineWidth = cf.width;
          this.ctx.setLineDash([dashLen, dashLen]);
          this.ctx.beginPath();
          this.ctx.moveTo(cf.flat[0], cf.flat[1]);
          for (let i = 2; i < cf.flat.length; i += 2) {
            this.ctx.lineTo(cf.flat[i], cf.flat[i + 1]);
          }
          this.ctx.stroke();
        }
        this.ctx.setLineDash([]);
      }

      /*
      // RENDERING PASS 3: Draw bicycle road markings (small bicycle pictograms)
      // Only at LOD 3+ (zoomed in enough to see details)
      const lod = this.getLOD();
      if (lod >= 3) {
        const bicycleRoads = roadFeatures.filter((fc) => fc.isBicycleRoad);
        if (bicycleRoads.length > 0) {
          this.ctx.fillStyle = toRGBA(getColor("roads", "cycleway"));
          this.ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
          this.ctx.lineWidth = 0.5;

          for (const fc of bicycleRoads) {
            const flat = fc.flat;
            // Calculate total length of road segment
            let totalLength = 0;
            const segments = [];
            for (let i = 2; i < flat.length; i += 2) {
              const dx = flat[i] - flat[i - 2];
              const dy = flat[i + 1] - flat[i - 3];
              const len = Math.sqrt(dx * dx + dy * dy);
              segments.push({
                x1: flat[i - 2],
                y1: flat[i - 3],
                x2: flat[i],
                y2: flat[i + 1],
                len,
              });
              totalLength += len;
            }

            // Place markings every 50-80 pixels along the road
            const spacing = 60;
            const numMarks = Math.floor(totalLength / spacing);

            for (let m = 0; m < numMarks; m++) {
              const targetDist = (m + 0.5) * spacing;
              let accDist = 0;

              // Find which segment contains this distance
              for (const seg of segments) {
                if (accDist + seg.len >= targetDist) {
                  const t = (targetDist - accDist) / seg.len;
                  const x = seg.x1 + t * (seg.x2 - seg.x1);
                  const y = seg.y1 + t * (seg.y2 - seg.y1);
                  const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);

                  // Draw tiny bicycle pictogram (simplified)
                  this.ctx.save();
                  this.ctx.translate(x, y);
                  this.ctx.rotate(angle);

                  const size = 3; // Very small marking
                  // Two circles for wheels
                  this.ctx.beginPath();
                  this.ctx.arc(-size, 0, size * 0.7, 0, Math.PI * 2);
                  this.ctx.arc(size, 0, size * 0.7, 0, Math.PI * 2);
                  this.ctx.stroke();
                  this.ctx.fill();

                  // Simple frame line
                  this.ctx.beginPath();
                  this.ctx.moveTo(-size, 0);
                  this.ctx.lineTo(0, -size * 0.8);
                  this.ctx.lineTo(size, 0);
                  this.ctx.stroke();

                  this.ctx.restore();
                  break;
                }
                accDist += seg.len;
              }
            }
          }
        }
      }
      */
    }

    // Restore alpha
    this.ctx.globalAlpha = prevAlpha;
  }

  renderStreetNames(layerFeatures, bounds) {
    // Render street names based on LOD:
    // LOD 0-1: Only major roads (motorway, primary)
    // LOD 2+: All roads
    const lod = this.getLOD();

    // Pre-compute bounds scaling
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    // Collect roads with names, grouped by street name
    const roadsByName = new Map();

    for (const item of layerFeatures) {
      const name = item.props.name;
      if (!name || name.trim() === "") continue;

      // At low LOD, only show major road names (priority 6+: motorway, primary)
      if (lod < 2 && (item.roadPriority || 0) < 6) continue;

      const geom = item.feature.geometry;
      if (!geom || !geom.coordinates) continue;

      const coordArrays =
        item.type === "LineString"
          ? [geom.coordinates]
          : item.type === "MultiLineString"
            ? geom.coordinates
            : null;

      if (!coordArrays) continue;

      for (const coords of coordArrays) {
        if (coords.length < 2) continue;

        // Convert to screen coordinates
        const screenCoords = coords.map((c) => ({
          x: toScreenX(c[0]),
          y: toScreenY(c[1]),
        }));

        // Calculate total line length
        let length = 0;
        for (let i = 1; i < screenCoords.length; i++) {
          const dx = screenCoords[i].x - screenCoords[i - 1].x;
          const dy = screenCoords[i].y - screenCoords[i - 1].y;
          length += Math.sqrt(dx * dx + dy * dy);
        }

        // Only consider if line is long enough for text (reduced threshold to catch more segments)
        if (length < 30) continue;

        const road = {
          name,
          screenCoords,
          length,
          priority: item.roadPriority || 0,
          width: item.width || 1,
        };

        if (!roadsByName.has(name)) {
          roadsByName.set(name, []);
        }
        roadsByName.get(name).push(road);
      }
    }

    // Screen center and viewport bounds for distance/visibility calculations
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    const viewportMargin = 50; // pixels - margin for "significantly in viewport"

    // Helper: check if segment midpoint is in viewport
    const isInViewport = (midX, midY) => {
      return (
        midX >= -viewportMargin &&
        midX <= this.canvasWidth + viewportMargin &&
        midY >= -viewportMargin &&
        midY <= this.canvasHeight + viewportMargin
      );
    };

    // For each street name, pick the best segment to label
    const namedRoads = [];
    for (const [name, segments] of roadsByName) {
      if (segments.length === 0) continue;

      // If only one segment, use it
      if (segments.length === 1) {
        namedRoads.push(segments[0]);
        continue;
      }

      // Calculate midpoints and check visibility for all segments
      const segmentsWithMidpoints = segments.map((segment) => {
        let midDist = segment.length / 2;
        let accumulated = 0;
        let midX = segment.screenCoords[0].x;
        let midY = segment.screenCoords[0].y;

        for (let i = 1; i < segment.screenCoords.length; i++) {
          const dx = segment.screenCoords[i].x - segment.screenCoords[i - 1].x;
          const dy = segment.screenCoords[i].y - segment.screenCoords[i - 1].y;
          const segLen = Math.sqrt(dx * dx + dy * dy);

          if (accumulated + segLen >= midDist) {
            const t = (midDist - accumulated) / segLen;
            midX = segment.screenCoords[i - 1].x + dx * t;
            midY = segment.screenCoords[i - 1].y + dy * t;
            break;
          }
          accumulated += segLen;
        }

        return { segment, midX, midY, inViewport: isInViewport(midX, midY) };
      });

      // Filter to only segments in viewport
      const visibleSegments = segmentsWithMidpoints.filter((s) => s.inViewport);

      // If no segments are visible, skip this street name entirely
      if (visibleSegments.length === 0) continue;

      // If only one visible segment, use it
      if (visibleSegments.length === 1) {
        namedRoads.push(visibleSegments[0].segment);
        continue;
      }

      // Multiple visible segments - pick the best one
      // Criteria: closest to center, longest, or highest priority
      let bestSegment = visibleSegments[0].segment;
      let bestScore = -Infinity;

      for (const { segment, midX, midY } of visibleSegments) {
        // Score based on distance to center (closer is better) and length (longer is better)
        const distToCenter = Math.sqrt(
          (midX - centerX) ** 2 + (midY - centerY) ** 2,
        );
        const normalizedDist =
          distToCenter / Math.sqrt(centerX ** 2 + centerY ** 2);
        const normalizedLength = segment.length / 500; // 500px is a "good" length

        const score =
          -normalizedDist + normalizedLength * 0.3 + segment.priority * 0.1;

        if (score > bestScore) {
          bestScore = score;
          bestSegment = segment;
        }
      }

      namedRoads.push(bestSegment);
    }

    // Sort by priority (higher priority = drawn on top)
    namedRoads.sort((a, b) => a.priority - b.priority);

    // Render text along paths
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (const road of namedRoads) {
      // Font size: base of 11px, increases with road width (but capped)
      // This keeps text readable while scaling slightly with importance
      const fontSize = Math.max(10, Math.min(15, 11 + road.width * 0.4));

      // Skip very narrow roads (< 1.5 pixels wide) where text won't fit nicely
      // But allow higher priority roads (5+) to always show labels
      if (road.width < 1.5 && road.priority < 5) continue;

      this.ctx.font = `${fontSize}px Arial, sans-serif`;

      // Measure text width
      const textWidth = this.ctx.measureText(road.name).width;

      // Only render if road is long enough for the text with minimal padding
      // Use more lenient check to label more streets
      if (road.length < textWidth + 10) continue;

      // Draw curved text along the path
      // Check the overall direction of the road (start to end)
      const startPoint = road.screenCoords[0];
      const endPoint = road.screenCoords[road.screenCoords.length - 1];
      const overallAngle = Math.atan2(
        endPoint.y - startPoint.y,
        endPoint.x - startPoint.x,
      );

      // If road points left, we traverse the path backwards so text reads left-to-right
      const drawReversed = Math.abs(overallAngle) > Math.PI / 2;

      // Start position: center the text along the road
      // If reversed, start from the end
      const startDist = drawReversed
        ? (road.length + textWidth) / 2
        : (road.length - textWidth) / 2;

      // Helper: find position and angle at a given distance along the path
      const getPointAtDistance = (targetDist) => {
        let accumulated = 0;
        for (let i = 1; i < road.screenCoords.length; i++) {
          const dx = road.screenCoords[i].x - road.screenCoords[i - 1].x;
          const dy = road.screenCoords[i].y - road.screenCoords[i - 1].y;
          const segLen = Math.sqrt(dx * dx + dy * dy);

          if (accumulated + segLen >= targetDist) {
            const t = (targetDist - accumulated) / segLen;
            const x = road.screenCoords[i - 1].x + dx * t;
            const y = road.screenCoords[i - 1].y + dy * t;
            const angle = Math.atan2(dy, dx);
            return { x, y, angle };
          }
          accumulated += segLen;
        }
        // Fallback to end of path
        const last = road.screenCoords[road.screenCoords.length - 1];
        const prev = road.screenCoords[road.screenCoords.length - 2];
        return {
          x: last.x,
          y: last.y,
          angle: Math.atan2(last.y - prev.y, last.x - prev.x),
        };
      };

      // Draw each character along the path
      let currentDist = startDist;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      for (let i = 0; i < road.name.length; i++) {
        const char = road.name[i];
        const charWidth = this.ctx.measureText(char).width;

        // Get position and angle at the center of this character
        const charCenter = drawReversed
          ? currentDist - charWidth / 2
          : currentDist + charWidth / 2;
        const point = getPointAtDistance(charCenter);

        // Angle adjustment based on direction
        let angle = point.angle;
        if (drawReversed) {
          angle = angle + Math.PI;
        }

        // Draw character
        this.ctx.save();
        this.ctx.translate(point.x, point.y);
        this.ctx.rotate(angle);

        // White outline
        const outlineColor = getColor("text", "outline");
        this.ctx.strokeStyle = toRGB(outlineColor);
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeText(char, 0, 0);

        // Text color from theme
        const textColor = getColor("text", "roads");
        this.ctx.fillStyle = toRGBA({ ...textColor, a: 217 }); // 0.85 opacity = 217/255
        this.ctx.fillText(char, 0, 0);

        this.ctx.restore();

        // Move to next character position
        currentDist += drawReversed ? -charWidth : charWidth;
      }
    }
  }

  renderCoastlineWithArrows(layerFeatures, bounds) {
    // Render coastlines with direction arrows to visualize topology
    if (!layerFeatures || layerFeatures.length === 0) return;

    // Pre-compute bounds scaling
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    for (const item of layerFeatures) {
      const { feature, props, type, color, width } = item;
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) continue;

      const coordArrays =
        type === "LineString"
          ? [geom.coordinates]
          : type === "MultiLineString"
            ? geom.coordinates
            : null;

      if (!coordArrays) continue;

      for (const coords of coordArrays) {
        if (coords.length < 2) continue;

        // Convert to screen coordinates
        const screenCoords = coords.map((c) => ({
          x: toScreenX(c[0]),
          y: toScreenY(c[1]),
        }));

        // Draw blue border on the right side of the coastline
        // (perpendicular offset to the right of the direction)
        const offsetDistance = 5; // pixels to the right
        const rightSideCoords = [];

        for (let i = 0; i < screenCoords.length; i++) {
          let dx, dy;

          if (i === 0) {
            // First point: use direction to next point
            dx = screenCoords[i + 1].x - screenCoords[i].x;
            dy = screenCoords[i + 1].y - screenCoords[i].y;
          } else if (i === screenCoords.length - 1) {
            // Last point: use direction from previous point
            dx = screenCoords[i].x - screenCoords[i - 1].x;
            dy = screenCoords[i].y - screenCoords[i - 1].y;
          } else {
            // Middle points: average direction from both segments
            const dx1 = screenCoords[i].x - screenCoords[i - 1].x;
            const dy1 = screenCoords[i].y - screenCoords[i - 1].y;
            const dx2 = screenCoords[i + 1].x - screenCoords[i].x;
            const dy2 = screenCoords[i + 1].y - screenCoords[i].y;
            dx = dx1 + dx2;
            dy = dy1 + dy2;
          }

          // Normalize direction
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            dx /= len;
            dy /= len;
          }

          // Perpendicular to the right (rotate 90° counter-clockwise)
          const perpX = -dy;
          const perpY = dx;

          rightSideCoords.push({
            x: screenCoords[i].x + perpX * offsetDistance,
            y: screenCoords[i].y + perpY * offsetDistance,
          });
        }

        // Draw the blue border line on the right side
        this.ctx.strokeStyle = "rgba(0, 150, 255, 0.7)"; // Blue
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(rightSideCoords[0].x, rightSideCoords[0].y);
        for (let i = 1; i < rightSideCoords.length; i++) {
          this.ctx.lineTo(rightSideCoords[i].x, rightSideCoords[i].y);
          this.ctx.lineTo(rightSideCoords[i].x - 7, rightSideCoords[i].y - 7);
          this.ctx.lineTo(rightSideCoords[i].x + 7, rightSideCoords[i].y + 7);
          this.ctx.lineTo(rightSideCoords[i].x, rightSideCoords[i].y);
          this.ctx.lineTo(rightSideCoords[i].x + 7, rightSideCoords[i].y - 7);
          this.ctx.lineTo(rightSideCoords[i].x - 7, rightSideCoords[i].y + 7);
          this.ctx.lineTo(rightSideCoords[i].x, rightSideCoords[i].y);
        }
        this.ctx.stroke();

        // Draw the coastline as a thick magenta line (center line)
        this.ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
        this.ctx.lineWidth = width || 3;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(screenCoords[0].x, screenCoords[0].y);
        for (let i = 1; i < screenCoords.length; i++) {
          this.ctx.lineTo(screenCoords[i].x, screenCoords[i].y);
        }
        this.ctx.stroke();

        //this.ctx.beginPath();
        //for (let i = 0; i < screenCoords.length; i++) {
        //  this.ctx.circle(screenCoords[i].x, screenCoords[i].y, 7);
        //}
        //this.ctx.stroke();

        // Draw direction arrows along the line
        // Arrow every ~50 pixels
        const arrowSpacing = 50;
        let accumulatedDistance = 0;

        for (let i = 1; i < screenCoords.length; i++) {
          const p1 = screenCoords[i - 1];
          const p2 = screenCoords[i];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const segmentLength = Math.sqrt(dx * dx + dy * dy);

          // Walk along this segment placing arrows
          let distanceInSegment =
            arrowSpacing - (accumulatedDistance % arrowSpacing);

          while (distanceInSegment < segmentLength) {
            const t = distanceInSegment / segmentLength;
            const arrowX = p1.x + dx * t;
            const arrowY = p1.y + dy * t;

            // Calculate arrow direction (tangent to line)
            const angle = Math.atan2(dy, dx);

            // Draw arrow (simple triangle pointing in direction)
            const arrowSize = 8;
            this.ctx.save();
            this.ctx.translate(arrowX, arrowY);
            this.ctx.rotate(angle);

            this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; // White fill
            this.ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},1)`;
            this.ctx.lineWidth = 1;

            this.ctx.beginPath();
            this.ctx.moveTo(arrowSize, 0); // Tip
            this.ctx.lineTo(-arrowSize / 2, -arrowSize / 2); // Top wing
            this.ctx.lineTo(-arrowSize / 2, arrowSize / 2); // Bottom wing
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.restore();

            distanceInSegment += arrowSpacing;
          }

          accumulatedDistance += segmentLength;
        }
      }
    }
  }

  renderPlaceLabels(layerFeatures, bounds) {
    // Render place names (cities, towns, villages) with smart density control
    if (!layerFeatures || layerFeatures.length === 0) return;

    const lod = this.getLOD();

    // Pre-compute bounds scaling
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    // Collect all places with their screen positions
    const places = [];
    for (const item of layerFeatures) {
      const { feature, props } = item;
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) continue;

      const [lon, lat] = geom.coordinates;
      const sx = toScreenX(lon);
      const sy = toScreenY(lat);

      // Skip if off-screen (with margin)
      const margin = 50;
      if (
        sx < -margin ||
        sx > this.canvasWidth + margin ||
        sy < -margin ||
        sy > this.canvasHeight + margin
      ) {
        continue;
      }

      places.push({
        name: props.name,
        x: sx,
        y: sy,
        priority: item.placePriority || 9,
        fontSize: item.fontSize || 12,
        placeType: item.placeType || "unknown",
        population: item.population || 0,
      });
    }

    if (places.length === 0) return;

    // Sort by priority (lower = more important = render first)
    places.sort((a, b) => a.priority - b.priority);

    // Density control: limit number of labels based on zoom level
    // This prevents overcrowding at lower zoom levels
    let maxLabels;
    if (lod === 0) {
      maxLabels = 15; // Very zoomed out: only major cities
    } else if (lod === 1) {
      maxLabels = 30; // Medium zoom: cities + large towns
    } else if (lod === 2) {
      maxLabels = 60; // Zoomed in: add villages
    } else if (lod === 3) {
      maxLabels = 100; // More zoomed: add suburbs/boroughs
    } else {
      maxLabels = 200; // Very zoomed: show most places
    }

    // Additional density control: minimum spacing between labels
    // Prevents labels from overlapping
    const minSpacing = 30; // pixels
    const renderedPositions = [];

    let labelCount = 0;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (const place of places) {
      if (labelCount >= maxLabels) break;

      // Check spacing with already rendered labels
      let tooClose = false;
      for (const pos of renderedPositions) {
        const dx = place.x - pos.x;
        const dy = place.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minSpacing) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) continue;

      // Render the label - bold for major places, normal weight for small places
      const fontWeight = place.priority <= 6 ? "bold" : "";
      this.ctx.font =
        `${fontWeight} ${place.fontSize}px Arial, sans-serif`.trim();

      // White outline for readability
      const outlineColor = getColor("text", "outline");
      this.ctx.strokeStyle = toRGBA({ ...outlineColor, a: 230 }); // 0.9 opacity = 230/255
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(place.name, place.x, place.y);

      // Text color from theme
      const textColor = getColor("text", "places");
      this.ctx.fillStyle = toRGBA({ ...textColor, a: 230 }); // 0.9 opacity = 230/255
      this.ctx.fillText(place.name, place.x, place.y);

      // Optional: render place type or population for debugging
      // if (place.population > 0) {
      //   this.ctx.font = `10px Arial`;
      //   this.ctx.fillStyle = "rgba(100, 100, 100, 0.7)";
      //   this.ctx.fillText(`(${(place.population / 1000).toFixed(0)}k)`, place.x, place.y + place.fontSize);
      // }

      renderedPositions.push({ x: place.x, y: place.y });
      labelCount++;
    }

    console.log(
      `[PLACES] Rendered ${labelCount}/${places.length} labels (LOD ${lod}, max ${maxLabels})`,
    );
  }

  renderWaterLabels(layerFeatures, bounds) {
    // Render water body names (lakes, ponds, rivers, canals)
    if (!layerFeatures || layerFeatures.length === 0) return;

    // Water labels can be shown at any zoom level (no LOD restriction)
    // Instead, we check if the label fits within the polygon bounds

    // Pre-compute bounds scaling
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    const waterLabels = [];
    const seenNames = new Map(); // Track names to avoid duplicates

    // Set up canvas for text measurement
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (const item of layerFeatures) {
      const { feature, name, waterType } = item;
      const geom = feature.geometry;
      if (!geom || !geom.coordinates || !name) continue;

      // Calculate centroid and bounds for label placement
      let centerX,
        centerY,
        angle = 0;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;

      if (geom.type === "Polygon") {
        // For polygons (lakes, ponds), calculate centroid and bounds
        const rings = geom.coordinates; // [outerRing, hole1, hole2, ...]
        const outerRing = rings[0];
        const holes = rings.slice(1);

        let sumX = 0,
          sumY = 0;

        for (const coord of outerRing) {
          const sx = toScreenX(coord[0]);
          const sy = toScreenY(coord[1]);
          sumX += sx;
          sumY += sy;

          // Track bounds
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;
        }

        centerX = sumX / outerRing.length;
        centerY = sumY / outerRing.length;

        // Helper function: point-in-polygon test using ray casting
        const isPointInPolygon = (px, py, ring) => {
          let inside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = toScreenX(ring[i][0]);
            const yi = toScreenY(ring[i][1]);
            const xj = toScreenX(ring[j][0]);
            const yj = toScreenY(ring[j][1]);

            const intersect =
              yi > py !== yj > py &&
              px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
          }
          return inside;
        };

        // Check if centroid is inside a hole (island)
        let centroidInHole = false;
        for (const hole of holes) {
          if (isPointInPolygon(centerX, centerY, hole)) {
            centroidInHole = true;
            break;
          }
        }

        // If centroid is in a hole, try to find a better position
        if (centroidInHole) {
          // Try positions in a grid pattern within the bounding box
          let foundPosition = false;
          const gridSize = 5;
          const stepX = (maxX - minX) / (gridSize + 1);
          const stepY = (maxY - minY) / (gridSize + 1);

          for (let gy = 1; gy <= gridSize && !foundPosition; gy++) {
            for (let gx = 1; gx <= gridSize && !foundPosition; gx++) {
              const testX = minX + gx * stepX;
              const testY = minY + gy * stepY;

              // Check if this point is in outer ring but not in any hole
              if (isPointInPolygon(testX, testY, outerRing)) {
                let inAnyHole = false;
                for (const hole of holes) {
                  if (isPointInPolygon(testX, testY, hole)) {
                    inAnyHole = true;
                    break;
                  }
                }
                if (!inAnyHole) {
                  centerX = testX;
                  centerY = testY;
                  foundPosition = true;
                }
              }
            }
          }

          // If still couldn't find a good position, skip this label
          if (!foundPosition) {
            continue;
          }
        }

        // Measure text to see if it fits within polygon bounds
        const fontSize = 14;
        this.ctx.font = `italic ${fontSize}px Arial, sans-serif`;
        const textMetrics = this.ctx.measureText(name);
        const textWidth = textMetrics.width;
        const textHeight = fontSize * 1.2; // Approximate height with padding

        // Check if text fits within polygon bounds (with small margin)
        const margin = 10;
        const polygonWidth = maxX - minX;
        const polygonHeight = maxY - minY;

        if (
          textWidth > polygonWidth - margin ||
          textHeight > polygonHeight - margin
        ) {
          // Text doesn't fit within polygon, skip this label
          continue;
        }
      } else if (geom.type === "LineString") {
        // For linestrings (rivers, canals), deduplicate by name
        // Only keep the one closest to screen center
        const coords = geom.coordinates;
        const midIdx = Math.floor(coords.length / 2);
        centerX = toScreenX(coords[midIdx][0]);
        centerY = toScreenY(coords[midIdx][1]);

        // Calculate distance to screen center for prioritization
        const screenCenterX = this.canvasWidth / 2;
        const screenCenterY = this.canvasHeight / 2;
        const distToCenter = Math.sqrt(
          Math.pow(centerX - screenCenterX, 2) +
            Math.pow(centerY - screenCenterY, 2),
        );

        // Check if we've seen this name before
        if (seenNames.has(name)) {
          const existing = seenNames.get(name);
          // Keep the one closer to center
          if (distToCenter >= existing.distToCenter) {
            continue; // Skip this one, keep the existing
          }
        }

        // For lines, calculate total length to decide if label fits
        let totalLength = 0;
        for (let i = 1; i < coords.length; i++) {
          const x1 = toScreenX(coords[i - 1][0]);
          const y1 = toScreenY(coords[i - 1][1]);
          const x2 = toScreenX(coords[i][0]);
          const y2 = toScreenY(coords[i][1]);
          const dx = x2 - x1;
          const dy = y2 - y1;
          totalLength += Math.sqrt(dx * dx + dy * dy);
        }

        // Measure text
        const fontSize = 12;
        this.ctx.font = `italic ${fontSize}px Arial, sans-serif`;
        const textMetrics = this.ctx.measureText(name);
        const textWidth = textMetrics.width;

        // Check if text fits along the line (with margin)
        if (textWidth > totalLength - 20) {
          // Text doesn't fit along line, skip this label
          continue;
        }

        // Calculate angle at midpoint for text rotation
        const beforeIdx = Math.max(0, midIdx - 1);
        const afterIdx = Math.min(coords.length - 1, midIdx + 1);
        const x1 = toScreenX(coords[beforeIdx][0]);
        const y1 = toScreenY(coords[beforeIdx][1]);
        const x2 = toScreenX(coords[afterIdx][0]);
        const y2 = toScreenY(coords[afterIdx][1]);
        angle = Math.atan2(y2 - y1, x2 - x1);

        // Normalize angle to [-90°, 90°] to keep text readable
        if (angle > Math.PI / 2) {
          angle -= Math.PI;
        } else if (angle < -Math.PI / 2) {
          angle += Math.PI;
        }

        // Store this label (will replace existing if closer to center)
        seenNames.set(name, {
          distToCenter,
          centerX,
          centerY,
          angle,
          waterType,
        });
        continue; // Will be added to waterLabels after loop
      } else {
        continue; // Skip other geometry types
      }

      // Check if label position is in viewport
      const margin = 20;
      if (
        centerX < -margin ||
        centerX > this.canvasWidth + margin ||
        centerY < -margin ||
        centerY > this.canvasHeight + margin
      ) {
        continue;
      }

      waterLabels.push({
        name,
        waterType,
        x: centerX,
        y: centerY,
        angle: 0,
        isLine: false,
      });
    }

    // Add the deduplicated line labels
    for (const [name, data] of seenNames.entries()) {
      // Check if label position is in viewport
      const margin = 20;
      if (
        data.centerX < -margin ||
        data.centerX > this.canvasWidth + margin ||
        data.centerY < -margin ||
        data.centerY > this.canvasHeight + margin
      ) {
        continue;
      }

      waterLabels.push({
        name,
        waterType: data.waterType,
        x: data.centerX,
        y: data.centerY,
        angle: data.angle,
        isLine: true,
      });
    }

    if (waterLabels.length === 0) return;

    // Render labels
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (const label of waterLabels) {
      const fontSize = label.isLine ? 12 : 14; // Rivers slightly smaller
      this.ctx.font = `italic ${fontSize}px Arial, sans-serif`;

      // Save context for rotation
      this.ctx.save();

      // Translate to label position and rotate
      this.ctx.translate(label.x, label.y);
      this.ctx.rotate(label.angle);

      // White outline for readability
      const outlineColor = getColor("text", "outline");
      this.ctx.strokeStyle = toRGBA({ ...outlineColor, a: 230 }); // 0.9 opacity = 230/255
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(label.name, 0, 0);

      // Blue text for water
      const textColor = getColor("text", "water");
      this.ctx.fillStyle = toRGBA({ ...textColor, a: 230 }); // 0.9 opacity = 230/255
      this.ctx.fillText(label.name, 0, 0);

      // Restore context
      this.ctx.restore();
    }

    console.log(`[WATER] Rendered ${waterLabels.length} water labels`);
  }

  renderBuildingLabels(layerFeatures, bounds, roadFeatures) {
    if (!layerFeatures || layerFeatures.length === 0) return;

    console.log(
      `[BUILDINGS] ${layerFeatures.length} features with house numbers available, LOD=${this.getLOD()}`,
    );

    if (this.viewWidthMeters > 500) return;

    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    // Build flat array of road segments in screen coords for nearest-road lookup
    const roadSegments = [];
    if (roadFeatures) {
      for (const item of roadFeatures) {
        const geom = item.feature.geometry;
        if (!geom || !geom.coordinates) continue;
        const coordArrays =
          geom.type === "LineString"
            ? [geom.coordinates]
            : geom.type === "MultiLineString"
              ? geom.coordinates
              : null;
        if (!coordArrays) continue;
        for (const coords of coordArrays) {
          for (let i = 0; i < coords.length - 1; i++) {
            roadSegments.push(
              toScreenX(coords[i][0]),
              toScreenY(coords[i][1]),
              toScreenX(coords[i + 1][0]),
              toScreenY(coords[i + 1][1]),
            );
          }
        }
      }
    }

    const fontSize = 10;
    this.ctx.font = `${fontSize}px Arial, sans-serif`;

    const houseNumbers = [];
    let skippedTooSmall = 0;

    for (const item of layerFeatures) {
      const { feature, number, color } = item;
      const geom = feature.geometry;
      if (!geom || !geom.coordinates || !number) continue;

      // Get outer ring from Polygon or MultiPolygon
      let ring;
      if (geom.type === "Polygon") {
        ring = geom.coordinates[0];
      } else if (geom.type === "MultiPolygon") {
        ring = geom.coordinates[0][0];
      } else {
        continue;
      }

      // Convert ring to screen coords, compute centroid and bbox
      const screenRing = new Array(ring.length);
      let sumX = 0,
        sumY = 0;
      let bboxMinX = Infinity,
        bboxMaxX = -Infinity;
      let bboxMinY = Infinity,
        bboxMaxY = -Infinity;
      for (let i = 0; i < ring.length; i++) {
        const sx = toScreenX(ring[i][0]);
        const sy = toScreenY(ring[i][1]);
        screenRing[i] = { x: sx, y: sy };
        sumX += sx;
        sumY += sy;
        if (sx < bboxMinX) bboxMinX = sx;
        if (sx > bboxMaxX) bboxMaxX = sx;
        if (sy < bboxMinY) bboxMinY = sy;
        if (sy > bboxMaxY) bboxMaxY = sy;
      }
      const centerX = sumX / ring.length;
      const centerY = sumY / ring.length;

      // Skip if outside viewport
      if (
        centerX < -10 ||
        centerX > this.canvasWidth + 10 ||
        centerY < -10 ||
        centerY > this.canvasHeight + 10
      )
        continue;

      // Check if text fits inside the building polygon
      const textWidth = this.ctx.measureText(number).width;
      const polyWidth = bboxMaxX - bboxMinX;
      const polyHeight = bboxMaxY - bboxMinY;
      if (textWidth + 2 > polyWidth || fontSize + 2 > polyHeight) {
        skippedTooSmall++;
        continue;
      }

      // Find nearest road segment and offset label towards the road-facing edge
      let labelX = centerX,
        labelY = centerY;
      if (roadSegments.length > 0) {
        // Find closest road point to building centroid
        let bestDist = Infinity,
          nearestRoadX = centerX,
          nearestRoadY = centerY;
        for (let i = 0; i < roadSegments.length; i += 4) {
          const ax = roadSegments[i],
            ay = roadSegments[i + 1];
          const bx = roadSegments[i + 2],
            by = roadSegments[i + 3];
          // Quick distance cull — skip segments far from this building
          const segCenterX = (ax + bx) * 0.5,
            segCenterY = (ay + by) * 0.5;
          const roughDist =
            Math.abs(segCenterX - centerX) + Math.abs(segCenterY - centerY);
          if (roughDist > 200) continue;
          // Project centroid onto segment
          const dx = bx - ax,
            dy = by - ay;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          const t = Math.max(
            0,
            Math.min(1, ((centerX - ax) * dx + (centerY - ay) * dy) / lenSq),
          );
          const px = ax + t * dx,
            py = ay + t * dy;
          const dist = (px - centerX) ** 2 + (py - centerY) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            nearestRoadX = px;
            nearestRoadY = py;
          }
        }

        if (bestDist < 10000) {
          // within ~100px
          // Direction from centroid towards nearest road
          const dirX = nearestRoadX - centerX;
          const dirY = nearestRoadY - centerY;
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
          if (dirLen > 0.5) {
            const nx = dirX / dirLen,
              ny = dirY / dirLen;
            // Find how far we can shift towards road while staying inside bbox
            const maxShiftX = (polyWidth - textWidth) * 0.5 - 1;
            const maxShiftY = (polyHeight - fontSize) * 0.5 - 1;
            // Slight shift towards road, staying close to center
            const shiftX = nx * maxShiftX * 0.25;
            const shiftY = ny * maxShiftY * 0.25;
            labelX = centerX + shiftX;
            labelY = centerY + shiftY;
          }
        }
      }

      houseNumbers.push({
        number,
        x: labelX,
        y: labelY,
        color,
      });
    }

    console.log(
      `[BUILDINGS] House numbers: ${houseNumbers.length} rendered, ${skippedTooSmall} skipped (too small)`,
    );

    if (houseNumbers.length === 0) return;

    // Render labels — darken light buildings, lighten dark buildings
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (const label of houseNumbers) {
      const c = label.color;
      const brightness = (c.r + c.g + c.b) / 3;
      let r, g, b;
      if (brightness > 140) {
        r = Math.max(0, c.r - 60);
        g = Math.max(0, c.g - 60);
        b = Math.max(0, c.b - 60);
      } else {
        r = Math.min(255, c.r + 80);
        g = Math.min(255, c.g + 80);
        b = Math.min(255, c.b + 80);
      }
      this.ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
      this.ctx.fillText(label.number, label.x, label.y);
    }
  }

  renderLayer(layerFeatures, bounds, useFill) {
    // Batch features by style to minimize Canvas2D state changes.
    // Key = "r,g,b,a|width", value = array of coordinate arrays to draw.
    const lineBatches = new Map(); // key -> { coords: [...], features: [...] }
    const fillBatches = new Map(); // key -> { coords: [...], features: [...] }
    const patternBatches = new Map(); // pattern -> { polygons: [...] }
    const strokeBatches = new Map(); // for building borders
    const railwayFeatures = []; // railways need special rendering

    // Pre-compute bounds scaling factors once
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;

    // Inline coordinate transform (avoids function call + object allocation per coord)
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    for (const item of layerFeatures) {
      const { feature, props, type, color, fill, width, isRailway } = item;
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) continue;

      try {
        if (type === "Point") {
          const [lon, lat] = geom.coordinates;
          const sx = toScreenX(lon);
          const sy = toScreenY(lat);

          // Collect POIs for glyph rendering
          if (item.poiCategory) {
            this._poiRenderQueue.push({
              x: sx,
              y: sy,
              category: item.poiCategory,
            });
          } else {
            // Non-categorized points: batch as colored circles
            const colorStr = item._fillKey;
            if (!fillBatches.has(colorStr)) {
              fillBatches.set(colorStr, {
                points: [],
                polygons: [],
                features: [],
              });
            }
            fillBatches.get(colorStr).points.push(sx, sy);
          }
          if (this.hoverInfoEnabled || this.selectedFeature) {
            this.renderedFeatures.push({
              type: "Point",
              screenX: sx,
              screenY: sy,
              properties: props,
              feature: feature,
              geometry: geom,
            });
          }
        } else if (type === "LineString" || type === "MultiLineString") {
          const coordArrays =
            type === "LineString" ? [geom.coordinates] : geom.coordinates;

          if (isRailway) {
            for (const coords of coordArrays) {
              if (coords.length < 2) continue;
              const screenCoords = new Array(coords.length);
              for (let i = 0; i < coords.length; i++) {
                screenCoords[i] = {
                  x: toScreenX(coords[i][0]),
                  y: toScreenY(coords[i][1]),
                };
              }
              railwayFeatures.push({ screenCoords, color, width });
              if (this.hoverInfoEnabled || this.selectedFeature) {
                this.renderedFeatures.push({
                  type: "LineString",
                  screenCoords,
                  properties: props,
                  feature,
                  geometry: geom,
                });
              }
            }
          } else {
            const key = item._lineKey;
            if (!lineBatches.has(key)) {
              lineBatches.set(key, {
                color,
                width: width || 1,
                borderWidth: item.borderWidth || 0,
                borderColor: item.borderColor || null,
                dashPattern: item.dashPattern || null,
                lines: [],
                features: [],
              });
            }
            const batch = lineBatches.get(key);

            for (const coords of coordArrays) {
              if (coords.length < 2) continue;
              // Store flat screen coordinates: [x0,y0, x1,y1, ...]
              const flat = new Array(coords.length * 2);
              const screenCoords =
                this.hoverInfoEnabled || this.selectedFeature
                  ? new Array(coords.length)
                  : null;
              for (let i = 0; i < coords.length; i++) {
                const sx = toScreenX(coords[i][0]);
                const sy = toScreenY(coords[i][1]);
                flat[i * 2] = sx;
                flat[i * 2 + 1] = sy;
                if (screenCoords) screenCoords[i] = { x: sx, y: sy };
              }
              batch.lines.push(flat);
              if (screenCoords) {
                this.renderedFeatures.push({
                  type: "LineString",
                  screenCoords,
                  properties: props,
                  feature,
                  geometry: geom,
                });
              }
            }
          }
        } else if (type === "Polygon" || type === "MultiPolygon") {
          const polygonArrays =
            type === "Polygon" ? [geom.coordinates] : geom.coordinates;
          const shouldFill = fill && useFill;

          for (const polygon of polygonArrays) {
            // polygon is an array of rings: [outerRing, hole1, hole2, ...]
            // outerRing is the boundary, subsequent rings are holes (islands in water bodies)
            const outerRing = polygon[0];
            const innerRings = polygon.slice(1); // holes
            if (!outerRing || outerRing.length < 3) continue;

            // Convert outer ring to screen coordinates
            const outerFlat = new Array(outerRing.length * 2);
            const screenCoords =
              this.hoverInfoEnabled || this.selectedFeature
                ? new Array(outerRing.length)
                : null;
            for (let i = 0; i < outerRing.length; i++) {
              const sx = toScreenX(outerRing[i][0]);
              const sy = toScreenY(outerRing[i][1]);
              outerFlat[i * 2] = sx;
              outerFlat[i * 2 + 1] = sy;
              if (screenCoords) screenCoords[i] = { x: sx, y: sy };
            }

            // Convert inner rings (holes) to screen coordinates
            const innerFlats = [];
            for (const innerRing of innerRings) {
              if (!innerRing || innerRing.length < 3) continue;
              const innerFlat = new Array(innerRing.length * 2);
              for (let i = 0; i < innerRing.length; i++) {
                const sx = toScreenX(innerRing[i][0]);
                const sy = toScreenY(innerRing[i][1]);
                innerFlat[i * 2] = sx;
                innerFlat[i * 2 + 1] = sy;
              }
              innerFlats.push(innerFlat);
            }

            if (shouldFill) {
              // Check if this feature has a pattern (scrub, wetland, etc.)
              if (item.pattern && this.patternCache[item.pattern]) {
                // Add to pattern batch
                if (!patternBatches.has(item.pattern)) {
                  patternBatches.set(item.pattern, {
                    baseColor: color, // Base fill color
                    polygons: [],
                  });
                }
                patternBatches.get(item.pattern).polygons.push({
                  outer: outerFlat,
                  holes: innerFlats,
                });
              } else {
                // Regular solid fill
                const colorStr = item._fillKey;
                if (!fillBatches.has(colorStr)) {
                  fillBatches.set(colorStr, {
                    points: [],
                    polygons: [],
                    features: [],
                  });
                }
                // Store outer ring and holes together
                fillBatches.get(colorStr).polygons.push({
                  outer: outerFlat,
                  holes: innerFlats,
                });
              }

              // If feature has stroke property, add to stroke batch
              if (item.stroke && item.strokeColor) {
                const strokeKey = `${item.strokeColor.r},${item.strokeColor.g},${item.strokeColor.b},${item.strokeColor.a}|${item.strokeWidth}`;
                if (!strokeBatches.has(strokeKey)) {
                  strokeBatches.set(strokeKey, {
                    color: item.strokeColor,
                    width: item.strokeWidth,
                    polygons: [],
                  });
                }
                strokeBatches.get(strokeKey).polygons.push({
                  outer: outerFlat,
                  holes: innerFlats,
                });
              }
            } else {
              // Outline only - batch as lines with width 1
              const key = item._lineKey;
              if (!lineBatches.has(key)) {
                lineBatches.set(key, {
                  color,
                  width: 1,
                  lines: [],
                  features: [],
                });
              }
              lineBatches.get(key).lines.push(outerFlat);
              // Also outline the holes
              for (const innerFlat of innerFlats) {
                lineBatches.get(key).lines.push(innerFlat);
              }
            }

            if (screenCoords) {
              this.renderedFeatures.push({
                type: "Polygon",
                screenCoords,
                properties: props,
                feature,
                geometry: geom,
              });
            }
          }
        }
      } catch (error) {
        console.warn("Error rendering feature:", error);
      }
    }

    // Flush fill batches — each polygon gets its own path to avoid
    // evenodd artifacts when same-color polygons overlap (e.g. park + village_green)
    for (const [colorStr, batch] of fillBatches) {
      this.ctx.fillStyle = colorStr;

      // Filled polygons (each as independent path so overlaps don't cancel)
      for (const poly of batch.polygons) {
        this.ctx.beginPath();
        if (poly.outer) {
          const outer = poly.outer;
          const holes = poly.holes || [];

          // Draw outer ring
          this.ctx.moveTo(outer[0], outer[1]);
          for (let i = 2; i < outer.length; i += 2) {
            this.ctx.lineTo(outer[i], outer[i + 1]);
          }
          this.ctx.closePath();

          // Draw holes in reverse direction to cut them out
          for (const hole of holes) {
            this.ctx.moveTo(hole[hole.length - 2], hole[hole.length - 1]);
            for (let i = hole.length - 4; i >= 0; i -= 2) {
              this.ctx.lineTo(hole[i], hole[i + 1]);
            }
            this.ctx.closePath();
          }
        } else {
          this.ctx.moveTo(poly[0], poly[1]);
          for (let i = 2; i < poly.length; i += 2) {
            this.ctx.lineTo(poly[i], poly[i + 1]);
          }
          this.ctx.closePath();
        }
        this.ctx.fill("evenodd");
      }

      // Points (can still be batched — circles don't overlap problematically)
      if (batch.points.length > 0) {
        this.ctx.beginPath();
        for (let i = 0; i < batch.points.length; i += 2) {
          this.ctx.moveTo(batch.points[i] + 3, batch.points[i + 1]);
          this.ctx.arc(batch.points[i], batch.points[i + 1], 3, 0, Math.PI * 2);
        }
        this.ctx.fill("evenodd");
      }
    }

    // Flush pattern batches (areas with textured fills like scrub/wetland)
    // No pattern scaling — use native pattern size at all zoom levels
    const patternScale = 1.0;

    for (const [patternId, batch] of patternBatches) {
      const pattern = this.patternCache[patternId];
      if (!pattern) continue;

      // First fill with base color
      const baseColorStr = this._getRGBA(
        batch.baseColor.r,
        batch.baseColor.g,
        batch.baseColor.b,
        batch.baseColor.a / 255,
      );
      pattern.setTransform(
        new DOMMatrix().scaleSelf(patternScale, patternScale),
      );

      // Fill each polygon independently to avoid evenodd overlap artifacts
      for (const poly of batch.polygons) {
        const outer = poly.outer;
        const holes = poly.holes || [];

        // Base color fill
        this.ctx.fillStyle = baseColorStr;
        this.ctx.beginPath();
        this.ctx.moveTo(outer[0], outer[1]);
        for (let i = 2; i < outer.length; i += 2) {
          this.ctx.lineTo(outer[i], outer[i + 1]);
        }
        this.ctx.closePath();
        for (const hole of holes) {
          this.ctx.moveTo(hole[hole.length - 2], hole[hole.length - 1]);
          for (let i = hole.length - 4; i >= 0; i -= 2) {
            this.ctx.lineTo(hole[i], hole[i + 1]);
          }
          this.ctx.closePath();
        }
        this.ctx.fill("evenodd");

        // Pattern overlay
        this.ctx.fillStyle = pattern;
        this.ctx.beginPath();
        this.ctx.moveTo(outer[0], outer[1]);
        for (let i = 2; i < outer.length; i += 2) {
          this.ctx.lineTo(outer[i], outer[i + 1]);
        }
        this.ctx.closePath();
        for (const hole of holes) {
          this.ctx.moveTo(hole[hole.length - 2], hole[hole.length - 1]);
          for (let i = hole.length - 4; i >= 0; i -= 2) {
            this.ctx.lineTo(hole[i], hole[i + 1]);
          }
          this.ctx.closePath();
        }
        this.ctx.fill("evenodd");
      }
    }

    // Render building borders (after fills, before lines)
    for (const [key, batch] of strokeBatches) {
      this.ctx.strokeStyle = `rgba(${batch.color.r},${batch.color.g},${batch.color.b},${batch.color.a / 255})`;
      this.ctx.lineWidth = batch.width;
      this.ctx.beginPath();

      for (const poly of batch.polygons) {
        // Handle both old format (flat array) and new format (object with outer/holes)
        if (poly.outer) {
          // New format with holes support - stroke both outer and inner rings
          const outer = poly.outer;
          const holes = poly.holes || [];

          // Stroke outer ring
          this.ctx.moveTo(outer[0], outer[1]);
          for (let i = 2; i < outer.length; i += 2) {
            this.ctx.lineTo(outer[i], outer[i + 1]);
          }
          this.ctx.closePath();

          // Stroke holes
          for (const hole of holes) {
            this.ctx.moveTo(hole[0], hole[1]);
            for (let i = 2; i < hole.length; i += 2) {
              this.ctx.lineTo(hole[i], hole[i + 1]);
            }
            this.ctx.closePath();
          }
        } else {
          // Old format (backwards compatibility)
          this.ctx.moveTo(poly[0], poly[1]);
          for (let i = 2; i < poly.length; i += 2) {
            this.ctx.lineTo(poly[i], poly[i + 1]);
          }
          this.ctx.closePath();
        }
      }

      this.ctx.stroke();
    }

    // Flush line batches (one beginPath/stroke per color+width combo)
    // First pass: draw borders (for features that have them, like small waterways)
    for (const [key, batch] of lineBatches) {
      if (batch.borderWidth && batch.borderWidth > 0 && batch.borderColor) {
        this.ctx.strokeStyle = `rgba(${batch.borderColor.r},${batch.borderColor.g},${batch.borderColor.b},${batch.borderColor.a / 255})`;
        this.ctx.lineWidth = batch.width + batch.borderWidth * 2;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();

        for (const flat of batch.lines) {
          this.ctx.moveTo(flat[0], flat[1]);
          for (let i = 2; i < flat.length; i += 2) {
            this.ctx.lineTo(flat[i], flat[i + 1]);
          }
        }

        this.ctx.stroke();
      }
    }

    // Second pass: draw main lines
    for (const [key, batch] of lineBatches) {
      this.ctx.strokeStyle = `rgba(${batch.color.r},${batch.color.g},${batch.color.b},${batch.color.a / 255})`;
      this.ctx.lineWidth = batch.width;
      this.ctx.lineCap = batch.dashPattern ? "butt" : "round";
      this.ctx.lineJoin = "round";
      this.ctx.setLineDash(batch.dashPattern || []);
      this.ctx.beginPath();

      for (const flat of batch.lines) {
        this.ctx.moveTo(flat[0], flat[1]);
        for (let i = 2; i < flat.length; i += 2) {
          this.ctx.lineTo(flat[i], flat[i + 1]);
        }
      }

      this.ctx.stroke();
      if (batch.dashPattern) this.ctx.setLineDash([]);
    }

    // Render railways individually (they need special pattern rendering)
    for (const rw of railwayFeatures) {
      if (this.viewWidthMeters <= 4000) {
        // <4km: show detailed railway pattern
        this.drawRailwayPattern(rw.screenCoords, rw.color, rw.width);
      } else {
        this.ctx.strokeStyle = `rgba(${rw.color.r},${rw.color.g},${rw.color.b},${rw.color.a / 255})`;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(rw.screenCoords[0].x, rw.screenCoords[0].y);
        for (let i = 1; i < rw.screenCoords.length; i++) {
          this.ctx.lineTo(rw.screenCoords[i].x, rw.screenCoords[i].y);
        }
        this.ctx.stroke();
      }
    }

    // Flush POI glyphs
    if (this._poiRenderQueue.length > 0) {
      const displaySize = this.viewWidthMeters <= 300 ? 20 : 16;
      const halfSize = displaySize / 2;

      // Sort by category for GPU texture cache locality
      this._poiRenderQueue.sort((a, b) =>
        a.category < b.category ? -1 : a.category > b.category ? 1 : 0,
      );

      for (const poi of this._poiRenderQueue) {
        const glyph = this.glyphCache[poi.category];
        if (glyph) {
          this.ctx.drawImage(
            glyph.canvas,
            poi.x - halfSize,
            poi.y - halfSize,
            displaySize,
            displaySize,
          );
        }
      }
      this._poiRenderQueue.length = 0;
    }
  }

  renderLineString(coordinates, color, bounds, width = 1, isRailway = false) {
    if (coordinates.length < 2) return [];

    // Use Canvas2D for line rendering
    const screenCoords = [];

    // Convert coordinates to screen space first
    for (let i = 0; i < coordinates.length; i++) {
      const screen = this.latLonToScreen(
        coordinates[i][1],
        coordinates[i][0],
        bounds,
      );
      screenCoords.push(screen);
    }

    if (isRailway) {
      // Only show detailed railway pattern when zoomed in
      // At lower zoom levels, show simple solid line
      if (this.viewWidthMeters <= 4000) {
        // <4km: show detailed railway pattern
        // Draw railway pattern: two parallel rails with ties (sleepers)
        this.drawRailwayPattern(screenCoords, color, width);
      } else {
        // Draw simple solid line for railways at low zoom
        this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        this.ctx.lineWidth = 2; // Thinner at low zoom
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();

        for (let i = 0; i < screenCoords.length; i++) {
          if (i === 0) {
            this.ctx.moveTo(screenCoords[i].x, screenCoords[i].y);
          } else {
            this.ctx.lineTo(screenCoords[i].x, screenCoords[i].y);
          }
        }

        this.ctx.stroke();
      }
    } else {
      // Regular line rendering
      this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
      this.ctx.lineWidth = width;
      this.ctx.lineCap = "round"; // Smooth line ends
      this.ctx.lineJoin = "round"; // Smooth corners
      this.ctx.beginPath();

      for (let i = 0; i < screenCoords.length; i++) {
        if (i === 0) {
          this.ctx.moveTo(screenCoords[i].x, screenCoords[i].y);
        } else {
          this.ctx.lineTo(screenCoords[i].x, screenCoords[i].y);
        }
      }

      this.ctx.stroke();
    }

    return screenCoords;
  }

  drawRailwayPattern(screenCoords, color, width) {
    // Three-line railway pattern: two thin outline rails + dashed center line

    // Railway gauge calculations (hardcoded based on real measurements):
    // Standard gauge: 1.435m between rail centers
    // Narrow gauge (trams): ~1.0m between rail centers

    // Calculate rail separation based on view
    const metersPerPixel = this.viewWidthMeters / this.canvasWidth;
    const gaugeMeters = width === 6 ? 1.0 : 1.435; // Narrow gauge vs standard
    const railSeparationPx = Math.max(3, gaugeMeters / metersPerPixel);

    this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw two thin continuous outline rails (left and right)
    for (let railSide = -1; railSide <= 1; railSide += 2) {
      this.ctx.lineWidth = 1; // Thin rails
      this.ctx.setLineDash([]); // Solid lines
      this.ctx.beginPath();

      for (let i = 0; i < screenCoords.length; i++) {
        const coord = screenCoords[i];

        // Calculate perpendicular offset for rails
        let perpX = 0,
          perpY = 0;
        if (i < screenCoords.length - 1) {
          const next = screenCoords[i + 1];
          const dx = next.x - coord.x;
          const dy = next.y - coord.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            perpX = (-dy / len) * (railSeparationPx / 2) * railSide;
            perpY = (dx / len) * (railSeparationPx / 2) * railSide;
          }
        } else if (i > 0) {
          const prev = screenCoords[i - 1];
          const dx = coord.x - prev.x;
          const dy = coord.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            perpX = (-dy / len) * (railSeparationPx / 2) * railSide;
            perpY = (dx / len) * (railSeparationPx / 2) * railSide;
          }
        }

        const railX = coord.x + perpX;
        const railY = coord.y + perpY;

        if (i === 0) {
          this.ctx.moveTo(railX, railY);
        } else {
          this.ctx.lineTo(railX, railY);
        }
      }

      this.ctx.stroke();
    }

    // Draw dashed center fill line between the rails (scales with zoom)
    const dashLength = Math.max(1, this.getZoomFactor() * 0.045); // Small dashes
    const gapLength = dashLength; // Exactly 50:50 pattern

    // Fill line width should touch the outer rails
    this.ctx.lineWidth = railSeparationPx; // Full width to touch both outer rails
    this.ctx.lineCap = "butt"; // Square caps for dashes
    this.ctx.setLineDash([dashLength, gapLength]);
    this.ctx.beginPath();

    for (let i = 0; i < screenCoords.length; i++) {
      if (i === 0) {
        this.ctx.moveTo(screenCoords[i].x, screenCoords[i].y);
      } else {
        this.ctx.lineTo(screenCoords[i].x, screenCoords[i].y);
      }
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset to solid
  }

  renderPolygonOutline(coordinates, color, bounds) {
    // Render polygon as outline only (not filled)
    return this.renderLineString(coordinates, color, bounds);
  }

  renderPolygon(coordinates, color, bounds) {
    if (coordinates.length < 3) return [];

    // Use Canvas2D native fill - hardware accelerated
    const screenCoords = [];

    this.ctx.fillStyle = this._getRGBA(
      color.r,
      color.g,
      color.b,
      color.a / 255,
    );
    this.ctx.beginPath();

    for (let i = 0; i < coordinates.length; i++) {
      const screen = this.latLonToScreen(
        coordinates[i][1],
        coordinates[i][0],
        bounds,
      );
      screenCoords.push(screen);

      if (i === 0) {
        this.ctx.moveTo(screen.x, screen.y);
      } else {
        this.ctx.lineTo(screen.x, screen.y);
      }
    }

    this.ctx.closePath();
    this.ctx.fill();

    return screenCoords;
  }

  clearCanvas() {
    // Clear canvas using Canvas2D
    this.ctx.fillStyle = "rgb(170, 211, 223)"; // Water blue (ocean default)
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Cleared";
  }

  resetView() {
    this.viewWidthMeters = 10000; // Reset to initial 10km view
    this.offsetX = 0;
    this.offsetY = 0;
    this.updateZoomSlider();
    this.renderMap();
    this.updateStats();
  }

  toggleHoverInfo() {
    this.hoverInfoEnabled = !this.hoverInfoEnabled;
    this.updateHoverUI();
  }

  toggleTileEdges() {
    this.showTileEdges = !this.showTileEdges;
    this.updateTileEdgesUI();
    this.renderMap(); // Re-render to show/hide tile edges
  }

  updateTileEdgesUI() {
    const btn = document.getElementById("toggleTileEdgesBtn");
    if (!btn) return;

    if (this.showTileEdges) {
      btn.textContent = "Tile Edges: ON";
      btn.classList.remove("inactive");
    } else {
      btn.textContent = "Tile Edges: OFF";
      btn.classList.add("inactive");
    }
  }

  drawTileEdges(bounds) {
    const visibleTiles = this.getVisibleTiles(bounds);
    if (!visibleTiles || visibleTiles.length === 0) return;

    this.ctx.save();

    // Use the same coordinate transformation as the rest of the renderer
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;

    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    // Draw each tile boundary with white line wrapped in two black lines
    for (const { tileset, x, y } of visibleTiles) {
      const tileBounds = this.getTileBounds(tileset, x, y);

      const left = toScreenX(tileBounds.minLon);
      const right = toScreenX(tileBounds.maxLon);
      const top = toScreenY(tileBounds.maxLat);
      const bottom = toScreenY(tileBounds.minLat);

      // Draw outer black border (3px wide)
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      this.ctx.strokeRect(left, top, right - left, bottom - top);

      // Draw inner white border (1px wide)
      this.ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(left, top, right - left, bottom - top);

      // Draw tile label in top-left corner with white text and black outline
      this.ctx.save();
      const labelText = `${tileset} (${x},${y})`;
      this.ctx.font = "bold 14px monospace";
      this.ctx.textAlign = "left";
      const labelX = left + 5;
      const labelY = top + 18;

      // Draw black outline
      this.ctx.strokeStyle = "black";
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(labelText, labelX, labelY);

      // Draw white text
      this.ctx.fillStyle = "white";
      this.ctx.fillText(labelText, labelX, labelY);
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  initPOIToggles() {
    const container = document.getElementById("poiToggles");
    if (!container) return;
    for (const [catId, catDef] of Object.entries(POI_CATEGORIES)) {
      const btn = document.createElement("button");
      btn.className = "button-toggle poi-toggle";
      btn.dataset.category = catId;
      btn.innerHTML = `<span class="poi-swatch" style="background:rgb(${catDef.color.r},${catDef.color.g},${catDef.color.b})"></span>${catDef.label}`;
      btn.addEventListener("click", () => this.togglePOICategory(catId));
      container.appendChild(btn);
    }
  }

  togglePOICategory(catId) {
    this.poiCategoryState[catId] = !this.poiCategoryState[catId];
    const btn = document.querySelector(`.poi-toggle[data-category="${catId}"]`);
    if (btn) {
      if (this.poiCategoryState[catId]) {
        btn.classList.remove("inactive");
      } else {
        btn.classList.add("inactive");
      }
    }
    this.renderMap();
  }

  updateHoverUI() {
    const btn = document.getElementById("toggleHoverBtn");
    const panel = document.getElementById("infoPanel");

    if (this.hoverInfoEnabled) {
      btn.textContent = "Hover Info: ON";
      btn.classList.remove("inactive");
      if (panel) panel.style.display = "";
    } else {
      btn.textContent = "Hover Info: OFF";
      btn.classList.add("inactive");
      if (panel) panel.style.display = "none";

      // Clear any current hover state
      if (this.hoveredFeature && !this.selectedFeature) {
        this.hoveredFeature = null;
        this.renderMap();
      }
    }
  }

  updateStats() {
    const viewStr =
      this.viewWidthMeters >= 1000
        ? `${(this.viewWidthMeters / 1000).toFixed(1)}km`
        : `${this.viewWidthMeters.toFixed(0)}m`;
    document.getElementById("zoomLevel").textContent = viewStr + " wide";
  }

  exportAsPNG() {
    const dataURL = this.canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "hamburg-map.png";
    link.href = dataURL;
    link.click();
  }
}

// Initialize the application
let renderer;

async function initApp() {
  renderer = new MapRenderer();

  const canvasReady = await renderer.init();
  if (!canvasReady) {
    document.getElementById("loading").innerHTML =
      '<div style="color: red;">Failed to initialize canvas</div>';
    return;
  }

  const dataLoaded = await renderer.loadMapData();
  if (!dataLoaded) {
    document.getElementById("loading").innerHTML =
      '<div style="color: red;">Failed to load map data</div>';
    return;
  }

  // Hide loading, show map
  document.getElementById("loading").style.display = "none";
  document.getElementById("mapContainer").style.display = "block";

  // Set up event listeners
  document.getElementById("renderBtn").addEventListener("click", () => {
    renderer.renderMap();
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    renderer.clearCanvas();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    renderer.resetView();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    renderer.exportAsPNG();
  });

  document.getElementById("zoomInBtn").addEventListener("click", () => {
    renderer.zoomIn();
  });

  document.getElementById("zoomOutBtn").addEventListener("click", () => {
    renderer.zoomOut();
  });

  document.getElementById("zoomSlider").addEventListener("input", (e) => {
    // Slider value is inverted log scale
    const logMin = Math.log2(renderer.minViewWidthMeters);
    const logMax = Math.log2(renderer.maxViewWidthMeters);
    const sliderValue = parseFloat(e.target.value);
    const logViewWidth = logMax + logMin - sliderValue;
    renderer.setViewWidth(Math.pow(2, logViewWidth));
  });

  document.getElementById("toggleHoverBtn").addEventListener("click", () => {
    renderer.toggleHoverInfo();
  });

  document
    .getElementById("toggleTileEdgesBtn")
    .addEventListener("click", () => {
      renderer.toggleTileEdges();
    });

  // Set initial UI state
  renderer.updateHoverUI();
  renderer.updateTileEdgesUI();

  // Auto-render on load
  renderer.renderMap();
  renderer.updateStats();
}

// Start the app when page loads
window.addEventListener("DOMContentLoaded", initApp);
