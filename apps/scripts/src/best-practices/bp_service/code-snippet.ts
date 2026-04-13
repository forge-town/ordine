export const catsService = {
  async create(userId: string, data: CreateCatInput): Promise<Cat> {
    const existing = await catsDao.findByName(data.name);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Cat already exists" });
    }
    return await catsDao.create({ ...data, ownerId: userId });
  },

  async listByOwner(ownerId: string): Promise<Cat[]> {
    return await catsDao.findByOwnerId(ownerId);
  },
};
