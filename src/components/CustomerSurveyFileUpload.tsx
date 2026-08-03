import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export type CustomerUploadFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
};

type Props = {
  label: string;
  hint?: string;
  required?: boolean;
  minRequired?: number;
  maxFiles?: number;
  files: CustomerUploadFile[];
  uploading?: boolean;
  onPress: () => void;
  onWebDrop?: (dataTransfer: DataTransfer) => void | Promise<void>;
};

export default function CustomerSurveyFileUpload({
  label,
  hint,
  required = true,
  minRequired = 2,
  maxFiles = 10,
  files,
  uploading = false,
  onPress,
  onWebDrop,
}: Props) {
  const { theme } = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const isWeb = Platform.OS === 'web';
  const currentCount = files.length;
  const isComplete = !required || currentCount >= minRequired;
  const isDisabled = uploading;

  const uploadZoneStyle = {
    backgroundColor: isDragOver ? theme.primaryButton + '15' : theme.inputBackground,
    borderColor: isDragOver ? theme.primaryButton : isComplete ? '#10b981' : theme.cardBorder,
    borderStyle: isDragOver ? ('dashed' as const) : ('solid' as const),
    opacity: isDisabled ? 0.65 : 1,
  };

  const uploadZoneContent = (
    <View style={styles.uploadContent}>
      {uploading ? (
        <ActivityIndicator size="small" color={theme.primaryButton} />
      ) : (
        <Ionicons
          name={isDragOver ? 'cloud-upload-outline' : 'camera-outline'}
          size={32}
          color={theme.primaryButton}
        />
      )}
      <Text style={[styles.uploadTitle, { color: theme.primaryText }]}>
        {uploading ? 'Uploading…' : isDragOver ? 'Drop images here' : 'Add photos'}
      </Text>
      <Text style={[styles.uploadSubtitle, { color: theme.secondaryText }]}>
        {isWeb ? 'Tap to select or drag and drop images here' : 'Tap to take photos or select from gallery'}
      </Text>
      <Text style={[styles.uploadHint, { color: theme.secondaryText }]}>
        {required ? `Minimum ${minRequired} image${minRequired === 1 ? '' : 's'} required` : 'Optional'}
        {isWeb ? ' • Drag & drop' : ''}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.primaryText }]}>
          {label}
          {required ? <Text style={{ color: theme.dangerButton }}> *</Text> : null}
        </Text>
        <Text style={[styles.count, { color: isComplete ? '#10b981' : '#f59e0b' }]}>
          {currentCount}/{maxFiles}
        </Text>
      </View>
      {hint ? (
        <Text style={[styles.hint, { color: theme.secondaryText }]}>{hint}</Text>
      ) : null}

      {isWeb && onWebDrop ? (
        <div
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          aria-label={`Upload ${label}`}
          style={{
            borderRadius: 12,
            border: `2px ${uploadZoneStyle.borderStyle} ${uploadZoneStyle.borderColor}`,
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 120,
            backgroundColor: uploadZoneStyle.backgroundColor,
            opacity: uploadZoneStyle.opacity,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            boxSizing: 'border-box',
            marginBottom: files.length ? 12 : 0,
          }}
          onClick={() => {
            if (!isDisabled) onPress();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDisabled) setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDisabled) setIsDragOver(true);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            if (!isDisabled && e.dataTransfer) {
              await onWebDrop(e.dataTransfer);
            }
          }}
        >
          {uploadZoneContent}
        </div>
      ) : (
        <Pressable
          style={[
            styles.uploadZone,
            {
              backgroundColor: uploadZoneStyle.backgroundColor,
              borderColor: uploadZoneStyle.borderColor,
              borderStyle: uploadZoneStyle.borderStyle,
              opacity: uploadZoneStyle.opacity,
            },
          ]}
          onPress={() => {
            if (!isDisabled) onPress();
          }}
          disabled={isDisabled}
        >
          {uploadZoneContent}
        </Pressable>
      )}

      {files.length > 0 ? (
        <View style={[styles.fileList, { backgroundColor: theme.tertiaryBackground }]}>
          {files.map((file, index) => (
            <View
              key={`${file.uri}-${index}`}
              style={[styles.fileItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            >
              {file.mimeType?.startsWith('image/') || file.uri.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                <Image source={{ uri: file.uri }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <Ionicons name="document-outline" size={20} color={theme.primaryButton} />
              )}
              <View style={styles.fileMeta}>
                <Text style={[styles.fileName, { color: theme.primaryText }]} numberOfLines={1}>
                  {file.name}
                </Text>
                {file.size ? (
                  <Text style={[styles.fileSize, { color: theme.secondaryText }]}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { fontSize: 16, fontWeight: '600', flex: 1 },
  count: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  uploadZone: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  uploadContent: { alignItems: 'center', gap: 6 },
  uploadTitle: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  uploadSubtitle: { fontSize: 13, textAlign: 'center' },
  uploadHint: { fontSize: 12, textAlign: 'center', marginTop: 2 },
  fileList: { borderRadius: 10, padding: 8, marginTop: 12, gap: 8 },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
  },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  fileMeta: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '500' },
  fileSize: { fontSize: 12, marginTop: 2 },
});
