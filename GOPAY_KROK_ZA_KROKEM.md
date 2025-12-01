# GoPay Integrace - KROK ZA KROKEM checklist

## 📋 Co musíte udělat, aby vše fungovalo

---

## ✅ KROK 1: Získat GoPay API přihlašovací údaje

### Co potřebujete:
- **ClientID** (GoID)
- **ClientSecret** (GoSecret)
- **Test API URL**: `https://gw.sandbox.gopay.com/api`
- **Produkční API URL**: `https://gate.gopay.cz/api`

### Jak na to:
1. Jděte na: https://www.gopay.com/
2. Vytvořte účet nebo se přihlaste
3. Jděte do GoPay administrace
4. Najděte sekci **API** nebo **Vývojářské nástroje**
5. Vytvořte aplikaci (testovací nebo produkční)
6. **Zkopírujte si:**
   - ClientID
   - ClientSecret
   - API URL

**⚠️ DŮLEŽITÉ:** Zkopírujte si tyto údaje, budete je potřebovat v kroku 3!

---

## ✅ KROK 2: Nainstalovat Firebase CLI a závislosti

### 2.1. Nainstalovat Firebase CLI (pokud ještě nemáte)

```bash
npm install -g firebase-tools
```

### 2.2. Ověřit instalaci

```bash
firebase --version
```

Mělo by se zobrazit číslo verze (např. `12.9.0`)

### 2.3. Přihlásit se do Firebase

```bash
firebase login
```

- Otevře se prohlížeč
- Přihlaste se svým Google účtem
- Povolte přístup

### 2.4. Vybrat projekt

```bash
firebase use inzerio-inzerce
```

(Nebo váš Firebase Project ID)

### 2.5. Nainstalovat závislosti pro Functions

```bash
cd functions
npm install
```

**Počkejte, až se nainstalují všechny balíčky** (může to trvat 1-2 minuty)

### 2.6. Ověřit, že vše je nainstalováno

```bash
npm list
```

Mělo by zobrazit seznam balíčků bez chyb.

---

## ✅ KROK 3: Nastavit GoPay credentials v Firebase

### 3.1. Nastavit testovací credentials

```bash
cd ..
firebase functions:config:set gopay.test_client_id="VÁŠ_TEST_CLIENT_ID"
```

**Nahraďte `VÁŠ_TEST_CLIENT_ID`** skutečným ClientID z GoPay

```bash
firebase functions:config:set gopay.test_client_secret="VÁŠ_TEST_CLIENT_SECRET"
```

**Nahraďte `VÁŠ_TEST_CLIENT_SECRET`** skutečným ClientSecret z GoPay

```bash
firebase functions:config:set gopay.test_api_url="https://gw.sandbox.gopay.com/api"
```

```bash
firebase functions:config:set gopay.use_test="true"
```

### 3.2. Nastavit frontend URL

```bash
firebase functions:config:set frontend.url="https://bulldogo.cz"
```

**Nahraďte `bulldogo.cz`** vaší doménou (nebo `http://localhost:5500` pro testování)

### 3.3. Ověřit, že vše je nastaveno

```bash
firebase functions:config:get
```

**Mělo by zobrazit:**
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

**✅ Pokud to vidíte, krok 3 je hotový!**

---

## ✅ KROK 4: Zkompilovat TypeScript

### 4.1. Zkompilovat Functions

```bash
cd functions
npm run build
```

**Počkejte, až kompilace skončí** (může to trvat 10-30 sekund)

**✅ Mělo by zobrazit:**
```
✔  Compiled successfully
```

### 4.2. Ověřit, že se vytvořila složka `lib/`

```bash
ls lib
```

Měli byste vidět soubor `lib/index.js`

---

## ✅ KROK 5: Nasadit Functions do Firebase

### 5.1. Nasadit Functions

```bash
cd ..
firebase deploy --only functions
```

**⚠️ POZOR:** Toto může trvat 2-5 minut!

**Počkejte, až se zobrazí:**

```
✔  functions[createPayment(europe-west1)]: Successful create operation.
✔  functions[checkPayment(europe-west1)]: Successful create operation.
✔  functions[gopayNotification(europe-west1)]: Successful create operation.
✔  functions[paymentReturn(europe-west1)]: Successful create operation.

Function URL (createPayment): https://europe-west1-inzerio-inzerce.cloudfunctions.net/createPayment
```

### 5.2. **DŮLEŽITÉ - Zkopírujte si tyto URL!**

Zkopírujte si URL typu:
```
https://REGION-PROJECT-ID.cloudfunctions.net/...
```

**Budete potřebovat:**
- Region (např. `europe-west1`)
- Project ID (např. `inzerio-inzerce`)

---

## ✅ KROK 6: Ověřit URL v frontend kódu

### 6.1. Otevřít soubor `gopay-frontend.js`

### 6.2. Zkontrolovat řádky 17-18:

```javascript
const projectId = "inzerio-inzerce"; // ✅ Mělo by odpovídat vašemu projektu
const region = "europe-west1"; // ⚠️ ZMĚŇTE na region z kroku 5!
```

**⚠️ Pokud se region liší od toho v kroku 5, změňte ho!**

### 6.3. (Volitelné) Pokud chcete použít vlastní URL:

Odemkněte a upravte řádek 16:
```javascript
const CUSTOM_FUNCTIONS_URL = "https://europe-west1-inzerio-inzerce.cloudfunctions.net";
// Odkomentujte a použijte vaši URL
```

