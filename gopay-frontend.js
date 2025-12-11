/**
 * GoPay Frontend Integration
 * 
 * Tento soubor obsahuje frontend kód pro integraci GoPay platební brány
 * 
 * Použití:
 * 1. Přidejte tento soubor do packages.html: <script src="gopay-frontend.js" defer></script>
 * 2. Funkce initGoPayIntegration() se automaticky inicializuje po načtení
 * 3. Upravte funkci processPayment() v packages.js aby volala createGoPayPayment()
 */

// OKAMŽITĚ při načtení skriptu - před jakýmkoliv jiným kódem
(function() {
  console.log("📦 gopay-frontend.js se načítá...", new Date().toISOString());
  window._gopayFrontendLoading = true;
})();

// Konfigurace Firebase Functions URL
// V produkci bude automaticky detekována, nebo můžete nastavit ručně
const getFunctionsUrl = () => {
  // MŮŽETE ZMĚNIT: Pokud chcete použít vlastní URL, nastavte ji zde
  // const CUSTOM_FUNCTIONS_URL = "https://europe-west1-inzerio-inzerce.cloudfunctions.net";
  // if (CUSTOM_FUNCTIONS_URL) return CUSTOM_FUNCTIONS_URL;
  
  // Automatická detekce URL podle projektu
  // Formát: https://REGION-PROJECT-ID.cloudfunctions.net
  const projectId = "inzerio-inzerce"; // Váš Firebase Project ID
  
  // ⚠️ DŮLEŽITÉ: Zkontrolujte správný region!
  // Po nasazení Functions (firebase deploy --only functions) se zobrazí URL
  // Zkopírujte region z URL a nastavte ho zde
  // Nebo zkontrolujte Firebase Console → Functions → URL funkcí
  const region = "us-central1"; // ✅ Opraveno: Functions jsou nasazeny na us-central1
  
  // Možné regiony: europe-west1, us-central1, asia-east1, atd.
  // Zkontrolujte v Firebase Console → Functions → URL
  
  // Pro lokální vývoj
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:5001/" + projectId + "/" + region;
  }
  
  // Pro produkci - automaticky použije správnou URL
  const url = `https://${region}-${projectId}.cloudfunctions.net`;
  console.log(`🔗 Používám Firebase Functions URL: ${url}`);
  return url;
};

const FUNCTIONS_BASE_URL = getFunctionsUrl();

/**
 * Vytvoří platbu v GoPay přes Firebase Function
 * 
 * @param {Object} paymentData - Data pro platbu
 * @param {number} paymentData.amount - Částka v Kč
 * @param {string} paymentData.planId - ID plánu (např. "hobby", "business")
 * @param {string} paymentData.planName - Název plánu pro zobrazení
 * @param {string} paymentData.userId - ID uživatele z Firebase Auth
 * @returns {Promise<Object>} - Vrátí objekt s gwUrl pro přesměrování
 */
