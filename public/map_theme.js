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
      wetland: { r: 180, g: 210, b: 185, a: 255 }, // Pale blue-green for wetlands
      beach: { r: 245, g: 230, b: 200, a: 255 }, // Sandy beige for beaches
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
    },

    // Special purpose areas
    specialPurpose: {
      education: { r: 245, g: 235, b: 210, a: 255 }, // Yellow-tan
      religious: { r: 225, g: 220, b: 230, a: 255 }, // Light purple
      cemetery: { r: 205, g: 220, b: 200, a: 255 }, // Subtle green-gray
      railway: { r: 210, g: 205, b: 210, a: 255 }, // Light purple-gray
      quarry: { r: 210, g: 200, b: 190, a: 255 }, // Gray-brown
      recreation: { r: 218, g: 238, b: 205, a: 255 }, // Very subtle green
      services: { r: 220, g: 230, b: 240, a: 255 }, // Light blue for rest areas/services
    },

    // Recreation facilities
    recreation: {
      playground: { r: 218, g: 238, b: 205, a: 255 }, // Light green base
      swimmingPool: { r: 180, g: 220, b: 240, a: 255 }, // Light blue
      beachVolleyball: { r: 245, g: 230, b: 200, a: 255 }, // Sandy beige
      tableTennis: { r: 200, g: 220, b: 200, a: 255 }, // Light greenish
      picnicSite: { r: 210, g: 225, b: 195, a: 255 }, // Light green
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
      smallRoads: { r: 220, g: 220, b: 220, a: 255 }, // Light gray
      footway: { r: 250, g: 190, b: 165, a: 255 }, // Salmon/pink
      cycleway: { r: 120, g: 150, b: 255, a: 255 }, // Blue
      construction: { r: 200, g: 60, b: 60, a: 255 }, // Red for construction pattern
    },

    // Railways
    railways: {
      rail: { r: 153, g: 153, b: 153, a: 255 }, // Gray
    },

    // Boundaries and special lines
    boundaries: {
      country: { r: 128, g: 0, b: 128, a: 255 }, // Purple for country borders
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
    },

    // Pattern colors (for textures)
    patterns: {
      scrubBush: { r: 120, g: 150, b: 90, a: 76 }, // Dark green, semi-transparent
      scrubStem: { r: 100, g: 130, b: 70, a: 102 }, // Darker green
      wetlandWater: { r: 100, g: 150, b: 180, a: 64 }, // Light blue
      wetlandGrass: { r: 80, g: 120, b: 90, a: 76 }, // Green
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

  // Future themes can be added here:
  // dark: { ... },
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