---

## ✅ KROK 7: Otestovat lokálně (volitelné)

### 7.1. Spustit Firebase emulátory

```bash
firebase emulators:start
```

**Nebo pouze Functions:**

```bash
cd functions
npm run serve
```

### 7.2. Otevřít testovací stránku

Otevřete `packages.html` v prohlížeči a zkontrolujte konzoli (F12):
- Mělo by zobrazit: `🚀 Inicializace GoPay integrace`
- Neměly by být žádné chyby

---

## ✅ KROK 8: Otestovat s testovací platbou

### 8.1. Otevřít stránku balíčků

Otevřete: `https://bulldogo.cz/packages.html` (nebo lokálně)

### 8.2. Vybrat balíček

Klikněte na tlačítko "Vybrat" u některého balíčku

### 8.3. Kliknout na "Zaplatit"

Mělo by vás přesměrovat na GoPay platební bránu

### 8.4. Použít testovací platební kartu

**Testovací platební karty:**
- Číslo karty: `4200000000000000` (všechny nuly)
- CVV: jakékoliv 3 číslice (např. `123`)
- Expirace: jakékoliv budoucí datum
- Držitel karty: jakékoliv jméno

**Nebo použijte další testovací karty z:**
https://help.gopay.com/cs/tema/testovaci-platebni-karty

### 8.5. Dokončit platbu

Po zaplacení vás GoPay přesměruje zpět na váš web

### 8.6. Zkontrolovat výsledek

- ✅ Měla by se zobrazit zpráva "Platba byla úspěšně dokončena!"
- ✅ Plán by měl být aktivován v Firestore

---

## ✅ KROK 9: Ověřit v Firebase Console

### 9.1. Otevřít Firebase Console

https://console.firebase.google.com/project/inzerio-inzerce

### 9.2. Zkontrolovat Firestore

1. Jděte na **Firestore Database**
2. Klikněte na kolekci **payments**
3. Měl by být záznam o platbě s `state: "PAID"`

### 9.3. Zkontrolovat uživatelský profil

1. Jděte na kolekci **users**
2. Vyberte uživatele
3. Jděte na `profile/profile`
4. Měl by být nastaven `plan: "business"` (nebo váš vybraný plán)

### 9.4. Zkontrolovat Functions logs

1. Jděte na **Functions**
2. Klikněte na **Logs**
3. Měli byste vidět logy z:
   - `createPayment`
   - `checkPayment`
   - `gopayNotification`

**Pokud vidíte všechny tyto logy bez chyb, vše funguje! ✅**

---

## ✅ KROK 10: Nastavit produkční credentials (až budete připraveni)

### 10.1. Získat produkční credentials z GoPay

Po úspěšném testování požádejte o produkční přístup u GoPay

### 10.2. Nastavit produkční credentials

```bash
firebase functions:config:set gopay.client_id="VÁŠ_PRODUKČNÍ_CLIENT_ID"
firebase functions:config:set gopay.client_secret="VÁŠ_PRODUKČNÍ_CLIENT_SECRET"
firebase functions:config:set gopay.api_url="https://gate.gopay.cz/api"
firebase functions:config:set gopay.use_test="false"
```

### 10.3. Znovu nasadit Functions

```bash
firebase deploy --only functions
```

---

## ✅ KROK 11: Hotovo!

**Gratulujeme! GoPay integrace je funkční! 🎉**

---

## 🆘 Řešení problémů

### Problém: "Functions se nenasazují"

**Řešení:**
```bash
# Zkontrolujte přihlášení
firebase login

# Zkontrolujte projekt
firebase use inzerio-inzerce

# Zkontrolujte oprávnění v Firebase Console
```

### Problém: "OAuth2 chyba"

**Řešení:**
```bash
# Ověřte credentials
firebase functions:config:get

# Zkontrolujte, že jsou správně nastaveny ClientID a ClientSecret
```

### Problém: "Platba se nevytvoří"

**Řešení:**
1. Otevřete Developer Console (F12)
2. Zkontrolujte chyby
3. Zkontrolujte Functions logs v Firebase Console
4. Ověřte, že URL v `gopay-frontend.js` odpovídá nasazeným Functions

### Problém: "Notifikace nepřicházejí"

**Řešení:**
1. Ověřte, že Functions jsou nasazeny
2. Zkontrolujte URL v GoPay administraci
3. Zkontrolujte Functions logs

---

## 📝 Checklist - Označte si co je hotové:

- [ ] Krok 1: GoPay credentials získány
- [ ] Krok 2: Firebase CLI nainstalováno a přihlášeno
- [ ] Krok 3: GoPay credentials nastaveny v Firebase config
- [ ] Krok 4: TypeScript zkompilován
- [ ] Krok 5: Functions nasazeny na Firebase
- [ ] Krok 6: URL v frontend kódu ověřena
- [ ] Krok 7: Lokální testování (volitelné)
- [ ] Krok 8: Testovací platba proběhla úspěšně
- [ ] Krok 9: Ověřeno v Firebase Console
- [ ] Krok 10: Produkční credentials nastaveny (až později)

---

**Pokud narazíte na jakýkoliv problém, podívejte se na:**
- `GOPAY_SETUP_INSTRUCTIONS.md` - detailní instrukce
- `GOPAY_INTEGRATION_GUIDE.md` - technická dokumentace
- Firebase Functions logs v Console

**Hotovo! 🚀**

