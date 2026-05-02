with open('/home/ubuntu/CMMS/server/db.ts', 'a') as f:
    f.write("""
// ============================================================
// ASSET CATEGORIES
// ============================================================
export async function listAssetCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetCategories).orderBy(asc(assetCategories.name));
}
export async function createAssetCategory(name: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assetCategories).values({ name });
  return { id: result[0].insertId, name };
}
export async function updateAssetCategory(id: number, name: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(assetCategories).set({ name }).where(eq(assetCategories.id, id));
  return { id, name };
}
export async function deleteAssetCategory(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(assetCategories).where(eq(assetCategories.id, id));
  return { id };
}
""")
print("done")
