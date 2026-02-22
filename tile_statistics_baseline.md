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
