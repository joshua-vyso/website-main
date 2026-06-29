-- Link an OrderFlow order back to the Doc-U document it was created from (an
-- uploaded WhatsApp/email/handwritten order). One order per source document, so
-- re-extraction/edits upsert the same order rather than duplicating it. Idempotent.

alter table of_orders add column if not exists source_document_id uuid references documents(id) on delete set null;
create index if not exists idx_of_orders_source_doc on of_orders (source_document_id);
