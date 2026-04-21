const meta: Meta<typeof CatCard> = {
  title: "Components/CatCard",
  component: CatCard,
  args: { onSave: fn() },
};
export default meta;
type Story = StoryObj<typeof CatCard>;

export const Base: Story = {
  args: { name: "柠檬", desc: "慵懒的橘猫" },
};

export const Default: Story = { args: {} };
