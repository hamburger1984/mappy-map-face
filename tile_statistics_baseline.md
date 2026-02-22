# Tile Statistics Baseline

Generated: 2026-02-22 14:12:55
Source: `/Users/andreas/Source/better-than-dijkstra/osm-renderer/public/tiles`

## Methodology

- Sampled up to 1000 random tiles per tileset (or all tiles if fewer)
- For each sampled tile, parsed JSON and measured per-feature JSON size
- Categorized features by primary OSM tag (building, highway:residential, natural:water, etc.)
- Extrapolated to full tileset using sample ratio
- Coordinate counts reflect total vertices across all geometry rings/lines

## T1

- **Tiles:** 308,184
- **Actual disk size:** 2.73 GB
- **Sampled:** 1000 tiles (0.3%)
- **Estimated feature data:** 2.70 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 1.09 GB | 2,575,801 | 15,847,129 |
| highway | 658.0 MB | 1,563,725 | 7,013,343 |
| landuse | 606.7 MB | 1,144,287 | 12,857,436 |
| natural | 270.6 MB | 446,250 | 6,316,231 |
| waterway | 130.6 MB | 418,822 | 1,822,908 |
| boundary | 46.3 MB | 98,310 | 536,856 |
| railway | 40.3 MB | 73,655 | 307,259 |
| unknown | 20.8 MB | 34,516 | 71,806 |
| amenity | 15.8 MB | 34,516 | 75,505 |
| leisure | 12.8 MB | 26,812 | 245,930 |
| shop | 11.4 MB | 28,044 | 28,044 |
| place | 2.8 MB | 9,553 | 9,553 |
| public_transport | 1.2 MB | 2,465 | 8,937 |
| aeroway | 758 KB | 1,849 | 10,478 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 1.09 GB | 2,575,801 | 15,847,129 | 422 |
| landuse:farmland | 203.5 MB | 393,242 | 4,237,221 | 517 |
| landuse:meadow | 145.3 MB | 277,673 | 3,190,937 | 523 |
| highway:service | 130.9 MB | 365,814 | 1,478,666 | 357 |
| highway:track | 108.5 MB | 271,510 | 1,340,292 | 399 |
| natural:scrub | 102.2 MB | 189,533 | 2,323,090 | 539 |
| highway:residential | 88.2 MB | 183,061 | 870,619 | 481 |
| highway:footway | 87.3 MB | 234,219 | 990,811 | 372 |
| landuse:forest | 81.5 MB | 146,695 | 1,722,440 | 555 |
| waterway:ditch | 81.2 MB | 279,522 | 1,060,769 | 290 |
| highway:path | 74.8 MB | 176,589 | 878,324 | 423 |
| natural:water | 70.0 MB | 115,260 | 1,590,537 | 607 |
| landuse:residential | 68.7 MB | 125,739 | 1,555,096 | 546 |
| natural:wetland | 54.9 MB | 69,957 | 1,394,224 | 785 |
| boundary:administrative | 46.1 MB | 98,002 | 536,240 | 470 |
| landuse:grass | 45.2 MB | 82,901 | 1,054,913 | 545 |
| highway:unclassified | 37.5 MB | 85,366 | 385,846 | 439 |
| highway:tertiary | 35.2 MB | 70,265 | 322,360 | 500 |
| highway:secondary | 34.1 MB | 60,095 | 242,232 | 567 |
| natural:wood | 30.0 MB | 51,466 | 705,124 | 582 |
| railway:rail | 29.5 MB | 55,164 | 231,446 | 534 |
| highway:primary | 21.7 MB | 35,132 | 131,594 | 617 |
| waterway:stream | 21.5 MB | 54,548 | 372,286 | 393 |
| unknown | 20.8 MB | 34,516 | 71,806 | 603 |
| waterway:drain | 19.5 MB | 65,643 | 263,805 | 297 |
| landuse:farmyard | 13.0 MB | 28,969 | 258,258 | 450 |
| landuse:military | 11.1 MB | 14,484 | 80,744 | 762 |
| natural:coastline | 9.6 MB | 13,251 | 221,892 | 727 |
| landuse:commercial | 9.1 MB | 15,717 | 180,904 | 577 |
| highway:motorway | 8.5 MB | 15,409 | 57,014 | 551 |

## T2

