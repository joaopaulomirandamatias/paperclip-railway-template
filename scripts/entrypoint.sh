#!/bin/sh
set -e
# When Railway mounts a volume at /paperclip it is often not writable by the node user.
# Create dirs Paperclip needs and ensure the whole tree is owned by node.
mkdir -p /paperclip/instances/default/logs
chown -R node:node /paperclip

# Register bundled external adapters into the Paperclip plugin manifest. The
# manifest lives on the persistent volume so we must seed it on first boot
# (or merge new adapters on subsequent boots). Adapters themselves are baked
# into the image at /opt/adapters/<name>.
register_adapter() {
  pkg_name="$1"
  type_name="$2"
  local_path="$3"

  manifest="${PAPERCLIP_HOME:-/paperclip}/adapter-plugins.json"
  [ -d "$local_path" ] || return 0
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  entry="$(jq -n --arg pkg "$pkg_name" --arg type "$type_name" \
    --arg path "$local_path" --arg at "$now" \
    '{packageName:$pkg, localPath:$path, type:$type, installedAt:$at}')"

  if [ ! -f "$manifest" ]; then
    printf '[%s]\n' "$entry" > "$manifest"
  else
    # Replace any existing entry for this type, then append the fresh one.
    tmp="${manifest}.tmp"
    jq --argjson new "$entry" --arg type "$type_name" \
      'map(select(.type != $type)) + [$new]' \
      "$manifest" > "$tmp" && mv "$tmp" "$manifest"
  fi
  chown node:node "$manifest"
}

register_adapter "paperclip-adapter-lemonfox" "lemonfox" "/opt/adapters/lemonfox"

# ---------- Fix for GitHub issue #4 ----------
# Claude Code refuses --dangerously-skip-permissions when it detects
# root / sudo / elevated capabilities.  `gosu` drops uid/gid but keeps
# inherited Linux capabilities, which Claude Code interprets as elevated
# privilege.
#
# `setpriv` (util-linux, pre-installed on Debian Bookworm) lets us
# explicitly clear all inherited + ambient capabilities so the child
# process looks like a genuinely unprivileged user.
#
# We also unset any SUDO_* env vars that might leak from the container
# runtime, as Claude Code checks for those too.
unset SUDO_USER SUDO_UID SUDO_GID SUDO_COMMAND 2>/dev/null || true
 
exec setpriv \
  --reuid=node \
  --regid=node \
  --init-groups \
  --inh-caps=-all \
  "$@"
