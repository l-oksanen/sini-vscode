#!/usr/bin/env bash
#
# Remove the symlink that `scripts/install.sh` made, and its entry in VS
# Code's registry. The working tree is not touched, and neither is anything
# that is not a symlink: a directory under this extension's id was installed
# by VS Code, and is VS Code's to remove.
#
# Usage: scripts/uninstall.sh [--extensions DIR]
#
#   --extensions DIR   look in DIR rather than ~/.vscode/extensions; the
#                      environment variable VSCODE_EXTENSIONS does the same

set -euo pipefail

repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
extensions=${VSCODE_EXTENSIONS:-$HOME/.vscode/extensions}

# The block comment at the top of this file is the help, so that the two
# cannot drift apart. It ends where the comments do.
usage() { awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"; }

while [ $# -gt 0 ]; do
    case $1 in
        --extensions) extensions=${2:?--extensions needs a directory}; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "uninstall.sh: unknown argument: $1" >&2; exit 2 ;;
    esac
done

if pgrep -x 'code|code-insiders' >/dev/null; then
    echo "uninstall.sh: close VS Code first; it rewrites its extension registry" >&2
    exit 1
fi

name=$(node -p "require('$repo/package.json').name")
id=$(node -p "const p = require('$repo/package.json'); p.publisher + '.' + p.name")
link=$extensions/$name

if [ -L "$link" ]; then
    target=$(readlink -- "$link")
    rm -- "$link"
    echo "unlinked: $link -> $target"
    # Only the entry pointing at the link: one of the same id elsewhere is a
    # copy VS Code installed.
    node - "$extensions" "$name" <<'EOF'
const fs = require('fs');
const path = require('path');
const [extensions, name] = process.argv.slice(2);

const registry = path.join(extensions, 'extensions.json');
if (!fs.existsSync(registry)) process.exit(0);
const entries = JSON.parse(fs.readFileSync(registry, 'utf8'));
const kept = entries.filter(e => e.relativeLocation !== name);
if (kept.length === entries.length) process.exit(0);
fs.writeFileSync(registry + '.new', JSON.stringify(kept));
fs.renameSync(registry + '.new', registry);
console.log(`unregistered: ${name} in ${registry}`);
EOF
elif [ -e "$link" ]; then
    # Only a link is this script's to remove. A directory here is an install
    # of VS Code's own making, whatever it is named.
    echo "uninstall.sh: $link is not a symlink; not touching it." >&2
    echo "If it is an installed copy, VS Code should remove it:" >&2
    echo "  code --uninstall-extension $id" >&2
    exit 1
else
    echo "nothing linked at $link"
fi

# A copy installed beside the link would take over as soon as the link is
# gone, which is worth saying rather than leaving to be discovered.
copy=$(find "$extensions" -maxdepth 1 -type d -name "$id-*" 2>/dev/null | head -1 || true)
if [ -n "$copy" ]; then
    echo
    echo "note: $id is also installed as a copy, which now takes over:"
    echo "  $copy"
fi

echo
echo "Reload the window to unload it: Developer: Reload Window."
