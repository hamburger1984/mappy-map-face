// Map Theme System
// Centralized color definitions for map rendering
// This allows easy switching between different themes (light/dark, transport-focused, etc.)

export const THEMES = {
  default: {
    name: "Default Light",
    description: "Standard OpenStreetMap-style colors",

    // Background colors
    background: {
      ocean: { r: 170, g: 211, b: 223, a: 255 }, // Water blue (default background)
      land: { r: 242, g: 239, b: 233, a: 255 }, // Light tan/beige for land
      coastline: { r: 220, g: 235, b: 240, a: 255 }, // Very light ocean/water variant
    },

    // Water features
    water: {
      area: { r: 170, g: 211, b: 223, a: 255 }, // Lakes, ponds, riverbanks
      ocean: { r: 150, g: 195, b: 215, a: 255 }, // Ocean — slightly darker than inland water
      line: { r: 170, g: 211, b: 223, a: 255 }, // Rivers, streams, canals
      border: { r: 140, g: 180, b: 195, a: 255 }, // Border for small waterways
    },

    // Natural areas - green spaces
    natural: {
      forest: { r: 173, g: 209, b: 158, a: 255 }, // Dark green for forests
      park: { r: 200, g: 230, b: 180, a: 255 }, // Light green for parks
      grass: { r: 205, g: 235, b: 185, a: 255 }, // Slightly lighter green for grass
      meadow: { r: 200, g: 230, b: 180, a: 255 }, // Light green for meadows
      scrub: { r: 200, g: 215, b: 175, a: 255 }, // Yellowish-green for scrubland
      wetland: { r: 180, g: 210, b: 185, a: 255 }, // Pale blue-green for wetlands (patternOnly)
      wetlandMarsh: { r: 155, g: 195, b: 200, a: 255 }, // Blue-green for marsh/bog/fen
      beach: { r: 245, g: 230, b: 200, a: 255 }, // Sandy beige for beaches
      cliff: { r: 140, g: 120, b: 100, a: 255 }, // Brown-gray for cliffs
    },

    // Agricultural areas
    agriculture: {
      farmland: { r: 238, g: 240, b: 213, a: 255 }, // Beige for farmland
      orchard: { r: 210, g: 230, b: 200, a: 255 }, // Light greenish for orchards
      vineyard: { r: 220, g: 235, b: 200, a: 255 }, // Pale green for vineyards
      flowerbed: { r: 240, g: 220, b: 230, a: 255 }, // Pinkish for flowerbeds
      allotments: { r: 220, g: 235, b: 210, a: 255 }, // Light green for allotments
    },

    // Developed land use
    landuse: {
      residential: { r: 224, g: 224, b: 224, a: 255 }, // Light gray
      commercial: { r: 243, g: 233, b: 234, a: 255 }, // Very subtle pink/rose
      retail: { r: 243, g: 233, b: 234, a: 255 }, // Same as commercial
      industrial: { r: 240, g: 233, b: 240, a: 255 }, // Very subtle purple
      institutional: { r: 230, g: 220, b: 225, a: 255 }, // Light pink-gray
      construction: { r: 235, g: 220, b: 200, a: 255 }, // Orange-brown tint
      military: { r: 235, g: 215, b: 215, a: 255 }, // Light red-brown
      port: { r: 215, g: 210, b: 220, a: 255 }, // Light blue-gray
      militaryHatchFill:   { r: 220, g: 180, b: 180, a:  51 }, // Pink tint at 0.2 opacity
      militaryHatchStroke: { r: 180, g: 100, b: 100, a:  89 }, // Darker red at 0.35 opacity
      // Prominent variants — used when zoomed out (view ≤ 50km, buildings hidden)
      residentialProminent:   { r: 207, g: 201, b: 201, a: 255 }, // Softened warm gray
      commercialProminent:    { r: 226, g: 192, b: 193, a: 255 }, // Softened salmon-pink
      industrialProminent:    { r: 204, g: 198, b: 219, a: 255 }, // Softened blue-purple
      retailProminent:        { r: 229, g: 192, b: 196, a: 255 }, // Softened pink
      institutionalProminent: { r: 215, g: 205, b: 213, a: 255 }, // Softened purple-gray
    },

    // Special purpose areas
    specialPurpose: {
      education: { r: 245, g: 235, b: 210, a: 255 }, // Yellow-tan
      religious: { r: 225, g: 220, b: 230, a: 255 }, // Light purple
      cemetery: { r: 205, g: 220, b: 200, a: 255 }, // Subtle green-gray
      railway: { r: 210, g: 205, b: 210, a: 255 }, // Light purple-gray
      quarry: { r: 210, g: 200, b: 190, a: 255 }, // Gray-brown
      recreation: { r: 218, g: 238, b: 205, a: 255 }, // Very subtle green
      camping: { r: 223, g: 250, b: 188, a: 255 }, // Light lime-green for camp sites
      services: { r: 220, g: 230, b: 240, a: 255 }, // Light blue for rest areas/services
    },

    // Recreation facilities
    recreation: {
      playground: { r: 218, g: 238, b: 205, a: 255 }, // Light green base
      swimmingPool: { r: 180, g: 220, b: 240, a: 255 }, // Light blue
      beachVolleyball: { r: 245, g: 230, b: 200, a: 255 }, // Sandy beige
      tableTennis: { r: 200, g: 220, b: 200, a: 255 }, // Light greenish
      picnicSite: { r: 210, g: 225, b: 195, a: 255 }, // Light green
      pitch: { r: 180, g: 225, b: 200, a: 255 }, // Teal-green for generic pitches
      pitchTennis: { r: 185, g: 220, b: 195, a: 255 }, // Clay/grass green
      pitchBall: { r: 175, g: 230, b: 185, a: 255 }, // Grass green for soccer/hockey
      pitchHard: { r: 210, g: 210, b: 225, a: 255 }, // Gray-blue for hard courts (basketball, skate)
      sportsFacility: { r: 200, g: 230, b: 210, a: 255 }, // Light green for sports centres/halls
      miniatureGolf: { r: 195, g: 235, b: 195, a: 255 }, // Light putting-green
    },

    // Buildings
    buildings: {
      default: { r: 218, g: 208, b: 200, a: 255 }, // Default beige
      commercial: { r: 238, g: 210, b: 210, a: 255 }, // Light red/pink
      industrial: { r: 215, g: 205, b: 220, a: 255 }, // Light purple
      public: { r: 210, g: 220, b: 235, a: 255 }, // Light blue
      religious: { r: 205, g: 190, b: 175, a: 255 }, // Darker tan
      education: { r: 235, g: 225, b: 200, a: 255 }, // Light yellow-tan
      border: { r: 160, g: 140, b: 120, a: 255 }, // Brown border
    },

    // Roads
    roads: {
      motorway: { r: 233, g: 115, b: 103, a: 255 }, // Red-orange
      trunk: { r: 233, g: 115, b: 103, a: 255 }, // Red-orange (same as motorway)
      primary: { r: 249, g: 207, b: 144, a: 255 }, // OSM primary yellow
      secondary: { r: 248, g: 234, b: 164, a: 255 }, // OSM secondary light yellow
      tertiary: { r: 255, g: 255, b: 255, a: 255 }, // White
      residential: { r: 255, g: 255, b: 255, a: 255 }, // White
      service: { r: 255, g: 255, b: 255, a: 255 }, // White
      track: { r: 185, g: 175, b: 155, a: 255 }, // Earthy tan for farm/garden tracks
      smallRoads: { r: 220, g: 220, b: 220, a: 255 }, // Light gray
      footway: { r: 250, g: 190, b: 165, a: 255 }, // Salmon/pink
      cycleway: { r: 120, g: 150, b: 255, a: 255 }, // Blue
      construction:     { r: 200, g: 60, b: 60, a: 255 }, // Red for construction pattern
      constructionFill: { r: 200, g: 60, b: 60, a: 204 }, // Red at 0.8 opacity for solid base
      casing:           { r: 255, g: 255, b: 255, a: 255 }, // White casing for tracks/paths
    },

    // Railways
    railways: {
      rail:         { r: 153, g: 153, b: 153, a: 255 }, // Gray
      construction: { r: 180, g: 120, b: 120, a: 255 }, // Planned/construction line tint
      sleeperLight: { r: 225, g: 225, b: 225, a: 255 }, // Very light gray for gap fill
      sleeperDark:  { r: 120, g: 120, b: 120, a: 255 }, // Mid gray for sleeper dashes
    },

    // Boundaries and special lines
    boundaries: {
      country: { r: 128, g: 0, b: 128, a: 255 }, // Purple for country borders
      state: { r: 160, g: 80, b: 160, a: 255 }, // Lighter purple for state borders
      district: { r: 180, g: 120, b: 180, a: 200 }, // Faint purple for district borders
      maritime: { r: 100, g: 140, b: 180, a: 150 }, // Blue-gray for territorial waters
      eez: { r: 100, g: 140, b: 180, a: 120 }, // Fainter blue-gray for EEZ
      coastline: { r: 255, g: 0, b: 255, a: 255 }, // Magenta for coastline (debug)
      coastlineBorder: { r: 0, g: 150, b: 255, a: 255 }, // Blue for coastline border
    },

    // Text and labels
    text: {
      places: { r: 0, g: 0, b: 0, a: 255 }, // Black for place names
      water: { r: 60, g: 120, b: 180, a: 255 }, // Blue for water labels
      roads: { r: 0, g: 0, b: 0, a: 255 }, // Black for street names
      buildings: { r: 40, g: 40, b: 40, a: 255 }, // Dark gray for house numbers
      outline: { r: 255, g: 255, b: 255, a: 255 }, // White outline for readability
    },

    // Highlighting
    highlight: {
      hovered: { r: 255, g: 255, b: 0, a: 153 }, // Yellow (60% opacity)
      selected: { r: 255, g: 140, b: 0, a: 204 }, // Orange (80% opacity)
      hoveredFill: { r: 255, g: 255, b: 0, a: 51 }, // Yellow (20% opacity)
      selectedFill: { r: 255, g: 140, b: 0, a: 38 }, // Orange (15% opacity)
    },

    // POI categories (Points of Interest)
    poi: {
      foodDrink: { r: 231, g: 76, b: 60, a: 255 }, // Red
      shopping: { r: 155, g: 89, b: 182, a: 255 }, // Purple
      health: { r: 46, g: 204, b: 113, a: 255 }, // Green
      tourism: { r: 230, g: 126, b: 34, a: 255 }, // Orange
      historic: { r: 139, g: 69, b: 19, a: 255 }, // Brown
      services: { r: 52, g: 152, b: 219, a: 255 }, // Blue
      transport: { r: 26, g: 188, b: 156, a: 255 }, // Teal
      education: { r: 243, g: 156, b: 18, a: 255 }, // Orange
      nightlife: { r: 233, g: 30, b: 144, a: 255 }, // Pink
      toilets: { r: 76, g: 187, b: 203, a: 255 }, // Cyan-teal
      swimming: { r: 41, g: 182, b: 246, a: 255 }, // Water blue
      fitness: { r: 230, g: 70, b: 45, a: 255 }, // Bold red-orange (energetic)
      theatre: { r: 170, g: 50, b: 190, a: 255 }, // Purple
      cinema: { r: 200, g: 40, b: 40, a: 255 }, // Red
      police: { r: 30, g: 100, b: 210, a: 255 }, // Blue
      bank: { r: 40, g: 140, b: 80, a: 255 }, // Green
      library:        { r: 120, g: 80, b: 40, a: 255 }, // Warm brown
      glyphHighlight: { r: 255, g: 255, b: 255, a: 128 }, // White at 0.5 for glyph details
    },

    // Aeroway features
    aeroway: {
      runway:            { r:  80, g:  80, b:  80, a: 255 },
      taxiway:           { r: 120, g: 120, b: 120, a: 255 },
      apron:             { r: 160, g: 160, b: 160, a: 255 },
      helipad:           { r: 100, g: 100, b: 100, a: 255 },
      taxiwayBorder:     { r: 255, g: 255, b: 255, a: 102 }, // White at 0.4 opacity
      taxiwayCenterline: { r: 255, g: 255, b: 200, a:  60 }, // Yellow-white at 0.24
      runwayEdge:        { r: 255, g: 255, b: 255, a: 153 }, // White at 0.6 opacity
      runwayCenterline:  { r: 255, g: 255, b: 255, a: 204 }, // White at 0.8 opacity
      runwayLabel:       { r: 255, g: 255, b: 255, a: 230 }, // White at 0.9 opacity
      runwayLight:       { r: 255, g: 255, b: 200, a: 179 }, // Yellow-white at 0.7
    },

    // Railway platforms
    platforms: {
      fill:   { r: 160, g: 160, b: 160, a: 255 },
      stroke: { r: 120, g: 120, b: 120, a: 255 },
      line:   { r: 140, g: 140, b: 140, a: 255 },
    },

    // Dash patterns for dashed lines (resolved by getDashPattern)
    dashPatterns: {
      track:          [4, 4],
      footway:        [4, 4],
      cycleway:       [4, 4],
      construction:   [7, 7],
      countryBorder:  [8, 4],
      stateBorder:    [6, 4],
      districtBorder: [4, 4],
      maritime:       [6, 6],
      eez:            [8, 8],
    },

    // Pattern colors (for textures)
    patterns: {
      scrubBush: { r: 120, g: 150, b: 90, a: 76 }, // Dark green, semi-transparent
      scrubStem: { r: 100, g: 130, b: 70, a: 102 }, // Darker green
      wetlandWater: { r: 100, g: 150, b: 180, a: 120 }, // Light blue
      wetlandGrass: { r: 80, g: 120, b: 90, a: 140 }, // Green
      broadleafForest: { r: 100, g: 140, b: 80, a: 89 }, // Medium green
      needleleafForest: { r: 60, g: 100, b: 60, a: 102 }, // Darker green
      needleleafTrunk: { r: 80, g: 60, b: 40, a: 76 }, // Brown
      mixedForestLeaf: { r: 90, g: 130, b: 70, a: 89 }, // Green
      mixedForestNeedle: { r: 60, g: 100, b: 60, a: 89 }, // Darker green
      playgroundRed: { r: 255, g: 100, b: 100, a: 102 }, // Red
      playgroundBlue: { r: 100, g: 150, b: 255, a: 102 }, // Blue
      playgroundOrange: { r: 255, g: 200, b: 100, a: 102 }, // Orange
      playgroundPurple: { r: 150, g: 100, b: 255, a: 102 }, // Purple
      playgroundSwing: { r: 100, g: 80, b: 60, a: 89 }, // Brown
      playgroundSwingSeat: { r: 200, g: 180, b: 100, a: 89 }, // Tan
      swimmingPoolWave: { r: 100, g: 180, b: 220, a: 76 }, // Light blue
      swimmingPoolTile: { r: 150, g: 200, b: 230, a: 64 }, // Very light blue
      beachSand: { r: 220, g: 200, b: 160, a: 76 }, // Sandy
      beachSandLarge: { r: 200, g: 180, b: 140, a: 64 }, // Darker sand
      beachVolleyballSand: { r: 230, g: 210, b: 170, a: 64 }, // Light sand
      beachVolleyballNet: { r: 80, g: 70, b: 60, a: 102 }, // Dark brown
      beachVolleyballMesh: { r: 100, g: 90, b: 80, a: 64 }, // Brown
      picnicWood: { r: 140, g: 100, b: 70, a: 89 }, // Brown
      picnicWoodStroke: { r: 120, g: 80, b: 50, a: 102 }, // Darker brown
      tableTennisTable: { r: 30, g: 100, b: 60, a: 127 }, // Dark green
      tableTennisTableStroke: { r: 20, g: 80, b: 40, a: 153 }, // Darker green
      tableTennisNet: { r: 100, g: 100, b: 100, a: 140 }, // Gray
      tableTennisNetMesh: { r: 120, g: 120, b: 120, a: 76 }, // Light gray
      tableTennisPaddle: { r: 200, g: 100, b: 80, a: 102 }, // Red/orange
      tableTennisPaddleStroke: { r: 180, g: 80, b: 60, a: 115 }, // Darker orange
    },
  },

  dark: {
    name: "Dark",
    description: "Dark map theme for low-light environments",

    background: {
      ocean: { r: 15, g: 28, b: 48, a: 255 },
      land: { r: 30, g: 30, b: 30, a: 255 },
      coastline: { r: 20, g: 35, b: 55, a: 255 },
    },

    water: {
      area: { r: 20, g: 42, b: 72, a: 255 },
      ocean: { r: 15, g: 28, b: 48, a: 255 },
      line: { r: 20, g: 42, b: 72, a: 255 },
      border: { r: 30, g: 55, b: 85, a: 255 },
    },

    natural: {
      forest: { r: 20, g: 45, b: 25, a: 255 },
      park: { r: 25, g: 55, b: 30, a: 255 },
      grass: { r: 28, g: 58, b: 32, a: 255 },
      meadow: { r: 25, g: 55, b: 30, a: 255 },
      scrub: { r: 30, g: 50, b: 28, a: 255 },
      wetland: { r: 22, g: 48, b: 38, a: 255 },
      wetlandMarsh: { r: 20, g: 55, b: 65, a: 255 }, // Dark blue-green for marsh/bog/fen
      beach: { r: 60, g: 55, b: 40, a: 255 },
      cliff: { r: 55, g: 48, b: 42, a: 255 },
    },

    agriculture: {
      farmland: { r: 45, g: 48, b: 35, a: 255 },
      orchard: { r: 30, g: 52, b: 30, a: 255 },
      vineyard: { r: 35, g: 52, b: 30, a: 255 },
      flowerbed: { r: 55, g: 38, b: 45, a: 255 },
      allotments: { r: 35, g: 50, b: 32, a: 255 },
    },

    landuse: {
      residential: { r: 45, g: 45, b: 45, a: 255 },
      commercial: { r: 55, g: 40, b: 40, a: 255 },
      retail: { r: 55, g: 40, b: 40, a: 255 },
      industrial: { r: 40, g: 40, b: 55, a: 255 },
      institutional: { r: 50, g: 42, b: 52, a: 255 },
      construction: { r: 55, g: 48, b: 35, a: 255 },
      military: { r: 55, g: 38, b: 38, a: 255 },
      port: { r: 40, g: 42, b: 55, a: 255 },
      militaryHatchFill:   { r: 120, g: 60, b: 60, a:  51 },
      militaryHatchStroke: { r: 140, g: 60, b: 60, a:  89 },
      // Prominent variants — used when zoomed out (view ≤ 50km, buildings hidden)
      residentialProminent:   { r: 54, g: 51, b: 51, a: 255 },
      commercialProminent:    { r: 67, g: 45, b: 45, a: 255 },
      industrialProminent:    { r: 46, g: 45, b: 67, a: 255 },
      retailProminent:        { r: 69, g: 45, b: 47, a: 255 },
      institutionalProminent: { r: 59, g: 48, b: 62, a: 255 },
    },

    specialPurpose: {
      education: { r: 52, g: 50, b: 35, a: 255 },
      religious: { r: 48, g: 42, b: 55, a: 255 },
      cemetery: { r: 35, g: 48, b: 35, a: 255 },
      railway: { r: 45, g: 42, b: 48, a: 255 },
      quarry: { r: 48, g: 44, b: 40, a: 255 },
      recreation: { r: 30, g: 55, b: 35, a: 255 },
      camping: { r: 32, g: 62, b: 28, a: 255 }, // Dark lime-green for camp sites
      services: { r: 38, g: 42, b: 55, a: 255 },
    },

    recreation: {
      playground: { r: 30, g: 55, b: 35, a: 255 },
      swimmingPool: { r: 20, g: 50, b: 70, a: 255 },
      beachVolleyball: { r: 60, g: 55, b: 40, a: 255 },
      tableTennis: { r: 30, g: 52, b: 35, a: 255 },
      picnicSite: { r: 32, g: 52, b: 30, a: 255 },
      pitch: { r: 25, g: 55, b: 40, a: 255 },
      pitchTennis: { r: 28, g: 52, b: 38, a: 255 },
      pitchBall: { r: 22, g: 58, b: 35, a: 255 },
      pitchHard: { r: 42, g: 42, b: 58, a: 255 },
      sportsFacility: { r: 28, g: 55, b: 40, a: 255 },
      miniatureGolf: { r: 25, g: 55, b: 30, a: 255 },
    },

    buildings: {
      default: { r: 55, g: 50, b: 45, a: 255 },
      commercial: { r: 65, g: 45, b: 45, a: 255 },
      industrial: { r: 48, g: 45, b: 62, a: 255 },
      public: { r: 42, g: 48, b: 65, a: 255 },
      religious: { r: 58, g: 48, b: 40, a: 255 },
      education: { r: 62, g: 55, b: 40, a: 255 },
      border: { r: 70, g: 65, b: 60, a: 255 },
    },

    roads: {
      motorway: { r: 180, g: 80, b: 60, a: 255 },
      trunk: { r: 180, g: 80, b: 60, a: 255 },
      primary: { r: 170, g: 135, b: 55, a: 255 },
      secondary: { r: 145, g: 130, b: 55, a: 255 },
      tertiary: { r: 80, g: 80, b: 80, a: 255 },
      residential: { r: 78, g: 78, b: 78, a: 255 },
      service: { r: 75, g: 75, b: 75, a: 255 },
      track: { r: 70, g: 65, b: 55, a: 255 },
      smallRoads: { r: 72, g: 72, b: 72, a: 255 },
      footway: { r: 130, g: 80, b: 65, a: 255 },
      cycleway: { r: 50, g: 80, b: 160, a: 255 },
      construction:     { r: 160, g: 50, b: 50, a: 255 },
      constructionFill: { r: 160, g: 50, b: 50, a: 204 },
      casing:           { r: 20, g: 20, b: 20, a: 255 },
    },

    railways: {
      rail:         { r: 100, g: 100, b: 100, a: 255 },
      construction: { r: 110, g: 70, b: 70, a: 255 },
      sleeperLight: { r: 80, g: 80, b: 80, a: 255 },
      sleeperDark:  { r: 55, g: 55, b: 55, a: 255 },
    },

    boundaries: {
      country: { r: 180, g: 80, b: 180, a: 255 },
      state: { r: 160, g: 100, b: 160, a: 255 },
      district: { r: 140, g: 100, b: 140, a: 200 },
      maritime: { r: 80, g: 110, b: 150, a: 150 },
      eez: { r: 80, g: 110, b: 150, a: 120 },
      coastline: { r: 255, g: 0, b: 255, a: 255 },
      coastlineBorder: { r: 0, g: 150, b: 255, a: 255 },
    },

    text: {
      places: { r: 220, g: 220, b: 220, a: 255 },
      water: { r: 80, g: 150, b: 210, a: 255 },
      roads: { r: 200, g: 200, b: 200, a: 255 },
      buildings: { r: 180, g: 180, b: 180, a: 255 },
      outline: { r: 0, g: 0, b: 0, a: 255 },
    },

    highlight: {
      hovered: { r: 255, g: 255, b: 0, a: 153 },
      selected: { r: 255, g: 140, b: 0, a: 204 },
      hoveredFill: { r: 255, g: 255, b: 0, a: 51 },
      selectedFill: { r: 255, g: 140, b: 0, a: 38 },
    },

    poi: {
      foodDrink: { r: 231, g: 76, b: 60, a: 255 },
      shopping: { r: 155, g: 89, b: 182, a: 255 },
      health: { r: 46, g: 204, b: 113, a: 255 },
      tourism: { r: 230, g: 126, b: 34, a: 255 },
      historic: { r: 180, g: 110, b: 50, a: 255 },
      services: { r: 52, g: 152, b: 219, a: 255 },
      transport: { r: 26, g: 188, b: 156, a: 255 },
      education: { r: 243, g: 156, b: 18, a: 255 },
      nightlife: { r: 233, g: 30, b: 144, a: 255 },
      toilets: { r: 76, g: 187, b: 203, a: 255 },
      swimming: { r: 41, g: 182, b: 246, a: 255 },
      fitness: { r: 230, g: 70, b: 45, a: 255 },
      theatre: { r: 170, g: 50, b: 190, a: 255 },
      cinema: { r: 200, g: 40, b: 40, a: 255 },
      police: { r: 30, g: 100, b: 210, a: 255 },
      bank: { r: 40, g: 140, b: 80, a: 255 },
      library:        { r: 160, g: 120, b: 70, a: 255 },
      glyphHighlight: { r: 255, g: 255, b: 255, a: 128 },
    },

    aeroway: {
      runway:            { r:  80, g:  80, b:  80, a: 255 },
      taxiway:           { r: 120, g: 120, b: 120, a: 255 },
      apron:             { r: 160, g: 160, b: 160, a: 255 },
      helipad:           { r: 100, g: 100, b: 100, a: 255 },
      taxiwayBorder:     { r: 255, g: 255, b: 255, a: 102 },
      taxiwayCenterline: { r: 255, g: 255, b: 200, a: 128 },
      runwayEdge:        { r: 255, g: 255, b: 255, a: 153 },
      runwayCenterline:  { r: 255, g: 255, b: 255, a: 204 },
      runwayLabel:       { r: 255, g: 255, b: 255, a: 230 },
      runwayLight:       { r: 255, g: 255, b: 200, a: 179 },
    },

    platforms: {
      fill:   { r: 100, g: 100, b: 100, a: 255 },
      stroke: { r: 75, g: 75, b: 75, a: 255 },
      line:   { r: 88, g: 88, b: 88, a: 255 },
    },

    dashPatterns: {
      track:          [4, 4],
      footway:        [4, 4],
      cycleway:       [4, 4],
      construction:   [7, 7],
      countryBorder:  [8, 4],
      stateBorder:    [6, 4],
      districtBorder: [4, 4],
      maritime:       [6, 6],
      eez:            [8, 8],
    },

    patterns: {
      scrubBush: { r: 60, g: 90, b: 45, a: 76 },
      scrubStem: { r: 45, g: 75, b: 35, a: 102 },
      wetlandWater: { r: 30, g: 65, b: 90, a: 120 },
      wetlandGrass: { r: 25, g: 65, b: 40, a: 140 },
      broadleafForest: { r: 30, g: 65, b: 25, a: 89 },
      needleleafForest: { r: 20, g: 55, b: 20, a: 102 },
      needleleafTrunk: { r: 55, g: 40, b: 25, a: 76 },
      mixedForestLeaf: { r: 25, g: 60, b: 20, a: 89 },
      mixedForestNeedle: { r: 18, g: 50, b: 18, a: 89 },
      playgroundRed: { r: 180, g: 60, b: 60, a: 102 },
      playgroundBlue: { r: 50, g: 90, b: 180, a: 102 },
      playgroundOrange: { r: 180, g: 130, b: 50, a: 102 },
      playgroundPurple: { r: 100, g: 60, b: 180, a: 102 },
      playgroundSwing: { r: 80, g: 60, b: 40, a: 89 },
      playgroundSwingSeat: { r: 140, g: 120, b: 70, a: 89 },
      swimmingPoolWave: { r: 30, g: 90, b: 130, a: 76 },
      swimmingPoolTile: { r: 40, g: 100, b: 140, a: 64 },
      beachSand: { r: 100, g: 88, b: 62, a: 76 },
      beachSandLarge: { r: 88, g: 76, b: 52, a: 64 },
      beachVolleyballSand: { r: 110, g: 96, b: 68, a: 64 },
      beachVolleyballNet: { r: 60, g: 52, b: 44, a: 102 },
      beachVolleyballMesh: { r: 70, g: 62, b: 54, a: 64 },
      picnicWood: { r: 90, g: 65, b: 42, a: 89 },
      picnicWoodStroke: { r: 75, g: 50, b: 30, a: 102 },
      tableTennisTable: { r: 20, g: 70, b: 40, a: 127 },
      tableTennisTableStroke: { r: 15, g: 55, b: 28, a: 153 },
      tableTennisNet: { r: 80, g: 80, b: 80, a: 140 },
      tableTennisNetMesh: { r: 95, g: 95, b: 95, a: 76 },
      tableTennisPaddle: { r: 150, g: 70, b: 55, a: 102 },
      tableTennisPaddleStroke: { r: 130, g: 55, b: 40, a: 115 },
    },
  },

  // Future themes can be added here:
  // publicTransport: { ... },
  // cycling: { ... },
  // hiking: { ... },
  // driving: { ... },
};

