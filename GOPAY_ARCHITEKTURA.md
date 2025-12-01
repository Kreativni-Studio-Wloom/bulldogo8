# GoPay Integrace - Architektura a propojení

## ✅ Ano, funguje to perfektně!

### Jak to funguje:

```
┌─────────────────────────────────────────┐
│         VÁŠ SERVER / FRONTEND           │
│  (bulldogo.cz, nebo kdekoliv jinde)    │
│                                         │
│  - packages.html                        │
│  - gopay-frontend.js                    │
│  - packages.js                          │
└───────────────┬─────────────────────────┘
                │
                │ HTTPS volání
                │ (fetch/axios)
                ▼
┌─────────────────────────────────────────┐
│      FIREBASE FUNCTIONS (Backend)       │
│  (běží na Google Cloud, veřejně dostupné)│
│                                         │
│  - createPayment                        │
│  - checkPayment                         │
│  - gopayNotification                    │
│  - paymentReturn                        │
└───────────────┬─────────────────────────┘
                │
                │ OAuth2 + API
                ▼
┌─────────────────────────────────────────┐
│           GOPAY API                     │
│  (gate.gopay.cz/api)                    │
└─────────────────────────────────────────┘
```

## 🎯 Klíčové body

### 1. Frontend může být kdekoli

✅ **Váš server** (bulldogo.cz)
✅ **Firebase Hosting** 
✅ **Lokálně** (localhost)
✅ **Jakýkoliv hosting**

**Proč?** Protože frontend pouze volá Firebase Functions přes HTTPS pomocí `fetch()`.

### 2. Backend běží na Firebase

✅ **Firebase Functions** běží na Google Cloud
✅ **Veřejně dostupné** přes HTTPS
✅ **CORS** je správně nastaveno
✅ **Bezpečné** - ClientSecret je uložen na serveru

### 3. Komunikace

**Frontend → Backend:**
```javascript
// Váš frontend (kdekoli) volá Firebase Functions
fetch('https://europe-west1-inzerio-inzerce.cloudfunctions.net/createPayment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
})
```

**Backend → GoPay:**
```typescript
// Firebase Functions volají GoPay API
axios.post('https://gate.gopay.cz/api/payments/payment', {
  // ...
}, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
```

## 📍 Kde co běží

| Komponenta | Kde běží | Adresa/URL |
|------------|----------|------------|
| **Frontend** | Váš server | `https://bulldogo.cz/packages.html` |
| **Backend (Functions)** | Firebase/Google Cloud | `https://REGION-PROJECT-ID.cloudfunctions.net` |
| **GoPay API** | GoPay servery | `https://gate.gopay.cz/api` |

## 🔧 Nastavení URL

### V gopay-frontend.js

URL Firebase Functions se automaticky detekuje:

```javascript
const getFunctionsUrl = () => {
  const projectId = "inzerio-inzerce"; // Váš Firebase Project ID
  const region = "europe-west1"; // Region, kde běží Functions
  
  // Pro produkci (na vašem serveru)
  return `https://${region}-${projectId}.cloudfunctions.net`;
};
```

### Po nasazení Functions

Po spuštění `firebase deploy --only functions` uvidíte v konzoli URL:

```
Function URL (createPayment): https://europe-west1-inzerio-inzerce.cloudfunctions.net/createPayment
```

**Zkopírujte si tyto URL a ověřte v `gopay-frontend.js`, že region odpovídá!**

## ✅ Výhody tohoto řešení

1. **Flexibilita**
   - Frontend může být kdekoli
   - Můžete změnit hosting bez ovlivnění backendu

2. **Bezpečnost**
   - ClientSecret je na Firebase (ne ve frontendu)
   - OAuth2 token se získává na serveru
   - CORS je správně nastaveno

3. **Škálovatelnost**
   - Firebase Functions se automaticky škálují
   - Nemusíte řešit serverovou infrastrukturu

4. **Jednoduchost**
   - Backend je serverless (platíte jen za použití)
   - Snadné nasazení a údržba

## 🔐 Bezpečnost

### Co je na Firebase (bezpečné):
- ✅ ClientSecret
- ✅ OAuth2 token získání
- ✅ Vytvoření platby
- ✅ Ověření platby
- ✅ Zpracování notifikací

### Co je na vašem serveru (veřejné):
- ✅ Frontend HTML/JS soubory
- ✅ Volání Firebase Functions (veřejné URL)
- ✅ Zobrazení výsledku

**Důležité:** ClientSecret NENÍ ve frontend kódu, takže je to bezpečné!

## 📋 Co potřebujete

### Na vašem serveru (frontend):
- ✅ `packages.html`
- ✅ `gopay-frontend.js`
- ✅ `packages.js` (upraveno)
- ✅ Správně nastavená URL Functions v `gopay-frontend.js`

### Na Firebase (backend):
- ✅ Nasazené Functions
- ✅ Nastavené GoPay credentials
- ✅ Správně nakonfigurované CORS

## 🚀 Proces nasazení

1. **Backend (Firebase):**
   ```bash
   firebase deploy --only functions
   ```
   → Zkopírujte si URL Functions

2. **Frontend (váš server):**
   - Zkontrolujte URL v `gopay-frontend.js`
   - Nasaďte soubory na váš server
   - Hotovo!

## ✅ Závěr

**ANO, funguje to perfektně!**

- Frontend na vašem serveru ✅
- Backend na Firebase ✅
- GoPay API ✅
- Vše komunikuje přes HTTPS ✅

Jediné, co potřebujete, je správně nastavit URL Firebase Functions v `gopay-frontend.js` po jejich nasazení.

---

**Vytvořeno:** 2025

