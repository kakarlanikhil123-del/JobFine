/* ============================================================
   PART 1: HELPERS – popups, validated forms, toast, image gallery
   ============================================================ */
/* Shared helpers used by every demo site: DOM shortcuts, storage, toast, modal forms, image gallery. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

// ---------- Toast message ----------
let toastTimer;
function toast(message, isError) {
  let box = $("#toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.setAttribute("role", "status");
    document.body.append(box);
  }
  box.textContent = message;
  box.className = "on" + (isError ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = ""), 3200);
}

// ---------- Modal dialog (Esc closes automatically) ----------
function modal(html) {
  let dlg = $("#dlg");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "dlg";
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
  }
  dlg.innerHTML = `<button class="x" aria-label="Close" onclick="this.closest('dialog').close()">✕</button>${html}`;
  if (!dlg.open) dlg.showModal();
  return dlg;
}

// ---------- Validated form in a modal (mock only: nothing is sent anywhere) ----------
// fields: [{name,label,type,options,min,max}]  check(values) may return an error string.  done(values) returns a success message.
function formModal({
  title,
  intro = "Demo only. Do not enter real credentials or personal data.",
  fields,
  button = "Submit",
  check,
  done,
}) {
  const dlg = modal(`<h2>${title}</h2><p class="hint">${intro}</p><form novalidate>${fields
    .map(
      (f) => `
    <label>${f.label}${
      f.options
        ? `<select name="${f.name}">${f.options.map((o) => `<option>${o}</option>`).join("")}</select>`
        : `<input name="${f.name}" type="${f.type || "text"}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""}>`
    }
      <span class="err" data-for="${f.name}"></span></label>`,
    )
    .join("")}
    <p class="err" data-form></p><button class="primary">${button}</button></form>`);
  $("form", dlg).onsubmit = (e) => {
    e.preventDefault();
    const values = {};
    let ok = true;
    fields.forEach((f) => {
      const v = e.target.elements[f.name].value.trim();
      values[f.name] = v;
      let msg = "";
      if (!v) msg = "This field is required.";
      else if (f.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) msg = "Enter a valid email address.";
      else if (f.type === "password" && v.length < 6) msg = "Use at least 6 characters.";
      else if (f.type === "number" && (+v < f.min || +v > f.max))
        msg = `Enter a number from ${f.min} to ${f.max}.`;
      $(`[data-for="${f.name}"]`, dlg).textContent = msg;
      if (msg) ok = false;
    });
    const problem = ok && check ? check(values) : "";
    $("[data-form]", dlg).textContent = problem || "";
    if (!ok || problem) return;
    const message = done ? done(values) : "Done.";
    dlg.innerHTML = `<button class="x" aria-label="Close" onclick="this.closest('dialog').close()">✕</button><p class="ok" role="status">${message}</p><button class="primary" onclick="this.closest('dialog').close()">Close</button>`;
  };
}

// ---------- Image gallery: multi-upload, preview, replace, remove (saved in this browser only) ----------
function Gallery({ mount, key }) {
  const root = $(mount),
    TYPES = ["image/jpeg", "image/png", "image/webp"];
  let items = store.get(key, []);
  root.innerHTML = `<div class="g-bar"><label class="g-btn">＋ Add images<input type="file" multiple accept=".jpg,.jpeg,.png,.webp" hidden></label>
    <button class="g-btn" data-clear>Remove all</button><span class="g-msg" role="status"></span></div><div class="g-grid"></div>`;
  const grid = $(".g-grid", root),
    msg = $(".g-msg", root);
  const say = (m, bad) => {
    msg.textContent = m;
    msg.className = "g-msg" + (bad ? " bad" : "");
  };

  // Shrink large photos in the browser so they fit in storage
  const shrink = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 700 / Math.max(img.width, img.height)),
            c = document.createElement("canvas");
          c.width = img.width * k;
          c.height = img.height * k;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject(new Error(file.name + " could not be read."));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error(file.name + " could not be read."));
      reader.readAsDataURL(file);
    });
  function save() {
    if (!store.set(key, items)) say("Storage is full: images last for this visit only.", true);
  }
  function render() {
    grid.innerHTML = items.length
      ? items
          .map(
            (it, i) => `<figure class="g-tile"><img src="${it.src}" alt="Uploaded image ${i + 1}">
      <figcaption><label class="g-mini">Replace<input type="file" accept=".jpg,.jpeg,.png,.webp" hidden data-replace="${it.id}"></label>
      <button class="g-mini" data-del="${it.id}">Remove</button></figcaption></figure>`,
          )
          .join("")
      : `<p class="g-empty">No images yet. Add JPG, PNG or WebP files and they appear here.</p>`;
  }
  async function add(files, replaceId) {
    const good = [...files].filter((f) => TYPES.includes(f.type)),
      bad = files.length - good.length;
    if (!good.length) return say("Only JPG, PNG and WebP images are supported.", true);
    say(`Processing ${good.length} image${good.length > 1 ? "s" : ""}…`);
    try {
      const done = await Promise.all(good.map(shrink));
      if (replaceId) items = items.map((it) => (it.id === replaceId ? { id: it.id, src: done[0] } : it));
      else done.forEach((src, n) => items.push({ id: Date.now() + n, src }));
      save();
      render();
      say(
        bad
          ? `Added ${done.length}. ${bad} file(s) skipped (unsupported type).`
          : `${replaceId ? "Replaced" : "Added"} ${done.length} image(s).`,
        !!bad,
      );
    } catch (e) {
      say(e.message, true);
    }
  }
  root.addEventListener("change", (e) => {
    if (!e.target.files || !e.target.files.length) return;
    add(e.target.files, e.target.dataset.replace ? +e.target.dataset.replace : 0);
    e.target.value = "";
  });
  root.addEventListener("click", (e) => {
    if (e.target.dataset.del) {
      items = items.filter((it) => it.id !== +e.target.dataset.del);
      save();
      render();
      say("Image removed.");
    }
    if (e.target.dataset.clear !== undefined) {
      if (!items.length) return say("Nothing to remove.", true);
      items = [];
      save();
      render();
      say("All images removed.");
    }
  });
  render();
}

// ---------- Mobile menu: any #burger toggles #menu ----------
document.addEventListener("click", (e) => {
  if (e.target.closest("#burger")) $("#menu").classList.toggle("open");
  else if (e.target.closest("#menu a")) $("#menu")?.classList.remove("open");
});


/* ============================================================
   PART 2: SITE CODE – data and features of this website
   ============================================================ */
