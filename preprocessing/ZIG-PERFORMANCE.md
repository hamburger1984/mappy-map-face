# Zig Tile Splitter Performance Analysis

## Current Implementation Status

The Zig tile splitter (`split_tiles.zig`) is **functional but memory-intensive**.

### Performance Results (Hamburg 3.3GB)

**Hardware:** MacBook Pro (darwin 25.2.0)
**Input:** hamburg-region.geojson (3.3GB, 10.6M features)
**Build:** `zig build -Doptimize=ReleaseFast`

```
Total time: 116 seconds (1m 56s)
├── Load:     0.5s (0.4%)
├── Parse:   26.6s (22.9%)
├── Process: 66.3s (57.0%)
└── Write:   22.9s (19.7%)

Memory: 18.4GB peak (5.5x file size)
Output: 17,347 tiles
```

### Comparison with Python

Python's `split-tiles.py` uses similar memory (~5-6x file size) because both:
1. Load entire file into memory
2. Parse full JSON at once with `json.load()`/`json.parseFromSlice()`
3. Keep all parsed features in memory during processing

## Scalability Problem

**Memory requirements scale linearly with file size:**

| Region   | File Size | Expected RAM | Feasible? |
|----------|-----------|--------------|-----------|
| Hamburg  | 3.3GB     | 18GB         | ✅ Yes    |
| Germany  | 30GB      | 165GB        | ❌ No     |
| Europe   | 300GB     | 1.65TB       | ❌ No     |

**Conclusion:** Current approach won't scale beyond single-city level.

## Why Streaming Is Hard in Zig 0.15.2

Attempted to implement streaming JSON parser but hit API changes:

1. **Scanner API changed:**
   ```zig
   // Old API (doesn't exist):
   Scanner.initStreaming(allocator, reader, .{})
   
   // New API (unclear how to feed data):
   Scanner.initStreaming(allocator)
   ```

2. **File.reader() requires buffer:**
   ```zig
   // Now requires buffer argument:
   var buf: [8192]u8 = undefined;
   const reader = file.reader(&buf);
   ```

3. **ArrayList.init() removed:**
   ```zig
   // Old: ArrayList(T).init(allocator)
   // New: ArrayList(T){}
   ```

4. **json.stringify() doesn't exist:**
   - No direct way to serialize `json.Value` back to string
   - Would need to manually implement serialization

## Recommended Solutions

### Short-term (Current Sprint)

**Use the working Zig implementation as-is:**
- Fast enough for Hamburg (2 minutes)
- 18GB RAM is acceptable for development
- Focus on other Sprint 1 tasks (street names, compact tiles)

### Medium-term (After Sprint 1)

**Option 1: Preprocess with jq**
Split large files before Zig processing:
```bash
# Split GeoJSON into 1GB chunks
jq -c '.features[] | select(...)' germany.geojson | split -l 1000000

# Process each chunk with Zig
for chunk in chunk_*; do
  zig-out/bin/split-tiles $chunk
done
```

**Option 2: Use simdjson-style approach**
- Write custom streaming parser using Zig's lower-level APIs
- Process chunks with fixed-size buffer (e.g., 10MB)
- Extract just coordinates + properties, discard full JSON

**Option 3: Use osmium/osm2json**
- Convert PBF → GeoJSON in streaming fashion
- Process tiles directly from PBF format
- Tools like `osmium` support chunked output

### Long-term (Sprint 2+)

**Implement true streaming parser:**
```zig
// Pseudocode for streaming approach:
const StreamProcessor = struct {
    fn processChunk(chunk: []const u8) !void {
        // Parse just this chunk
        // Extract features
        // Assign to tiles
        // Free parsed data immediately
    }
};

// Read file in 10MB chunks
while (reader.readChunk()) |chunk| {
    try processor.processChunk(chunk);
}
```

## Next Steps

1. ✅ Verified current Zig implementation works
2. Continue with Sprint 1 Task 2: Add street names to tiles
3. Complete Sprint 1 Task 3: Compact JSON format
4. Revisit streaming for Sprint 2 (Germany expansion)

## Code Location

- Implementation: `preprocessing/split_tiles.zig`
- Build: `zig build -Doptimize=ReleaseFast`
- Run: `./zig-out/bin/split-tiles data/hamburg-region.geojson`
