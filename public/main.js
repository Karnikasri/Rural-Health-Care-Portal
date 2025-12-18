// === LOGIN PAGE HELPERS ===
function togglePasswordVisibility() {
  const input = document.getElementById("password-input");
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}

// === HELPER ===
function getPatientIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("patientId");
  return id || "UNKNOWN";
}
function getFromDoctorIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("fromDoctorId") || null;
}

// store address + profile image in memory after load
let currentPatientAddress = "";
let currentProfileImageData = null;
let currentPatientAge = null;
let currentPatientGender = null;

// === PATIENT DASHBOARD RENDER USING BACKEND + PRESCRIPTION HISTORY ===
async function renderPatientDashboard() {
  const patientId = getPatientIdFromQuery();

  try {
    const res = await fetch(`/api/patients/${patientId}/dashboard`);
    if (!res.ok) {
      throw new Error("Failed to load dashboard data");
    }

    const payload = await res.json();
    const patient = payload.patient || {};
    const appointments = payload.appointments || [];
    const history = payload.history || [];

    // ------- Top card -------
    const nameEl = document.getElementById("pd-name");
    const agEl = document.getElementById("pd-age-gender");
    const phoneEl = document.getElementById("pd-phone");
    const emailEl = document.getElementById("pd-email");

    if (nameEl) nameEl.textContent = patient.name || "Patient Name";

    if (agEl) {
      const ageText = patient.age != null ? patient.age : "--";
      const genderText = patient.gender || "--";
      agEl.textContent = `Age: ${ageText}, ${genderText}`;
    }

    if (phoneEl) phoneEl.textContent = patient.phone || "+--";
    if (emailEl) emailEl.textContent = patient.email || "someone@example.com";

    currentPatientAddress = patient.address || "";
    currentPatientAge = patient.age || null;
    currentPatientGender = patient.gender || null;

    // initials in user icon
    const initialsSpan = document.querySelector(".user-initials");
    if (initialsSpan && patient.name) {
      const parts = patient.name.split(" ");
      const initials =
        (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
      initialsSpan.textContent = initials.toUpperCase();
    }

    // avatar picture if stored
    const avatar = document.querySelector(".avatar-placeholder");
    if (avatar && patient.profileImage) {
      avatar.style.backgroundImage = `url(${patient.profileImage})`;
      avatar.style.backgroundSize = "cover";
      currentProfileImageData = patient.profileImage;
    }

    // ------- Appointments card -------
    const apptContainer = document.getElementById("pd-appointments");
    if (apptContainer) {
      apptContainer.innerHTML = "";

      const now = new Date();

      appointments.forEach((appt) => {
        const block = document.createElement("div");
        block.className = "appt-block";

        const dateStr = appt.date || appt.appointmentDate || "";
        const rawTime = appt.time || "";        // "10:00" or "1000"
        let timeStr = rawTime;

        // normalise to "HH:mm"
        if (/^\d{4}$/.test(rawTime)) {
          // "1000" -> "10:00"
          timeStr = `${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}`;
        }

        let apptDateTime = null;
        if (dateStr && /^\d{2}:\d{2}$/.test(timeStr)) {
          apptDateTime = new Date(`${dateStr}T${timeStr}:00`);
        }

        const isUpcoming =
          appt.status === "upcoming" &&
          apptDateTime instanceof Date &&
          !isNaN(apptDateTime.getTime()) &&
          apptDateTime >= now;

        const appointmentId =
          appt.appointmentId || `A-STATIC-${Date.now()}`;

        const safeDoctorId = appt.doctorId || "D001"; // fallback

        block.dataset.appointmentId = appointmentId;
        block.dataset.doctorId = safeDoctorId;
        block.dataset.date = dateStr;
        block.dataset.time = timeStr;

        const btnLabel = isUpcoming ? "Reschedule" : "View Details";

        block.innerHTML = `
          <p class="appt-label ${isUpcoming ? "upcoming" : ""}">
            ${isUpcoming ? "Upcoming Appointment" : "Past Appointment"}
          </p>
          <div class="appt-row">
            <div>
              <p class="doctor">${appt.doctor || appt.doctorName || "Doctor"}</p>
              <p class="muted">
                ${appt.dateTime || `${dateStr} ${timeStr}`}
              </p>
            </div>
            <div>
              <button class="secondary-btn">${btnLabel}</button>
            </div>
          </div>
        `;

        const btn = block.querySelector("button");
        if (isUpcoming) {
          btn.onclick = () =>
            openRescheduleModal(
              appt.doctor || appt.doctorName || "Doctor",
              safeDoctorId,
              appointmentId
            );
        } else {
          btn.onclick = () =>
            openDetailsModal(
              appt.doctor || appt.doctorName || "Doctor",
              appointmentId
            );
        }

        apptContainer.appendChild(block);
      });
    }

    // ------- Medical history card (existing + prescriptions) -------
    let presHistory = [];
    try {
      const presRes = await fetch(
        `/api/prescriptions/by-patient/${patientId}`
      );
      if (presRes.ok) {
        const presList = await presRes.json();
        presHistory = presList.map((p) => ({
          medicine: `Prescription for ${p.appointmentId || ""}`,
          date: p.createdAt
            ? new Date(p.createdAt).toLocaleDateString()
            : "",
          remarksLabel: (p.doctorName || "Doctor") + "'s Remarks",
          remarks: p.remarks || "No remarks",
        }));
      }
    } catch (e) {
      console.error("history/pres load error", e);
    }

    const combinedHistory = [...history, ...presHistory];

    const historyContainer = document.getElementById("pd-history");
    if (historyContainer) {
      historyContainer.innerHTML = "";
      combinedHistory.forEach((item) => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
          <div class="history-header">
            <span class="history-title">${item.medicine}</span>
            <span class="muted small">${item.date || ""}</span>
          </div>
          <p class="remarks-label">${item.remarksLabel}</p>
          <p class="muted">${item.remarks}</p>
        `;
        historyContainer.appendChild(div);
      });
    }
  } catch (err) {
    alert("Could not load dashboard data.");
    console.error(err);
  }
}

// === DASHBOARD MODALS (RESCHEDULE USING BACKEND) ===
let currentReschedule = {
  appointmentId: null,
  doctorId: null,
  doctorName: null,
};

function openRescheduleModal(doctorName, doctorId, appointmentId) {
  const title = document.getElementById("dash-modal-title");
  const text = document.getElementById("dash-modal-text");
  const modal = document.getElementById("dash-modal");
  const slotContainer = document.getElementById("dash-time-slots");
  if (!modal || !title || !text || !slotContainer) return;

  currentReschedule = { appointmentId, doctorId, doctorName };

  title.textContent = "Reschedule Appointment";
  text.textContent = `Choose a new time for your appointment with ${doctorName}.`;

  const slots = ["09:00", "10:00", "11:00", "14:00", "16:00"];
  slotContainer.innerHTML = "";
  slots.forEach((time) => {
    const btn = document.createElement("button");
    btn.className = "time-slot-btn";
    btn.textContent = time;
    btn.onclick = () => selectTimeSlot(btn, time);
    slotContainer.appendChild(btn);
  });

  modal.style.display = "flex";
}

async function selectTimeSlot(button, newTime) {
  document
    .querySelectorAll(".time-slot-btn")
    .forEach((b) => b.classList.remove("selected"));
  button.classList.add("selected");

  const newDate = prompt(
    "Enter new date for this appointment (YYYY-MM-DD):",
    new Date().toISOString().slice(0, 10)
  );
  if (!newDate) {
    alert("Reschedule cancelled: no date chosen.");
    return;
  }

  try {
    const res = await fetch("/api/appointments/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: currentReschedule.appointmentId,
        newDate,
        newTime,
      }),
    });

    if (res.status === 409) {
      const data = await res.json();
      alert(data.error || "Slot already booked.");
      return;
    }
    if (!res.ok) {
      alert("Could not reschedule appointment.");
      return;
    }
    alert(`New time saved: ${newDate} ${newTime}.`);
    closeDashModal();
  } catch (err) {
    console.error(err);
    alert("Error while rescheduling.");
  }
}

// show summary for past appointment
async function openDetailsModal(doctorName, appointmentId) {
  const title = document.getElementById("dash-modal-title");
  const text = document.getElementById("dash-modal-text");
  const modal = document.getElementById("dash-modal");
  const slotContainer = document.getElementById("dash-time-slots");
  if (!modal || !title || !text || !slotContainer) return;

  title.textContent = "Appointment Details";
  slotContainer.innerHTML = "";

  try {
    const res = await fetch(`/api/appointments/${appointmentId}`);
    if (!res.ok) {
      text.textContent = `Details not available for this appointment with ${doctorName}.`;
    } else {
      const appt = await res.json();
      text.innerHTML = `
        <div class="modal-row"><span>Doctor:</span><span>${doctorName}</span></div>
        <div class="modal-row"><span>Date:</span><span>${appt.date || ""}</span></div>
        <div class="modal-row"><span>Time:</span><span>${appt.time || ""}</span></div>
        <div class="modal-row"><span>Summary:</span><span>${appt.summary || "No summary entered yet."}</span></div>
      `;
    }
  } catch (e) {
    console.error(e);
    text.textContent = "Could not load details.";
  }

  modal.style.display = "flex";
}

function closeDashModal() {
  const modal = document.getElementById("dash-modal");
  if (modal) modal.style.display = "none";
}

// === PROFILE MENU HANDLERS ===
function toggleUserMenu() {
  const dd = document.getElementById("user-menu-dropdown");
  if (!dd) return;
  dd.style.display = dd.style.display === "block" ? "none" : "block";
}

function openProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;
  document.getElementById("profile-name").textContent =
    document.getElementById("pd-name").textContent;
  document.getElementById("profile-age-gender").textContent =
    document.getElementById("pd-age-gender").textContent;
  document.getElementById("profile-phone").textContent =
    document.getElementById("pd-phone").textContent;
  document.getElementById("profile-email").textContent =
    document.getElementById("pd-email").textContent;
  const addrEl = document.getElementById("profile-address");
  if (addrEl) addrEl.textContent = currentPatientAddress;
  modal.style.display = "flex";
}

function closeProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (modal) modal.style.display = "none";
}

function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;

  const patientId = getPatientIdFromQuery();
  fetch(`/api/patients/${patientId}/dashboard`)
    .then((res) => res.json())
    .then((data) => {
      const patient = data.patient || {};
      document.getElementById("settings-name").value = patient.name || "";
      document.getElementById("settings-phone").value = patient.phone || "";
      document.getElementById("settings-email").value = patient.email || "";
      document.getElementById("settings-address").value = patient.address || "";
      document.getElementById("settings-age").value = patient.age || "";
      document.getElementById("settings-gender").value = patient.gender || "";
    })
    .catch((err) => console.error(err));

  modal.style.display = "flex";
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.style.display = "none";
}

function handleProfileImageChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    currentProfileImageData = reader.result;
    const avatar = document.querySelector(".avatar-placeholder");
    if (avatar) {
      avatar.style.backgroundImage = `url(${currentProfileImageData})`;
      avatar.style.backgroundSize = "cover";
    }
  };
  reader.readAsDataURL(file);
}

// === SAVE SETTINGS (PROFILE UPDATE, FRONTEND) ===
async function saveSettings() {
  const patientId = getPatientIdFromQuery();

  const name = document.getElementById("settings-name").value;
  const phone = document.getElementById("settings-phone").value;
  const email = document.getElementById("settings-email").value;
  const address = document.getElementById("settings-address").value;
  const age = document.getElementById("settings-age").value;
  const gender = document.getElementById("settings-gender").value;

  if (!name || !phone || !email) {
    alert("Name, Phone, and Email are required.");
    return;
  }

  try {
    const res = await fetch(`/api/patients/${patientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        email,
        address,
        age: age ? parseInt(age, 10) : null,
        gender,
        profileImage: currentProfileImageData,
      }),
    });

    if (!res.ok) {
      alert("Failed to save profile.");
      return;
    }

    // Update the display immediately
    const nameEl = document.getElementById("pd-name");
    const agEl = document.getElementById("pd-age-gender");
    const phoneEl = document.getElementById("pd-phone");
    const emailEl = document.getElementById("pd-email");

    if (nameEl) nameEl.textContent = name || "Patient Name";
    if (agEl) {
      const ageText = age || "0";
      const genderText = gender || "--";
      agEl.textContent = `Age: ${ageText}, ${genderText}`;
    }
    if (phoneEl) phoneEl.textContent = phone || "+--";
    if (emailEl) emailEl.textContent = email || "someone@example.com";

    alert("Profile updated successfully!");
    closeSettingsModal();
  } catch (err) {
    console.error(err);
    alert("Error saving profile.");
  }
}

