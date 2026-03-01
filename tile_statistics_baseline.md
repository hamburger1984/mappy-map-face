# Tile Statistics

Historical datapoints for comparing tileset size across generations.

---

# Datapoint 1 — 2026-02-22 14:12

Regions: Hamburg, Schleswig-Holstein (2 regions)
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

---

# Datapoint 2 — 2026-02-22 15:10

Regions: Hamburg, Schleswig-Holstein, Mecklenburg-Vorpommern (3 regions)
Changes since datapoint 1: added Mecklenburg-Vorpommern, added construction/planned/proposed railways, code cleanup (removed unused functions)

## Methodology

- Sampled up to 1000 random tiles per tileset
- For each sampled tile, parsed JSON and measured per-feature JSON size
- Categorized features by primary OSM tag (building, highway:residential, etc.)
- Extrapolated to full tileset using sample ratio
- Coordinate counts reflect total vertices across all geometry rings/lines

## T1

- **Tiles:** 469,057
- **Actual disk size:** 4.73 GB
- **Sampled:** 1000 tiles (0.2%)
- **Estimated feature data:** 5.01 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 1.31 GB | 3,520,741 | 21,803,176 |
| highway | 951.8 MB | 1,924,071 | 20,486,064 |
| boundary | 841.5 MB | 492,978 | 31,426,819 |
| waterway | 684.5 MB | 506,581 | 26,334,736 |
| landuse | 555.3 MB | 1,228,929 | 13,164,553 |
| natural | 525.1 MB | 454,047 | 19,135,180 |
| railway | 175.7 MB | 87,244 | 5,992,672 |
| leisure | 27.7 MB | 57,224 | 710,621 |
| unknown | 11.8 MB | 24,860 | 81,146 |
| amenity | 9.8 MB | 22,983 | 69,420 |
| place | 2.7 MB | 11,257 | 11,257 |
| shop | 2.5 MB | 5,628 | 5,628 |
| public_transport | 1005 KB | 2,345 | 12,195 |
| aeroway | 97 KB | 469 | 469 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| boundary:administrative | 759.1 MB | 409,017 | 28,740,060 | 1946 |
| building | 550.5 MB | 1,576,969 | 9,790,626 | 366 |
| waterway:river | 420.3 MB | 76,456 | 17,766,941 | 5763 |
| natural:coastline | 301.6 MB | 42,684 | 13,177,687 | 7409 |
| highway:track | 222.4 MB | 384,626 | 6,101,962 | 606 |
| building:house | 209.8 MB | 483,597 | 2,811,527 | 454 |
| landuse:farmland | 179.1 MB | 415,584 | 4,078,919 | 451 |
| railway:rail | 155.6 MB | 77,863 | 5,335,523 | 2095 |
| highway:path | 144.3 MB | 258,450 | 3,648,794 | 585 |
| building:detached | 138.3 MB | 324,587 | 1,998,651 | 446 |
| landuse:meadow | 133.7 MB | 303,010 | 3,275,425 | 462 |
| highway:service | 126.7 MB | 390,255 | 1,888,423 | 340 |
| highway:residential | 119.8 MB | 240,626 | 1,852,775 | 522 |
| waterway:stream | 105.9 MB | 91,935 | 3,987,922 | 1207 |
| building:apartments | 100.0 MB | 193,720 | 1,548,357 | 541 |
| highway:footway | 86.2 MB | 236,873 | 1,513,177 | 381 |
| natural:scrub | 83.5 MB | 179,648 | 2,142,183 | 487 |
| waterway:ditch | 83.3 MB | 262,671 | 1,876,228 | 332 |
| boundary:maritime | 82.4 MB | 83,961 | 2,686,758 | 1029 |
| landuse:forest | 78.3 MB | 160,886 | 1,864,032 | 510 |
| natural:water | 76.8 MB | 119,609 | 2,144,059 | 673 |
| highway:unclassified | 67.9 MB | 110,697 | 1,808,214 | 643 |
| building:garage | 67.6 MB | 234,997 | 1,282,401 | 301 |
| landuse:residential | 66.6 MB | 140,717 | 1,684,852 | 496 |
| building:semidetached_house | 64.4 MB | 139,778 | 763,155 | 482 |
| highway:tertiary | 59.5 MB | 96,156 | 1,155,756 | 648 |
| waterway:canal | 54.2 MB | 22,045 | 2,131,864 | 2576 |
| highway:secondary | 47.0 MB | 78,801 | 826,009 | 625 |
| building:shed | 42.5 MB | 146,345 | 790,830 | 304 |
| landuse:grass | 42.2 MB | 93,811 | 1,101,814 | 471 |

## T2

- **Tiles:** 12,684
- **Actual disk size:** 1.52 GB
- **Sampled:** 1000 tiles (7.9%)
- **Estimated feature data:** 1.54 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 953.6 MB | 2,712,803 | 14,403,899 |
| landuse | 233.7 MB | 456,649 | 6,826,528 |
| natural | 126.7 MB | 244,167 | 3,707,355 |
| highway | 120.7 MB | 297,972 | 1,246,723 |
| waterway | 84.3 MB | 280,912 | 1,715,054 |
| boundary | 34.9 MB | 30,568 | 1,193,589 |
| railway | 9.9 MB | 15,867 | 143,215 |
| leisure | 9.6 MB | 27,054 | 195,206 |
| amenity | 2.0 MB | 3,576 | 31,481 |
| place | 1.1 MB | 3,500 | 3,500 |
| public_transport | 1.0 MB | 2,650 | 9,779 |
| aeroway | 942 KB | 2,968 | 15,246 |
| unknown | 381 KB | 634 | 4,122 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 537.6 MB | 1,637,517 | 8,698,953 | 344 |
| building:house | 131.4 MB | 309,743 | 1,605,046 | 444 |
| building:detached | 92.9 MB | 229,174 | 1,224,830 | 425 |
| landuse:farmland | 66.2 MB | 122,476 | 1,973,376 | 567 |
| landuse:meadow | 62.9 MB | 127,740 | 1,840,537 | 516 |
| highway:residential | 49.0 MB | 130,886 | 504,658 | 392 |
| natural:scrub | 46.3 MB | 107,471 | 1,221,951 | 451 |
| waterway:ditch | 44.0 MB | 188,319 | 621,046 | 244 |
| building:apartments | 39.3 MB | 91,819 | 502,882 | 448 |
| building:garage | 33.1 MB | 118,874 | 591,670 | 291 |
| landuse:forest | 33.0 MB | 49,543 | 1,062,487 | 699 |
| boundary:administrative | 32.7 MB | 28,234 | 1,118,906 | 1212 |
| natural:water | 32.2 MB | 74,746 | 865,733 | 451 |
| building:semidetached_house | 31.1 MB | 69,571 | 354,670 | 468 |
| landuse:residential | 28.9 MB | 56,367 | 852,123 | 537 |
| landuse:grass | 21.8 MB | 51,725 | 588,842 | 442 |
| natural:wetland | 18.7 MB | 28,107 | 577,781 | 696 |
| building:residential | 18.2 MB | 48,161 | 260,985 | 395 |
| highway:unclassified | 16.9 MB | 42,668 | 256,369 | 414 |
| highway:tertiary | 16.5 MB | 38,305 | 170,587 | 451 |
| waterway:stream | 16.2 MB | 37,696 | 424,584 | 450 |
| highway:secondary | 16.2 MB | 35,819 | 129,275 | 473 |
| natural:wood | 13.8 MB | 25,406 | 414,563 | 568 |
| natural:coastline | 13.1 MB | 4,160 | 547,048 | 3300 |
| waterway:drain | 11.3 MB | 48,820 | 161,086 | 243 |
| waterway:river | 11.2 MB | 4,350 | 456,801 | 2707 |
| highway:primary | 9.5 MB | 19,710 | 54,921 | 507 |
| building:shed | 8.6 MB | 31,202 | 156,660 | 289 |
| landuse:farmyard | 7.9 MB | 19,533 | 202,741 | 423 |
| railway:rail | 7.7 MB | 11,973 | 116,857 | 671 |

## T3

