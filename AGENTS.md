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
