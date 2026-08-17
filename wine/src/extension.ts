import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

class RicwizWebviewProvider implements vscode.WebviewViewProvider {
    constructor(private readonly _extensionUri: vscode.Uri) { }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        const logoUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'logo.png')
        );

        webviewView.webview.html = this._getHtmlForWebview(logoUri);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.command) {
                case 'createBranches':
                    vscode.commands.executeCommand('ricwiz.createBranches');
                    break;
                case 'prepareDeploy':
                    vscode.commands.executeCommand('ricwiz.prepareDeploy');
                    break;
                case 'openMRs':
                    vscode.commands.executeCommand('ricwiz.createMergeRequests');
                    break;
                case 'openJira':
                    vscode.commands.executeCommand('ricwiz.openJiraTicket');
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('ricwiz.openSettings');
                    break;
            }
        });
    }

    private _getHtmlForWebview(logoUri: vscode.Uri) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ricwiz</title>
            <style>
                body {
                    padding: 10px 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: transparent;
                    color: var(--vscode-foreground);
                    border: 1px solid transparent;
                    padding: 6px 8px;
                    cursor: pointer;
                    font-size: 13px;
                    border-radius: 3px;
                    text-align: left;
                    width: 100%;
                    outline: none;
                }
                .btn:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                .btn:focus {
                    border-color: var(--vscode-focusBorder);
                }
                .icon {
                    font-size: 14px;
                    opacity: 0.8;
                }
                .separator {
                    height: 1px;
                    background-color: var(--vscode-panel-border);
                    margin: 8px 4px;
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; margin-bottom: 12px; margin-top: 8px;">
                <img src="${logoUri}" alt="Ricwiz Logo" style="width: 80px; height: 80px; opacity: 0.9;" />
            </div>

            <button class="btn" title="Generates the main and environment branches" onclick="sendCommand('createBranches')">
                <span class="icon">🌿</span> Create Branches
            </button>

            <button class="btn" title="Sync environments and merge ticket" onclick="sendCommand('prepareDeploy')">
                <span class="icon">🔀</span> Prepare Deploy
            </button>

            <button class="btn" title="Opens Merge Request pages" onclick="sendCommand('openMRs')">
                <span class="icon">🚀</span> Open MRs
            </button>

            <button class="btn" title="Open Jira Ticket for current branch" onclick="sendCommand('openJira')">
                <span class="icon">🎫</span> Open Jira Ticket
            </button>

            <div class="separator"></div>

            <button class="btn" style="opacity: 0.8;" title="Extension Settings" onclick="sendCommand('openSettings')">
                <span class="icon">⚙️</span> Settings
            </button>
            
            <script>
                const vscode = acquireVsCodeApi();
                function sendCommand(cmd) {
                    vscode.postMessage({ command: cmd });
                }
            </script>
        </body>
        </html>`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new RicwizWebviewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('ricwiz-webview', provider)
    );

    let disposable = vscode.commands.registerCommand('ricwiz.createBranches', async () => {
        const ticketNumber = await vscode.window.showInputBox({
            prompt: 'Enter the ticket number (e.g., 1234)',
            placeHolder: 'Ticket number'
        });

        if (!ticketNumber) {
            vscode.window.showErrorMessage('Branch creation cancelled: Ticket number not provided.');
            return;
        }

        const config = vscode.workspace.getConfiguration('ricwiz');
        const prefix = config.get<string>('ticketPrefix', 'SFPSCA-');
        const sourceBranchForTicket = config.get<string>('ticketSourceBranch', 'main');
        const environments = config.get<any[]>('environments', [
            { name: 'Qual', sourceBranch: 'quality' },
            { name: 'Val', sourceBranch: 'validation' },
            { name: 'Prod', sourceBranch: 'main' }
        ]);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Open a folder or workspace that is a Git repository.');
            return;
        }

        const cwd = workspaceFolders[0].uri.fsPath;
        
        try {
            await exec('git status', { cwd });
        } catch (e) {
            vscode.window.showErrorMessage('The opened folder does not appear to be a valid Git repository.');
            return;
        }

        const mainBranch = `${prefix}${ticketNumber}`;

        try {
            // Guardar branch inicial para caso dê erro ou para criar a mainBranch a partir da atual
            let initialBranch = '';
            try {
                const { stdout } = await exec('git branch --show-current', { cwd });
                initialBranch = stdout.trim();
            } catch(e) {}
            
            let createdCount = 0;
            vscode.window.showInformationMessage(`Ricwiz: Checking remote status (git fetch)...`);
            
            try {
                await exec('git fetch', { cwd });
            } catch (e) {
                // Pode falhar se estiver offline, continuamos mesmo assim
            }

            // Função auxiliar para ver se a branch existe local ou remotamente
            const checkBranchExists = async (b: string) => {
                try {
                    await exec(`git show-ref --verify --quiet refs/heads/${b}`, { cwd });
                    return true;
                } catch(e) {}
                try {
                    await exec(`git show-ref --verify --quiet refs/remotes/origin/${b}`, { cwd });
                    return true;
                } catch(e) {}
                return false;
            };

            // 1. Criar a branch principal a partir da branch base configurada (ex: main)
            if (await checkBranchExists(mainBranch)) {
                vscode.window.showInformationMessage(`Ricwiz: The branch ${mainBranch} already exists. Skipping creation...`);
                // Checkout para garantir que a temos localmente
                await exec(`git checkout ${mainBranch}`, { cwd });
            } else {
                try {
                    await exec(`git fetch origin ${sourceBranchForTicket}`, { cwd });
                    await exec(`git checkout -b ${mainBranch} origin/${sourceBranchForTicket}`, { cwd });
                    createdCount++;
                } catch (e: any) {
                    try {
                        await exec(`git checkout -b ${mainBranch} ${sourceBranchForTicket}`, { cwd });
                        createdCount++;
                    } catch(err) {} 
                }
                
                try { 
                    await exec(`git push -u origin ${mainBranch}`, { cwd }); 
                } catch(e){} 
            }

            // 2. Criar branches de ambiente baseadas nas sourceBranches configuradas
            for (const env of environments) {
                const envBranchName = `${prefix}${ticketNumber}-to-${env.name}`;
                const sourceBranch = env.sourceBranch;

                if (await checkBranchExists(envBranchName)) {
                    // Já existe, não criamos nem apagamos nada
                } else {
                    try {
                        // Checkout source branch e pull
                        await exec(`git checkout ${sourceBranch}`, { cwd });
                        try { await exec(`git pull origin ${sourceBranch}`, { cwd }); } catch(e){}
                        
                        // Criar a branch de ambiente baseada nela
                        await exec(`git checkout -b ${envBranchName}`, { cwd });
                        createdCount++;
                        
                        // Push
                        await exec(`git push -u origin ${envBranchName}`, { cwd });
                    } catch (e: any) {
                        vscode.window.showWarningMessage(`Ricwiz: Could not create/sync branch ${envBranchName} from ${sourceBranch}. Does the source branch exist?`);
                    }
                }
            }

            // 3. Voltar para a main branch no final
            try {
                await exec(`git checkout ${mainBranch}`, { cwd });
                vscode.window.showInformationMessage(`Ricwiz: Operation complete. ${createdCount} branches created. Back on ${mainBranch}.`);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Ricwiz: Failed to switch to main branch: ${e.message}`);
            }
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Ricwiz general error: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);

    let prepareDeployDisposable = vscode.commands.registerCommand('ricwiz.prepareDeploy', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Ricwiz: Open a folder or workspace that is a Git repository.');
            return;
        }

        const cwd = workspaceFolders[0].uri.fsPath;
        
        try {
            await exec('git status', { cwd });
        } catch (e) {
            vscode.window.showErrorMessage('Ricwiz: The opened folder does not appear to be a valid Git repository.');
            return;
        }

        const config = vscode.workspace.getConfiguration('ricwiz');
        const prefix = config.get<string>('ticketPrefix', 'SFPSCA-');
        const environments = config.get<any[]>('environments', [
            { name: 'Qual', sourceBranch: 'quality' },
            { name: 'Val', sourceBranch: 'validation' },
            { name: 'Prod', sourceBranch: 'main' }
        ]);

        let currentBranch = '';
        try {
            const { stdout } = await exec('git branch --show-current', { cwd });
            currentBranch = stdout.trim();
        } catch (e) {}

        let ticketNumber = '';
        if (currentBranch.startsWith(prefix) && !currentBranch.includes('-to-')) {
            ticketNumber = currentBranch.substring(prefix.length);
        }

        if (!ticketNumber) {
            const input = await vscode.window.showInputBox({
                prompt: 'What is the ticket number you want to prepare deployment for? (e.g., 1234)',
                placeHolder: 'Ticket number'
            });
            if (!input) {
                vscode.window.showErrorMessage('Operation cancelled: Ticket number not provided.');
                return;
            }
            ticketNumber = input;
        }

        const mainBranch = `${prefix}${ticketNumber}`;

        let successCount = 0;
        const originalBranch = currentBranch;

        vscode.window.showInformationMessage(`Ricwiz: Preparing deploy. Syncing environment branches with their origins and merging ${mainBranch}...`);

        for (const env of environments) {
            const targetBranch = `${prefix}${ticketNumber}-to-${env.name}`;
            const sourceBranch = env.sourceBranch;

            try {
                // Mudar para a branch de ambiente
                await exec(`git checkout ${targetBranch}`, { cwd });
                
                // Fazer pull para garantir que tem o estado mais recente do remote (da própria branch)
                try {
                    await exec(`git pull origin ${targetBranch}`, { cwd });
                } catch (e) {} // Ignora se não conseguir
                
                // 1. Fazer merge da branch de origem (ex: quality) para mantê-la atualizada com o estado global
                try {
                    await exec(`git fetch origin ${sourceBranch}`, { cwd });
                    await exec(`git merge origin/${sourceBranch}`, { cwd });
                } catch (e) {
                    vscode.window.showErrorMessage(`Ricwiz: CONFLICT! The branch origin/${sourceBranch} has conflicts with ${targetBranch}. Operation paused. Please go to Source Control, resolve conflicts, commit, and run the command again.`);
                    return; // Interrompe tudo para o utilizador poder resolver
                }

                // 2. Fazer merge da main branch (as alterações do ticket)
                try {
                    await exec(`git merge ${mainBranch}`, { cwd });
                } catch (e) {
                    vscode.window.showErrorMessage(`Ricwiz: CONFLICT! Your changes in ${mainBranch} have conflicts with ${targetBranch}. Operation paused. Resolve them in Source Control, commit, and run the command again.`);
                    return; // Interrompe tudo para o utilizador poder resolver
                }
                
                // 3. Sincronizar com o remote
                await exec(`git push origin ${targetBranch}`, { cwd });
                
                successCount++;
                vscode.window.showInformationMessage(`Ricwiz: Synchronization complete on branch ${targetBranch}.`);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Ricwiz: Failed to process branch ${targetBranch}. Detail: ${e.message}`);
                return; // Interrompe execução perante erro crítico (ex: falhou o checkout)
            }
        }

        // Tentar voltar para a branch original
        if (originalBranch && originalBranch !== currentBranch) {
            try {
                await exec(`git checkout ${originalBranch}`, { cwd });
                vscode.window.showInformationMessage(`Ricwiz: Operation complete. Back on branch ${originalBranch}.`);
            } catch (e) {}
        } else {
            vscode.window.showInformationMessage(`Ricwiz: Operation complete.`);
        }
    });

    context.subscriptions.push(prepareDeployDisposable);

    let createMRDisposable = vscode.commands.registerCommand('ricwiz.createMergeRequests', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const cwd = workspaceFolders[0].uri.fsPath;

        const config = vscode.workspace.getConfiguration('ricwiz');
        const prefix = config.get<string>('ticketPrefix', 'SFPSCA-');
        const environments = config.get<any[]>('environments', [
            { name: 'Qual', sourceBranch: 'quality' },
            { name: 'Val', sourceBranch: 'validation' },
            { name: 'Prod', sourceBranch: 'main' }
        ]);

        let currentBranch = '';
        try {
            const { stdout } = await exec('git branch --show-current', { cwd });
            currentBranch = stdout.trim();
        } catch (e) {}

        let ticketNumber = '';
        if (currentBranch.startsWith(prefix) && !currentBranch.includes('-to-')) {
            ticketNumber = currentBranch.substring(prefix.length);
        }

        if (!ticketNumber) {
            const input = await vscode.window.showInputBox({
                prompt: 'What is the ticket number for the Merge Requests? (e.g., 1234)'
            });
            if (!input) return;
            ticketNumber = input;
        }

        const gitlabUrlOverride = config.get<string>('gitlabUrlOverride', '');

        let webUrl = '';
        if (gitlabUrlOverride && gitlabUrlOverride.trim() !== '') {
            webUrl = gitlabUrlOverride.trim();
        } else {
            let remoteUrl = '';
            try {
                const { stdout } = await exec('git remote get-url origin', { cwd });
                remoteUrl = stdout.trim();
            } catch (e) {
                vscode.window.showErrorMessage('Ricwiz: Could not get the remote origin URL. Please configure the URL manually in the extension settings.');
                return;
            }

            // Converter URL do Git para URL Web (GitLab/GitHub)
            webUrl = remoteUrl;
            if (webUrl.endsWith('.git')) {
                webUrl = webUrl.slice(0, -4);
            }
            if (webUrl.startsWith('git@')) {
                // git@gitlab.com:empresa/projeto -> gitlab.com/empresa/projeto
                webUrl = webUrl.replace('git@', '').replace(':', '/');
                webUrl = `https://${webUrl}`;
            }
        }

        // Abrir um separador para cada ambiente
        for (const env of environments) {
            const mrSourceBranch = `${prefix}${ticketNumber}-to-${env.name}`;
            const mrTargetBranch = env.sourceBranch;
            
            // GitLab MR URL Format
            const url = `${webUrl}/-/merge_requests/new?merge_request[source_branch]=${mrSourceBranch}&merge_request[target_branch]=${mrTargetBranch}`;
            
            vscode.env.openExternal(vscode.Uri.parse(url));
        }

        vscode.window.showInformationMessage(`Ricwiz: Opening browser for Merge Requests!`);
    });

    context.subscriptions.push(createMRDisposable);

    let openJiraDisposable = vscode.commands.registerCommand('ricwiz.openJiraTicket', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const cwd = workspaceFolders[0].uri.fsPath;

        const config = vscode.workspace.getConfiguration('ricwiz');
        const jiraUrl = config.get<string>('jiraUrl', '');
        const prefix = config.get<string>('ticketPrefix', 'SFPSCA-');

        if (!jiraUrl || jiraUrl.trim() === '') {
            vscode.window.showErrorMessage('Ricwiz: Jira URL is not configured. Please set it in the extension settings (e.g., https://jira.company.com/browse/).');
            return;
        }

        let currentBranch = '';
        try {
            const { stdout } = await exec('git branch --show-current', { cwd });
            currentBranch = stdout.trim();
        } catch (e) {}

        let ticketId = '';
        if (currentBranch.startsWith(prefix) && !currentBranch.includes('-to-')) {
            ticketId = currentBranch;
        } else if (currentBranch.startsWith(prefix) && currentBranch.includes('-to-')) {
            ticketId = currentBranch.split('-to-')[0];
        } else {
            const input = await vscode.window.showInputBox({
                prompt: 'What is the full Jira ticket ID? (e.g., SFPSCA-1234)'
            });
            if (!input) return;
            ticketId = input;
        }

        let url = jiraUrl.trim();
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += ticketId;

        vscode.env.openExternal(vscode.Uri.parse(url));
        vscode.window.showInformationMessage(`Ricwiz: Opening Jira Ticket ${ticketId}!`);
    });

    context.subscriptions.push(openJiraDisposable);

    let openSettingsDisposable = vscode.commands.registerCommand('ricwiz.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'ricwiz');
    });

    context.subscriptions.push(openSettingsDisposable);
}

export function deactivate() {}