- **Tiles:** 180
- **Actual disk size:** 190.4 MB
- **Sampled:** 180 tiles (100.0%)
- **Estimated feature data:** 189.9 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| landuse | 119.9 MB | 364,472 | 2,628,023 |
| highway | 31.5 MB | 69,305 | 147,064 |
| natural | 19.9 MB | 48,266 | 445,348 |
| railway | 7.4 MB | 16,677 | 36,945 |
| boundary | 4.7 MB | 9,977 | 92,089 |
| leisure | 4.4 MB | 15,105 | 72,791 |
| waterway | 1.4 MB | 4,025 | 23,771 |
| amenity | 273 KB | 787 | 2,669 |
| building | 214 KB | 628 | 2,533 |
| place | 111 KB | 195 | 195 |
| unknown | 41 KB | 117 | 512 |
| aeroway | 38 KB | 115 | 237 |
| public_transport | 6 KB | 15 | 46 |
| man_made | 698 B | 1 | 4 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| landuse:meadow | 32.3 MB | 103,547 | 698,717 | 326 |
| landuse:farmland | 31.3 MB | 89,105 | 749,826 | 368 |
| landuse:residential | 16.1 MB | 49,588 | 351,171 | 340 |
| highway:secondary | 15.7 MB | 35,592 | 76,014 | 463 |
| landuse:grass | 15.2 MB | 54,684 | 281,063 | 290 |
| landuse:forest | 14.1 MB | 31,606 | 349,195 | 468 |
| highway:primary | 9.7 MB | 19,690 | 40,515 | 518 |
| railway:rail | 5.5 MB | 12,537 | 28,632 | 463 |
| natural:wood | 5.2 MB | 14,415 | 107,099 | 380 |
| natural:scrub | 5.1 MB | 12,566 | 112,556 | 423 |
| natural:water | 5.1 MB | 12,605 | 108,015 | 421 |
| landuse:farmyard | 4.9 MB | 17,205 | 91,462 | 299 |
| boundary:administrative | 4.6 MB | 9,953 | 91,369 | 487 |
| natural:wetland | 3.4 MB | 6,270 | 91,462 | 575 |
| leisure:playground | 2.3 MB | 8,343 | 34,197 | 295 |
| highway:motorway | 2.2 MB | 4,681 | 10,451 | 485 |
| landuse:commercial | 1.6 MB | 4,988 | 28,582 | 334 |
| leisure:park | 1.3 MB | 3,885 | 26,047 | 343 |
| landuse:industrial | 1.3 MB | 3,634 | 21,929 | 367 |
| highway:motorway_link | 1.1 MB | 2,998 | 6,382 | 389 |
| highway:trunk | 1.1 MB | 2,324 | 4,922 | 497 |
| waterway:river | 863 KB | 2,136 | 17,823 | 413 |
| leisure:garden | 744 KB | 2,649 | 11,497 | 287 |
| highway:trunk_link | 729 KB | 1,783 | 3,700 | 418 |
| railway:light_rail | 715 KB | 1,332 | 2,744 | 550 |
| natural:coastline | 645 KB | 1,309 | 15,120 | 504 |
| landuse:cemetery | 556 KB | 1,713 | 8,829 | 332 |
| landuse:retail | 552 KB | 1,707 | 8,878 | 331 |
| railway:subway | 541 KB | 1,519 | 3,127 | 364 |
| landuse:railway | 466 KB | 1,501 | 8,958 | 317 |

## T4

- **Tiles:** 56
- **Actual disk size:** 28.2 MB
- **Sampled:** 56 tiles (100.0%)
- **Estimated feature data:** 28.2 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| highway | 15.3 MB | 32,754 | 66,243 |
| railway | 5.7 MB | 13,012 | 27,148 |
| boundary | 3.4 MB | 9,363 | 40,959 |
| landuse | 2.3 MB | 3,538 | 70,564 |
| natural | 1.4 MB | 2,770 | 31,760 |
| waterway | 144 KB | 388 | 916 |
| place | 28 KB | 13 | 13 |
| unknown | 3 KB | 7 | 32 |
| building | 1 KB | 2 | 10 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| highway:primary | 9.7 MB | 19,609 | 39,479 | 517 |
| railway:rail | 5.4 MB | 12,394 | 25,750 | 457 |
| boundary:administrative | 3.3 MB | 9,355 | 40,759 | 375 |
| landuse:forest | 2.3 MB | 3,532 | 70,532 | 690 |
| highway:motorway | 2.1 MB | 4,620 | 9,495 | 482 |
| highway:motorway_link | 1.1 MB | 2,996 | 6,000 | 387 |
| highway:trunk | 1.1 MB | 2,309 | 4,668 | 495 |
| highway:trunk_link | 726 KB | 1,783 | 3,568 | 417 |
| natural:water | 656 KB | 1,019 | 17,136 | 659 |
| natural:coastline | 410 KB | 1,226 | 5,650 | 342 |
| highway:primary_link | 363 KB | 879 | 1,759 | 423 |
| natural:wood | 313 KB | 513 | 8,895 | 625 |
| railway:narrow_gauge | 150 KB | 357 | 764 | 430 |
| highway:proposed | 125 KB | 368 | 877 | 346 |
| highway:construction | 75 KB | 178 | 371 | 429 |
| waterway:stream | 72 KB | 192 | 425 | 385 |
| railway:proposed | 71 KB | 129 | 352 | 561 |
| railway:construction | 66 KB | 109 | 228 | 624 |
| waterway:river | 28 KB | 76 | 232 | 375 |
| waterway:ditch | 23 KB | 60 | 130 | 398 |
| place:city | 21 KB | 5 | 5 | 4260 |
| waterway:drain | 13 KB | 41 | 84 | 314 |
| railway:preserved | 8 KB | 23 | 54 | 359 |
| waterway:canal | 8 KB | 19 | 45 | 411 |
| place:town | 7 KB | 8 | 8 | 873 |
| boundary:maritime | 7 KB | 8 | 200 | 863 |
| highway:footway | 4 KB | 7 | 16 | 516 |
| unknown | 3 KB | 7 | 32 | 508 |
| landuse:construction | 2 KB | 6 | 32 | 352 |
| highway:residential | 2 KB | 3 | 6 | 667 |

---

# Datapoint 3 — 2026-02-22 19:40

Regions: Hamburg, Schleswig-Holstein, Mecklenburg-Vorpommern (3 regions)
Changes since datapoint 2: same regions and code, regenerated to verify reproducibility

## Methodology

- Sampled up to 1000 random tiles per tileset
- For each sampled tile, parsed JSON and measured per-feature JSON size
- Categorized features by primary OSM tag (building, highway:residential, etc.)
- Extrapolated to full tileset using sample ratio
- Coordinate counts reflect total vertices across all geometry rings/lines

## T1

- **Tiles:** 469,057
- **Actual disk size:** 4.74 GB
- **Sampled:** 1000 tiles (0.2%)
- **Estimated feature data:** 4.57 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 1021.6 MB | 2,866,876 | 17,091,498 |
| highway | 901.7 MB | 1,750,989 | 19,883,326 |
| boundary | 898.6 MB | 518,777 | 33,689,080 |
| waterway | 613.3 MB | 511,741 | 23,259,598 |
| landuse | 539.8 MB | 1,161,385 | 12,912,670 |
| natural | 483.7 MB | 413,239 | 17,659,996 |
| railway | 174.3 MB | 98,501 | 5,744,072 |
| amenity | 13.1 MB | 31,895 | 77,394 |
| leisure | 12.7 MB | 31,426 | 252,821 |
| unknown | 11.7 MB | 23,921 | 73,172 |
| shop | 7.6 MB | 21,107 | 21,107 |
| place | 2.5 MB | 9,850 | 9,850 |
| public_transport | 432 KB | 938 | 4,690 |
| aeroway | 149 KB | 469 | 2,345 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| boundary:administrative | 812.5 MB | 431,063 | 30,882,243 | 1976 |
| building | 612.9 MB | 1,808,683 | 10,492,336 | 355 |
| waterway:river | 337.3 MB | 61,446 | 14,309,521 | 5755 |
| natural:coastline | 297.4 MB | 44,091 | 12,842,780 | 7072 |
| highway:track | 218.4 MB | 378,059 | 5,957,492 | 605 |
| landuse:farmland | 182.7 MB | 411,832 | 4,211,193 | 465 |
| railway:rail | 154.9 MB | 82,554 | 5,208,408 | 1967 |
| highway:path | 132.9 MB | 213,889 | 3,583,126 | 651 |
| landuse:meadow | 132.0 MB | 285,655 | 3,331,711 | 484 |
| waterway:stream | 126.1 MB | 88,182 | 4,887,104 | 1499 |
| highway:service | 113.5 MB | 339,597 | 1,785,230 | 350 |
| highway:residential | 96.0 MB | 201,694 | 1,629,973 | 499 |
| waterway:ditch | 93.5 MB | 299,727 | 2,084,020 | 327 |
| building:house | 93.3 MB | 219,049 | 1,265,046 | 446 |
| landuse:forest | 86.6 MB | 169,798 | 2,110,756 | 534 |
| boundary:maritime | 86.1 MB | 87,713 | 2,806,837 | 1029 |
| highway:unclassified | 75.8 MB | 116,795 | 1,973,791 | 680 |
| natural:scrub | 71.6 MB | 151,505 | 1,869,192 | 495 |
| building:detached | 71.3 MB | 173,082 | 1,129,958 | 431 |
| highway:footway | 69.5 MB | 189,029 | 1,130,896 | 385 |
| landuse:residential | 57.9 MB | 121,485 | 1,493,477 | 500 |
| highway:secondary | 54.1 MB | 89,589 | 948,433 | 633 |
| building:apartments | 52.6 MB | 110,228 | 879,012 | 500 |
| highway:tertiary | 50.0 MB | 79,739 | 1,163,261 | 657 |
| natural:water | 49.1 MB | 93,811 | 1,296,942 | 548 |
| waterway:canal | 39.7 MB | 16,886 | 1,548,357 | 2463 |
| building:garage | 37.8 MB | 132,743 | 703,116 | 298 |
| natural:wetland | 36.5 MB | 68,482 | 894,491 | 558 |
| building:terrace | 33.3 MB | 86,775 | 453,578 | 402 |
| landuse:grass | 31.6 MB | 68,013 | 836,328 | 487 |

