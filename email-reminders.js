const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "key.env") });

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL } = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function sendAppointmentReminderEmail(appointment, patient, doctor) {
  if (!patient.email) return;

  const subject = `Appointment reminder with ${doctor?.name || "your doctor"}`;
  const dateText = appointment.date;
  const timeText = appointment.time;

  const html = `
    <p>Dear ${patient.name || "Patient"},</p>
    <p>This is a reminder for your upcoming appointment:</p>
    <ul>
      <li><strong>Date:</strong> ${dateText}</li>
      <li><strong>Time:</strong> ${timeText}</li>
      <li><strong>Doctor:</strong> ${doctor?.name || appointment.doctorName}</li>
      <li><strong>Reason:</strong> ${appointment.reasonForVisit || "General checkup"}</li>
    </ul>
    <p>If you need to reschedule, please log in to the Rural Health Care portal.</p>
    <p>Regards,<br/>Rural Health Care</p>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL || SMTP_USER,
    to: patient.email,
    subject,
    html,
  });
}

module.exports = {
  sendAppointmentReminderEmail,
};
