/**
 * Unit tests for launching the Coana CLI.
 *
 * Test Coverage:
 * - spawnCoana: runs cli-wrapper.mjs from the cache with the caller's args,
 *   cwd and environment, passes what socket-cli adds in
 *   SOCKET_CLI_COANA_CONTEXT, or as separate variables to a Coana predating
 *   it, and surfaces a failing run's output.
 * - spawnCoana with a minimum version: refuses an older Coana.
 *
 * Testing Approach:
 * A fake cli-wrapper.mjs is installed into a temporary cache with the real
 * coana-cache.mjs, so nothing is mocked. This needs dist/coana-cache.mjs, which
 * the build copies there.
 *
 * Related Files:
 * - utils/coana-release.mts (implementation)
 * - vendor/coana-cache.mjs (the cache script)
 */

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { spawn } from '@socketsecurity/registry/lib/spawn'

import constants, { COANA_CLI_VERSION } from '../constants.mts'
import { spawnCoana } from './coana-release.mts'
import { getCliUserAgent, getDefaultApiBaseUrl } from './sdk.mts'

// Predates SOCKET_CLI_COANA_CONTEXT.
const VERSION = '1.2.3'

// Prints what it was run with, or fails the way Coana does for some errors.
const FAKE_CLI_WRAPPER = `
const args = process.argv.slice(2)
if (args[0] === 'fail') {
  process.stdout.write('error: Could not resolve 1 dependency(ies)\\n')
  process.exit(1)
}
process.stdout.write(JSON.stringify({ args, cwd: process.cwd(), env: process.env }))
`

