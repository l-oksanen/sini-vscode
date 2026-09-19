/**
 * The label encoding of the data model, both directions.
 *
 * **This module never imports `vscode`.** It is one of the two parts another
 * extension consumes as a library, through the `sini-vscode-jump/encoding`
 * entry point, and a library that can only load inside an extension host is not
 * much of a library. It also makes the tests ordinary `require`s.
 *
 * Encoded names are the library's directory and file names, so this is what
 * relates a `.lean` file to the node it formalizes. There is no annotation to
 * read: the path *is* the binding.
 *
 * The encoding is a prefix and nothing else. *Labels are simple* restricts a
 * label to `a`-`z`, `0`-`9` and `_`, which is already a Lean name and a file
 * name, so there is nothing to escape or translate; the `_` keeps an encoded
 * name clear of a Lean keyword and of the reserved `Spec`, `Tests` and
 * `Auxiliary`.
 *
 * Both directions return `undefined` rather than throwing. A blueprint with a
 * label the encoding does not admit, or a stray file in a node directory, is a
 * project's own error; a jump that declines to resolve is the right response to
 * one, and an exception thrown out of a link provider is not.
 */

/** A label the data model admits. */
const LABEL = /^[a-z0-9_]+$/;

export const PREFIX = '_';

/**
 * Is this a label the encoding admits?
 *
 * The restriction is what makes the encoding bijective, and it is the data
 * model's own: an uppercase letter is refused rather than folded, because
 * folding would map `A` and `a` to one name.
 */
export function isLabel(label: string): boolean {
    return LABEL.test(label);
}

/** The name, without extension, that a node with this label has. */
export function encode(label: string): string | undefined {
    return isLabel(label) ? PREFIX + label : undefined;
}

/**
 * The label a name encodes, or `undefined` if `encode` could not have produced
 * it.
 *
 * Strict on purpose: a name that is not an encoded label is not treated as a
 * node, so a stray file in the library filesystem is ignored rather than
 * misread.
 */
export function decode(name: string): string | undefined {
    if (!name.startsWith(PREFIX)) {
        return undefined;
    }
    const label = name.slice(PREFIX.length);
    return isLabel(label) ? label : undefined;
}
