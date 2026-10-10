// The label encoding, exercised as an ordinary library.
//
// No stand-in for `vscode` here, and that is the point: `encoding.ts` imports
// nothing from the editor, so it loads with an ordinary `require`.
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

// ------------------------------------------------- the whole of the encoding

for (const [label, name] of [
    ['def_clm', '_def_clm'],
    ['thm_main_result', '_thm_main_result'],
    ['part_1_funcanal', '_part_1_funcanal'],
    ['a', '_a'],
    ['0', '_0'],
    // A label may itself begin with `_`, and then the name has two: the prefix
    // is added, never merged, which is what keeps the two directions inverse.
    ['_x', '__x'],
]) {
    check(`encode ${label}`, encode(label), name);
    check(`decode ${name}`, decode(name), label);
    check(`round trip ${label}`, decode(encode(label)), label);
}

// ------------------------------------------------- what is refused

// *Labels are simple* admits `a`-`z`, `0`-`9` and `_`, and nothing else: there
// is no escape to fall back on, so a label outside that is not encodable at
// all.
for (const bad of [
    'Foo',                 // uppercase, which folding would make ambiguous
    'def_fun_calc_Y',
    'def:foo/bar',         // the punctuation an older encoding escaped
    'thm:main-result',
    'x.y',                 // `.` would introduce a module component
    "it's",
    'a b',
    'äänekoski',
    '𝕜',
    '',
]) {
    check(`encode refuses ${bad}`, encode(bad), undefined);
    check(`isLabel ${bad}`, isLabel(bad), false);
}
check('isLabel', [isLabel('def_clm'), isLabel('_'), isLabel('0')], [true, true, true]);

for (const bad of [
    'def_clm',             // no prefix
    '_',                   // empty body
    '_Foo',                // uppercase is never produced
    '_a-b',                // a character `encode` never emits
    "_thm'3Amain'2Dresult",  // the escapes of the older encoding
    '_a.b',
]) {
    check(`decode refuses ${bad}`, decode(bad), undefined);
}

// The prefix is what keeps an encoded name clear of the reserved names: no
// encoded name can equal one of these, so no file of a node directory can be
// mistaken for a node.
for (const reserved of ['Spec.lean', 'API', 'Helpers', 'Meta', 'Tests', 'Auxiliary']) {
    check(`${reserved} is not an encoded label`, decode(reserved), undefined);
}

if (failed === 0) {
    console.log('ok: the encoding round-trips, and refuses what it cannot have made');
}
process.exit(failed);
