import { describe, expect, it } from 'vitest'

import {
  npmSpecToPurl,
  safeNpmSpecToPurl,
  safeParseNpmSpec,
} from './npm-spec.mts'

describe('safeParseNpmSpec', () => {
  it('should parse regular package specs', () => {
    expect(safeParseNpmSpec('lodash')).toEqual({
      name: 'lodash',
      version: undefined,
    })
    expect(safeParseNpmSpec('lodash@4.17.21')).toEqual({
      name: 'lodash',
      version: '4.17.21',
    })
    expect(safeParseNpmSpec('lodash@^4.17.0')).toEqual({
      name: 'lodash',
      version: '^4.17.0',
    })
    expect(safeParseNpmSpec('lodash@latest')).toEqual({
      name: 'lodash',
      version: 'latest',
    })
  })

  it('should parse scoped package specs', () => {
    expect(safeParseNpmSpec('@types/node')).toEqual({
      name: '@types/node',
      version: undefined,
    })
    expect(safeParseNpmSpec('@types/node@20.0.0')).toEqual({
      name: '@types/node',
      version: '20.0.0',
    })
    expect(safeParseNpmSpec('@types/node@^20.0.0')).toEqual({
      name: '@types/node',
      version: '^20.0.0',
    })
  })

  it('should unwrap npm alias specs to the target package', () => {
    expect(safeParseNpmSpec('my-lodash@npm:lodash@4.17.21')).toEqual({
      name: 'lodash',
      version: '4.17.21',
    })
    expect(safeParseNpmSpec('node-types@npm:@types/node@20.0.0')).toEqual({
      name: '@types/node',
      version: '20.0.0',
    })
    expect(
      safeParseNpmSpec('@my-scope/node-types@npm:@types/node@^20.0.0'),
    ).toEqual({
      name: '@types/node',
      version: '^20.0.0',
    })
    expect(safeParseNpmSpec('my-lodash@npm:lodash@^4')).toEqual({
      name: 'lodash',
      version: '^4',
    })
    expect(safeParseNpmSpec('my-lodash@npm:lodash')).toEqual({
      name: 'lodash',
      version: undefined,
    })
    expect(safeParseNpmSpec('my-lodash@npm:lodash@latest')).toEqual({
      name: 'lodash',
      version: 'latest',
    })
    expect(safeParseNpmSpec('npm:lodash@4.17.21')).toEqual({
      name: 'lodash',
      version: '4.17.21',
    })
  })
})

describe('safeNpmSpecToPurl', () => {
  it('should convert regular and scoped specs to PURLs', () => {
    expect(safeNpmSpecToPurl('lodash')).toBe('pkg:npm/lodash')
    expect(safeNpmSpecToPurl('lodash@4.17.21')).toBe('pkg:npm/lodash@4.17.21')
    expect(safeNpmSpecToPurl('@types/node@20.0.0')).toBe(
      'pkg:npm/@types/node@20.0.0',
    )
  })

  it('should convert npm alias specs to target package PURLs', () => {
    expect(safeNpmSpecToPurl('my-lodash@npm:lodash@4.17.21')).toBe(
      'pkg:npm/lodash@4.17.21',
    )
    expect(safeNpmSpecToPurl('node-types@npm:@types/node@20.0.0')).toBe(
      'pkg:npm/@types/node@20.0.0',
    )
    expect(safeNpmSpecToPurl('my-lodash@npm:lodash@^4')).toBe(
      safeNpmSpecToPurl('lodash@^4'),
    )
    expect(safeNpmSpecToPurl('my-lodash@npm:lodash')).toBe('pkg:npm/lodash')
    expect(safeNpmSpecToPurl('my-lodash@npm:lodash@latest')).toBe(
      'pkg:npm/lodash@latest',
    )
  })
})

describe('npmSpecToPurl', () => {
  it('should return PURL for standard and aliased specs', () => {
    expect(npmSpecToPurl('lodash@4.17.21')).toBe('pkg:npm/lodash@4.17.21')
    expect(npmSpecToPurl('my-lodash@npm:lodash@4.17.21')).toBe(
      'pkg:npm/lodash@4.17.21',
    )
    expect(npmSpecToPurl('node-types@npm:@types/node@20.0.0')).toBe(
      'pkg:npm/@types/node@20.0.0',
    )
  })
})
