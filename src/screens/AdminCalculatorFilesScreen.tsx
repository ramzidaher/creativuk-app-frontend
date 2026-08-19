import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  adminCalculatorFilesApi,
  CalculatorFolderFile,
  CalculatorFolderInfo,
  CalculatorFolderKey,
} from '../utils/api';

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getDisplayFileName(file: CalculatorFolderFile): string {
  const primary = String((file as any)?.fileName || '').trim();
  if (primary) return primary;
  const legacy = String((file as any)?.name || '').trim();
  if (legacy) return legacy;
  return '(missing file name)';
}

export default function AdminCalculatorFilesScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [folders, setFolders] = useState<CalculatorFolderInfo[]>([]);
  const [folder, setFolder] = useState<CalculatorFolderKey>('epvs-opportunities');
  const [files, setFiles] = useState<CalculatorFolderFile[]>([]);
  const [folderLabel, setFolderLabel] = useState('EPVS opportunities');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const loadFolders = useCallback(async () => {
    const response = await adminCalculatorFilesApi.listFolders();
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Could not load folders');
    }
    setFolders(response.data);
  }, []);

  const loadFiles = useCallback(async (selected: CalculatorFolderKey) => {
    const response = await adminCalculatorFilesApi.listFiles(selected);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Could not load files');
    }
    setFiles(response.data.files || []);
    setFolderLabel(response.data.label || selected);
  }, []);

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setLoading(true);
        setError(null);
        await loadFolders();
        await loadFiles(folder);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calculator files');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [folder, loadFiles, loadFolders],
  );

  useEffect(() => {
    if (isAdmin) {
      reload();
    }
  }, [isAdmin, reload]);

  const filteredFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => getDisplayFileName(f).toLowerCase().includes(q));
  }, [files, filter]);

  const handleSelectFolder = async (key: CalculatorFolderKey) => {
    setFolder(key);
    setLoading(true);
    setError(null);
    try {
      await loadFiles(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: CalculatorFolderFile) => {
    const fileName = getDisplayFileName(file);
    try {
      setBusyFile(fileName);
      setStatus(null);
      await adminCalculatorFilesApi.download(folder, fileName);
      setLastFileName(fileName);
      setStatus(`Downloaded ${fileName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setError(message);
      Alert.alert('Download failed', message);
    } finally {
      setBusyFile(null);
    }
  };

  const handleUploadPress = () => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Web only for now',
        'Upload a calculator file from the browser admin tools screen.',
      );
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadSelectedFile = async (picked: File) => {
    const sizeMb = picked.size / 1048576;
    try {
      setUploading(true);
      setError(null);
      setStatus(`Uploading ${picked.name} (${sizeMb.toFixed(1)}MB)…`);
      setLastFileName(picked.name);
      const response = await adminCalculatorFilesApi.upload(folder, {
        name: picked.name,
        type: picked.type,
        file: picked,
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Upload failed');
      }
      const result = response.data;
      const uploadedName = result.fileName || picked.name;
      setLastFileName(uploadedName);
      setStatus(
        result.overwritten
          ? `Replaced ${uploadedName} (${formatBytes(result.size || picked.size)})`
          : `Uploaded ${uploadedName} (${formatBytes(result.size || picked.size)})`,
      );
      await loadFiles(folder);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (file: CalculatorFolderFile) => {
    const fileName = getDisplayFileName(file);
    const run = async () => {
      try {
        setBusyFile(fileName);
        const response = await adminCalculatorFilesApi.deleteFile(folder, fileName);
        if (!response.success) {
          throw new Error(response.error || 'Delete failed');
        }
        setStatus(`Deleted ${fileName}`);
        setLastFileName(fileName);
        await loadFiles(folder);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed';
        setError(message);
        Alert.alert('Delete failed', message);
      } finally {
        setBusyFile(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${fileName} from ${folderLabel}?`)) {
        run();
      }
      return;
    }

    Alert.alert('Delete file?', `Remove ${fileName} from the server folder?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.denied}>
          <Text style={{ color: theme.primaryText }}>Admin access required.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={{ color: theme.primaryButton }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={theme.secondaryText} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Calculator files</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Browse server EPVS folders
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: theme.primaryButton, opacity: uploading ? 0.7 : 1 }]}
          onPress={handleUploadPress}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="upload" size={16} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {Platform.OS === 'web' ? (
        // @ts-expect-error web-only input
        <input
          ref={fileInputRef as any}
          type="file"
          accept=".xlsm,.xlsx,.xls,.pdf,application/vnd.ms-excel.sheet.macroEnabled.12"
          style={{ display: 'none' }}
          onChange={(e: any) => {
            const picked = e.target?.files?.[0] as File | undefined;
            e.target.value = '';
            if (picked) uploadSelectedFile(picked);
          }}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              reload({ silent: true });
            }}
            tintColor={theme.primaryButton}
          />
        }
      >
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Server folder</Text>
          <Text style={[styles.cardDescription, { color: theme.secondaryText }]}>
            Download any calculator file, or upload a normal `.xlsm` / `.xlsx` — same filename overwrites.
          </Text>
          <View style={styles.folderRow}>
            {(folders.length
              ? folders
              : [
                  {
                    key: 'epvs-opportunities' as CalculatorFolderKey,
                    label: 'EPVS / v4.4 calculators',
                    description: '',
                    relativePath: '',
                    absolutePath: '',
                  },
                ]
            ).map((item) => {
              const selected = item.key === folder;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.folderChip,
                    {
                      backgroundColor: selected ? theme.primaryButton : isDark ? '#1e293b' : '#f8fafc',
                      borderColor: selected ? theme.primaryButton : theme.cardBorder,
                    },
                  ]}
                  onPress={() => handleSelectFolder(item.key)}
                >
                  <Text
                    style={{
                      color: selected ? '#fff' : theme.primaryText,
                      fontWeight: '600',
                      fontSize: 13,
                    }}
                  >
                    {item.label}
                    {typeof item.fileCount === 'number' ? ` (${item.fileCount})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.cardBorder,
              color: theme.primaryText,
            },
          ]}
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter by file name…"
          placeholderTextColor={theme.tertiaryText}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {status ? (
          <Text style={[styles.status, { color: '#166534' }]}>{status}</Text>
        ) : null}
        {lastFileName ? (
          <View style={[styles.fileNameBanner, { borderColor: theme.cardBorder }]}>
            <Text style={[styles.fileNameBannerLabel, { color: theme.secondaryText }]}>
              File name
            </Text>
            <Text style={[styles.fileNameBannerValue, { color: theme.primaryText }]} selectable>
              {lastFileName}
            </Text>
          </View>
        ) : null}
        {error ? (
          <Text style={[styles.status, { color: '#991b1b' }]}>{error}</Text>
        ) : null}

        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
            {folderLabel} ({filteredFiles.length})
          </Text>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.primaryButton} />
              <Text style={{ color: theme.secondaryText, marginTop: 8 }}>Loading files…</Text>
            </View>
          ) : filteredFiles.length === 0 ? (
            <Text style={{ color: theme.secondaryText, marginTop: 8 }}>
              No calculator files in this folder yet. Upload one to get started.
            </Text>
          ) : (
            filteredFiles.map((file) => {
              const displayName = getDisplayFileName(file);
              const busy = busyFile === displayName;
              return (
                <View
                  key={`${displayName}-${file.modifiedAt}`}
                  style={[styles.fileRow, { borderBottomColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.fileNameLabel, { color: theme.secondaryText }]}>
                      File name
                    </Text>
                    <Text style={[styles.fileName, { color: theme.primaryText }]} selectable>
                      {displayName}
                    </Text>
                    <Text style={[styles.fileMeta, { color: theme.secondaryText }]}>
                      {formatBytes(file.size)} · {formatDate(file.modifiedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.iconButton, { borderColor: theme.cardBorder }]}
                    onPress={() => handleDownload(file)}
                    disabled={busy || uploading}
                    accessibilityLabel={`Download ${displayName}`}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={theme.primaryButton} />
                    ) : (
                      <Feather name="download" size={18} color={theme.primaryButton} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconButton, { borderColor: '#fecaca' }]}
                    onPress={() => handleDelete(file)}
                    disabled={busy || uploading}
                    accessibilityLabel={`Delete ${displayName}`}
                  >
                    <Feather name="trash-2" size={18} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backLink: { marginTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  uploadButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  cardDescription: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  folderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  folderChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  status: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  fileNameBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  fileNameBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileNameBannerValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  centered: { alignItems: 'center', paddingVertical: 24 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  fileNameLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileMeta: { fontSize: 12, marginTop: 4 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
