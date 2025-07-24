import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class ScriptItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly command?: vscode.Command,
    private readonly scriptContent?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'scriptItem';
    this.tooltip = `${label} → ${scriptContent}`; // Hover 显示脚本内容
  }
}

class ScriptsProvider implements vscode.TreeDataProvider<ScriptItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ScriptItem | undefined | void> = new vscode.EventEmitter<ScriptItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ScriptItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ScriptItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<ScriptItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No workspace opened');
      return Promise.resolve([]);
    }

    const pkgJsonPath = path.join(this.workspaceRoot, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      vscode.window.showInformationMessage('No package.json found in workspace root');
      return Promise.resolve([]);
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const scripts = pkgJson.scripts || {};

    return Promise.resolve(
      Object.keys(scripts).map(script => {
        const content = scripts[script];
        return new ScriptItem(script, {
          command: 'packageScripts.runScript',
          title: 'Run Script',
          arguments: [script]
        }, content);
      })
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const rootPath = workspaceFolders?.[0]?.uri.fsPath;

  const scriptsProvider = new ScriptsProvider(rootPath);
  vscode.window.registerTreeDataProvider('scriptList', scriptsProvider);

  const runScriptCommand = vscode.commands.registerCommand('packageScripts.runScript', (scriptName: string) => {
    const terminal = vscode.window.createTerminal(`Script: ${scriptName}`);
    terminal.show();
    terminal.sendText(`npm run ${scriptName}`);
  });

  const debugScriptCommand = vscode.commands.registerCommand('packageScripts.debugScript', async (scriptName: string) => {
    if (!rootPath) {
      vscode.window.showErrorMessage('No workspace open');
      return;
    }

    const debugConfig: vscode.DebugConfiguration = {
      type: 'node',
      request: 'launch',
      name: `Debug: ${scriptName}`,
      runtimeExecutable: 'npm',
      runtimeArgs: ['run', scriptName],
      cwd: rootPath,
      console: 'integratedTerminal'
    };

    vscode.debug.startDebugging(undefined, debugConfig);
  });

  context.subscriptions.push(runScriptCommand, debugScriptCommand);
}

export function deactivate() {}