## T2

- **Tiles:** 12,684
- **Actual disk size:** 1.52 GB
- **Sampled:** 1000 tiles (7.9%)
- **Estimated feature data:** 1.47 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 879.0 MB | 2,570,298 | 13,664,270 |
| landuse | 235.7 MB | 453,668 | 6,936,663 |
| natural | 130.8 MB | 249,836 | 3,848,832 |
| highway | 122.3 MB | 295,182 | 1,223,485 |
| waterway | 76.6 MB | 244,674 | 1,629,767 |
| boundary | 35.4 MB | 29,515 | 1,224,208 |
| railway | 13.6 MB | 25,545 | 167,428 |
| leisure | 9.8 MB | 28,678 | 197,845 |
| amenity | 2.0 MB | 3,754 | 35,565 |
| place | 1.2 MB | 3,513 | 3,513 |
| public_transport | 983 KB | 2,549 | 8,764 |
| unknown | 292 KB | 520 | 3,107 |
| aeroway | 131 KB | 418 | 2,016 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 506.3 MB | 1,566,613 | 8,298,392 | 338 |
| building:house | 86.6 MB | 212,837 | 1,115,659 | 426 |
| landuse:farmland | 67.6 MB | 120,079 | 2,055,239 | 590 |
| building:detached | 67.3 MB | 170,625 | 903,138 | 413 |
| landuse:meadow | 61.1 MB | 122,666 | 1,793,860 | 521 |
| natural:scrub | 50.7 MB | 116,857 | 1,345,100 | 454 |
| highway:residential | 48.8 MB | 126,903 | 479,150 | 403 |
| building:apartments | 45.9 MB | 106,406 | 594,435 | 452 |
| waterway:ditch | 35.9 MB | 152,626 | 514,095 | 246 |
| landuse:forest | 34.6 MB | 50,127 | 1,127,100 | 724 |
| boundary:administrative | 33.2 MB | 27,257 | 1,151,960 | 1277 |
| natural:water | 32.6 MB | 71,867 | 898,597 | 474 |
| building:garage | 32.5 MB | 117,821 | 589,514 | 289 |
| landuse:residential | 28.6 MB | 56,786 | 837,841 | 528 |
| building:residential | 24.7 MB | 64,853 | 348,810 | 400 |
| landuse:grass | 23.3 MB | 55,860 | 623,139 | 437 |
| natural:wetland | 18.7 MB | 26,788 | 592,013 | 732 |
| building:semidetached_house | 18.4 MB | 44,254 | 228,413 | 436 |
| highway:unclassified | 17.9 MB | 44,394 | 267,607 | 423 |
| highway:secondary | 17.7 MB | 37,937 | 142,339 | 489 |
| waterway:stream | 16.0 MB | 39,802 | 399,723 | 420 |
| highway:tertiary | 14.2 MB | 32,217 | 141,642 | 462 |
| natural:wood | 12.7 MB | 24,721 | 375,662 | 539 |
| waterway:river | 12.6 MB | 4,616 | 513,562 | 2855 |
| natural:coastline | 12.5 MB | 3,779 | 523,012 | 3464 |
| building:allotment_house | 12.4 MB | 41,413 | 206,622 | 313 |
| railway:rail | 11.3 MB | 20,928 | 145,561 | 566 |
| building:cabin | 10.9 MB | 38,851 | 193,583 | 295 |
| waterway:drain | 10.5 MB | 45,649 | 147,514 | 242 |
| building:shed | 8.8 MB | 32,115 | 159,552 | 288 |

## T3

- **Tiles:** 180
- **Actual disk size:** 190.4 MB
- **Sampled:** 180 tiles (100.0%)
- **Estimated feature data:** 189.9 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| landuse | 120.0 MB | 364,596 | 2,628,477 |
| highway | 31.5 MB | 69,317 | 147,079 |
| natural | 19.9 MB | 48,267 | 445,274 |
| railway | 7.4 MB | 16,676 | 36,931 |
| boundary | 4.7 MB | 9,977 | 92,064 |
| leisure | 4.4 MB | 15,111 | 72,816 |
| waterway | 1.4 MB | 4,024 | 23,766 |
| amenity | 271 KB | 782 | 2,664 |
| building | 214 KB | 628 | 2,533 |
| place | 111 KB | 195 | 195 |
| unknown | 41 KB | 117 | 512 |
| aeroway | 38 KB | 115 | 237 |
| public_transport | 6 KB | 15 | 46 |
| man_made | 698 B | 1 | 4 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| landuse:meadow | 32.3 MB | 103,620 | 699,078 | 326 |
| landuse:farmland | 31.3 MB | 89,120 | 749,919 | 368 |
| landuse:residential | 16.1 MB | 49,589 | 351,182 | 340 |
| highway:secondary | 15.7 MB | 35,598 | 76,021 | 463 |
| landuse:grass | 15.2 MB | 54,723 | 281,226 | 290 |
| landuse:forest | 14.1 MB | 31,606 | 349,056 | 468 |
| highway:primary | 9.7 MB | 19,695 | 40,525 | 518 |
| railway:rail | 5.5 MB | 12,535 | 28,614 | 463 |
| natural:wood | 5.2 MB | 14,414 | 107,103 | 380 |
| natural:scrub | 5.1 MB | 12,569 | 112,569 | 423 |
| natural:water | 5.1 MB | 12,606 | 107,952 | 421 |
| landuse:farmyard | 4.9 MB | 17,197 | 91,416 | 299 |
| boundary:administrative | 4.6 MB | 9,953 | 91,344 | 487 |
| natural:wetland | 3.4 MB | 6,270 | 91,462 | 575 |
| leisure:playground | 2.3 MB | 8,349 | 34,222 | 295 |
| highway:motorway | 2.2 MB | 4,681 | 10,451 | 485 |
| landuse:commercial | 1.6 MB | 4,991 | 28,596 | 334 |
| leisure:park | 1.3 MB | 3,885 | 26,047 | 343 |
| landuse:industrial | 1.3 MB | 3,631 | 21,911 | 367 |
| highway:motorway_link | 1.1 MB | 2,998 | 6,382 | 389 |
| highway:trunk | 1.1 MB | 2,325 | 4,924 | 497 |
| waterway:river | 863 KB | 2,136 | 17,823 | 413 |
| leisure:garden | 744 KB | 2,649 | 11,497 | 287 |
| highway:trunk_link | 729 KB | 1,783 | 3,700 | 418 |
| railway:light_rail | 715 KB | 1,332 | 2,744 | 550 |
| natural:coastline | 645 KB | 1,309 | 15,120 | 504 |
| landuse:cemetery | 556 KB | 1,713 | 8,829 | 332 |
| landuse:retail | 552 KB | 1,707 | 8,878 | 331 |
| railway:subway | 541 KB | 1,519 | 3,127 | 364 |
| landuse:railway | 466 KB | 1,501 | 8,958 | 317 |

## T4

