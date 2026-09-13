import * as vscode from 'vscode';
import { OPEN_IN_PDF } from './links';
import { Hit, nodeOf, texLabelsInLine } from './nodes';
import { Workspace } from './workspace';

/**
 * A link that knows which label it is about, so the target can be worked out
 * later. `resolveDocumentLink` runs only when a link is actually pointed at,
 * which is what makes this affordable: a blueprint with 294 labels costs one
 * regex scan of the open document, and the index is consulted for exactly the
 * one label the reader points at.
 */
class LabelLink extends vscode.DocumentLink {
    constructor(hit: Hit, readonly folder: vscode.WorkspaceFolder) {
        super(new vscode.Range(hit.line, hit.start, hit.line, hit.end));
        this.label = hit.label;
    }
    readonly label: string;
}

/**
 * Ctrl+click a `\label` and go to the Lean file that formalizes it.
 *
 * The gesture is borrowed deliberately: it is already what a PDF viewer uses to
 * come back to the `.tex`, so the same two fingers carry a reader all the way
 * round -- PDF to prose to Lean.
 */
function texLinks(workspace: Workspace): vscode.DocumentLinkProvider<LabelLink> {
    return {
        async provideDocumentLinks(document) {
            const folder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (folder === undefined || !(await workspace.hasLibrary(folder))) {
                return [];
            }
            const out: LabelLink[] = [];
            for (let row = 0; row < document.lineCount; row++) {
                for (const hit of texLabelsInLine(document.lineAt(row).text, row)) {
                    out.push(new LabelLink(hit, folder));
                }
            }
            return out;
        },
        async resolveDocumentLink(link) {
            const file = await workspace.file(link.folder, link.label);
            if (file !== undefined) {
                link.target = file;
            }
            // A label no node answers -- an equation, a part, a chapter, a node
            // not yet formalized -- is left unresolved rather than pointed
            // somewhere. A link that goes nowhere is better than one that goes
            // to the wrong place.
            return link;
        },
    };
}

/**
 * The other direction, which has no text to click.
 *
 * Under the old system a Lean file carried the label in an attribute, and the
 * jump hung off that. Now the file *is* the label, and there is nothing in the
 * text to point at -- so the affordance is a lens on the first line, which is
 * also the honest shape of the fact: it is about the file, not about any line
 * of it.
 *
 * A `NonVacuity.lean` or `Examples.lean` gets the same lens as its node. It
 * belongs to the node, and a reader in one has the same question.
 */
function leanLenses(workspace: Workspace): vscode.CodeLensProvider {
    return {
        async provideCodeLenses(document) {
            const folder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (folder === undefined) {
                return [];
            }
            const node = nodeOf(document.uri.path);
            if (node === undefined) {
                return [];
            }
            const prose = await workspace.prose(folder, node.label);
            if (prose === undefined) {
                // The library has a file for a label the blueprint does not
                // write. That is a project error the checker reports; showing a
                // lens that cannot go anywhere would only repeat it badly.
                return [];
            }
            const at = new vscode.Range(0, 0, 0, 0);
            return [
                new vscode.CodeLens(at, {
                    title: `${node.label} in the blueprint`,
                    tooltip: 'Open the statement in the PDF viewer',
                    command: OPEN_IN_PDF,
                    arguments: [{ path: prose.uri.fsPath, line: prose.line }],
                }),
            ];
        },
    };
}

export function register(workspace: Workspace): vscode.Disposable[] {
    return [
        vscode.languages.registerDocumentLinkProvider('latex', texLinks(workspace)),
        vscode.languages.registerCodeLensProvider('lean4', leanLenses(workspace)),
    ];
}
