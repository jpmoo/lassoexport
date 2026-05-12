# LassoExport

> Vibe-coded with [Claude](https://claude.com/claude-code). No human wrote
> a line of this — review accordingly before relying on it.

A Supernote plugin that adds an **Export PNG** button to the lasso toolbar.
Lasso anything on a NOTE page, tap the button, and a cropped PNG of the
selection lands in the device's **EXPORT** folder.

## How it works

1. The plugin registers a Type-2 (lasso toolbar) button via
   `PluginManager.registerButton`.
2. When tapped, the plugin saves the lasso selection as a Supernote
   sticker (`PluginCommAPI.saveStickerByLasso`) — stickers contain only
   the selected ink, no template background.
3. It reads the sticker's natural size (`getStickerSize`) and uses
   `generateStickerThumbnail` at that size to re-encode it as a clean
   PNG at `<EXPORT>/lasso-<note name>-<timestamp>.png`.
4. The intermediate sticker file is deleted.

Because everything is done through the official SDK, the plugin is pure
JS — no native modules.

## Project layout

```
.
├── App.tsx                 # plugin UI + export logic
├── index.js                # registers the lasso toolbar button
├── app.json                # RN AppRegistry name (must equal pluginKey)
├── PluginConfig.json       # plugin manifest (name, desc, icon, id)
├── package.json
├── tsconfig.json / babel.config.js / metro.config.js
├── buildPlugin.sh          # Supernote-supplied packager → .snplg
├── buildPlugin.ps1         # Windows variant
├── assets/icon.png         # plugin icon shown in the lasso toolbar
└── android/                # standard RN Android project (unmodified template)
```

## Build

### Prerequisites

- Node.js 18+
- JDK 17 (e.g. `brew install openjdk@17`)
- Android command-line tools with `platforms;android-35`,
  `build-tools;35.0.0`, `ndk;27.1.12297006`
  (e.g. `brew install --cask android-commandlinetools` then
  `sdkmanager "platforms;android-35" "build-tools;35.0.0" "ndk;27.1.12297006"`)

### Build the plugin

```bash
export JAVA_HOME=$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$(brew --prefix android-commandlinetools)/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$PATH"

npm install
./buildPlugin.sh
```

Output: `build/outputs/lassoexport.snplg` (~6.7 MB).

## Install on device

1. Connect the Supernote in USB transfer mode.
2. Copy `lassoexport.snplg` to the `MyStyle` folder.
3. On the device: **Settings → Apps → Plugins → Add Plugin →
   `lassoexport.snplg`**.

## Use

1. Open any NOTE.
2. Lasso the region you want to export.
3. Tap **Export PNG** in the lasso toolbar.
4. The cropped PNG appears in the **EXPORT** folder of the Supernote
   file tree, named `lasso-<timestamp>.png`. The plugin view shows the
   full output path, then closes.

## Configuration knobs

- **Apps.** `index.js` registers the button for `['NOTE']` only. Add
  `'DOC'` to also surface it during document text lassos.
- **Editable element types.** `editDataTypes: [0, 1, 2, 3, 4, 5]` in
  `index.js` makes the button visible for any selection (strokes,
  titles, images, text, links, geometry). Narrow the array to restrict.

## Compatibility

Built against:

- React Native 0.79.2
- `sn-plugin-lib` 0.1.x
- Supernote firmware exposing the official Plugin SDK

Tested on the build host only; please verify on-device behavior before
relying on the export path or rect-coordinate assumptions.

## License

MIT.
