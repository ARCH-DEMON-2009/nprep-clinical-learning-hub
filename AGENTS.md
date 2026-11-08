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
- API setup is a public, non-secret in-memory draft only; it cannot change the live origin, send credentials, or assert provider approval. Real integration requires independently verified NPrep authorization and its documented web authentication contract.
- Connection diagnostics use an allowlisted response-source header and an ephemeral category/code/time store only; never retain request details, credentials or raw error text, and never infer an upstream outage from unmarked errors.
- Requests to api.nprep.in carry no Origin/Referer/sec-fetch headers (the API now 403s them); static tests avoid sending or verifying OTPs.
- Every server request to api.nprep.in goes through `applyNprepClientHeaders` (Flutter app identity: Dart/ User-Agent, semver x-app-version, x-app-build, x-platform); the API returns 403 before routing/auth to browser agents. CDN requests keep the browser agent.
- Response shapes from api.nprep.in are undocumented, so pages read them defensively with the helpers in src/lib/api.ts (findKey/findArrays/titleOf/imageOf).
- Lecture streams use dynamically imported Shaka with DRM configured before loading, while native files use the video element; this keeps browser playback code out of SSR.
- Shaka LICENSE requests force a single binary Content-Type header before loading; media and manifest request headers remain unchanged to preserve CDN behavior.
- API transient HTTP failures use three attempts per layer (browser fixed delays, upstream progressive delays) with reusable bodies and no development-host fallback; playback switches between direct and relay at most once per mode, never on DRM errors, and app bearer credentials only reach trusted NPrep license hosts.
- Catalog levels are parsed separately in src/lib/catalog.ts and account-provided batches use embedded children; course and section reads use the validated subjectId/courseId parameters to avoid confusing entity IDs or inventing endpoints.
- Assessments consume embedded questions or same-origin question URLs returned by NPrep; never invent fetch/submission contracts or claim local results are synced.
- NPrep's video CDN is India-only and rejects browser preflight (OPTIONS); the /api/media relay can also be geo-blocked outside India. Vercel configuration leaves region selection to the deployment account to avoid plan restrictions; the DRM license server allows CORS and is called directly.
