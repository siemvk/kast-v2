import ui from "beercss";
import type { user, kast, item, loginRequest } from "../shared/types";
import type { lening } from "../server/lib/db";

// State
let currentUser: user | null = null;

const themeBtn = document.getElementById("theme-btn") as HTMLButtonElement;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  ui("theme", "#ff9900");
  setupTheme();
  for (let i = 0; i < backLinks.length; i++) {
    const backLink = backLinks[i];
    if (backLink !== undefined) {
      backLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (lastPage) {
          switchPage(lastPage);
          if (lastPage === kastListPage) homePage();
        }
      });
    };
  };
});

// Theme Toggle
function setupTheme(): void {
  themeBtn.addEventListener("click", () => {
    const isDark = document.body.classList.contains("dark");
    document.body.classList.toggle("dark", !isDark);
    document.body.classList.toggle("light", isDark);
    if (isDark) {
      ui("mode", "light");
    } else {
      ui("mode", "dark");
    }
    const icon = themeBtn.querySelector("i");
    if (icon) icon.textContent = isDark ? "dark_mode" : "light_mode";
  });
}

const isOke = async (res: Response) => {
  const data = await res.json();
  if (!res.ok) {
    // We reject the promise to trigger the catch block below
    if (res.status == 404) {
      return Promise.reject("Api endpoint niet gevonden");
    }
    if (data?.message) {
      return Promise.reject(data?.message)
    }
    return Promise.reject("Onbekende fout");
  }
  return data
}

const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const loginDialog = document.getElementById("login-dialog") as HTMLDialogElement;
const logout = document.getElementById("logoutBtn") as HTMLButtonElement;
const loginForm = document.getElementById("login-form") as HTMLFormElement;
const usernameInput = document.getElementById("login-username") as HTMLInputElement;
const passwordInput = document.getElementById("login-password") as HTMLInputElement;
const loginError = document.getElementById("login-error") as HTMLParagraphElement;
const authStatus = document.getElementById("auth-status") as HTMLDivElement;
const kastList = document.getElementById("kast-list") as HTMLUListElement;
const itemsList = document.getElementById("items-list") as HTMLUListElement;
const loader = document.getElementById("loader") as HTMLDivElement;
const backLinks = document.getElementsByClassName("back-link") as HTMLCollectionOf<HTMLAnchorElement>;
const kastInhoudHeader = document.getElementById("kast-inhoud-head") as HTMLHeadingElement
const kastInhoudList = document.getElementById("kast-inhoud-list") as HTMLUListElement;
const lenenError = document.getElementById("lenen-error") as HTMLParagraphElement;
const lenenForm = document.getElementById("lenen-form") as HTMLFormElement;
const waarDialogText = document.getElementById("waar-dialog-text") as HTMLParagraphElement;

// PAGES
const errorPage = document.getElementById("error-page") as HTMLDivElement;
const kastInhoudPage = document.getElementById("kast-inhoud-page") as HTMLDivElement;
const kastListPage = document.getElementById("kast-list-page") as HTMLDivElement;
const adminPage = document.getElementById("admin-page") as HTMLDivElement;
const adminBtn = document.getElementById("admin-btn") as HTMLButtonElement;
let currentPage: HTMLDivElement | null = kastListPage;
let lastPage: HTMLDivElement | null = null

adminBtn?.addEventListener("click", () => adminDataPage());

let lenenContext: { kast?: kast, item: item } | null = null

// Handle login submit
loginForm?.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
  setLoadingState(true)

  const name = usernameInput.value;
  const pass = passwordInput.value;

  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pass }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      loginError.textContent = data?.error || "Ongeldige gebruikersnaam of wachtwoord";
      return;
    }

    // Success: close dialog and update button
    setLoadingState(false)
    ui("#login-dialog")
    authStatus.innerHTML = `
      <div class="chip primary" data-ui="#logout-dialog">
        <i>account_circle</i>
        <span>${name}</span>
      </div>
    `;
  } catch {
    loginError.textContent = "Verbindingsfout met de server";
    setLoadingState(false)
  }
});

