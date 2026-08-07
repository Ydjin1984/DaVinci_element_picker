import * as vscode from "vscode";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { t } from "../i18n";

/**
 * One-click cure for the editor-level webview failure
 * "Could not register service worker: InvalidStateError".
 *
 * The corrupted state lives in <userData>/Service Worker — shared by every
 * webview of the editor — and can only be cleared while the editor is fully
 * closed. Strategy: arm a detached PowerShell watcher that waits until every
 * process of this editor executable exits, deletes the Service Worker cache
 * and relaunches the editor.
 */
export async function fixWebviewCache(
  context: vscode.ExtensionContext
): Promise<void> {
  // globalStorageUri = <userData>/User/globalStorage/<publisher.ext>
  const userDataDir = path.dirname(
    path.dirname(path.dirname(context.globalStorageUri.fsPath))
  );
  const swDir = path.join(userDataDir, "Service Worker");

  const isRemoteHost =
    !!vscode.env.remoteName &&
    context.extension.extensionKind === vscode.ExtensionKind.Workspace;
  if (process.platform !== "win32" || isRemoteHost) {
    void vscode.window.showWarningMessage(t("fixWebviewUnsupported", swDir));
    return;
  }

  const exe = process.execPath;
  const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$exe = ${q(exe)}`,
    `$sw = ${q(swDir)}`,
    "$deadline = (Get-Date).AddMinutes(15)",
    "while ((Get-Date) -lt $deadline) {",
    "  if (-not (Get-Process | Where-Object { $_.Path -eq $exe })) { break }",
    "  Start-Sleep -Seconds 2",
    "}",
    "if (Get-Process | Where-Object { $_.Path -eq $exe }) { exit 1 }",
    "Start-Sleep -Seconds 2",
    "Remove-Item -LiteralPath $sw -Recurse -Force",
    "Start-Process -FilePath $exe",
  ].join("\r\n");

  const ps1 = path.join(os.tmpdir(), "davinchi-fix-webview.ps1");
  fs.writeFileSync(ps1, script, "utf8");
  spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-File",
      ps1,
    ],
    { detached: true, stdio: "ignore", windowsHide: true }
  ).unref();

  const closeNow = t("fixWebviewCloseNow");
  const choice = await vscode.window.showInformationMessage(
    t("fixWebviewArmed", vscode.env.appName),
    { modal: true },
    closeNow
  );
  if (choice === closeNow) {
    await vscode.commands.executeCommand("workbench.action.quit");
  }
}
