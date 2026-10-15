import ui from "beercss";
import type { user, kast, item, loginRequest } from "../shared/types";

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
const loader = document.getElementById("loader") as HTMLDivElement;
const backLinks = document.getElementsByClassName("back-link") as HTMLCollectionOf<HTMLAnchorElement>;
const kastInhoudHeader = document.getElementById("kast-inhoud-head") as HTMLHeadingElement
const kastInhoudList = document.getElementById("kast-inhoud-list") as HTMLUListElement;
const lenenError = document.getElementById("lenen-error") as HTMLParagraphElement;
const lenenForm = document.getElementById("lenen-form") as HTMLFormElement;

// PAGES
const errorPage = document.getElementById("error-page") as HTMLDivElement;
const kastInhoudPage = document.getElementById("kast-inhoud-page") as HTMLDivElement;
const kastListPage = document.getElementById("kast-list-page") as HTMLDivElement;
let currentPage: HTMLDivElement | null = kastListPage;
let lastPage: HTMLDivElement | null = null

let lenenContext: { kast: kast, item: item } | null = null

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
    .then((v) => {
      setLoadingState(false)
      let backup = lastPage
      ui("#lenen-dialog")
      kastDataPage(lenenContext!.kast);
      lastPage = backup;
      lenenContext = null;
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
    if (user?.name) {
      authStatus.innerHTML = `
        <button class="chip primary" data-ui="#logout-dialog">
          <i>account_circle</i>
          <span>${user.name}</span>
        </button>
      `;
    }
  })
  .then(() => {
    homePage();
  }).catch(() => {
    errorHandler("Je bent niet ingelogd.", true, "Probeer in te loggen en de pagina te herladen.");
  });

function homePage() {
  setLoadingState(true)
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
          <li id="kast-${kast.id}" class="list-item">
              <span>${kast.name}</span>
              <small>${kast.description || "Geen beschrijving"}</small>
          </li>
        `)
        .join("");
      kasten.forEach((kast) => {
        const kastElement = document.getElementById(`kast-${kast.id}`);
        if (kastElement) {
          kastElement.addEventListener("click", () => {
            kastDataPage(kast);
          });
        }
      });

    })
    .finally(() => {
      setLoadingState(false)
    })
    .catch(() => {
      setLoadingState(false)
      errorHandler("Kon de kastenlijst niet ophalen.", true, "Controleer je internetverbinding en probeer het opnieuw.");
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
      kastInhoudList.innerHTML = "";
      v.forEach((item: item) => {
        const itemElement = document.createElement("li") as HTMLLIElement;
        itemElement.className = "list-item";
        itemElement.innerHTML = `
        <nav class="responsive">
          <span>${item.name}</span>
          <small>${item.description || "Geen beschrijving"}</small>
          <div class="max"></div>
          <button ${!item.beschikbaar ? 'disabled' : ''} id="item-${item.id}-btn" class="primary">
            Lenen ${!item.beschikbaar ? '<span class="tooltip">Dit item is niet beschikbaar</span>' : ''} 
          </button>
        </nav>
        `;
        kastInhoudList.appendChild(itemElement);
        kastInhoudList.querySelector(`#item-${item.id}-btn`)?.addEventListener("click", () => {
          ui("#lenen-dialog");
          lenenContext = { kast, item };
        });
      });
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