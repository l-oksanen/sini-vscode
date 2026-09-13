/**
 * The label encoding of `data_model.md`, both directions.
 *
 * **This module never imports `vscode`.** It is one of the two parts another
 * extension consumes as a library, through the `sini-vscode-jump/encoding`
 * entry point, and a library that can only load inside an extension host is not
 * much of a library. It also makes the tests ordinary `require`s.
 *
 * Encoded labels are the library's filenames and directory names, so this is
 * what relates a `.lean` file to the node it formalizes. There is no annotation
 * to read: the path *is* the binding.
 *
 * Both directions return `undefined` rather than throwing. A blueprint with a
 * label the encoding does not admit, or a stray file under `defs/`, is a
 * project's own error; a jump that declines to resolve is the right response to
 * one, and an exception thrown out of a link provider is not.
 */

/** Characters the encoding preserves. */
const PLAIN = /^[a-z0-9_]$/;

/** An escape: an apostrophe and two uppercase hex digits, one UTF-8 byte. */
const ESCAPE = /^'([0-9A-F]{2})/;

export const PREFIX = '_';

/**
 * Is this a label the encoding admits?
 *
 * Uppercase is the whole of the restriction, and it is what keeps the encoding
 * bijective: folding case would map `A` and `a` to one name, and leaving `A-F`
 * unencoded would not be distinguishable from the hex digits of `'XX`.
 */
export function isLabel(label: string): boolean {
    return label.length > 0 && !/[A-Z]/.test(label);
}

/** The filename, without extension, that a node with this label has. */
export function encode(label: string): string | undefined {
    if (!isLabel(label)) {
        return undefined;
    }
    let out = PREFIX;
    for (const char of label) {
        if (PLAIN.test(char)) {
            out += char;
            continue;
        }
        for (const byte of new TextEncoder().encode(char)) {
            out += "'" + byte.toString(16).toUpperCase().padStart(2, '0');
        }
    }
    return out;
}

/**
 * The label a filename encodes, or `undefined` if `encode` could not have
 * produced it.
 *
 * Strict on purpose. An escape run is decoded as UTF-8 in one piece, because a
 * single character can span several bytes; an escape of a character the
 * encoding preserves is refused, because it would give that label two names.
 */
export function decode(name: string): string | undefined {
    if (!name.startsWith(PREFIX) || name.length === PREFIX.length) {
        return undefined;
    }
    const body = name.slice(PREFIX.length);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let out = '';
    let bytes: number[] = [];

    const flush = (): boolean => {
        if (bytes.length === 0) {
            return true;
        }
        try {
            out += decoder.decode(new Uint8Array(bytes));
        } catch {
            return false;
        }
        bytes = [];
        return true;
    };

    for (let i = 0; i < body.length; ) {
        const escape = ESCAPE.exec(body.slice(i));
        if (escape !== null) {
            const byte = parseInt(escape[1], 16);
            if (PLAIN.test(String.fromCharCode(byte))) {
                return undefined; // `encode` never escapes these
            }
            bytes.push(byte);
            i += 3;
            continue;
        }
        if (!flush()) {
            return undefined;
        }
        if (!PLAIN.test(body[i])) {
            return undefined; // a character `encode` never emits
        }
        out += body[i];
        i += 1;
    }
    return flush() ? out : undefined;
}
