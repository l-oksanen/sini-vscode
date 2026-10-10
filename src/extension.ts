import * as vscode from 'vscode';
import { register as registerLinks } from './jump';
import { SHOW_IN_PDF, openInPdf } from './links';
import { nodeOf } from './nodes';
import { Workspace } from './workspace';

function showInPdf(workspace: Workspace): vscode.Disposable {
    return vscode.commands.registerCommand(SHOW_IN_PDF, async () => {
        const editor = vscode.window.activeTextEditor;
        const folder =
            editor && vscode.workspace.getWorkspaceFolder(editor.document.uri);
        const node = editor && nodeOf(editor.document.uri.path);
        if (!editor || !folder || !node) {
            void vscode.window.showInformationMessage(
                'This file is not a blueprint node: a node is a directory in the ' +
                    'library, and this is none of its `Spec.lean`, `API.lean`, ' +
                    '`Helpers.lean`, `Meta.lean`, its tests, or the facade beside it.',
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
        showInPdf(workspace),
        // The setting changes what a scan finds, so the answer from before the
        // change stops being the answer.
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('sini')) {
                workspace.forget();
            }
        }),
    );
}

export function deactivate(): void {
    // Everything is in context.subscriptions.
}
