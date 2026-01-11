import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void;
  placeholder?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onDateRangeChange,
  placeholder = "Select date range"
}: DateRangePickerProps) {
  console.log('🔧 DateRangePicker rendered with:', { startDate, endDate, placeholder });
  const { theme, isDark } = useTheme();
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);

  const handleStartDateChange = (dateString: string) => {
    if (dateString) {
      const selectedDate = new Date(dateString);
      setTempStartDate(selectedDate);
      // If end date is before start date, clear end date
      if (tempEndDate && selectedDate > tempEndDate) {
        setTempEndDate(null);
      }
    } else {
      setTempStartDate(null);
    }
  };

  const handleEndDateChange = (dateString: string) => {
    if (dateString) {
      const selectedDate = new Date(dateString);
      // Ensure end date is not before start date
      if (tempStartDate && selectedDate < tempStartDate) {
        Alert.alert('Invalid Date', 'End date cannot be before start date');
        return;
      }
      setTempEndDate(selectedDate);
    } else {
      setTempEndDate(null);
    }
  };

  const handleConfirm = () => {
    onDateRangeChange(tempStartDate, tempEndDate);
  };

  const handleClear = () => {
    setTempStartDate(null);
    setTempEndDate(null);
    onDateRangeChange(null, null);
  };

  const handlePresetRange = (preset: 'today' | 'week' | 'month' | 'quarter' | 'nextDay' | 'nextWeek' | 'nextMonth' | 'nextQuarter' | 'previousWeek' | 'previousMonth') => {
    const now = new Date();
    let newStartDate: Date | null = null;
    let newEndDate: Date | null = null;

    switch (preset) {
      case 'today':
        newStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        newStartDate.setHours(0, 0, 0, 0);
        newEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        newEndDate.setHours(23, 59, 59, 999);
        break;
      case 'nextDay':
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        newStartDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        newStartDate.setHours(0, 0, 0, 0);
        newEndDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        newEndDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        newStartDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        newStartDate.setHours(0, 0, 0, 0);
        // Set end date to last day of current week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        newEndDate = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
        newEndDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        newStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        newStartDate.setHours(0, 0, 0, 0);
        // Set end date to last day of current month
        newEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        newEndDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        quarterStart.setHours(0, 0, 0, 0);
        newStartDate = quarterStart;
        // Set end date to last day of current quarter
        const quarterEndMonth = Math.floor(now.getMonth() / 3) * 3 + 3;
        newEndDate = new Date(now.getFullYear(), quarterEndMonth, 0);
        newEndDate.setHours(23, 59, 59, 999);
        break;
      case 'previousWeek':
        // Calculate start of current week (Monday)
        const currentWeekStart = new Date(now);
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Days to get to Monday
        currentWeekStart.setDate(now.getDate() + daysToMonday);
        currentWeekStart.setHours(0, 0, 0, 0);
        
        // Previous week is 7 days before current week start
        const previousWeekStart = new Date(currentWeekStart);
        previousWeekStart.setDate(currentWeekStart.getDate() - 7);
        previousWeekStart.setHours(0, 0, 0, 0);
        
        // Previous week ends on Sunday (6 days after Monday)
        const previousWeekEnd = new Date(previousWeekStart);
        previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
        previousWeekEnd.setHours(23, 59, 59, 999);
        
        newStartDate = previousWeekStart;
        newEndDate = previousWeekEnd;
        break;
      case 'previousMonth':
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousMonthStart.setHours(0, 0, 0, 0);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        previousMonthEnd.setHours(23, 59, 59, 999);
        newStartDate = previousMonthStart;
        newEndDate = previousMonthEnd;
        break;
      case 'nextWeek':
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(now.getDate() + (7 - now.getDay()));
        nextWeekStart.setHours(0, 0, 0, 0);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
        nextWeekEnd.setHours(23, 59, 59, 999);
        newStartDate = nextWeekStart;
        newEndDate = nextWeekEnd;
        break;
      case 'nextMonth':
        newStartDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        newStartDate.setHours(0, 0, 0, 0);
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        nextMonthEnd.setHours(23, 59, 59, 999);
        newEndDate = nextMonthEnd;
        break;
      case 'nextQuarter':
        const nextQuarterMonth = Math.floor(now.getMonth() / 3) * 3 + 3;
        newStartDate = new Date(now.getFullYear(), nextQuarterMonth, 1);
        newStartDate.setHours(0, 0, 0, 0);
        const nextQuarterEnd = new Date(now.getFullYear(), nextQuarterMonth + 3, 0);
        nextQuarterEnd.setHours(23, 59, 59, 999);
        newEndDate = nextQuarterEnd;
        break;
    }

    console.log('🔧 Preset range selected:', preset, { newStartDate, newEndDate });
    setTempStartDate(newStartDate);
    setTempEndDate(newEndDate);
    onDateRangeChange(newStartDate, newEndDate);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const getDisplayText = () => {
    if (!startDate && !endDate) {
      return placeholder;
    }
    
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    
    if (startDate) {
      return `From ${formatDate(startDate)}`;
    }
    
    if (endDate) {
      return `Until ${formatDate(endDate)}`;
    }
    
    return placeholder;
  };

  // Web-compatible date picker using HTML input
  const renderWebDatePicker = (isStart: boolean) => {
    const value = isStart ? formatDateForInput(tempStartDate) : formatDateForInput(tempEndDate);
    const onChange = isStart ? handleStartDateChange : handleEndDateChange;
    const placeholder = isStart ? 'Start Date' : 'End Date';
    const minDate = isStart ? undefined : formatDateForInput(tempStartDate);

    return (
      <View style={styles.webDateInputContainer}>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            backgroundColor: theme.cardBackground,
            border: `1px solid ${theme.cardBorder}`,
            color: theme.primaryText,
            fontSize: 16,
            fontWeight: '500',
            padding: '8px 12px',
            borderRadius: 8,
            borderWidth: 0,
            outline: 'none',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'inherit'
          }}
          min={minDate}
        />
      </View>
    );
  };

  // Mobile date picker modal
  const renderMobileDatePicker = (show: boolean, isStart: boolean) => {
    if (!show) return null;

    const value = isStart ? tempStartDate : tempEndDate;
    const onChange = isStart ? handleStartDateChange : handleEndDateChange;
    const minDate = isStart ? undefined : tempStartDate;

    return (
      <Modal
        transparent={true}
        animationType="slide"
        visible={show}
        onRequestClose={() => {
          setShowStartPicker(false);
          setShowEndPicker(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                {isStart ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <Feather name="x" size={24} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.mobileDatePickerContainer}>
              <input
                type="date"
                value={formatDateForInput(value)}
                onChange={(e) => onChange(e.target.value)}
                style={{
                  backgroundColor: theme.primaryBackground,
                  border: `1px solid ${theme.cardBorder}`,
                  color: theme.primaryText,
                  fontSize: 18,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  textAlign: 'center',
                  width: '100%',
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
                min={minDate ? formatDateForInput(minDate) : undefined}
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => {
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                  handleConfirm();
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.pickerContainer, { 
        backgroundColor: theme.cardBackground,
        borderColor: theme.cardBorder 
      }]}>
        {Platform.OS === 'web' ? (
          // Web version with HTML date inputs
          <>
            <View style={styles.webDateContainer}>
              <Feather name="calendar" size={20} color={theme.secondaryText} />
              {renderWebDatePicker(true)}
            </View>
            
            <View style={[styles.separator, { backgroundColor: theme.cardBorder }]} />
            
            <View style={styles.webDateContainer}>
              <Feather name="calendar" size={20} color={theme.secondaryText} />
              {renderWebDatePicker(false)}
            </View>
          </>
        ) : (
          // Mobile version with touchable buttons
          <>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartPicker(true)}
            >
              <Feather name="calendar" size={20} color={theme.secondaryText} />
              <Text style={[styles.dateButtonText, { color: theme.primaryText }]}>
                {tempStartDate ? formatDate(tempStartDate) : 'Start Date'}
              </Text>
            </TouchableOpacity>
            
            <View style={[styles.separator, { backgroundColor: theme.cardBorder }]} />
            
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndPicker(true)}
            >
              <Feather name="calendar" size={20} color={theme.secondaryText} />
              <Text style={[styles.dateButtonText, { color: theme.primaryText }]}>
                {tempEndDate ? formatDate(tempEndDate) : 'End Date'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Preset Date Ranges */}
      <View style={styles.presetContainer}>
        <Text style={[styles.presetLabel, { color: theme.secondaryText }]}>Quick Appointment Filters:</Text>
        
        {/* Past Periods */}
        <Text style={[styles.presetSubLabel, { color: theme.secondaryText }]}>Past:</Text>
        <View style={styles.presetButtons}>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('previousWeek')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>Previous Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('previousMonth')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>Previous Month</Text>
          </TouchableOpacity>
        </View>
        
        {/* Current Periods */}
        <Text style={[styles.presetSubLabel, { color: theme.secondaryText }]}>Current:</Text>
        <View style={styles.presetButtons}>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('today')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('week')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('month')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('quarter')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>This Quarter</Text>
          </TouchableOpacity>
        </View>
        
        {/* Future Periods */}
        <Text style={[styles.presetSubLabel, { color: theme.secondaryText }]}>Future:</Text>
        <View style={styles.presetButtons}>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('nextDay')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>Next Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('nextWeek')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>Next Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('nextMonth')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>Next Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetButton, { backgroundColor: theme.primaryButton + '15' }]}
            onPress={() => handlePresetRange('nextQuarter')}
          >
            <Text style={[styles.presetButtonText, { color: theme.primaryButton }]}>Next Quarter</Text>
          </TouchableOpacity>
        </View>
        

        
        {/* Custom Range */}
        <Text style={[styles.presetSubLabel, { color: theme.secondaryText }]}>Custom Range:</Text>
        <Text style={[styles.customRangeHint, { color: theme.secondaryText }]}>
          Click on the date fields above to open a calendar picker
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.secondaryButton }]}
          onPress={handleClear}
        >
          <Feather name="x" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>Clear</Text>
        </TouchableOpacity>
        
        {(tempStartDate !== startDate || tempEndDate !== endDate) && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
            onPress={handleConfirm}
          >
            <Feather name="check" size={16} color="#ffffff" />
            <Text style={styles.actionButtonText}>Apply</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mobile date picker modals */}
      {renderMobileDatePicker(showStartPicker, true)}
      {renderMobileDatePicker(showEndPicker, false)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  webDateContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },

  webDateInputContainer: {
    flex: 1,
    alignItems: 'center',
  },
  separator: {
    width: 1,
    height: 32,
    marginHorizontal: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  presetContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  presetSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  customRangeHint: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 8,
    opacity: 0.7,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  mobileDatePickerContainer: {
    marginBottom: 20,
  },

  dateFormatHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  confirmButton: {
    // backgroundColor will be set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
