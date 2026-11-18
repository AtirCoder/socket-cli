import { parse, parseAllDocuments } from 'yaml'

interface PnpmLockPackage {
  resolution?: {
    integrity?: unknown
  }
}

interface PnpmLock {
  packages?: Record<string, PnpmLockPackage | undefined>
  patchedDependencies?: Record<
    string,
    { path?: string; hash?: string } | string
  >
}

/** Read the package graph from both single-document and split pnpm lockfiles. */
export function parsePnpmLock(
  source: string,
  workspaceSource?: string,
): PnpmLock {
  let selected: PnpmLock | undefined
  let selectedPackageCount = -1

  for (const document of parseAllDocuments(source)) {
    const value = document.toJS() as PnpmLock | undefined
    const packages = value?.packages
    if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
      continue
    }

    const packageCount = Object.keys(packages).length
    if (packageCount > selectedPackageCount) {
      selected = value
      selectedPackageCount = packageCount
    }
  }

  if (!selected) {
    throw new Error('pnpm-lock.yaml does not contain a packages graph')
  }

  if (workspaceSource && selected.patchedDependencies) {
    const workspace = parse(workspaceSource) as {
      patchedDependencies?: Record<string, string | undefined>
    }
    for (const [locator, patch] of Object.entries(
      selected.patchedDependencies,
    )) {
      if (typeof patch === 'string') {
        const patchPath = workspace.patchedDependencies?.[locator]
        if (!patchPath) {
          throw new Error(
            `pnpm-workspace.yaml has no path for patched dependency ${locator}`,
          )
        }
        selected.patchedDependencies[locator] = {
          hash: patch,
          path: patchPath,
        }
      }
    }
  }
  return selected
}

export function findLockedPackageIntegrity(
  source: string,
  packageName: string,
  version: string,
): string | undefined {
  const locator = `${packageName}@${version}`
  const integrity =
    parsePnpmLock(source).packages?.[locator]?.resolution?.integrity
  return typeof integrity === 'string' ? integrity : undefined
}
