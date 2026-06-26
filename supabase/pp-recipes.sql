-- Recipes: combine stock products into finished/internal items (e.g. "Mixed Veg"),
-- with live ingredient availability + max-batch planning. Header + ingredient lines.
-- Org-scoped RLS. Idempotent. Ingredients FK to pp_stock_items (set null on delete,
-- so a removed product leaves the recipe line intact but unlinked).

create table if not exists pp_recipes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  output_product text,
  output_qty numeric,
  output_unit text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pp_recipes_org on pp_recipes (org_id, created_at desc);

create table if not exists pp_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  recipe_id uuid not null references pp_recipes(id) on delete cascade,
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  product_name text not null,
  qty_per_batch numeric not null default 0,
  unit text
);
create index if not exists idx_pp_recipe_ingredients_recipe on pp_recipe_ingredients (recipe_id);

alter table pp_recipes enable row level security;
alter table pp_recipe_ingredients enable row level security;

drop policy if exists pp_recipes_all on pp_recipes;
create policy pp_recipes_all on pp_recipes for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists pp_recipe_ingredients_all on pp_recipe_ingredients;
create policy pp_recipe_ingredients_all on pp_recipe_ingredients for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
