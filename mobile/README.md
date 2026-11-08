# ANU mobile app

React Native with **Expo SDK 58** (React Native 0.88), Expo Router, one `axiosInstance`, and zustand.

## What it does today

- **Splash screen**: one image (`assets/splash-icon.png`) for iOS and Android, on white (light) or dark, set in `app.json`. It stays until the app knows who is signed in.
- **Onboarding**: three short screens, shown once.
- **Sign-in**: students (index number) and staff (email, authenticator code, or an emailed code if the authenticator is lost, then setting up a new one, with recovery codes).
- **Home, My courses, Fees, More**, using the states below.

## Everything the website does

The app is built to offer everything the website does, in rounds (see docs/ROADMAP.md). Two things keep it in step:

- **The whole API**: the website's API modules are copied into `src/api/` by `python3 scripts/mobile/port-api.py`, with their types, so any screen can call what the website calls.
- **The same menu**: `python3 scripts/mobile/sync-menu.py` generates `src/lib/sections.ts` from the website's menu. **More** lists every section the person can use on the website, with the same permissions. Screens already built open in the app (`src/lib/routes.ts`); the rest open on the website, marked "Website", until their round.

`python3 scripts/qa/check-mobile.py` fails if either copy is out of date after a website change.

Built in the app so far:

- **Round 1:** Home, my courses (with asking to drop a course), fees (with the statement PDF), course registration (with the PDF slip), results, exams, attendance check-in, morning devotion, notifications, account and security.
- **Round 2:** accommodation (hall applications and offers, private hostels, where you live), library (loans, renewals, reservations, fines paid online, catalogue search, reading lists, clearance, inter-library loans), food (vendors, menus with a saved basket, checkout, orders with pickup code and rating, meal plans), campus jobs and applying, my work (monthly timesheets and payslips), departmental dues (pay online, receipts), and excuse requests (with a medical note from the camera roll or files).
- **Round 3:** my classes (attendance registers, check-in codes shown to the class with a live count, marks entry per assessment and submitting results, class list), registration approvals, course drop requests, results approval (approve, publish or return), devotion services and the chapel door, the library circulation desk (lend and take back), the exam register, and opportunities (posting, applicants, approving timesheets).
- **Round 4:** vendors (live orders board with accept, ready, complete by the customer's code, reject, mark paid, pause; menu with availability, dish photos and categories; meal plans; ratings; shop settings with opening hours, delivery, payment and payout), dispatchers (online switch, taking deliveries, picked up, delivered by code, problems, live location while carrying with a permission prompt, earnings), and private hostel owners (booking requests, beds and prices, photos, fees with recorded payments and receipts, residents check-in and check-out, complaints). Home shows quick links to each person's screens.
- **Round 5a:** academic office (course offerings with lecturers and class sizes, registration records, dues on exam registers, departmental dues as patron, academic advisors, the academic calendar with registration windows and drop deadlines, the grading scale, attendance reports and rules), association dues for officers, my activity, lecturers' reading lists, chaplaincy (devotion scores, rules, exemptions), excused absences and excuse requests (opening students' documents), and the exams office (timetable with clashes and publishing, eligibility with overrides, malpractice, result amendments, venues, fee clearance, exam holds).
- **Round 5b:** registry (students with status changes and set-up links, registering a student, academic structure, courses and each programme's curriculum, programme types and index formats, importing from the previous system with column matching, a check run and real progress), administration (staff with roles and departments, adding staff, all activity, developer access, records retention; sensitive changes ask for an authenticator code first), system diagnostics, student employment (campus jobs and applicants, dispatchers, rules) and the food marketplace (vendors and settings, ratings, settlements and payouts).

## The states, and where they live

| State | What it does | Component |
| --- | --- | --- |
| Empty | Says why it is empty, then one next step | `components/states/EmptyState` |
| Loading | The shape of what is coming (skeleton), never a spinner | `components/ui/Skeleton` |
| Error | What went wrong, whose fault, how to fix it | `components/states/ErrorState`, `lib/errors` |
| No internet | Keeps saved screens on show, says what still works | `components/states/OfflineBanner`, `stores/cache` |
| Slow network | Real download progress, and a lighter path (the saved copy, or Lite mode) | `components/states/SlowNetworkNotice`, `hooks/useQuery` |
| No search results | Fixes the typo for you, and suggests a next search | `components/states/NoResults`, `lib/search` |
| Permission denied | Why it is needed, and a way back (Not now, or Settings) | `components/states/PermissionPrompt`; server 403s in `ErrorState` |
| Session expired | Work is saved as you type (`useDraft`), so signing out loses nothing; sign-in says so | `hooks/useDraft`, `stores/drafts`, `app/_layout` |
| Form validation | The exact field, inline, with how to fix it | `components/ui/TextField`, `lib/validate` |
| Success | Confirms, reassures, then says what happens next | `components/states/SuccessState` |

`components/states/QueryView` puts loading, saved copy, slow and error together, so a screen only describes its content.

## Setting up (npm)

1. Add `"mobile"` to the `workspaces` list in the root `package.json` (next to `"shared"`, `"backend"`, `"frontend"`), so the app can use `@anu/shared`. Build shared first: `cd shared && npm run build`.
2. In `mobile`, install the Expo packages at the versions SDK 58 expects:

   ```
   cd mobile
   npm install
   npx expo install expo-router expo-splash-screen expo-secure-store expo-status-bar expo-notifications expo-linking expo-constants expo-file-system expo-sharing expo-document-picker expo-image-picker expo-location react-native-safe-area-context react-native-screens @react-native-async-storage/async-storage @react-native-community/netinfo @expo/vector-icons
   npx expo install --fix
   ```

3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`. A phone cannot reach `localhost`: in development use your computer's network address, e.g. `http://192.168.1.20:4000/api/v1`, and add that origin nowhere else (the app does not use cookies or CORS).
4. Run it. Expo Go for SDK 58 is not in the app stores yet, so use a development build:

   ```
   npx expo run:android      # Android emulator or a phone with USB debugging
   npx expo run:ios          # iOS simulator (needs a Mac with Xcode 27)
   ```

   Or build in the cloud with EAS: `npx eas build --profile development --platform android`.
5. `npx expo-doctor` checks the project; `npm run typecheck` checks the types (run it after `npm install`: without the packages installed TypeScript cannot check the screens).

## How it talks to the backend

Every request carries `x-anu-client: mobile`. The backend then returns sign-in tokens in the response (instead of cookies), accepts `Authorization: Bearer`, and lets the request past its cross-site check. Tokens are kept in the phone's secure storage (`expo-secure-store`); saved screens and drafts in ordinary storage. When the access token expires the app refreshes it once and retries; if that fails, the session has ended.