- **Tiles:** 9,236
- **Actual disk size:** 1.57 GB
- **Sampled:** 1000 tiles (10.8%)
- **Estimated feature data:** 1.52 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 998.1 MB | 2,524,143 | 13,391,996 |
| landuse | 273.0 MB | 459,343 | 7,031,006 |
| natural | 141.1 MB | 256,686 | 3,455,981 |
| highway | 129.1 MB | 275,186 | 1,013,965 |
| waterway | 71.9 MB | 248,374 | 952,166 |
| boundary | 12.8 MB | 19,340 | 260,510 |
| leisure | 11.1 MB | 27,901 | 190,695 |
| railway | 9.6 MB | 19,478 | 66,785 |
| amenity | 1.9 MB | 3,140 | 27,079 |
| place | 1.3 MB | 3,435 | 3,435 |
| public_transport | 917 KB | 1,967 | 7,471 |
| aeroway | 575 KB | 1,662 | 7,388 |
| unknown | 416 KB | 840 | 3,740 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 998.1 MB | 2,524,143 | 13,391,996 | 395 |
| landuse:farmland | 77.8 MB | 120,853 | 2,070,387 | 643 |
| landuse:meadow | 72.1 MB | 125,637 | 1,862,513 | 574 |
| natural:scrub | 58.8 MB | 118,617 | 1,362,494 | 495 |
| highway:residential | 52.3 MB | 119,439 | 432,540 | 437 |
| waterway:ditch | 43.9 MB | 163,939 | 521,519 | 267 |
| landuse:forest | 39.5 MB | 50,400 | 1,118,137 | 782 |
| natural:water | 37.4 MB | 74,876 | 880,209 | 498 |
| landuse:residential | 32.3 MB | 54,880 | 832,376 | 588 |
| landuse:grass | 27.6 MB | 58,537 | 638,290 | 471 |
| natural:wetland | 22.4 MB | 29,333 | 609,225 | 763 |
| highway:secondary | 18.1 MB | 34,441 | 110,167 | 526 |
| highway:tertiary | 17.5 MB | 36,223 | 134,236 | 483 |
| highway:unclassified | 17.3 MB | 39,022 | 189,005 | 443 |
| natural:wood | 16.5 MB | 27,024 | 432,725 | 609 |
| waterway:stream | 14.2 MB | 38,227 | 242,805 | 371 |
| boundary:administrative | 12.8 MB | 19,201 | 260,196 | 665 |
| waterway:drain | 11.1 MB | 41,672 | 130,246 | 266 |
| highway:primary | 11.0 MB | 18,943 | 47,759 | 579 |
| landuse:farmyard | 9.0 MB | 19,164 | 205,778 | 471 |
| railway:rail | 6.7 MB | 14,121 | 48,064 | 477 |
| leisure:pitch | 4.8 MB | 13,493 | 68,327 | 358 |
| highway:living_street | 4.6 MB | 11,369 | 41,839 | 400 |
| highway:motorway | 3.1 MB | 5,421 | 20,457 | 570 |
| leisure:playground | 2.9 MB | 7,822 | 47,473 | 375 |
| natural:coastline | 2.8 MB | 2,558 | 83,752 | 1,113 |
| landuse:allotments | 2.5 MB | 5,033 | 50,640 | 491 |
| landuse:commercial | 2.2 MB | 4,479 | 48,119 | 493 |
| landuse:industrial | 2.1 MB | 3,971 | 46,983 | 535 |
| leisure:park | 2.1 MB | 3,408 | 53,698 | 616 |

## T3

