// Which node a path belongs to, and which `\label` a line writes.
const path = require('path');
const {
    nodeOf,
    texLabelAtInLine,
    texLabelsIn,
} = require(path.join(__dirname, '..', 'out', 'nodes.js'));

let failed = 0;
function check(what, got, want) {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
        console.error(`FAILED: ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
        failed = 1;
    }
}

// ------------------------------------------------- paths

// Two levels, one level, and none: the depth is configurable, which is why the
// `defs`/`thms` directory is counted from the bottom rather than the top.
check('two levels', nodeOf('AutoIp/_part_1_fa/_ch_01_ops/defs/_def_clm.lean'),
    { label: 'def_clm', kind: 'defs' });
check('one level', nodeOf('AutoIp/_ch_01_ops/thms/_thm_svd.lean'),
    { label: 'thm_svd', kind: 'thms' });
check('flat', nodeOf('AutoIp/defs/_def_clm.lean'),
    { label: 'def_clm', kind: 'defs' });
check('absolute path', nodeOf('/home/me/p/AutoIp/thms/_thm_svd.lean'),
    { label: 'thm_svd', kind: 'thms' });
check('windows separators', nodeOf('AutoIp\\thms\\_thm_svd.lean'),
    { label: 'thm_svd', kind: 'thms' });

// A satellite belongs to the node named by its directory, not by its own name.
check('non-vacuity', nodeOf('AutoIp/defs/_def_clm/NonVacuity.lean'),
    { label: 'def_clm', kind: 'defs', satellite: 'NonVacuity.lean' });
check('examples', nodeOf('AutoIp/defs/_def_clm/Examples.lean'),
    { label: 'def_clm', kind: 'defs', satellite: 'Examples.lean' });

// An escaped label, which is what a blueprint that does not use `_` produces.
check('escaped label', nodeOf("AutoIp/thms/_thm'3Amain'2Dresult.lean"),
    { label: 'thm:main-result', kind: 'thms' });

// Everything else in the tree is not a node.
for (const other of [
    'AutoIp/Auxiliary/Geometric.lean',
    'AutoIp.lean',
    'AutoIp/defs/Helper.lean',          // no prefix, so not an encoded label
    'AutoIp/other/_def_clm.lean',       // not under defs/thms
    'AutoIp/defs/_def_clm/Other.lean',  // not a satellite the model knows
    'blueprint/blueprint.tex',
    'AutoIp/defs/_def_clm.olean',
]) {
    check(`not a node: ${other}`, nodeOf(other), undefined);
}

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
