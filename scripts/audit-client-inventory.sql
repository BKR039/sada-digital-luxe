SELECT
  c.id,
  c.name,
  c.status,
  c.client_type,
  c.created_at,
  (SELECT count(*) FROM public.client_projects WHERE client_id = c.id) as projects,
  (SELECT count(*) FROM public.project_tasks WHERE client_id = c.id) as tasks,
  (SELECT count(*) FROM public.service_commitments WHERE client_id = c.id) as commitments,
  (SELECT count(*) FROM public.client_deliverables WHERE client_id = c.id) as deliverables,
  (SELECT count(*) FROM public.invoices WHERE client_id = c.id) as invoices,
  (SELECT count(*) FROM public.sales_commissions WHERE client_id = c.id) as commissions,
  (SELECT count(*) FROM public.income_transactions WHERE client_id = c.id) as income,
  (SELECT count(*) FROM public.expense_transactions WHERE client_id = c.id) as expenses,
  (SELECT count(*) FROM public.deals WHERE client_id = c.id) as deals
FROM public.clients c
ORDER BY c.created_at DESC;
