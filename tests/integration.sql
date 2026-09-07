-- Run after the demo seed. These assertions exercise database-enforced isolation
-- and concurrency behavior without trusting application code.
DO $$
DECLARE a text; b text; leaked integer;
BEGIN
  SELECT id INTO a FROM "Tenant" WHERE slug='centro-demo';
  SELECT id INTO b FROM "Tenant" WHERE slug='segundo-demo';
  SELECT count(*) INTO leaked FROM "Customer" WHERE "tenantId"=b AND id IN (SELECT id FROM "Customer" WHERE "tenantId"=a);
  IF leaked <> 0 THEN RAISE EXCEPTION 'cross-tenant customer leak'; END IF;
END $$;
