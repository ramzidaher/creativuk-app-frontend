import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import {
  ExcelSheetInfo,
  getExcelSheetDisplayName,
  getSheetGroupKey,
  getSheetGroupTitle,
  groupSheetsByCalculator,
  isV44Sheet,
  SheetGroupKey,
} from '../utils/excelSheetVersion';

export interface ExcelSheetPickerProps {
  sheets: ExcelSheetInfo[];
  selectedSheet: ExcelSheetInfo | null;
  onSelect: (sheet: ExcelSheetInfo) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  /** Shown above the list */
  introText?: string | null;
  continueLabel?: string;
  onContinue?: () => void;
  continueLoading?: boolean;
  /** Extra actions under each row (e.g. download / delete) */
  renderSheetActions?: (sheet: ExcelSheetInfo) => React.ReactNode;
  /** Custom footer below the list (e.g. Hometree download + load) */
  footer?: React.ReactNode;
}

/**
 * Consistent, dummy-friendly calculator file picker used across
 * Solar Projection, Presentation, Hometree, etc.
 */
export default function ExcelSheetPicker({
  sheets,
  selectedSheet,
  onSelect,
  loading = false,
  emptyTitle = 'No calculator found',
  emptyMessage = 'Complete the calculator step first, then come back here.',
  emptyAction,
  introText = 'Tap a calculator below to select it. Files are listed from V1 to the latest.',
  continueLabel = 'Continue',
  onContinue,
  continueLoading = false,
  renderSheetActions,
  footer,
}: ExcelSheetPickerProps) {
  const { theme, isDark } = useTheme();
  const grouped = groupSheetsByCalculator(sheets);
  const groupOrder: SheetGroupKey[] = ['v44', 'flux', 'off-peak'];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primaryButton} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
          Loading calculators…
        </Text>
      </View>
    );
  }

  if (sheets.length === 0) {
    return (
      <View
        style={[
          styles.emptyCard,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        ]}
      >
        <Feather name="folder" size={40} color={theme.secondaryText} />
        <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>{emptyTitle}</Text>
        <Text style={[styles.emptyText, { color: theme.secondaryText }]}>{emptyMessage}</Text>
        {emptyAction}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {!!introText && (
        <Text style={[styles.intro, { color: theme.secondaryText }]}>{introText}</Text>
      )}

      {groupOrder.map((key) => {
        const groupSheets = grouped[key];
        if (!groupSheets.length) return null;
        const accent = groupAccent(key);

        return (
          <View key={key} style={styles.group}>
            <View style={styles.groupHeader}>
              <View
                style={[
                  styles.groupIcon,
                  { backgroundColor: accent.bg, borderColor: accent.border },
                ]}
              >
                <Feather
                  name={key === 'off-peak' ? 'settings' : 'zap'}
                  size={16}
                  color="#fff"
                />
              </View>
              <Text style={[styles.groupTitle, { color: theme.primaryText }]}>
                {getSheetGroupTitle(key)}
              </Text>
              <Text style={[styles.groupCount, { color: theme.secondaryText }]}>
                {groupSheets.length} file{groupSheets.length === 1 ? '' : 's'}
              </Text>
            </View>

            {groupSheets.map((sheet) => {
              const selected = selectedSheet?.fileName === sheet.fileName;
              const sheetIsV44 = isV44Sheet(sheet);
              const family = sheetIsV44
                ? 'EPVS v4.4'
                : getSheetGroupKey(sheet) === 'flux'
                  ? 'Flux'
                  : 'Off Peak';

              return (
                <View key={sheet.fileName} style={styles.sheetRow}>
                  <TouchableOpacity
                    style={[
                      styles.sheetCard,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: selected ? theme.primaryButton : theme.cardBorder,
                      },
                      selected && {
                        backgroundColor: isDark
                          ? `${theme.primaryButton}20`
                          : `${theme.primaryButton}10`,
                      },
                    ]}
                    onPress={() => onSelect(sheet)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.sheetBadge,
                        {
                          backgroundColor: accent.bg,
                          borderColor: accent.border,
                        },
                      ]}
                    >
                      <Feather
                        name={key === 'off-peak' ? 'settings' : 'zap'}
                        size={16}
                        color="#fff"
                      />
                    </View>
                    <View style={styles.sheetMain}>
                      <Text style={[styles.sheetTitle, { color: theme.primaryText }]}>
                        {getExcelSheetDisplayName(sheet)}
                      </Text>
                      <Text style={[styles.sheetSubtitle, { color: accent.border }]}>
                        {family.toUpperCase()} CALCULATOR
                      </Text>
                      {!!sheet.lastModified && (
                        <Text style={[styles.sheetMeta, { color: theme.secondaryText }]}>
                          Updated {new Date(sheet.lastModified).toLocaleString()}
                        </Text>
                      )}
                    </View>
                    {selected && (
                      <Feather name="check-circle" size={24} color={theme.primaryButton} />
                    )}
                  </TouchableOpacity>
                  {!!renderSheetActions && (
                    <View style={styles.sheetActions}>{renderSheetActions(sheet)}</View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      {footer}

      {onContinue && selectedSheet && (
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              backgroundColor: theme.primaryButton,
              opacity: continueLoading ? 0.7 : 1,
            },
          ]}
          onPress={onContinue}
          disabled={continueLoading}
        >
          {continueLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueText}>{continueLabel}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function groupAccent(key: SheetGroupKey): { bg: string; border: string } {
  if (key === 'v44') return { bg: '#0d9488', border: '#0f766e' };
  if (key === 'flux') return { bg: '#10b981', border: '#059669' };
  return { bg: '#3b82f6', border: '#2563eb' };
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 4,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  group: {
    gap: 10,
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  groupCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  sheetRow: {
    gap: 8,
  },
  sheetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    minHeight: 72,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 4,
  },
  sheetBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetMain: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sheetMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  continueButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  continueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
