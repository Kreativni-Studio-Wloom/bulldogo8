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

// Konfigurace Firebase Functions URL
// V produkci bude automaticky detekována, nebo můžete nastavit ručně
const getFunctionsUrl = () => {
  // MŮŽETE ZMĚNIT: Pokud chcete použít vlastní URL, nastavte ji zde
  // const CUSTOM_FUNCTIONS_URL = "https://europe-west1-inzerio-inzerce.cloudfunctions.net";
  // if (CUSTOM_FUNCTIONS_URL) return CUSTOM_FUNCTIONS_URL;
  
  // Automatická detekce URL podle projektu
  // Formát: https://REGION-PROJECT-ID.cloudfunctions.net
  const projectId = "inzerio-inzerce"; // Váš Firebase Project ID
  const region = "europe-west1"; // Region, kde běží Functions (po nasazení zjistíte v konzoli)
  
  // Pro lokální vývoj
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:5001/" + projectId + "/" + region;
  }
  
  // Pro produkci - automaticky použije správnou URL
  // POZOR: Po nasazení Functions zkontrolujte v konzoli, zda region odpovídá!
  return `https://${region}-${projectId}.cloudfunctions.net`;
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

    // Vytvoření orderNumber (unikátní identifikátor)
    const orderNumber = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Příprava dat pro backend
    const requestData = {
      amount: paymentData.amount,
      currency: "CZK",
      orderNumber: orderNumber,
      orderDescription: `Platba za balíček: ${paymentData.planName}`,
      userId: paymentData.userId,
      planId: paymentData.planId,
      planName: paymentData.planName,
      items: [
        {
          name: paymentData.planName,
          amount: paymentData.amount * 100, // v haléřích
          count: 1,
        },
      ],
      payerEmail: paymentData.userEmail,
      payerPhone: paymentData.userPhone,
      payerFirstName: paymentData.userFirstName,
      payerLastName: paymentData.userLastName,
      returnUrl: `${window.location.origin}/packages.html`,
    };

    // Volání Firebase Function
    const response = await fetch(`${FUNCTIONS_BASE_URL}/createPayment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || "Chyba při vytváření platby");
    }

    const result = await response.json();

    if (!result.success || !result.gwUrl) {
      throw new Error("Nepodařilo se získat platební URL");
    }

    console.log("✅ Platba vytvořena:", result);

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

  // Pokud existuje globální funkce processPayment, přepíšeme ji
  if (typeof window.processPayment === "function") {
    const originalProcessPayment = window.processPayment;
    window.processPayment = async function() {
      // Zavolá novou GoPay verzi
      return await processGoPayPayment();
    };
  } else {
    // Vytvořit globální funkci
    window.processGoPayPayment = processGoPayPayment;
  }
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
    const paymentResult = await createGoPayPayment({
      amount: window.selectedPlan.price,
      planId: window.selectedPlan.plan,
      planName: window.selectedPlan.plan === "hobby" ? "Hobby uživatel" : "Firma",
      userId: userInfo.uid,
      userEmail: userInfo.email,
      userPhone: userInfo.phone,
      userFirstName: userInfo.firstName,
      userLastName: userInfo.lastName,
    });

    console.log("✅ Platba vytvořena, přesměrování na GoPay...");

    // Přesměrování na GoPay platební bránu
    window.location.href = paymentResult.gwUrl;
  } catch (error) {
    console.error("❌ Chyba při zpracování platby:", error);
    showPaymentError(error.message || "Nepodařilo se vytvořit platbu. Zkuste to prosím znovu.");
  }
}

// Automatická inicializace po načtení DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGoPayIntegration);
} else {
  initGoPayIntegration();
}

// Export funkcí pro globální použití
window.createGoPayPayment = createGoPayPayment;
window.checkGoPayPayment = checkGoPayPayment;
window.processGoPayPayment = processGoPayPayment;

