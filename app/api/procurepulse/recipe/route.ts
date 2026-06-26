import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

function friendly(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? '';
  if (error?.code === '42P01' || (/pp_recipe/.test(msg) && /exist/i.test(msg))) {
    return 'Recipes aren’t set up yet — run the pp-recipes migration in Supabase.';
  }
  return msg || 'Something went wrong.';
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface IngredientIn {
  stock_item_id?: string | null;
  product_name?: string;
  qty_per_batch?: number | string;
  unit?: string | null;
}

/** Replace a recipe's ingredient lines (delete-all then insert). Best-effort. */
async function replaceIngredients(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  orgId: string,
  recipeId: string,
  ingredients: IngredientIn[],
): Promise<{ error: { code?: string; message?: string } | null }> {
  const { error: delErr } = await db
    .from('pp_recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('org_id', orgId);
  if (delErr) return { error: delErr };

  const rows = ingredients
    .filter((i) => str(i.product_name))
    .map((i) => ({
      org_id: orgId,
      recipe_id: recipeId,
      stock_item_id: str(i.stock_item_id),
      product_name: str(i.product_name) as string,
      qty_per_batch: Math.max(0, num(i.qty_per_batch) ?? 0),
      unit: str(i.unit),
    }));
  if (rows.length === 0) return { error: null };

  const { error: insErr } = await db.from('pp_recipe_ingredients').insert(rows);
  return { error: insErr };
}

/** Create a recipe (optionally with ingredients). Body: { name?, output_*, notes?, ingredients? }. */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    output_product?: string;
    output_qty?: number | string;
    output_unit?: string;
    notes?: string;
    ingredients?: IngredientIn[];
  };

  const db = await createServerSupabase();
  const { data: recipe, error } = await db
    .from('pp_recipes')
    .insert({
      org_id: orgId,
      name: str(body.name) ?? 'New recipe',
      output_product: str(body.output_product),
      output_qty: num(body.output_qty),
      output_unit: str(body.output_unit),
      notes: str(body.notes),
      created_by: session.userId,
    })
    .select('id')
    .single();
  if (error || !recipe) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  const id = (recipe as { id: string }).id;

  if (body.ingredients?.length) {
    const { error: ingErr } = await replaceIngredients(db, orgId, id, body.ingredients);
    if (ingErr) {
      return NextResponse.json({ error: friendly(ingErr) }, { status: 500, headers: AI_CORS_HEADERS });
    }
  }

  return NextResponse.json({ ok: true, id }, { headers: AI_CORS_HEADERS });
}

/** Update a recipe + replace its ingredients. Body: { id, name, output_*, notes?, ingredients }. */
export async function PATCH(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    output_product?: string;
    output_qty?: number | string;
    output_unit?: string;
    notes?: string;
    ingredients?: IngredientIn[];
  };
  const id = str(body.id);
  if (!id) {
    return NextResponse.json({ error: 'Missing recipe id.' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const db = await createServerSupabase();
  const { error } = await db
    .from('pp_recipes')
    .update({
      name: str(body.name) ?? 'Untitled recipe',
      output_product: str(body.output_product),
      output_qty: num(body.output_qty),
      output_unit: str(body.output_unit),
      notes: str(body.notes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }

  if (body.ingredients) {
    const { error: ingErr } = await replaceIngredients(db, orgId, id, body.ingredients);
    if (ingErr) {
      return NextResponse.json({ error: friendly(ingErr) }, { status: 500, headers: AI_CORS_HEADERS });
    }
  }

  return NextResponse.json({ ok: true, id }, { headers: AI_CORS_HEADERS });
}

/** Delete a recipe (ingredient lines cascade). Body: { id }. */
export async function DELETE(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = str(body.id);
  if (!id) {
    return NextResponse.json({ error: 'Missing recipe id.' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const db = await createServerSupabase();
  const { error } = await db.from('pp_recipes').delete().eq('id', id).eq('org_id', orgId);
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: AI_CORS_HEADERS });
}
