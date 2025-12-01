# GoPay - Instrukce krok za krokem

## 📋 Přehled kroků

1. [Registrace a získání GoPay API přihlašovacích údajů](#1-registrace-a-získání-gopay-api-přihlašovacích-údajů)
2. [Nastavení Firebase Functions](#2-nastavení-firebase-functions)
3. [Nastavení environment variables](#3-nastavení-environment-variables)
4. [Integrace do frontendu](#4-integrace-do-frontendu)
5. [Nasazení a testování](#5-nasazení-a-testování)

---

## 1. Registrace a získání GoPay API přihlašovacích údajů

### Krok 1.1: Registrace u GoPay

1. Přejděte na: https://www.gopay.com/
2. Vytvořte si účet nebo se přihlaste
3. Požádejte o přístup k API

### Krok 1.2: Získání testovacích přihlašovacích údajů

1. Přejděte do GoPay administrace
2. Najděte sekci **API** nebo **Vývojářské nástroje**
3. Vytvořte testovací aplikaci (pokud je k dispozici)
4. Zkopírujte:
   - **ClientID** (GoID)
   - **ClientSecret** (GoSecret)
   - **Test API URL**: `https://gw.sandbox.gopay.com/api`

### Krok 1.3: Získání produkčních přihlašovacích údajů

1. Po úspěšném testování požádejte o produkční přístup
2. Zkopírujte:
   - **ClientID** (GoID)
   - **ClientSecret** (GoSecret)
   - **API URL**: `https://gate.gopay.cz/api`

**⚠️ DŮLEŽITÉ:** ClientSecret je citlivý údaj, nikdy ho nevystavujte na frontendu!

---

## 2. Nastavení Firebase Functions

### Krok 2.1: Instalace Firebase CLI

```bash
# Zkontrolujte, zda máte nainstalovaný Node.js (verze 18 nebo vyšší)
node --version

# Instalace Firebase CLI (pokud ještě není nainstalováno)
npm install -g firebase-tools

# Ověření instalace
firebase --version
```

### Krok 2.2: Přihlášení do Firebase

```bash
# Přihlášení do Firebase
firebase login

# Vyberte váš Google účet a povolte přístup
```

### Krok 2.3: Inicializace Firebase Functions

```bash
# Přejděte do kořenového adresáře vašeho projektu
cd /Users/adam/Desktop/abulldogo3

# Inicializace Firebase Functions
firebase init functions
```

**Vyberte při inicializaci:**
- ✅ **Functions: Configure a Cloud Functions directory**
- Vyberte **TypeScript** (doporučeno) nebo **JavaScript**
- ✅ **ESLint: Yes** (pro kontrolu kódu)
- ✅ **Install dependencies: Yes**
- **Functions emulator:** No (nebo Yes, pokud chcete lokální testování)

### Krok 2.4: Instalace závislostí

```bash
cd functions

# Instalace závislostí pro GoPay integraci
npm install axios cors

# Pokud používáte TypeScript, instalace typů
npm install --save-dev @types/node

# Ověření, že vše je nainstalováno
npm list
```

### Krok 2.5: Ověření struktury

Po dokončení byste měli mít následující strukturu:

```
abulldogo3/
├── functions/
│   ├── src/
│   │   └── index.ts          ✅ (vytvořen)
│   ├── package.json          ✅ (vytvořen)
│   ├── tsconfig.json         ✅ (vytvořen)
│   └── .eslintrc.js          ✅ (vytvořen)
├── firebase.json             ✅ (vytvořen)
└── ...
```

---

## 3. Nastavení environment variables

### Krok 3.1: Nastavení testovacích credentials

```bash
# Ujistěte se, že jste v kořenovém adresáři projektu
cd /Users/adam/Desktop/abulldogo3

# Nastavení testovacích GoPay credentials
firebase functions:config:set gopay.test_client_id="VÁŠ_TEST_CLIENT_ID"
firebase functions:config:set gopay.test_client_secret="VÁŠ_TEST_CLIENT_SECRET"
firebase functions:config:set gopay.test_api_url="https://gw.sandbox.gopay.com/api"
firebase functions:config:set gopay.use_test="true"
```

### Krok 3.2: Nastavení produkčních credentials (pro produkci)

```bash
# Nastavení produkčních GoPay credentials
firebase functions:config:set gopay.client_id="VÁŠ_PRODUKČNÍ_CLIENT_ID"
firebase functions:config:set gopay.client_secret="VÁŠ_PRODUKČNÍ_CLIENT_SECRET"
firebase functions:config:set gopay.api_url="https://gate.gopay.cz/api"
firebase functions:config:set gopay.use_test="false"
```

### Krok 3.3: Nastavení frontend URL

```bash
# Nastavení URL vašeho frontendu (pro return_url)
firebase functions:config:set frontend.url="https://bulldogo.cz"

# Nebo pro lokální testování:
firebase functions:config:set frontend.url="http://localhost:5500"
```

### Krok 3.4: Ověření konfigurace

```bash
# Zobrazení aktuální konfigurace
firebase functions:config:get
```

**Výstup by měl vypadat podobně:**
```json
{
  "gopay": {
    "test_client_id": "...",
    "test_client_secret": "...",
    "test_api_url": "https://gw.sandbox.gopay.com/api",
    "use_test": "true"
  },
  "frontend": {
    "url": "https://bulldogo.cz"
  }
}
```

---

## 4. Integrace do frontendu

### Krok 4.1: Ověření, že frontend soubory jsou na místě

Zkontrolujte, že máte následující soubory:
- ✅ `gopay-frontend.js` - frontend kód pro GoPay
- ✅ `packages.html` - aktualizován pro načtení GoPay skriptu
- ✅ `packages.js` - aktualizován pro použití GoPay

### Krok 4.2: Úprava URL ve frontend kódu

Otevřete soubor `gopay-frontend.js` a upravte:

```javascript
const getFunctionsUrl = () => {
  // NAHRADIT: váš Firebase Project ID
  const projectId = "inzerio-inzerce"; // ✅ Už je správně nastaveno
  const region = "europe-west1"; // Nebo váš region
  
  // ...
};
```

**Jak zjistit váš region:**
- Firebase Console → Functions → podívejte se na URL funkcí
- Nebo po prvním nasazení se URL zobrazí v konzoli

### Krok 4.3: Testování frontend kódu lokálně

1. Otevřete `packages.html` v prohlížeči
2. Otevřete Developer Console (F12)
3. Zkontrolujte, že nejsou žádné chyby při načítání
4. Měli byste vidět: `🚀 Inicializace GoPay integrace`

---

## 5. Nasazení a testování

### Krok 5.1: Kompilace TypeScript (pokud používáte TS)

```bash
cd functions
npm run build
```

### Krok 5.2: Lokální testování (volitelné)

```bash
# Spuštění Firebase emulatorů
firebase emulators:start

# Nebo pouze Functions emulator:
cd functions
npm run serve
```

**Důležité:** Pro lokální testování musíte:
1. Upravit `gopay-frontend.js` aby používal lokální URL
2. Použít testovací GoPay credentials

### Krok 5.3: Nasazení do Firebase

```bash
# Přejděte do kořenového adresáře
cd /Users/adam/Desktop/abulldogo3

# Nasazení Functions
firebase deploy --only functions
```

**Výstup bude vypadat podobně:**
```
✔  functions[createPayment(us-central1)]: Successful create operation.
✔  functions[checkPayment(us-central1)]: Successful create operation.
✔  functions[gopayNotification(us-central1)]: Successful create operation.
✔  functions[paymentReturn(us-central1)]: Successful create operation.

Function URL (createPayment): https://REGION-PROJECT-ID.cloudfunctions.net/createPayment
Function URL (checkPayment): https://REGION-PROJECT-ID.cloudfunctions.net/checkPayment
Function URL (gopayNotification): https://REGION-PROJECT-ID.cloudfunctions.net/gopayNotification
Function URL (paymentReturn): https://REGION-PROJECT-ID.cloudfunctions.net/paymentReturn
```

**⚠️ DŮLEŽITÉ:** Zkopírujte si tyto URL, budete je potřebovat!

### Krok 5.4: Aktualizace frontend URL

Po nasazení zkontrolujte URL funkcí a pokud se liší od defaultu v `gopay-frontend.js`, upravte funkci `getFunctionsUrl()`.

### Krok 5.5: Testování s testovacími platbami

1. **Otevřete stránku balíčků:**
   - `https://bulldogo.cz/packages.html`

2. **Vyberte balíček a klikněte na "Zaplatit"**

3. **Přesměruje vás na GoPay platební bránu**

4. **Pro test použijte testovací platební karty:**
   - Viz: https://help.gopay.com/cs/tema/testovaci-platebni-karty
   - Např.: `4200000000000000` (všechny nuly) s libovolným CVV a expirací v budoucnosti

5. **Po dokončení platby vás GoPay přesměruje zpět**

6. **Zkontrolujte:**
   - ✅ Platba byla vytvořena
   - ✅ Uživatel byl přesměrován na GoPay
   - ✅ Po návratu se zobrazí úspěšná zpráva
   - ✅ Plán byl aktivován v Firestore

### Krok 5.6: Ověření v Firebase Console

1. **Firestore Database:**
   - Zkontrolujte kolekci `payments` - měl by být záznam o platbě
   - Zkontrolujte `users/{uid}/profile/profile` - měl by být aktivní plán

2. **Functions Logs:**
   - Firebase Console → Functions → Logs
   - Zkontrolujte, že nejsou žádné chyby

3. **GoPay Notification:**
   - Zkontrolujte logs, měli byste vidět přijetí notifikace od GoPay

---

## 🔧 Řešení problémů

### Problém: Functions se nenasazují

**Řešení:**
```bash
# Zkontrolujte přihlášení
firebase login

# Zkontrolujte projekt
firebase use

# Zkontrolujte oprávnění v Firebase Console
```

### Problém: OAuth2 token získání selhává

**Možné příčiny:**
1. Špatné ClientID nebo ClientSecret
2. Špatná API URL (test vs. produkce)
3. Nepovolený přístup k API

**Řešení:**
```bash
# Ověřte konfiguraci
firebase functions:config:get

# Zkontrolujte logs
firebase functions:log
```

### Problém: Notifikace nepřicházejí

**Možné příčiny:**
1. `notification_url` není veřejně dostupná
2. CORS problémy
3. Endpoint není správně nasazen

**Řešení:**
1. Ověřte, že Functions jsou nasazeny
2. Zkontrolujte URL v GoPay administraci
3. Ověřte logs v Firebase Console

### Problém: Frontend nemůže volat Functions

**Možné příčiny:**
1. Špatná URL Functions
2. CORS problémy
3. Functions nejsou nasazeny

**Řešení:**
1. Ověřte URL v `gopay-frontend.js`
2. Zkontrolujte CORS v Functions kódu (mělo by být nastaveno)
3. Otestujte Functions URL přímo v prohlížeči

---

## 📝 Checklist před spuštěním

- [ ] GoPay testovací credentials získány
- [ ] Firebase Functions inicializovány
- [ ] Environment variables nastaveny
- [ ] Frontend kód integrován
- [ ] Functions nasazeny do Firebase
- [ ] Frontend URL aktualizována
- [ ] Testovací platba úspěšná
- [ ] Notifikace od GoPay fungují
- [ ] Plán se aktivuje po platbě
- [ ] Produkční credentials nastaveny (před spuštěním do produkce)

---

## 🚀 Spuštění do produkce

### Krok 1: Přepnutí na produkční credentials

```bash
firebase functions:config:set gopay.use_test="false"
firebase functions:config:set gopay.client_id="PRODUKČNÍ_CLIENT_ID"
firebase functions:config:set gopay.client_secret="PRODUKČNÍ_CLIENT_SECRET"
firebase functions:config:set gopay.api_url="https://gate.gopay.cz/api"
```

### Krok 2: Znovu nasazení Functions

```bash
firebase deploy --only functions
```

### Krok 3: Testování s reálnou platbou

1. Vytvořte testovací objednávku s malou částkou
2. Ověřte, že vše funguje správně
3. Sledujte logs a Firestore záznamy

---

**Hotovo! 🎉**

Pokud narazíte na jakékoli problémy, podívejte se na:
- `GOPAY_INTEGRATION_GUIDE.md` - technická dokumentace
- Firebase Functions logs
- GoPay API dokumentaci: https://doc.gopay.com/