// Default active theme
export let activeTheme = THEMES.default;

// Function to switch themes
export function setTheme(themeName) {
  if (THEMES[themeName]) {
    activeTheme = THEMES[themeName];
    return true;
  }
  console.warn(`Theme "${themeName}" not found, using default`);
  return false;
}

// Helper function to get a color from the active theme
export function getColor(category, subcategory = null) {
  if (subcategory) {
    return (
      activeTheme[category]?.[subcategory] || { r: 255, g: 0, b: 255, a: 255 }
    ); // Magenta fallback
  }
  return activeTheme[category] || { r: 255, g: 0, b: 255, a: 255 }; // Magenta fallback
}

// Helper to convert color object to rgba string
export function toRGBA(color) {
  return `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
}

// Helper to convert color object to rgb string (ignoring alpha)
export function toRGB(color) {
  return `rgb(${color.r},${color.g},${color.b})`;
}

// Resolve "category.subcategory" theme key to a color object
export function getColorByKey(themeKey) {
  if (!themeKey) return { r: 255, g: 0, b: 255, a: 255 };
  const dot = themeKey.indexOf(".");
  if (dot === -1) return getColor(themeKey);
  return getColor(themeKey.slice(0, dot), themeKey.slice(dot + 1));
}

// Look up dash pattern array from the active theme
export function getDashPattern(key) {
  return activeTheme.dashPatterns?.[key] ?? null;
}
