# Online Certification & Course Tracker (MERN)

Students submit course certificates, faculty verify them, and approved certificates are converted into academic credits under an admin-configurable policy.

**Stack:** MongoDB + Mongoose · Express 4 · React 18 (Vite, Tailwind, Recharts) · Node 20.19+

## Quick start
```bash
npm run install:all
cp server/.env.example server/.env      # set MONGODB_URI and JWT_SECRET (see comments inside)
cp client/.env.example client/.env
npm run seed                            # creates a Super Admin, a Faculty and a demo Student (from SEED_* vars)
npm run dev                             # client http://localhost:5173 · API http://localhost:5000/api/health
```
Seed passwords must be 10+ characters. Change them after first sign-in (Profile → Change password).

## Dark / light mode
Use the sun/moon button in the top bar (or top-right on the login page). The first visit follows your OS setting and keeps following it until you choose; your choice is then saved in the browser and synced across tabs. Theme is applied before first paint, so there's no flash. Implementation: `client/src/context/ThemeContext.jsx`, `components/ThemeToggle.jsx`, and the `.dark` rules at the end of `client/src/index.css`.

## Roles and what they can do
| Role | Capabilities |
|---|---|
| **Student** | Self-register; submit a certificate with a PDF/PNG/JPEG upload and/or a verification link; track status and feedback; edit and resubmit when a correction is requested; withdraw pending submissions; view credits |
| **Faculty** | Verification queue (assigned to them + their department's shared pool): mark under review, approve, reject, request correction, with a reason required for reject/correction; view history and duplicate warnings |
| **Admin** | Everything faculty can do, plus: create faculty accounts, activate/deactivate users, reset passwords, reassign submissions, manage credit policy versions, reports + CSV export, audit log |
| **Super Admin** | Everything admin can do, plus creating/modifying Admin and Super Admin accounts |

## How the workflow behaves
1. **Submit.** Validated server-side (zod). Uploaded files are checked by *magic bytes* (not file extension), capped at 5 MB, stored under a random name, and SHA-256 hashed. Links must be `http(s)`.
2. **Routing.** A submission is auto-assigned to the active faculty member in the student's department with the fewest open reviews. If there is none it goes to a shared pool visible to all faculty and admins. Faculty can't act on items assigned to a colleague; admins can reassign.
3. **Review.** Decisions are claimed atomically, so two reviewers can't both finalize the same item. Approve/reject are final; *correction required* returns it to the student, who edits and resubmits (back to *Pending*, with full history kept).
4. **Credits.** On approval the active policy is applied: eligible platforms, minimum score (a score is required if the minimum is > 0), `floor(weeks ÷ weeksPerCredit)`, and a per-student cap. A certificate can produce at most one award (unique index). If it's approved but earns no credits, the reason is stored and shown to the student.
5. **Policies are versioned.** Saving creates a new version and retires the old one; past awards are never recalculated.
6. **Notifications** (bell in the header) for new assignments, decisions and resubmissions. **Audit log** records submissions, decisions, assignments, user changes, policy changes, password changes and exports.
7. **Duplicate warnings** flag the same file hash or the same platform + certificate ID used by *another* student; reviewers see them on the card.

## File storage
- **Default:** local disk (`server/uploads`, or `UPLOAD_DIR`). Files are never served statically; they're streamed by `GET /api/certifications/:id/proof` only to the owning student or a reviewer, with `nosniff`, a locked-down CSP and `no-store`.
- **Cloudinary (optional):** set `CLOUDINARY_*` and files are uploaded as `authenticated` (private) assets and delivered through short-lived signed URLs generated per authorised request. *This path was written against the Cloudinary SDK docs but could not be exercised without credentials. Try one upload in staging before relying on it.* On hosts with ephemeral disks (Render/Heroku free tiers) use Cloudinary or a persistent volume.

## Deploying
- Set `NODE_ENV=production`, a 32+ char `JWT_SECRET`, `CLIENT_URL` (comma-separate multiple origins), `TRUST_PROXY=1` behind one proxy, and build the client with `VITE_API_URL=https://your-api/api`.
- Same site (e.g. `app.example.edu` + `api.example.edu`): keep `COOKIE_SAMESITE=lax`. Different sites: `COOKIE_SAMESITE=none` (HTTPS required).
- Auth uses an httpOnly cookie, so state-changing requests rely on SameSite plus CORS with a JSON/multipart content type. If you deploy cross-site with `none`, add CSRF tokens.

## Tests
```bash
npm test                      # unit tests + API integration tests
npm --prefix server run test:unit   # no database needed
```
Integration tests run against `MONGODB_URI_TEST` if set (**that database is dropped**), otherwise they start `mongodb-memory-server` (downloads a `mongod` binary on first run).

## API overview
`/api/auth` register · login · logout · me · profile · password  
`/api/certifications` dashboard · my · credits · review-queue · POST / · GET/PUT/DELETE /:id · GET /:id/proof · PATCH /:id/review · PATCH /:id/assign  
`/api/notifications` list · PATCH /:id/read · PATCH /read-all  
`/api/admin` users (list/create/update/reset-password) · faculty · credit-policy(ies) · reports · reports/credits.csv · audit-logs

## Known limits / next steps
- No email delivery (in-app notifications only), OCR, or malware scanning for uploads. Scan before real institutional use.
- Credit cap is checked at award time; two *simultaneous* approvals for the same student could briefly exceed it. Wrap in a transaction (requires a replica set) if that matters.
- Sample credit rules are a placeholder, so set the real institutional policy before use.
