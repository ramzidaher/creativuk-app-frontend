import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { surveyApi } from '../utils/api';

type Props = {
  opportunityId: string;
  customerLabel?: string;
};

type CreatedLink = {
  url: string;
  password: string | null;
};

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** api.post wraps the Nest body, so payload may be at data or data.data. */
function unwrapUploadLinkPayload(response: {
  success: boolean;
  data?: any;
  error?: string;
}): CreatedLink {
  // Backend may return { success:false, error } which api.post still wraps as success:true
  const outer = response.data;
  if (outer && typeof outer === 'object' && outer.success === false) {
    throw new Error(outer.error || response.error || 'Could not create upload link');
  }
  if (!response.success && !outer) {
    throw new Error(response.error || 'Could not create upload link');
  }
  if (!outer) {
    throw new Error(response.error || 'Could not create upload link');
  }

  const payload = outer?.data ?? outer;
  const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
  const password =
    typeof payload?.password === 'string' && payload.password.trim()
      ? payload.password.trim()
      : null;

  if (!url) {
    throw new Error(
      response.error ||
        outer?.error ||
        'Upload link was created but no URL came back. Check FRONTEND_URL on the API.',
    );
  }

  return { url, password };
}

function buildCopyBlock(link: CreatedLink): string {
  if (link.password) {
    return `Photo upload link:\n${link.url}\n\nPassword:\n${link.password}\n\n(Link valid 14 days — send both to the customer.)`;
  }
  return `Photo upload link:\n${link.url}\n\n(Link valid 14 days.)`;
}

export default function CustomerPhotoUploadLinkButton({ opportunityId, customerLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const showCopied = (label: string) => {
    setCopyHint(label);
    setTimeout(() => setCopyHint((current) => (current === label ? null : current)), 2500);
  };

  const createAndCopyLink = async () => {
    try {
      setLoading(true);
      setCopyHint(null);
      setError(null);
      const response = await surveyApi.createCustomerUploadLink(opportunityId, {
        customerLabel: customerLabel?.trim() || undefined,
      });
      const link = unwrapUploadLinkPayload(response);
      setCreated(link);

      const copyBlock = buildCopyBlock(link);
      const copied = await copyTextToClipboard(copyBlock);
      if (copied) {
        showCopied(
          link.password
            ? 'Link & password copied — paste and send both to the customer.'
            : 'Link copied (no password returned by API yet).',
        );
      }
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Please try again.';
      if (/authentication required/i.test(message)) {
        message =
          'You are not logged in (or your session expired). Log in again, then click Copy photo link & password.';
      }
      setError(message);
      setCreated(null);
    } finally {
      setLoading(false);
    }
  };

  const copyField = async (value: string, label: string) => {
    const copied = await copyTextToClipboard(value);
    if (copied) {
      showCopied(`${label} copied`);
      return;
    }
    setError(`Could not copy ${label.toLowerCase()}. Select the text and copy manually.`);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.button} onPress={createAndCopyLink} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="copy" size={16} color="#fff" />
            <Text style={styles.buttonText}>Copy photo link & password</Text>
          </>
        )}
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Could not create link</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {copyHint ? <Text style={styles.hint}>{copyHint}</Text> : null}

      {created ? (
        <View style={styles.resultPanel}>
          <Text style={styles.resultTitle}>Send to the customer</Text>

          <Text style={styles.fieldLabel}>Link</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.fieldValue}
              value={created.url}
              editable={false}
              selectTextOnFocus
              multiline
            />
            <TouchableOpacity
              style={styles.smallCopy}
              onPress={() => copyField(created.url, 'Link')}
              accessibilityLabel="Copy link"
            >
              <Feather name="link" size={16} color="#166534" />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Password</Text>
          {created.password ? (
            <View style={styles.row}>
              <TextInput
                style={[styles.fieldValue, styles.passwordValue]}
                value={created.password}
                editable={false}
                selectTextOnFocus
              />
              <TouchableOpacity
                style={styles.smallCopy}
                onPress={() => copyField(created.password!, 'Password')}
                accessibilityLabel="Copy password"
              >
                <Feather name="key" size={16} color="#166534" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.missingPassword}>
              No password returned. Password protection is in your local backend changes but not on
              the API this app is calling yet — deploy the backend (or point EXPO_PUBLIC_API_BASE_URL
              at local) and create a new link.
            </Text>
          )}

          <TouchableOpacity
            style={styles.copyBoth}
            onPress={() => copyField(buildCopyBlock(created), created.password ? 'Link & password' : 'Link')}
          >
            <Feather name="clipboard" size={14} color="#166534" />
            <Text style={styles.copyBothText}>
              {created.password ? 'Copy link + password again' : 'Copy link again'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#166534',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  hint: {
    marginTop: 8,
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },
  errorPanel: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#7f1d1d',
    lineHeight: 18,
  },
  resultPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    gap: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14532d',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    color: '#14532d',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  passwordValue: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontWeight: '700',
    letterSpacing: 1,
  },
  missingPassword: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
  },
  smallCopy: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#fff',
  },
  copyBoth: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  copyBothText: { color: '#166534', fontWeight: '600', fontSize: 13 },
});
