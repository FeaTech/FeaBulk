create type public.conversation_context as enum ('product_inquiry', 'rfq', 'quote', 'order', 'shipment', 'dispute');
create type public.notification_channel as enum ('in_app', 'email', 'sms', 'whatsapp');
create type public.operations_role as enum ('verification_reviewer', 'catalog_moderator', 'payments_reviewer', 'dispute_manager', 'support_agent', 'platform_administrator');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  context public.conversation_context not null,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  seller_organization_id uuid references public.organizations(id) on delete restrict,
  rfq_id uuid references public.rfqs(id) on delete restrict,
  quote_id uuid references public.rfq_quotes(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  dispute_id uuid references public.disputes(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (seller_organization_id is not null or context in ('rfq', 'product_inquiry'))
);
create index conversations_buyer_idx on public.conversations(buyer_organization_id, created_at desc);
create index conversations_seller_idx on public.conversations(seller_organization_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_organization_id uuid references public.organizations(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 8000),
  is_system boolean not null default false,
  visibility text not null default 'counterparty' check (visibility in ('counterparty', 'buyer_only', 'seller_only', 'operations_only')),
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at asc);

create table public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_nonessential boolean not null default true,
  sms_nonessential boolean not null default false,
  whatsapp_nonessential boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel public.notification_channel not null,
  template_key text not null,
  payload jsonb not null,
  critical boolean not null default false,
  read_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.supplier_metrics (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  completed_transaction_value numeric(16,2) not null default 0 check (completed_transaction_value >= 0),
  verified_since timestamptz,
  order_completion_rate numeric(5,2) not null default 0 check (order_completion_rate between 0 and 100),
  on_time_dispatch_rate numeric(5,2) not null default 0 check (on_time_dispatch_rate between 0 and 100),
  dispute_rate numeric(5,2) not null default 0 check (dispute_rate between 0 and 100),
  average_response_minutes integer,
  repeat_buyer_rate numeric(5,2) not null default 0 check (repeat_buyer_rate between 0 and 100),
  calculated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.operations_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.operations_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (organization_id is not null or order_id is not null)
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.supplier_metrics enable row level security;
alter table public.reviews enable row level security;
alter table public.operations_members enable row level security;
alter table public.risk_flags enable row level security;

create policy "conversation counterparties can read" on public.conversations for select to authenticated using (private.is_member(buyer_organization_id) or (seller_organization_id is not null and private.is_member(seller_organization_id)));
create policy "conversation counterparties can read messages" on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and (private.is_member(c.buyer_organization_id) or (c.seller_organization_id is not null and private.is_member(c.seller_organization_id)))) and visibility <> 'operations_only');
create policy "user can read message receipts" on public.message_reads for select to authenticated using (user_id = (select auth.uid()));
create policy "user can read notification preference" on public.notification_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy "user can update notification preference" on public.notification_preferences for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user can read their notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "public supplier metrics" on public.supplier_metrics for select using (true);
create policy "public reviews" on public.reviews for select using (true);
create policy "operations member can see their roles" on public.operations_members for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete on public.conversations, public.messages, public.message_reads, public.notifications, public.supplier_metrics, public.reviews, public.operations_members, public.risk_flags from anon, authenticated;
