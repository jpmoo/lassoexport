/**
 * @format
 */

import { AppRegistry, Image, ToastAndroid } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import {
  FileUtils,
  NativeUIUtils,
  PluginCommAPI,
  PluginManager,
} from 'sn-plugin-lib';

const BUTTON_ID = 1;

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

PluginManager.registerButton(2, ['NOTE'], {
  id: BUTTON_ID,
  name: 'Export PNG',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  editDataTypes: [0, 1, 2, 3, 4, 5],
  showType: 0,
});

PluginManager.registerButtonListener({
  onButtonPress: (event) => {
    if (!event || event.id !== BUTTON_ID) return;
    exportLasso()
      .then((outPath) => {
        const fileName = outPath.split('/').pop() || outPath;
        try {
          ToastAndroid.show(`Exported ${fileName}`, ToastAndroid.LONG);
        } catch {
          // ignore — sticker was still written
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        try {
          NativeUIUtils.showRattaDialog(
            `Export failed: ${message}`,
            '',
            'OK',
            false,
          );
        } catch {
          // last-resort: nothing else we can do
        }
      });
  },
});

function unwrap(value, what) {
  if (!value || !value.success) {
    const msg = (value && value.error && value.error.message) || `${what} failed`;
    throw new Error(msg);
  }
  return value.result;
}

function deriveBaseName(notePath) {
  const last = notePath.split('/').pop() || 'note';
  const noExt = last.replace(/\.[^.]+$/, '');
  const safe = noExt.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'note';
}

async function exportLasso() {
  const exportDir = await FileUtils.getExportPath();
  if (!exportDir) throw new Error('cannot resolve EXPORT directory');
  await FileUtils.makeDir(exportDir);

  const pluginDir = await PluginManager.getPluginDirPath();
  if (!pluginDir) throw new Error('cannot resolve plugin directory');

  try { PluginCommAPI.clearElementCache(); } catch {}
  try {
    const existing = await FileUtils.listFiles(pluginDir);
    if (existing) {
      const root = pluginDir.replace(/\/+$/, '');
      for (const entry of existing) {
        if (entry.endsWith('.sticker')) {
          await FileUtils.deleteFile(`${root}/${entry}`);
        }
      }
    }
  } catch {}

  let baseName = 'note';
  try {
    const notePath = unwrap(await PluginCommAPI.getCurrentFilePath(), 'getCurrentFilePath');
    baseName = deriveBaseName(notePath);
  } catch {}

  const stamp = Date.now();
  const trimmedExport = exportDir.replace(/\/+$/, '');
  const trimmedPlugin = pluginDir.replace(/\/+$/, '');
  const stickerPath = `${trimmedPlugin}/sticker-${stamp}.sticker`;
  const outPath = `${trimmedExport}/lasso-${baseName}-${stamp}.png`;

  unwrap(await PluginCommAPI.saveStickerByLasso(stickerPath), 'saveStickerByLasso');
  if (!(await FileUtils.exists(stickerPath))) {
    throw new Error('sticker file was not written');
  }

  const size = unwrap(await PluginCommAPI.getStickerSize(stickerPath), 'getStickerSize');
  if (!size || !size.width || !size.height) {
    throw new Error(`getStickerSize returned ${JSON.stringify(size)}`);
  }

  unwrap(
    await PluginCommAPI.generateStickerThumbnail(stickerPath, outPath, size),
    'generateStickerThumbnail',
  );
  if (!(await FileUtils.exists(outPath))) {
    throw new Error('PNG was not written');
  }

  try { await FileUtils.deleteFile(stickerPath); } catch {}

  return outPath;
}