- **Tiles:** 56
- **Actual disk size:** 28.2 MB
- **Sampled:** 56 tiles (100.0%)
- **Estimated feature data:** 28.2 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| highway | 15.3 MB | 32,759 | 66,253 |
| railway | 5.7 MB | 13,011 | 27,143 |
| boundary | 3.4 MB | 9,363 | 40,956 |
| landuse | 2.3 MB | 3,539 | 70,584 |
| natural | 1.4 MB | 2,770 | 31,760 |
| waterway | 144 KB | 388 | 916 |
| place | 28 KB | 13 | 13 |
| unknown | 3 KB | 7 | 32 |
| building | 1 KB | 2 | 10 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| highway:primary | 9.7 MB | 19,614 | 39,489 | 517 |
| railway:rail | 5.4 MB | 12,393 | 25,745 | 457 |
| boundary:administrative | 3.3 MB | 9,355 | 40,756 | 375 |
| landuse:forest | 2.3 MB | 3,533 | 70,552 | 690 |
| highway:motorway | 2.1 MB | 4,620 | 9,495 | 482 |
| highway:motorway_link | 1.1 MB | 2,996 | 6,000 | 387 |
| highway:trunk | 1.1 MB | 2,310 | 4,670 | 495 |
| highway:trunk_link | 726 KB | 1,783 | 3,568 | 417 |
| natural:water | 656 KB | 1,019 | 17,136 | 659 |
| natural:coastline | 410 KB | 1,226 | 5,650 | 342 |
| highway:primary_link | 363 KB | 879 | 1,759 | 423 |
| natural:wood | 313 KB | 513 | 8,895 | 625 |
| railway:narrow_gauge | 150 KB | 357 | 764 | 430 |
| highway:proposed | 125 KB | 368 | 877 | 346 |
| highway:construction | 75 KB | 178 | 371 | 430 |
| waterway:stream | 72 KB | 192 | 425 | 385 |
| railway:proposed | 71 KB | 129 | 352 | 561 |
| railway:construction | 66 KB | 109 | 228 | 624 |
| waterway:river | 28 KB | 76 | 232 | 375 |
| waterway:ditch | 23 KB | 60 | 130 | 398 |
| place:city | 21 KB | 5 | 5 | 4260 |
| waterway:drain | 13 KB | 41 | 84 | 314 |
| railway:preserved | 8 KB | 23 | 54 | 359 |
| waterway:canal | 8 KB | 19 | 45 | 411 |
| place:town | 7 KB | 8 | 8 | 873 |
| boundary:maritime | 7 KB | 8 | 200 | 863 |
| highway:footway | 4 KB | 7 | 16 | 516 |
| unknown | 3 KB | 7 | 32 | 508 |
| landuse:construction | 2 KB | 6 | 32 | 352 |
| highway:residential | 2 KB | 3 | 6 | 667 |

---

# Datapoint 4 — 2026-02-23 05:43

Regions: Hamburg, Schleswig-Holstein, Mecklenburg-Vorpommern, Niedersachsen, Denmark (5 regions)
Changes since datapoint 3: added Niedersachsen + Denmark, fixed tag matching (match_all for boundaries), added state/district/maritime boundary types, excluded buildings/platforms from polygon clipping

## T1

- **Tiles:** 1,006,190
- **Actual disk size:** 14.85 GB
- **Sampled:** 1000 tiles (0.1%)
- **Estimated feature data:** 16.07 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 5.15 GB | 14,140,994 | 101,704,679 |
| highway | 3.87 GB | 8,142,089 | 85,576,459 |
| waterway | 2.04 GB | 1,539,470 | 81,799,222 |
| landuse | 2.01 GB | 4,594,263 | 48,667,397 |
| natural | 1.89 GB | 1,186,298 | 75,723,847 |
| railway | 454.4 MB | 349,147 | 13,134,804 |
| boundary | 447.0 MB | 96,594 | 19,072,331 |
| amenity | 93.4 MB | 226,392 | 491,020 |
| shop | 65.3 MB | 189,163 | 189,163 |
| leisure | 36.6 MB | 83,513 | 862,304 |
| unknown | 35.5 MB | 78,482 | 197,213 |
| place | 10.2 MB | 40,247 | 40,247 |
| aeroway | 4.9 MB | 9,055 | 130,804 |
| public_transport | 797 KB | 2,012 | 4,024 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 3.34 GB | 9,646,343 | 67,763,877 | 371 |
| natural:coastline | 1.39 GB | 178,095 | 62,556,844 | 8404 |
| waterway:river | 1.25 GB | 219,349 | 55,602,059 | 6121 |
| landuse:farmland | 740.4 MB | 1,715,553 | 17,090,137 | 452 |
| highway:track | 703.5 MB | 1,309,053 | 18,525,970 | 563 |
| highway:service | 647.7 MB | 1,975,150 | 10,152,457 | 343 |
| highway:path | 530.7 MB | 980,029 | 13,422,574 | 567 |
| boundary:administrative | 447.0 MB | 96,594 | 19,072,331 | 4852 |
| highway:residential | 439.8 MB | 1,006,190 | 6,698,206 | 458 |
| building:house | 403.1 MB | 937,769 | 5,674,911 | 450 |
| railway:rail | 394.4 MB | 280,727 | 11,496,726 | 1473 |
| landuse:forest | 384.9 MB | 807,970 | 9,298,201 | 499 |
| building:apartments | 379.0 MB | 776,778 | 6,569,414 | 511 |
| landuse:meadow | 377.2 MB | 863,311 | 9,219,718 | 458 |
| building:detached | 352.2 MB | 884,441 | 7,635,975 | 417 |
| highway:unclassified | 348.2 MB | 484,983 | 10,029,701 | 752 |
| waterway:stream | 331.7 MB | 311,918 | 12,442,545 | 1115 |
| highway:footway | 308.0 MB | 956,886 | 4,802,544 | 337 |
| highway:tertiary | 299.6 MB | 460,835 | 6,753,547 | 681 |
| waterway:ditch | 212.5 MB | 648,992 | 4,849,835 | 343 |
| natural:water | 198.0 MB | 353,172 | 5,589,385 | 587 |
| waterway:canal | 176.2 MB | 90,557 | 7,011,131 | 2040 |
| highway:secondary | 173.6 MB | 251,547 | 3,311,371 | 723 |
| landuse:residential | 168.7 MB | 361,222 | 4,244,109 | 489 |
| natural:scrub | 156.2 MB | 353,172 | 3,877,856 | 463 |
| highway:cycleway | 149.0 MB | 211,299 | 4,296,431 | 739 |
| landuse:grass | 133.6 MB | 287,770 | 3,582,036 | 486 |
| building:residential | 119.0 MB | 287,770 | 1,833,278 | 433 |
| building:garage | 114.1 MB | 375,308 | 2,098,912 | 318 |
| highway:motorway | 111.8 MB | 94,581 | 2,778,090 | 1239 |

## T2

- **Tiles:** 49,977
- **Actual disk size:** 5.73 GB
- **Sampled:** 1000 tiles (2.0%)
- **Estimated feature data:** 6.43 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 4.08 GB | 12,225,523 | 68,882,049 |
| landuse | 902.7 MB | 1,947,153 | 25,333,091 |
| highway | 583.9 MB | 1,395,607 | 5,604,120 |
| natural | 317.5 MB | 630,709 | 9,280,229 |
| waterway | 240.5 MB | 691,931 | 5,566,738 |
| boundary | 237.8 MB | 52,126 | 10,064,518 |
| railway | 67.9 MB | 118,595 | 581,182 |
| leisure | 38.1 MB | 104,601 | 804,379 |
| amenity | 13.1 MB | 23,289 | 207,354 |
| place | 3.9 MB | 12,444 | 12,444 |
| public_transport | 3.4 MB | 8,296 | 24,738 |
| aeroway | 2.1 MB | 5,797 | 40,231 |
| unknown | 580 KB | 1,599 | 10,745 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 2.25 GB | 7,348,768 | 41,353,168 | 329 |
| building:house | 437.7 MB | 1,085,350 | 5,789,235 | 422 |
| building:detached | 380.3 MB | 996,291 | 5,866,500 | 400 |
| building:apartments | 334.4 MB | 760,350 | 4,370,788 | 461 |
| landuse:farmland | 268.9 MB | 561,591 | 7,634,136 | 502 |
| highway:residential | 260.1 MB | 683,285 | 2,386,501 | 399 |
| boundary:administrative | 196.3 MB | 27,837 | 8,547,466 | 7393 |
| landuse:meadow | 178.8 MB | 388,021 | 5,095,754 | 483 |
| landuse:forest | 175.7 MB | 320,202 | 5,343,191 | 575 |
| building:residential | 146.9 MB | 380,724 | 2,106,030 | 404 |
| building:garage | 126.1 MB | 438,348 | 2,189,492 | 301 |
| natural:water | 106.5 MB | 245,936 | 2,894,318 | 453 |
| highway:tertiary | 100.7 MB | 217,699 | 945,165 | 484 |
| natural:scrub | 97.9 MB | 235,891 | 2,540,730 | 435 |
| waterway:ditch | 96.7 MB | 405,313 | 1,367,370 | 250 |
| landuse:residential | 96.6 MB | 194,960 | 2,815,904 | 519 |
| building:semidetached_house | 85.4 MB | 195,160 | 1,011,734 | 458 |
| landuse:grass | 77.5 MB | 209,103 | 1,942,006 | 388 |
| highway:unclassified | 72.3 MB | 175,969 | 1,088,199 | 430 |
| highway:secondary | 62.4 MB | 128,240 | 419,456 | 510 |
| waterway:river | 54.7 MB | 19,840 | 2,280,150 | 2893 |
| waterway:stream | 52.6 MB | 131,039 | 1,304,699 | 421 |
| landuse:farmyard | 49.8 MB | 138,086 | 1,204,745 | 378 |
| railway:rail | 44.8 MB | 75,465 | 384,722 | 622 |
| boundary:maritime | 41.5 MB | 24,288 | 1,517,051 | 1792 |
| natural:wood | 37.2 MB | 77,914 | 1,075,005 | 500 |
| natural:coastline | 34.6 MB | 9,545 | 1,467,624 | 3799 |