lenenForm?.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
  setLoadingState(true)

  if (lenenContext == null) {
    errorHandler("Geen context voor lenen.", true, "Er is iets goed fout gegaan.");
    return;
  }

  const redenInput = document.getElementById("lenen-reden") as HTMLInputElement
  const reden = redenInput.value;

  const timeInput = document.getElementById("lenen-tijd") as HTMLInputElement
  const time = timeInput.value;

  fetch("/api/leningen/leen/" + lenenContext.item.id, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reden, prommisedReturnInfo: time }),
  })
    .then(isOke)
    .then(() => {
      setLoadingState(false)
      const ctx = lenenContext!;
      lenenContext = null;
      lenenForm.reset();
      ui("#lenen-dialog")

      const k = ctx.kast ?? ctx.item.kastData;
      waarDialogText.textContent = k
        ? `Je vindt "${ctx.item.name}" in: ${k.name}${k.description ? ` (${k.description})` : ""}.`
        : `Je vindt "${ctx.item.name}" in kast #${ctx.item.kast}.`;
      ui("#waar-dialog");

      if (ctx.kast) {
        const backup = lastPage;
        kastDataPage(ctx.kast);
        lastPage = backup;
      } else {
        homePage();
      }
    })
    .catch((r) => {
      setLoadingState(false)
      errorHandler(r, true, "Controleer je internetverbinding en probeer het opnieuw.");
    });


});

// Check if already logged in on load
fetch("/api/me")
  .then(isOke)
  .then((user) => {
    currentUser = user;
    if (user?.name) {
      authStatus.innerHTML = `
        <button class="chip primary" data-ui="#logout-dialog">
          <i>account_circle</i>
          <span>${user.name}</span>
        </button>
      `;
    }
    if (user?.isAdmin) {
      adminBtn.style.display = "";
    }
  })
  .then(() => {
    homePage();
  }).catch(() => {
    errorHandler("Je bent niet ingelogd.", true, "Probeer in te loggen en de pagina te herladen.");
  });

let pendingReturnId: number | null = null;
const terugConfirmBtn = document.getElementById("terug-confirm-btn") as HTMLButtonElement;
const terugDialogText = document.getElementById("terug-dialog-text") as HTMLParagraphElement;

terugConfirmBtn?.addEventListener("click", () => {
  if (pendingReturnId === null) return;
  const id = pendingReturnId;
  pendingReturnId = null;
  ui("#terug-dialog");
  setLoadingState(true);
  fetch(`/api/leningen/terug/${id}`, { method: "POST" })
    .then(isOke)
    .then(() => currentPage === adminPage ? adminDataPage(false) : homePage())
    .catch((r) => errorHandler(r, true, "Kon item niet terugbrengen."));
});

