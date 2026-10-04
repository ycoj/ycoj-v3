# Shared Impeccable hooks

Impeccable 4.5.0 (engine 0.1.11) is installed in this repository for Codex
and Cursor. The skills and launchers are committed alongside the hook manifests;
teammates do not need a global installation. These are AI tool hooks, not Git
commit hooks.

Open the repository root in your coding agent so the relative hook paths resolve.
Before the first session, run this once from the repository root to download and
verify the engine for your platform, outside the short per-edit hook timeout:

```sh
.agents/skills/impeccable/scripts/impeccable engine-probe
```

On Windows Command Prompt, use
`.agents\skills\impeccable\scripts\impeccable.cmd engine-probe` instead.
Both launchers use the same per-user engine cache. Platform binaries are ignored
by Git and are not part of the shared installation.

- Codex: approve the project hooks using `/hooks` when prompted. The
  `.codex/hooks.json` manifest checks edits and runs a deep pass at session stop.
- Cursor: enable hooks under Settings → Hooks. The `.cursor/hooks.json` manifest
  checks proposed edits before they are written.

Shared hook policy lives in `.impeccable/config.json`. Manage it from the root:

```sh
.agents/skills/impeccable/scripts/impeccable hooks status
.agents/skills/impeccable/scripts/impeccable hooks on
.agents/skills/impeccable/scripts/impeccable hooks off
```

`hooks off` changes the shared policy; commit it only when the team should disable
the hook. Personal consent and overrides belong in the ignored
`.impeccable/config.local.json`. Hook caches and pending findings are also ignored.

To update the vendored installation intentionally:

```sh
.agents/skills/impeccable/scripts/impeccable install --project --providers=codex,cursor --yes --force
.agents/skills/impeccable/scripts/impeccable hooks on
```

Review and commit both provider skill directories, `.cursor/agents/`, both hook
manifests, shared config, and any version changes together. The upstream project
is [pbakaus/impeccable](https://github.com/pbakaus/impeccable).
