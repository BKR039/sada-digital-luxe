-- Grant execute on RBAC helper functions to PUBLIC so unauthenticated requests evaluate to FALSE cleanly via RLS rather than failing with 42501
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_sada_access(UUID) TO PUBLIC;
