const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const LEGACY_RENAME_COMMAND = "chatgpt.renameThread";
const KNOWN_RENAME_CANDIDATES = [
  LEGACY_RENAME_COMMAND,
  "workbench.action.chat.renameSession",
  "workbench.action.chatSession.rename",
  "chat.renameSession",
];

function extractConversationIdFromUri(uri) {
  if (!uri || uri.scheme !== "openai-codex") {
    return null;
  }

  // Expected shape: openai-codex://route/local/<conversationId>
  const segments = uri.path.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const [scope, conversationId] = segments;
  if ((scope !== "local" && scope !== "remote") || !conversationId) {
    return null;
  }

  return conversationId;
}

function getActiveConversationId() {
  const fromActiveEditor = extractConversationIdFromUri(vscode.window.activeTextEditor?.document?.uri);
  if (fromActiveEditor) {
    return fromActiveEditor;
  }

  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (activeTab?.input instanceof vscode.TabInputCustom) {
    return extractConversationIdFromUri(activeTab.input.uri);
  }

  return null;
}

function isRenameCandidateCommand(commandId) {
  const lower = commandId.toLowerCase();
  const includesRename = lower.includes("rename") || lower.includes("title");
  const isChatRelated =
    lower.includes("chat") ||
    lower.includes("codex") ||
    lower.includes("thread") ||
    lower.includes("session");

  return includesRename && isChatRelated;
}

async function executeRenameCommand(commandId, conversationId) {
  if (commandId === LEGACY_RENAME_COMMAND && conversationId) {
    await vscode.commands.executeCommand(commandId, { conversationId });
    return;
  }

  await vscode.commands.executeCommand(commandId);
}

async function findAndExecuteRenameCommand(conversationId) {
  const allCommands = await vscode.commands.getCommands(true);
  const available = new Set(allCommands);
  const dynamicCandidates = allCommands.filter(isRenameCandidateCommand).sort((a, b) => a.localeCompare(b));
  const candidates = Array.from(new Set([...KNOWN_RENAME_CANDIDATES, ...dynamicCandidates])).filter((commandId) =>
    available.has(commandId)
  );

  let lastError = null;
  for (const commandId of candidates) {
    try {
      await executeRenameCommand(commandId, conversationId);
      return { success: true, commandId, attempted: candidates };
    } catch (error) {
      lastError = error;
    }
  }

  return { success: false, attempted: candidates, error: lastError };
}

function getCodexExtension() {
  return vscode.extensions.getExtension("openai.chatgpt") ?? null;
}

