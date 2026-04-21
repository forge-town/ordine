export const UserCard = ({ userId }: UserCardProps) => {
  const user = useUserStore((s) => s.users[userId]);

  return (
    <Card>
      <CardHeader>
        <Avatar src={user.avatar} />
      </CardHeader>
      <CardContent>{user.name}</CardContent>
    </Card>
  );
};