- **Tiles:** 159
- **Actual disk size:** 197.9 MB
- **Sampled:** 159 tiles (100.0%)
- **Estimated feature data:** 197.9 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| landuse | 137.7 MB | 364,472 | 2,628,023 |
| highway | 36.0 MB | 69,035 | 146,067 |
| natural | 22.7 MB | 48,240 | 442,780 |
| railway | 7.4 MB | 16,315 | 35,203 |
| leisure | 5.1 MB | 15,105 | 72,791 |
| boundary | 4.9 MB | 9,712 | 79,362 |
| waterway | 1.5 MB | 3,958 | 19,378 |
| amenity | 305 KB | 787 | 2,669 |
| building | 240 KB | 627 | 2,528 |
| place | 122 KB | 195 | 195 |
| unknown | 45 KB | 116 | 491 |
| aeroway | 42 KB | 113 | 233 |
| public_transport | 6 KB | 15 | 46 |
| man_made | 752 B | 1 | 4 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| landuse:meadow | 37.1 MB | 103,547 | 698,717 | 358 |
| landuse:farmland | 35.9 MB | 89,105 | 749,826 | 403 |
| landuse:residential | 18.5 MB | 49,588 | 351,171 | 373 |
| highway:secondary | 18.0 MB | 35,452 | 75,564 | 507 |
| landuse:grass | 17.4 MB | 54,684 | 281,063 | 319 |
| landuse:forest | 16.2 MB | 31,606 | 349,195 | 511 |
| highway:primary | 11.1 MB | 19,619 | 40,340 | 566 |
| natural:wood | 6.0 MB | 14,415 | 107,099 | 416 |
| natural:water | 5.8 MB | 12,612 | 108,048 | 460 |
| natural:scrub | 5.8 MB | 12,566 | 112,556 | 461 |
| landuse:farmyard | 5.7 MB | 17,205 | 91,462 | 328 |
| railway:rail | 5.4 MB | 12,430 | 27,740 | 436 |
| boundary:administrative | 4.9 MB | 9,699 | 79,303 | 508 |
| natural:wetland | 3.9 MB | 6,270 | 91,462 | 627 |
| leisure:playground | 2.7 MB | 8,343 | 34,197 | 323 |
| highway:motorway | 2.5 MB | 4,642 | 10,239 | 531 |
| landuse:commercial | 1.8 MB | 4,988 | 28,582 | 365 |
| leisure:park | 1.5 MB | 3,885 | 26,047 | 376 |
| landuse:industrial | 1.5 MB | 3,634 | 21,929 | 400 |
| highway:motorway_link | 1.3 MB | 2,995 | 6,375 | 427 |
| highway:trunk | 1.3 MB | 2,314 | 4,869 | 545 |
| waterway:river | 860 KB | 2,091 | 13,975 | 411 |
| leisure:garden | 836 KB | 2,649 | 11,497 | 315 |
| highway:trunk_link | 820 KB | 1,783 | 3,700 | 459 |
| railway:light_rail | 801 KB | 1,332 | 2,742 | 601 |
| natural:coastline | 649 KB | 1,277 | 12,524 | 508 |
| landuse:cemetery | 623 KB | 1,713 | 8,829 | 363 |
| landuse:retail | 619 KB | 1,707 | 8,878 | 362 |
| railway:subway | 610 KB | 1,518 | 3,125 | 402 |
| landuse:railway | 523 KB | 1,501 | 8,958 | 348 |

## T4

- **Tiles:** 47
- **Actual disk size:** 28.5 MB
- **Sampled:** 47 tiles (100.0%)
- **Estimated feature data:** 28.5 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| highway | 17.5 MB | 32,658 | 66,007 |
| railway | 5.5 MB | 12,687 | 26,292 |
| boundary | 3.7 MB | 9,200 | 38,603 |
| landuse | 2.7 MB | 3,538 | 70,564 |
| natural | 1.5 MB | 2,751 | 31,452 |
| waterway | 161 KB | 388 | 913 |
| place | 30 KB | 13 | 13 |
| unknown | 3 KB | 6 | 17 |
| building | 834 B | 1 | 5 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| highway:primary | 11.1 MB | 19,560 | 39,376 | 565 |
| railway:rail | 5.3 MB | 12,312 | 25,487 | 432 |
| boundary:administrative | 3.7 MB | 9,195 | 38,569 | 405 |
| landuse:forest | 2.7 MB | 3,532 | 70,532 | 751 |
| highway:motorway | 2.4 MB | 4,596 | 9,427 | 527 |
| highway:motorway_link | 1.3 MB | 2,990 | 5,988 | 424 |
| highway:trunk | 1.2 MB | 2,299 | 4,646 | 543 |
| highway:trunk_link | 816 KB | 1,783 | 3,568 | 457 |
| natural:water | 732 KB | 1,019 | 17,136 | 718 |
| natural:coastline | 447 KB | 1,207 | 5,342 | 370 |
| highway:primary_link | 407 KB | 877 | 1,755 | 463 |
| natural:wood | 350 KB | 513 | 8,895 | 681 |
| railway:narrow_gauge | 141 KB | 353 | 756 | 399 |
| highway:proposed | 138 KB | 365 | 856 | 378 |
| highway:construction | 83 KB | 178 | 369 | 467 |
| waterway:stream | 81 KB | 192 | 425 | 419 |
| waterway:river | 31 KB | 76 | 229 | 411 |
| waterway:ditch | 26 KB | 60 | 130 | 431 |
| place:city | 22 KB | 5 | 5 | 4,497 |
| waterway:drain | 14 KB | 41 | 84 | 345 |
| waterway:canal | 9 KB | 19 | 45 | 451 |
| place:town | 7 KB | 8 | 8 | 930 |
| railway:preserved | 7 KB | 22 | 49 | 321 |
| highway:footway | 3 KB | 7 | 16 | 488 |
| unknown | 3 KB | 6 | 17 | 515 |
| boundary:maritime | 2 KB | 5 | 34 | 493 |
| landuse:construction | 2 KB | 6 | 32 | 385 |
| natural:tree_row | 2 KB | 6 | 15 | 353 |
| natural:wetland | 2 KB | 3 | 28 | 504 |
| natural:heath | 908 B | 1 | 26 | 908 |
