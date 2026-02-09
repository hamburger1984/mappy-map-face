const std = @import("std");
const json = std.json;

const TileBounds = struct {
    min_lon: f64 = 8.48,
    max_lon: f64 = 11.50,
    min_lat: f64 = 52.65,
    max_lat: f64 = 54.45,
};

const Color = struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
};

const RenderMetadata = struct {
    layer: []const u8,
    color: Color,
    minLOD: u8,
    fill: bool,
    width: ?u8 = null,
    isRailway: bool = false,
    roadPriority: ?u8 = null,
};

const Feature = struct {
    type: []const u8,
    geometry: json.Value,
    properties: json.Value,
    _render: ?RenderMetadata = null,
};

const FeatureCollection = struct {
    type: []const u8,
    features: []Feature,
};

const TileKey = struct {
    z: u8,
    x: u32,
    y: u32,
};

// Web Mercator projection helpers
fn lon2tile(lon: f64, zoom: u8) u32 {
    const z = @as(f64, @floatFromInt(@as(u32, 1) << @intCast(zoom)));
    return @intFromFloat(@floor((lon + 180.0) / 360.0 * z));
}

fn lat2tile(lat: f64, zoom: u8) u32 {
    const lat_rad = lat * std.math.pi / 180.0;
    const z = @as(f64, @floatFromInt(@as(u32, 1) << @intCast(zoom)));
    return @intFromFloat(@floor((1.0 - @log(std.math.tan(lat_rad) + 1.0 / @cos(lat_rad)) / std.math.pi) / 2.0 * z));
}

fn classifyFeature(allocator: std.mem.Allocator, props: json.Value) !?RenderMetadata {
    const obj = props.object;

    // Check for water
    if (obj.get("natural")) |natural| {
        if (std.mem.eql(u8, natural.string, "water") or std.mem.eql(u8, natural.string, "coastline")) {
            return RenderMetadata{
                .layer = "water_areas",
                .color = .{ .r = 170, .g = 211, .b = 223, .a = 255 },
                .minLOD = 0,
                .fill = true,
            };
        }
        if (std.mem.eql(u8, natural.string, "wood")) {
            return RenderMetadata{
                .layer = "forests",
                .color = .{ .r = 173, .g = 209, .b = 158, .a = 255 },
                .minLOD = 0,
                .fill = true,
            };
        }
    }

    // Check for waterway
    if (obj.get("waterway")) |waterway| {
        if (std.mem.eql(u8, waterway.string, "riverbank")) {
            return RenderMetadata{
                .layer = "water_areas",
                .color = .{ .r = 170, .g = 211, .b = 223, .a = 255 },
                .minLOD = 0,
                .fill = true,
            };
        } else {
            const is_major = std.mem.eql(u8, waterway.string, "river") or std.mem.eql(u8, waterway.string, "canal");
            return RenderMetadata{
                .layer = "waterways",
                .color = .{ .r = 170, .g = 211, .b = 223, .a = 255 },
                .minLOD = if (is_major) 0 else 1,
                .fill = false,
            };
        }
    }

    // Check for highway
    if (obj.get("highway")) |highway| {
        const hw = highway.string;

        if (std.mem.eql(u8, hw, "motorway") or std.mem.eql(u8, hw, "trunk")) {
            return RenderMetadata{
                .layer = "surface_roads",
                .color = .{ .r = 233, .g = 115, .b = 103, .a = 255 },
                .minLOD = 0,
                .fill = false,
                .width = 6,
                .roadPriority = 7,
            };
        }

        if (std.mem.eql(u8, hw, "primary")) {
            return RenderMetadata{
                .layer = "surface_roads",
                .color = .{ .r = 249, .g = 207, .b = 144, .a = 255 },
                .minLOD = 0,
                .fill = false,
                .width = 5,
                .roadPriority = 6,
            };
        }

        if (std.mem.eql(u8, hw, "secondary") or std.mem.eql(u8, hw, "tertiary")) {
            return RenderMetadata{
                .layer = "surface_roads",
                .color = .{ .r = 255, .g = 255, .b = 255, .a = 255 },
                .minLOD = 1,
                .fill = false,
                .width = 4,
                .roadPriority = 5,
            };
        }

        if (std.mem.eql(u8, hw, "residential") or std.mem.eql(u8, hw, "unclassified")) {
            return RenderMetadata{
                .layer = "surface_roads",
                .color = .{ .r = 255, .g = 255, .b = 255, .a = 255 },
                .minLOD = 1,
                .fill = false,
                .width = 3,
                .roadPriority = 3,
            };
        }
    }

    // Check for railway
    if (obj.get("railway")) |railway| {
        const rw = railway.string;
        const is_tram = std.mem.eql(u8, rw, "tram") or std.mem.eql(u8, rw, "light_rail");

        return RenderMetadata{
            .layer = "surface_railways",
            .color = .{ .r = 153, .g = 153, .b = 153, .a = 255 },
            .minLOD = if (is_tram) 1 else 0,
            .fill = false,
            .width = if (is_tram) 6 else 8,
            .isRailway = true,
        };
    }

    // Check for building
    if (obj.get("building")) |_| {
        return RenderMetadata{
            .layer = "buildings",
            .color = .{ .r = 218, .g = 208, .b = 200, .a = 255 },
            .minLOD = 2,
            .fill = true,
        };
    }

    // Check for landuse
    if (obj.get("landuse")) |landuse| {
        const lu = landuse.string;

        if (std.mem.eql(u8, lu, "forest")) {
            return RenderMetadata{
                .layer = "forests",
                .color = .{ .r = 173, .g = 209, .b = 158, .a = 255 },
                .minLOD = 0,
                .fill = true,
            };
        }

        if (std.mem.eql(u8, lu, "grass") or std.mem.eql(u8, lu, "meadow")) {
            return RenderMetadata{
                .layer = "natural_background",
                .color = .{ .r = 200, .g = 230, .b = 180, .a = 255 },
                .minLOD = 1,
                .fill = true,
            };
        }

        if (std.mem.eql(u8, lu, "residential")) {
            return RenderMetadata{
                .layer = "landuse_areas",
                .color = .{ .r = 224, .g = 224, .b = 224, .a = 255 },
                .minLOD = 2,
                .fill = true,
            };
        }

        if (std.mem.eql(u8, lu, "commercial") or std.mem.eql(u8, lu, "retail")) {
            return RenderMetadata{
                .layer = "landuse_areas",
                .color = .{ .r = 243, .g = 233, .b = 234, .a = 255 },
                .minLOD = 2,
                .fill = true,
            };
        }
    }

    _ = allocator;
    return null;
}

