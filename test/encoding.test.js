// The label encoding, exercised as an ordinary library.
//
// No stand-in for `vscode` here, and that is the point: `encoding.ts` imports
// nothing from the editor, so this is the same `require` a consumer of the
// `sini-vscode-jump/encoding` entry point makes.
const path = require('path');
const { decode, encode, isLabel } = require(
    path.join(__dirname, '..', 'out', 'encoding.js'));

let failed = 0;
function check(what, got, want) {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
        console.error(`FAILED: ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
        failed = 1;
    }
}

// ------------------------------------------------- the worked examples

for (const [label, name] of [
    ['def:foo/bar', "_def'3Afoo'2Fbar"],
    ['def_foo_bar', '_def_foo_bar'],
    ['thm:main-result', "_thm'3Amain'2Dresult"],
    ['thm_main_result', '_thm_main_result'],
]) {
    check(`encode ${label}`, encode(label), name);
    check(`decode ${name}`, decode(name), label);
}

// ------------------------------------------------- round trips

for (const label of [
    'def_clm', 'thm:cauchy-schwarz', 'a', '0', '_', 'x.y', "it's",
    'äänekoski', '∞', 'a b', 'x{y}',
]) {
    check(`round trip ${label}`, decode(encode(label)), label);
}

// A character outside the BMP: two bytes is the common case, four is the one
// that catches a decoder splitting an escape run per escape.
check('astral round trip', decode(encode('a𝕜b')), 'a𝕜b');
check('astral encoding', encode('𝕜'), "_'F0'9D'95'9C");

// ------------------------------------------------- what is refused

// Uppercase is what keeps the encoding bijective; a label with one is an error
// rather than something to fold.
check('uppercase label', encode('Foo'), undefined);
check('uppercase mid-label', encode('def_fun_calc_Y'), undefined);
check('empty label', encode(''), undefined);
check('isLabel', [isLabel('foo'), isLabel('Foo'), isLabel('')], [true, false, false]);

for (const bad of [
    'def_foo',   // no prefix
    '_',         // empty body
    "_a'2",      // truncated escape
    "_a'2g",     // not hex
    "_a'2d",     // lowercase hex: `encode` emits uppercase
    "_a'61",     // escapes `a`, which encodes as itself
    '_a-b',      // a character `encode` never emits
    "_'FF",      // not UTF-8
    '_Foo',      // uppercase is never produced
]) {
    check(`decode refuses ${bad}`, decode(bad), undefined);
}

// The prefix is what keeps an encoded name clear of the reserved directories.
for (const reserved of ['defs', 'thms', 'Auxiliary', 'NonVacuity', 'Examples']) {
    check(`${reserved} is not an encoded label`, decode(reserved), undefined);
}

// `.` must not introduce a module component.
check('dot is escaped', encode('a.b').includes('.'), false);

if (failed === 0) {
    console.log('ok: the encoding round-trips, and refuses what it cannot have made');
}
process.exit(failed);
