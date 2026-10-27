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
- All NPrep backend calls go through the `/api/nprep/*` pass-through route (src/routes/api/nprep.$.ts) via `api()` in src/lib/api.ts — avoids browser CORS; backend must not be modified.
- Response shapes from api.nprep.in are undocumented, so pages read them defensively with the helpers in src/lib/api.ts (findKey/findArrays/titleOf/imageOf).
