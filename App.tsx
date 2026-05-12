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
  | { kind: 'error'; message: string; details?: string };

function App(): React.JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'working' });

  useEffect(() => {
    exportLasso().then(
      ({ path, details }) => setStatus({ kind: 'done', path: `${path}\n\n${details}` }),
      (err: ExportError) =>
        setStatus({
          kind: 'error',
          message: err.message,
          details: err.details,
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
          {status.details && (
            <Text style={styles.path}>{status.details}</Text>
          )}
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

class ExportError extends Error {
  details?: string;
  constructor(message: string, details?: string) {
    super(message);
    this.details = details;
  }
}

async function exportLasso(): Promise<{ path: string; details: string }> {
  const diagnostics: string[] = [];

  let exportDir: string;
  try {
    exportDir = (await FileUtils.getExportPath()) ?? '';
  } catch (e: unknown) {
    throw new ExportError(
      'getExportPath threw',
      e instanceof Error ? e.message : String(e),
    );
  }
  diagnostics.push(`exportDir: ${JSON.stringify(exportDir)}`);

  if (!exportDir) {
    throw new ExportError('exportDir empty', diagnostics.join('\n'));
  }

  let pluginDir: string | null | undefined;
  try {
    pluginDir = await PluginManager.getPluginDirPath();
  } catch (e: unknown) {
    pluginDir = `<threw: ${e instanceof Error ? e.message : String(e)}>`;
  }
  diagnostics.push(`pluginDir: ${JSON.stringify(pluginDir)}`);

  try {
    await FileUtils.makeDir(exportDir);
  } catch (e: unknown) {
    diagnostics.push(
      `makeDir threw: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let baseName = 'note';
  try {
    const raw = await PluginCommAPI.getCurrentFilePath();
    diagnostics.push(`getCurrentFilePath raw: ${JSON.stringify(raw)}`);
    const notePath = unwrap<string>(raw, 'getCurrentFilePath');
    baseName = deriveBaseName(notePath);
  } catch (e: unknown) {
    diagnostics.push(
      `getCurrentFilePath err: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  try {
    const rectRaw = await PluginCommAPI.getLassoRect();
    diagnostics.push(`getLassoRect raw: ${JSON.stringify(rectRaw)}`);
  } catch (e: unknown) {
    diagnostics.push(
      `getLassoRect err: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  try {
    const countsRaw = await PluginCommAPI.getLassoElementTypeCounts();
    diagnostics.push(`getLassoElementTypeCounts raw: ${JSON.stringify(countsRaw)}`);
  } catch (e: unknown) {
    diagnostics.push(
      `getLassoElementTypeCounts err: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const stamp = Date.now();
  const trimmedExport = exportDir.replace(/\/+$/, '');
  const trimmedPlugin = (pluginDir ?? '').replace(/\/+$/, '');
  const outPath = `${trimmedExport}/lasso-${baseName}-${stamp}.png`;
  diagnostics.push(`outPath: ${outPath}`);

  const stickerCandidates = [
    `${trimmedPlugin}/sticker-${stamp}.sticker`,
    `/storage/emulated/0/Note/stickers/sticker-${stamp}.sticker`,
    `${trimmedExport}/sticker-${stamp}.sticker`,
  ];

  let stickerPath: string | null = null;
  for (const candidate of stickerCandidates) {
    if (!candidate) continue;
    const raw = (await PluginCommAPI.saveStickerByLasso(candidate)) as
      | APIResponse<boolean>
      | null
      | undefined;
    diagnostics.push(
      `saveStickerByLasso(${candidate}) → ${JSON.stringify(raw)}`,
    );
    if (raw && raw.success) {
      stickerPath = candidate;
      break;
    }
  }

  if (!stickerPath) {
    throw new ExportError(
      'saveStickerByLasso rejected every candidate path',
      diagnostics.join('\n'),
    );
  }

  let size: { width: number; height: number };
  try {
    const rawSize = await PluginCommAPI.getStickerSize(stickerPath);
    diagnostics.push(`getStickerSize raw: ${JSON.stringify(rawSize)}`);
    size = unwrap<{ width: number; height: number }>(rawSize, 'getStickerSize');
  } catch (e: unknown) {
    throw new ExportError(
      e instanceof Error ? e.message : String(e),
      diagnostics.join('\n'),
    );
  }

  try {
    const rawThumb = await PluginCommAPI.generateStickerThumbnail(
      stickerPath,
      outPath,
      size,
    );
    diagnostics.push(`generateStickerThumbnail raw: ${JSON.stringify(rawThumb)}`);
    unwrap<boolean>(rawThumb, 'generateStickerThumbnail');
  } catch (e: unknown) {
    throw new ExportError(
      e instanceof Error ? e.message : String(e),
      diagnostics.join('\n'),
    );
  }

  try {
    await FileUtils.deleteFile(stickerPath);
  } catch {
    // best-effort cleanup
  }

  return { path: outPath, details: diagnostics.join('\n') };
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
