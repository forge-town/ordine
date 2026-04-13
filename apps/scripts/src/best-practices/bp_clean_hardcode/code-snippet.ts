import { usersDao } from "@/models/daos/usersDao";

export const usersService = {
  async findById(id: string): Promise<UserRow | null> {
    return await usersDao.findById(id);
  },

  async create(data: CreateUserInput): Promise<UserRow> {
    return await usersDao.create(data);
  },
};
