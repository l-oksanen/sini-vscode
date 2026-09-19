import * as vscode from 'vscode';
import { nodeOf, sectionLineIn } from './nodes';
import { EMPTY, States, Style, chip, parse, styleOf } from './state';
import { Workspace } from './workspace';

/** The state file, relative to a workspace folder, unless the setting says otherwise. */
const STATE = '.vscode/sini-state.json';

/**
 * The chip: which node this file is in, and what the project knows about it.
 *
 * This is the only place either is said, so it says them whether or not the
 * state file mentions the node -- which node a file belongs to is exactly what
 * the file name stopped saying when a node became a directory.
 *
 * A decoration rather than anything else because of the colour: it is the only
 * thing in VS Code that takes an arbitrary background. A status bar item's
 * background is restricted to two theme colours, a file decoration colours
 * foreground only, and a code lens takes no styling at all.
 *
 * It is drawn as `after` content, on the line that opens the node's section
 * where the file has one and on the first line where it has not, so it costs
 * no line of its own and cannot be typed over. A sticky line is rendered from
 * its own line's inline decorations, which is why the section is worth finding:
 * Lean's symbol provider makes that line sticky, and the chip rides up with it.
 */
export class Labels implements vscode.Disposable {
    private readonly type = vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });
    private readonly disposables: vscode.Disposable[] = [];
    private states = new Map<string, Promise<States>>();
    private watcher?: vscode.FileSystemWatcher;

    constructor(private readonly workspace: Workspace) {
        this.watch();
        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors(() => this.refresh()),
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('siniJump')) {
                    this.forget();
                    this.watch(); // the setting may name a different file
                }
            }),
            // A label is drawn from the index, so it is redrawn with it: a
            // `\label` added to the blueprint turns "not in the blueprint"
            // into the node's own name without reopening the file.
            workspace.onDidChange(() => this.refresh()),
        );
        void this.refresh();
    }

    /** The state file is generated, so it is watched rather than read once. */
    private watch(): void {
        this.watcher?.dispose();
        this.watcher = vscode.workspace.createFileSystemWatcher(`**/${this.file()}`);
        const changed = () => {
            this.forget();
        };
        this.watcher.onDidChange(changed);
        this.watcher.onDidCreate(changed);
        this.watcher.onDidDelete(changed);
    }

    private file(): string {
        return vscode.workspace
            .getConfiguration('siniJump')
            .get<string>('state', STATE) || STATE;
    }

    private forget(): void {
        this.states.clear();
        void this.refresh();
    }

    private read(folder: vscode.WorkspaceFolder): Promise<States> {
        const key = folder.uri.toString();
        let pending = this.states.get(key);
        if (pending === undefined) {
            const uri = vscode.Uri.joinPath(folder.uri, ...this.file().split('/'));
            pending = Promise.resolve(vscode.workspace.fs.readFile(uri)).then(
                (bytes) => parse(new TextDecoder().decode(bytes)),
                // No state file is the ordinary case, not an error: a project
                // that reports no states gets labels without colours.
                () => EMPTY,
            );
            this.states.set(key, pending);
        }
        return pending;
    }

    async refresh(): Promise<void> {
        await Promise.all(
            vscode.window.visibleTextEditors.map((e) => this.draw(e)));
    }

    private async draw(editor: vscode.TextEditor): Promise<void> {
        const clear = () => editor.setDecorations(this.type, []);
        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        const node = nodeOf(editor.document.uri.path);
        if (folder === undefined || node === undefined) {
            return clear();
        }
        if (!(await this.workspace.hasBlueprint(folder))) {
            return clear();
        }
        const [states, prose] = await Promise.all([
            this.read(folder),
            this.workspace.prose(folder, node.label),
        ]);
        const style = styleOf(states, node.label, editor.document.uri.path.split('/'));
        // The editor may have been closed or navigated away while the index
        // and the state file were being read.
        if (!vscode.window.visibleTextEditors.includes(editor)) {
            return;
        }
        const line = sectionLineIn(
            editor.document.getText().split(/\r?\n/), node.label);
        const lost = prose === undefined;
        const text = chip(node.label, style, line !== undefined, !lost);
        if (text === undefined) {
            return clear();
        }
        const end = editor.document.lineAt(line ?? 0).range.end;
        editor.setDecorations(this.type, [
            { range: new vscode.Range(end, end), renderOptions: after(text, style, lost) },
        ]);
    }

    dispose(): void {
        this.type.dispose();
        this.watcher?.dispose();
        this.disposables.forEach((d) => d.dispose());
        this.states.clear();
    }
}

/**
 * How the label is drawn.
 *
 * A node with no state gets the label in the colour a comment has, which is
 * the editor's own way of saying "this is not the code". A node with one gets
 * the colour the project chose, and a foreground only if the project said one:
 * a background picked for a light theme with white text on it is the project's
 * to specify, and guessing contrast would be worse than honouring silence.
 *
 * A node the blueprint has lost takes the editor's warning colour and no
 * background: it is a fault rather than a state, and the project's palette
 * has nothing to say about it.
 *
 * The text is the text, with nothing padding it out. A space inside the
 * content is a space the colour is drawn behind, and it reads as the chip
 * having slipped rather than as room around the word; the gap that belongs
 * here is the one between the code and the chip, which is the margin's to
 * give. Inset would be `padding`, which the renderer honours but the API does
 * not declare.
 */
export function after(
    label: string,
    style: Style | undefined,
    warning = false,
): vscode.DecorationInstanceRenderOptions {
    return {
        after: {
            contentText: label,
            backgroundColor: warning ? undefined : style?.background,
            color: warning
                ? new vscode.ThemeColor('editorWarning.foreground')
                : style?.foreground ?? new vscode.ThemeColor(
                    style?.background === undefined
                        ? 'editorCodeLens.foreground'
                        : 'editor.foreground'),
            margin: '0 0 0 2ch',
            fontStyle: 'normal',
        },
    };
}
