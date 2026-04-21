export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({ id: true });
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = UserSchema.partial().required({ id: true });
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
