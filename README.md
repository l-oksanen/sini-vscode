# sini: Lean ⇄ LaTeX blueprint

Go from a statement in the blueprint to the Lean file that formalizes it, and
back to the statement in the PDF.

A *blueprint* pairs a LaTeX document with a Lean library: each statement in the
prose carries a `\label`, and the library holds one directory per label. The
correspondence is written in the filesystem, so this extension makes it
navigable without reading a single Lean declaration.

| where | gesture | goes to |
|---|---|---|
| `.tex` | ctrl+click `\label{thm_svd}` | `…/_thm_svd/Spec.lean` |
| `.lean` | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>, or the palette | the statement in the PDF |

That is the whole of it. Two jumps, and nothing else.

From a label in the PDF, ctrl+click in the viewer lands on the `\label` (LaTeX
Workshop's own reverse search), and ctrl+click there reaches the Lean. The same
two fingers carry a reader all the way round.

## The Lean side has nothing to click

Under an annotation-based blueprint the Lean file carries the label in an
attribute, and the jump hangs off that text. Here the *directory* is the label,
and the file inside it is named for its role:

    AutoIp/_part_1_funcanal/_ch_08_svd/_thm_svd/Spec.lean
                                       ^^^^^^^^
                                       \label{thm_svd}

So there is nothing in the text to point at, and the file name — `Spec.lean`,
`Meta.lean`, `NonVacuity.lean` — says what the file does rather than
which node it is in. The jump is therefore a key —
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>, <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>
on a Mac — or **sini: Show this node's statement in the PDF** in the command
palette. It works from every module of the node directory, the facade
included: a reader in any of them has the same question.

The jump opens the blueprint source at the statement, asks LaTeX Workshop to
sync the viewer to it, and returns focus to the Lean file. It needs a PDF
already built with SyncTeX data, so compile the blueprint once first. Without
LaTeX Workshop the source is still opened at the right line, and the extension
says why the rest did not happen.

## It needs no build and no tools

Both directions are answered by the filesystem. A node's Spec is found by
encoding the label and looking for the directory; a node's statement is found
by scanning the blueprint for the `\label`. Nothing is compiled, no external
program runs, and a project that has never been built navigates exactly as well
as one that has.

The scan follows the document rather than globbing: `blueprint/blueprint.tex`
and whatever it `\input`s or `\include`s, transitively, which is what the data
model means by the blueprint. That is cheaper than reading every `.tex` in the
workspace, and more correct — a paper draft elsewhere in the repository has
`\label`s of its own, and one of them shadowing a node's would be a jump that
lands in the wrong document with nothing to show it did. A commented-out
`\label` is not read, for the same reason LaTeX does not read it.

The scan is cached per workspace folder and redone when a `.tex` or `.lean` file
changes on disk. An open unsaved editor is read from the editor rather than from
disk, so a label you have just typed is found as soon as the index is next
rebuilt.

## Gating

Everything is off unless the workspace folder has **`blueprint/blueprint.tex`**,
which is where the data model says a blueprint is. One `stat` decides it.

That matters mostly for the `.tex` side: a `\label` is ordinary LaTeX that most
projects have never heard of this extension about, and underlining every one of
them to then resolve none is worse than doing nothing.

A `\label` that no node answers — an equation, a part, a chapter, a node not yet
formalized — simply does not resolve. The link is left pointing nowhere rather
than somewhere wrong. In a real 227-node project that is 94 of 321 labels, and
every one of them is a part, a chapter, a conventions block or an equation.

## What counts as a node

The library filesystem mirrors the blueprint hierarchy, with at most two
organizational levels, and a node is a *directory* holding the modules that
formalize it:

    <LeanLibrary>/
      <outer>/
        <inner>/
          _thm_svd.lean               the facade, which other modules import
          _thm_svd/
            Spec.lean                 the statement
            API.lean
            Helpers.lean
            Meta.lean
    <LeanLibrary>Tests/
      <outer>/
        <inner>/
          _thm_svd/
            NonVacuity.lean           the node's tests, at the node's own path

Either level may be absent, so the depth is not fixed. A node is therefore
recognised from the bottom: by the role its file name names, by being the
`_`-prefixed file beside a node directory, or by the tests directory the
encoded directories above it stand in.
Counting from the bottom needs no configuration, and those names are not
configurable; counting from the top would need the project's own list of
levels. `Auxiliary`, the two roots, and anything outside the library are not
nodes, and the jump says so rather than guessing.

The levels are labelled too — `_part_1_funcanal`, `_ch_08_svd` — so their
directories are named exactly as a node's is, and what tells them apart is that
a level instance holds no `Spec.lean`. A Spec written under one is read as that
level's: the path cannot say otherwise, and such a directory is a violation the
project's own checker reports.

Ctrl+click lands on `Spec.lean`, not on the facade. The facade is generated and
holds nothing but a `public import`; the Spec is the statement, which is what
the reader coming from the prose asked for.

*Labels are simple* restricts a label to `a`-`z`, `0`-`9` and `_`, so the
encoding is a prefix and nothing else: `\label{thm_svd}` is `_thm_svd`. The `_`
is what keeps an encoded name clear of a Lean keyword and of the reserved
`Spec` and `Auxiliary`, and of the tests directory. Decoding is strict: a name the encoding could
not have produced is not treated as a node, so a stray file in a node directory
is ignored rather than misread.

## Requirements

- [`leanprover.lean4`](https://marketplace.visualstudio.com/items?itemName=leanprover.lean4),
  for the `lean4` language the key attaches to.
- [`james-yu.latex-workshop`](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop),
  for the jump into the PDF. Optional: without it, everything else still works
  and the jump opens the `.tex` at the statement.

## Settings

| setting | default | |
|---|---|---|
| `sini.exclude` | `**/{.lake,.git,node_modules}/**` | files not searched |

`.lake` matters. A project's Lake packages hold every Mathlib source, and
searching them would cost far more than the rest of the workspace put together.

## Keys

| command | key | |
|---|---|---|
| `sini.showInPdf` | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd> | show this node's statement in the PDF |

Bound only while a Lean file is focused, so it takes
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd> away from nothing else — LaTeX
Workshop's build, for one, claims it in `.tex` files and keeps it. Rebind under
*Preferences: Open Keyboard Shortcuts*, searching for `sini`.

## Installing it from the working tree

```sh
scripts/install.sh        # or npm run link
scripts/uninstall.sh      # or npm run unlink
```

The install is a symlink from VS Code's extensions directory to this
repository, so what VS Code loads is the working tree: an edit needs a compile
and **Developer: Reload Window**, and no repackaging. The link alone is not
enough: VS Code loads only what is registered in
`~/.vscode/extensions/extensions.json`, and at startup marks any other
directory there for removal in `.obsolete`. So the script registers the link
under the extension's id and version, and refuses to run while VS Code does,
since VS Code rewrites that file from memory. A new `version` needs the script
run again.

Two more things matter. `main` points into `out/`, which is generated and
git-ignored, so the script compiles before linking — and `npm run clean` while
VS Code is running leaves the extension without its code until the next
compile. And an install of the same *id* already there, unpacked from a
`.vsix`, would be a second extension claiming one identity: the script stops
and asks you to `code --uninstall-extension l-oksanen.sini-vscode`, or
takes `--force`.

`--extensions DIR`, or `VSCODE_EXTENSIONS`, installs somewhere else —
`~/.vscode-insiders/extensions`, say. The uninstall removes only a symlink and
its registry entry; a directory is VS Code's own install and VS Code's to
remove.

## Developing

```sh
npm install
npm test          # compiles, then runs all three suites
```

Press <kbd>F5</kbd> to open an Extension Development Host, then open a blueprint
project in it and ctrl+click a `\label`.

All three suites run outside VS Code, which is the point — nothing worth pinning
needs an editor:

- `test/encoding.test.js` — the encoding round-trips, and refuses every name it
  could not have produced. Uppercase is refused rather than folded, which is
  what keeps the encoding bijective, and the escapes of the older encoding are
  refused with it.
- `test/nodes.test.js` — a path names its node at every configured depth and in
  every role, the reserved subtree is not one, and a label is clickable at
  either brace but not on the command or in a comment.
- `test/links.test.js` — the jump targets the right line. Everything here counts
  from one, as an editor does, and `latex-workshop.synctexto` wants zero-based,
  so this pins the conversion: off by one lands a reader beside the statement,
  which looks like it worked.