type FakeRun = {
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

async function runFake(
  options?: Parameters<typeof spawnCoana>[2],
): Promise<FakeRun> {
  const result = await spawnCoana(['run', '.'], 'acme', {
    coanaVersion: VERSION,
    stdio: 'pipe',
    ...options,
  })
  if (!result.ok) {
    throw new Error(`${result.message}: ${result.cause}`)
  }
  return JSON.parse(result.data) as FakeRun
}

describe('spawnCoana', () => {
  const savedXdgCacheHome = process.env['XDG_CACHE_HOME']
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'socket-coana-release-')),
    )
    process.env['XDG_CACHE_HOME'] = path.join(tmpDir, 'cache')
    const extracted = path.join(tmpDir, 'extracted')
    await fs.mkdir(extracted)
    await fs.writeFile(
      path.join(extracted, 'cli-wrapper.mjs'),
      FAKE_CLI_WRAPPER,
    )
    for (const version of [VERSION, COANA_CLI_VERSION]) {
      // eslint-disable-next-line no-await-in-loop
      await spawn(
        'node',
        [
          path.join(constants.distPath, 'coana-cache.mjs'),
          'install',
          version,
          'cli',
          'a'.repeat(64),
          extracted,
        ],
        { stdio: 'pipe' },
      )
    }
  })

  afterAll(async () => {
    if (savedXdgCacheHome === undefined) {
      delete process.env['XDG_CACHE_HOME']
    } else {
      process.env['XDG_CACHE_HOME'] = savedXdgCacheHome
    }
    await fs.rm(tmpDir, { force: true, recursive: true })
  })

  it('runs the cached cli-wrapper.mjs with the args and cwd', async () => {
    const run = await runFake({ cwd: tmpDir })

    expect(run.args).toEqual(['run', '.'])
    expect(run.cwd).toBe(tmpDir)
  })

  it('strips npm_package_* env vars to avoid E2BIG in big monorepos', async () => {
    process.env['npm_package_dependencies_react'] = '^18.2.0'
    // These carry registry and proxy settings from .npmrc.
    process.env['npm_config_registry'] = 'https://artifactory.example/npm/'
    try {
      const { env } = await runFake()

      expect(env['npm_package_dependencies_react']).toBeUndefined()
      expect(env['npm_config_registry']).toBe(
        'https://artifactory.example/npm/',
      )
    } finally {
      delete process.env['npm_package_dependencies_react']
      delete process.env['npm_config_registry']
    }
  })

  it('passes what it adds in SOCKET_CLI_COANA_CONTEXT to the pinned Coana', async () => {
    const { env } = await runFake({
      coanaVersion: COANA_CLI_VERSION,
      repoName: 'repo',
    })

    const context = JSON.parse(env['SOCKET_CLI_COANA_CONTEXT']!)
    expect(context).toMatchObject({
      apiBaseUrl: getDefaultApiBaseUrl(),
      cliVersion: constants.ENV.INLINED_SOCKET_CLI_VERSION,
      orgSlug: 'acme',
      repoName: 'repo',
      userAgent: getCliUserAgent(),
    })
    // Coana refuses a key it does not know.
    expect(
      Object.keys(context).filter(
        key =>
          ![
            'apiBaseUrl',
            'apiProxy',
            'apiToken',
            'cliVersion',
            'orgSlug',
            'repoName',
            'userAgent',
          ].includes(key),
      ),
    ).toEqual([])
    expect(env['SOCKET_ORG_SLUG']).toBeUndefined()
    expect(env['SOCKET_CALLER_USER_AGENT']).toBeUndefined()
    expect(env['SOCKET_REPO_NAME']).toBeUndefined()
  })

  it("passes the user's SOCKET_REPO_NAME in the context when socket-cli names no repository", async () => {
    process.env['SOCKET_REPO_NAME'] = 'users-repo'
    try {
      const { env } = await runFake({ coanaVersion: COANA_CLI_VERSION })

      expect(JSON.parse(env['SOCKET_CLI_COANA_CONTEXT']!)).toMatchObject({
        repoName: 'users-repo',
      })
    } finally {
      delete process.env['SOCKET_REPO_NAME']
    }
  })

  it("leaves socket-cli's own settings out of Coana's environment", async () => {
    // Set for every socket-cli process, so a spread would pass it on.
    expect(constants.processEnv['SOCKET_CLI_GIT_USER_NAME']).toBeTruthy()

    const { env } = await runFake({ coanaVersion: COANA_CLI_VERSION })

    expect(env['SOCKET_CLI_GIT_USER_NAME']).toBeUndefined()
    expect(env['SOCKET_CLI_API_BASE_URL']).toBeUndefined()
  })

  it('sets the variables a Coana predating the context reads', async () => {
    const { env } = await runFake({ repoName: 'repo' })

    expect(env['SOCKET_CLI_COANA_CONTEXT']).toBeUndefined()
    expect(env).toMatchObject({
      SOCKET_CALLER_USER_AGENT: getCliUserAgent(),
      SOCKET_CLI_API_BASE_URL: getDefaultApiBaseUrl(),
      SOCKET_ORG_SLUG: 'acme',
      SOCKET_REPO_NAME: 'repo',
    })
  })

  it('refuses a Coana older than the minimum, naming the minimum', async () => {
    const result = await spawnCoana(['run', '.'], 'acme', {
      coanaVersion: VERSION,
      minimumVersion: COANA_CLI_VERSION,
      stdio: 'pipe',
    })

    expect(result.ok).toBe(false)
    expect(result.message).toBe(`Coana ${VERSION} is too old for this command`)
    expect(result.cause).toContain(`Coana ${COANA_CLI_VERSION} or newer`)
  })

  it('runs a Coana at the minimum', async () => {
    const run = await runFake({
      coanaVersion: COANA_CLI_VERSION,
      minimumVersion: COANA_CLI_VERSION,
    })

    expect(run.args).toEqual(['run', '.'])
  })

  it('surfaces captured stdout when stderr is empty (Coana logs some failures to stdout)', async () => {
    const result = await spawnCoana(['fail'], 'acme', {
      coanaVersion: VERSION,
      stdio: 'pipe',
    })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('Coana command failed (exit code 1)')
    expect(result.message).toContain('Could not resolve 1 dependency(ies)')
  })
})
