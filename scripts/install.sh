#!/usr/bin/env bash
#
# Install this extension into VS Code as a symlink, so that what VS Code loads
# is the working tree and an edit needs only a compile and a reloaded window.
#
# There is no special mechanism behind it. VS Code reads every directory under
# its extensions directory at startup and takes each one's identity from the
# `package.json` it finds there, so a symlink is as good as a copy and the name
# of the link does not matter. What does matter is `main`, which points into
# `out/`: that directory is generated and git-ignored, so it is compiled here
# before the link is made. A `npm run clean` while VS Code is running leaves
# the extension without its code until the next compile.
#
# Usage: scripts/install.sh [--force] [--extensions DIR]
#
#   --force            replace a link that points somewhere else, and delete a
#                      directory installed under the same extension id
#   --extensions DIR   install into DIR rather than ~/.vscode/extensions; the
#                      environment variable VSCODE_EXTENSIONS does the same,
#                      which is how to reach Insiders (~/.vscode-insiders/…)

set -euo pipefail

repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
extensions=${VSCODE_EXTENSIONS:-$HOME/.vscode/extensions}
force=0

# The block comment at the top of this file is the help, so that the two
# cannot drift apart. It ends where the comments do.
usage() { awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"; }

while [ $# -gt 0 ]; do
    case $1 in
        --force) force=1; shift ;;
        --extensions) extensions=${2:?--extensions needs a directory}; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "install.sh: unknown argument: $1" >&2; exit 2 ;;
    esac
done

# The link's name is this package's, and the id is what VS Code knows the
# extension by -- the id is what two installs collide on, not the name.
name=$(node -p "require('$repo/package.json').name")
id=$(node -p "const p = require('$repo/package.json'); p.publisher + '.' + p.name")
link=$extensions/$name

# A conflicting install: a directory of the same id, from a .vsix or the
# marketplace. VS Code would then have two extensions claiming one id.
conflict=$(find "$extensions" -maxdepth 1 -type d -name "$id-*" 2>/dev/null | head -1 || true)
if [ -n "$conflict" ]; then
    if [ "$force" -eq 1 ]; then
        echo "removing the installed copy $conflict"
        rm -rf -- "$conflict"
    else
        echo "install.sh: $id is already installed as a copy:" >&2
        echo "  $conflict" >&2
        echo "Uninstall it first, which is cleaner than deleting the directory:" >&2
        echo "  code --uninstall-extension $id" >&2
        echo "Or pass --force to delete it here." >&2
        exit 1
    fi
fi

if [ -L "$link" ]; then
    current=$(readlink -- "$link")
    if [ "$current" = "$repo" ]; then
        echo "already linked: $link -> $repo"
    elif [ "$force" -eq 1 ]; then
        rm -- "$link"
    else
        echo "install.sh: $link already points at $current." >&2
        echo "Pass --force to repoint it at $repo." >&2
        exit 1
    fi
elif [ -e "$link" ]; then
    echo "install.sh: $link exists and is not a symlink; not touching it." >&2
    exit 1
fi

# `main` is ./out/extension.js, and out/ is generated, so there is nothing to
# load without this.
echo "compiling"
[ -d "$repo/node_modules" ] || npm --prefix "$repo" install
npm --prefix "$repo" run --silent compile
[ -f "$repo/out/extension.js" ] || { echo "install.sh: nothing compiled" >&2; exit 1; }

if [ ! -L "$link" ]; then
    mkdir -p -- "$extensions"
    ln -s -- "$repo" "$link"
    echo "linked: $link -> $repo"
fi

echo
echo "Reload the window to load it: Developer: Reload Window."
