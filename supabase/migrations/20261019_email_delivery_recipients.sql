-- Emails to many people inside one event (earnings, notices) are tracked one by
-- one: each email that went is recorded in `sent` ("<event>|<subject>|<to>"), the
-- event stays open while any failed, and a retry sends only the failed ones.
-- Extends 20261019_email_deliveries.sql.

alter table private.email_deliveries add column if not exists sent text[] not null default '{}';

create or replace function public.delivery_claim(delivery_id bigint)
returns jsonb language sql volatile security definer set search_path = '' as $$
  update private.email_deliveries
     set status = 'sending', attempts = attempts + 1, claimed_at = now()
   where id = delivery_id and status in ('pending', 'retry')
  returning jsonb_build_object('events', events, 'done', to_jsonb(done), 'sent', to_jsonb(sent), 'attempts', attempts);
$$;

create or replace function public.delivery_recipient_sent(delivery_id bigint, sent_key text)
returns void language sql volatile security definer set search_path = '' as $$
  update private.email_deliveries set sent = array_append(sent, sent_key)
   where id = delivery_id and not (sent_key = any(sent));
$$;
revoke all on function public.delivery_claim(bigint), public.delivery_recipient_sent(bigint, text) from public, anon, authenticated;
grant execute on function public.delivery_claim(bigint), public.delivery_recipient_sent(bigint, text) to service_role;
