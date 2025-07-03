import { describe, it, expect } from 'vitest'
import { InMemoryCacheClient } from './index'

describe('InMemoryCacheClient', () => {
  it('should store and retrieve values', async () => {
    const cache = new InMemoryCacheClient()
    const testValue = 'test-token-123'

    // Initially should be undefined
    expect(await cache.read()).toBeUndefined()

    // Write a value
    await cache.write(testValue)
    expect(await cache.read()).toBe(testValue)

    // Write another value (should overwrite)
    const newValue = 'new-token-456'
    await cache.write(newValue)
    expect(await cache.read()).toBe(newValue)
  })

  it('should handle multiple instances independently', async () => {
    const cache1 = new InMemoryCacheClient()
    const cache2 = new InMemoryCacheClient()

    await cache1.write('value1')
    await cache2.write('value2')

    expect(await cache1.read()).toBe('value1')
    expect(await cache2.read()).toBe('value2')
  })

  it('should handle empty string values', async () => {
    const cache = new InMemoryCacheClient()
    
    // Write empty string
    await cache.write('')
    expect(await cache.read()).toBe('')
  })
}) 