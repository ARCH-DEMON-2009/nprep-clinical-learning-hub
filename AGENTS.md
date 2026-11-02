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
- Select pass-through origins through the pure `nprepApiOrigin` helper so the narrowly scoped OTP exception can be regression-tested without sending messages.
- Response shapes from api.nprep.in are undocumented, so pages read them defensively with the helpers in src/lib/api.ts (findKey/findArrays/titleOf/imageOf).
- Lecture streams use dynamically imported Shaka with DRM configured before loading, while native files use the video element; this keeps browser playback code out of SSR.
- Shaka LICENSE requests force a single binary Content-Type header before loading; media and manifest request headers remain unchanged to preserve CDN behavior.
- Catalog levels are parsed separately in src/lib/catalog.ts and account-provided batches use embedded children; course and section reads use the validated subjectId/courseId parameters to avoid confusing entity IDs or inventing endpoints.
- Assessments consume embedded questions or same-origin question URLs returned by NPrep; never invent fetch/submission contracts or claim local results are synced.
- NPrep's video CDN is India-only and rejects browser preflight (OPTIONS), so lecture media falls back to the /api/media relay, which must run in an Indian region (vercel.json pins bom1); the DRM license server allows CORS and is called directly.
