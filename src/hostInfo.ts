import * as vscode from "vscode";

/** Runtime host fingerprint for diagnostics and UI version badge. */
export type HostInfo = {
  version: string;
  /** ui | workspace */
  extensionKind: "ui" | "workspace";
  platform: string;
  remoteName: string;
  /** Short one-liner: v0.1.24 · ui · win32 */
  badge: string;
  /** Longer: DaVinchi v0.1.24 · host ui · win32 · local */
  detail: string;
};

let cached: HostInfo | null = null;

/**
 * Build host/version info once per activate (version from package.json).
 */
export function initHostInfo(context: vscode.ExtensionContext): HostInfo {
  const version = String(
    (context.extension.packageJSON as { version?: string })?.version || "?"
  );
  const extensionKind: "ui" | "workspace" =
    context.extension.extensionKind === vscode.ExtensionKind.UI
      ? "ui"
      : "workspace";
  const platform = process.platform;
  const remoteName = vscode.env.remoteName || "";
  const badge = `v${version} · ${extensionKind} · ${platform}`;
  const detail = [
    `DaVinchi v${version}`,
    `host ${extensionKind}`,
    platform,
    remoteName ? `remote ${remoteName}` : "local",
  ].join(" · ");
  cached = { version, extensionKind, platform, remoteName, badge, detail };
  return cached;
}

export function getHostInfo(): HostInfo {
  if (cached) {
    return cached;
  }
  // Fallback before/without activate — read live extension package
  const ext = vscode.extensions.getExtension("coin-rebalancer.element-picker");
  const version = String(
    (ext?.packageJSON as { version?: string } | undefined)?.version || "?"
  );
  const extensionKind: "ui" | "workspace" =
    ext?.extensionKind === vscode.ExtensionKind.UI ? "ui" : "workspace";
  const platform = process.platform;
  const remoteName = vscode.env.remoteName || "";
  const badge = `v${version} · ${extensionKind} · ${platform}`;
  const detail = [
    `DaVinchi v${version}`,
    `host ${extensionKind}`,
    platform,
    remoteName ? `remote ${remoteName}` : "local",
  ].join(" · ");
  return { version, extensionKind, platform, remoteName, badge, detail };
}
