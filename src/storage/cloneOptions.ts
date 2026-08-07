import * as vscode from "vscode";

/** Per-user toggles: what a clone capture writes and how the mode behaves. */
export interface CloneOptions {
  /** Build clone.zip (and latest/clone.zip). */
  zip: boolean;
  /** Mirror the whole pack into <out>/latest/. */
  latestMirror: boolean;
  /** Self-contained clone/preview.html. */
  previewHtml: boolean;
  /** Download images/fonts/icons into clone/assets/. */
  assets: boolean;
  /** Full-page screenshot clone/page.png. */
  pageScreenshot: boolean;
  /** Parent-area screenshot clone/parent.png. */
  parentScreenshot: boolean;
  /** computed.json + fonts.json style dumps. */
  computedJson: boolean;
  /** inline-XX.svg files. */
  inlineSvgs: boolean;
  /** Capture the whole page (document root) instead of the clicked element. */
  fullSite: boolean;
  /** Deactivate clone mode automatically after one successful capture. */
  oneShot: boolean;
}

const CONFIG_SECTION = "elementPicker";

/** Option key → settings key (elementPicker.<settingsKey>). */
const SETTING_KEYS: Record<keyof CloneOptions, string> = {
  zip: "cloneZip",
  latestMirror: "cloneLatest",
  previewHtml: "clonePreviewHtml",
  assets: "cloneAssets",
  pageScreenshot: "clonePageScreenshot",
  parentScreenshot: "cloneParentScreenshot",
  computedJson: "cloneComputedJson",
  inlineSvgs: "cloneInlineSvgs",
  fullSite: "cloneFullSite",
  oneShot: "cloneOneShot",
};

const DEFAULTS: CloneOptions = {
  zip: false,
  latestMirror: true,
  previewHtml: true,
  assets: true,
  pageScreenshot: true,
  parentScreenshot: true,
  computedJson: true,
  inlineSvgs: true,
  fullSite: false,
  oneShot: true,
};

export const CLONE_OPTION_KEYS = Object.keys(SETTING_KEYS) as Array<
  keyof CloneOptions
>;

export function isCloneOptionKey(key: string): key is keyof CloneOptions {
  return (CLONE_OPTION_KEYS as string[]).indexOf(key) !== -1;
}

export function getCloneOptions(): CloneOptions {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const out = { ...DEFAULTS };
  for (const key of CLONE_OPTION_KEYS) {
    out[key] = cfg.get<boolean>(SETTING_KEYS[key], DEFAULTS[key]);
  }
  return out;
}

/** Persist one toggle to User settings so it survives restarts and workspaces. */
export async function updateCloneOption(
  key: keyof CloneOptions,
  value: boolean
): Promise<void> {
  await vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .update(SETTING_KEYS[key], !!value, vscode.ConfigurationTarget.Global);
}

/** True when a configuration change touches any clone option. */
export function affectsCloneOptions(
  e: vscode.ConfigurationChangeEvent
): boolean {
  return CLONE_OPTION_KEYS.some((k) =>
    e.affectsConfiguration(`${CONFIG_SECTION}.${SETTING_KEYS[k]}`)
  );
}