/* JobFine demo – sample data and interactions. */

// ============================================================ 1. SAMPLE DATA (fictional employers)
// title, company, type, location, salary per year (USD), day posted (higher = newer), logo color
const JOBS = [
  ["Product Designer", "Brightly", "Full-time", "Remote", 92000, 12, "#7a5cf0"],
  ["Frontend Developer", "Orbitly", "Full-time", "Berlin", 98000, 11, "#0fbf6a"],
  ["Customer Success Lead", "Lumen", "Full-time", "Austin", 76000, 10, "#f0b44a"],
  ["Content Writer", "Harbor & Pine", "Part-time", "Remote", 38000, 9, "#3b9ed9"],
  ["Data Analyst", "Northwind Co", "Contract", "London", 84000, 8, "#e8623a"],
  ["HR Coordinator", "Vela", "Full-time", "Toronto", 62000, 7, "#0b3b3a"],
  ["UX Researcher", "Brightly", "Contract", "Remote", 88000, 6, "#7a5cf0"],
  ["Social Media Manager", "Lumen", "Part-time", "Remote", 42000, 5, "#f0b44a"],
  ["Backend Engineer", "Orbitly", "Remote", "Anywhere", 105000, 4, "#0fbf6a"],
  ["Recruiter", "Vela", "Full-time", "Dublin", 66000, 3, "#0b3b3a"],
  ["Marketing Specialist", "Harbor & Pine", "Contract", "Remote", 58000, 2, "#3b9ed9"],
  ["QA Tester", "Northwind Co", "Part-time", "Pune", 30000, 1, "#e8623a"],
];
const TYPES = ["Full-time", "Part-time", "Contract", "Remote"];

// Hero picture: simple illustrated person at a laptop (SVG, no image file needed)
const PICTURE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 360'><rect width='300' height='360' fill='#e8ecea'/><rect x='0' y='0' width='70' height='360' fill='#cfd6d3'/><path d='M60 360 Q70 250 150 240 Q235 250 245 360z' fill='#b9b3a6'/><rect x='132' y='190' width='36' height='55' fill='#e8b08a'/><ellipse cx='150' cy='140' rx='48' ry='58' fill='#f0bd98'/><path d='M100 135 Q96 60 150 62 Q206 60 202 140 Q196 100 150 96 Q106 100 100 135z' fill='#1f1a17'/><circle cx='132' cy='140' r='4' fill='#231012'/><circle cx='168' cy='140' r='4' fill='#231012'/><path d='M130 166 Q150 184 172 166' stroke='#231012' stroke-width='3.5' fill='none'/><rect x='120' y='290' width='150' height='70' rx='6' fill='#c6c9cc'/><rect x='200' y='235' width='46' height='42' rx='6' fill='#fff' stroke='#8a8f93'/></svg>`;
document.documentElement.style.setProperty(
  "--fig",
  `url("data:image/svg+xml,${encodeURIComponent(PICTURE)}")`,
);

