/**
 * Panel manufacturer and model options
 * Used for both Off-Peak (DynamicInputsScreen) and Flux/EPVS (EPVSDynamicInputsScreen) calculators
 */

export const PANEL_MANUFACTURERS = [
  'Astronergy',
  'Aiko',
  'Canadian Solar',
  'Eurener',
  'JA Solar',
];

export const PANEL_MODELS: Record<string, string[]> = {
  'Astronergy': [
    'CHSM54RN 440',
    'CHSM54RN 445',
    'CHSM54RN 450',
    'CHSM54RN 455',
    'CHSM54RN 460',
  ],
  'Aiko': [
    'AIKO-A-MAH54Mb - 440W',
    'AIKO-A-MAH54Mb - 445W',
    'AIKO-A-MAH54Mb - 450W',
    'AIKO-A-MAH54Mb - 455W',
    'AIKO-A-MAH54Mb - 460W',
  ],
  'Canadian Solar': [
    'BiHiKu6 Mono PERC - CS6W-520 MB-AG',
    'BiHiKu6 Mono PERC - CS6W-525 MB-AG',
    'BiHiKu6 Mono PERC - CS6W-530 MB-AG',
    'BiHiKu6 Mono PERC - CS6W-535 MB-AG',
    'BiHiKu6 Mono PERC - CS6W-540 MB-AG',
    'BiHiKu6 Mono PERC - CS6W-545 MB-AG',
    'BiHiKu6 Mono PERC - CS6W-550 MB-AG',
    'HiHero - CS6R-415H-AG',
    'HiHero - CS6R-420H-AG',
    'HiHero - CS6R-425H-AG',
    'HiHero - CS6R-430H-AG',
    'HiHero - CS6R-435H-AG',
    'HiKu5 Mono PERC - CS3Y-485 MS',
    'HiKu5 Mono PERC - CS3Y-490 MS',
    'HiKu5 Mono PERC - CS3Y-495 MS',
    'HiKu5 Mono PERC - CS3Y-500 MS',
    'HiKu6 (All-Black) - CS6R-380MS',
    'HiKu6 (All-Black) - CS6R-385MS',
    'HiKu6 (All-Black) - CS6R-390MS',
    'HiKu6 (All-Black) - CS6R-395MS',
    'HiKu6 (All-Black) - CS6R-400MS',
    'HiKu6 (All-Black) - CS6R-405MS',
    'HiKu6 Mono PERC - CS3L-360 MS',
    'HiKu6 Mono PERC - CS3L-365 MS',
    'HiKu6 Mono PERC - CS3L-370 MS',
    'HiKu6 Mono PERC - CS3L-375 MS',
    'HiKu6 Mono PERC - CS3L-380 MS',
    'HiKu6 Mono PERC - CS3L-385 MS',
    'HiKu6 Mono PERC - CS3L-390 MS',
    'HiKu6 Mono PERC - CS6W-530 MS',
    'HiKu6 Mono PERC - CS6W-535 MS',
    'HiKu6 Mono PERC - CS6W-540 MS',
    'HiKu6 Mono PERC - CS6W-545 MS',
    'HiKu6 Mono PERC - CS6W-550 MS',
    'HiKu6 Mono PERC - CS6W-555 MS',
    'TOPHiKu6 - CS6R-T 420w',
    'TOPHiKu6 - CS6R-T 535w',
    'TOPHiKu6 - CS6W-T 560w',
    'TOPHiKu6 - CS6W-T 575w',
  ],
  'Eurener': [
    'MEPV NEXA 475W',
  ],
  'JA Solar': [
    'JAM54S30-390/MR',
    'JAM54S30-395/MR',
    'JAM54S30-400/MR',
    'JAM54S30-405/MR',
    'JAM54S30-410/MR',
    'JAM54S30-415/MR',
    'JAM54S31-380/MR/1500V',
    'JAM54S31-385/MR/1500V',
    'JAM54S31-390/MR/1500V',
    'JAM54S31-395/MR/1500V',
    'JAM54S31-400/MR/1500V',
    'JAM54S31-405/MR/1500V',
    'JAM60S20-365/MR/1000V',
    'JAM60S20-370/MR/1000V',
    'JAM60S20-375/MR/1000V',
    'JAM60S20-380/MR/1000V',
    'JAM60S20-385/MR/1000V',
    'JAM60S20-390/MR/1000V',
    'JAM60S21-355/MR',
    'JAM60S21-360/MR',
    'JAM60S21-365/MR',
    'JAM60S21-370/MR',
    'JAM60S21-375/MR',
    'JAM72S20-445/MR',
    'JAM72S20-450/MR',
    'JAM72S20-455/MR',
    'JAM72S20-460/MR',
    'JAM72S20-465/MR',
    'JAM72S20-470/MR',
  ],
};

/**
 * Get panel models for a specific manufacturer
 */
export function getPanelModels(manufacturer: string): string[] {
  return PANEL_MODELS[manufacturer] || [];
}

