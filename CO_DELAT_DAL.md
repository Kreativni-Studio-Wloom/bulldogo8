# 🚀 CO DĚLAT DÁL - Jednoduše krok za krokem

## ✅ KROK 1: Zkontrolovat region v kódu (2 minuty)

### Co udělat:

1. **Otevřete soubor:** `gopay-frontend.js` (v editoru)
2. **Najděte řádek 22:**
   ```javascript
   const region = "europe-west1";
   ```
3. **Zkontrolujte, co jste viděli v terminálu:**
   - Po nasazení se zobrazily URL Functions
   - Najděte tam region (např. `europe-west1` nebo `us-central1`)
4. **Pokud se region liší, změňte ho na řádku 22**

**💡 Pokud nevíte jaký region, zkuste znovu nasadit nebo zkontrolujte Firebase Console → Functions**

---

## ✅ KROK 2: Otestovat platbu (5 minut)

### Co udělat:

1. **Otevřete stránku:**
   - Jděte na: `https://bulldogo.cz/packages.html`
   - NEBO otevřete lokálně: `packages.html` v prohlížeči

2. **Vyberte balíček:**
   - Klikněte na tlačítko "Vybrat" u balíčku (např. "Firma")

3. **Klikněte na "Zaplatit"**
   - Mělo by vás přesměrovat na GoPay platební bránu

4. **Použijte testovací kartu:**
   - Číslo karty: `4200000000000000` (všechny nuly)
   - CVV: `123` (jakékoliv 3 číslice)
   - Expirace: `12/2025` (jakékoliv budoucí datum)
   - Jméno: `Test Test` (jakékoliv)

5. **Dokončete platbu**
   - Po zaplacení vás GoPay přesměruje zpět

6. **Výsledek:**
   - ✅ Měla by se zobrazit zpráva: **"Platba byla úspěšně dokončena!"**

---

## ✅ KROK 3: Zkontrolovat v Firebase Console (2 minuty)

### Co udělat:

1. **Otevřete Firebase Console:**
   - Jděte na: https://console.firebase.google.com/project/inzerio-inzerce

2. **Zkontrolujte Firestore:**
   - Klikněte na **Firestore Database** vlevo
   - Klikněte na kolekci **payments**
   - Měl by tam být záznam o platbě s `state: "PAID"`

3. **Zkontrolujte Functions logs:**
   - Klikněte na **Functions** vlevo
   - Klikněte na **Logs**
   - Měli byste vidět logy z `createPayment`, `checkPayment`, `gopayNotification`

---

## 🆘 Pokud něco nefunguje:

### "Platba se nevytvoří"
- Otevřete **Developer Console** (stiskněte F12)
- Podívejte se na **Console** záložku
- Jsou tam nějaké červené chyby? Zkopírujte je a pošlete mi je

### "Nepřesměruje na GoPay"
- Otevřete **Developer Console** (F12)
- Podívejte se na **Console** záložku
- Co se zobrazuje? Jsou tam chyby?

### "Platba není aktivována"
- Otevřete Firebase Console → Firestore
- Je tam záznam v kolekci `payments`?
- Jaký má stav? (`PAID`, `CREATED`, `CANCELED`?)

---

## ✅ HOTOVO!

Pokud vše funguje:
- ✅ Platba se vytvoří
- ✅ Přesměruje na GoPay
- ✅ Po zaplacení se vrátíte zpět
- ✅ Zobrazí se úspěšná zpráva

**Tak je to hotové! 🎉**

---

## 📝 Shrnutí - 3 jednoduché kroky:

1. ✅ **Zkontrolovat region** v `gopay-frontend.js` (řádek 22)
2. ✅ **Otestovat platbu** na `packages.html`
3. ✅ **Zkontrolovat** v Firebase Console, že vše funguje

**To je vše!**

---

**Pokud máte problém, napište mi:**
- Co se stalo (nebo nestalo)
- Co vidíte v Developer Console (F12)
- Co vidíte v Firebase Console

**Pomůžu vám to vyřešit! 👍**

