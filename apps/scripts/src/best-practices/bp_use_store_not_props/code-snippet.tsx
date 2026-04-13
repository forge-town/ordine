const CatCard = () => {
  const cat = useCatsPageStore((s) => s.selectedCat);

  return (
    <Card>
      <CardContent>
        <h3>{cat.name}</h3>
        <p>{cat.breed}</p>
      </CardContent>
    </Card>
  );
};
