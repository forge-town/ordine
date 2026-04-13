const { data: users } = useList({
  resource: "users",
  filters: [{ field: "role", operator: "eq", value: "admin" }],
});

const { mutate: createUser } = useCreate();

const handleSubmit = (values: CreateUserInput) => {
  createUser({ resource: "users", values });
};