// ============================================================ 2. SEARCH, FILTER, SORT
$("#type").innerHTML = ["All types", ...TYPES].map((t) => `<option>${t}</option>`).join("");
$("#tType").innerHTML = ["All types", ...TYPES].map((t) => `<option>${t}</option>`).join("");
const money = (n) => "$" + n.toLocaleString("en-US");
let query = "";

function renderJobs() {
  const type = $("#type").value,
    sort = $("#sort").value;
  const list = JOBS.map((j, i) => ({ i, j })).filter(
    ({ j }) =>
      (type === "All types" || j[2] === type) &&
      (j[0] + " " + j[1]).toLowerCase().includes(query.toLowerCase()),
  );
  list.sort((a, b) =>
    sort === "new" ? b.j[5] - a.j[5] : sort === "high" ? b.j[4] - a.j[4] : a.j[0].localeCompare(b.j[0]),
  );
  $("#count").textContent = `${list.length} of ${JOBS.length} shown`;
  $("#jobList").innerHTML = list.length
    ? list
        .map(
          ({ i, j }) => `<article class="job">
    <div class="co"><div class="logo-sq" style="background:${j[6]}">${j[1][0]}</div><div><b>${j[0]}</b><br><small>${j[1]}</small></div></div>
    <div class="badges"><span class="badge">${j[2]}</span><span class="badge">${j[3]}</span></div>
    <b>${money(j[4])}<small> / year (sample)</small></b><button class="btn" data-apply="${i}">Apply</button></article>`,
        )
        .join("")
    : `<p class="empty">No roles match. Try another word or click “Clear filters”.</p>`;
}
$("#type").onchange = renderJobs;
$("#sort").onchange = renderJobs;
$("#clear").onclick = () => {
  query = "";
  $("#heroQ").value = "";
  $("#tPos").value = "";
  $("#type").value = "All types";
  $("#sort").value = "new";
  renderJobs();
};
// Hero search bar and "Search Talent" card both filter the list below
function jump(q, type) {
  query = q;
  if (type) $("#type").value = type;
  renderJobs();
  $("#jobs").scrollIntoView();
}
$("#heroSearch").onsubmit = (e) => {
  e.preventDefault();
  jump($("#heroQ").value.trim());
};
$("#talentForm").onsubmit = (e) => {
  e.preventDefault();
  jump($("#tPos").value.trim(), $("#tType").value);
};

// ============================================================ 3. APPLY, ALERTS, FORMS
$("#jobList").onclick = (e) => {
  if (e.target.dataset.apply === undefined) return;
  const j = JOBS[+e.target.dataset.apply];
  formModal({
    title: `Apply: ${j[0]}`,
    intro: `${j[1]} · ${j[2]} · ${j[3]} · demo application, nothing is sent.`,
    button: "Submit application",
    fields: [
      { name: "name", label: "Full name" },
      { name: "email", label: "Email", type: "email" },
      { name: "years", label: "Years of experience", type: "number", min: 0, max: 40 },
    ],
    done: (v) => `Thanks ${esc(v.name)}! Your demo application for ${esc(j[0])} was recorded locally only.`,
  });
};
$("#alertBtn").onclick = () =>
  formModal({
    title: "Job alerts",
    button: "Subscribe",
    intro: "Demo only. No email will be sent.",
    fields: [
      { name: "email", label: "Email", type: "email" },
      { name: "role", label: "Role you want" },
    ],
    done: (v) => `Alert saved for “${esc(v.role)}” (demo).`,
  });
$("#bookDemo").onclick = () =>
  formModal({
    title: "Book a demo",
    button: "Request demo",
    fields: [
      { name: "name", label: "Name" },
      { name: "email", label: "Work email", type: "email" },
      { name: "company", label: "Company" },
    ],
    done: () => "Thanks! Your demo request was recorded locally.",
  });
$("#contactForm").onsubmit = (e) => {
  e.preventDefault();
  let msg = "";
  if ($("#cName").value.trim().length < 2) msg = "Enter your name.";
  else if (!/^\S+@\S+\.\S+$/.test($("#cEmail").value)) msg = "Enter a valid email address.";
  else if ($("#cMsg").value.trim().length < 10) msg = "Message must be at least 10 characters.";
  $("#cOut").textContent = msg || "Thanks! This is a demo, so nothing was sent.";
  if (!msg) e.target.reset();
};
Gallery({ mount: "#gallery", key: "jf-gallery" });
renderJobs();
