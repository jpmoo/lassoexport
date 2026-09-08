/**
 * What the host makes a plugin ask for, since sn-plugin-lib 0.1.65.
 *
 * Firmware that enforces the permission gate refuses plugins built against the
 * SDK before it — which is why every plugin built on 0.1.43 stopped installing
 * at the same moment, with a message about needing an update. That reads like
 * one broken plugin and is not one.
 *
 * **Declared before requested.** Every name here also appears in
 * `uses-permissions` in `PluginConfig.json`; asking for one that is not
 * declared fails with code 1500 *before any dialog is shown*, which looks
 * exactly like a refusal from somebody who was never asked.
 *
 * Two names, not four. A plugin's own private directory is exempt from every
 * permission by default, so the temporary files this writes there need nothing.
 * `FILE:READ` is for reading the note, `FILE:WRITE` for landing the result in
 * EXPORT, which is shared storage and is not exempt.
 *
 * Reference: https://github.com/Supernote-Ratta/docs-plugin
 * (`en/plugin-base/permission.mdx`)
 *
 * @format
 */

import { PluginManager } from 'sn-plugin-lib';

export const READ = 'plugin.permission.FILE:READ';
export const WRITE = 'plugin.permission.FILE:WRITE';

/**
 * Hold it, or ask once.
 *
 * Three outcomes, not two: granted, refused, and *could not ask*. The SDK
 * rejects `requestPermission` when the host is not ready or the name is not
 * declared, and reporting that as a refusal sends somebody into settings
 * hunting for a switch they never touched.
 *
 * `requestPermission` answers 0 (don't allow), 1 (this time), 2 (always) or -1
 * (dialog dismissed), so anything above zero is a yes. The "this time" grant
 * lasts only while the plugin is open, so being asked again on a later run is
 * ordinary rather than a sign that something was revoked.
 */
async function ensure(permission) {
  let have = null;
  try {
    have = (await PluginManager.hasPermission(permission)) === 1;
  } catch {
    have = null;
  }
  if (have === true) return null;

  // An SDK or firmware with no gate at all: nothing to hold and nothing to ask.
  // Refusing to work because the API is absent would be this plugin breaking
  // itself on old firmware in order to be careful about new.
  if (have === null && typeof PluginManager.requestPermission !== 'function') {
    return null;
  }

  const short = permission.split('.').pop();
  try {
    const answer = await PluginManager.requestPermission(permission);
    if (answer > 0) return null;
    return `${short} permission was refused, so this cannot run. Grant it in the plugin's permissions and try again.`;
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return `could not ask for ${short} permission: ${why}`;
  }
}

/** All of them, in order. Returns the first complaint, or null when clear. */
export async function ensureAll(...permissions) {
  for (const p of permissions) {
    const trouble = await ensure(p);
    if (trouble) return trouble;
  }
  return null;
}
