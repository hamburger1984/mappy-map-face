const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Tile splitter executable (native)
    const split_tiles = b.addExecutable(.{
        .name = "split-tiles",
        .root_module = b.createModule(.{
            .root_source_file = b.path("preprocessing/split_tiles.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    b.installArtifact(split_tiles);

    // Create a run step for the tile splitter
    const run_split = b.addRunArtifact(split_tiles);
    run_split.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_split.addArgs(args);
    }

    const split_step = b.step("split-tiles", "Run the tile splitter");
    split_step.dependOn(&run_split.step);

    // Add a step to fetch OSM data
    const fetch_data = b.step("data", "Download and process OSM data");
    const fetch_cmd = b.addSystemCommand(&.{"./preprocessing/fetch-data.sh"});
    fetch_data.dependOn(&fetch_cmd.step);
}
