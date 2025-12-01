# 🎉 Functions jsou nasazeny! Co teď?

## ✅ Kontrola region v frontend kódu

### Krok 1: Zkontrolujte region z výstupu

Z výstupu nasazení najděte URL typu:
```
Function URL (createPayment): https://REGION-inzerio-inzerce.cloudfunctions.net/createPayment
```

**Zkopírujte si region** (např. `europe-west1`, `us-central1`, atd.)

### Krok 2: Otevřete `gopay-frontend.js`

Najděte řádek 22 a zkontrolujte region:

```javascript
const region = "europe-west1"; // ⚠️ ZMĚŇTE pokud se liší!
```

### Krok 3: Pokud se region liší, změňte ho

Pokud region z kroku 1 není `europe-west1`, změňte řádek 22 na správný region.

---

## ✅ Testování

### Krok 1: Otevřete stránku balíčků

Otevřete: `https://bulldogo.cz/packages.html` (nebo lokálně)

### Krok 2: Vyberte balíček

Klikněte na tlačítko "Vybrat" u některého balíčku (např. "Firma")

### Krok 3: Klikněte na "Zaplatit"

Mělo by vás přesměrovat na GoPay platební bránu

### Krok 4: Použijte testovací platební kartu

**Testovací platební údaje:**
- **Číslo karty:** `4200000000000000` (všechny nuly)
- **CVV:** jakékoliv 3 číslice (např. `123`)
- **Expirace:** jakékoliv budoucí datum (např. `12/2025`)
- **Držitel:** jakékoliv jméno

**Nebo použijte další testovací karty:**
https://help.gopay.com/cs/tema/testovaci-platebni-karty

### Krok 5: Dokončete platbu

Po zaplacení vás GoPay přesměruje zpět na váš web

### Krok 6: Zkontrolujte výsledek

✅ Měla by se zobrazit zpráva: **"Platba byla úspěšně dokončena!"**
✅ Plán by měl být aktivován

---

## ✅ Ověření v Firebase Console

### 1. Firestore Database

1. Jděte na: https://console.firebase.google.com/project/inzerio-inzerce/firestore
2. Klikněte na kolekci **payments**
3. Měl by být záznam o platbě s `state: "PAID"`

### 2. Uživatelský profil

1. Jděte na kolekci **users**
2. Vyberte uživatele, který zaplatil
3. Jděte na `profile/profile`
4. Měl by být nastaven `plan: "business"` (nebo váš vybraný plán)

### 3. Functions Logs

1. Jděte na: https://console.firebase.google.com/project/inzerio-inzerce/functions/logs
2. Měli byste vidět logy z:
   - `createPayment` ✅
   - `checkPayment` ✅
   - `gopayNotification` ✅

---

## 🆘 Řešení problémů

### "Platba se nevytvoří"

**Zkontrolujte:**
1. Developer Console (F12) - jsou tam nějaké chyby?
2. Functions logs v Firebase Console
3. URL v `gopay-frontend.js` odpovídá nasazeným Functions?

### "Přesměrování nefunguje"

**Zkontrolujte:**
1. Je uživatel přihlášen?
2. Jsou správně načteny Firebase Auth moduly?
3. Developer Console (F12) - jsou tam chyby?

### "Platba není aktivována"

**Zkontrolujte:**
1. Firestore kolekce `payments` - je tam záznam?
2. Functions logs - proběhla notifikace od GoPay?
3. Uživatelský profil - je tam `plan`?

---

## ✅ Hotovo!

Pokud vše funguje, máte kompletní GoPay integraci! 🎉

**Příští kroky:**
- Otestujte s více testovacími platbami
- Nastavte produkční credentials (až budete připraveni)
- Monitorujte Functions logs

---

**Pokud narazíte na problémy, napište mi!**

