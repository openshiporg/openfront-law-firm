/** GraphQL multipart variable extraction: dot-index paths, identity deduplication,
 * and immutable inputs. Unlike the copied two-pass traversal, array-root Files
 * are preserved and ordinary native Dates keep their JSON transport contract. */
export function prepareGraphQLUploads(variables: Record<string, unknown>) {
  const files = new Map<Blob, string[]>()
  function visit(value: unknown, path: string): unknown {
    if (value instanceof Blob) {
      files.set(value, [...(files.get(value) ?? []), path])
      return null
    }
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map((entry, index) => visit(entry, `${path}.${index}`))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry, `${path}.${key}`)]))
    return value
  }
  return { variables: Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, visit(value, `variables.${key}`)])), files }
}
