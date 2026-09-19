// Which node a path belongs to, and which `\label` a line writes.
const path = require('path');
const {
    nodeOf,
    sectionLineIn,
    texLabelAtInLine,
    texLabelsIn,
    uncommented,
} = require(path.join(__dirname, '..', 'out', 'nodes.js'));

let failed = 0;
function check(what, got, want) {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
        console.error(`FAILED: ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
        failed = 1;
    }
}

// ------------------------------------------------- paths

// Two levels, one level, and none: the depth is not fixed, which is why the
// node is recognised from the bottom rather than by finding the library root.
check('two levels', nodeOf('AutoIp/_part_1_fa/_ch_01_ops/_def_clm/Spec.lean'),
    { label: 'def_clm', role: 'spec' });
check('one level', nodeOf('AutoIp/_ch_08_svd/_thm_svd/Spec.lean'),
    { label: 'thm_svd', role: 'spec' });
check('flat', nodeOf('AutoIp/_def_clm/Spec.lean'),
    { label: 'def_clm', role: 'spec' });
check('absolute path', nodeOf('/home/me/p/AutoIp/_thm_svd/Spec.lean'),
    { label: 'thm_svd', role: 'spec' });
check('windows separators', nodeOf('AutoIp\\_thm_svd\\Spec.lean'),
    { label: 'thm_svd', role: 'spec' });

// Every module of a node directory belongs to the node the directory names,
// and says which of them it is.
const DIR = 'AutoIp/_part_1_fa/_ch_08_svd';
for (const [file, role] of [
    ['_thm_svd.lean', 'facade'],
    ['_thm_svd/Spec.lean', 'spec'],
    ['_thm_svd/API.lean', 'api'],
    ['_thm_svd/Helpers.lean', 'helpers'],
    ['_thm_svd/Meta.lean', 'meta'],
    // A test is named for what it tests, so any name in `Tests` is one.
    ['_thm_svd/Tests/NonVacuity.lean', 'test'],
    ['_thm_svd/Tests/Rank.lean', 'test'],
]) {
    check(`role of ${file}`, nodeOf(`${DIR}/${file}`), { label: 'thm_svd', role });
}

// A level instance's directory is named like a node's, and only what it holds
// tells them apart -- a level has no Spec -- so a Spec written under one is
// read as that level's. The path cannot say otherwise, and the project's own
// checker is what reports the directory.
check('a Spec under a level instance', nodeOf('AutoIp/_part_1_fa/_ch_08_svd/Spec.lean'),
    { label: 'ch_08_svd', role: 'spec' });

// Everything else in the tree is not a node.
for (const other of [
    'AutoIp/Auxiliary/Geometric.lean',
    'AutoIp/Auxiliary/_thm_svd/Spec.lean',  // the reserved subtree, exempt from the layout
    'AutoIp.lean',                          // the root module
    'AutoIpTests.lean',
    'AutoIp/_part_1_fa/_ch_08_svd/_thm_svd/Other.lean',  // no role the model gives
    'AutoIp/_part_1_fa/_ch_08_svd/_thm_svd/Spec.olean',
    'blueprint/blueprint.tex',
]) {
    check(`not a node: ${other}`, nodeOf(other), undefined);
}

// ------------------------------------------------- the node's own section

// A Spec whose body is wrapped in `section <label>` gets a symbol from Lean's
// own provider, and so a sticky scroll header. That line is what a reader
// sees when scrolled into the file, so it is the line worth marking.
const spec = [
    '/-',
    'Copyright (c) 2026 Tapio Helin. All rights reserved.',
    '-/',
    'module',
    '',
    'public import Mathlib.Topology.Algebra.Module.Spaces.ContinuousLinearMap',
    'import Cite.Attribute',
    '',
    'section lem_clm_complete',
    '',
    'attribute [cite] ContinuousLinearMap.instCompleteSpace',
    '',
    'end lem_clm_complete',
];
check('the section that opens', sectionLineIn(spec, 'lem_clm_complete'), 8);
check('and not the one that closes',
    sectionLineIn(['end lem_clm_complete'], 'lem_clm_complete'), undefined);
check('a namespace counts, being the same gesture with a scope',
    sectionLineIn(['namespace thm_svd'], 'thm_svd'), 0);
check('indented', sectionLineIn(['  section thm_svd  '], 'thm_svd'), 0);

// A section of another name is another section: the file may hold several,
// and only the node's own is the node's.
for (const other of [
    'section other',
    'section thm_svd_extra',
    'section thm_svd.inner',
    'sections thm_svd',
    'section',
    '-- section thm_svd',
    'section thm_svd where',
]) {
    check(`not the node's section: ${other}`, sectionLineIn([other], 'thm_svd'), undefined);
}
check('a file without one', sectionLineIn(['module', 'theorem x : True := trivial'], 'thm_svd'),
    undefined);

// ------------------------------------------------- `\label`

const lines = [
    '\\begin{definition}[Bounded operators]',
    '  \\label{def_clm}',
    '  Let \\(T\\) be \\ldots \\label{eq_clm} and \\label{def_other}.',
];
check('every label', texLabelsIn(lines).map((h) => h.label),
    ['def_clm', 'eq_clm', 'def_other']);
check('label position', texLabelsIn(lines)[0],
    { label: 'def_clm', line: 1, start: 9, end: 16 });
check('spaced command', texLabelsIn(['\\label {def_clm}']).map((h) => h.label),
    ['def_clm']);

// A commented-out `\label` is not one. Left in, it would win the index --
// first match in document order -- and send a reader to a line of prose that
// was deliberately not written.
check('commented out', texLabelsIn(['% \\label{def_clm}']).map((h) => h.label), []);
check('commented mid-line',
    texLabelsIn(['\\label{a} % \\label{b}']).map((h) => h.label), ['a']);
check('an escaped percent is not a comment',
    texLabelsIn(['50\\% \\label{def_clm}']).map((h) => h.label), ['def_clm']);
check('a comment does not move the columns before it',
    texLabelsIn(['\\label{a} % x'])[0].start, 7);
check('uncommented', uncommented('a\\%b %c'), 'a\\%b ');

// Pointed at, and only at, its own text -- braces included, so that both ends
// of the label behave the same way.
const line = '  \\label{def_clm}';
const at = (col) => {
    const hit = texLabelAtInLine(line, 0, col);
    return hit === undefined ? undefined : hit.label;
};
check('on the text', at(line.indexOf('def_clm')), 'def_clm');
check('on the open brace', at(line.indexOf('{')), 'def_clm');
check('on the close brace', at(line.indexOf('}')), 'def_clm');
check('on the command', at(line.indexOf('\\')), undefined);
check('past the end', at(line.length), undefined);

if (failed === 0) {
    console.log('ok: a path names its node, and a label is clickable at either brace');
}
process.exit(failed);
