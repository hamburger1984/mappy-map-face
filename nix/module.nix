# NixOS module for the OSM tile renderer.
#
# Usage — in your system flake.nix:
#
#   inputs.osm-renderer.url = "github:you/osm-renderer";
#
#   outputs = { nixpkgs, osm-renderer, ... }: {
#     nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
#       modules = [
#         osm-renderer.nixosModules.default
#         {
#           services.osm-renderer = {
#             enable = true;
#             regions = [
#               { name = "hamburg";
#                 url  = "https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf"; }
#               { name = "schleswig-holstein";
#                 url  = "https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf"; }
#             ];
#             nginx.virtualHost = "map.example.com";
#           };
#         }
#       ];
#     };
#   };
#
# After deploying, start the initial tile build manually:
#   systemctl start osm-renderer-build
# (This takes several hours for large regions.)
#
# Subsequent automatic updates run on the schedule set by `updateCalendar`.
# Each run only processes regions that are actually due (tiles older than
# `max-tile-age` *and* newer upstream data / a changed tileset config),
# oldest first, and stops on its own once `updateTimeBudget` seconds have
# elapsed — the next timer firing continues with the remaining regions.

flakeSrc: { config, lib, pkgs, ... }:

with lib;

let
  cfg = config.services.osm-renderer;

  # ── Python environment ───────────────────────────────────────────────────
  pythonEnv = pkgs.python3.withPackages (ps: with ps; [
    ijson
    tqdm
    shapely
    pyyaml
    orjson
  ]);

  # ── Tileset config ───────────────────────────────────────────────────────
  # Use the user-supplied file or fall back to the one bundled with the flake.
  tilesetConfig =
    if cfg.tilesetConfigFile != null
    then cfg.tilesetConfigFile
    else "${flakeSrc}/tileset_config.yaml";

  # ── Regions file ─────────────────────────────────────────────────────────
  # Generated at nixos-rebuild time from the `regions` option.
  regionsFile = pkgs.writeText "osm-renderer-regions.json"
    (builtins.toJSON cfg.regions);

  # ── Static web files ─────────────────────────────────────────────────────
  # Built into the Nix store at nixos-rebuild time so nginx can serve them
  # directly without any mutable state.  tileset_config.json is pre-generated
  # here so the browser picks up tileset changes after every `nixos-rebuild switch`.
  staticFiles = pkgs.runCommand "osm-renderer-static" {
    nativeBuildInputs = [ pythonEnv ];
  } ''
    mkdir "$out"
    for f in index.html map_renderer.js map_theme.js tile_worker.js favicon.ico glyph_editor.html; do
      [ -f "${flakeSrc}/public/$f" ] && cp "${flakeSrc}/public/$f" "$out/"
    done

    # Bake tileset_config.json from the chosen tileset_config.yaml
    python3 ${flakeSrc}/preprocessing/export_config.py \
      --config ${tilesetConfig} \
      --output "$out/tileset_config.json"

    # Theme selection: read by the renderer as window.OSM_CONFIG
    echo '{"theme":"${cfg.theme}"}' > "$out/config.json"
  '';

  # ── Build / update script ────────────────────────────────────────────────
  # Regions are processed one at a time in the order listed, with an optional
  # gap between them.  Land polygons are fetched once before the loop starts.
  # Extra arguments (time budget, region limit, ...) are appended by the
  # service units that call this script.
  buildScript = pkgs.writeShellApplication {
    name = "osm-renderer-build";
    runtimeInputs = [ pythonEnv pkgs.osmium-tool pkgs.gdal ];
    text = ''
      python3 ${flakeSrc}/preprocessing/run_staggered.py \
        --regions-file    ${regionsFile}            \
        --data-dir        ${cfg.dataDir}            \
        --tiles-dir       ${cfg.tilesDir}           \
        --tileset-config  ${tilesetConfig}          \
        --land-polygon-url ${cfg.landPolygonUrl}    \
        --gap-seconds     ${toString cfg.regionGapSeconds} \
        -j                ${toString cfg.jobs}      \
        "$@"
    '';
  };

