# Codex Rename Thread (Helper)

Small VSCode extension that lets you rename a Codex thread through a dedicated command:
- Command: `Codex: Rename Thread (QuickPick)`
- Shortcut: `Ctrl+Shift+Alt+R`

It first tries native rename commands. If the current Codex version no longer exposes them, it can apply a runtime patch to `openai.chatgpt` and then ask for a window reload.

## Prerequisites

- VSCode running in **WSL Remote** (your current setup).
- Codex extension installed (`openai.chatgpt`).
- This extension source available at:
  - `/home/sebastien/src/vscode-extensions/codex-rename-thread`

## Installation (WSL / Remote)

1. Open the Command Palette.
2. Run `Developer: Install Extension from Location...`
3. Select this folder:
   - `/home/sebastien/src/vscode-extensions/codex-rename-thread`
4. Run `Developer: Reload Window`
5. Check that the command is available:
   - `Codex: Rename Thread (QuickPick)`

## Reinstall / Update

Whenever `extension.js` or `package.json` changes:

1. Run `Developer: Install Extension from Location...` again with the same folder.
2. Run `Developer: Reload Window`.
3. Test `Codex: Rename Thread (QuickPick)` again.

## First Use After a Codex Update

1. Run `Codex: Rename Thread (QuickPick)`.
2. If a message says a runtime patch was applied, click `Reload Window`.
3. Run the rename command again.

## Quick Validation

- The command opens a thread QuickPick (when no active thread is detected).
- After confirming the new title, the thread title updates in the Codex sidebar.

## Troubleshooting

- If the command does not appear:
  - make sure the extension is installed on the **WSL side** (not only on local Windows VSCode).
  - run `Install Extension from Location` + `Reload Window` again.

- If rename fails after a Codex update:
  - run the command once to let auto-patch run,
  - accept `Reload Window`,
  - run the command again.
