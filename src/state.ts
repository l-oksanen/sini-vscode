/**
 * What a node's state file says, and which style a node gets from it.
 *
 * **This module never imports `vscode`.** See `encoding.ts` for why.
 *
 * The state of a node -- formalized, sorry-free, attested -- is not something
 * this extension can know: it is what a checker reports after reading the
 * compiled library. So it is read from a file the project writes, and this
 * module only says what that file means.
 *
 *     {
 *       "palette": {
 *         "formalized": "#1f3a1f",
 *         "sorry":      { "background": "#5a2d2d", "foreground": "#ffffff" }
 *       },
 *       "nodes": {
 *         "thm_svd":         "formalized",
 *         "def_clm":         "sorry",
 *         "_part_1_funcanal": "#1f3a5f"
 *       }
 *     }
 *
 * A value in `nodes` is a key of the palette, or, when the palette has no such
 * key, a colour of its own. One rule, so a file can be written either way: a
 * generator emits state names against a palette, and a hand-written file can
 * name a colour and skip the ceremony.
 *
 * A key is a label or a path segment. A label is exact and wins; a segment --
 * `_part_1_funcanal`, `_ch_08_svd` -- colours every node under it, and the
 * longest matching one wins, so a chapter overrides its part and a node
 * overrides both.
 *
 * Nothing here throws. A state file is generated, which is to say it is
 * sometimes half-written, and a malformed one should cost a reader their
 * colours rather than their editor.
 */

/** How a label is painted. */
export interface Style {
    background?: string;
    foreground?: string;
    /** The palette key, when the file named one: a state has a name, a colour has not. */
    name?: string;
}

/** A state file, once read. */
export interface States {
    /** state name -> style. */
    palette: Map<string, Style>;
    /** label or path segment -> a palette key, or a colour. */
    nodes: Map<string, string>;
}

export const EMPTY: States = { palette: new Map(), nodes: new Map() };

function styles(value: unknown): Style | undefined {
    if (typeof value === 'string') {
        return { background: value };
    }
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    const pick = (key: string): string | undefined =>
        (typeof record[key] === 'string' ? (record[key] as string) : undefined);
    return { background: pick('background'), foreground: pick('foreground') };
}

/** A state file's text, as far as it can be read. */
export function parse(text: string): States {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return EMPTY;
    }
    if (typeof data !== 'object' || data === null) {
        return EMPTY;
    }
    const record = data as Record<string, unknown>;
    const palette = new Map<string, Style>();
    const nodes = new Map<string, string>();

    const from = record['palette'];
    if (typeof from === 'object' && from !== null) {
        for (const [name, value] of Object.entries(from)) {
            const style = styles(value);
            if (style !== undefined) {
                palette.set(name, style);
            }
        }
    }
    const to = record['nodes'];
    if (typeof to === 'object' && to !== null) {
        for (const [key, value] of Object.entries(to)) {
            if (typeof value === 'string') {
                nodes.set(key, value);
            }
        }
    }
    return { palette, nodes };
}

/**
 * The style for a node, or `undefined` when the file says nothing about it.
 *
 * `segments` is the node's path, split, so a part or a chapter can colour
 * everything beneath it.
 */
export function styleOf(
    states: States,
    label: string,
    segments: readonly string[] = [],
): Style | undefined {
    const value = states.nodes.get(label) ?? longest(states, segments);
    if (value === undefined) {
        return undefined;
    }
    // A palette key if the palette has one, and otherwise a colour: a file
    // that never declares a palette still works, and a state name that is
    // not in the palette shows as itself rather than silently as nothing.
    const style = states.palette.get(value);
    return style === undefined ? { background: value } : { ...style, name: value };
}

/**
 * What the chip says, or `undefined` when it has nothing to add.
 *
 * The rule is that the chip says what its line does not. On a section line the
 * label is already written in the code, so the chip is for the state; where
 * the state file gave a colour and no name there is nothing to write and the
 * chip is a swatch; where it said neither, a second copy of the label is not
 * worth the ink. Off a section line nothing names the node, which is the whole
 * reason for the chip, so it says the label.
 *
 * A node the blueprint does not write is the exception, and outranks all of
 * it. That is a library directory the prose has lost -- a real fault, and one
 * nothing else in the editor reports -- so it is what the chip says, and the
 * state can wait until the node is in the blueprint again.
 */
export function chip(
    label: string,
    style: Style | undefined,
    onSection: boolean,
    inBlueprint: boolean,
): string | undefined {
    if (!inBlueprint) {
        return onSection ? 'not in the blueprint' : `${label} is not in the blueprint`;
    }
    if (!onSection) {
        return label;
    }
    if (style?.name !== undefined) {
        return style.name;
    }
    return style?.background === undefined ? undefined : ' ';
}

/** The most specific path segment the file names, which is the deepest one. */
function longest(states: States, segments: readonly string[]): string | undefined {
    for (let i = segments.length - 1; i >= 0; i--) {
        const value = states.nodes.get(segments[i]);
        if (value !== undefined) {
            return value;
        }
    }
    return undefined;
}