function adminDataPage(pushPage = true) {
  setLoadingState(true);
  const adminList = document.getElementById("admin-leningen-list") as HTMLUListElement;
  const usersList = document.getElementById("admin-users-list") as HTMLUListElement;
  Promise.all([
    fetch("/api/admin/leningen/open").then(isOke),
    fetch("/api/admin/users").then(isOke),
    fetch("/api/kasten/list").then(isOke),
  ])
    .then(([open, users, kasten]: [lening[], user[], kast[]]) => {
      adminList.innerHTML = open.length
        ? open.map((l) => renderLeningItem(l, true)).join("")
        : `<li class="list-item"><small>Geen items in gebruik</small></li>`;
      bindReturnButtons(adminList);

      kastList.innerHTML = kasten
        .map(
          (k) => `
          <li id="kast-${k.id}" class="list-item">
            <nav class="responsive">
              <div>
                <span>${k.name}</span>
                <div><small>${k.description || "Geen beschrijving"}</small></div>
              </div>
              <div class="max"></div>
              <button data-edit-kast="${k.id}" class="border"><i>edit</i><span>Bewerken</span></button>
            </nav>
          </li>`
        )
        .join("");
      kasten.forEach((k) => {
        document.getElementById(`kast-${k.id}`)?.addEventListener("click", () => kastDataPage(k));
        kastList.querySelector<HTMLButtonElement>(`[data-edit-kast="${k.id}"]`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          editingKastId = k.id;
          (document.getElementById("edit-kast-name") as HTMLInputElement).value = k.name;
          (document.getElementById("edit-kast-desc") as HTMLInputElement).value = k.description || "";
          ui("#kast-edit-dialog");
        });
      });

      usersList.innerHTML = users
        .map(
          (u) => `
          <li class="list-item">
            <nav class="responsive">
              <span>${u.name}</span>
              <small>#${u.id}</small>
              ${u.isAdmin ? '<span class="chip small primary">Admin</span>' : ""}
              <div class="max"></div>
              <button data-edit-user="${u.id}" class="border"><i>edit</i><span>Bewerken</span></button>
              <button data-delete-user="${u.id}" data-delete-user-name="${u.name}" class="error" ${u.id === currentUser?.id ? "disabled" : ""}>Verwijderen</button>
            </nav>
          </li>`
        )
        .join("");

      users.forEach((u) => {
        usersList.querySelector<HTMLButtonElement>(`[data-edit-user="${u.id}"]`)?.addEventListener("click", () => {
          editingUserId = u.id;
          (document.getElementById("edit-user-name") as HTMLInputElement).value = u.name;
          (document.getElementById("edit-user-pass") as HTMLInputElement).value = "";
          (document.getElementById("edit-user-admin") as HTMLInputElement).checked = u.isAdmin;
          ui("#user-edit-dialog");
        });
      });

      usersList.querySelectorAll<HTMLButtonElement>("[data-delete-user]").forEach((btn) => {
        btn.onclick = () => {
          pendingDeleteUserId = Number(btn.dataset.deleteUser);
          userDeleteDialogText.textContent = `Weet je zeker dat je "${btn.dataset.deleteUserName}" wilt verwijderen?`;
          ui("#user-delete-dialog");
        };
      });

      if (pushPage) switchPage(adminPage);
    })
    .finally(() => setLoadingState(false))
    .catch((r) => errorHandler(r, true, "Kon admin-gegevens niet ophalen."));
}

let pendingDeleteUserId: number | null = null;
const userDeleteConfirmBtn = document.getElementById("user-delete-confirm-btn") as HTMLButtonElement;
const userDeleteDialogText = document.getElementById("user-delete-dialog-text") as HTMLParagraphElement;

userDeleteConfirmBtn?.addEventListener("click", () => {
  if (pendingDeleteUserId === null) return;
  const id = pendingDeleteUserId;
  pendingDeleteUserId = null;
  ui("#user-delete-dialog");
  setLoadingState(true);
  fetch(`/api/admin/users/${id}`, { method: "DELETE" })
    .then(isOke)
    .then(() => adminDataPage(false))
    .catch((r) => errorHandler(r, true, "Kon gebruiker niet verwijderen."));
});

const adminUserForm = document.getElementById("admin-user-form") as HTMLFormElement;
adminUserForm?.addEventListener("submit", (e: SubmitEvent) => {
  e.preventDefault();
  const name = (document.getElementById("new-user-name") as HTMLInputElement).value;
  const pass = (document.getElementById("new-user-pass") as HTMLInputElement).value;
  const isAdmin = (document.getElementById("new-user-admin") as HTMLInputElement).checked;
  ui("#user-create-dialog");
  setLoadingState(true);
  fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, pass, isAdmin }),
  })
    .then(isOke)
    .then(() => {
      adminUserForm.reset();
      adminDataPage(false);
    })
    .catch((r) => errorHandler(r, true, "Kon gebruiker niet aanmaken."));
});