in {

  # ── Options ───────────────────────────────────────────────────────────────
  options.services.osm-renderer = {

    enable = mkEnableOption "OSM tile renderer";

    regions = mkOption {
      type = types.listOf (types.submodule {
        options = {
          name = mkOption {
            type        = types.str;
            description = "Short identifier, e.g. \"hamburg\". Used as the directory name under dataDir.";
          };
          url = mkOption {
            type        = types.str;
            description = "URL to the .osm.pbf file, e.g. from Geofabrik.";
          };
          enabled = mkOption {
            type        = types.bool;
            default     = true;
            description = "Whether to include this region in builds. Set to false to temporarily skip it.";
          };
        };
      });
      default     = [];
      description = "OSM regions to download, convert, and render.";
      example     = literalExpression ''
        [
          { name = "hamburg";
            url  = "https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf"; }
          { name = "schleswig-holstein";
            url  = "https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf"; }
        ]
      '';
    };

    theme = mkOption {
      type        = types.str;
      default     = "default";
      description = ''
        Map colour theme.  Must match a key in public/map_theme.js THEMES.
        Served as /config.json so the renderer can switch at runtime.
      '';
    };

    dataDir = mkOption {
      type        = types.str;
      default     = "/var/lib/osm-renderer";
      description = "Persistent directory for downloaded PBF files and intermediate GeoJSON data.";
    };

    tilesDir = mkOption {
      type        = types.str;
      default     = "/var/lib/osm-renderer/tiles";
      description = "Directory where generated tile JSON files are written. Served by nginx.";
    };

    tilesetConfigFile = mkOption {
      type        = types.nullOr types.path;
      default     = null;
      description = ''
        Path to a custom tileset_config.yaml.  When null the file bundled
        with the flake is used.  Changing this triggers a new static-files
        build on the next nixos-rebuild switch.
      '';
      example = literalExpression "./my-tileset-config.yaml";
    };

    jobs = mkOption {
      type        = types.int;
      default     = 4;
      description = "Number of parallel workers for download and tile generation.";
    };

    landPolygonUrl = mkOption {
      type        = types.str;
      # Default to mirror while osmdata.openstreetmap.de is unreliable; original kept as comment.
      # "global": "https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip",
      default     = "https://www.osmdata.org/download/land-polygons-split-4326.zip";
      description = ''
        URL for the global land polygon shapefile (zip containing a shapefile).
        Used to distinguish land from ocean in tile backgrounds.
        Override if you mirror this data locally or the upstream URL changes.
      '';
    };

    regionGapSeconds = mkOption {
      type        = types.int;
      default     = 0;
      description = ''
        Seconds to wait between finishing one region and starting the next
        during a staggered build.  Useful to avoid hammering the download
        server.  Set to 0 for no delay.
      '';
      example = 60;
    };

    updateCalendar = mkOption {
      type        = types.nullOr types.str;
      default     = "daily";
      description = ''
        Systemd OnCalendar spec for automatic tile refresh.
        The run itself stops when `updateTimeBudget` is reached, so a short
        frequent schedule is preferred over one long weekly pass: due regions
        are handled oldest-first and picked up over the following runs.
        Set to null to disable the timer (manual builds only).
      '';
      example = "Mon 03:00";
    };

    updateTimeBudget = mkOption {
      type        = types.int;
      default     = 14400;
      description = ''
        Wall-clock seconds a single periodic update run may spend on regions.
        Once the budget is reached the run stops cleanly (no cancellation of
        work in flight) and the remaining due regions are processed by the
        next timer firing.  0 disables the budget.
      '';
      example = 4 * 60 * 60;
    };

    updateMaxRegions = mkOption {
      type        = types.int;
      default     = 0;
      description = ''
        Maximum number of regions a single periodic update run may process.
        0 means only `updateTimeBudget` limits the run.
      '';
    };

    nginx = {
      enable = mkOption {
        type        = types.bool;
        default     = true;
        description = "Whether to configure an nginx virtual host for the renderer.";
      };

      virtualHost = mkOption {
        type        = types.str;
        description = "Nginx virtual host name, e.g. \"map.example.com\".";
        example     = "map.example.com";
      };

      ssl = mkOption {
        type        = types.bool;
        default     = false;
        description = ''
          Enable TLS via Let's Encrypt (ACME).  You must also set
          security.acme.acceptTerms = true and
          security.acme.defaults.email = "you@example.com" in your config.
        '';
      };
    };

  };

  # ── Implementation ────────────────────────────────────────────────────────
  config = mkIf cfg.enable {

    assertions = [
      { assertion = cfg.regions != [];
        message   = "services.osm-renderer.regions must contain at least one region."; }
    ];

    # Dedicated system user / group
    users.users.osm-renderer = {
      isSystemUser = true;
      group        = "osm-renderer";
      home         = cfg.dataDir;
      createHome   = false;
    };
    users.groups.osm-renderer = {};

    # nginx needs to traverse dataDir to serve tiles
    users.users.nginx.extraGroups = [ "osm-renderer" ];

    # Persistent directories
    systemd.tmpfiles.rules = [
      "d '${cfg.dataDir}'  0750 osm-renderer osm-renderer - -"
      "d '${cfg.tilesDir}' 0755 osm-renderer osm-renderer - -"
    ];

    # ── Systemd: initial / manual build ─────────────────────────────────────
    systemd.services.osm-renderer-build = {
      description = "OSM Renderer: download OSM data and generate tiles";
      after       = [ "network-online.target" ];
      wants       = [ "network-online.target" ];
      # Not in wantedBy — start manually with:  systemctl start osm-renderer-build
      # Or let the timer drive it via osm-renderer-update.
      serviceConfig = {
        Type      = "oneshot";
        User      = "osm-renderer";
        Group     = "osm-renderer";
        ExecStart = "${buildScript}/bin/osm-renderer-build";
        # A full pass over all regions legitimately takes many hours — there
        # must be no start timeout, otherwise systemd SIGTERMs a healthy run
        # mid-region.  Stopping stays fast and clean instead: SIGTERM goes to
        # the runner only (KillMode=mixed), which then stops its own children,
        # cleans up staging dirs and exits.
        TimeoutStartSec  = "infinity";
        TimeoutStopSec   = "1min";
        KillMode         = "mixed";
        Nice             = 10;
        IOSchedulingClass = "idle";
      };
    };

    # ── Systemd: periodic update timer ──────────────────────────────────────
    systemd.services.osm-renderer-update = mkIf (cfg.updateCalendar != null) {
      description = "OSM Renderer: periodic tile refresh";
      after       = [ "network-online.target" ];
      wants       = [ "network-online.target" ];
      serviceConfig = {
        Type      = "oneshot";
        User      = "osm-renderer";
        Group     = "osm-renderer";
        # The run stops itself when the budget is exhausted; remaining due
        # regions are picked up by the next timer firing.
        ExecStart = "${buildScript}/bin/osm-renderer-build"
          + " --time-budget ${toString cfg.updateTimeBudget}"
          + " --max-regions ${toString cfg.updateMaxRegions}";
        TimeoutStartSec  = "infinity";
        TimeoutStopSec   = "1min";
        KillMode         = "mixed";
        Nice             = 10;
        IOSchedulingClass = "idle";
      };
    };

    systemd.timers.osm-renderer-update = mkIf (cfg.updateCalendar != null) {
      description = "OSM Renderer: periodic tile refresh timer";
      wantedBy    = [ "timers.target" ];
      timerConfig = {
        OnCalendar         = cfg.updateCalendar;
        # Catch up after downtime instead of skipping the missed run.
        Persistent         = true;
        RandomizedDelaySec = "15min";
        AccuracySec        = "1min";
      };
    };

    # ── Nginx virtual host ───────────────────────────────────────────────────
    services.nginx = mkIf cfg.nginx.enable {
      enable = true;

      virtualHosts.${cfg.nginx.virtualHost} = {
        forceSSL   = cfg.nginx.ssl;
        enableACME = cfg.nginx.ssl;

        # Generated tiles — served from mutable state directory.
        # Tiles are pre-compressed as .json.gz; disable nginx gzip to avoid double-compression.
        # Long cache: tiles only change after a rebuild.
        locations."/tiles/" = {
          alias       = "${cfg.tilesDir}/";
          extraConfig = ''
            expires 7d;
            add_header Cache-Control "public";
            gzip off;
          '';
        };

        # Static frontend files — served directly from Nix store.
        # Rebuilt on every nixos-rebuild switch that changes the config.
        locations."/" = {
          root      = "${staticFiles}";
          tryFiles  = "$uri $uri/index.html =404";
          extraConfig = "expires 1h;";
        };
      };
    };

  };
}
