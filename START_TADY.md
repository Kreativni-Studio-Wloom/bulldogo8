# 🚀 ZAČNĚTE TADY - Co musíte udělat TEĎ

## 📋 Jednoduše - 5 hlavních kroků:

---

## ✅ 1. ZÍSKAT GOPAY CREDENTIALS

1. Jděte na https://www.gopay.com/
2. Přihlaste se / vytvořte účet
3. Najděte **API sekci** v administraci
4. **Zkopírujte si:**
   - ClientID
   - ClientSecret
   - API URL (test: `https://gw.sandbox.gopay.com/api`)

**⏱️ Čas: 5-10 minut**

---

## ✅ 2. NAINSTALOVAT ZÁVISLOSTI

```bash
# Otevřete terminál v projektu
cd /Users/adam/Desktop/abulldogo3

# Nainstalujte Firebase CLI (pokud nemáte)
npm install -g firebase-tools

# Přihlaste se
firebase login

# Vyberte projekt
firebase use inzerio-inzerce

# Nainstalujte závislosti Functions
cd functions
npm install
cd ..
```

**⏱️ Čas: 2-5 minut**

---

## ✅ 3. NASTAVIT GOPAY CREDENTIALS

```bash
# Nahraďte VÁŠ_CLIENT_ID a VÁŠ_CLIENT_SECRET skutečnými hodnotami!
firebase functions:config:set gopay.test_client_id="VÁŠ_CLIENT_ID"
firebase functions:config:set gopay.test_client_secret="VÁŠ_CLIENT_SECRET"
firebase functions:config:set gopay.test_api_url="https://gw.sandbox.gopay.com/api"
firebase functions:config:set gopay.use_test="true"
firebase functions:config:set frontend.url="https://bulldogo.cz"
```

**⏱️ Čas: 2 minuty**

---

## ✅ 4. NASAZENÍ NA FIREBASE

```bash
# Zkompilovat
cd functions
npm run build
cd ..

# Nasadit
firebase deploy --only functions
```

**⏱️ Čas: 3-5 minut**

**💡 Zkopírujte si URL které se zobrazí!** (budete potřebovat region)

---

## ✅ 5. OVĚŘIT URL V KÓDU

Otevřete soubor: `gopay-frontend.js`

Zkontrolujte řádek 18:
```javascript
const region = "europe-west1"; // ZMĚŇTE pokud se liší od kroku 4!
```

**⏱️ Čas: 1 minuta**

---

## ✅ 6. TESTOVAT!

1. Otevřete `packages.html`
2. Vyberte balíček
3. Klikněte "Zaplatit"
4. Použijte testovací kartu: `4200000000000000`
5. Hotovo!

**⏱️ Čas: 2 minuty**

---

## ✅ HOTOVO! 🎉

**Celkem: ~15-25 minut**

---

## 🆘 Pokud něco nefunguje:

### "Firebase CLI není nainstalováno"
```bash
npm install -g firebase-tools
```

### "Nejsem přihlášen"
```bash
firebase login
```

### "Functions se nenasazují"
```bash
firebase use inzerio-inzerce  # Zkontrolujte projekt
firebase functions:config:get  # Zkontrolujte credentials
```

### "Platba se nevytvoří"
- Otevřete Developer Console (F12)
- Zkontrolujte chyby
- Ověřte Functions logs v Firebase Console

---

## 📚 Detailní instrukce:

Pokud potřebujete více detailů, podívejte se na:
- `GOPAY_KROK_ZA_KROKEM.md` - kompletní detailní checklist
- `GOPAY_SETUP_INSTRUCTIONS.md` - podrobné instrukce

---

**STARTUJTE s krokem 1! 🚀**

