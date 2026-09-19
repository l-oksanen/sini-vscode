# sini: Lean ⇄ LaTeX blueprint jump

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

That is the whole of it: two jumps, and the label saying which node you are
in, in the colour the project's own state file gives it.

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
`Meta.lean`, `Tests/NonVacuity.lean` — says what the file does rather than
which node it is in. The jump is therefore a key —
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>, <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>B</kbd>
on a Mac — or **sini: Show this node's statement in the PDF** in the command
palette. It works from every module of the node directory, the facade
included: a reader in any of them has the same question.

Which node that is, the chip says. Nothing is clickable there — a decoration
carries no command, and a hover will not attach to one either — so the label
is shown in one place and the jump lives on the key, rather than a lens
repeating the label to be clickable.

The jump opens the blueprint source at the statement, asks LaTeX Workshop to
sync the viewer to it, and returns focus to the Lean file. It needs a PDF
already built with SyncTeX data, so compile the blueprint once first. Without
LaTeX Workshop the source is still opened at the right line, and the extension
says why the rest did not happen.

## The label, and what colour it is

The chip is drawn at the end of a line — which line is the next section's
business — as an editor decoration. That is what makes it colourable: a
decoration is the only thing in VS Code that takes an arbitrary background. A
status bar item's is restricted to two theme colours, a file decoration
colours foreground only, and a code lens takes no styling at all.

The colour says what the project knows about the node, which this extension
cannot: whether it is formalized, reaches a `sorry`, rests on a citation. So it
is read from a file the project writes, named by `siniJump.state` and
`.vscode/sini-state.json` by default:

```json
{
  "palette": {
    "formalized": "#1f3a1f",
    "sorry": { "background": "#5a2d2d", "foreground": "#ffffff" }
  },
  "nodes": {
    "thm_svd": "formalized",
    "_part_1_funcanal": "#1f3a5f"
  }
}
```

A value in `nodes` is a key of the palette, or, where the palette has no such
key, a colour of its own — so a generator emits state names against a palette
and a hand-written file names a colour and skips the ceremony. A key is a label
or a path segment: `_ch_08_svd` colours every node in the chapter, and the most
specific key wins, so a node overrides its chapter and a chapter its part.

The file is watched, so a checker rewriting it recolours the labels without a
reload, and a file caught half-written costs a reader their colours and nothing
else. No file at all is the ordinary case: the labels then show uncoloured. The
label itself does not depend on it — which node a file belongs to is exactly
what the file name stopped saying.

## Wrap the Spec in a section and it follows you down the file

A node whose Spec puts its body in a section of the node's name

```lean
section lem_clm_complete

attribute [cite] ContinuousLinearMap.instCompleteSpace

end lem_clm_complete
```

gets a document symbol from Lean's own language server, and so a **sticky
scroll header** naming the node wherever you are in the file. Nothing here
provides that symbol, which is the point: an extension cannot add to sticky
scroll without taking it over. Sticky scroll draws its lines from one symbol
provider, and where two answer, the one whose symbols cover the most lines
wins and the other is dropped entirely — so a provider of ours would either
do nothing or cost you Lean's own headers, and would double every entry in
the Outline besides.

The chip goes on that line when it is there, and on line 1 when it is not.
Sticky lines are rendered from their own line's inline decorations, so the
chip is carried into the header with the section — but only as `after`
content: a plain `backgroundColor` on a range is painted by a different
overlay, which sticky scroll does not draw. Hence a chip rather than a
highlight.

It also changes what the chip says, which is always the thing its line does
not. A section line already writes the label, so there the chip is the state —
`formalized`, `sorry` — or a bare swatch where the file gave a colour and no
name, or nothing at all where it said neither. On line 1 nothing names the
node, so there the chip is the label.

A node the blueprint does not write outranks all of that: the chip reads `is
not in the blueprint`, in the editor's warning colour and with no background
of its own. That is a library directory the prose has lost — a real fault,
which nothing else in the editor reports — and the state of a node that is
not in the blueprint is not the thing worth saying.

The chip sits in `after` content either way, so it costs no line and cannot be
typed over.

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
rebuilt, and the chips are redrawn when it is.

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
            Tests/NonVacuity.lean

Either level may be absent, so the depth is not fixed. A node is therefore
recognised from the bottom: by the role its file name names, by the `Tests`
directory above it, or by being the `_`-prefixed file beside a node directory.
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
`Spec`, `Tests` and `Auxiliary`. Decoding is strict: a name the encoding could
not have produced is not treated as a node, so a stray file in a node directory
is ignored rather than misread.

## Requirements

- [`leanprover.lean4`](https://marketplace.visualstudio.com/items?itemName=leanprover.lean4),
  for the `lean4` language the chip and the key attach to.
- [`james-yu.latex-workshop`](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop),
  for the jump into the PDF. Optional: without it, everything else still works
  and the jump opens the `.tex` at the statement.

## Settings

| setting | default | |
|---|---|---|
| `siniJump.exclude` | `**/{.lake,.git,node_modules}/**` | files not searched |
| `siniJump.state` | `.vscode/sini-state.json` | the colour of each node's label |

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
npm test          # compiles, then runs all four suites
```

Press <kbd>F5</kbd> to open an Extension Development Host, then open a blueprint
project in it and ctrl+click a `\label`.

All four suites run outside VS Code, which is the point — nothing worth pinning
needs an editor:

- `test/encoding.test.js` — the encoding round-trips, and refuses every name it
  could not have produced. Uppercase is refused rather than folded, which is
  what keeps the encoding bijective, and the escapes of the older encoding are
  refused with it.
- `test/nodes.test.js` — a path names its node at every configured depth and in
  every role, the reserved subtree is not one, and a label is clickable at
  either brace but not on the command or in a comment.
- `test/state.test.js` — the state file says what it says, a state keeps its
  name, and a half-written one says nothing. The chip is here too: what it
  says is decided by whether its own line already says the label, and a node
  the blueprint has lost outranks all of it. It is generated, so it is sometimes caught mid-write, and
  the tolerance is the part worth pinning.
- `test/links.test.js` — the jump targets the right line. Everything here counts
  from one, as an editor does, and `latex-workshop.synctexto` wants zero-based,
  so this pins the conversion: off by one lands a reader beside the statement,
  which looks like it worked.