## T3

- **Tiles:** 606
- **Actual disk size:** 709.6 MB
- **Sampled:** 606 tiles (100.0%)
- **Estimated feature data:** 707.6 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| landuse | 507.8 MB | 1,576,632 | 10,893,675 |
| highway | 93.4 MB | 205,502 | 440,724 |
| natural | 54.0 MB | 135,723 | 1,183,255 |
| railway | 25.5 MB | 52,347 | 115,787 |
| leisure | 15.8 MB | 54,778 | 254,633 |
| waterway | 6.2 MB | 19,624 | 100,716 |
| boundary | 2.4 MB | 1,892 | 81,606 |
| building | 1015 KB | 2,960 | 12,014 |
| amenity | 1002 KB | 2,996 | 11,663 |
| place | 330 KB | 666 | 666 |
| unknown | 148 KB | 477 | 2,062 |
| aeroway | 142 KB | 451 | 928 |
| public_transport | 41 KB | 117 | 214 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| landuse:farmland | 156.5 MB | 469,955 | 3,605,907 | 349 |
| landuse:meadow | 108.0 MB | 354,402 | 2,294,932 | 319 |
| landuse:forest | 86.1 MB | 215,549 | 1,960,197 | 418 |
| landuse:residential | 50.1 MB | 155,356 | 1,089,875 | 338 |
| landuse:grass | 45.7 MB | 168,030 | 832,473 | 284 |
| highway:secondary | 45.1 MB | 102,902 | 220,713 | 459 |
| landuse:farmyard | 40.3 MB | 146,321 | 729,703 | 288 |
| highway:primary | 26.6 MB | 55,030 | 114,574 | 507 |
| railway:rail | 21.4 MB | 43,353 | 97,593 | 516 |
| natural:water | 17.8 MB | 47,666 | 361,442 | 390 |
| natural:wood | 14.8 MB | 42,688 | 292,296 | 364 |
| natural:scrub | 9.5 MB | 23,563 | 212,738 | 423 |
| highway:motorway | 8.2 MB | 15,383 | 34,722 | 556 |
| natural:wetland | 7.1 MB | 12,475 | 193,900 | 597 |
| boundary:administrative | 2.0 MB | 1,541 | 67,027 | 1345 |
| natural:coastline | 2.1 MB | 4,099 | 54,778 | 536 |

## T4

- **Tiles:** 177
- **Actual disk size:** 82.5 MB
- **Sampled:** 177 tiles (100.0%)
- **Estimated feature data:** 82.3 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| highway | 46.6 MB | 98,901 | 201,285 |
| railway | 21.9 MB | 45,146 | 93,665 |
| landuse | 9.6 MB | 13,478 | 303,658 |
| natural | 3.5 MB | 7,530 | 84,426 |
| boundary | 524 KB | 584 | 14,040 |
| place | 69 KB | 46 | 46 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| highway:primary | 26.4 MB | 54,788 | 111,128 | 506 |
| railway:rail | 20.9 MB | 42,863 | 88,651 | 511 |
| landuse:forest | 9.6 MB | 13,469 | 303,609 | 748 |
| highway:motorway | 8.0 MB | 15,165 | 31,187 | 551 |
| highway:motorway_link | 4.3 MB | 10,928 | 21,950 | 409 |
| highway:trunk | 4.0 MB | 8,128 | 16,361 | 516 |
| natural:water | 1.6 MB | 2,720 | 44,812 | 628 |
| natural:coastline | 1.3 MB | 3,828 | 21,469 | 355 |
| boundary:administrative | 413 KB | 447 | 10,963 | 946 |
| boundary:maritime | 111 KB | 137 | 3,077 | 829 |

---

# Datapoint 5 — 2026-03-01 09:19

Regions: Hamburg, Schleswig-Holstein (2 regions)
Changes since datapoint 4: base_land polygon layer (authoritative land/ocean backgrounds), sports facilities (sports_pitch, sports_facility, miniature_golf) in T1/T2, highway:track now included in T2 as dashed lines, natural=sand added, military crosshatch rendering

## New behaviors vs. previous builds

### `unknown` group now appears across all tilesets — these are `base_land` synthetic features

The `unknown` group is now significant in all tilesets. Features with `properties: {"base_land": true}` are synthetic land polygons clipped from the global OSM land polygon dataset. Since `base_land` is not a standard OSM tag, the statistics script categorises them as `unknown`. This is expected and correct.

- T1: ~83% of tiles (122,015 / 146,302) have one base_land feature → ~122K `unknown` features, 379 bytes avg, ~5 coords/feature (simple inland polygons)
- T2: ~38% of tiles (4,184 / 10,982) → T2 has more coastal tiles with no land
- T3: ~87% of tiles (127 / 146)
- T4: ~62% of tiles (28 / 45), 4,295 bytes avg / 170 coords each (complex coastal land shapes)

### `highway:track` now present in T2

Previously T2 explicitly omitted minor roads (including tracks). The new `tracks` template adds them as thin dashed lines at the 5km zoom level.

- T2: 75,347 features, 29.6 MB, 411 bytes/feature (simplified at epsilon_m=3)
- T1: 179,951 features, 89.6 MB, 521 bytes/feature (fine-grained epsilon_m=0.05)

### Sports facilities now in `leisure` group for T1/T2

New templates `sports_pitch`, `sports_facility`, `miniature_golf` add general leisure=pitch polygons (not just beach volleyball), sports centres, halls, tracks, and miniature golf courses. These contribute to the `leisure` group but remain below the top-30 threshold for individual categories.

## T1

