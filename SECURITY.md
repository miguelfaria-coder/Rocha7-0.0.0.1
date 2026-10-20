# Rocha7 — Security baseline

## Sensitive operations
- The browser may contain only the Supabase publishable key. Never put a Supabase service-role/secret key in HTML, JavaScript, committed files, client-visible environment variables, or logs.
- Order creation must go through the `rocha7-create-order` Edge Function. The database RPC recalculates prices from the product catalog, inserts order and items atomically, and uses an idempotency key.
- Contact messages must go through `rocha7-contact-message`. The Edge Function validates input, derives identity from a validated session, rate-limits by an HMAC of the origin IP, and writes through server-side credentials.
- The `rocha7-admin` Edge Function must check `auth.getUser(token)` and the active admin role in `public.perfis` for every operation. Client metadata and localStorage are never authorization sources.
- Public catalog reads are intentional. Customer records, access logs, order writes, contact-message rows, rate-limit records, and role changes are private.
- All browser-facing database tables in `public` require RLS, explicit least-privilege grants, and ownership predicates where applicable.
- Edge functions validate request size, HTTP method, allowed Origin where browsers are used, and all fields on the server. CORS is not a replacement for authentication or input validation.

## Deployment sequence
1. Apply `rocha7_private_rate_limits_and_constraints` before deploying the frontend change. It moves checkout rate-limit storage into the unexposed `private` schema, adds contact throttling, adds validation constraints, and indexes foreign keys. It keeps the legacy direct-write grants temporarily so production checkout is not interrupted.
2. Deploy the branch containing the secure checkout/contact frontend and Edge Functions; confirm Vercel production is READY.
3. Smoke-test one legitimate checkout and one contact submission.
4. Only then apply `rocha7_production_lockdown`. It revokes direct browser writes to `pedidos`, `itens_pedido`, and `mensagens_contato`; the old client insert policies are removed.
5. Run Supabase Security and Performance Advisors and verify client grants/RLS policies after deployment.

## Supabase Auth dashboard checklist (manual)
- Enable leaked-password protection if the current plan supports it.
- Set minimum password length to at least 8 characters (12 is preferable) and use strong-password rules where practical.
- Require email confirmation and configure Site URL / Redirect URLs to exact owned domains.
- Enable MFA for all administrator accounts and keep the number of active administrators minimal.
- Enable CAPTCHA/bot protection and configure Auth rate limits where the plan supports them.
- Review database backups/PITR and retention, restrict project/dashboard access with MFA, and rotate any secret that is ever exposed.

## Privacy
- Do not store card numbers or CVV in Rocha7. Process payment details only through a compliant payment provider.
- Collect only data required to fulfill an order. Limit access to CPF/CNPJ, address, telephone, and contact messages.
- Error responses must not return SQL, credentials, tokens, or personal data. Avoid logging full payloads or raw IP addresses.
