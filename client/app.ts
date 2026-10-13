import ui from "beercss";
import type { user, kast, item, loginRequest } from "../shared/types";

// State
let currentUser: user | null = null;

const themeBtn = document.getElementById("theme-btn") as HTMLButtonElement;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  ui("theme", "#ff5e00");
  setupTheme();
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

const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const loginDialog = document.getElementById("login-dialog") as HTMLDialogElement;
const logout = document.getElementById("logoutBtn") as HTMLButtonElement;
const loginForm = document.getElementById("login-form") as HTMLFormElement;
const usernameInput = document.getElementById("login-username") as HTMLInputElement;
const passwordInput = document.getElementById("login-password") as HTMLInputElement;
const loginError = document.getElementById("login-error") as HTMLParagraphElement;
const authStatus = document.getElementById("auth-status") as HTMLDivElement;
const kastList = document.getElementById("kast-list") as HTMLUListElement;
const loader = document.getElementById("loader") as HTMLDivElement;

// PAGES
const errorPage = document.getElementById("error-page") as HTMLDivElement;
const kastListPage = document.getElementById("kast-list-page") as HTMLDivElement;
let currentPage: HTMLDivElement | null = kastListPage;

// Handle login submit
loginForm?.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
  loginError.style.display = "none";

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
      loginError.style.display = "block";
      return;
    }

    // Success: close dialog and update button
    ui("#login-dialog")
    authStatus.innerHTML = `
      <div class="chip primary" data-ui="#logout-dialog">
        <i>account_circle</i>
        <span>${name}</span>
      </div>
    `;
  } catch {
    loginError.textContent = "Verbindingsfout met de server";
    loginError.style.display = "block";
  }
});

// Check if already logged in on load
fetch("/api/me")
  .then((res) => {
    if (!res.ok) {
      // We reject the promise to trigger the catch block below
      return Promise.reject();
    }
    return res.json();
  })
  .then((user) => {
    if (user?.name) {
      authStatus.innerHTML = `
        <button class="chip primary" data-ui="#logout-dialog">
          <i>account_circle</i>
          <span>${user.name}</span>
        </button>
      `;
    }
    fetch("/api/kasten/list")
      .then((res) => {
        if (!res.ok) {
          // We reject the promise to trigger the catch block below
          return Promise.reject();
        }
        return res.json();
      })
      .then((kasten: kast[]) => {
        kastList.innerHTML = kasten
          .map(
            (kast) => `
          <li>
              <span>${kast.name}</span>
              <small>${kast.description || "Geen beschrijving"}</small>
          </li>
        `)
          .join("");

      })
      .then(() => {
        loader.style.display = "none";
      })
      .catch(() => {
        errorHandler("Kon de kastenlijst niet ophalen.", true, "Controleer je internetverbinding en probeer het opnieuw.");
      });
  }).catch(() => {
    errorHandler("Je bent niet ingelogd.", true, "Probeer in te loggen en de pagina te herladen.");
  });

function errorHandler(error: string, showReloadButton: boolean, tip?: string): void {
  loader.style.display = "none";
  currentPage?.classList.remove("active");
  errorPage.classList.add("active");
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

logout.onclick = () => {
  fetch("/api/auth/logout").then(() => {
    window.location.reload();
  });
}