- **Tiles:** 146,302
- **Actual disk size:** 2.29 GB
- **Sampled:** 1000 tiles (0.7%)
- **Estimated feature data:** 2.25 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 762.1 MB | 2,051,300 | 12,641,955 |
| highway | 494.6 MB | 1,042,986 | 10,517,504 |
| natural | 317.2 MB | 186,096 | 12,576,851 |
| landuse | 277.6 MB | 623,246 | 6,440,652 |
| waterway | 246.8 MB | 328,447 | 8,505,851 |
| boundary | 83.0 MB | 20,921 | 3,410,738 |
| railway | 45.9 MB | 37,453 | 1,308,086 |
| unknown | 44.1 MB | 122,015 | 601,154 |
| leisure | 11.1 MB | 26,480 | 254,858 |
| amenity | 10.0 MB | 24,286 | 45,938 |
| shop | 6.3 MB | 17,263 | 17,263 |
| place | 1.7 MB | 6,876 | 6,876 |
| aeroway | 380 KB | 1,024 | 5,852 |
| public_transport | 134 KB | 292 | 585 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 336.2 MB | 988,123 | 5,968,828 | 356 |
| natural:coastline | 231.5 MB | 24,871 | 10,235,434 | 9758 |
| building:house | 147.7 MB | 350,539 | 2,021,454 | 441 |
| landuse:farmland | 89.7 MB | 214,625 | 2,031,110 | 438 |
| highway:track | 89.6 MB | 179,951 | 2,205,210 | 521 |
| waterway:river | 84.6 MB | 30,284 | 3,465,601 | 2929 |
| highway:path | 84.6 MB | 135,621 | 2,344,489 | 653 |
| boundary:administrative | 83.0 MB | 20,921 | 3,410,738 | 4159 |
| landuse:meadow | 74.4 MB | 172,343 | 1,818,826 | 452 |
| highway:service | 71.2 MB | 217,843 | 1,114,528 | 342 |
| building:detached | 68.2 MB | 163,419 | 1,059,080 | 437 |
| highway:residential | 61.2 MB | 128,160 | 1,088,925 | 500 |
| building:apartments | 59.8 MB | 127,575 | 893,612 | 491 |
| highway:footway | 57.2 MB | 166,930 | 898,440 | 359 |
| waterway:ditch | 57.1 MB | 180,244 | 1,312,621 | 331 |
| waterway:canal | 46.0 MB | 17,848 | 1,808,877 | 2704 |
| unknown | 44.1 MB | 122,015 | 601,154 | 379 |
| waterway:stream | 42.5 MB | 46,231 | 1,555,629 | 964 |
| highway:unclassified | 41.5 MB | 64,372 | 1,121,697 | 676 |
| railway:rail | 34.8 MB | 29,991 | 985,197 | 1217 |
| landuse:residential | 34.3 MB | 72,712 | 872,398 | 494 |
| building:residential | 33.7 MB | 84,123 | 498,450 | 420 |
| building:garage | 33.5 MB | 118,943 | 625,294 | 295 |
| landuse:forest | 32.6 MB | 64,519 | 837,725 | 530 |
| natural:water | 31.2 MB | 57,789 | 907,218 | 567 |
| natural:scrub | 25.3 MB | 50,620 | 681,913 | 524 |
| highway:secondary | 23.9 MB | 38,623 | 445,343 | 648 |
| highway:tertiary | 22.9 MB | 37,599 | 458,803 | 638 |
| natural:wetland | 16.7 MB | 31,601 | 386,090 | 552 |
| waterway:drain | 16.5 MB | 53,839 | 363,121 | 321 |

## T2

- **Tiles:** 10,982
- **Actual disk size:** 978.4 MB
- **Sampled:** 1000 tiles (9.1%)
- **Estimated feature data:** 1.04 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 683.2 MB | 1,901,665 | 10,281,710 |
| landuse | 123.7 MB | 271,310 | 3,441,550 |
| highway | 123.4 MB | 290,429 | 1,256,889 |
| natural | 55.0 MB | 101,890 | 1,659,709 |
| waterway | 37.1 MB | 129,719 | 714,346 |
| boundary | 15.7 MB | 12,475 | 545,311 |
| leisure | 9.9 MB | 27,520 | 199,982 |
| railway | 8.5 MB | 16,901 | 79,608 |
| unknown | 2.4 MB | 4,184 | 62,663 |
| amenity | 2.1 MB | 3,700 | 32,166 |
| place | 717 KB | 2,152 | 2,152 |
| public_transport | 440 KB | 1,043 | 2,459 |
| aeroway | 417 KB | 1,438 | 5,699 |
| man_made | 8 KB | 10 | 65 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 291.8 MB | 884,523 | 4,782,540 | 345 |
| building:house | 101.5 MB | 244,525 | 1,272,846 | 435 |
| building:apartments | 81.4 MB | 189,000 | 1,055,084 | 451 |
| building:detached | 74.4 MB | 189,472 | 1,012,628 | 411 |
| highway:residential | 37.6 MB | 93,676 | 332,512 | 421 |
| landuse:farmland | 33.9 MB | 71,569 | 961,891 | 496 |
| landuse:meadow | 32.9 MB | 74,908 | 919,006 | 461 |
| highway:track | 29.6 MB | 75,347 | 433,690 | 411 |
| building:garage | 24.6 MB | 89,646 | 448,757 | 287 |
| landuse:residential | 20.2 MB | 42,840 | 575,742 | 493 |
| waterway:ditch | 19.3 MB | 81,156 | 289,057 | 249 |
| building:semidetached_house | 19.2 MB | 46,508 | 238,485 | 432 |
| natural:water | 17.8 MB | 42,544 | 475,344 | 439 |
| building:residential | 17.6 MB | 44,729 | 243,437 | 412 |
| natural:scrub | 15.0 MB | 37,207 | 384,995 | 424 |
| highway:tertiary | 13.9 MB | 30,024 | 112,323 | 485 |
| landuse:forest | 13.6 MB | 22,831 | 424,256 | 624 |
| highway:secondary | 12.3 MB | 24,599 | 82,452 | 526 |
| building:shed | 11.5 MB | 42,280 | 209,997 | 286 |
| highway:unclassified | 11.4 MB | 27,828 | 170,495 | 429 |
| natural:coastline | 9.8 MB | 1,504 | 430,175 | 6837 |
| highway:primary | 9.2 MB | 17,241 | 44,597 | 559 |
| landuse:grass | 8.3 MB | 23,325 | 204,034 | 374 |
| boundary:maritime | 8.1 MB | 7,346 | 278,481 | 1150 |
| building:allotment_house | 7.7 MB | 25,763 | 128,698 | 314 |
| waterway:stream | 7.7 MB | 19,185 | 191,591 | 418 |
| boundary:administrative | 7.6 MB | 5,128 | 266,829 | 1562 |
| natural:wetland | 7.1 MB | 10,575 | 216,707 | 701 |
| waterway:drain | 5.8 MB | 24,786 | 86,922 | 247 |
| landuse:farmyard | 5.7 MB | 14,320 | 147,532 | 418 |

## T3

- **Tiles:** 146
- **Actual disk size:** 110.6 MB
- **Sampled:** 146 tiles (100.0%)
- **Estimated feature data:** 110.2 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| landuse | 71.0 MB | 228,010 | 1,485,469 |
| highway | 20.6 MB | 44,556 | 93,729 |
| natural | 8.5 MB | 18,348 | 211,703 |
| railway | 5.3 MB | 11,799 | 25,371 |
| leisure | 3.2 MB | 10,889 | 52,591 |
| waterway | 730 KB | 2,242 | 11,307 |
| boundary | 288 KB | 469 | 6,501 |
| unknown | 271 KB | 127 | 10,605 |
| building | 154 KB | 459 | 1,851 |
| amenity | 114 KB | 301 | 840 |
| place | 59 KB | 102 | 102 |
| aeroway | 24 KB | 70 | 140 |
| public_transport | 4 KB | 10 | 37 |
| man_made | 698 B | 1 | 4 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| landuse:meadow | 21.4 MB | 71,883 | 446,635 | 312 |
| landuse:farmland | 19.9 MB | 62,678 | 438,225 | 332 |
| highway:secondary | 10.5 MB | 23,019 | 48,692 | 478 |
| landuse:residential | 10.0 MB | 31,931 | 213,012 | 329 |
| landuse:forest | 7.1 MB | 17,648 | 160,979 | 420 |
| highway:primary | 5.8 MB | 11,514 | 23,600 | 525 |
| landuse:grass | 4.9 MB | 18,336 | 88,449 | 281 |
| landuse:farmyard | 3.8 MB | 13,598 | 70,931 | 296 |
| railway:rail | 3.7 MB | 8,133 | 17,878 | 473 |
| natural:water | 2.5 MB | 6,516 | 53,068 | 406 |
| leisure:playground | 1.7 MB | 6,176 | 25,370 | 295 |
| natural:scrub | 1.6 MB | 4,033 | 36,776 | 424 |
| natural:wood | 1.6 MB | 4,413 | 32,618 | 379 |
| natural:wetland | 1.5 MB | 2,502 | 42,024 | 626 |
| highway:motorway | 1.5 MB | 3,043 | 6,540 | 503 |
| natural:coastline | 1012 KB | 329 | 41,501 | 3149 |
| leisure:park | 915 KB | 2,710 | 18,574 | 345 |
| landuse:commercial | 887 KB | 2,775 | 15,669 | 327 |
| landuse:industrial | 862 KB | 2,401 | 14,532 | 367 |
| highway:trunk | 814 KB | 1,665 | 3,478 | 500 |
| highway:motorway_link | 799 KB | 2,035 | 4,294 | 402 |
| railway:light_rail | 715 KB | 1,332 | 2,744 | 550 |
| highway:trunk_link | 568 KB | 1,376 | 2,836 | 422 |
| railway:subway | 541 KB | 1,519 | 3,127 | 364 |
| leisure:garden | 511 KB | 1,817 | 7,781 | 287 |
| waterway:river | 440 KB | 1,217 | 8,060 | 370 |
| landuse:retail | 374 KB | 1,177 | 6,208 | 325 |
| landuse:plant_nursery | 358 KB | 1,160 | 6,761 | 316 |
| landuse:railway | 309 KB | 1,060 | 5,435 | 298 |
| highway:primary_link | 305 KB | 727 | 1,482 | 429 |

