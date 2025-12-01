# GoPay - Jak to funguje (jednoduše)

## ✅ ANO, funguje to!

### Stručně:

```
VÁŠ SERVER (frontend)  →  FIREBASE (backend)  →  GOPAY (platební brána)
  bulldogo.cz              Google Cloud           gate.gopay.cz
```

## 🎯 Jak to funguje v praxi:

1. **Váš frontend** (na bulldogo.cz):
   - Zobrazí tlačítko "Zaplatit"
   - Po kliknutí zavolá Firebase Functions přes internet

2. **Firebase Functions** (backend na Google Cloud):
   - Získá OAuth2 token od GoPay (použije ClientSecret - který je bezpečně uložen zde)
   - Vytvoří platbu v GoPay
   - Vrátí URL platební brány (`gw_url`)

3. **Frontend** přesměruje uživatele na GoPay platební bránu

4. **Uživatel zaplatí** na GoPay

5. **GoPay** přesměruje uživatele zpět na váš server

6. **Firebase Functions** automaticky ověří platbu a aktivuje plán

## ✅ Proč to funguje:

### Frontend může být kdekoli:
- ✅ Na vašem serveru (bulldogo.cz)
- ✅ Na Firebase Hosting
- ✅ Lokálně (localhost)
- ✅ Na jakémkoliv hostingu

**Proč?** Protože pouze volá Firebase Functions přes HTTPS (jako normální API).

### Backend běží na Firebase:
- ✅ Firebase Functions běží na Google Cloud
- ✅ Mají veřejnou HTTPS URL (např. `https://europe-west1-inzerio-inzerce.cloudfunctions.net`)
- ✅ Můžete je volat odkudkoliv (jako normální REST API)
- ✅ CORS je správně nastaveno

## 🔧 Co potřebujete:

### 1. Backend na Firebase:
```bash
firebase deploy --only functions
```
→ Získáte URL typu: `https://REGION-PROJECT-ID.cloudfunctions.net`

### 2. Frontend na vašem serveru:
- Soubory `packages.html`, `gopay-frontend.js`, `packages.js`
- V `gopay-frontend.js` je správně nastavená URL Firebase Functions
- Hotovo!

## 📍 Praktický příklad:

**Váš frontend kód:**
```javascript
// Toto běží na vašem serveru (bulldogo.cz)
fetch('https://europe-west1-inzerio-inzerce.cloudfunctions.net/createPayment', {
  method: 'POST',
  body: JSON.stringify({ amount: 199, ... })
})
```

**Firebase Function:**
```typescript
// Toto běží na Firebase (Google Cloud)
export const createPayment = functions.https.onRequest(async (req, res) => {
  // Získá OAuth2 token (použije ClientSecret z config)
  const token = await getGoPayAccessToken();
  
  // Vytvoří platbu v GoPay
  const payment = await axios.post('https://gate.gopay.cz/api/payments/payment', {
    // ...
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // Vrátí URL pro přesměrování
  res.json({ gwUrl: payment.data.gw_url });
});
```

## ✅ Závěr:

**Ano, funguje to perfektně!**

- Frontend na vašem serveru ✅
- Backend na Firebase ✅  
- Vše komunikuje přes HTTPS ✅
- ClientSecret je bezpečně uložen na Firebase ✅

**Jediné, co potřebujete:**
1. Nasadit Functions na Firebase (`firebase deploy --only functions`)
2. Zkontrolovat URL v `gopay-frontend.js`
3. Hotovo!

---

**Více detailů:** `GOPAY_ARCHITEKTURA.md`

