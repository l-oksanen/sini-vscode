// The PDF jump, driven outside VS Code with a stand-in for the `vscode` module.
//
// The assertion that matters is the off-by-one. Everything in this extension
// counts lines from one, as an editor does, and `latex-workshop.synctexto`
// wants zero-based -- its `toPDFFromRef` does `args.line += 1` before handing
// the number to SyncTeX. Getting that backwards lands the reader one line from
// the statement, which is close enough to look like it worked and wrong every
// time.
const Module = require('module');
const path = require('path');

const executed = [];
const shown = [];
let synctex = true;

const vscode = {
    Position: class { constructor(line, ch) { Object.assign(this, { line, ch }); } },
    Range: class { constructor(a, b) { Object.assign(this, { a, b }); } },
    commands: {
        registerCommand: (id, fn) => ({ id, fn }),
        executeCommand: async (...args) => { executed.push(args); },
        getCommands: async () => (synctex ? ['latex-workshop.synctexto', 'noise'] : ['noise']),
    },
    workspace: {
        // A document carries the path VS Code resolved, which is what gets
        // handed to LaTeX Workshop -- not the string we asked to open.
        openTextDocument: async (p) => ({ path: p, uri: { fsPath: p } }),
    },
    window: {
        activeTextEditor: {
            document: { path: '/home/x/proj/AutoIp/_part_2_reg/_ch_12_picard/_thm_picard/Spec.lean' },
            viewColumn: 1,
        },
        showTextDocument: async (doc, opts) => { shown.push({ doc, opts }); },
        showWarningMessage: async (m) => { shown.push({ warning: m }); },
    },
};

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    return request === 'vscode' ? 'vscode' : resolve.call(this, request, ...rest);
};
require.cache['vscode'] = { id: 'vscode', exports: vscode, loaded: true };

const links = require(path.join(__dirname, '..', 'out', 'links.js'));

let failed = 0;
function check(what, got, want) {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
        console.error(`FAILED: ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
        failed = 1;
    }
}

const TEX = '/home/x/proj/tex/funcanal.tex';

(async () => {
    await links.openInPdf({ path: TEX, line: 2583 });

    // One line lower than asked for, and the path VS Code resolved.
    check('the line handed to SyncTeX is zero-based',
          executed[0], ['latex-workshop.synctexto', 2582, TEX]);

    // The `.tex` is opened first and focused, because `synctexto` reads the
    // active editor and silently refuses when it is not a LaTeX document.
    check('the prose is opened at the statement', shown[0].doc.path, TEX);
    check('at the same one-based line, zero-based here',
          shown[0].opts.selection.a.line, 2582);
    check('as a preview tab, so repeated use does not accumulate tabs',
          shown[0].opts.preview, true);

    // And focus goes back where it came from: the reader asked to see the
    // statement in the PDF, not to be moved into a file they were not editing.
    check('focus returns to the Lean file',
          shown[1].doc.path, '/home/x/proj/AutoIp/_part_2_reg/_ch_12_picard/_thm_picard/Spec.lean');
    check('and the tab it returns to is not a preview', shown[1].opts.preview, false);

    // Without LaTeX Workshop the source is still opened at the right line, and
    // the reason the rest did not happen is said rather than left to be guessed.
    synctex = false;
    executed.length = 0;
    shown.length = 0;
    await links.openInPdf({ path: TEX, line: 2583 });
    check('nothing is executed without LaTeX Workshop', executed.length, 0);
    check('the prose is still opened', shown[0].doc.path, TEX);
    check('and it says why', typeof shown[1].warning, 'string');
    check('without stealing focus back, since nothing borrowed it', shown.length, 2);

    if (failed === 0) {
        console.log('ok: the PDF jump converts the line once, and degrades with a reason');
    }
    process.exit(failed);
})();