## T4

- **Tiles:** 45
- **Actual disk size:** 15.9 MB
- **Sampled:** 45 tiles (100.0%)
- **Estimated feature data:** 15.8 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| highway | 9.8 MB | 20,779 | 41,964 |
| railway | 3.8 MB | 8,500 | 17,503 |
| natural | 1.2 MB | 893 | 43,908 |
| landuse | 843 KB | 1,340 | 24,225 |
| unknown | 117 KB | 28 | 4,765 |
| boundary | 86 KB | 170 | 1,585 |
| place | 19 KB | 8 | 8 |
| building | 402 B | 1 | 5 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| highway:primary | 5.7 MB | 11,475 | 23,110 | 525 |
| railway:rail | 3.6 MB | 8,086 | 16,560 | 470 |
| highway:motorway | 1.4 MB | 3,015 | 6,124 | 501 |
| landuse:forest | 841 KB | 1,334 | 24,193 | 645 |
| natural:coastline | 825 KB | 299 | 33,498 | 2824 |
| highway:trunk | 809 KB | 1,659 | 3,342 | 499 |
| highway:motorway_link | 794 KB | 2,033 | 4,073 | 399 |
| highway:trunk_link | 566 KB | 1,376 | 2,753 | 421 |
| highway:primary_link | 303 KB | 724 | 1,449 | 428 |
| natural:water | 291 KB | 465 | 7,837 | 640 |
| highway:proposed | 118 KB | 354 | 815 | 340 |
| unknown | 117 KB | 28 | 4,765 | 4295 |
| natural:wood | 85 KB | 126 | 2,545 | 690 |
| railway:narrow_gauge | 81 KB | 190 | 399 | 437 |
| railway:proposed | 66 KB | 118 | 325 | 569 |
| highway:construction | 60 KB | 142 | 296 | 434 |
| railway:construction | 56 KB | 93 | 193 | 618 |
| boundary:administrative | 52 KB | 121 | 646 | 437 |
| boundary:maritime | 34 KB | 49 | 939 | 712 |
| place:city | 17 KB | 4 | 4 | 4230 |
| railway:preserved | 5 KB | 13 | 26 | 375 |
| place:town | 2 KB | 4 | 4 | 590 |
| landuse:construction | 2 KB | 6 | 32 | 352 |
| natural:wetland | 1023 B | 2 | 23 | 511 |
| highway:residential | 597 B | 1 | 2 | 597 |
| building | 402 B | 1 | 5 | 402 |
| natural:scrub | 362 B | 1 | 5 | 362 |

# Datapoint 6 — 2026-03-01 13:43

Regions: Hamburg, Schleswig-Holstein, Mecklenburg-Vorpommern, Niedersachsen (4 regions)
Source: `/Users/andreas/Source/better-than-dijkstra/osm-renderer/public/tiles_build_o43pq7rp`

## T1

- **Tiles:** 647,533
- **Actual disk size:** 9.26 GB
- **Sampled:** 1000 tiles (0.2%)
- **Estimated feature data:** 8.67 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 2.43 GB | 6,918,890 | 43,793,304 |
| highway | 2.14 GB | 4,518,485 | 47,396,177 |
| waterway | 1.52 GB | 1,188,870 | 60,788,455 |
| landuse | 1.27 GB | 2,972,176 | 30,343,396 |
| natural | 361.8 MB | 729,122 | 9,268,787 |
| railway | 303.6 MB | 240,882 | 9,077,117 |
| unknown | 295.4 MB | 632,639 | 5,877,657 |
| boundary | 279.8 MB | 78,999 | 11,548,751 |
| leisure | 42.3 MB | 104,252 | 940,217 |
| amenity | 35.3 MB | 87,416 | 205,267 |
| shop | 20.0 MB | 53,097 | 53,097 |
| place | 4.6 MB | 18,778 | 18,778 |
| aeroway | 1.6 MB | 2,590 | 45,327 |
| public_transport | 1.3 MB | 3,237 | 8,417 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 1.43 GB | 4,269,832 | 26,789,735 | 360 |
| waterway:river | 949.2 MB | 177,424 | 40,972,650 | 5610 |
| highway:track | 519.7 MB | 1,043,823 | 12,804,965 | 522 |
| landuse:farmland | 426.2 MB | 1,028,929 | 9,389,228 | 434 |
| highway:path | 367.7 MB | 597,672 | 9,791,994 | 645 |
| building:house | 297.5 MB | 747,253 | 4,572,878 | 417 |
| unknown | 295.4 MB | 632,639 | 5,877,657 | 489 |
| highway:service | 280.3 MB | 841,145 | 4,557,337 | 349 |
| boundary:administrative | 279.4 MB | 78,351 | 11,545,513 | 3738 |
| landuse:meadow | 279.3 MB | 647,533 | 6,689,663 | 452 |
| highway:residential | 269.9 MB | 594,435 | 4,688,786 | 476 |
| railway:rail | 259.9 MB | 214,333 | 7,629,881 | 1271 |
| waterway:stream | 245.8 MB | 217,571 | 9,324,475 | 1184 |
| landuse:forest | 238.3 MB | 494,715 | 5,783,117 | 505 |
| building:detached | 173.7 MB | 415,716 | 2,573,296 | 438 |
| highway:footway | 169.4 MB | 480,469 | 3,018,151 | 369 |
| waterway:ditch | 159.9 MB | 530,329 | 3,382,064 | 316 |
| highway:unclassified | 152.5 MB | 279,734 | 3,640,430 | 571 |
| waterway:canal | 143.2 MB | 66,695 | 5,715,773 | 2250 |
| landuse:residential | 133.1 MB | 294,627 | 3,279,107 | 473 |
| highway:tertiary | 123.1 MB | 213,685 | 2,404,290 | 603 |
| natural:scrub | 119.3 MB | 275,201 | 2,921,021 | 454 |
| natural:water | 116.3 MB | 216,276 | 3,136,649 | 563 |
| building:residential | 102.8 MB | 279,086 | 1,826,043 | 386 |
| landuse:grass | 97.8 MB | 217,571 | 2,533,149 | 471 |
| building:apartments | 93.8 MB | 211,743 | 1,538,538 | 464 |
| highway:secondary | 89.0 MB | 130,801 | 1,834,460 | 713 |
| building:garage | 75.7 MB | 267,431 | 1,398,671 | 296 |
| waterway:drain | 62.1 MB | 196,850 | 1,393,491 | 331 |
| natural:wood | 58.7 MB | 115,908 | 1,560,554 | 531 |

## T2

