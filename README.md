# Rural Health Care – Web App

A simple full‑stack web application for managing rural healthcare appointments. Patients can register, log in, maintain their profile, book appointments with doctors, and view prescriptions. Doctors can log in to manage appointments and prescriptions, and an admin panel manages doctors, demo data, and email reminders.[1]

## Features

### Patient

- Sign up with basic details and secure (bcrypt‑hashed) password.  
- Log in using generated `patientId` (e.g. `P001`).  
- Dashboard showing:
  - Personal information (name, age, gender, contact, profile image).
  - Upcoming and past appointments (from MongoDB).
  - Medical history (demo history + prescriptions stored by doctors).  
- Update profile:
  - Name, phone, email, address, age, gender.
  - Profile image (stored as base64 in MongoDB).  
- Book appointments with available doctors:
  - Filter/search by specialization and doctor name.
  - 30 or 60 minute slots.
  - Prevents double‑booking for the same doctor, date, and overlapping time.  
- Upload prescription scans (stored as files under `uploads/` and linked to patient).  
- View prescriptions created by doctors for each appointment.

### Doctor

- Log in using username and password.
  - Demo doctors use simple plain‑text passwords.
  - Admin‑created doctors use bcrypt‑hashed passwords.  
- Doctor dashboard:
  - View upcoming and past appointments for that doctor.
  - Mark appointments as completed and add a visit summary.  
- Create and update prescriptions:
  - Medicines list with dosage and instructions.
  - Stored per appointment and visible to patients in their dashboard / prescription page.

### Admin

- Hard‑coded admin login: `admin / 01`.  
- Manage doctors via `admin-doctors.html`:
  - View existing doctors (loaded from MongoDB).
  - Add new doctors (auto IDs starting from `D006`, bcrypt‑hashed passwords).
  - Delete doctors.  

### Email Reminders

- Uses **Nodemailer** with SMTP credentials from `key.env`.[2]
- `email-reminders.js` exports `sendAppointmentReminderEmail(appointment, patient, doctor)` which builds an HTML email with date, time, doctor, and reason.  
- `POST /api/admin/send-upcoming-reminders` in `server.js`:
  - Finds all **upcoming** appointments whose `date` is between **today** and **tomorrow** (next 24 hours).[3]
  - Loads corresponding patients and doctors from MongoDB.
  - Sends reminder emails to each patient with a valid email address.  
- Can be triggered automatically using **Windows Task Scheduler** and a `.bat` file that runs:
  - `curl -X POST http://localhost:3000/api/admin/send-upcoming-reminders` at 8:00 AM every day.  
- Optional extension (already supported if you added `mode`):
  - `?mode=7d` to send reminders for appointments exactly **7 days later**, so patients get one email a week before and another within 24 hours.

### Demo Data & AI

- Debug routes to seed demo data:
  - Demo patients (`P001–P004`).
  - Demo doctors (`D001–D005`).
  - Demo appointments and prescriptions.  
- Simple AI helper using Google Gemini:
  - `POST /api/ai/interpret-image` to analyze uploaded medical images or answer text‑only questions.  

## Tech Stack

**Frontend**

- HTML, CSS (`style.css`), vanilla JavaScript (`main.js`).  
- Pages:
  - `index.html` – Login (Patient / Doctor / Admin)
  - `signup.html` – Patient signup
  - `dashboard.html` – Patient dashboard
  - `book.html` – Patient appointment booking
  - `doctor-dashboard.html` – Doctor dashboard
  - `prescription.html` – Prescription view
  - `admin-doctors.html` – Admin doctor management
  - `flow.html` – Patient journey (static)
  - `profile-settings.html` – Profile settings modal template

**Backend**

- Node.js, Express (`server.js`).  
- Multer for file uploads (prescription scans, AI images).  
- Bcrypt for password hashing.  
- Nodemailer for appointment reminder emails.[2]

**Database**

- MongoDB Atlas using Mongoose models:
  - `Patient`
  - `Doctor`
  - `Appointment`
  - `Prescription`

**AI**

- Google Generative AI (`@google/generative-ai`) for image/text interpretation.

## Project Structure

```text
.
├── public/
│   ├── index.html              # Login (Patient / Doctor / Admin)
│   ├── signup.html             # Patient signup
│   ├── dashboard.html          # Patient dashboard
│   ├── book.html               # Patient appointment booking
│   ├── doctor-dashboard.html   # Doctor dashboard
│   ├── prescription.html       # Prescription view
│   ├── admin-doctors.html      # Admin doctor management
│   ├── flow.html               # Patient journey page (static)
│   ├── profile-settings.html   # Profile settings modal template
│   ├── style.css               # Global styles
│   ├── main.js                 # Frontend logic (dashboard, booking, AI, etc.)
│   └── logo.png                # App logo
├── uploads/                    # Uploaded files (prescription scans, AI images)
├── server.js                   # Express server and APIs
├── email-reminders.js          # Nodemailer helper for reminder emails
├── key.env                     # Environment variables (API keys, DB URI, SMTP)
└── package.json
```

