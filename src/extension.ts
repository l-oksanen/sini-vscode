import * as vscode from 'vscode';
import { register as registerLinks } from './jump';
import { openInPdf, register as registerCommand } from './links';
import { nodeOf } from './nodes';
import { Workspace } from './workspace';

/** The other direction, which has no text to click: the file *is* the label. */
const SHOW = 'siniJump.showInPdf';

function showInPdf(workspace: Workspace): vscode.Disposable {
    return vscode.commands.registerCommand(SHOW, async () => {
        const editor = vscode.window.activeTextEditor;
        const folder =
            editor && vscode.workspace.getWorkspaceFolder(editor.document.uri);
        const node = editor && nodeOf(editor.document.uri.path);
        if (!editor || !folder || !node) {
            void vscode.window.showInformationMessage(
                'This file is not a blueprint node: a node is a `.lean` file under ' +
                    '`defs/` or `thms/` in the library.',
            );
            return;
        }
        if (!(await workspace.hasBlueprint(folder))) {
            void vscode.window.showWarningMessage(
                'No `blueprint/blueprint.tex` in this workspace folder, so there is ' +
                    'no blueprint to show.',
            );
            return;
        }
        const prose = await workspace.prose(folder, node.label);
        if (prose === undefined) {
            void vscode.window.showWarningMessage(
                `The blueprint has no \\label{${node.label}}, so there is no ` +
                    'statement to show.',
            );
            return;
        }
        await openInPdf({ path: prose.uri.fsPath, line: prose.line });
    });
}

export function activate(context: vscode.ExtensionContext): void {
    const workspace = new Workspace();
    context.subscriptions.push(
        workspace,
        registerLinks(workspace),
        registerCommand(),
        showInPdf(workspace),
        // The setting changes what a scan finds, so the answer from before the
        // change stops being the answer.
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('siniJump')) {
                workspace.forget();
            }
        }),
    );
}

export function deactivate(): void {
    // Everything is in context.subscriptions.
}
