# Firebase Billing - Aktivace

## ⚠️ Důležité: Firebase Functions vyžadují aktivní billing účet

Firebase Functions jsou serverless služby, které běží na Google Cloud. I když máte **Free tier** (generous free tier), musíte mít aktivní billing účet.

## ✅ Co potřebujete udělat:

### Krok 1: Otevřít Firebase Console

1. Jděte na: https://console.firebase.google.com/project/inzerio-inzerce
2. Přihlaste se svým účtem

### Krok 2: Aktivovat billing

1. V levém menu klikněte na **⚙️ Project settings** (Nastavení projektu)
2. Klikněte na záložku **Usage and billing** (Využití a účtování)
3. Nebo přímo: https://console.firebase.google.com/project/inzerio-inzerce/usage

### Krok 3: Připojit billing účet

1. Klikněte na **Upgrade project** nebo **Add payment method**
2. Připojte platební kartu (kreditní/debetní)
3. Potvrďte podmínky

## 💰 Kolik to stojí?

**Dobrá zpráva:** Firebase má **velkorysý Free tier:**

- **První 2 miliony volání Functions zdarma** měsíčně
- **400,000 GB-sekund** výpočetního času zdarma
- **200,000 GB-sekund** volného času pro CPU
- **5 GB** odchozího provozu zdarma

**Pro vaše použití (GoPay integrace):**
- Pár tisíc volání měsíčně = **ZDARMA**
- Pouze pokud byste měli velmi vysoký provoz, platili byste

**Odhadované náklady:**
- Pro malé/ střední projekty: **0 Kč/měsíc** (v rámci Free tieru)
- Pokud překročíte Free tier: cca **0,40 USD za milion volání** + compute time

## 🔒 Bezpečnost

- Google/Firebase automaticky zastaví služby, pokud by náklady překročily rozumnou úroveň
- Můžete nastavit **budget alerts** (upozornění na výdaje)
- Můžete nastavit **spending limits** (limity výdajů)

## 📝 Po aktivaci billing účtu:

1. Počkejte 1-2 minuty, než se billing aktivuje
2. Zkuste znovu nasadit:
   ```bash
   firebase deploy --only functions
   ```

## ⚠️ Pokud nemáte billing kartu:

- Můžete použít Google Play Gift Card (v některých zemích)
- Nebo předplacenou kartu
- Billing účet můžete kdykoliv zrušit, ale Functions přestanou fungovat

## ✅ Alternativa (pokud nechcete billing):

**Bohužel není možné použít Firebase Functions bez billing účtu.**

Alternativy:
- Vlastní server s Node.js (vlastní hosting)
- Vercel Functions (také má free tier, ale jiný systém)
- Netlify Functions

**Ale:** Firebase Functions jsou ideální řešení pro GoPay integraci a Free tier je velmi velkorysý.

---

**Po aktivaci billing účtu zkuste znovu nasadit Functions!**

