export const freeBattleRepository = {
  async create(input: CreateFreeBattleInput): Promise<{ id: number }> {
    return await db.transaction(async (tx) => {
      const battleId = await battlesDao.createWithTx(tx, {
        title: input.title,
        type: "free",
      });
      await freeBattlesDao.createWithTx(tx, {
        battleId,
        rules: input.rules,
      });

      return { id: battleId };
    });
  },
};