function renderLeningItem(lening: lening, showUser = false): string {
  const userLabel = showUser ? `Door: ${lening.userData?.name ?? `User #${lening.user}`} | ` : "";
  const itemName = lening.itemData?.name || `Item ID: ${lening.item}`;
  return `
    <li class="list-item">
      <nav class="responsive">
        <div>
          <span>${itemName}</span>
          <div><small>${userLabel}${lening.itemData?.description ? `${lening.itemData.description} | ` : ""}Reden: ${lening.reason} | Terug: ${lening.prommisedReturnInfo}</small></div>
        </div>
        <div class="max"></div>
        <button data-return-id="${lening.id}" data-return-name="${itemName}" class="primary">Terugbrengen</button>
      </nav>
    </li>
  `;
}

function bindReturnButtons(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>("[data-return-id]").forEach((btn) => {
    btn.onclick = () => {
      pendingReturnId = Number(btn.dataset.returnId);
      terugDialogText.textContent = `Weet je zeker dat je "${btn.dataset.returnName}" terug wilt brengen?`;
      ui("#terug-dialog");
    };
  });
}

let editingUserId: number | null = null;
let editingKastId: number | null = null;
let editingItemContext: { item: item; kast?: kast } | null = null;

document.getElementById("user-edit-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (editingUserId === null) return;
  const name = (document.getElementById("edit-user-name") as HTMLInputElement).value;
  const pass = (document.getElementById("edit-user-pass") as HTMLInputElement).value;
  const isAdmin = (document.getElementById("edit-user-admin") as HTMLInputElement).checked;
  ui("#user-edit-dialog");
  setLoadingState(true);
  fetch(`/api/admin/users/${editingUserId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ...(pass ? { pass } : {}), isAdmin }),
  })
    .then(isOke)
    .then(() => adminDataPage(false))
    .catch((r) => errorHandler(r, true, "Kon gebruiker niet bijwerken."));
});

document.getElementById("kast-edit-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (editingKastId === null) return;
  const name = (document.getElementById("edit-kast-name") as HTMLInputElement).value;
  const description = (document.getElementById("edit-kast-desc") as HTMLInputElement).value;
  ui("#kast-edit-dialog");
  setLoadingState(true);
  fetch(`/api/admin/kasten/${editingKastId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  })
    .then(isOke)
    .then(() => adminDataPage(false))
    .catch((r) => errorHandler(r, true, "Kon kast niet bijwerken."));
});

