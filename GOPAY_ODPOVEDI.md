# Odpovědi na vaše otázky o GoPay integraci

## 1. Je možné zcela frontendově vytvořit platbu (bez backendu)?

### ❌ NE, není to možné

**Důvody:**

1. **OAuth2 autentizace vyžaduje ClientSecret**
   - GoPay API používá OAuth2 flow
   - Pro získání přístupového tokenu potřebujete `ClientID` a `ClientSecret`
   - `ClientSecret` je citlivý údaj, který **NESMÍ** být v JavaScriptu
   - Kdokoliv by ho mohl vidět v DevTools a zneužít

2. **Bezpečnostní rizika**
   - Pokud byste vystavili ClientSecret na frontendu, útočník by mohl:
     - Vytvářet libovolné platby
     - Přístupovat k vašemu GoPay účtu
     - Získávat informace o platbách

3. **GoPay API architektura**
   - GoPay API je navrženo pro **server-to-server** komunikaci
   - Všechny kritické operace musí probíhat na serveru
   - Frontend komunikuje pouze s platební bránou (redirect na `gw_url`)

---

## 2. Proč to nejde – z pohledu bezpečnosti, OAuth2 a GoPay API limitací

### 🔒 Bezpečnostní důvody

**ClientSecret musí zůstat tajný:**
```
Frontend (JavaScript) → Viditelný v DevTools → ❌ ClientSecret nelze skrýt
Backend (Firebase Functions) → Spouští se na serveru → ✅ ClientSecret je bezpečný
```

**Dopad vystavení ClientSecret:**
- Útočník může vytvářet platby z vašeho účtu
- Může získávat citlivé informace o platbách
- Může manipulovat s platebními daty
- Porušení PCI DSS compliance

### 🔐 OAuth2 Flow

**Správný OAuth2 flow pro GoPay:**

```
1. Backend → GoPay API: 
   POST /oauth2/token
   { username: ClientID, password: ClientSecret }
   ↓
2. GoPay → Backend: 
   { access_token: "..." }
   ↓
3. Backend → GoPay API:
   POST /payments/payment
   Authorization: Bearer {access_token}
   ↓
4. GoPay → Backend:
   { id: 123, gw_url: "https://..." }
   ↓
5. Backend → Frontend:
   { gw_url: "https://..." }
   ↓
6. Frontend → GoPay Platební brána:
   Redirect na gw_url
```

**Co se stane, pokud ClientSecret je na frontendu:**
```
❌ Frontend → GoPay API:
   { username: ClientID, password: ClientSecret }
   ↓
⚠️ Každý uživatel vidí ClientSecret v DevTools
⚠️ Útočník může získat přístup k vašemu účtu
```

### 📡 GoPay API limitace

**GoPay API požadavky:**
1. **Všechny kritické operace musí být na serveru:**
   - Vytvoření platby (`createPayment`)
   - Ověření platby (`checkPayment`)
   - Zpracování notifikací (`notification_url`)

2. **Frontend pouze:**
   - Zobrazí tlačítko "Zaplatit"
   - Přesměruje uživatele na `gw_url`
   - Zobrazí výsledek po návratu

3. **Notifikace musí přijít na server:**
   - GoPay posílá notifikace na `notification_url`
   - Tento endpoint musí být veřejně dostupný
   - Musí být schopen ověřit platbu přes API

---

## 3. Jak správně vytvořit backend pomocí Firebase Functions

### Struktura řešení:

```
Firebase Functions
├── createPayment      → Vytvoří platbu v GoPay
├── checkPayment       → Ověří stav platby
├── gopayNotification  → Přijme notifikaci od GoPay
└── paymentReturn      → Zpracuje návrat z platební brány
```

### a) Vytvoření GoPay platby (`createPayment`)

**Endpoint:** `POST /createPayment`

**Co dělá:**
1. Získá OAuth2 token od GoPay (použije ClientID a ClientSecret)
2. Vytvoří platbu v GoPay API
3. Uloží záznam do Firestore
4. Vrátí `gw_url` pro přesměrování

