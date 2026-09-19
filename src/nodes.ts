/**
 * Which node a path belongs to, and which `\label` a line writes.
 *
 * **This module never imports `vscode`.** See `encoding.ts` for why.
 *
 * A node is a *directory* in the library filesystem, named by the node's
 * encoded label and holding the modules that formalize it:
 *
 *     <Lib>/<outer>/<inner>/_thm_svd.lean             the facade
 *     <Lib>/<outer>/<inner>/_thm_svd/Spec.lean        the statement
 *                                    API.lean
 *                                    Helpers.lean
 *                                    Meta.lean
 *                                    Tests/NonVacuity.lean
 *
 * The organizational levels are encoded labels too -- `_part_1_funcanal`,
 * `_ch_08_svd` -- and there are at most two of them, either of which may be
 * absent. The depth is therefore not fixed, so a node is recognised from the
 * bottom: by the role its file name names, or by the `Tests` directory above
 * it. Those names are fixed by the data model, where counting from the top
 * would need the level list out of the project's configuration.
 *
 * A level instance has no facade, which is what leaves a `_x.lean` unambiguous:
 * it is always a node's. Its directory, though, is named exactly as a node's
 * is, and only what it holds tells them apart -- a level instance holds no
 * `Spec.lean`. So a path is read for the role its file name names, and a Spec
 * written under a level instance is read as that level's: the path cannot say
 * otherwise, and such a directory is a violation the project's own checker
 * reports.
 */

import { decode } from './encoding';

/** The modules of a node directory, by file name. */
const ROLES = new Map<string, Role>([
    ['Spec.lean', 'spec'],
    ['API.lean', 'api'],
    ['Helpers.lean', 'helpers'],
    ['Meta.lean', 'meta'],
]);

/** The module whose public declarations formalize the node. */
export const SPEC = 'Spec.lean';

/** The directory of a node's tests, whose modules may be named anything. */
export const TESTS = 'Tests';

/**
 * The reserved subtree. *Directories follow the blueprint hierarchy* exempts
 * it, so what is under it may be arranged as its own subject asks and nothing
 * in it is a node -- including a directory that happens to look like one.
 */
export const AUXILIARY = 'Auxiliary';

/** What a file is to the node it belongs to. */
export type Role = 'facade' | 'spec' | 'api' | 'helpers' | 'meta' | 'test';

/** What a path in the library filesystem turns out to be. */
export interface Node {
    /** The blueprint label, decoded from the file or directory name. */
    label: string;
    /** Which of the node's modules this path is. */
    role: Role;
}

/**
 * The node a path belongs to, if it is in the library filesystem.
 *
 * `segments` is the path split on `/`, of any length; only the last three
 * matter, beyond the `Auxiliary` that may be anywhere above. Anything else --
 * an auxiliary module, the root module, a source outside the library -- gives
 * `undefined`.
 */
export function nodeOfPath(segments: readonly string[]): Node | undefined {
    const file = segments[segments.length - 1];
    if (file === undefined || !file.endsWith('.lean')) {
        return undefined;
    }
    if (segments.slice(0, -1).includes(AUXILIARY)) {
        return undefined;
    }
    const parent = segments[segments.length - 2];
    const grandparent = segments[segments.length - 3];

    // `<node>/Tests/<anything>.lean`. A test module is named for what it
    // tests, not for the node, so the directory above it is what says which
    // node that is. Checked first, for the same reason: the file name here
    // carries no rule at all.
    if (parent === TESTS && grandparent !== undefined) {
        const label = decode(grandparent);
        return label === undefined ? undefined : { label, role: 'test' };
    }
    const role = ROLES.get(file);
    if (role !== undefined && parent !== undefined) {
        const label = decode(parent);
        return label === undefined ? undefined : { label, role };
    }
    // The facade, beside the node directory and named after it.
    const label = decode(file.slice(0, -'.lean'.length));
    return label === undefined ? undefined : { label, role: 'facade' };
}

/** As above, from a path with either separator. */
export function nodeOf(path: string): Node | undefined {
    return nodeOfPath(path.split(/[\\/]/));
}

/**
 * The line that opens the node's own section, if the file has one.
 *
 * A Spec whose body is wrapped in `section <label> … end <label>` gets a
 * symbol from Lean's own document symbol provider, and so a sticky scroll
 * header, without anything here contributing one. That is worth finding: it
 * is the line a reader sees when scrolled into the file, and so the line
 * worth marking.
 *
 * `namespace` counts too. It is the same gesture with a scope attached, and a
 * node that puts its declarations in a namespace of its own name has said the
 * same thing.
 */
export function sectionLineIn(
    lines: readonly string[],
    label: string,
): number | undefined {
    // The label is `[a-z0-9_]`, so it goes into the pattern as itself.
    const open = new RegExp(`^\\s*(?:section|namespace)\\s+${label}\\s*$`);
    const at = lines.findIndex((line) => open.test(line));
    return at < 0 ? undefined : at;
}

/** A `\label`, and the range that should be clickable. */
export interface Hit {
    /** What is between the braces. */
    label: string;
    /** Zero-based line. */
    line: number;
    /** Zero-based column where the clickable range begins. */
    start: number;
    /** Zero-based column one past where it ends. */
    end: number;
}

/**
 * `\label{...}` -- the prose side's half of the coupling.
 *
 * Line-local, because a `\label` does not wrap, and scanning line by line keeps
 * the columns trivially correct.
 */
const LABEL = /\\label\s*\{([^}\n]*)\}/g;

/**
 * A line with its comment removed.
 *
 * Truncating from the left leaves every column before the `%` where it was, so
 * a range measured in the result is a range in the line.
 */
export function uncommented(line: string): string {
    const at = line.search(/(^|[^\\])%/);
    return at < 0 ? line : line.slice(0, at === 0 ? 0 : at + 1);
}

/**
 * Every `\label` on one line.
 *
 * The range is the label text *excluding* the braces, so what gets underlined
 * is visibly the label rather than the whole command.
 *
 * A commented-out `\label` is not one: LaTeX does not read it, and neither does
 * the blueprint's own reader. Left in, it would win the index -- first match in
 * document order -- and send a reader to a line that is not a statement.
 */
export function texLabelsInLine(text: string, line: number): Hit[] {
    LABEL.lastIndex = 0;
    const out: Hit[] = [];
    const code = uncommented(text);
    for (let m = LABEL.exec(code); m !== null; m = LABEL.exec(code)) {
        const start = m.index + m[0].indexOf('{') + 1;
        out.push({ label: m[1], line, start, end: start + m[1].length });
    }
    return out;
}

/**
 * The `\label` whose braces contain `character`, if any.
 *
 * The braces sit just outside the range, so the test widens by one at each end
 * to reach them: pointing at one end of a label and not the other is the kind
 * of asymmetry nobody reports and everybody notices.
 */
export function texLabelAtInLine(
    text: string,
    line: number,
    character: number,
): Hit | undefined {
    return texLabelsInLine(text, line).find(
        (h) => character >= h.start - 1 && character <= h.end);
}

/** Every `\label` in a file. */
export function texLabelsIn(lines: string[]): Hit[] {
    return lines.flatMap((text, row) => texLabelsInLine(text, row));
}