document.getElementById("item-edit-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!editingItemContext) return;
  const ctx = editingItemContext;
  const name = (document.getElementById("edit-item-name") as HTMLInputElement).value;
  const description = (document.getElementById("edit-item-desc") as HTMLInputElement).value;
  const kast = Number((document.getElementById("edit-item-kast") as HTMLSelectElement).value);
  ui("#item-edit-dialog");
  setLoadingState(true);
  fetch(`/api/admin/items/${ctx.item.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, kast }),
  })
    .then(isOke)
    .then(() => {
      if (ctx.kast) {
        const backup = lastPage;
        kastDataPage(ctx.kast);
        lastPage = backup;
      } else {
        homePage();
      }
    })
    .catch((r) => errorHandler(r, true, "Kon item niet bijwerken."));
});

function renderItemsList(container: HTMLUListElement, items: item[], kast?: kast) {
  container.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.innerHTML = `
      <nav class="responsive">
        <span>${item.name}</span>
        <small>${item.description || "Geen beschrijving"}</small>
        <div class="max"></div>
        ${currentUser?.isAdmin ? '<button data-action="edit" class="border"><i>edit</i><span>Bewerken</span></button>' : ""}
        <button data-action="leen" ${!item.beschikbaar ? "disabled" : ""} class="primary">
          Lenen ${!item.beschikbaar ? '<span class="tooltip">Dit item is niet beschikbaar</span>' : ""}
        </button>
      </nav>
    `;
    li.querySelector('[data-action="leen"]')?.addEventListener("click", () => {
      lenenContext = { kast, item };
      ui("#lenen-dialog");
    });
    li.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
      editingItemContext = { item, kast };
      (document.getElementById("edit-item-name") as HTMLInputElement).value = item.name;
      (document.getElementById("edit-item-desc") as HTMLInputElement).value = item.description || "";
      const select = document.getElementById("edit-item-kast") as HTMLSelectElement;
      fetch("/api/kasten/list")
        .then(isOke)
        .then((kasten: kast[]) => {
          select.innerHTML = kasten
            .map((k) => `<option value="${k.id}" ${k.id === item.kast ? "selected" : ""}>${k.name}</option>`)
            .join("");
          ui("#item-edit-dialog");
        });
    });
    container.appendChild(li);
  });
}

let allItems: item[] = [];
const itemsSearch = document.getElementById("items-search") as HTMLInputElement;

function filterAndRenderItems() {
  const q = (itemsSearch?.value || "").trim().toLowerCase();
  const filtered = q
    ? allItems.filter((i) => i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q))
    : allItems;
  renderItemsList(itemsList, filtered);
}

itemsSearch?.addEventListener("input", filterAndRenderItems);

function homePage() {
  setLoadingState(true)
  Promise.all([
    fetch("/api/items").then(isOke),
    fetch("/api/leningen").then(isOke),
  ])
    .then(([items, leningen]: [item[], lening[]]) => {
      allItems = items;
      filterAndRenderItems();

      const leningenContainer = document.getElementById("leningen-container") as HTMLDivElement;
      const leningenList = document.getElementById("leningen-list") as HTMLUListElement;

      if (leningen.length === 0) {
        leningenContainer.style.display = "none";
      } else {
        leningenContainer.style.display = "block";
        leningenList.innerHTML = leningen.map((l) => renderLeningItem(l)).join("");
        bindReturnButtons(leningenList);
      }
    })
    .finally(() => setLoadingState(false))
    .catch(() => {
      errorHandler("Kon de gegevens niet ophalen.", true, "Controleer je internetverbinding en probeer het opnieuw.");
    });
}


function errorHandler(error: string, showReloadButton: boolean, tip?: string): void {
  setLoadingState(false)
  switchPage(errorPage);
  errorPage.innerHTML = `
  <div class="center-align">
    <i class="large">error</i>
    <h3>${error}</h3>
    ${tip ? `<p>${tip}</p>` : ""}
    ${showReloadButton ? `<button id="reload-btn" class="primary">Opnieuw proberen</button>` : ""}
    </div>
  `;

  const reloadBtn = document.getElementById("reload-btn") as HTMLButtonElement;
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }

}

function kastDataPage(kast: kast): void {
  setLoadingState(true);
  kastInhoudHeader.innerText = kast.name
  fetch(`/api/kasten/${kast.id}/items`)
    .then(isOke)
    .then((v: item[]) => {
      renderItemsList(kastInhoudList, v, kast);
    })
    .finally(() => {
      switchPage(kastInhoudPage);
      setLoadingState(false);
    })
    .catch((r) => {
      errorHandler(r, true, "Controleer je internetverbinding en probeer het opnieuw.");
      setLoadingState(false);
    })
}

function setLoadingState(isLoading: boolean): void {
  if (isLoading) {
    loader.classList.add("active");
  } else {
    loader.classList.remove("active");
  }
}

function switchPage(page?: HTMLDivElement): void {
  if (currentPage) {
    currentPage.classList.remove("active");
    lastPage = currentPage;
  }
  if (page) {
    page.classList.add("active");
    currentPage = page;
  } else {
    currentPage = null
  }
}

logout.onclick = () => {
  fetch("/api/auth/logout").then(() => {
    window.location.reload();
  });
}