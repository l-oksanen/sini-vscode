import * as vscode from 'vscode';
import { SPEC, nodeOf, texLabelsInLine, uncommented } from './nodes';

/** The blueprint, relative to a workspace folder. The data model fixes this path. */
export const BLUEPRINT = ['blueprint', 'blueprint.tex'];

/** A location, at a **one-based** line, as every editor reports one to a human. */
export interface Location {
    uri: vscode.Uri;
    line: number;
}

interface Index {
    /** Whether the folder has a blueprint at all. */
    blueprint: boolean;
    /** label -> the `\label{...}` that writes it. */
    prose: Map<string, Location>;
    /** label -> the `Spec.lean` that formalizes it. */
    files: Map<string, vscode.Uri>;
}

/** `\input` and `\include`, the two ways the blueprint reaches another file. */
const INPUT = /\\(?:input|include)\s*\{([^}\n]*)\}/g;

/**
 * A file's lines, preferring an editor's copy over the disk's.
 *
 * The index is invalidated by the file watcher, so it otherwise describes the
 * last saved state. Reading an open document instead means a file the reader
 * has open and unsaved -- very often the one they are working in -- still
 * answers with what is on their screen.
 */
async function linesOf(
    uri: vscode.Uri,
    open: Map<string, vscode.TextDocument>,
): Promise<string[]> {
    const document = open.get(uri.toString());
    if (document !== undefined) {
        return document.getText().split(/\r?\n/);
    }
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(bytes).split(/\r?\n/);
    } catch {
        // Missing or unreadable: an `\input` of a file that is not there is the
        // author's problem, and not a reason to have no index.
        return [];
    }
}

/**
 * The blueprint and everything it reads, in order.
 *
 * Following the document is not merely cheaper than globbing every `.tex` in
 * the workspace -- it is more correct. A paper draft elsewhere in the
 * repository has `\label`s of its own, and one of them shadowing a node's is a
 * jump that lands in the wrong document with nothing to show it did.
 */
async function documents(
    root: vscode.Uri,
    open: Map<string, vscode.TextDocument>,
): Promise<vscode.Uri[]> {
    const directory = vscode.Uri.joinPath(root, BLUEPRINT[0]);
    const seen = new Set<string>();
    const out: vscode.Uri[] = [];

    const visit = async (uri: vscode.Uri): Promise<void> => {
        if (seen.has(uri.toString())) {
            return; // `\input` of something already read, or a cycle
        }
        seen.add(uri.toString());
        out.push(uri);
        for (const line of await linesOf(uri, open)) {
            INPUT.lastIndex = 0;
            const text = uncommented(line);
            for (let m = INPUT.exec(text); m !== null; m = INPUT.exec(text)) {
                const name = m[1].trim();
                if (name === '') {
                    continue;
                }
                // `\input{macros}` means `macros.tex`, resolved against the
                // blueprint's own directory as a LaTeX run would. `\include`
                // is resolved the same way, and both are followed: the data
                // model says the blueprint is `blueprint.tex` together with
                // the files it reads through either.
                await visit(vscode.Uri.joinPath(
                    directory, name.endsWith('.tex') ? name : `${name}.tex`));
            }
        }
    };

    await visit(vscode.Uri.joinPath(root, ...BLUEPRINT));
    return out;
}

/**
 * Where each label is written, on both sides.
 *
 * Only the prose side needs reading. The Lean side is answered by the path, so
 * finding a node's file is a glob and a decode -- no Lean file is opened, and a
 * project that has never been built navigates exactly as well as one that has.
 */
export class Workspace implements vscode.Disposable {
    private folders = new Map<string, Promise<Index>>();
    private watcher: vscode.FileSystemWatcher;
    private changed = new vscode.EventEmitter<void>();

    /**
     * Fires when the index is dropped.
     *
     * A link is resolved when it is pointed at, so it needs no telling. A lens
     * is not: it is drawn once and stays on screen, so a label added to the
     * blueprint would not reach it until the file was reopened.
     */
    readonly onDidChange = this.changed.event;

    constructor() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.{tex,lean}');
        const forget = () => this.forget();
        this.watcher.onDidChange(forget);
        this.watcher.onDidCreate(forget);
        this.watcher.onDidDelete(forget);
    }

    /** The index no longer describes the workspace, so drop it. */
    forget(): void {
        this.folders.clear();
        this.changed.fire();
    }

    private index(folder: vscode.WorkspaceFolder): Promise<Index> {
        const key = folder.uri.toString();
        let pending = this.folders.get(key);
        if (pending === undefined) {
            pending = build(folder).catch((e) => {
                this.folders.delete(key); // a failure must not be cached
                throw e;
            });
            this.folders.set(key, pending);
        }
        return pending;
    }

    /**
     * Whether this folder is a blueprint project: does `blueprint/blueprint.tex`
     * exist?
     *
     * The link provider asks first, and offers nothing when the answer is no. A
     * `\label` is ordinary LaTeX that most projects have never heard of this
     * extension about, and underlining every one of them in every document to
     * then resolve none is worse than doing nothing.
     */
    async hasBlueprint(folder: vscode.WorkspaceFolder): Promise<boolean> {
        return (await this.index(folder)).blueprint;
    }

    async prose(
        folder: vscode.WorkspaceFolder,
        label: string,
    ): Promise<Location | undefined> {
        return (await this.index(folder)).prose.get(label);
    }

    async file(
        folder: vscode.WorkspaceFolder,
        label: string,
    ): Promise<vscode.Uri | undefined> {
        return (await this.index(folder)).files.get(label);
    }

    dispose(): void {
        this.watcher.dispose();
        this.changed.dispose();
        this.folders.clear();
    }
}

async function build(folder: vscode.WorkspaceFolder): Promise<Index> {
    const empty = { prose: new Map(), files: new Map() };
    try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, ...BLUEPRINT));
    } catch {
        return { blueprint: false, ...empty };
    }

    const open = new Map(
        vscode.workspace.textDocuments.map((d) => [d.uri.toString(), d] as const));

    const prose = new Map<string, Location>();
    for (const uri of await documents(folder.uri, open)) {
        const lines = await linesOf(uri, open);
        lines.forEach((text, row) => {
            for (const hit of texLabelsInLine(text, row)) {
                // First match wins, in document order: a duplicated label is a
                // project's own error, and answering it the same way twice
                // running matters more than which of the two is chosen.
                if (!prose.has(hit.label)) {
                    prose.set(hit.label, { uri, line: row + 1 });
                }
            }
        });
    }

    // The Specs, which is where a reader coming from the prose wants to land:
    // a node's facade is generated and holds nothing but a `public import`,
    // and every node directory holds a Spec. Globbing them also names the node
    // directories without needing to know how deep they are.
    const exclude = vscode.workspace
        .getConfiguration('siniJump', folder)
        .get<string>('exclude', '');
    const lean = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, `**/_*/${SPEC}`),
        exclude === '' ? null : exclude);

    const files = new Map<string, vscode.Uri>();
    for (const uri of [...lean].sort((a, b) => a.fsPath.localeCompare(b.fsPath))) {
        const node = nodeOf(uri.path);
        if (node !== undefined && node.role === 'spec' && !files.has(node.label)) {
            files.set(node.label, uri);
        }
    }

    return { blueprint: true, prose, files };
}
