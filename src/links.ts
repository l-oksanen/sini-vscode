import * as vscode from 'vscode';

/**
 * The one command: what the lens, the key and the palette all run.
 *
 * It takes no argument and works from the active editor, so there is nothing
 * for a caller to get wrong and one path for a failure to be reported on.
 */
export const SHOW_IN_PDF = 'sini.showInPdf';

/** The LaTeX Workshop command that drives a forward search. */
const SYNCTEX = 'latex-workshop.synctexto';

/** A statement in the prose, at a **one-based** line. */
export interface Statement {
    path: string;
    line: number;
}

/** Whether LaTeX Workshop is present and still offers the command we drive. */
export async function available(): Promise<boolean> {
    return (await vscode.commands.getCommands(true)).includes(SYNCTEX);
}

/**
 * Show the statement in the PDF viewer, and come back.
 *
 * Two things about `latex-workshop.synctexto` are not in its documentation --
 * it has none -- and both shape this:
 *
 * It refuses unless the *active editor* is a LaTeX document. Its body opens
 * `if (!vscode.window.activeTextEditor || !lw.file.hasLaTeXLangId(...)) return`,
 * and returns silently. So the `.tex` has to be opened and focused first; there
 * is no driving it straight from a Lean file. It is opened as a preview tab, so
 * repeated use does not accumulate tabs.
 *
 * And it wants a *zero-based* line: `toPDFFromRef` does `args.line += 1` before
 * handing it to SyncTeX. Everything here counts from one, as an editor does, so
 * the conversion happens once, here, rather than anywhere the two conventions
 * could be confused. Getting it backwards lands the reader one line from the
 * statement, which is close enough to look like it worked and wrong every time.
 *
 * Focus is then returned to where it came from. Borrowing it is a means, not
 * the point: the reader asked to see the statement in the PDF, not to be moved
 * into a `.tex` file they were not editing. Returning it immediately is safe --
 * `toPDF` reads `activeTextEditor` synchronously, so by the time the command
 * resolves it already has what it needs.
 */
export async function openInPdf(target: Statement): Promise<void> {
    const previous = vscode.window.activeTextEditor;
    const document = await vscode.workspace.openTextDocument(target.path);
    const at = new vscode.Position(target.line - 1, 0);
    await vscode.window.showTextDocument(document, {
        preview: true,
        selection: new vscode.Range(at, at),
    });

    if (!(await available())) {
        // The `.tex` is open at the statement, which is most of the value. Say
        // why the rest did not happen rather than appearing to do nothing.
        void vscode.window.showWarningMessage(
            'LaTeX Workshop is not available, so the PDF was not synced. ' +
                'The blueprint source is open at the statement instead.',
        );
        return;
    }
    await vscode.commands.executeCommand(
        SYNCTEX,
        target.line - 1,
        document.uri.fsPath,
    );

    if (previous !== undefined) {
        await vscode.window.showTextDocument(previous.document, {
            viewColumn: previous.viewColumn,
            preview: false,
        });
    }
}