async function createGoPayPayment(paymentData) {
  try {
    console.log("💳 Vytváření GoPay platby:", paymentData);

    // Validace vstupních dat
    if (!paymentData.amount || paymentData.amount <= 0) {
      throw new Error("Neplatná částka");
    }

    if (!paymentData.planId || !paymentData.planName) {
      throw new Error("Chybí ID nebo název plánu");
    }

    if (!paymentData.userId) {
      throw new Error("Uživatel není přihlášen");
    }

    // Vytvoření orderNumber - musí být unikátní pro každou platbu
    // Pro Hobby balíček použijeme "hobby-" prefix s timestampem pro unikátnost
    const orderNumber = paymentData.planId === "hobby" 
      ? `hobby-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      : `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Příprava dat pro backend
    // POZNÁMKA: amount se posílá v Kč, backend ho převede na haléře
    const requestData = {
      amount: paymentData.amount, // v Kč (např. 39)
      currency: "CZK",
      orderNumber: orderNumber,
      orderDescription: paymentData.planId === "hobby" ? "balíček Hobby" : `Platba za balíček: ${paymentData.planName}`,
      userId: paymentData.userId,
      planId: paymentData.planId,
      planName: paymentData.planName,
      // Items se posílají s amount v Kč, backend je převede na haléře
      items: [
        {
          name: paymentData.planName,
          amount: paymentData.amount, // v Kč, backend převede na haléře
          count: 1,
        },
      ],
      payerEmail: paymentData.userEmail,
      payerPhone: paymentData.userPhone,
      payerFirstName: paymentData.userFirstName,
      payerLastName: paymentData.userLastName,
      returnUrl: `https://vercel.bulldogo8.app/success`,
      // POZNÁMKA: Pokud dostáváte chybu 409, zkuste dočasně vypnout opakované platby
      // Opakované platby musí být aktivované v GoPay administraci
      // Pro testování můžete nastavit isRecurring: false
      isRecurring: paymentData.isRecurring !== undefined ? paymentData.isRecurring : true, // Pro balíčky je opakovaná platba defaultně true
      recurrenceDateTo: paymentData.recurrenceDateTo || "2099-12-31", // Defaultně do konce roku 2099
    };

    // Volání Firebase Function
    let response;
    try {
      response = await fetch(`${FUNCTIONS_BASE_URL}/createPayment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
    } catch (fetchError) {
      // Pokud je 404, Functions pravděpodobně nejsou nasazeny nebo je špatný region
      if (fetchError.message.includes("404") || fetchError.message.includes("Load failed")) {
        throw new Error(
          `Firebase Functions endpoint není dostupný (404). ` +
          `Zkontrolujte:\n` +
          `1. Jsou Functions nasazeny? (firebase deploy --only functions)\n` +
          `2. Je správný region v gopay-frontend.js řádek 22?\n` +
          `3. Zkontrolujte Firebase Console → Functions → URL funkcí\n` +
          `Aktuální URL: ${FUNCTIONS_BASE_URL}/createPayment`
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      // Pokud je 404, poskytneme uživatelsky přívětivou zprávu
      if (response.status === 404) {
        throw new Error(
          `Firebase Functions endpoint nebyl nalezen (404). ` +
          `Zkontrolujte Firebase Console → Functions a ověřte region. ` +
          `Aktuální URL: ${FUNCTIONS_BASE_URL}/createPayment`
        );
      }
      
      // Zkusit získat detailní chybovou zprávu
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: `HTTP ${response.status}`, message: response.statusText };
      }
      
      // Pokud je 409 (Conflict), zobrazit validační chyby z GoPay
      if (response.status === 409 && errorData.details) {
        const errors = Array.isArray(errorData.details.errors) 
          ? errorData.details.errors 
          : errorData.details.error 
            ? [errorData.details.error] 
            : [];
        
        const errorMessages = errors.map((err) => {
          if (typeof err === 'string') return err;
          return err.message || err.error_name || JSON.stringify(err);
        }).join(', ');
        
        throw new Error(
          `Validační chyba GoPay: ${errorMessages || errorData.details.message || errorData.message || 'Neznámá chyba'}`
        );
      }
      
      // Obecná chybová zpráva
      const errorMessage = errorData.details?.message || errorData.message || errorData.error || `Chyba při vytváření platby (${response.status})`;
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || result.error || "Nepodařilo se vytvořit platbu");
    }

    if (!result.gwUrl) {
      console.error("GoPay nevrátil gwUrl:", result);
      throw new Error("GoPay nevrátil platební URL. Zkontrolujte logy v Firebase Functions.");
    }

    // Validace, že URL je správně formátovaná
    try {
      new URL(result.gwUrl);
    } catch (e) {
      console.error("Neplatná gwUrl:", result.gwUrl);
      throw new Error(`Neplatná platební URL: ${result.gwUrl}`);
    }

    console.log("✅ Platba vytvořena:", {
      paymentId: result.paymentId,
      orderNumber: result.orderNumber,
      state: result.state,
      gwUrl: result.gwUrl.substring(0, 50) + "...", // Zobrazit jen začátek URL
    });

    // Uložení orderNumber do sessionStorage pro pozdější ověření
    sessionStorage.setItem("gopay_orderNumber", result.orderNumber);
    sessionStorage.setItem("gopay_paymentId", result.paymentId);

    return {
      success: true,
      gwUrl: result.gwUrl,
      paymentId: result.paymentId,
      orderNumber: result.orderNumber,
    };
  } catch (error) {
    console.error("❌ Chyba při vytváření GoPay platby:", error);
    throw error;
  }
}

// Exportovat funkci OKAMŽITĚ po definici
window.createGoPayPayment = createGoPayPayment;
console.log("✅ createGoPayPayment exportována v", new Date().toISOString());

/**
 * Ověří stav platby v GoPay
 * 
 * @param {string} paymentId - ID platby z GoPay
 * @param {string} orderNumber - Order number platby
 * @returns {Promise<Object>} - Vrátí stav platby
 */
async function checkGoPayPayment(paymentId, orderNumber) {
  try {
    console.log("🔍 Ověřování platby:", { paymentId, orderNumber });

    const params = new URLSearchParams({
      ...(paymentId && { paymentId }),
      ...(orderNumber && { orderNumber }),
    });

    const response = await fetch(`${FUNCTIONS_BASE_URL}/checkPayment?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || "Chyba při ověřování platby");
    }

    const result = await response.json();

    console.log("✅ Stav platby:", result);

    return result;
  } catch (error) {
    console.error("❌ Chyba při ověřování platby:", error);
    throw error;
  }
}