// === PRESCRIPTION UPLOAD (patient side) ===
async function handlePrescriptionUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const patientId = getPatientIdFromQuery();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("patientId", patientId);

  try {
    const res = await fetch("/api/prescriptions/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      alert("Upload failed.");
      return;
    }
    alert("Prescription uploaded successfully.");
  } catch (e) {
    console.error(e);
    alert("Error while uploading prescription.");
  }
}

// === BOOK PAGE FILTERS ===
function filterBySpecialization() {
  const select = document.getElementById("specialization-filter");
  if (!select) return;
  const value = select.value;
  const cards = document.querySelectorAll(".doctor-card");
  cards.forEach((card) => {
    const spec = card.getAttribute("data-specialization");
    const matchesSpec =
      value === "All Specializations" || spec === value;
    const searchValue =
      document.getElementById("doctor-search")?.value.toLowerCase() ||
      "";
    const name = (card.getAttribute("data-name") || "").toLowerCase();
    const matchesName = name.includes(searchValue);
    card.style.display = matchesSpec && matchesName ? "flex" : "none";
  });
}

function filterDoctors() {
  const search =
    document.getElementById("doctor-search")?.value.toLowerCase() ||
    "";
  const currentSpec =
    document.getElementById("specialization-filter")?.value ||
    "All Specializations";
  const cards = document.querySelectorAll(".doctor-card");
  cards.forEach((card) => {
    const name = (card.getAttribute("data-name") || "").toLowerCase();
    const spec = card.getAttribute("data-specialization");
    const matchesName = name.includes(search);
    const matchesSpec =
      currentSpec === "All Specializations" || spec === currentSpec;
    card.style.display = matchesName && matchesSpec ? "flex" : "none";
  });
}

