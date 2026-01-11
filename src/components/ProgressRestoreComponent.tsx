import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import CalculatorDataService from '../services/CalculatorDataService';

const { width } = Dimensions.get('window');

interface ProgressRestoreComponentProps {
  opportunityId: string;
  hasSavedProgress: boolean;
  progressSummary: any;
  showRestoreDialog: boolean;
  onRestoreProgress: () => void;
  onClearSavedProgress: () => void;
  onDismissDialog: () => void;
  screenType: 'radio-buttons' | 'dynamic-inputs' | 'arrays' | 'pricing';
  customTitle?: string;
  customMessage?: string;
}

export default function ProgressRestoreComponent({
  opportunityId,
  hasSavedProgress,
  progressSummary,
  showRestoreDialog,
  onRestoreProgress,
  onClearSavedProgress,
  onDismissDialog,
  screenType,
  customTitle,
  customMessage,
}: ProgressRestoreComponentProps) {
  const { theme, isDark } = useTheme();

  const getScreenConfig = () => {
    switch (screenType) {
      case 'radio-buttons':
        return {
          title: 'Restore Saved Selections?',
          message: 'We found saved radio button selections from your previous session. Would you like to restore them?',
          restoreButtonText: 'Restore Selections',
          progressLabel: 'Selections',
        };
      case 'dynamic-inputs':
        return {
          title: 'Restore Saved Inputs?',
          message: 'We found saved input values from your previous session. Would you like to restore them?',
          restoreButtonText: 'Restore Inputs',
          progressLabel: 'Inputs',
        };
      case 'arrays':
        return {
          title: 'Restore Saved Arrays?',
          message: 'We found saved array configurations from your previous session. Would you like to restore them?',
          restoreButtonText: 'Restore Arrays',
          progressLabel: 'Arrays',
        };
      case 'pricing':
        return {
          title: 'Restore Saved Pricing?',
          message: 'We found saved pricing selections from your previous session. Would you like to restore them?',
          restoreButtonText: 'Restore Pricing',
          progressLabel: 'Pricing',
        };
      default:
        return {
          title: 'Restore Saved Progress?',
          message: 'We found saved progress from your previous session. Would you like to restore it?',
          restoreButtonText: 'Restore Progress',
          progressLabel: 'Progress',
        };
    }
  };

  const config = getScreenConfig();
  const title = customTitle || config.title;
  const message = customMessage || config.message;

  return (
    <>
      {/* Progress Indicator - Only show if there's saved progress */}
      {hasSavedProgress && progressSummary && (
        <View style={[
          styles.progressIndicator,
          { 
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
            shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
          }
        ]}>
          <View style={styles.progressHeader}>
            <View style={[styles.progressIcon, { backgroundColor: theme.primaryButton + '20' }]}>
              <Feather name="save" size={20} color={theme.primaryButton} />
            </View>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressTitle, { color: theme.primaryText }]}>Saved Progress</Text>
              <Text style={[styles.progressSubtitle, { color: theme.secondaryText }]}>
                {progressSummary.progressPercentage}% complete
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.restoreButton, { backgroundColor: theme.primaryButton }]}
              onPress={onRestoreProgress}
            >
              <Feather name="rotate-ccw" size={16} color="#ffffff" />
              <Text style={styles.restoreButtonText}>Restore</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { 
              width: `${progressSummary.progressPercentage}%`,
              backgroundColor: theme.primaryButton 
            }]} />
          </View>
          {progressSummary.lastSavedAt && (
            <Text style={[styles.progressTimestamp, { color: theme.tertiaryText }]}>
              Last saved: {new Date(progressSummary.lastSavedAt).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {/* Restore Progress Dialog */}
      {showRestoreDialog && (
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={[styles.dialogIcon, { backgroundColor: theme.primaryButton + '20' }]}>
              <Feather name="save" size={32} color={theme.primaryButton} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.primaryText }]}>{title}</Text>
            <Text style={[styles.dialogMessage, { color: theme.secondaryText }]}>
              {message}
            </Text>
            {progressSummary && (
              <View style={styles.dialogProgress}>
                <Text style={[styles.dialogProgressText, { color: theme.secondaryText }]}>
                  Progress: {progressSummary.progressPercentage}% complete
                </Text>
                <View style={styles.dialogProgressBar}>
                  <View style={[styles.dialogProgressBarFill, { 
                    width: `${progressSummary.progressPercentage}%`,
                    backgroundColor: theme.primaryButton 
                  }]} />
                </View>
              </View>
            )}
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonSecondary, { borderColor: theme.cardBorder }]}
                onPress={onDismissDialog}
              >
                <Text style={[styles.dialogButtonText, { color: theme.secondaryText }]}>Start Fresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonPrimary, { backgroundColor: theme.primaryButton }]}
                onPress={onRestoreProgress}
              >
                <Feather name="rotate-ccw" size={16} color="#ffffff" />
                <Text style={styles.dialogButtonTextPrimary}>{config.restoreButtonText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Progress Indicator Styles
  progressIndicator: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  progressSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.8,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  restoreButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressTimestamp: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Dialog Styles
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  dialogContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  dialogIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dialogTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  dialogMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.9,
  },
  dialogProgress: {
    width: '100%',
    marginBottom: 32,
  },
  dialogProgressText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogProgressBar: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
  },
  dialogProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dialogButtonSecondary: {
    borderWidth: 2,
  },
  dialogButtonPrimary: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dialogButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dialogButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

