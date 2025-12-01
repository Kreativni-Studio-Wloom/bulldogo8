# 🔧 Oprava chyby 404 - Functions endpoint neexistuje

## Problém

Chyba: `404` na `https://europe-west1-inzerio-inzerce.cloudfunctions.net/createPayment`

To znamená, že Functions buď:
- Nejsou nasazeny na tomto regionu
- Nebo jsou nasazeny na jiném regionu

## ✅ Řešení - 2 možnosti:

### Možnost 1: Zkontrolovat Firebase Console (nejrychlejší)

1. **Otevřete Firebase Console:**
   - https://console.firebase.google.com/project/inzerio-inzerce/functions

2. **Podívejte se na seznam Functions:**
   - Měli byste vidět: `createPayment`, `checkPayment`, `gopayNotification`, `paymentReturn`

3. **Klikněte na `createPayment`:**
   - Podívejte se na **URL** - jaký region tam je?
   - Např. `https://us-central1-inzerio-inzerce.cloudfunctions.net/createPayment`

4. **Zkopírujte si region** (např. `us-central1`)

5. **Upravte `gopay-frontend.js` řádek 22:**
   ```javascript
   const region = "us-central1"; // Změňte na správný region!
   ```

### Možnost 2: Znovu nasadit a zkontrolovat výstup

1. **Znovu nasaďte Functions:**
   ```bash
   firebase deploy --only functions
   ```

2. **Podívejte se na výstup:**
   - Mělo by tam být:
   ```
   Function URL (createPayment): https://REGION-inzerio-inzerce.cloudfunctions.net/createPayment
   ```

3. **Zkopírujte si region** z URL

4. **Upravte `gopay-frontend.js` řádek 22:**
   ```javascript
   const region = "REGION"; // Změňte na region z výstupu!
   ```

---

## ✅ Po opravě:

1. **Obnovte stránku** (F5)
2. **Zkuste znovu** kliknout na "Zaplatit"
3. **Mělo by to fungovat!**

---

## 🆘 Pokud stále nefunguje:

### Zkontrolujte, že Functions jsou nasazeny:

```bash
firebase functions:list
```

Měli byste vidět seznam všech Functions.

### Nebo zkontrolujte v Firebase Console:

https://console.firebase.google.com/project/inzerio-inzerce/functions

---

**Nejjednodušší: Otevřete Firebase Console → Functions → klikněte na createPayment → zkopírujte region z URL → upravte gopay-frontend.js**

