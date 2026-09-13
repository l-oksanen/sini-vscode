import * as vscode from 'vscode';
import { Hit, texLabelsInLine } from './nodes';
import { Workspace } from './workspace';

/**
 * A link that knows which label it is about, so the target can be worked out
 * later. `resolveDocumentLink` runs only when a link is actually pointed at,
 * which is what makes this affordable: a blueprint with 321 labels costs one
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
 * come back to the `.tex`, so the same two fingers carry a reader from the PDF
 * to the prose to the Lean.
 */
function texLinks(workspace: Workspace): vscode.DocumentLinkProvider<LabelLink> {
    return {
        async provideDocumentLinks(document) {
            const folder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (folder === undefined || !(await workspace.hasBlueprint(folder))) {
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

export function register(workspace: Workspace): vscode.Disposable {
    return vscode.languages.registerDocumentLinkProvider('latex', texLinks(workspace));
}
