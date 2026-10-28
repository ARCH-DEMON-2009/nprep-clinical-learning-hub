# Nprep Clinical Learning Hub

Build a modern, responsive web application for NPrep (medical & nursing preparation platform) that connects directly to the existing live backend at https://api.nprep.in without altering the backend.

Key Requirements:
1. Authentication:
   - Phone number login screen with 10-digit Indian mobile number validation (+91 country code).
   - OTP request via POST https://api.nprep.in/v3/auth/request-otp with payload { phone_number, country_code: "+91" } and a 45-second resend countdown timer.
   - OTP verification screen via POST https://api.nprep.in/v3/auth/login with payload { phone_number, otp }.
   - Secure token persistence in localStorage with an API client that injects 'Authorization: Bearer <token>' on all authenticated requests and handles 401 redirects to login.
   - Profile verification via GET https://api.nprep.in/v3/auth/me displaying the student's name, degree, and active subscription status (e.g. GOLD Batch).

2. App Shell & Layout:
   - Polished responsive sidebar navigation: Dashboard, Subjects & Lectures, Tests & PYQ, QBank, and User Profile.
   - Modern medical education aesthetic with clean typography, dark/light mode support, and seamless mobile responsiveness.
   - CORS / Proxy handling: configured to make requests cleanly to https://api.nprep.in.

3. Content Browsing:
   - Dashboard loading banners and modules from GET https://api.nprep.in/v3/home.
   - Subjects catalog loading all 21 subjects from GET https://api.nprep.in/v3/video/subjects.
   - Hierarchical course and section viewer using GET https://api.nprep.in/v3/video/courses?subjectId={id} and GET https://api.nprep.in/v3/video/sections?courseId={id}.
   - Lecture player screen using GET https://api.nprep.in/v3/video?videoId={id} supporting video playback, chapter timestamps, educator info, and inline PDF notes viewer for the lecture notes.
   - Tests viewer with sections and exams from GET https://api.nprep.in/v3/test.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f82701a1-eead-4be1-bec1-5742de192b03).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
