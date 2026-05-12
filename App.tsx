/**
 * LassoExport — exports the current lasso selection as a PNG.
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  FileUtils,
  PluginCommAPI,
  PluginFileAPI,
  PluginManager,
  type Rect,
} from 'sn-plugin-lib';

interface APIResponse<T> {
  success: boolean;
  result: T;
  error?: { code: number; message: string };
}

interface LassoExportCropSpec {
  crop(
    srcPath: string,
    dstPath: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<string>;
}

const LassoExportCrop = NativeModules.LassoExportCrop as LassoExportCropSpec;

type Status =
  | { kind: 'working' }
  | { kind: 'done'; path: string }
  | { kind: 'error'; message: string };

const RENDER_SCALE = 2;

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

async function exportLasso(): Promise<string> {
  if (!LassoExportCrop) {
    throw new Error('native crop module unavailable');
  }

  const rect = unwrap<Rect>(await PluginCommAPI.getLassoRect(), 'getLassoRect');
  const notePath = unwrap<string>(
    await PluginCommAPI.getCurrentFilePath(),
    'getCurrentFilePath',
  );
  const page = unwrap<number>(
    await PluginCommAPI.getCurrentPageNum(),
    'getCurrentPageNum',
  );

  const pluginDir = await PluginManager.getPluginDirPath();
  if (!pluginDir) throw new Error('cannot resolve plugin directory');

  const exportDir = await FileUtils.getExportPath();
  if (!exportDir) throw new Error('cannot resolve EXPORT directory');
  await FileUtils.makeDir(exportDir);

  const stamp = Date.now();
  const fullPagePath = `${pluginDir}/page-${stamp}.png`;
  const croppedPath = `${exportDir}/lasso-${stamp}.png`;

  unwrap<boolean>(
    await PluginFileAPI.generateNotePng({
      notePath,
      page,
      times: RENDER_SCALE,
      pngPath: fullPagePath,
      type: 1,
    }),
    'generateNotePng',
  );

  return LassoExportCrop.crop(
    fullPagePath,
    croppedPath,
    rect.left * RENDER_SCALE,
    rect.top * RENDER_SCALE,
    (rect.right - rect.left) * RENDER_SCALE,
    (rect.bottom - rect.top) * RENDER_SCALE,
  );
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