// Exportovat funkci OKAMŽITĚ po definici
window.checkGoPayPayment = checkGoPayPayment;

/**
 * Získá informace o aktuálně přihlášeném uživateli
 */
async function getCurrentUserInfo() {
  try {
    const auth = window.firebaseAuth;
    if (!auth) {
      throw new Error("Firebase Auth není inicializován");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Uživatel není přihlášen");
    }

    // Získání dalších informací z Firestore profilu
    const db = window.firebaseDb;
    if (db) {
      const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const profileRef = doc(db, "users", user.uid, "profile", "profile");
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const profileData = profileSnap.data();
        return {
          uid: user.uid,
          email: user.email,
          phone: profileData.phone || null,
          firstName: profileData.firstName || profileData.first_name || null,
          lastName: profileData.lastName || profileData.last_name || null,
        };
      }
    }

    return {
      uid: user.uid,
      email: user.email,
      phone: null,
      firstName: null,
      lastName: null,
    };
  } catch (error) {
    console.error("❌ Chyba při získávání informací o uživateli:", error);
    throw error;
  }
}

/**
 * Zpracuje návrat z GoPay platební brány
 * Kontroluje URL parametry a ověří stav platby
 */
async function handleGoPayReturn() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentState = urlParams.get("payment");
    const orderNumber = urlParams.get("orderNumber");
    const paymentId = urlParams.get("paymentId");

    // Pokud nejsou parametry v URL, zkus získat ze sessionStorage
    const storedOrderNumber = sessionStorage.getItem("gopay_orderNumber");
    const storedPaymentId = sessionStorage.getItem("gopay_paymentId");

    const finalOrderNumber = orderNumber || storedOrderNumber;
    const finalPaymentId = paymentId || storedPaymentId;

    if (!finalOrderNumber && !finalPaymentId) {
      console.log("ℹ️ Žádné platební parametry v URL");
      return;
    }

    console.log("🔙 Návrat z GoPay:", { paymentState, finalOrderNumber, finalPaymentId });

    // Zobrazit loading stav
    showPaymentLoading("Ověřování platby...");

    // Počkat chvíli, než GoPay zpracuje notifikaci
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Ověřit stav platby
    const paymentStatus = await checkGoPayPayment(finalPaymentId, finalOrderNumber);

    // Vyčistit URL parametry
    window.history.replaceState({}, document.title, window.location.pathname);

    // Vyčistit sessionStorage
    sessionStorage.removeItem("gopay_orderNumber");
    sessionStorage.removeItem("gopay_paymentId");

    // Zpracovat výsledek
    if (paymentStatus.payment.state === "PAID") {
      showPaymentSuccess(paymentStatus.payment);
    } else if (paymentStatus.payment.state === "CANCELED") {
      showPaymentError("Platba byla zrušena");
    } else if (paymentStatus.payment.state === "TIMEOUTED") {
      showPaymentError("Platba vypršela");
    } else {
      showPaymentError(`Platba má stav: ${paymentStatus.payment.state}`);
    }
  } catch (error) {
    console.error("❌ Chyba při zpracování návratu z GoPay:", error);
    showPaymentError("Nepodařilo se ověřit stav platby. Zkuste to prosím znovu.");
  }
}