**Ukázka použití (frontend):**
```javascript
const response = await fetch('https://YOUR-FUNCTIONS-URL/createPayment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 199,
    currency: 'CZK',
    orderNumber: 'ORDER-123',
    orderDescription: 'Platba za balíček: Firma',
    userId: 'user-123',
    planId: 'business',
    planName: 'Firma',
  })
});

const { gwUrl } = await response.json();
window.location.href = gwUrl; // Přesměrování na GoPay
```

**Implementace:** Viz `functions/src/index.ts` (řádky 60-180)

### b) Ověření platby přes REST API (`checkPayment`)

**Endpoint:** `GET /checkPayment?paymentId=123&orderNumber=ORDER-123`

**Co dělá:**
1. Získá OAuth2 token
2. Zavolá GoPay API pro získání stavu platby
3. Aktualizuje záznam v Firestore
4. Pokud je platba zaplacená, aktivuje uživatelský plán

**Ukázka použití (frontend):**
```javascript
const response = await fetch(
  'https://YOUR-FUNCTIONS-URL/checkPayment?paymentId=123&orderNumber=ORDER-123'
);
const { payment } = await response.json();

if (payment.state === 'PAID') {
  // Platba úspěšná
}
```

**Implementace:** Viz `functions/src/index.ts` (řádky 183-240)

### c) Přijímání notifikací od GoPay (`notification_url`)

**Endpoint:** `POST /gopayNotification`

**Co dělá:**
1. Přijme notifikaci od GoPay (automaticky po změně stavu platby)
2. Ověří stav platby přes GoPay API
3. Aktualizuje záznam v Firestore
4. Aktivuje uživatelský plán, pokud je platba zaplacená
5. Vrátí "OK" (GoPay očekává tuto odpověď)

**Důležité:**
- GoPay posílá notifikace automaticky
- Endpoint musí být veřejně dostupný (Firebase Functions URL)
- Musí být schopen ověřit notifikaci přes API

**Implementace:** Viz `functions/src/index.ts` (řádky 243-320)

---

## 4. Jak to následně propojit s frontendem

### Tok platby:

```
┌─────────────┐
│  Frontend   │
│ (tlačítko)  │
└──────┬──────┘
       │ 1. Klik na "Zaplatit"
       ▼
┌─────────────────────┐
│ Firebase Function   │
│  createPayment      │
└──────┬──────────────┘
       │ 2. OAuth2 token
       ▼
┌─────────────────────┐
│    GoPay API        │
│  POST /payments     │
└──────┬──────────────┘
       │ 3. Vrátí gw_url
       ▼
┌─────────────────────┐
│ Firebase Function   │
│  createPayment      │
└──────┬──────────────┘
       │ 4. Vrátí gw_url
       ▼
┌─────────────┐
│  Frontend   │
│ (redirect)  │
└──────┬──────┘
       │ 5. Přesměrování
       ▼
┌─────────────────────┐
│  GoPay Platební     │
│      brána          │
└──────┬──────────────┘
       │ 6. Uživatel zaplatí
       ▼
┌─────────────────────┐
│    GoPay API        │
│ (notifikace)        │
└──────┬──────────────┘
       │ 7. Notifikace
       ▼
┌─────────────────────┐
│ Firebase Function   │
│ gopayNotification   │
└──────┬──────────────┘
       │ 8. Aktualizace stavu
       ▼
┌─────────────┐
│  Frontend   │
│ (návrat)    │
└──────┬──────┘
       │ 9. return_url
       ▼
┌─────────────────────┐
│ Firebase Function   │
│   paymentReturn     │
└──────┬──────────────┘
       │ 10. Ověření platby
       ▼
┌─────────────────────┐
│ Firebase Function   │
│   checkPayment      │
└──────┬──────────────┘
       │ 11. Vrátí stav
       ▼
┌─────────────┐
│  Frontend   │
│ (zobrazení  │
│  výsledku)  │
└─────────────┘
```

### Frontend implementace:

