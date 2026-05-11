DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agents'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND constraint_name = 'agents_system_prompt_max_length'
  ) THEN
    ALTER TABLE "agents"
      ADD CONSTRAINT "agents_system_prompt_max_length"
      CHECK (length("system_prompt") <= 10000);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_definitions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'agent_definitions'
      AND constraint_name = 'agent_definitions_system_prompt_max_length'
  ) THEN
    ALTER TABLE "agent_definitions"
      ADD CONSTRAINT "agent_definitions_system_prompt_max_length"
      CHECK (length("system_prompt") <= 10000);
  END IF;
END $$;