fn getZoomLevelsForLOD(min_lod: u8) []const u8 {
    // Z8: LOD 0 only
    // Z11: LOD 0-1
    // Z14: LOD 0-3 (all)

    return switch (min_lod) {
        0 => &[_]u8{ 8, 11, 14 },
        1 => &[_]u8{ 11, 14 },
        2, 3 => &[_]u8{14},
        else => &[_]u8{},
    };
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 2) {
        std.debug.print("Usage: {s} <input.geojson>\n", .{args[0]});
        return error.MissingArgument;
    }

    const input_path = args[1];

    std.debug.print("Hamburg OSM Tile Splitter (Zig)\n", .{});
    std.debug.print("==================================================\n", .{});
    std.debug.print("Input: {s}\n", .{input_path});
    std.debug.print("Output: public/tiles\n", .{});
    std.debug.print("Zoom levels: [8, 11, 14]\n", .{});
    std.debug.print("==================================================\n\n", .{});

    // Read input file
    std.debug.print("Loading {s}...\n", .{input_path});
    const timer_start = std.time.milliTimestamp();

    const file = try std.fs.cwd().openFile(input_path, .{});
    defer file.close();

    const file_size = try file.getEndPos();
    const file_content = try allocator.alloc(u8, file_size);
    defer allocator.free(file_content);

    _ = try file.readAll(file_content);

    const load_time = std.time.milliTimestamp() - timer_start;
    std.debug.print("Loaded {d} MB in {d}ms\n\n", .{ file_size / 1024 / 1024, load_time });

    // Parse JSON
    std.debug.print("Parsing GeoJSON...\n", .{});
    const parse_start = std.time.milliTimestamp();

    const parsed = try json.parseFromSlice(json.Value, allocator, file_content, .{});
    defer parsed.deinit();

    const parse_time = std.time.milliTimestamp() - parse_start;
    std.debug.print("Parsed in {d}ms\n\n", .{parse_time});

    const root = parsed.value.object;
    const features_array = root.get("features").?.array;

    std.debug.print("Processing {d} features...\n", .{features_array.items.len});
    const process_start = std.time.milliTimestamp();

    // Create tile storage
    var tiles = std.AutoHashMap(TileKey, std.ArrayList(json.Value)).init(allocator);
    defer {
        var iter = tiles.iterator();
        while (iter.next()) |entry| {
            entry.value_ptr.deinit(allocator);
        }
        tiles.deinit();
    }

    var classified: usize = 0;
    var skipped: usize = 0;

    for (features_array.items, 0..) |feature_val, i| {
        if (i % 10000 == 0) {
            std.debug.print("  Processed {d}/{d} features...\n", .{ i, features_array.items.len });
        }

        const feature = feature_val.object;
        const props = feature.get("properties") orelse continue;

        // Classify feature
        const metadata = classifyFeature(allocator, props) catch continue;

        if (metadata == null) {
            skipped += 1;
            continue;
        }

        const meta = metadata.?;
        classified += 1;

        // Get geometry to determine tile placement
        const geometry = feature.get("geometry") orelse continue;
        const geom_obj = geometry.object;
        const coords = geom_obj.get("coordinates") orelse continue;

        // Get bounding box of feature (simplified - just use first coordinate)
        var lon: f64 = 0;
        var lat: f64 = 0;

        // Extract coordinates based on geometry type
        const geom_type = geom_obj.get("type").?.string;
        if (std.mem.eql(u8, geom_type, "Point")) {
            lon = coords.array.items[0].float;
            lat = coords.array.items[1].float;
        } else if (std.mem.eql(u8, geom_type, "LineString") or std.mem.eql(u8, geom_type, "MultiLineString")) {
            const first_coord = if (std.mem.eql(u8, geom_type, "LineString"))
                coords.array.items[0].array
            else
                coords.array.items[0].array.items[0].array;
            lon = first_coord.items[0].float;
            lat = first_coord.items[1].float;
        } else if (std.mem.eql(u8, geom_type, "Polygon") or std.mem.eql(u8, geom_type, "MultiPolygon")) {
            const first_coord = if (std.mem.eql(u8, geom_type, "Polygon"))
                coords.array.items[0].array.items[0].array
            else
                coords.array.items[0].array.items[0].array.items[0].array;
            lon = first_coord.items[0].float;
            lat = first_coord.items[1].float;
        } else {
            continue;
        }

        // Assign to tiles based on LOD
        const zoom_levels = getZoomLevelsForLOD(meta.minLOD);

        for (zoom_levels) |zoom| {
            const tile_x = lon2tile(lon, zoom);
            const tile_y = lat2tile(lat, zoom);

            const key = TileKey{ .z = zoom, .x = tile_x, .y = tile_y };

            const result = try tiles.getOrPut(key);
            if (!result.found_existing) {
                result.value_ptr.* = .{};
            }

            try result.value_ptr.append(allocator, feature_val);
        }
    }

    const process_time = std.time.milliTimestamp() - process_start;
    std.debug.print("\nProcessed {d} features ({d} classified, {d} skipped) in {d}ms\n\n", .{
        features_array.items.len,
        classified,
        skipped,
        process_time,
    });

    // Write tiles
    std.debug.print("Writing {d} tiles...\n", .{tiles.count()});
    const write_start = std.time.milliTimestamp();

    // Create output directory
    try std.fs.cwd().makePath("public/tiles");

    var tile_iter = tiles.iterator();
    var written: usize = 0;

    while (tile_iter.next()) |entry| {
        const key = entry.key_ptr.*;

        // Create zoom/x directory
        var path_buf: [256]u8 = undefined;
        const dir_path = try std.fmt.bufPrint(&path_buf, "public/tiles/{d}/{d}", .{ key.z, key.x });
        try std.fs.cwd().makePath(dir_path);

        // Write tile
        const tile_path = try std.fmt.bufPrint(&path_buf, "public/tiles/{d}/{d}/{d}.json", .{ key.z, key.x, key.y });

        const tile_file = try std.fs.cwd().createFile(tile_path, .{});
        defer tile_file.close();

        // Build JSON in memory then write
        var json_buf = std.ArrayList(u8){};
        defer json_buf.deinit(allocator);

        var writer = json_buf.writer(allocator);
        try writer.writeAll("{\"type\":\"FeatureCollection\",\"features\":[");

        for (entry.value_ptr.items, 0..) |feature, i| {
            if (i > 0) try writer.writeAll(",");
            try writer.print("{any}", .{std.json.fmt(feature, .{})});
        }

        try writer.writeAll("]}");
        try tile_file.writeAll(json_buf.items);

        written += 1;
        if (written % 100 == 0) {
            std.debug.print("  Written {d}/{d} tiles...\n", .{ written, tiles.count() });
        }
    }

    const write_time = std.time.milliTimestamp() - write_start;
    const total_time = std.time.milliTimestamp() - timer_start;

    std.debug.print("\n✓ Created {d} tiles in {d}ms\n", .{ written, write_time });
    std.debug.print("\nTotal time: {d}ms\n", .{total_time});
    std.debug.print("  Load: {d}ms\n", .{load_time});
    std.debug.print("  Parse: {d}ms\n", .{parse_time});
    std.debug.print("  Process: {d}ms\n", .{process_time});
    std.debug.print("  Write: {d}ms\n", .{write_time});
}
