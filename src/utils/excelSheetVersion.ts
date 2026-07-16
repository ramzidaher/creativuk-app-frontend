/**
 * Shared helpers for opportunity Excel calculator files.
 * Prefer trailing -vN.ext so EPVS-v4.4-...-v1.xlsm is V1, not V4.
 */

export type CalculatorSheetType = 'epvs' | 'off-peak' | 'flux' | 'v44';

export interface ExcelSheetInfo {
  fileName: string;
  filePath?: string;
  size?: number;
  lastModified?: string;
  calculatorType: CalculatorSheetType | string;
  version?: number;
}

export function isV44Sheet(sheet?: ExcelSheetInfo | null): boolean {
  if (!sheet) return false;
  if (sheet.calculatorType === 'v44') return true;
  const name = (sheet.fileName || '').toLowerCase();
  return name.includes('v4.4') || name.includes('v44') || name.includes('epvs-v4');
}

export function extractExcelVersion(fileName: string): number {
  const trailing = fileName.match(/-v(\d+)\.(xlsm|xlsx|xls)$/i);
  if (trailing) {
    return parseInt(trailing[1], 10);
  }
  const matches = [...fileName.matchAll(/-v(\d+)/gi)];
  if (matches.length > 0) {
    return parseInt(matches[matches.length - 1][1], 10);
  }
  return 1;
}

export function getExcelSheetVersion(sheet: ExcelSheetInfo): number {
  return sheet.version || extractExcelVersion(sheet.fileName);
}

/** Friendly calculator family label for pickers */
export function getCalculatorFamilyLabel(sheet: ExcelSheetInfo): string {
  if (isV44Sheet(sheet)) return 'EPVS v4.4 Calculator';
  const type = String(sheet.calculatorType || '').toLowerCase();
  if (type === 'flux' || type === 'epvs') return 'Flux Calculator';
  return 'Off Peak Calculator';
}

/** e.g. "EPVS v4.4 Calculator V1" */
export function getExcelSheetDisplayName(sheet: ExcelSheetInfo): string {
  return `${getCalculatorFamilyLabel(sheet)} V${getExcelSheetVersion(sheet)}`;
}

export type SheetGroupKey = 'v44' | 'flux' | 'off-peak';

export function getSheetGroupKey(sheet: ExcelSheetInfo): SheetGroupKey {
  if (isV44Sheet(sheet)) return 'v44';
  const type = String(sheet.calculatorType || '').toLowerCase();
  if (type === 'flux' || type === 'epvs') return 'flux';
  return 'off-peak';
}

export function getSheetGroupTitle(key: SheetGroupKey): string {
  switch (key) {
    case 'v44':
      return 'EPVS v4.4 Calculators';
    case 'flux':
      return 'Flux Calculators';
    default:
      return 'Off Peak Calculators';
  }
}

/** Ascending v1 → vn */
export function sortSheetsByVersion(sheets: ExcelSheetInfo[]): ExcelSheetInfo[] {
  return [...sheets].sort((a, b) => getExcelSheetVersion(a) - getExcelSheetVersion(b));
}

export function groupSheetsByCalculator(
  sheets: ExcelSheetInfo[],
): Record<SheetGroupKey, ExcelSheetInfo[]> {
  const groups: Record<SheetGroupKey, ExcelSheetInfo[]> = {
    v44: [],
    flux: [],
    'off-peak': [],
  };
  for (const sheet of sheets) {
    groups[getSheetGroupKey(sheet)].push(sheet);
  }
  (Object.keys(groups) as SheetGroupKey[]).forEach((key) => {
    groups[key] = sortSheetsByVersion(groups[key]);
  });
  return groups;
}
