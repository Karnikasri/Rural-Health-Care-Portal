async function loadDoctors() {
  const tbody = document.querySelector("#doctor-table tbody");
  tbody.innerHTML = "";
  try {
    const res = await fetch("/api/admin/doctors");
    if (!res.ok) throw new Error("Failed");
    const list = await res.json();
    list.forEach((d) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.doctorId}</td>
        <td>${d.name}</td>
        <td>${d.specialization || "-"}</td>
        <td>${d.hospital || "-"}</td>
        <td>${d.username}</td>
        <td><button class="danger-btn" data-id="${d.doctorId}">Remove</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".danger-btn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        if (!confirm("Remove doctor " + id + "?")) return;
        const resDel = await fetch(`/api/admin/doctors/${id}`, {
          method: "DELETE",
        });
        if (!resDel.ok) {
          alert("Could not delete doctor");
          return;
        }
        loadDoctors();
      };
    });
  } catch (e) {
    console.error(e);
    alert("Could not load doctors.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("admin-doctor-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("doc-name").value.trim(),
      specialization: document.getElementById("doc-spec").value.trim(),
      hospital: document.getElementById("doc-hospital").value.trim(),
      username: document.getElementById("doc-username").value.trim(),
      password: document.getElementById("doc-password").value,
    };
    if (!payload.name || !payload.username || !payload.password) {
      alert("Name, username and password are required.");
      return;
    }
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not create doctor");
        return;
      }
      form.reset();
      loadDoctors();
    } catch (e) {
      console.error(e);
      alert("Error creating doctor.");
    }
  });

  loadDoctors();
});
