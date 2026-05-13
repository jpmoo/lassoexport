/**
 * LassoExport — exports the current lasso selection as a PNG.
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FileUtils, PluginCommAPI, PluginManager } from 'sn-plugin-lib';

interface APIResponse<T> {
  success: boolean;
  result: T;
  error?: { code: number; message: string };
}

type Status =
  | { kind: 'working' }
  | { kind: 'done'; path: string }
  | { kind: 'error'; message: string };

function App(): React.JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'working' });

  useEffect(() => {
    exportLasso().then(
      (path) => setStatus({ kind: 'done', path }),
      (err: unknown) =>
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        }),
    );
  }, []);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.closeButton}
        onPress={() => PluginManager.closePluginView()}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      {status.kind === 'working' && (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.message}>Exporting selection…</Text>
        </>
      )}

      {status.kind === 'done' && (
        <>
          <Text style={styles.title}>Exported</Text>
          <Text style={styles.path}>{status.path}</Text>
        </>
      )}

      {status.kind === 'error' && (
        <>
          <Text style={styles.title}>Export failed</Text>
          <Text style={styles.path}>{status.message}</Text>
        </>
      )}
    </View>
  );
}

function unwrap<T>(value: unknown, what: string): T {
  const res = value as APIResponse<T> | null | undefined;
  if (!res || !res.success) {
    throw new Error(res?.error?.message ?? `${what} failed`);
  }
  return res.result;
}

function deriveBaseName(notePath: string): string {
  const last = notePath.split('/').pop() ?? 'note';
  const noExt = last.replace(/\.[^.]+$/, '');
  const safe = noExt.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'note';
}

async function exportLasso(): Promise<string> {
  const exportDir = await FileUtils.getExportPath();
  if (!exportDir) throw new Error('cannot resolve EXPORT directory');
  await FileUtils.makeDir(exportDir);

  const pluginDir = await PluginManager.getPluginDirPath();
  if (!pluginDir) throw new Error('cannot resolve plugin directory');

  // Defensive cleanup: an earlier invocation might have left stale sticker
  // handles around. Drop the element cache, sweep any prior sticker files in
  // our private dir, then proceed.
  try {
    PluginCommAPI.clearElementCache();
  } catch {
    // method may be missing in older SDKs
  }
  try {
    const existing = await FileUtils.listFiles(pluginDir);
    if (existing) {
      for (const entry of existing) {
        if (entry.endsWith('.sticker')) {
          await FileUtils.deleteFile(`${pluginDir.replace(/\/+$/, '')}/${entry}`);
        }
      }
    }
  } catch {
    // listFiles may surface odd paths; not worth failing the export over.
  }

  let baseName = 'note';
  try {
    const notePath = unwrap<string>(
      await PluginCommAPI.getCurrentFilePath(),
      'getCurrentFilePath',
    );
    baseName = deriveBaseName(notePath);
  } catch {
    // Filename is a nice-to-have; fall back to "note" if the SDK refuses.
  }

  const stamp = Date.now();
  const trimmedExport = exportDir.replace(/\/+$/, '');
  const trimmedPlugin = pluginDir.replace(/\/+$/, '');
  const stickerPath = `${trimmedPlugin}/sticker-${stamp}.sticker`;
  const outPath = `${trimmedExport}/lasso-${baseName}-${stamp}.png`;

  unwrap<boolean>(
    await PluginCommAPI.saveStickerByLasso(stickerPath),
    'saveStickerByLasso',
  );
  if (!(await FileUtils.exists(stickerPath))) {
    throw new Error(
      'saveStickerByLasso reported success but the sticker file was not written',
    );
  }

  const size = unwrap<{ width: number; height: number }>(
    await PluginCommAPI.getStickerSize(stickerPath),
    'getStickerSize',
  );
  if (!size || !size.width || !size.height) {
    throw new Error(`getStickerSize returned ${JSON.stringify(size)}`);
  }

  unwrap<boolean>(
    await PluginCommAPI.generateStickerThumbnail(stickerPath, outPath, size),
    'generateStickerThumbnail',
  );
  if (!(await FileUtils.exists(outPath))) {
    throw new Error(
      'generateStickerThumbnail reported success but the PNG was not written',
    );
  }

  try {
    await FileUtils.deleteFile(stickerPath);
  } catch {
    // best-effort cleanup
  }

  return outPath;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: { fontSize: 20, fontWeight: '600', color: '#000' },
  message: { marginTop: 16, fontSize: 16, color: '#000' },
  title: { fontSize: 22, fontWeight: '600', color: '#000', marginBottom: 8 },
  path: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});

export default App;