function buildRenamePatchSnippet(globalStateVar, constantsVar, webviewProviderVar, chatSessionProviderVar) {
  return `e.push(lt.commands.registerCommand("chatgpt.renameThread",async we=>{let opts=we&&typeof we==="object"?we:{},directConversationId=typeof opts.conversationId==="string"&&opts.conversationId.trim().length>0?opts.conversationId.trim():null,skipQuickPick=!!opts.skipQuickPick,coerceTitles=raw=>{if(raw&&typeof raw==="object")return{titles:raw.titles&&typeof raw.titles==="object"?raw.titles:{},order:Array.isArray(raw.order)?raw.order:[]};return{titles:{},order:[]}},readThreadTitles=async()=>{try{return coerceTitles(await ${globalStateVar}.get(${constantsVar}.THREAD_TITLES))}catch{return{titles:{},order:[]}}},persistAndBroadcast=async(conversationId,title)=>{let cid=typeof conversationId==="string"?conversationId.trim():"",newTitle=typeof title==="string"?title.trim():"";if(!cid)return;if(!newTitle){lt.window.showWarningMessage("Title cannot be empty.");return}try{let cur=await readThreadTitles(),nextTitles={...cur.titles,[cid]:newTitle},nextOrder=(cur.order||[]).filter(x=>x!==cid);nextOrder.unshift(cid),await ${globalStateVar}.update(${constantsVar}.THREAD_TITLES,{titles:nextTitles,order:nextOrder})}catch(err){J().warning("Failed to persist thread title from command",{safe:{conversationId:cid,error:err instanceof Error?err.message:String(err)},sensitive:{}})}try{await Lo()}catch{}try{${webviewProviderVar}.broadcastToAllViews({type:"thread-title-updated",hostId:"local",conversationId:cid,title:newTitle})}catch{}lt.window.showInformationMessage("Codex thread title updated.")};if(directConversationId){let title=typeof opts.title==="string"&&opts.title.trim().length>0?opts.title:await lt.window.showInputBox({title:"Rename Codex Thread",prompt:"Enter a new title",value:"",ignoreFocusOut:!0});if(typeof title!=="string")return;await persistAndBroadcast(directConversationId,title);return}if(skipQuickPick)throw new Error("No conversationId provided while skipQuickPick=true.");let threads=[];try{let provider=${chatSessionProviderVar};if(!provider||!provider.conversationLoader||typeof provider.conversationLoader.requestThreadList!=="function")throw new Error("Conversation loader is unavailable.");let useCopilotInference=!1;try{useCopilotInference=!!provider.modelProxyManager?.isUserUsingCopilotInference?.()}catch{}let result=await provider.conversationLoader.requestThreadList(useCopilotInference);threads=Array.isArray(result?.data)?result.data:[]}catch(err){J().warning("Failed to fetch conversation list for rename",{safe:{error:err instanceof Error?err.message:String(err)},sensitive:{}}),threads=[]}if(threads.length===0){lt.window.showInformationMessage("No Codex threads available to rename.");return}let titleCache=await readThreadTitles(),items=threads.map(t=>{let id=typeof t?.id==="string"?t.id:typeof t?.conversationId==="string"?t.conversationId:String(t?.id??t?.conversationId??"");let cachedTitle=titleCache.titles[id],preview=typeof cachedTitle==="string"?cachedTitle:typeof t?.preview==="string"?t.preview:"",label=(preview&&preview.trim().length>0?preview.trim():id).slice(0,120);return{label,description:id,conversationId:id}}).filter(t=>typeof t.conversationId==="string"&&t.conversationId.trim().length>0);if(items.length===0){lt.window.showInformationMessage("No Codex threads available to rename.");return}let picked=await lt.window.showQuickPick(items,{title:"Rename Codex Thread",placeHolder:"Select a thread to rename",matchOnDescription:!0,ignoreFocusOut:!0});if(!picked)return;let defaultTitle=titleCache.titles[picked.conversationId]??picked.label??"",newTitle=await lt.window.showInputBox({title:"Rename Codex Thread",prompt:"Enter a new title",value:defaultTitle,ignoreFocusOut:!0});if(typeof newTitle!=="string")return;await persistAndBroadcast(picked.conversationId,newTitle);})),`;
}

function ensureRenamePatchApplied(source) {
  if (source.includes('registerCommand("chatgpt.renameThread"')) {
    return { status: "already_patched", source };
  }

  const stateVarsMatch = source.match(
    /await\s+([A-Za-z_$][\w$]*)\.update\(([A-Za-z_$][\w$]*)\.SHOW_COPILOT_LOGIN_FIRST,!0\),([A-Za-z_$][\w$]*)\.createNewPanel\(\)/
  );
  const insertionMatch = source.match(
    /e\.push\(lt\.commands\.registerCommand\([A-Za-z_$][\w$]*,async\(\)=>\{await Lo\(\),([A-Za-z_$][\w$]*)\.triggerNewChatViaWebview\(\)\}\)\),/
  );

  if (!stateVarsMatch || !insertionMatch || insertionMatch.index == null) {
    return { status: "unsupported_layout", source };
  }

  const globalStateVar = stateVarsMatch[1];
  const constantsVar = stateVarsMatch[2];
  const createPanelVar = stateVarsMatch[3];
  const newChatVar = insertionMatch[1];
  const chatSessionProviderMatch = source.match(
    new RegExp(`let\\s+${newChatVar}=new\\s+cs\\([^)]*?,([A-Za-z_$][\\w$]*)\\?\\?void 0,`)
  );

  if (createPanelVar !== newChatVar || !chatSessionProviderMatch) {
    return { status: "unsupported_layout", source };
  }

  const chatSessionProviderVar = chatSessionProviderMatch[1];
  const insertionPoint = insertionMatch.index + insertionMatch[0].length;
  const patchSnippet = buildRenamePatchSnippet(globalStateVar, constantsVar, newChatVar, chatSessionProviderVar);
  const patchedSource = `${source.slice(0, insertionPoint)}${patchSnippet}${source.slice(insertionPoint)}`;

  return { status: "patched", source: patchedSource };
}

