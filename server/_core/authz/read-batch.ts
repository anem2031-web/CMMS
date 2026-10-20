/** Read helpers own no global cache: construct their maps inside one RPC only. */
export const READ_SCOPE_CHUNK_SIZE = 500;

export async function readScopeChunks<T>(ids: number[], read: (ids: number[]) => Promise<T[]>): Promise<T[]> {
  const unique = Array.from(new Set(ids));
  const rows: T[] = [];
  for (let offset = 0; offset < unique.length; offset += READ_SCOPE_CHUNK_SIZE) {
    rows.push(...await read(unique.slice(offset, offset + READ_SCOPE_CHUNK_SIZE)));
  }
  return rows;
}

export function groupReadRows<T>(rows: T[], parent: (row: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const id = parent(row);
    const group = groups.get(id) ?? [];
    group.push(row);
    groups.set(id, group);
  }
  return groups;
}
