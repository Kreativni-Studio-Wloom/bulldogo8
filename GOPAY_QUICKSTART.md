# GoPay Integrace - Rychlý start

## 🚀 Rychlý přehled

Tento projekt obsahuje kompletní integraci GoPay platební brány pomocí Firebase Functions.

### Co je součástí:

✅ **Backend (Firebase Functions):**
- `createPayment` - Vytvoří platbu v GoPay
- `checkPayment` - Ověří stav platby
- `gopayNotification` - Přijímá notifikace od GoPay
- `paymentReturn` - Zpracovává návrat z platební brány

✅ **Frontend:**
- `gopay-frontend.js` - Frontend integrace
- `packages.js` - Upraveno pro GoPay
- `packages.html` - Aktualizováno pro načtení GoPay skriptu

✅ **Dokumentace:**
- `GOPAY_INTEGRATION_GUIDE.md` - Kompletní technická dokumentace
- `GOPAY_SETUP_INSTRUCTIONS.md` - Krok za krokem instrukce
- `GOPAY_QUICKSTART.md` - Tento rychlý start

---

## ⚡ Rychlé nastavení (5 minut)

### 1. Instalace závislostí

```bash
# Firebase CLI
npm install -g firebase-tools

# Přihlášení
firebase login

# Inicializace Functions (pokud ještě není)
cd functions
npm install
```

### 2. Nastavení GoPay credentials

```bash
# Získejte credentials z GoPay administrace
firebase functions:config:set gopay.test_client_id="VÁŠ_CLIENT_ID"
firebase functions:config:set gopay.test_client_secret="VÁŠ_CLIENT_SECRET"
firebase functions:config:set gopay.test_api_url="https://gw.sandbox.gopay.com/api"
firebase functions:config:set gopay.use_test="true"
firebase functions:config:set frontend.url="https://bulldogo.cz"
```

### 3. Nasazení Functions

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### 4. Testování

1. Otevřete `packages.html`
2. Vyberte balíček
3. Klikněte na "Zaplatit"
4. Použijte testovací platební kartu

**Hotovo! 🎉**

---

## 📁 Struktura souborů

```
abulldogo3/
├── functions/                      # Firebase Functions
│   ├── src/
│   │   └── index.ts               # Hlavní Functions kód
│   ├── package.json               # Dependencies
│   ├── tsconfig.json              # TypeScript konfigurace
│   └── .eslintrc.js               # ESLint konfigurace
│
├── gopay-frontend.js              # Frontend integrace
├── packages.js                    # Upraveno pro GoPay
├── packages.html                  # Aktualizováno pro GoPay
├── firebase.json                  # Firebase konfigurace
│
└── Dokumentace/
    ├── GOPAY_INTEGRATION_GUIDE.md # Technická dokumentace
    ├── GOPAY_SETUP_INSTRUCTIONS.md # Krok za krokem
    └── GOPAY_QUICKSTART.md        # Tento soubor
```

---

## 🔑 Klíčové funkce

### Frontend API

```javascript
// Vytvoření platby
await createGoPayPayment({
  amount: 199,
  planId: "business",
  planName: "Firma",
  userId: "user-123",
  userEmail: "user@example.com"
});

// Ověření platby
await checkGoPayPayment(paymentId, orderNumber);
```

### Backend Endpoints

- `POST /createPayment` - Vytvoří platbu
- `GET /checkPayment?paymentId=123` - Ověří platbu
- `POST /gopayNotification` - Přijme notifikaci od GoPay
- `GET /paymentReturn` - Zpracuje návrat z platební brány

---

## 🔒 Bezpečnost

✅ **ClientSecret** je uložen v Firebase Functions config (ne ve frontend kódu)
✅ **OAuth2 token** je získáván pouze na backendu
✅ **Všechny platební operace** probíhají na serveru
✅ **Notifikace** jsou ověřovány přes GoPay API

---

## 📚 Další dokumentace

- **Kompletní průvodce:** `GOPAY_INTEGRATION_GUIDE.md`
- **Nastavení krok za krokem:** `GOPAY_SETUP_INSTRUCTIONS.md`
- **GoPay API dokumentace:** https://doc.gopay.com/
- **Firebase Functions:** https://firebase.google.com/docs/functions

---

## 🆘 Podpora

### Časté problémy:

1. **Functions se nenasazují**
   - Zkontrolujte: `firebase login` a `firebase use`

2. **OAuth2 chyba**
   - Ověřte ClientID a ClientSecret v config

3. **Notifikace nepřicházejí**
   - Zkontrolujte URL v GoPay administraci
   - Ověřte, že Functions jsou nasazeny

### Logs:

```bash
# Zobrazení logs
firebase functions:log

# Nebo v Firebase Console
# Functions → Logs
```

---

**Vytvořeno:** 2025
**Verze:** 1.0

