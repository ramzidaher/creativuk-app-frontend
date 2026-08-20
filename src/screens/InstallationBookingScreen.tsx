import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import moment from 'moment';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../utils/api';

const { width } = Dimensions.get('window');

// Calendar view types
type CalendarView = 'month' | 'week' | 'day';

interface RouteParams {
  opportunityId: string;
  customerName?: string;
  customerAddress?: string;
  defaultCalendar?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
}

interface InstallerCalendar {
  id: string;
  name: string;
  color: string;
  note?: string;
  email?: string;
}

const INSTALLER_COLORS = ['#1976d2', '#388e3c', '#7b1fa2', '#f57c00', '#d32f2f', '#00897b', '#5d4037', '#455a64'];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % INSTALLER_COLORS.length;
  return INSTALLER_COLORS[hash];
}

function installerNote(displayName: string): string {
  if (/philip|phil/i.test(displayName)) {
    return 'Install can be completed in one day (but let the customer know it can take two days)';
  }
  return 'Install should be booked over two days';
}

export default function InstallationBookingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, customerName, customerAddress, defaultCalendar } = route.params as RouteParams;
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [view, setView] = useState<CalendarView>('month');
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [booking, setBooking] = useState(false);
  const [newlyBookedEventId, setNewlyBookedEventId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [calendars, setCalendars] = useState<InstallerCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Debug modal state changes
  useEffect(() => {
    console.log('🔍 showSuccessModal state changed to:', showSuccessModal);
    if (showSuccessModal) {
      console.log('🔍 Modal should be visible now!');
    }
  }, [showSuccessModal]);
  const scrollViewRef = useRef<ScrollView>(null);
  const isSurveyor = user?.role === 'SURVEYOR' || user?.role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCalendars(true);
        const token = await authApi.getAccessToken();
        const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '/api').replace(/\/$/, '');
        const response = await fetch(`${apiBaseUrl}/calendar/my-installers`, {
          headers: { Authorization: `Bearer ${token || ''}` },
        });
        if (!response.ok) throw new Error('Could not load installer calendars');
        const data = await response.json();
        const mapped: InstallerCalendar[] = (data.calendars || []).map((row: any) => ({
          id: row.id,
          name: row.displayName,
          email: row.email,
          color: colorForName(row.displayName || row.id),
          note: installerNote(row.displayName || ''),
        }));
        if (!cancelled) setCalendars(mapped);
      } catch (error) {
        console.error('Failed to load installer calendars', error);
        if (!cancelled) setCalendars([]);
      } finally {
        if (!cancelled) setLoadingCalendars(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (calendars.length > 0 && !selectedCalendar) {
      // Use the defaultCalendar if it's available in the filtered list, otherwise use the first available
      const defaultCal = calendars.find(c => c.id === defaultCalendar) || calendars[0];
      setSelectedCalendar(defaultCal.id);
    }
  }, [calendars, defaultCalendar, selectedCalendar]);
  
  // Function to refresh calendar events
  const refreshCalendarEvents = async () => {
    if (!selectedCalendar) {
      setEvents([]);
      return;
    }

    try {
      setLoadingEvents(true);
      const token = await authApi.getAccessToken();
      const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '/api').replace(/\/$/, '');
      const startDate = moment(date).startOf('week').format('YYYY-MM-DD');
      const endDate = moment(date).add(21, 'days').format('YYYY-MM-DD');
      const calendar = calendars.find((c) => c.id === selectedCalendar);
      const apiUrl = `${apiBaseUrl}/calendar/${encodeURIComponent(selectedCalendar)}/events?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      if (!response.ok) {
        throw new Error(`Calendar API ${response.status}`);
      }

      const data = await response.json();
      const calendarEvents: CalendarEvent[] = Array.isArray(data.events)
        ? data.events.map((event: any) => {
            const isAllDay = event.isAllDay || (event.startTime === '00:00' && event.endTime === '00:00');
            const startDateValue = isAllDay
              ? new Date(`${event.date}T00:00:00`)
              : new Date(`${event.date}T${event.startTime}:00`);
            const endDateValue = isAllDay
              ? new Date(`${event.date}T23:59:59`)
              : new Date(`${event.date}T${event.endTime}:00`);
            return {
              id: event.id || `event-${selectedCalendar}-${event.date}-${event.startTime}`,
              title: event.title || 'Appointment',
              start: startDateValue,
              end: endDateValue,
              resource: {
                installer: calendar?.name || data.displayName,
                status: event.status || 'confirmed',
                type: event.title || 'appointment',
                location: event.location || '',
                isAllDay,
                isRecurring: event.isRecurring || false,
                isMultiDay: event.isMultiDay || false,
                startDate: event.startDate,
                endDate: event.endDate,
              },
            };
          })
        : [];
      setEvents(calendarEvents.sort((a, b) => a.start.getTime() - b.start.getTime()));
    } catch (error) {
      console.error('Error refreshing calendar events:', error);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };
  
  useEffect(() => {
    refreshCalendarEvents();
  }, [selectedCalendar, date]);
  
  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);
  
  const handleDateSelect = (selectedDate: Date) => {
    setSelectedDate(selectedDate);
    setSelectedTimeSlot('');
  };
  
  const handleEventPress = (event: CalendarEvent) => {
    Alert.alert(
      'Event Details',
      `${event.title}\n${moment(event.start).format('MMMM Do YYYY, h:mm a')} - ${moment(event.end).format('h:mm a')}`
    );
  };
  
  // Filter events by selected calendar and sort by date
  const getFilteredEvents = () => {
    if (!selectedCalendar) return events.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    const calendarName = calendars.find(c => c.id === selectedCalendar)?.name;
    return events
      .filter(event => event.resource?.installer === calendarName)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  };
  
  const filteredEvents = getFilteredEvents();
  
  // Note: Simplified approach - we'll book directly in installer calendar and add surveyor as attendee

  // Generate time slots for selected date
  const generateTimeSlots = () => {
    if (!selectedDate) return [];
    
    const slots = [];
    const selectedDateStr = moment(selectedDate).format('YYYY-MM-DD');
    
    // Check existing events that overlap with this date for the selected installer
    const selectedDateMoment = moment(selectedDate);
    const startOfDay = selectedDateMoment.clone().startOf('day');
    const endOfDay = selectedDateMoment.clone().endOf('day');
    
    const existingEvents = filteredEvents.filter(event => {
      const eventStart = moment(event.start);
      const eventEnd = moment(event.end);
      
      // Event overlaps with the selected date if:
      // (eventStart < endOfDay) AND (eventEnd > startOfDay)
      return eventStart.isBefore(endOfDay) && eventEnd.isAfter(startOfDay);
    });
    
    console.log('🔍 Checking availability for date:', selectedDateStr);
    console.log('🔍 Existing events on this date:', existingEvents);
    console.log('🔍 Multi-day events detected:', existingEvents.filter(event => {
      const eventStart = moment(event.start);
      const eventEnd = moment(event.end);
      return !eventStart.isSame(eventEnd, 'day');
    }));
    
    // Debug events for the selected calendar
    console.log('🔍 Events debug for', selectedCalendar, 'on date:', selectedDateStr);
    console.log('🔍 All events for', selectedCalendar, ':', filteredEvents);
    console.log('🔍 Events overlapping with', selectedDateStr, ':', existingEvents);
    
    // Generate time slots - only 9am for installer all-day bookings
    const installerHours = [9]; // Only 9am for all-day bookings
    for (let hour of installerHours) {
      const slotTime = new Date(selectedDate);
      slotTime.setHours(hour, 0, 0, 0);
      const slotEndTime = new Date(selectedDate);
      slotEndTime.setHours(23, 59, 59, 999); // End of day for all-day booking
      
      // Check if this time slot conflicts with existing events
      // For all-day bookings, we need to check if any event exists on the same day
      const hasConflict = existingEvents.some(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        const eventStatus = event.resource?.status;
        const eventTitle = event.title;
        
        // Check if event is on the same day as our booking
        const isSameDay = eventStart.toDateString() === selectedDate.toDateString();
        
        if (isSameDay) {
          console.log('🚫 Day conflict detected for all-day booking:', {
            selectedDate: selectedDate.toISOString(),
            eventStart: eventStart.toISOString(),
            eventEnd: eventEnd.toISOString(),
            eventTitle: event.title
          });
          return true;
        }
        
        return false;
      });
      
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        available: !hasConflict
      });
    }
    
    console.log('🔍 Generated time slots:', slots);
    return slots;
  };
  
  const timeSlots = generateTimeSlots();
  
  // Generate calendar days based on current view (limited to 3 weeks for installers)
  const generateCalendarDays = () => {
    let startDate, endDate;
    
    if (view === 'month') {
      // Limit to 3 weeks instead of full month
      startDate = moment(date).startOf('week');
      endDate = moment(date).startOf('week').add(2, 'weeks').endOf('week'); // 3 weeks total
    } else if (view === 'week') {
      startDate = moment(date).startOf('week');
      endDate = moment(date).endOf('week');
    } else { // day view
      startDate = moment(date).startOf('day');
      endDate = moment(date).endOf('day');
    }
    
    const days = [];
    const current = startDate.clone();
    
    while (current.isSameOrBefore(endDate, 'day')) {
      const currentStartOfDay = current.clone().startOf('day');
      const currentEndOfDay = current.clone().endOf('day');
      
      const dayEvents = filteredEvents.filter(event => {
        const eventStart = moment(event.start);
        const eventEnd = moment(event.end);
        
        // Event overlaps with the current day if:
        // (eventStart < currentEndOfDay) AND (eventEnd > currentStartOfDay)
        return eventStart.isBefore(currentEndOfDay) && eventEnd.isAfter(currentStartOfDay);
      });
      
      // Check if the day has any blocking events (all-day or unavailable)
      const hasBlockingEvents = dayEvents.some(event => {
        const isAllDayEvent = event.resource?.isAllDay || 
          (event.start.getHours() === 0 && event.start.getMinutes() === 0 && 
           event.end.getHours() === 0 && event.end.getMinutes() === 0);
        
        const isUnavailableEvent = event.title && 
          event.title.match(/Not available|Unavailable|Blocked|Holiday|Leave/i);
        
        return isAllDayEvent || isUnavailableEvent;
      });
      
      days.push({
        date: current.toDate(),
        isCurrentMonth: current.isSame(date, 'month'),
        isToday: current.isSame(moment(), 'day'),
        isSelected: selectedDate ? current.isSame(moment(selectedDate), 'day') : false,
        events: dayEvents,
        hasBlockingEvents: hasBlockingEvents
      });
      
      current.add(1, 'day');
    }
    
    return days;
  };
  
  const calendarDays = generateCalendarDays();
  
  const handleTimeSlotSelect = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
  };
  
  const handleBookInstallation = async () => {
    console.log('🔧 Starting booking process...');
    console.log('🔧 calendars:', calendars);
    console.log('🔧 selectedCalendar:', selectedCalendar);
    console.log('🔧 isSurveyor:', isSurveyor);
    
    if (!selectedDate || !selectedTimeSlot || !selectedCalendar) {
      Alert.alert('Missing Information', 'Please select a date, time slot, and installer.');
      return;
    }
    
    // Validate that the selected time slot is still available
    const selectedDateMoment = moment(selectedDate);
    const startOfDay = selectedDateMoment.clone().startOf('day');
    const endOfDay = selectedDateMoment.clone().endOf('day');
    
    const existingEvents = filteredEvents.filter(event => {
      const eventStart = moment(event.start);
      const eventEnd = moment(event.end);
      
      // Event overlaps with the selected date if:
      // (eventStart < endOfDay) AND (eventEnd > startOfDay)
      return eventStart.isBefore(endOfDay) && eventEnd.isAfter(startOfDay);
    });
    
    const [hours, minutes] = selectedTimeSlot.split(':').map(Number);
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hours, 0, 0, 0);
    
    const hasConflict = existingEvents.some(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return slotTime >= eventStart && slotTime < eventEnd;
    });
    
    if (hasConflict) {
      Alert.alert('Time Slot Unavailable', 'This time slot is no longer available. Please select a different time.');
      return;
    }
    
    setBooking(true);
    let optimisticEventIds: string[] = [];
    
    try {
      // Create new event with proper date/time handling
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      // For installers, create all-day booking from 9am to end of day, then all day next day
      const endTime = new Date(startTime);
      endTime.setHours(23, 59, 59, 999); // End of day
      
      // Next day - all day
      const nextDay = new Date(startTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0); // Start of next day
      
      const nextDayEndTime = new Date(nextDay);
      nextDayEndTime.setHours(23, 59, 59, 999); // End of next day
      
      const installerName = calendars.find(c => c.id === selectedCalendar)?.name;
      const customerDisplayName = customerName || 'Customer';
      
      // Create event for selected day (9am to end of day)
      const newEvent: CalendarEvent = {
        id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: `Installation - ${installerName} (Day 1 - 9am to end of day)`,
        start: startTime,
        end: endTime,
        resource: {
          installer: installerName,
          status: 'confirmed',
          customer: customerDisplayName,
          opportunityId: opportunityId,
          customerAddress: customerAddress,
          bookingDate: new Date().toISOString(),
          type: 'installation',
          day: 1,
          allDay: false
        }
      };
      
      // Create event for next day (all day)
      const nextDayEvent: CalendarEvent = {
        id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-day2`,
        title: `Installation - ${installerName} (Day 2 - All Day)`,
        start: nextDay,
        end: nextDayEndTime,
        resource: {
          installer: installerName,
          status: 'confirmed',
          customer: customerDisplayName,
          opportunityId: opportunityId,
          customerAddress: customerAddress,
          bookingDate: new Date().toISOString(),
          type: 'installation',
          day: 2,
          allDay: true
        }
      };
      optimisticEventIds = [newEvent.id, nextDayEvent.id];
      
      // Add both events immediately for visual feedback
      setEvents(prev => {
        const updatedEvents = [...prev, newEvent, nextDayEvent];
        console.log('New events added:', newEvent, nextDayEvent);
        console.log('Total events:', updatedEvents.length);
        return updatedEvents;
      });
      
      // Set newly booked event for visual feedback
      setNewlyBookedEventId(newEvent.id);
      
      // Auto-scroll to the booked date if it's not in the current view
      const bookedDate = moment(newEvent.start);
      const currentViewDate = moment(date);
      
      if (view === 'month') {
        if (!bookedDate.isSame(currentViewDate, 'month')) {
          setDate(newEvent.start);
        }
      } else if (view === 'week') {
        if (!bookedDate.isSame(currentViewDate, 'week')) {
          setDate(newEvent.start);
        }
      } else if (view === 'day') {
        if (!bookedDate.isSame(currentViewDate, 'day')) {
          setDate(newEvent.start);
        }
      }
      
      // Clear the newly booked indicator after 5 seconds
      setTimeout(() => {
        setNewlyBookedEventId(null);
      }, 5000);
      
      // Call real backend API to book appointment
      const token = await authApi.getAccessToken();
      
      // Add surveyor info if user is a surveyor
      const bookingData = {
        opportunityId: opportunityId,
        customerName: customerDisplayName,
        customerAddress: customerAddress,
        calendar: selectedCalendar,
        date: moment(selectedDate).format('YYYY-MM-DD'),
        timeSlot: selectedTimeSlot,
        installer: installerName,
      };

      console.log('Booking appointment with data:', bookingData);

      const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${apiBaseUrl}/calendar/book-appointment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify(bookingData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Booking API response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to book appointment');
      }
      
      // Refresh calendar events to show the new booking
      await refreshCalendarEvents();
      
      // Show success popup with navigation to next step
      console.log('🎉 Booking successful! Setting showSuccessModal to true');
      setShowSuccessModal(true);
      console.log('🎉 showSuccessModal state updated');
    } catch (error) {
      console.error('Booking error:', error);
      setEvents(prev =>
        prev.filter(event => !optimisticEventIds.includes(event.id))
      );
      setNewlyBookedEventId(null);
      Alert.alert(
        'Booking Failed', 
        'Failed to book installation. Please try again or contact support if the problem persists.',
        [
          {
            text: 'Try Again',
            onPress: () => setBooking(false)
          }
        ]
      );
    } finally {
      setBooking(false);
    }
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 24,
      paddingHorizontal: width < 768 ? 16 : 24,
      backgroundColor: '#ffffff',
      shadowColor: 'rgba(0, 0, 0, 0.12)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backButton: {
      padding: width < 768 ? 12 : 14,
      borderRadius: 16,
      backgroundColor: '#f8fafc',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: 'rgba(0, 0, 0, 0.08)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.04)',
      marginRight: 16,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontSize: width < 768 ? 24 : 28,
      fontWeight: '800',
      color: '#1e293b',
      letterSpacing: -0.8,
    },
    headerSubtitle: {
      fontSize: 15,
      color: '#64748b',
      marginTop: 4,
      lineHeight: 20,
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: width < 768 ? 16 : 24,
      paddingTop: 0,
    },
    section: {
      marginBottom: width < 768 ? 20 : 24,
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: width < 768 ? 18 : 20,
      fontWeight: '700',
      color: theme.primaryText,
      letterSpacing: -0.3,
    },
    subSectionTitle: {
      fontSize: width < 768 ? 16 : 18,
      fontWeight: '600',
      color: theme.primaryText,
      marginBottom: 12,
      letterSpacing: -0.2,
    },
    bookingModeContainer: {
      flexDirection: 'row',
      gap: width < 768 ? 12 : 16,
    },
    bookingModeButton: {
      flex: 1,
      padding: width < 768 ? 16 : 20,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      alignItems: 'center',
      gap: 8,
    },
    bookingModeButtonActive: {
      borderColor: theme.primaryButton,
      backgroundColor: theme.primaryButton,
    },
    bookingModeText: {
      fontSize: width < 768 ? 14 : 16,
      fontWeight: '600',
      color: theme.primaryText,
      textAlign: 'center',
    },
    bookingModeTextActive: {
      color: '#FFFFFF',
    },
    bookingModeSubtext: {
      fontSize: width < 768 ? 12 : 14,
      color: theme.secondaryText,
      textAlign: 'center',
    },
    bookingModeSubtextActive: {
      color: '#FFFFFF',
      opacity: 0.9,
    },
    calendarTypeText: {
      fontSize: width < 768 ? 10 : 12,
      color: theme.secondaryText,
      textTransform: 'capitalize',
      marginTop: 2,
    },
    calendarTypeTextSelected: {
      color: '#FFFFFF',
      opacity: 0.8,
    },
    adminBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10b981',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    adminBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    calendarContainer: {
      backgroundColor: theme.cardBackground,
      borderRadius: width < 768 ? 12 : 16,
      padding: width < 768 ? 12 : 16,
      marginBottom: width < 768 ? 16 : 20,
      shadowColor: 'rgba(0, 0, 0, 0.08)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      ...(Platform.OS === 'web' && {
        marginBottom: 24,
        minHeight: 400,
      }),
    },
    calendarToolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    toolbarButton: {
      padding: 8,
      borderRadius: 6,
      backgroundColor: theme.tertiaryBackground,
    },
    toolbarTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.primaryText,
    },
    viewButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    viewButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.tertiaryBackground,
    },
    viewButtonActive: {
      backgroundColor: theme.primaryButton,
    },
    viewButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.primaryText,
    },
    viewButtonTextActive: {
      color: '#FFFFFF',
    },
    installerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: width < 768 ? 8 : 12,
    },
    installerButton: {
      paddingHorizontal: width < 768 ? 12 : 16,
      paddingVertical: width < 768 ? 10 : 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      minWidth: width < 768 ? 120 : 140,
      flex: width < 768 ? 1 : undefined,
      maxWidth: width < 768 ? '48%' : undefined,
    },
    installerButtonSelected: {
      borderColor: theme.primaryButton,
      backgroundColor: theme.primaryButton,
    },
    installerButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    installerColorIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 8,
    },
    installerText: {
      fontSize: width < 768 ? 12 : 14,
      fontWeight: '600',
      color: theme.primaryText,
    },
    installerTextSelected: {
      color: '#FFFFFF',
    },
    // Current Installer Info
    currentInstallerInfo: {
      marginTop: 16,
      padding: 16,
      backgroundColor: theme.tertiaryBackground,
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: calendars.find(c => c.id === selectedCalendar)?.color || theme.primaryButton,
    },
    installerInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    installerInfoColor: {
      width: 16,
      height: 16,
      borderRadius: 8,
      marginRight: 12,
    },
    installerInfoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primaryText,
    },
    installerInfoSubtitle: {
      fontSize: 14,
      color: theme.secondaryText,
      marginLeft: 28,
    },
    installerNoteContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: theme.primaryButton + '10',
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: theme.primaryButton,
    },
    installerNoteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    installerNoteTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primaryButton,
      marginLeft: 6,
    },
    installerNoteText: {
      fontSize: 13,
      color: theme.primaryText,
      lineHeight: 18,
      opacity: 0.9,
    },
    teamMembersContainer: {
      marginTop: 12,
      gap: 8,
    },
    teamMember: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.tertiaryBackground,
      borderRadius: 8,
      gap: 12,
    },
    teamMemberName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primaryText,
      flex: 1,
    },
    teamMemberRole: {
      fontSize: 12,
      color: theme.secondaryText,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    noInstallersContainer: {
      padding: 24,
      backgroundColor: theme.tertiaryBackground,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.cardBorder,
      borderStyle: 'dashed',
    },
    noInstallersTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.primaryText,
      marginTop: 12,
      marginBottom: 8,
    },
    noInstallersText: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: 'center',
      lineHeight: 20,
    },
    timeSlotsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: width < 768 ? 6 : 8,
    },
    timeSlotButton: {
      paddingHorizontal: width < 768 ? 12 : 16,
      paddingVertical: width < 768 ? 8 : 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      minWidth: width < 768 ? 70 : 80,
      alignItems: 'center',
      flex: width < 768 ? 1 : undefined,
      maxWidth: width < 768 ? '30%' : undefined,
    },
    timeSlotButtonSelected: {
      borderColor: theme.primaryButton,
      backgroundColor: theme.primaryButton,
    },
    timeSlotButtonUnavailable: {
      backgroundColor: theme.tertiaryBackground,
      opacity: 0.5,
    },
    timeSlotText: {
      fontSize: width < 768 ? 12 : 14,
      fontWeight: '500',
      color: theme.primaryText,
    },
    timeSlotTextSelected: {
      color: '#FFFFFF',
    },
    timeSlotTextUnavailable: {
      color: theme.tertiaryBackground,
    },
    bookButton: {
      backgroundColor: theme.primaryButton,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 20,
    },
    bookButtonDisabled: {
      backgroundColor: theme.tertiaryBackground,
    },
    bookButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    // Custom Calendar Styles
    calendarGrid: {
      backgroundColor: theme.cardBackground,
      borderRadius: 8,
      overflow: 'hidden',
      flex: 1,
    },
    calendarHeader: {
      flexDirection: 'row',
      backgroundColor: theme.tertiaryBackground,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
    },
    dayHeader: {
      flex: 1,
      paddingVertical: width < 768 ? 8 : 12,
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: theme.cardBorder,
    },
    dayHeaderText: {
      fontSize: width < 768 ? 12 : 14,
      fontWeight: '600',
      color: theme.primaryText,
    },
    calendarScrollView: {
      flex: 1,
      maxHeight: width < 768 ? 250 : 350,
    },
    calendarScrollContent: {
      flexGrow: 1,
    },
    calendarBody: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      minHeight: '100%',
    },
    dayCell: {
      width: '14.28%',
      aspectRatio: 1,
      padding: width < 768 ? 2 : 4,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderRightColor: theme.cardBorder,
      borderBottomColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      minHeight: width < 768 ? 50 : 60,
    },
    dayCellInactive: {
      backgroundColor: theme.tertiaryBackground,
      opacity: 0.5,
    },
    dayCellToday: {
      backgroundColor: `${theme.primaryButton}20`,
    },
    dayCellSelected: {
      backgroundColor: theme.primaryButton,
    },
    dayText: {
      fontSize: width < 768 ? 12 : 14,
      fontWeight: '500',
      color: theme.primaryText,
      marginBottom: 2,
    },
    dayTextInactive: {
      color: theme.tertiaryText,
    },
    dayTextToday: {
      color: theme.primaryButton,
      fontWeight: '600',
    },
    dayTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    eventsContainer: {
      flex: 1,
      width: '100%',
      justifyContent: 'flex-end',
    },
    eventBadge: {
      paddingHorizontal: width < 768 ? 2 : 4,
      paddingVertical: width < 768 ? 1 : 2,
      borderRadius: 3,
      marginBottom: 1,
      minHeight: width < 768 ? 12 : 16,
      justifyContent: 'center',
    },
    eventText: {
      fontSize: width < 768 ? 8 : 10,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    moreEventsBadge: {
      backgroundColor: theme.tertiaryBackground,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 3,
      alignSelf: 'flex-start',
    },
    moreEventsText: {
      fontSize: 10,
      color: theme.primaryText,
      fontWeight: '500',
    },
    // Week View Styles
    weekDayCell: {
      width: '14.28%',
      minHeight: 120,
    },
    weekEventBadge: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      marginBottom: 2,
    },
    weekEventText: {
      fontSize: 11,
    },
    // Day View Styles
    dayViewBody: {
      flexDirection: 'column',
    },
    dayViewContainer: {
      flex: 1,
    },
    dayViewHeader: {
      padding: 16,
      backgroundColor: theme.tertiaryBackground,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
    },
    dayViewTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.primaryText,
      textAlign: 'center',
    },
    hourlySlots: {
      flex: 1,
    },
    hourSlot: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
      minHeight: 60,
    },
    hourLabel: {
      width: 80,
      fontSize: 14,
      fontWeight: '500',
      color: theme.primaryText,
      textAlign: 'right',
      marginRight: 16,
    },
    hourEvents: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    hourEvent: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      minWidth: 120,
    },
    hourEventText: {
      fontSize: 12,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    availableSlot: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.tertiaryBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      borderStyle: 'dashed',
    },
    availableSlotText: {
      fontSize: 12,
      color: theme.primaryText,
      fontWeight: '500',
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    successIconContainer: {
      marginBottom: 16,
    },
    successIcon: {
      fontSize: 48,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 12,
    },
    modalMessage: {
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    modalButtonContainer: {
      width: '100%',
      gap: 12,
    },
    modalButton: {
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButton: {
      // backgroundColor will be set dynamically
    },
    secondaryButton: {
      borderWidth: 2,
      backgroundColor: 'transparent',
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
  
  
  return (
    <View style={[
      styles.container,
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Installation Booking
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Select installer and book appointment
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        style={[
          styles.scrollView,
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]}
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          { 
            paddingBottom: 40,
            marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
          },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
            marginBottom: 65, // Add margin for BottomNavigation on web
          }
        ]}
      >
        <View style={styles.content}>
          {/* Select Installer */}
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Select Installer</Text>
            {user?.role === 'ADMIN' && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#ffffff" />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
            {isSurveyor && (
              <View style={[styles.adminBadge, { backgroundColor: '#8b5cf6' }]}>
                <Ionicons name="search" size={14} color="#ffffff" />
                <Text style={styles.adminBadgeText}>Surveyor</Text>
              </View>
            )}
          </View>
          {loadingCalendars ? (
            <ActivityIndicator color={theme.primaryButton} />
          ) : calendars.length === 0 ? (
            <View style={styles.noInstallersContainer}>
              <Ionicons name="warning" size={24} color="#f59e0b" />
              <Text style={styles.noInstallersTitle}>No Installers Available</Text>
              <Text style={styles.noInstallersText}>
                No installers are assigned to your area. Please contact your manager to set up installer assignments.
              </Text>
            </View>
          ) : (
            <View style={styles.installerGrid}>
              {calendars.map((calendar) => (
                <TouchableOpacity
                  key={calendar.id}
                  style={[
                    styles.installerButton,
                    selectedCalendar === calendar.id && styles.installerButtonSelected
                  ]}
                  onPress={() => {
                    setSelectedCalendar(calendar.id);
                    setSelectedDate(null);
                    setSelectedTimeSlot('');
                    setNewlyBookedEventId(null);
                  }}
                >
                  <View style={styles.installerButtonContent}>
                    <View style={[
                      styles.installerColorIndicator,
                      { backgroundColor: calendar.color }
                    ]} />
                    <Text
                      style={[
                        styles.installerText,
                        selectedCalendar === calendar.id && styles.installerTextSelected
                      ]}
                    >
                      {calendar.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Current Installer Info */}
          {selectedCalendar && (
            <View style={styles.currentInstallerInfo}>
              <View style={styles.installerInfoHeader}>
                <View style={[
                  styles.installerInfoColor,
                  { backgroundColor: calendars.find(c => c.id === selectedCalendar)?.color }
                ]} />
                <Text style={styles.installerInfoTitle}>
                  Viewing {calendars.find(c => c.id === selectedCalendar)?.name}'s Calendar
                </Text>
              </View>
              <Text style={styles.installerInfoSubtitle}>
                {filteredEvents.length} upcoming appointments
                {loadingEvents ? 'Loading availability…' : 'One all-day slot at 09:00. Busy days are blocked.'}
              </Text>
              {/* Installer Notes */}
              {calendars.find(c => c.id === selectedCalendar)?.note && (
                <View style={styles.installerNoteContainer}>
                  <View style={styles.installerNoteHeader}>
                    <Ionicons name="information-circle" size={16} color={theme.primaryButton} />
                    <Text style={styles.installerNoteTitle}>Installation Note:</Text>
                  </View>
                  <Text style={styles.installerNoteText}>
                    {calendars.find(c => c.id === selectedCalendar)?.note}
                  </Text>
                </View>
              )}
              {isSurveyor && (
                <View style={styles.installerNoteContainer}>
                  <View style={styles.installerNoteHeader}>
                    <Ionicons name="sync" size={16} color="#8b5cf6" />
                    <Text style={[styles.installerNoteTitle, { color: '#8b5cf6' }]}>Surveyor Mode:</Text>
                  </View>
                  <Text style={styles.installerNoteText}>
                    Available times shown are when both you and the installer are free. Booking will automatically schedule both calendars.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Professional Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date & Time</Text>
          <View style={[
            styles.calendarContainer,
            { 
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
              shadowColor: theme.shadowColor,
            }
          ]}>
            {/* Calendar Toolbar */}
            <View style={styles.calendarToolbar}>
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={() => setDate(moment(date).subtract(1, view === 'month' ? 'month' : 'week').toDate())}
              >
                <Ionicons name="chevron-back" size={20} color={theme.primaryButton} />
              </TouchableOpacity>
              
              <Text style={styles.toolbarTitle}>
                {moment(date).format(view === 'month' ? 'MMMM YYYY' : 'MMM D, YYYY')}
              </Text>
              
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={() => setDate(moment(date).add(1, view === 'month' ? 'month' : 'week').toDate())}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.primaryButton} />
              </TouchableOpacity>
            </View>
            
            {/* View Buttons */}
            <View style={styles.viewButtons}>
              <TouchableOpacity
                style={[styles.viewButton, view === 'month' && styles.viewButtonActive]}
                onPress={() => setView('month')}
              >
                <Text style={[styles.viewButtonText, view === 'month' && styles.viewButtonTextActive]}>
                  Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewButton, view === 'week' && styles.viewButtonActive]}
                onPress={() => setView('week')}
              >
                <Text style={[styles.viewButtonText, view === 'week' && styles.viewButtonTextActive]}>
                  Week
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewButton, view === 'day' && styles.viewButtonActive]}
                onPress={() => setView('day')}
              >
                <Text style={[styles.viewButtonText, view === 'day' && styles.viewButtonTextActive]}>
                  Day
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Custom Calendar */}
            <View style={styles.calendarGrid}>
              {/* Calendar Header - Only show for month and week views */}
              {(view === 'month' || view === 'week') && (
                <View style={styles.calendarHeader}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <View key={day} style={styles.dayHeader}>
                      <Text style={styles.dayHeaderText}>{day}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Calendar Days with ScrollView */}
              <ScrollView 
                style={[
                  styles.calendarScrollView,
                  view === 'day' && styles.dayViewBody
                ]}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                scrollEnabled={true}
                bounces={true}
                alwaysBounceVertical={false}
                contentContainerStyle={styles.calendarScrollContent}
              >
                <View style={[
                  styles.calendarBody,
                  view === 'day' && styles.dayViewBody
                ]}>
                {view === 'day' ? (
                  // Day View - Show hourly slots
                  <View style={styles.dayViewContainer}>
                    <View style={styles.dayViewHeader}>
                      <Text style={styles.dayViewTitle}>
                        {moment(date).format('dddd, MMMM Do YYYY')}
                      </Text>
                    </View>
                    <ScrollView style={styles.hourlySlots}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = 8 + i; // 8 AM to 7 PM
                        const hourStart = moment(date).hour(hour).minute(0);
                        const hourEnd = moment(date).hour(hour + 1).minute(0);
                        
                        const hourEvents = filteredEvents.filter(event => {
                          const eventStart = moment(event.start);
                          return eventStart.isSame(hourStart, 'hour');
                        });
                        
                        return (
                          <View key={hour} style={styles.hourSlot}>
                            <Text style={styles.hourLabel}>
                              {hourStart.format('h:mm A')}
                            </Text>
                            <View style={styles.hourEvents}>
                              {hourEvents.map((event, eventIndex) => (
                                <TouchableOpacity
                                  key={eventIndex}
                                  style={[
                                    styles.hourEvent,
                                    {
                                      backgroundColor: calendars.find(c => c.name === event.resource?.installer)?.color || theme.primaryButton
                                    },
                                    newlyBookedEventId === event.id && {
                                      borderWidth: 2,
                                      borderColor: '#10b981',
                                      shadowColor: '#10b981',
                                      shadowOffset: { width: 0, height: 2 },
                                      shadowOpacity: 0.3,
                                      shadowRadius: 4,
                                      elevation: 6,
                                    }
                                  ]}
                                  onPress={() => handleEventPress(event)}
                                >
                                  <Text style={styles.hourEventText} numberOfLines={1}>
                                    {event.title}
                                  </Text>
                                  {newlyBookedEventId === event.id && (
                                    <Text style={[styles.hourEventText, { fontSize: 10, marginTop: 2 }]}>
                                      ✨ NEW
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              ))}
                              {hourEvents.length === 0 && (
                                <TouchableOpacity
                                  style={[
                                    styles.availableSlot,
                                    selectedDate && moment(selectedDate).isSame(date, 'day') && 
                                    selectedTimeSlot === hourStart.format('HH:mm') && {
                                      backgroundColor: theme.primaryButton,
                                      borderColor: theme.primaryButton,
                                    }
                                  ]}
                                  onPress={() => {
                                    setSelectedDate(date);
                                    setSelectedTimeSlot(hourStart.format('HH:mm'));
                                  }}
                                >
                                  <Text style={[
                                    styles.availableSlotText,
                                    selectedDate && moment(selectedDate).isSame(date, 'day') && 
                                    selectedTimeSlot === hourStart.format('HH:mm') && {
                                      color: '#FFFFFF',
                                    }
                                  ]}>
                                    {selectedDate && moment(selectedDate).isSame(date, 'day') && 
                                     selectedTimeSlot === hourStart.format('HH:mm') ? 'Selected' : 'Available'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  // Month and Week Views
                  calendarDays.map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayCell,
                        view === 'week' && styles.weekDayCell,
                        !day.isCurrentMonth && styles.dayCellInactive,
                        day.isToday && styles.dayCellToday,
                        day.isSelected && styles.dayCellSelected
                      ]}
                      onPress={() => handleDateSelect(day.date)}
                    >
                      <Text style={[
                        styles.dayText,
                        !day.isCurrentMonth && styles.dayTextInactive,
                        day.isToday && styles.dayTextToday,
                        day.isSelected && styles.dayTextSelected
                      ]}>
                        {moment(day.date).format('D')}
                      </Text>
                      
                      {/* Events for this day */}
                      <View style={styles.eventsContainer}>
                        {day.events.slice(0, view === 'week' ? 3 : 2).map((event, eventIndex) => (
                          <TouchableOpacity
                            key={eventIndex}
                            style={[
                              styles.eventBadge,
                              view === 'week' && styles.weekEventBadge,
                              {
                                backgroundColor: calendars.find(c => c.name === event.resource?.installer)?.color || theme.primaryButton
                              },
                              newlyBookedEventId === event.id && {
                                borderWidth: 2,
                                borderColor: '#10b981',
                                shadowColor: '#10b981',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: 6,
                              }
                            ]}
                            onPress={() => handleEventPress(event)}
                          >
                            <Text style={[
                              styles.eventText,
                              view === 'week' && styles.weekEventText
                            ]} numberOfLines={1}>
                              {view === 'week' ? event.title : moment(event.start).format('HH:mm')}
                            </Text>
                            {newlyBookedEventId === event.id && (
                              <Text style={[styles.eventText, { fontSize: 8, marginTop: 1 }]}>
                                ✨ NEW
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                        {day.events.length > (view === 'week' ? 3 : 2) && (
                          <View style={styles.moreEventsBadge}>
                            <Text style={styles.moreEventsText}>
                              +{day.events.length - (view === 'week' ? 3 : 2)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
        
        {/* Time Slots for Selected Date */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Available Times for {moment(selectedDate).format('MMMM Do YYYY')}
            </Text>
            <View style={styles.timeSlotsGrid}>
              {timeSlots.map((slot) => (
                <TouchableOpacity
                  key={slot.time}
                  style={[
                    styles.timeSlotButton,
                    selectedTimeSlot === slot.time && styles.timeSlotButtonSelected,
                    !slot.available && styles.timeSlotButtonUnavailable
                  ]}
                  onPress={() => slot.available && handleTimeSlotSelect(slot.time)}
                  disabled={!slot.available}
                >
                  <Text
                    style={[
                      styles.timeSlotText,
                      selectedTimeSlot === slot.time && styles.timeSlotTextSelected,
                      !slot.available && styles.timeSlotTextUnavailable
                    ]}
                  >
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        
        {/* Book Button */}
        <TouchableOpacity
          style={[
            styles.bookButton,
            (!selectedDate || !selectedTimeSlot || !selectedCalendar || booking || calendars.length === 0) && styles.bookButtonDisabled
          ]}
          onPress={handleBookInstallation}
          disabled={!selectedDate || !selectedTimeSlot || !selectedCalendar || booking || calendars.length === 0}
        >
          {booking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.bookButtonText}>
              {calendars.length === 0 ? 'No Installers Available' : 'Book Installation'}
            </Text>
          )}
        </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.primaryBackground }]}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✅</Text>
            </View>
            
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Successfully Booked!
            </Text>
            
            <Text style={[styles.modalMessage, { color: theme.secondaryText }]}>
              Your installation has been successfully booked and added to the calendar.
            </Text>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  // Navigate directly to Welcome Email screen
                  navigation.navigate('WelcomeEmail', { 
                    opportunityId: opportunityId,
                    opportunity: null
                  });
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  Continue to Next Step
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton, { borderColor: theme.primaryButton }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  // Reset form and stay on current screen
                  setSelectedDate(null);
                  setSelectedTimeSlot('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.primaryButton }]}>
                  Book Another
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}