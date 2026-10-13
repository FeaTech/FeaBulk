<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Roles are simplified to Buyer, Seller (organization kind) and FeaBulk Admin (operations_members = platform_administrator); DB triggers coerce org roles to owner/administrator("Member") so legacy enum values stay but are never assigned. Why: avoids rewriting ~35 role-checking SQL functions.
- /app only redirects; /buyer and /seller render components/workspace/BusinessWorkspace, /admin is the ops console. Why: each user type gets its own screen.

- Buyer and seller presentation uses WorkspaceLayout and WorkspaceOverview with semantic workspace tokens; BusinessWorkspace retains actions and access checks. Why: keeps role-specific design independent of trading logic.
- Public catalog list reads use a bounded browser-only 30-second cache and concurrent supplier/image enrichment; never cache private workspace data. Why: removes repeat network waterfalls without sharing sessions or retaining stale trading data.