- **Tiles:** 33,076
- **Actual disk size:** 4.22 GB
- **Sampled:** 1000 tiles (3.0%)
- **Estimated feature data:** 4.56 GB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| building | 2.53 GB | 7,619,420 | 41,084,890 |
| highway | 806.3 MB | 2,288,363 | 8,973,882 |
| landuse | 688.6 MB | 1,490,239 | 19,292,767 |
| natural | 205.8 MB | 453,240 | 5,665,654 |
| waterway | 190.4 MB | 577,176 | 4,181,203 |
| boundary | 64.6 MB | 28,676 | 2,544,139 |
| unknown | 48.7 MB | 18,985 | 1,942,024 |
| leisure | 32.9 MB | 93,241 | 667,275 |
| railway | 26.1 MB | 47,860 | 286,173 |
| amenity | 6.8 MB | 16,141 | 96,383 |
| public_transport | 3.7 MB | 9,062 | 24,410 |
| place | 2.8 MB | 9,558 | 9,558 |
| aeroway | 86 KB | 264 | 1,190 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| building | 1.49 GB | 4,777,993 | 25,732,532 | 335 |
| building:house | 356.0 MB | 868,377 | 4,622,470 | 429 |
| highway:service | 244.1 MB | 862,456 | 2,649,850 | 296 |
| highway:track | 201.3 MB | 525,908 | 2,881,911 | 401 |
| landuse:farmland | 189.9 MB | 417,187 | 5,245,522 | 477 |
| landuse:meadow | 163.9 MB | 362,579 | 4,635,733 | 474 |
| highway:residential | 150.7 MB | 408,257 | 1,458,221 | 386 |
| building:detached | 135.0 MB | 340,782 | 1,819,080 | 415 |
| landuse:forest | 130.2 MB | 228,918 | 3,998,888 | 596 |
| building:residential | 127.7 MB | 330,495 | 1,818,816 | 405 |
| building:garage | 106.7 MB | 374,585 | 1,867,338 | 298 |
| waterway:ditch | 83.4 MB | 354,409 | 1,130,703 | 246 |
| landuse:residential | 79.1 MB | 169,779 | 2,244,074 | 488 |
| building:apartments | 72.0 MB | 169,117 | 945,742 | 446 |
| natural:water | 71.5 MB | 168,224 | 1,923,468 | 445 |
| natural:scrub | 71.2 MB | 169,349 | 1,856,423 | 440 |
| landuse:grass | 54.0 MB | 135,810 | 1,416,016 | 416 |
| highway:unclassified | 52.2 MB | 136,471 | 679,877 | 401 |
| unknown | 48.7 MB | 18,985 | 1,942,024 | 2692 |
| highway:tertiary | 45.5 MB | 105,148 | 429,359 | 453 |
| highway:secondary | 41.2 MB | 91,355 | 317,099 | 473 |
| building:semidetached_house | 39.9 MB | 95,325 | 490,087 | 438 |
| waterway:stream | 38.9 MB | 99,591 | 943,426 | 409 |
| waterway:river | 37.9 MB | 15,049 | 1,567,273 | 2641 |
| boundary:administrative | 33.3 MB | 15,314 | 1,352,907 | 2281 |
| natural:wood | 32.2 MB | 69,062 | 919,215 | 489 |
| boundary:maritime | 31.3 MB | 13,362 | 1,191,232 | 2454 |
| highway:primary | 30.8 MB | 61,852 | 167,695 | 522 |
| landuse:farmyard | 29.9 MB | 77,893 | 764,055 | 402 |
| building:shed | 24.3 MB | 87,519 | 435,776 | 290 |

## T3

- **Tiles:** 412
- **Actual disk size:** 502.0 MB
- **Sampled:** 412 tiles (100.0%)
- **Estimated feature data:** 500.5 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| landuse | 344.7 MB | 1,082,531 | 7,326,124 |
| highway | 74.9 MB | 165,052 | 350,679 |
| natural | 38.9 MB | 98,440 | 845,858 |
| railway | 18.8 MB | 42,008 | 92,481 |
| leisure | 10.9 MB | 37,358 | 174,108 |
| unknown | 5.2 MB | 523 | 222,317 |
| waterway | 4.7 MB | 15,414 | 72,850 |
| boundary | 1.1 MB | 1,503 | 26,875 |
| amenity | 553 KB | 1,622 | 5,923 |
| building | 499 KB | 1,352 | 5,470 |
| place | 247 KB | 525 | 525 |
| aeroway | 102 KB | 315 | 656 |
| public_transport | 31 KB | 89 | 179 |
| man_made | 995 B | 2 | 8 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| landuse:farmland | 98.1 MB | 305,511 | 2,178,710 | 336 |
| landuse:meadow | 85.1 MB | 279,626 | 1,810,323 | 319 |
| landuse:forest | 50.1 MB | 120,204 | 1,176,905 | 436 |
| landuse:residential | 42.3 MB | 134,498 | 900,298 | 330 |
| highway:secondary | 36.2 MB | 81,779 | 174,231 | 463 |
| landuse:grass | 34.9 MB | 127,261 | 641,205 | 287 |
| highway:primary | 21.9 MB | 45,063 | 93,102 | 509 |
| landuse:farmyard | 16.6 MB | 59,505 | 307,787 | 292 |
| railway:rail | 16.1 MB | 35,852 | 80,136 | 470 |
| natural:wood | 12.7 MB | 36,368 | 252,360 | 367 |
| natural:water | 11.3 MB | 29,490 | 233,358 | 401 |
| natural:scrub | 8.3 MB | 20,551 | 185,521 | 424 |
| highway:motorway | 6.1 MB | 12,578 | 27,107 | 508 |
| leisure:playground | 5.8 MB | 20,490 | 84,043 | 299 |
| natural:wetland | 5.3 MB | 9,515 | 143,888 | 588 |
| unknown | 5.2 MB | 523 | 222,317 | 10379 |
| landuse:commercial | 4.3 MB | 13,806 | 77,288 | 324 |
| landuse:industrial | 4.2 MB | 12,295 | 72,320 | 359 |
| highway:trunk | 3.4 MB | 6,988 | 14,436 | 506 |
| highway:motorway_link | 3.1 MB | 8,116 | 17,368 | 400 |
| leisure:park | 2.7 MB | 8,305 | 52,705 | 335 |
| waterway:canal | 2.4 MB | 9,142 | 24,178 | 270 |
| waterway:river | 2.4 MB | 6,230 | 48,365 | 397 |
| leisure:garden | 2.3 MB | 8,154 | 35,475 | 290 |
| highway:trunk_link | 1.7 MB | 4,197 | 8,730 | 428 |
| landuse:cemetery | 1.7 MB | 5,156 | 25,906 | 335 |
| landuse:retail | 1.4 MB | 4,723 | 24,623 | 315 |
| landuse:orchard | 1.3 MB | 4,562 | 25,116 | 307 |
| landuse:railway | 1.2 MB | 4,274 | 23,742 | 305 |
| landuse:plant_nursery | 1.2 MB | 4,129 | 23,327 | 315 |

## T4

- **Tiles:** 124
- **Actual disk size:** 63.6 MB
- **Sampled:** 124 tiles (100.0%)
- **Estimated feature data:** 63.4 MB

### By group

| Group | Est. Size | Features | Coordinates |
|-------|----------|----------|-------------|
| highway | 37.6 MB | 80,834 | 163,719 |
| railway | 16.5 MB | 37,302 | 77,226 |
| landuse | 6.4 MB | 8,596 | 208,120 |
| natural | 1.8 MB | 3,113 | 51,048 |
| unknown | 785 KB | 80 | 32,486 |
| boundary | 279 KB | 431 | 5,127 |
| place | 51 KB | 35 | 35 |
| waterway | 1 KB | 4 | 24 |
| building | 402 B | 1 | 5 |

### Top categories

| Category | Est. Size | Features | Coordinates | Avg bytes |
|----------|----------|----------|-------------|-----------|
| highway:primary | 21.8 MB | 44,879 | 90,558 | 508 |
| railway:rail | 15.8 MB | 35,465 | 73,178 | 465 |
| landuse:forest | 6.4 MB | 8,587 | 208,071 | 786 |
| highway:motorway | 6.0 MB | 12,436 | 25,269 | 505 |
| highway:trunk | 3.3 MB | 6,949 | 13,964 | 504 |
| highway:motorway_link | 3.1 MB | 8,104 | 16,239 | 397 |
| highway:trunk_link | 1.7 MB | 4,191 | 8,387 | 426 |
| natural:water | 1.3 MB | 2,206 | 34,058 | 602 |
| highway:primary_link | 1.0 MB | 2,586 | 5,173 | 417 |
| unknown | 785 KB | 80 | 32,486 | 10053 |
| natural:wood | 551 KB | 870 | 16,024 | 648 |
| railway:narrow_gauge | 513 KB | 1,376 | 2,964 | 382 |
| highway:proposed | 450 KB | 1,272 | 3,267 | 362 |
| boundary:administrative | 182 KB | 339 | 2,258 | 551 |
| highway:construction | 173 KB | 398 | 822 | 446 |
| railway:proposed | 112 KB | 211 | 562 | 545 |
| railway:construction | 98 KB | 169 | 351 | 595 |
| boundary:maritime | 96 KB | 92 | 2,869 | 1069 |
| place:city | 38 KB | 15 | 15 | 2568 |
| railway:preserved | 28 KB | 80 | 169 | 356 |
| natural:wetland | 25 KB | 24 | 820 | 1047 |
| place:town | 13 KB | 20 | 20 | 675 |
| natural:scrub | 5 KB | 10 | 104 | 483 |
| highway:path | 4 KB | 5 | 10 | 737 |
| highway:footway | 4 KB | 7 | 16 | 516 |
| landuse:construction | 3 KB | 8 | 42 | 349 |
| highway:residential | 2 KB | 3 | 6 | 667 |
| highway:service | 1 KB | 3 | 6 | 470 |
| waterway:canal | 1 KB | 3 | 16 | 351 |
| natural:heath | 834 B | 1 | 26 | 834 |

---

See `TILE_SIZE_IMPROVEMENTS.md` for analysis and improvement plan.