## Installation & Setup

### 1. Clone and install

```bash
git clone https://github.com/Karnikasri/Rural-Health-Care-Portal.git
cd Rural-Health-Care-Portal
npm install
```

### 2. Environment variables

Create `key.env` in the project root:

```ini
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=your_mongodb_atlas_uri   # or use the hardcoded URI in server.js

# SMTP for Nodemailer reminders
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
FROM_EMAIL=optional_from_address
```

If you are using the hardcoded Atlas URI already in `server.js`, only `GEMINI_API_KEY` and the SMTP variables for reminders are required.

### 3. Start the server

```bash
node server.js
```

The app runs at:

- `http://localhost:3000`

Express serves the `public` folder as static files, and all APIs are under `/api/...`.

## MongoDB Models (Summary)

### Patient

```js
{
  patientId: String, // "P001", "P002", ...
  name: String,
  age: Number,
  gender: String,
  phone: String,
  email: String,
  address: String,
  passwordHash: String, // bcrypt for real signups
  profileImage: String, // base64 or URL
}
```

### Doctor

```js
{
  doctorId: String,  // "D001", ...
  name: String,
  specialization: String,
  hospital: String,
  username: String,
  passwordHash: String, // plain for demo, bcrypt for admin‑created
}
```

### Appointment

```js
{
  appointmentId: String, // "A001" or "A-<timestamp>"
  patientId: String,
  doctorId: String,
  doctorName: String,
  patientName: String,
  date: String,          // "YYYY-MM-DD"
  time: String,          // "HHmm" or "HH:mm"
  durationMinutes: Number,
  status: String,        // "upcoming" | "completed" | "cancelled"
  reasonForVisit: String,
  summary: String,
}
```

### Prescription

```js
{
  appointmentId: String,
  patientId: String,
  doctorId: String,
  doctorName: String,
  patientName: String,
  remarks: String,
  fileUrl: String,       // for uploaded scans
  medicines: [
    { name: String, dosage: String, instructions: String }
  ]
}
```

## Key API Endpoints

### AI

- `POST /api/ai/interpret-image` – analyze image + question (or text‑only question).

### Auth

- `POST /api/login/patient`  
- `POST /api/signup/patient`  
- `POST /api/login/doctor`  
- `POST /api/login/admin`

### Patients

- `GET /api/patients/:patientId/dashboard` – patient info + appointments + history.  
- `PUT /api/patients/:patientId` – update profile (name, contact, age, gender, address, profileImage).

### Doctors (admin)

- `GET /api/admin/doctors`  
- `POST /api/admin/doctors`  
- `DELETE /api/admin/doctors/:doctorId`

### Appointments

- `POST /api/appointments` – create appointment (checks for overlapping slots).  
- `GET /api/appointments` – list appointments (optionally filter by doctor).  
- `POST /api/appointments/reschedule` – reschedule with conflict check.  
- `GET /api/appointments/:appointmentId` – single appointment details.

### Prescriptions

- `POST /api/prescriptions` – save/update prescription JSON for an appointment.  
- `GET /api/prescriptions/by-appointment/:appointmentId`  
- `GET /api/prescriptions/by-patient/:patientId`  
- `POST /api/prescriptions/upload` – upload prescription scan file.

### Email Reminders

- `POST /api/admin/send-upcoming-reminders` – send reminder emails for appointments happening in the **next 24 hours** (today..tomorrow).[3]
- (Optional) `POST /api/admin/send-upcoming-reminders?mode=7d` – send reminders for appointments scheduled **7 days from now**, if the extended logic is enabled in `server.js`.

### Debug / Demo

- `GET /api/debug/create-demo-patients`  
- `GET /api/debug/create-demo-doctors`  
- `GET /api/debug/create-demo-appointments`  
- `GET /api/debug/create-demo-prescriptions`  
- `GET /api/debug/patients`

Use these debug routes once after starting the server to pre‑populate demo data.

## Usage Notes

- **Patient login**: use the assigned `patientId` (e.g. `P001`) and password from signup or demo seed data.  
- **Doctor login (demo)**:
  - `alan / password1`  
  - `maria / password2`  
  - `emily / password3`  
  - `ravi / password4`  
  - `fatima / password5`  
- **Admin login**: `admin / 01`.  
- Once logged in as a patient, navigation links (Home, Appointments) keep the `patientId` in the URL so the dashboard and booking pages stay linked to the same patient session.