/**
 * Zobrazí loading stav platby
 */
function showPaymentLoading(message) {
  const paymentSection = document.getElementById("paymentSection");
  if (paymentSection) {
    const existingLoader = paymentSection.querySelector(".payment-loader");
    if (existingLoader) {
      existingLoader.remove();
    }

    const loader = document.createElement("div");
    loader.className = "payment-loader";
    loader.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #ff6a00; margin-bottom: 1rem;"></i>
        <p style="font-size: 1.2rem; color: #666;">${message || "Zpracovávám platbu..."}</p>
      </div>
    `;
    paymentSection.appendChild(loader);
  }
}

/**
 * Zobrazí úspěšnou platbu
 */
function showPaymentSuccess(paymentData) {
  console.log("✅ Platba úspěšná:", paymentData);

  // Skrýt payment sekci
  const paymentSection = document.getElementById("paymentSection");
  if (paymentSection) {
    paymentSection.style.display = "none";
  }

  // Zobrazit success sekci
  const successSection = document.getElementById("successSection");
  if (successSection) {
    successSection.style.display = "block";
    successSection.scrollIntoView({ behavior: "smooth" });
  }

  // Zobrazit notifikaci
  showMessage("Platba byla úspěšně dokončena!", "success");
}

/**
 * Zobrazí chybovou zprávu
 */
function showPaymentError(message) {
  console.error("❌ Platební chyba:", message);

  // Zobrazit chybovou zprávu
  showMessage(message, "error");

  // Skrýt loader
  const paymentSection = document.getElementById("paymentSection");
  if (paymentSection) {
    const loader = paymentSection.querySelector(".payment-loader");
    if (loader) {
      loader.remove();
    }

    // Zobrazit tlačítka zpět
    const payButton = paymentSection.querySelector(".payment-actions .btn-primary");
    if (payButton) {
      payButton.innerHTML = '<i class="fas fa-credit-card"></i> Zaplatit';
      payButton.disabled = false;
    }
  }
}

/**
 * Zobrazí zprávu uživateli
 */
function showMessage(message, type = "info") {
  // Vytvořit nebo použít existující message container
  let messageContainer = document.getElementById("gopay-message-container");
  if (!messageContainer) {
    messageContainer = document.createElement("div");
    messageContainer.id = "gopay-message-container";
    messageContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
    `;
    document.body.appendChild(messageContainer);
  }

  const messageDiv = document.createElement("div");
  messageDiv.style.cssText = `
    padding: 1rem 1.5rem;
    margin-bottom: 1rem;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
  `;

  if (type === "success") {
    messageDiv.style.backgroundColor = "#d4edda";
    messageDiv.style.color = "#155724";
    messageDiv.style.border = "1px solid #c3e6cb";
  } else if (type === "error") {
    messageDiv.style.backgroundColor = "#f8d7da";
    messageDiv.style.color = "#721c24";
    messageDiv.style.border = "1px solid #f5c6cb";
  } else {
    messageDiv.style.backgroundColor = "#d1ecf1";
    messageDiv.style.color = "#0c5460";
    messageDiv.style.border = "1px solid #bee5eb";
  }

  messageDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; font-size: 1.5rem; cursor: pointer; margin-left: 1rem; color: inherit;">
        &times;
      </button>
    </div>
  `;

  messageContainer.appendChild(messageDiv);

  // Automatické odstranění po 5 sekundách
  setTimeout(() => {
    if (messageDiv.parentElement) {
      messageDiv.remove();
    }
  }, 5000);
}

/**
 * Inicializace GoPay integrace
 * Volá se automaticky po načtení stránky
 */
function initGoPayIntegration() {
  console.log("🚀 Inicializace GoPay integrace");

  // Zpracování návratu z GoPay (kontrola URL parametrů)
  handleGoPayReturn();
  
  // Funkce jsou již exportovány výše, jen ověříme
  console.log("✅ GoPay funkce dostupné:", {
    processGoPayPayment: typeof window.processGoPayPayment,
    createGoPayPayment: typeof window.createGoPayPayment,
    checkGoPayPayment: typeof window.checkGoPayPayment,
  });
}

/**
 * Hlavní funkce pro zpracování platby přes GoPay
 * Tato funkce nahrazuje původní processPayment() v packages.js
 */
async function processGoPayPayment() {
  try {
    // Získat vybraný plán (musí být definován v packages.js)
    if (!window.selectedPlan || !window.selectedPlan.plan) {
      showMessage("Prosím nejdříve vyberte balíček", "error");
      return;
    }

    // Zkontrolovat, zda je uživatel přihlášen
    const userInfo = await getCurrentUserInfo();

    // Zobrazit loading stav
    showPaymentLoading("Připravuji platbu...");

    // Vytvořit platbu v GoPay
    // POZNÁMKA: Pokud dostáváte chybu 409, zkuste dočasně vypnout opakované platby
    // nastavením isRecurring: false pro testování
    const paymentResult = await createGoPayPayment({
      amount: window.selectedPlan.price,
      planId: window.selectedPlan.plan,
      planName: window.selectedPlan.plan === "hobby" ? "Hobby uživatel" : "Firma",
      userId: userInfo.uid,
      userEmail: userInfo.email,
      userPhone: userInfo.phone,
      userFirstName: userInfo.firstName,
      userLastName: userInfo.lastName,
      // DOČASNĚ VYPNUTO: Pokud dostáváte chybu 409, opakované platby nejsou aktivované v GoPay
      // Pro aktivaci kontaktujte GoPay podporu: integrace@gopay.cz
      // Po aktivaci změňte zpět na: isRecurring: true
      isRecurring: false, // DOČASNĚ VYPNUTO - aktivujte v GoPay administraci
    });

    console.log("✅ Platba vytvořena, přesměrování na GoPay...");
    console.log("🔗 gwUrl:", paymentResult.gwUrl);

    // Validace gwUrl před přesměrováním
    if (!paymentResult.gwUrl) {
      throw new Error("GoPay nevrátil platební URL");
    }

    // Přesměrování na GoPay platební bránu
    window.location.href = paymentResult.gwUrl;
  } catch (error) {
    console.error("❌ Chyba při zpracování platby:", error);
    showPaymentError(error.message || "Nepodařilo se vytvořit platbu. Zkuste to prosím znovu.");
  }
}

// Exportovat funkci OKAMŽITĚ po definici
window.processGoPayPayment = processGoPayPayment;
console.log("✅ processGoPayPayment exportována v", new Date().toISOString());

// Funkce jsou již exportovány výše po jejich definici
// Tento log pouze ověří, že jsou dostupné
console.log("✅ GoPay funkce exportovány v", new Date().toISOString(), ":", {
  createGoPayPayment: typeof window.createGoPayPayment,
  checkGoPayPayment: typeof window.checkGoPayPayment,
  processGoPayPayment: typeof window.processGoPayPayment,
});

// Označit, že načítání je dokončeno
window._gopayFrontendLoaded = true;
console.log("✅ gopay-frontend.js načten a připraven v", new Date().toISOString());

// Automatická inicializace po načtení DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGoPayIntegration);
} else {
  initGoPayIntegration();
}

