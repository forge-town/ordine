export const usersDao = {
  async findById(id: string): Promise<UserRow | null> {
    const result = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    return result[0] ?? null;
  },

  async create(data: NewUserRow): Promise<UserRow> {
    const result = await db.insert(usersTable).values(data).returning();

    return result[0];
  },

  async createWithTx(tx: DbExecutor, data: NewUserRow): Promise<UserRow> {
    const result = await tx.insert(usersTable).values(data).returning();

    return result[0];
  },
};
