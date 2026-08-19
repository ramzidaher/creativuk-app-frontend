import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { opportunitiesApi } from '../utils/api';
import { VISIT_TYPE_HOME, VISIT_TYPE_REMOTE, type VisitType } from '../utils/visitType';
import CustomerPhotoUploadLinkButton from './CustomerPhotoUploadLinkButton';

type Props = {
  opportunityId: string;
  customerLabel?: string;
  showPhotoLink?: boolean;
  requirePhotoLinkForRemote?: boolean;
  onVisitTypeChange?: (visitType: VisitType | null) => void;
  onPhotoLinkCreated?: () => void;
};

export default function AppointmentVisitTypePanel({
  opportunityId,
  customerLabel,
  showPhotoLink = true,
  requirePhotoLinkForRemote = false,
  onVisitTypeChange,
  onPhotoLinkCreated,
}: Props) {
  const [visitType, setVisitType] = useState<VisitType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await opportunitiesApi.getVisitType(opportunityId);
        if (!response.success) {
          throw new Error(response.error || 'Could not load visit type');
        }
        const payload: any = response.data?.visitType !== undefined ? response.data : response.data?.data;
        const next = payload?.visitType ?? null;
        if (!cancelled) {
          setVisitType(next);
          onVisitTypeChange?.(next);
        }
      } catch {
        if (!cancelled) setError('Could not load visit type');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  const selectVisitType = async (next: VisitType) => {
    try {
      setSaving(true);
      setError(null);
      const response = await opportunitiesApi.setVisitType(opportunityId, next);
      if (!response.success) {
        throw new Error(response.error || 'Could not save visit type');
      }
      const payload: any = response.data?.visitType !== undefined ? response.data : response.data?.data;
      const saved = payload?.visitType ?? next;
      setVisitType(saved);
      onVisitTypeChange?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save visit type');
    } finally {
      setSaving(false);
    }
  };

  const remote = visitType === VISIT_TYPE_REMOTE;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Appointment type</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.choice, visitType === VISIT_TYPE_HOME && styles.choiceSelected]}
          onPress={() => selectVisitType(VISIT_TYPE_HOME)}
          disabled={saving}
        >
          <Feather
            name="home"
            size={16}
            color={visitType === VISIT_TYPE_HOME ? '#fff' : '#166534'}
          />
          <Text style={[styles.choiceText, visitType === VISIT_TYPE_HOME && styles.choiceTextSelected]}>
            Home visit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.choice, remote && styles.choiceSelected]}
          onPress={() => selectVisitType(VISIT_TYPE_REMOTE)}
          disabled={saving}
        >
          <Feather name="video" size={16} color={remote ? '#fff' : '#166534'} />
          <Text style={[styles.choiceText, remote && styles.choiceTextSelected]}>Remote / Zoom</Text>
        </TouchableOpacity>
        {(loading || saving) && <ActivityIndicator size="small" color="#166534" />}
      </View>

      <Text style={styles.hint}>
        {remote
          ? 'Customer photos go into this same survey. They are not a separate folder. Send the link during the call if you need extra sales photos, and always send it after the contract is signed.'
          : 'On a home visit the surveyor usually takes the photos. Keep the copy-link button available if ops later need extra pictures from the customer.'}
      </Text>

      {requirePhotoLinkForRemote && remote ? (
        <Text style={styles.requiredNote}>
          Send the survey photo link before the welcome email so install has the property pictures.
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {showPhotoLink ? (
        <CustomerPhotoUploadLinkButton
          opportunityId={opportunityId}
          customerLabel={customerLabel}
          onCreated={onPhotoLinkCreated}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532d',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#fff',
  },
  choiceSelected: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  choiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  choiceTextSelected: {
    color: '#fff',
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#166534',
  },
  requiredNote: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: '#92400e',
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    color: '#991b1b',
  },
});
