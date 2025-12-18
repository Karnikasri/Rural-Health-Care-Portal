const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require("bcrypt");
const BCRYPT_ROUNDS = 10; // you can increase later
const { sendAppointmentReminderEmail } = require("./email-reminders");


require("dotenv").config({ path: path.join(__dirname, "key.env") });

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ===== MULTER (single definition) =====
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) =>
      cb(null, path.join(__dirname, "uploads")),
    filename: (req, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname),
  }),
});

// ===== AI INTERPRET ROUTE (Gemini, image + text or text only) =====
app.post(
  "/api/ai/interpret-image",
  upload.single("file"),
  async (req, res) => {
    try {
      const question =
        req.body.question ||
        "Explain common symptoms and possible causes.";

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      let prompt;

      if (!req.file) {
        // TEXT-ONLY MODE
        prompt = [
          {
            text: `The patient asked: "${question}". Provide a clear, detailed medical explanation in simple language, expanding the answer to about 5–7 sentences. Include likely causes, key symptoms to watch for, and practical steps the patient can take at home to improve the condition, along with guidance on when to seek medical care.`,
          },
        ];
      } else {
        // IMAGE + TEXT MODE
        prompt = [
          {
            text: `A patient uploaded a medical image file called "${req.file.originalname || "unknown"}" and asked: "${question}". Give a short, crisp ,good kind and clear explanation of the condition shown in this medical image. Do not use any formatting such as asterisks or bold, and do not include any disclaimers about AI limitations.`,
          },
          {
            inlineData: {
              data: fs.readFileSync(req.file.path).toString("base64"),
              mimeType: req.file.mimetype,
            },
          },
        ];
      }

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      res.json({ answer: text });
    } catch (err) {
      console.error("Gemini error:", err?.message ?? err);
      res.status(500).json({ error: "AI analysis failed" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// ===== MONGODB CONNECTION (Atlas URI from your project) =====
const MONGOURI = 'mongodb+srv://hospital_user:<password>@rural.qhlp81d.mongodb.net/?appName=Rural';
mongoose
  .connect(MONGOURI)
  .then(() => console.log("MongoDB connected (Atlas)"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ===== MONGOOSE SCHEMAS & MODELS =====
const { Schema, model } = mongoose;

// Patients
const patientSchema = new Schema(
  {
    patientId: { type: String, required: true, unique: true },
    name: String,
    age: Number,
    gender: String,
    phone: String,
    email: { type: String, unique: true, sparse: true },
    address: String,
    passwordHash: String, // demo only
    profileImage: String, // base64 or URL
  },
  { timestamps: true }
);

// Doctors
const doctorSchema = new Schema(
  {
    doctorId: { type: String, required: true, unique: true },
    name: String,
    specialization: String,
    hospital: String,
    username: { type: String, unique: true, sparse: true },
    passwordHash: String,
  },
  { timestamps: true }
);

// Prescriptions
const prescriptionSchema = new Schema(
  {
    appointmentId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    doctorName: String,
    patientName: String,
    remarks: String,
    fileUrl: String, // uploaded file path if any
    medicines: [
      {
        name: String,
        dosage: String,
        instructions: String,
      },
    ],
  },
  { timestamps: true }
);

// Appointments
const appointmentSchema = new Schema(
  {
    appointmentId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    doctorName: String,
    patientName: String,
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm
    durationMinutes: { type: Number, default: 30 },
    status: { type: String, default: "upcoming" }, // upcoming/completed/cancelled
    reasonForVisit: String,
    summary: String, // filled by doctor after visit
  },
  { timestamps: true }
);

const Patient = model("Patient", patientSchema);
const Doctor = model("Doctor", doctorSchema);
const Prescription = model("Prescription", prescriptionSchema);
const Appointment = model("Appointment", appointmentSchema);


// ===== EXPRESS MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// serve uploaded prescription files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// file uploads: prescription PDFs etc.
// const upload = multer({
//   dest: path.join(__dirname, "uploads"),
// });

// ===== OLD FAKE DATA FOR PATIENT HISTORY (used in dashboard) =====
const patientsFake = {
  P001: {
    id: "P001",
    name: "John Doe",
    age: 42,
    gender: "Male",
    phone: "+1 555 111-2222",
    email: "john.doe@example.com",
    appointments: [
      {
        type: "upcoming",
        doctor: "Dr. Smith (Cardiologist)",
        dateTime: "June 25, 2024 - 10:00 AM",
      },
      {
        type: "past",
        doctor: "Dr. Emily White (Dermatologist)",
        dateTime: "May 15, 2024 - 02:20 PM",
      },
    ],
    history: [
      {
        medicine: "Paracetamol",
        date: "May 10, 2023",
        remarksLabel: "Dr. White's Remarks",
        remarks: "Take one tablet after meals for 2 days.",
      },
    ],
  },
  P002: {
    id: "P002",
    name: "Jane Smith",
    age: 35,
    gender: "Female",
    phone: "+1 556 123-4667",
    email: "jane.smith@example.com",
    appointments: [
      {
        type: "upcoming",
        doctor: "Dr. Alan Brown (General Physician)",
        dateTime: "July 10, 2024 - 11:00 AM",
      },
    ],
    history: [
      {
        medicine: "Ibuprofen",
        date: "April 02, 2023",
        remarksLabel: "Dr. Brown's Remarks",
        remarks:
          "For muscle pain, take as needed, not more than 3 tablets a day.",
      },
    ],
  },
};


// ===== PATIENT LOGIN =====
app.post("/api/login/patient", async (req, res) => {
  try {
    const { username, password } = req.body; // username is patientId

    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const patient = await Patient.findOne({ patientId: username }).lean();
    if (!patient) {
      return res.status(401).json({ error: "Invalid login" });
    }

    let ok = false;

    // Case 1: real signup patient (bcrypt hash)
    if (patient.passwordHash && patient.passwordHash.startsWith("$2")) {
      ok = await bcrypt.compare(password, patient.passwordHash);
    } else {
      // Case 2: demo patient with plain password stored in passwordHash
      // or no passwordHash at all (you can set one manually later)
      ok = patient.passwordHash === password;
    }

    if (!ok) {
      return res.status(401).json({ error: "Invalid login" });
    }

    res.json({
      patientId: patient.patientId,
      name: patient.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// PATIENT SIGNUP (NEW)
app.post("/api/signup/patient", async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ error: "Name and password are required" });
    }

    // 1) Generate next patientId
    const last = await Patient.findOne().sort({ patientId: -1 }).lean();
    let nextId = "P001";
    if (last) {
      const num = parseInt(last.patientId.slice(1), 10) + 1;
      nextId = "P" + num.toString().padStart(3, "0");
    }

    // 2) Create patient
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const patient = await Patient.create({
      patientId: nextId,
      name,
      age,
      gender,
      phone,
      email,
      address,
      passwordHash: hashed, // store hash instead of plain password
    });


    res.status(201).json({ patientId: patient.patientId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});


// DEBUG: create demo doctors
app.get("/api/debug/create-demo-doctors", async (req, res) => {
  try {
    const demoDoctors = [
      {
        doctorId: "D001",
        name: "Dr. Alan Brown",
        specialization: "General Physician",
        hospital: "Rural Community Clinic, Block A",
        username: "alan",
        passwordHash: "password1",
      },
      {
        doctorId: "D002",
        name: "Dr. Maria Garcia",
        specialization: "Cardiologist",
        hospital: "District Hospital, Cardiology Wing",
        username: "maria",
        passwordHash: "password2",
      },
      {
        doctorId: "D003",
        name: "Dr. Emily White",
        specialization: "Dermatologist",
        hospital: "Rural Health Center, Skin Clinic",
        username: "emily",
        passwordHash: "password3",
      },
      {
        doctorId: "D004",
        name: "Dr. Ravi Mehta",
        specialization: "Pediatrician",
        hospital: "Children's Rural Clinic",
        username: "ravi",
        passwordHash: "password4",
      },
      {
        doctorId: "D005",
        name: "Dr. Fatima Noor",
        specialization: "ENT Specialist",
        hospital: "District ENT Hospital",
        username: "fatima",
        passwordHash: "password5",
      },
    ];

    await Doctor.deleteMany({
      doctorId: { $in: demoDoctors.map((d) => d.doctorId) },
    });
    await Doctor.insertMany(demoDoctors);
    res.json({ ok: true, count: demoDoctors.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create demo doctors" });
  }
});


// ===== SIMPLE TIME OVERLAP CHECK =====
function timesOverlap(startA, durA, startB, durB) {
  const [hA, mA] = startA.split(":").map(Number);
  const [hB, mB] = startB.split(":").map(Number);
  const aStart = hA * 60 + mA;
  const bStart = hB * 60 + mB;
  const aEnd = aStart + durA;
  const bEnd = bStart + durB;
  return aStart < bEnd && bStart < aEnd;
}

// ===== BASIC PATIENT API (FAKE + REAL MIX) =====

// old fake patients (not used by dashboard anymore, but kept for compatibility)
app.get("/api/patients/:id", (req, res) => {
  const patient = patientsFake[req.params.id];
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  res.json(patient);
});

// PATIENT DASHBOARD (uses Mongo patient + fake history)
app.get("/api/patients/:patientId/dashboard", async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findOne({ patientId }).lean();
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const appts = await Appointment.find({ patientId }).lean();

    res.json({
      patient,
      appointments: appts,
      history: patientsFake[patientId]?.history || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATIENT PROFILE UPDATE
// PATIENT PROFILE UPDATE
app.put("/api/patients/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { name, phone, email, address, profileImage, age, gender } = req.body;

    const updated = await Patient.findOneAndUpdate(
      { patientId },
      {
        name,
        phone,
        email,
        address,
        profileImage,
        age,
        gender,
      },
      { new: true, upsert: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update patient" });
  }
});


// ===== DOCTOR LOGIN (plain text for demo) =====
app.post("/api/login/doctor", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const doc = await Doctor.findOne({ username }).lean();
    if (!doc) return res.status(401).json({ error: "Invalid login" });

    // plain comparison (demo only)
    if (doc.passwordHash !== password) {
      return res.status(401).json({ error: "Invalid login" });
    }

    res.json({
      doctorId: doc.doctorId,
      name: doc.name,
      specialization: doc.specialization,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== DOCTOR LOGIN (plain for demo + bcrypt for admin-created) =====
app.post("/api/login/doctor", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const doc = await Doctor.findOne({ username }).lean();
    if (!doc) {
      return res.status(401).json({ error: "Invalid login" });
    }

    let ok = false;

    // If passwordHash looks like a bcrypt hash (starts with $2), use bcrypt
    if (doc.passwordHash && doc.passwordHash.startsWith("$2")) {
      ok = await bcrypt.compare(password, doc.passwordHash);
    } else {
      // demo doctors with plain passwords
      ok = doc.passwordHash === password;
    }

    if (!ok) {
      return res.status(401).json({ error: "Invalid login" });
    }

    res.json({
      doctorId: doc.doctorId,
      name: doc.name,
      specialization: doc.specialization,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN LOGIN (hard-coded) =====
app.post("/api/login/admin", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "01") {
    return res.json({ ok: true });
  }

  return res.status(401).json({ error: "Invalid admin credentials" });
});

// ===== DOCTOR LOGIN (plain for demo + bcrypt for admin-created) =====
app.post("/api/login/doctor", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const doc = await Doctor.findOne({ username }).lean();
    if (!doc) {
      return res.status(401).json({ error: "Invalid login" });
    }

    let ok = false;

    // bcrypt for admin‑created doctors
    if (doc.passwordHash && doc.passwordHash.startsWith("$2")) {
      ok = await bcrypt.compare(password, doc.passwordHash);
    } else {
      // plain for demo doctors
      ok = doc.passwordHash === password;
    }

    if (!ok) {
      return res.status(401).json({ error: "Invalid login" });
    }

    res.json({
      doctorId: doc.doctorId,
      name: doc.name,
      specialization: doc.specialization,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN LOGIN (hard-coded) =====
app.post("/api/login/admin", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "01") {
    return res.json({ ok: true });
  }

  return res.status(401).json({ error: "Invalid admin credentials" });
});

// ===== ADMIN DOCTOR CRUD =====

// CREATE doctor (admin only) – IDs start from D006
app.post("/api/admin/doctors", async (req, res) => {
  try {
    const { name, specialization, hospital, username, password } = req.body;

    if (!name || !username || !password) {
      return res
        .status(400)
        .json({ error: "Name, username and password are required" });
    }

    const existing = await Doctor.findOne({ username }).lean();
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Find last doctor whose id is >= D006, otherwise start at D006
    const last = await Doctor.findOne({ doctorId: { $gte: "D006" } })
      .sort({ doctorId: -1 })
      .lean();

    let nextId = "D006";
    if (last) {
      const num = parseInt(last.doctorId.slice(1), 10) + 1;
      nextId = "D" + num.toString().padStart(3, "0");
    }

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const doc = await Doctor.create({
      doctorId: nextId,
      name,
      specialization,
      hospital,
      username,
      passwordHash: hashed,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Doctor create failed" });
  }
});

// LIST all doctors (admin view)
app.get("/api/admin/doctors", async (_req, res) => {
  try {
    const list = await Doctor.find().lean();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load doctors" });
  }
});

// DELETE doctor (admin remove)
app.delete("/api/admin/doctors/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    await Doctor.deleteOne({ doctorId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete doctor" });
  }
});


// ===== DOCTOR DASHBOARD DATA =====
app.get("/api/doctors/:doctorId/dashboard", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await Doctor.findOne({ doctorId }).lean();
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const appts = await Appointment.find({ doctorId }).lean();
    res.json({ doctor, appointments: appts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== DEBUG APIS FOR PATIENTS =====
app.get("/api/debug/create-demo-patient", async (req, res) => {
  try {
    const p = await Patient.create({
      patientId: "P001",
      name: "John Doe",
      age: 42,
      gender: "Male",
      phone: "+1 555 111-2222",
      email: "john.doe@example.com",
      address: "Demo Address",
    });
    res.status(201).json(p);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create demo patient" });
  }
});

// demo patients P001..P004
app.get("/api/debug/create-demo-patients", async (req, res) => {
  try {
    const demoPatients = [
      {
        patientId: "P001",
        name: "John Doe",
        age: 42,
        gender: "Male",
        phone: "+1 555 111-2222",
        email: "john.doe@example.com",
        address: "Demo Street 1",
      },
      {
        patientId: "P002",
        name: "Jane Smith",
        age: 35,
        gender: "Female",
        phone: "+1 555 222-3333",
        email: "jane.smith@example.com",
        address: "Demo Street 2",
      },
      {
        patientId: "P003",
        name: "Ravi Kumar",
        age: 29,
        gender: "Male",
        phone: "+91 90000 11111",
        email: "ravi.kumar@example.com",
        address: "Demo Nagar",
      },
      {
        patientId: "P004",
        name: "Fatima Noor",
        age: 31,
        gender: "Female",
        phone: "+91 90000 22222",
        email: "fatima.noor@example.com",
        address: "Demo Colony",
      },
    ];

    await Patient.deleteMany({
      patientId: { $in: demoPatients.map((p) => p.patientId) },
    });
    await Patient.insertMany(demoPatients);
    res.json({ ok: true, count: demoPatients.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create demo patients" });
  }
});

app.get("/api/debug/patients", async (req, res) => {
  try {
    const list = await Patient.find().lean();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// ===== DEBUG APIS FOR DOCTORS =====
// DEBUG: create demo doctors (plain passwords)
app.get("/api/debug/create-demo-doctors", async (req, res) => {
  try {
    const demoDoctors = [
      {
        doctorId: "D001",
        name: "Dr. Alan Brown",
        specialization: "General Physician",
        hospital: "Rural Community Clinic, Block A",
        username: "alan",
        passwordHash: "password1",
      },
      {
        doctorId: "D002",
        name: "Dr. Maria Garcia",
        specialization: "Cardiologist",
        hospital: "District Hospital, Cardiology Wing",
        username: "maria",
        passwordHash: "password2",
      },
      {
        doctorId: "D003",
        name: "Dr. Emily White",
        specialization: "Dermatologist",
        hospital: "Rural Health Center, Skin Clinic",
        username: "emily",
        passwordHash: "password3",
      },
      {
        doctorId: "D004",
        name: "Dr. Ravi Mehta",
        specialization: "Pediatrician",
        hospital: "Children's Rural Clinic",
        username: "ravi",
        passwordHash: "password4",
      },
      {
        doctorId: "D005",
        name: "Dr. Fatima Noor",
        specialization: "ENT Specialist",
        hospital: "District ENT Hospital",
        username: "fatima",
        passwordHash: "password5",
      },
    ];

    await Doctor.deleteMany({
      doctorId: { $in: demoDoctors.map((d) => d.doctorId) },
    });
    await Doctor.insertMany(demoDoctors);
    res.json({ ok: true, count: demoDoctors.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create demo doctors" });
  }
});

// ===== APPOINTMENT BOOKING (30/60 min, no double-book) =====
app.post("/api/appointments", async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      doctorName,
      date,
      time,
      reasonForVisit,
      durationMinutes,
    } = req.body;

    if (!patientId || !doctorId || !date || !time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const duration = durationMinutes === 60 ? 60 : 30;

    const sameDay = await Appointment.find({ doctorId, date }).lean();
    const conflict = sameDay.some((a) =>
      timesOverlap(a.time, a.durationMinutes || 30, time, duration)
    );
    if (conflict) {
      return res.status(409).json({ error: "This slot is already booked." });
    }

    const appointmentId = "A-" + Date.now();

    const patient = await Patient.findOne({ patientId }).lean();

    const appt = await Appointment.create({
      appointmentId,
      patientId,
      doctorId,
      doctorName,
      patientName: patient?.name || "",
      date,
      time,
      durationMinutes: duration,
      reasonForVisit,
      status: "upcoming",
    });

    res.status(201).json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Booking failed" });
  }
});

// GET all appointments (optionally filter by doctor)
app.get("/api/appointments", async (req, res) => {
  try {
    const { doctorId } = req.query;
    const filter = {};
    if (doctorId) filter.doctorId = doctorId;
    const list = await Appointment.find(filter).lean();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load appointments" });
  }
});

// RESCHEDULE APPOINTMENT
app.post("/api/appointments/reschedule", async (req, res) => {
  try {
    const { appointmentId, newDate, newTime } = req.body;
    if (!appointmentId || !newDate || !newTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const appt = await Appointment.findOne({ appointmentId });
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const sameDay = await Appointment.find({
      doctorId: appt.doctorId,
      date: newDate,
      appointmentId: { $ne: appointmentId },
    }).lean();

    const conflict = sameDay.some((a) =>
      timesOverlap(
        a.time,
        a.durationMinutes || 30,
        newTime,
        appt.durationMinutes || 30
      )
    );
    if (conflict) {
      return res.status(409).json({ error: "Slot already booked." });
    }

    appt.date = newDate;
    appt.time = newTime;
    await appt.save();

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reschedule appointment" });
  }
});

// GET SINGLE APPOINTMENT
app.get("/api/appointments/:appointmentId", async (req, res) => {
  try {
    const appt = await Appointment.findOne({
      appointmentId: req.params.appointmentId,
    }).lean();
    if (!appt) return res.status(404).json({ error: "Not found" });
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DOCTOR COMPLETES APPOINTMENT, ADDS SUMMARY + PRESCRIPTION
app.post("/api/appointments/:appointmentId/summary", async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    const { summary } = req.body;

    const appt = await Appointment.findOne({ appointmentId }).lean();
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    await Appointment.updateOne(
      { appointmentId },
      { $set: { summary: summary || "", status: "completed" } }
    );

    await Prescription.findOneAndUpdate(
      { appointmentId },
      {
        appointmentId,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        doctorName: appt.doctorName,
        patientName: appt.patientName,
        remarks: summary || "",
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save summary" });
  }
});

// ===== PRESCRIPTION SAVE/LOAD JSON (doctor side, full meds) =====
app.post("/api/prescriptions", async (req, res) => {
  try {
    const {
      appointmentId,
      patientId,
      doctorId,
      doctorName,
      patientName,
      remarks,
      medicines,
    } = req.body;

    if (!appointmentId || !patientId || !doctorId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let pres = await Prescription.findOne({ appointmentId });
    if (!pres) {
      pres = await Prescription.create({
        appointmentId,
        patientId,
        doctorId,
        doctorName,
        patientName,
        remarks: remarks || "",
        medicines: medicines || [],
      });
    } else {
      pres.doctorName = doctorName || pres.doctorName;
      pres.patientName = patientName || pres.patientName;
      pres.remarks = remarks || pres.remarks;
      pres.medicines = medicines || pres.medicines;
      await pres.save();
    }

    res.status(201).json(pres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save prescription" });
  }
});

// EMAIL REMINDERS FOR UPCOMING APPOINTMENTS { mode=24h (default) or mode=7d }
app.post("/api/admin/send-upcoming-reminders", async (req, res) => {
  try {
    const mode = req.query.mode || "24h";
    const now = new Date();

    let startDate, endDate;

    if (mode === "7d") {
      // appointments happening 7 days from now (whole day)
      const target = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dayStr = target.toISOString().slice(0, 10);
      startDate = dayStr;
      endDate = dayStr;
    } else {
      // default: next 24 hours (today..tomorrow)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      startDate = now.toISOString().slice(0, 10);
      endDate = tomorrow.toISOString().slice(0, 10);
    }

    const appts = await Appointment.find({
      status: "upcoming",
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    if (!appts.length) {
      return res.json({ ok: true, count: 0 });
    }

    const patientIds = [...new Set(appts.map((a) => a.patientId))];
    const doctorIds = [...new Set(appts.map((a) => a.doctorId))];

    const patients = await Patient.find({ patientId: { $in: patientIds } }).lean();
    const doctors = await Doctor.find({ doctorId: { $in: doctorIds } }).lean();

    const patientMap = new Map(patients.map((p) => [p.patientId, p]));
    const doctorMap = new Map(doctors.map((d) => [d.doctorId, d]));

    let sent = 0;
    for (const appt of appts) {
      const patient = patientMap.get(appt.patientId);
      const doctor = doctorMap.get(appt.doctorId);
      if (!patient) continue;
      try {
        await sendAppointmentReminderEmail(appt, patient, doctor);
        sent += 1;
      } catch (e) {
        console.error("Reminder email error for", appt.appointmentId, e);
      }
    }

    res.json({ ok: true, count: sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send reminders" });
  }
});

// PRESCRIPTION BY APPOINTMENT (for prescription.html)
app.get("/api/prescriptions/by-appointment/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const pres = await Prescription.findOne({ appointmentId }).lean();
    if (!pres) {
      return res.status(404).json({
        error: "No prescription for this appointment",
      });
    }
    res.json(pres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch prescription" });
  }
});

// PRESCRIPTIONS LIST BY PATIENT (doctor & patient history)
app.get("/api/prescriptions/by-patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const list = await Prescription.find({ patientId }).lean();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch prescriptions" });
  }
});

// PRESCRIPTION FILE UPLOAD (patient uploads scan)
app.post(
  "/api/prescriptions/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const { patientId } = req.body;
      if (!patientId || !req.file) {
        return res
          .status(400)
          .json({ error: "Missing file or patientId" });
      }

      await Prescription.create({
      appointmentId: `UP-${Date.now()}`,
      patientId,
      doctorId: "UNKNOWN",
      doctorName: "",
      patientName: "",
      remarks: "Uploaded prescription file",
      fileUrl: `uploads/${req.file.filename}`,
      medicines: [],
    });


      res.status(201).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// ===== DEBUG: DEMO APPOINTMENTS & PRESCRIPTIONS =====
app.get("/api/debug/create-demo-appointments", async (req, res) => {
  try {
    const demo = [
      {
        appointmentId: "A001",
        patientId: "P001",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "John Doe",
        date: "2025-10-27",
        time: "10:00",
        durationMinutes: 30,
        status: "completed",
        reasonForVisit: "Fever and cold",
        summary: "Recovered well.",
      },
      {
        appointmentId: "A002",
        patientId: "P002",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "Jane Smith",
        date: "2025-10-28",
        time: "11:00",
        durationMinutes: 30,
        status: "upcoming",
        reasonForVisit: "Headache",
      },
      {
        appointmentId: "A003",
        patientId: "P003",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "Ravi Kumar",
        date: "2025-10-29",
        time: "12:00",
        durationMinutes: 30,
        status: "upcoming",
        reasonForVisit: "Skin rash",
      },
      {
        appointmentId: "A004",
        patientId: "P004",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "Fatima Noor",
        date: "2025-10-30",
        time: "09:30",
        durationMinutes: 30,
        status: "completed",
        reasonForVisit: "Follow‑up",
        summary: "Stable.",
      },
    ];

    await Appointment.deleteMany({
      appointmentId: { $in: demo.map((d) => d.appointmentId) },
    });
    await Appointment.insertMany(demo);
    res.json({ ok: true, count: demo.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create demo appointments" });
  }
});

app.get("/api/debug/create-demo-prescriptions", async (req, res) => {
  try {
    const demoPrescriptions = [
      {
        appointmentId: "A001",
        patientId: "P001",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "John Doe",
        remarks:
          "The patient presented with symptoms of a mild upper respiratory tract infection. Recommended rest and symptomatic treatment.",
        medicines: [
          {
            name: "Paracetamol",
            dosage: "500 mg",
            instructions: "1 tablet, twice daily after food",
          },
          {
            name: "Cetirizine",
            dosage: "10 mg",
            instructions: "1 tablet at night before sleep",
          },
          {
            name: "Vitamin C",
            dosage: "500 mg",
            instructions: "1 tablet, once a day",
          },
          {
            name: "Azithromycin",
            dosage: "250 mg",
            instructions:
              "2 tablets on day 1, then 1 tablet daily for 4 days",
          },
        ],
      },
      {
        appointmentId: "A002",
        patientId: "P002",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "Jane Smith",
        remarks: "Headache and fatigue. Hydration and rest advised.",
        medicines: [
          {
            name: "Ibuprofen",
            dosage: "400 mg",
            instructions: "1 tablet as needed after food",
          },
        ],
      },
      {
        appointmentId: "A003",
        patientId: "P003",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "Ravi Kumar",
        remarks: "Skin rash. Apply ointment twice daily.",
        medicines: [
          {
            name: "Hydrocortisone cream",
            dosage: "thin layer",
            instructions: "Apply to affected area twice daily",
          },
        ],
      },
      {
        appointmentId: "A004",
        patientId: "P004",
        doctorId: "D001",
        doctorName: "Dr. Alan Brown",
        patientName: "Fatima Noor",
        remarks: "Follow‑up visit. Condition stable.",
        medicines: [],
      },
    ];

    await Prescription.deleteMany({
      appointmentId: { $in: demoPrescriptions.map((p) => p.appointmentId) },
    });
    await Prescription.insertMany(demoPrescriptions);
    res.json({ ok: true, count: demoPrescriptions.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create demo prescriptions" });
  }
});


// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
