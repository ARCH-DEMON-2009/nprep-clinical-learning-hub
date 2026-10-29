# NPrep playback and question taking
- [x] Fix lecture source detection, DRM setup, and retryable playback errors; verified Shaka with an unprotected DASH fixture.
- [x] Make QBank and test cards open; browse supplied exams and consume embedded questions or NPrep-supplied question URLs.
- [x] Provide answering, review flags, navigation, and local attempt summaries without claiming synchronization.
- [x] Run all 13 tests and exercise question answering, test/exam navigation, DASH playback, chapter seek, and notes-viewer opening with controlled responses.
- [ ] Connect live question fetch and attempt submission: blocked on validated NPrep question/submission contracts; no documented endpoints or payloads were found.
- [ ] Verify authenticated NPrep lectures, DRM, PDF contents, and real questions end-to-end: blocked on an available NPrep sign-in session.