// === BOOK PAGE: MODAL + CREATE APPOINTMENT ===
function openBookingModal(doctorName, doctorId) {
  const modal = document.getElementById("modal");
  const doctorSpan = document.getElementById("modal-doctor");
  const hiddenId = document.getElementById("modal-doctor-id");
  if (!modal || !doctorSpan || !hiddenId) return;
  doctorSpan.textContent = doctorName;
  hiddenId.value = doctorId;
  modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";
}

async function confirmBooking() {
  const doctorSpan = document.getElementById("modal-doctor");
  const hiddenId = document.getElementById("modal-doctor-id");
  const dateInput = document.getElementById("appointment-date");
  const timeInput = document.getElementById("appointment-time");
  const reasonInput = document.getElementById("appointment-reason");
  const durationSelect = document.getElementById("appointment-duration");

  const doctorName = doctorSpan ? doctorSpan.textContent : "your doctor";
  const doctorId = hiddenId ? hiddenId.value : "D001";
  const date = dateInput ? dateInput.value : "";
  const time = timeInput ? timeInput.value : "";
  const reasonForVisit = reasonInput ? reasonInput.value : "";
  const durationMinutes = durationSelect
    ? Number(durationSelect.value)
    : 30;
  const patientId = getPatientIdFromQuery();

  if (!date || !time) {
    alert("Please select date and time.");
    return;
  }

  try {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        doctorId,
        doctorName,
        date,
        time,
        reasonForVisit,
        durationMinutes,
      }),
    });

    if (res.status === 409) {
      const data = await res.json();
      alert(data.error || "This slot is already booked.");
      return;
    }
    if (!res.ok) {
      alert("Booking failed.");
      return;
    }
    const created = await res.json();
    alert(
      `Appointment with ${doctorName} confirmed.\nID: ${created.appointmentId}`
    );
    closeModal();
  } catch (err) {
    console.error(err);
    alert("Something went wrong while booking.");
  }
}

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  const pageType = document.body.dataset.page;

  const patientId = getPatientIdFromQuery();
  const fromDoctorId = getFromDoctorIdFromQuery();
  const homeLink = document.getElementById("nav-home");
  const apptLink = document.getElementById("nav-appointments");

  if (patientId !== "UNKNOWN") {
    if (homeLink) {
      if (fromDoctorId) {
        // coming from doctor dashboard: Home should go back to doctor dashboard
        homeLink.href =
          `doctor-dashboard.html?doctorId=${encodeURIComponent(fromDoctorId)}`;
      } else {
        // normal patient login: Home stays on patient dashboard
        homeLink.href =
          `dashboard.html?patientId=${encodeURIComponent(patientId)}`;
      }
    }
    if (apptLink) {
      // appointments link is only for patient self‑service
      apptLink.href = `book.html?patientId=${encodeURIComponent(patientId)}`;
    }
  }

  if (pageType === "patient-dashboard" && patientId !== "UNKNOWN") {
    renderPatientDashboard();
  } else if (pageType === "patient-dashboard") {
    alert("Missing patientId in URL (e.g. ?patientId=P002).");
  } else if (pageType === "book") {
    // filters and booking handlers use inline attributes
  }
});

// ============AI===========
async function askAiAboutImage() {
  const fileInput = document.getElementById("ai-image-file");
  const questionInput = document.getElementById("ai-question");
  const answerBox = document.getElementById("ai-answer");

  if (!fileInput) {
    alert("AI fields not found on this page.");
    return;
  }

  const file = fileInput.files[0];
  const question = questionInput ? questionInput.value.trim() : "";

  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  formData.append("question", question);

  try {
    const res = await fetch("/api/ai/interpret-image", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "AI analysis failed");
      return;
    }

    if (answerBox) {
      answerBox.style.display = "block";
      answerBox.textContent = data.answer;
    } else {
      alert(data.answer);
    }
  } catch (e) {
    console.error(e);
    alert("Error talking to AI.");
  }
}
