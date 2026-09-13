# sini: Lean ⇄ LaTeX blueprint jump

Go from a statement in the blueprint to the Lean file that formalizes it, and
back to the statement in the PDF.

A *blueprint* pairs a LaTeX document with a Lean library: each statement in the
prose carries a `\label`, and the library holds one file per label. The
correspondence is written in the filesystem, so this extension makes it
navigable without reading a single Lean declaration.

| where | gesture | goes to |
|---|---|---|
| `.tex` | ctrl+click `\label{thm_svd}` | `…/thms/_thm_svd.lean` |
| `.lean` | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>, or the palette | the statement in the PDF |

That is the whole of it. Two jumps, no decoration.

From a label in the PDF, ctrl+click in the viewer lands on the `\label` (LaTeX
Workshop's own reverse search), and ctrl+click there reaches the Lean. The same
two fingers carry a reader all the way round.

## The Lean side has nothing to click

Under an annotation-based blueprint the Lean file carries the label in an
attribute, and the jump hangs off that text. Here the file *is* the label:

    AutoIp/_part_2_reg/_ch_11_moore_penrose/defs/_def_moore_penrose.lean
                                                 ^^^^^^^^^^^^^^^^^^^^^^
                                                 \label{def_moore_penrose}

So there is nothing to point at, and nothing that needs pointing at: the
filename already says which node you are in. The jump is therefore a key —
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>, <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>
on a Mac — or **sini: Show this node's statement in the PDF** in the command
palette. It works from `NonVacuity.lean` and `Examples.lean` too, which belong
to the node beside them.

It opens the blueprint source at the statement, asks LaTeX Workshop to sync the
viewer to it, and returns focus to the Lean file. It needs a PDF already built
with SyncTeX data, so compile the blueprint once first. Without LaTeX Workshop
the source is still opened at the right line, and the extension says why the
rest did not happen.

## It needs no build and no tools

Both directions are answered by the filesystem. A node's file is found by
encoding the label and looking for the name; a node's statement is found by
scanning the blueprint for the `\label`. Nothing is compiled, no external
program runs, and a project that has never been built navigates exactly as well
as one that has.

The scan follows the document rather than globbing: `blueprint/blueprint.tex`
and whatever it `\input`s, transitively. That is cheaper than reading every
`.tex` in the workspace, and more correct — a paper draft elsewhere in the
repository has `\label`s of its own, and one of them shadowing a node's would be
a jump that lands in the wrong document with nothing to show it did. `\input` is
what the data model specifies, so `\include` is not followed.

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

The library filesystem mirrors the blueprint, with at most two organizational
levels and the nodes split by kind:

    <LeanLibrary>/
      <outer>/
        <inner>/
          defs/_def_clm.lean
          thms/_thm_svd.lean
                 _thm_svd/NonVacuity.lean

Either level may be absent, so the depth is not fixed. A node is therefore
recognised by the `defs` or `thms` directory *above* it rather than by locating
the library root: counting from the bottom needs no configuration, and those two
names are not configurable. `Auxiliary`, the root module, and anything outside
the library are not nodes, and the jump says so rather than guessing.

The filename is the label under the encoding of the data model — `_` prefix,
`[a-z0-9_]` preserved, everything else `'XX` in uppercase hex UTF-8 — so
`\label{thm:main-result}` is `_thm'3Amain'2Dresult.lean`. Decoding is strict: a
name the encoding could not have produced is not treated as a node, so a stray
file under `defs/` is ignored rather than misread.

## Requirements

- [`leanprover.lean4`](https://marketplace.visualstudio.com/items?itemName=leanprover.lean4),
  for the `lean4` language the command is offered in.
- [`james-yu.latex-workshop`](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop),
  for the jump into the PDF. Optional: without it, everything else still works
  and the jump opens the `.tex` at the statement.

## Settings

| setting | default | |
|---|---|---|
| `siniJump.exclude` | `**/{.lake,.git,node_modules}/**` | files not searched |

`.lake` matters. A project's Lake packages hold every Mathlib source, and
searching them would cost far more than the rest of the workspace put together.

## Keys

| command | key | |
|---|---|---|
| `siniJump.showInPdf` | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd> | show this node's statement in the PDF |

Bound only while a Lean file is focused, so it takes
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd> away from nothing else — LaTeX
Workshop's build, for one, claims it in `.tex` files and keeps it. Rebind under
*Preferences: Open Keyboard Shortcuts*, searching for `siniJump`.

## As a library

The two parts that import nothing from the editor are published as subpaths:

```ts
import { decode, encode } from 'sini-vscode-jump/encoding';
import { nodeOf, texLabelsIn } from 'sini-vscode-jump/nodes';
```

They work on plain strings and return plain values, so they load and test
outside an extension host.

## Developing

```sh
npm install
npm test          # compiles, then runs all three suites
```

Press <kbd>F5</kbd> to open an Extension Development Host, then open a blueprint
project in it and ctrl+click a `\label`.

All three suites run outside VS Code, which is the point — nothing worth pinning
needs an editor:

- `test/encoding.test.js` — the encoding round-trips, including a character
  outside the BMP, and refuses every name it could not have produced. Uppercase
  is refused rather than folded, which is what keeps the encoding bijective.
- `test/nodes.test.js` — a path names its node at every configured depth, a
  satellite belongs to the directory above it, and a label is clickable at
  either brace but not on the command.
- `test/links.test.js` — the jump targets the right line. Everything here counts
  from one, as an editor does, and `latex-workshop.synctexto` wants zero-based,
  so this pins the conversion: off by one lands a reader beside the statement,
  which looks like it worked.
