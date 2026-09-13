import * as vscode from 'vscode';
import { nodeOf, texLabelsInLine } from './nodes';

/** A location, at a **one-based** line, as every editor reports one to a human. */
export interface Location {
    uri: vscode.Uri;
    line: number;
}

interface Index {
    /** label -> the `\label{...}` that writes it. */
    prose: Map<string, Location>;
    /** label -> the `.lean` file that formalizes it. */
    files: Map<string, vscode.Uri>;
}

function sorted(uris: vscode.Uri[]): vscode.Uri[] {
    return [...uris].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
}

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
        // Deleted between the search and the read, or unreadable. One file
        // missing from the index is not a reason to have no index.
        return [];
    }
}

/**
 * Where each label is written, on both sides.
 *
 * Only the prose side needs reading. The Lean side is answered by the path, so
 * finding a node's file is a glob and a decode -- no file is opened, and a
 * project that has never been built navigates exactly as well as one that has.
 */
export class Workspace implements vscode.Disposable {
    private folders = new Map<string, Promise<Index>>();
    private watcher: vscode.FileSystemWatcher;

    constructor() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.{tex,lean}');
        const forget = () => this.folders.clear();
        this.watcher.onDidChange(forget);
        this.watcher.onDidCreate(forget);
        this.watcher.onDidDelete(forget);
    }

    /** Configuration changed under `siniJump`, so a scan would answer differently. */
    forget(): void {
        this.folders.clear();
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
     * Whether this folder has a library filesystem at all.
     *
     * The link provider asks first, and offers nothing when the answer is no. A
     * `\label` is ordinary LaTeX that most projects have never heard of this
     * extension about, and underlining every one of them in every document to
     * then resolve none is worse than doing nothing.
     */
    async hasLibrary(folder: vscode.WorkspaceFolder): Promise<boolean> {
        return (await this.index(folder)).files.size > 0;
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
        this.folders.clear();
    }
}

async function build(folder: vscode.WorkspaceFolder): Promise<Index> {
    const exclude = vscode.workspace
        .getConfiguration('siniJump', folder)
        .get<string>('exclude', '');
    const open = new Map(
        vscode.workspace.textDocuments.map((d) => [d.uri.toString(), d] as const));
    const find = (glob: string) =>
        vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, glob), exclude === '' ? null : exclude);

    // Only the node files themselves, not their `NonVacuity.lean` satellites:
    // this map answers "where is the node", and the node is the file named
    // after it.
    const [tex, lean] = await Promise.all([
        find('**/*.tex'),
        find('**/{defs,thms}/_*.lean'),
    ]);

    const prose = new Map<string, Location>();
    for (const uri of sorted(tex)) {
        const lines = await linesOf(uri, open);
        lines.forEach((text, row) => {
            for (const hit of texLabelsInLine(text, row)) {
                // First match wins, over files in path order: a duplicated label
                // is a project's own error, and answering it the same way twice
                // running matters more than which of the two is chosen.
                if (!prose.has(hit.label)) {
                    prose.set(hit.label, { uri, line: row + 1 });
                }
            }
        });
    }

    const files = new Map<string, vscode.Uri>();
    for (const uri of sorted(lean)) {
        const node = nodeOf(uri.path);
        if (node !== undefined && node.satellite === undefined && !files.has(node.label)) {
            files.set(node.label, uri);
        }
    }

    return { prose, files };
}
