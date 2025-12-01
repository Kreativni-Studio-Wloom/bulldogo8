# Kompletní průvodce integrací GoPay platební brány

## 📋 Obsah
1. [Proč nelze vytvářet platby pouze frontendově](#1-proč-nelze-vytvářet-platby-pouze-frontendově)
2. [Architektura řešení](#2-architektura-řešení)
3. [Nastavení Firebase Functions](#3-nastavení-firebase-functions)
4. [Implementace backendových funkcí](#4-implementace-backendových-funkcí)
5. [Integrace do frontendu](#5-integrace-do-frontendu)
6. [Nastavení environment variables](#6-nastavení-environment-variables)
7. [Testování](#7-testování)

---

## 1. Proč nelze vytvářet platby pouze frontendově

### 🔒 Bezpečnostní důvody

**GoPay API vyžaduje OAuth2 autentizaci s ClientID a ClientSecret:**

1. **ClientSecret musí zůstat tajný**
   - GoPay API používá OAuth2 flow, které vyžaduje `ClientID` a `ClientSecret`
   - `ClientSecret` je citlivý údaj, který NESMÍ být vystaven na frontendu
   - Pokud by byl `ClientSecret` v JavaScriptu, každý uživatel by ho mohl vidět v DevTools
   - Útočník by mohl zneužívat vaše API přihlašovací údaje

2. **GoPay API limitace**
   - GoPay API je navrženo pro server-to-server komunikaci
   - Všechny kritické operace (vytvoření platby, ověření platby) musí probíhat na serveru
   - Frontend komunikuje pouze s GoPay platební bránou (redirect na gw_url)

3. **Ověření platby**
   - Stav platby se musí ověřovat na backendu
   - GoPay posílá notifikace na váš `notification_url` endpoint
   - Tyto notifikace musí být ověřeny pomocí GoPay API

### ✅ Správný postup
```
Frontend → Firebase Functions → GoPay API
                ↓
         (OAuth2 token)
                ↓
         (createPayment)
                ↓
         (gw_url) → Frontend → GoPay platební brána
                ↓
         (return_url) → Frontend → Firebase Functions → checkPayment
                ↓
         (notification_url) → Firebase Functions → updatePaymentStatus
```

---

## 2. Architektura řešení

### Tok platby:

```
1. Uživatel klikne na tlačítko "Zaplatit"
   ↓
2. Frontend volá Firebase Function: createPayment
   ↓
3. Backend:
   - Získá OAuth2 token od GoPay
   - Vytvoří platbu v GoPay API
   - Uloží záznam do Firestore
   - Vrátí gw_url (URL platební brány)
   ↓
4. Frontend přesměruje uživatele na gw_url
   ↓
5. Uživatel zaplatí na GoPay platební bráně
   ↓
6. GoPay přesměruje uživatele na return_url (váš frontend)
   ↓
7. Frontend volá Firebase Function: checkPayment
   ↓
8. Backend ověří stav platby v GoPay API
   ↓
9. GoPay současně posílá notifikaci na notification_url (Firebase Function)
   ↓
10. Backend aktualizuje stav platby v Firestore
```

---

## 3. Nastavení Firebase Functions

### Krok 1: Instalace Firebase CLI a inicializace

```bash
# Instalace Firebase CLI (pokud ještě není nainstalováno)
npm install -g firebase-tools

# Přihlášení do Firebase
firebase login

# Inicializace Firebase Functions v projektu
firebase init functions

# Vyberte:
# - JavaScript nebo TypeScript (doporučuji TypeScript)
# - ESLint: Yes
# - Install dependencies: Yes
```

### Krok 2: Struktura projektu

Po inicializaci byste měli mít strukturu:
```
abulldogo3/
├── functions/
│   ├── src/
│   │   └── index.ts (nebo index.js)
│   ├── package.json
│   └── tsconfig.json
├── firebase.json
└── ...
```

---

## 4. Implementace backendových funkcí

### Instalace závislostí

```bash
cd functions
npm install axios cors
npm install --save-dev @types/node
```

### Firebase Functions kód

Viz soubor `functions/src/index.ts` (bude vytvořen dále)

---

## 5. Integrace do frontendu

### Frontend kód pro tlačítko a zpracování platby

Viz soubor `gopay-frontend.js` (bude vytvořen dále)

---

## 6. Nastavení environment variables

### V GoPay administraci získejte:
- **ClientID** (GoID)
- **ClientSecret** (GoSecret)
- **API URL** (obvykle `https://gate.gopay.cz/api`)

### Nastavení v Firebase:

```bash
# Nastavení GoPay credentials
firebase functions:config:set gopay.client_id="YOUR_CLIENT_ID"
firebase functions:config:set gopay.client_secret="YOUR_CLIENT_SECRET"
firebase functions:config:set gopay.api_url="https://gate.gopay.cz/api"

# Nebo pro testovací prostředí:
firebase functions:config:set gopay.test_client_id="YOUR_TEST_CLIENT_ID"
firebase functions:config:set gopay.test_client_secret="YOUR_TEST_CLIENT_SECRET"
firebase functions:config:set gopay.test_api_url="https://gw.sandbox.gopay.com/api"
```

**DŮLEŽITÉ:** Po změně config musíte znovu nasadit funkce:
```bash
firebase deploy --only functions
```

### Zobrazení aktuální konfigurace:

```bash
firebase functions:config:get
```

---

## 7. Testování

### Lokální testování Firebase Functions:

```bash
cd functions
npm run serve

# Nebo pro emulaci celého Firebase:
firebase emulators:start
```

### Testovací prostředí GoPay:

1. Vytvořte si testovací účet na: https://help.gopay.com/cs/tema/zaverechny-test
2. Použijte testovací API URL: `https://gw.sandbox.gopay.com/api`
3. Testovací platební karty: https://help.gopay.com/cs/tema/testovaci-platebni-karty

### Produkční nasazení:

```bash
firebase deploy --only functions
```

---

## 📚 Důležité odkazy

- [GoPay API dokumentace](https://doc.gopay.com/)
- [GoPay OAuth2](https://doc.gopay.com/#oauth2)
- [GoPay Create Payment](https://doc.gopay.com/#vytvoření-platby)
- [Firebase Functions dokumentace](https://firebase.google.com/docs/functions)

---

## ⚠️ Bezpečnostní doporučení

1. **NIKDY** neukládejte ClientSecret do frontendového kódu
2. **VŽDY** ověřujte platby na backendu
3. **VŽDY** ověřujte notifikace od GoPay pomocí jejich API
4. Používejte HTTPS pro všechny komunikace
5. Implementujte rate limiting pro API endpoints
6. Logujte všechny platební operace pro audit

---

## 🆘 Řešení problémů

### Funkce se nenasazují:
- Zkontrolujte, že jste přihlášeni: `firebase login`
- Ověřte project ID: `firebase use`
- Zkontrolujte oprávnění v Firebase Console

### OAuth2 token získání selhává:
- Ověřte ClientID a ClientSecret
- Zkontrolujte, že používáte správnou API URL (test vs. produkce)
- Zkontrolujte scope v požadavku

### Notifikace nepřicházejí:
- Zkontrolujte notification_url v createPayment
- Ověřte, že endpoint je veřejně dostupný (Firebase Functions URL)
- Zkontrolujte CORS nastavení

---

**Vytvořeno:** 2025
**Autor:** AI Assistant
**Verze:** 1.0