**1. Tlačítko "Zaplatit":**
```javascript
// V packages.js
async function processPayment() {
  const paymentResult = await createGoPayPayment({
    amount: selectedPlan.price,
    planId: selectedPlan.plan,
    planName: 'Firma',
    userId: user.uid,
  });
  
  // Přesměrování na GoPay
  window.location.href = paymentResult.gwUrl;
}
```

**2. Návrat z GoPay:**
```javascript
// Automaticky zpracováno v gopay-frontend.js
handleGoPayReturn(); // Kontroluje URL parametry a ověří platbu
```

**3. Zobrazení výsledku:**
```javascript
// Automaticky zobrazí úspěch/chybu podle stavu platby
if (payment.state === 'PAID') {
  showPaymentSuccess();
}
```

**Kompletní frontend kód:** Viz `gopay-frontend.js`

---

## 📝 Ukázkový kód

### Firebase Functions (TypeScript)

**Vytvoření platby:**
```typescript
export const createPayment = functions.https.onRequest(async (req, res) => {
  // 1. Získání OAuth2 tokenu
  const accessToken = await getGoPayAccessToken();
  
  // 2. Vytvoření platby
  const paymentData = {
    amount: amount * 100, // v haléřích
    currency: 'CZK',
    order_number: orderNumber,
    return_url: 'https://bulldogo.cz/packages.html',
    notification_url: 'https://YOUR-FUNCTIONS-URL/gopayNotification',
  };
  
  const payment = await axios.post(
    'https://gate.gopay.cz/api/payments/payment',
    paymentData,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  // 3. Uložení do Firestore
  await admin.firestore().collection('payments').doc(orderNumber).set({
    gopayId: payment.data.id,
    state: payment.data.state,
  });
  
  // 4. Vrácení gw_url
  res.json({ gwUrl: payment.data.gw_url });
});
```

**Kompletní kód:** Viz `functions/src/index.ts`

### Frontend (JavaScript)

**Vytvoření platby:**
```javascript
async function createGoPayPayment(paymentData) {
  const response = await fetch('https://YOUR-FUNCTIONS-URL/createPayment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentData),
  });
  
  const { gwUrl } = await response.json();
  window.location.href = gwUrl; // Přesměrování na GoPay
}
```

**Kompletní kód:** Viz `gopay-frontend.js`

---

## 🔐 Uložení GoPay API klíčů do Firebase environment variables

### Nastavení:

```bash
# Testovací prostředí
firebase functions:config:set gopay.test_client_id="VÁŠ_TEST_CLIENT_ID"
firebase functions:config:set gopay.test_client_secret="VÁŠ_TEST_CLIENT_SECRET"
firebase functions:config:set gopay.test_api_url="https://gw.sandbox.gopay.com/api"
firebase functions:config:set gopay.use_test="true"

# Produkční prostředí
firebase functions:config:set gopay.client_id="VÁŠ_PRODUKČNÍ_CLIENT_ID"
firebase functions:config:set gopay.client_secret="VÁŠ_PRODUKČNÍ_CLIENT_SECRET"
firebase functions:config:set gopay.api_url="https://gate.gopay.cz/api"
firebase functions:config:set gopay.use_test="false"
```

### Použití v kódu:

```typescript
const config = functions.config().gopay || {};
const clientId = config.client_id || config.test_client_id;
const clientSecret = config.client_secret || config.test_client_secret;
```

### Ověření:

```bash
# Zobrazení aktuální konfigurace
firebase functions:config:get
```

**Důležité:**
- ✅ Credentials jsou uloženy na serveru
- ✅ Nejsou viditelné ve frontend kódu
- ✅ Po změně config je potřeba znovu nasadit Functions

---

## 📚 Kompletní dokumentace

Všechny detaily najdete v:
- **`GOPAY_INTEGRATION_GUIDE.md`** - Technická dokumentace
- **`GOPAY_SETUP_INSTRUCTIONS.md`** - Krok za krokem nastavení
- **`GOPAY_QUICKSTART.md`** - Rychlý start

---

**Vytvořeno:** 2025
**Verze:** 1.0

