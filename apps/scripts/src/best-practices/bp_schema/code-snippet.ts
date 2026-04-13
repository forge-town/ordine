export const CatSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  breed: z.string().optional(),
  ownerId: z.string(),
});
export type Cat = z.infer<typeof CatSchema>;

export const CreateCatInputSchema = CatSchema.omit({ id: true });
export type CreateCatInput = z.infer<typeof CreateCatInputSchema>;
