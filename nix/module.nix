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
    for f in index.html map_renderer.js map_theme.js favicon.ico glyph_editor.html; do
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
  buildScript = pkgs.writeShellApplication {
    name = "osm-renderer-build";
    runtimeInputs = [ pythonEnv pkgs.osmium-tool pkgs.gdal ];
    text = ''
      set -euo pipefail

      echo "=== OSM Renderer: downloading PBF data ==="
      python3 ${flakeSrc}/preprocessing/step_1_download.py \
        --regions-file ${regionsFile} \
        --data-dir     ${cfg.dataDir} \
        -j             ${toString cfg.jobs}

      echo "=== OSM Renderer: converting to GeoJSON ==="
      python3 ${flakeSrc}/preprocessing/step_2_convert_to_geojson.py \
        --data-dir ${cfg.dataDir} \
        -j         ${toString cfg.jobs}

      echo "=== OSM Renderer: generating tiles ==="
      TILESET_CONFIG_PATH=${tilesetConfig} \
      python3 ${flakeSrc}/preprocessing/step_3_generate_tiles.py \
        --data-dir   ${cfg.dataDir} \
        --output-dir ${cfg.tilesDir} \
        -j           ${toString cfg.jobs}

      echo "=== OSM Renderer: done ==="
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

    updateCalendar = mkOption {
      type        = types.nullOr types.str;
      default     = "weekly";
      description = ''
        Systemd OnCalendar spec for automatic tile refresh.
        Set to null to disable the timer (manual builds only).
      '';
      example = "Mon 03:00";
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
        Type             = "oneshot";
        User             = "osm-renderer";
        Group            = "osm-renderer";
        ExecStart        = "${buildScript}/bin/osm-renderer-build";
        TimeoutStartSec  = "24h";
        RemainAfterExit  = true;
      };
    };

    # ── Systemd: periodic update timer ──────────────────────────────────────
    systemd.services.osm-renderer-update = mkIf (cfg.updateCalendar != null) {
      description = "OSM Renderer: periodic tile refresh";
      after       = [ "network-online.target" ];
      wants       = [ "network-online.target" ];
      serviceConfig = {
        Type            = "oneshot";
        User            = "osm-renderer";
        Group           = "osm-renderer";
        ExecStart       = "${buildScript}/bin/osm-renderer-build";
        TimeoutStartSec = "24h";
      };
    };

    systemd.timers.osm-renderer-update = mkIf (cfg.updateCalendar != null) {
      description = "OSM Renderer: periodic tile refresh timer";
      wantedBy    = [ "timers.target" ];
      timerConfig = {
        OnCalendar = cfg.updateCalendar;
        Persistent = true;         # run missed jobs after downtime
      };
    };

    # ── Nginx virtual host ───────────────────────────────────────────────────
    services.nginx = mkIf cfg.nginx.enable {
      enable = true;

      virtualHosts.${cfg.nginx.virtualHost} = {
        forceSSL   = cfg.nginx.ssl;
        enableACME = cfg.nginx.ssl;

        # Generated tiles — served from mutable state directory.
        # Long cache: tiles only change after a rebuild.
        locations."/tiles/" = {
          alias       = "${cfg.tilesDir}/";
          extraConfig = ''
            expires 7d;
            add_header Cache-Control "public";
            gzip on;
            gzip_types application/json;
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
