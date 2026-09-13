/**
 * Which node a path belongs to, and which `\label` a line writes.
 *
 * **This module never imports `vscode`.** See `encoding.ts` for why.
 *
 * The library filesystem mirrors the blueprint, so a file's place in it says
 * what it formalizes:
 *
 *     <Lib>/<outer>/<inner>/defs/_def_clm.lean
 *     <Lib>/<outer>/<inner>/thms/_thm_svd.lean
 *     <Lib>/<outer>/<inner>/defs/_def_clm/NonVacuity.lean
 *
 * A node is recognised by the `defs`/`thms` directory above it rather than by
 * finding the library root first. The levels are configurable and either may be
 * absent, so the depth is not fixed and counting from the top would need the
 * configuration; counting from the bottom needs nothing, and the two reserved
 * directory names are not configurable.
 */

import { decode } from './encoding';

/** The two directories a node file sits directly under. */
export const KIND_DIRS = ['defs', 'thms'] as const;

/** Files that belong to a node without being it. */
export const SATELLITES = ['NonVacuity.lean', 'Examples.lean'] as const;

export type Kind = (typeof KIND_DIRS)[number];

/** What a path in the library filesystem turns out to be. */
export interface Node {
    /** The blueprint label, decoded from the directory or file name. */
    label: string;
    /** `defs` or `thms`, which is the node's kind. */
    kind: Kind;
    /** The satellite file name, when the path is one rather than the node itself. */
    satellite?: string;
}

function isKind(segment: string): segment is Kind {
    return (KIND_DIRS as readonly string[]).includes(segment);
}

/**
 * The node a path formalizes, if it is in the library filesystem.
 *
 * `segments` is the path split on `/`, of any length; only the last three
 * matter. Anything else -- a file under `Auxiliary`, the root module, a source
 * outside the library -- gives `undefined`.
 */
export function nodeOfPath(segments: readonly string[]): Node | undefined {
    const file = segments[segments.length - 1];
    if (file === undefined || !file.endsWith('.lean')) {
        return undefined;
    }
    const parent = segments[segments.length - 2];
    const grandparent = segments[segments.length - 3];

    if (parent !== undefined && isKind(parent)) {
        const label = decode(file.slice(0, -'.lean'.length));
        return label === undefined ? undefined : { label, kind: parent };
    }
    // `<node>/NonVacuity.lean`: the node is the directory.
    if (
        parent !== undefined &&
        grandparent !== undefined &&
        isKind(grandparent) &&
        (SATELLITES as readonly string[]).includes(file)
    ) {
        const label = decode(parent);
        return label === undefined
            ? undefined
            : { label, kind: grandparent, satellite: file };
    }
    return undefined;
}

/** As above, from a path with either separator. */
export function nodeOf(path: string): Node | undefined {
    return nodeOfPath(path.split(/[\\/]/));
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
 * Every `\label` on one line.
 *
 * The range is the label text *excluding* the braces, so what gets underlined
 * is visibly the label rather than the whole command.
 */
export function texLabelsInLine(text: string, line: number): Hit[] {
    LABEL.lastIndex = 0;
    const out: Hit[] = [];
    for (let m = LABEL.exec(text); m !== null; m = LABEL.exec(text)) {
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
