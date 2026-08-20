#!/usr/bin/env sh
set -eu

postgres_user="${POSTGRES_USER:-postgres}"

for database in ordine_create_test ordine_db_schema_test ordine_models_test ordine_playwright; do
  exists="$(psql -U "$postgres_user" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$database'")"
  if [ "$exists" != "1" ]; then
    createdb -U "$postgres_user" "$database"
  fi
done
