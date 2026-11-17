# Coana pin and snapshot paths

- The pinned version is `COANA_CLI_VERSION` in `src/constants.mts`.
- Socket CLI downloads that version from Coana's GCS release bucket; an npm-only
  version is not enough. Check the Coana release changelog at
  <https://docs.coana.tech/changelogs>.
- The native CLI snapshots that print this version are listed under `coana` in
  `scripts/test/snapshot-dependencies.mts`. The checked-in files are the fix,
  scan-create, and scan-reach help snapshots.
- Use `node scripts/test/swap-snapshot-version.mts --dep coana --from <old>` to
  preserve the terminal row width without a native build. If it refuses the
  change, regenerate with `pnpm snapshots:update:dep coana` on a built native
  CLI.
- Coana runs from its Socket API download. SEA does not bundle it.
