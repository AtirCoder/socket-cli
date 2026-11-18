import { describe, expect, it } from 'vitest'

import {
  findLockedPackageIntegrity,
  parsePnpmLock,
} from '../../../src/sea/pnpm-lock.mts'

const INTEGRITY = 'sha512-YWJj'

describe('pnpm lockfile parsing', () => {
  it('reads a single-document pnpm lockfile', () => {
    const lock = `
lockfileVersion: '9.0'
packages:
  sample@1.0.0:
    resolution: {integrity: ${INTEGRITY}}
`

    expect(findLockedPackageIntegrity(lock, 'sample', '1.0.0')).toBe(INTEGRITY)
  })

  it('uses the complete graph in a split pnpm lockfile', () => {
    const lock = `
lockfileVersion: '9.0'
packages:
  pnpm@12.21.0: {}
---
lockfileVersion: '9.0'
packages:
  sample@1.0.0:
    resolution: {integrity: ${INTEGRITY}}
  another@1.0.0: {}
`

    expect(parsePnpmLock(lock).packages).toHaveProperty('another@1.0.0')
    expect(findLockedPackageIntegrity(lock, 'sample', '1.0.0')).toBe(INTEGRITY)
  })

  it('resolves pnpm 12 patch hashes to their workspace file paths', () => {
    const lock = `
lockfileVersion: '9.0'
packages:
  sample@1.0.0:
    resolution: {integrity: ${INTEGRITY}}
patchedDependencies:
  sample@1.0.0: patch-hash
`
    const workspace = `
patchedDependencies:
  sample@1.0.0: patches/sample.patch
`

    expect(parsePnpmLock(lock, workspace).patchedDependencies).toEqual({
      'sample@1.0.0': { hash: 'patch-hash', path: 'patches/sample.patch' },
    })
  })
})
