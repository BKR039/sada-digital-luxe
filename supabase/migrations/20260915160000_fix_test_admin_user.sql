-- Clean up manual auth.users test record so GoTrue manages user identities cleanly
DELETE FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE email = 'admin.security.test@sada.agency';
