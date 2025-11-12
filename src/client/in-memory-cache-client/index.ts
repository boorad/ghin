import type { CacheClient } from '../../models'

export class InMemoryCacheClient implements CacheClient {
  private value: string | undefined = undefined

  async read() {
    return this.value
  }

  async write(value: string) {
    this.value = value
  }
}