function applyCodexRenameRuntimePatch() {
  const codexExtension = getCodexExtension();
  if (!codexExtension) {
    return { status: "not_installed" };
  }

  const extensionVersion = String(codexExtension.packageJSON?.version ?? "unknown");
  const extensionFile = path.join(codexExtension.extensionPath, "out", "extension.js");
  if (!fs.existsSync(extensionFile)) {
    return {
      status: "extension_file_missing",
      extensionVersion,
      extensionFile,
    };
  }

  const source = fs.readFileSync(extensionFile, "utf8");
  const patchResult = ensureRenamePatchApplied(source);
  if (patchResult.status === "already_patched") {
    return {
      status: "already_patched",
      extensionVersion,
      extensionFile,
    };
  }

  if (patchResult.status !== "patched") {
    return {
      status: "unsupported_layout",
      extensionVersion,
      extensionFile,
    };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${extensionFile}.bak-${timestamp}-codex-rename-thread`;
  fs.copyFileSync(extensionFile, backupPath);
  fs.writeFileSync(extensionFile, patchResult.source, "utf8");

  return {
    status: "patched",
    extensionVersion,
    extensionFile,
    backupPath,
  };
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const disposable = vscode.commands.registerCommand("codex.renameCurrentThread", async () => {
    const conversationId = getActiveConversationId();

    try {
      const result = await findAndExecuteRenameCommand(conversationId);
      if (result.success) {
        return;
      }

      const patchAttempt = applyCodexRenameRuntimePatch();
      if (patchAttempt.status === "patched" || patchAttempt.status === "already_patched") {
        const reloadAction = "Reload Window";
        const patchMessage =
          patchAttempt.status === "patched"
            ? `Patched Codex runtime (${patchAttempt.extensionVersion}). Reload VS Code to enable rename.`
            : `Codex runtime already patched on disk (${patchAttempt.extensionVersion}). Reload VS Code to load it.`;

        const pickedAction = await vscode.window.showInformationMessage(patchMessage, reloadAction);
        if (pickedAction === reloadAction) {
          await vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
        return;
      }

      const detail =
        result.error instanceof Error ? result.error.message : String(result.error ?? "No compatible rename command found.");
      const patchDetail = (() => {
        switch (patchAttempt.status) {
          case "not_installed":
            return "openai.chatgpt extension not found.";
          case "extension_file_missing":
            return `Codex runtime file not found: ${patchAttempt.extensionFile}`;
          case "unsupported_layout":
            return "Codex runtime layout changed and auto-patch pattern did not match.";
          default:
            return "";
        }
      })();
      const openSidebarAction = "Open Codex Sidebar";
      const showCandidatesAction = "Show Candidates";

      const selection = await vscode.window.showErrorMessage(
        "Could not trigger a compatible Codex rename command automatically.",
        { detail: patchDetail ? `${detail} | ${patchDetail}` : detail },
        openSidebarAction,
        showCandidatesAction
      );

      if (selection === openSidebarAction) {
        await vscode.commands.executeCommand("chatgpt.openSidebar");
        return;
      }

      if (selection === showCandidatesAction) {
        const picked = await vscode.window.showQuickPick(result.attempted, {
          placeHolder: "Select a command to execute manually",
          ignoreFocusOut: true,
        });
        if (picked) {
          await executeRenameCommand(picked, conversationId);
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error ?? "");
      vscode.window.showErrorMessage(
        "Could not trigger Codex rename flow.",
        { detail }
      );
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
