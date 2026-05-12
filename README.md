# LassoExport

> Vibe-coded with [Claude](https://claude.com/claude-code). No human wrote
> a line of this — review accordingly before relying on it.

A Supernote plugin that adds an **Export PNG** button to the lasso toolbar.
Lasso anything on a NOTE page, tap the button, and a cropped PNG of the
selection lands in the device's **EXPORT** folder.

## How it works

1. The plugin registers a Type-2 (lasso toolbar) button via
   `PluginManager.registerButton`.
2. When tapped, the plugin reads:
   - the lasso rectangle (`PluginCommAPI.getLassoRect`)
   - the current file path and page (`getCurrentFilePath`, `getCurrentPageNum`)
3. It renders the full page to a temporary PNG at 2× via
   `PluginFileAPI.generateNotePng`.
4. A small in-tree native module (`LassoExportCropModule.kt`) crops the PNG
   to the lasso rectangle using `Bitmap.createBitmap` and writes the result
   to `<EXPORT>/lasso-<timestamp>.png`.

The native crop module is necessary because the Supernote plugin SDK has no
image-crop primitive and the official build script (`buildPlugin.sh`) does
not ship third-party native modules from `node_modules`. Project-owned
ReactPackages registered in `MainApplication.kt` are picked up and compiled
into `app.npk`.

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
└── android/                # standard RN Android project
    └── app/src/main/java/com/lassoexport_scaffold/
        ├── MainActivity.kt
        ├── MainApplication.kt          # registers LassoExportCropPackage
        ├── LassoExportCropModule.kt    # the PNG crop native module
        └── LassoExportCropPackage.kt
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

- **Render scale.** `RENDER_SCALE` in `App.tsx` controls the resolution
  of the intermediate full-page render (and therefore the cropped PNG).
  Default is `2`. If the device returns lasso coordinates in
  already-rendered pixels, set it to `1`.
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
