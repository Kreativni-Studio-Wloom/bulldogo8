# Oprava ukládání platby do databáze

## Problém

Po úspěšné platbě se zobrazí informace, ale neukládá se do databáze a uživatel nedostane to, za co zaplatil.

## Co bylo opraveno:

### 1. **Upravena podmínka v `success.html`**
- Původně kontrolovala pouze `gopayParams.idPaymentSession`
- Nyní kontroluje i `paymentSessionId` a `orderNumber`
- GoPay může vracet různé parametry podle typu platby

### 2. **Přidáno automatické nastavení state**
- Pokud není `state` v URL, automaticky se nastaví na `PAID`
- GoPay při úspěšné platbě nemusí vracet `state` v URL

### 3. **Vylepšené logování**
- Přidány detailní logy pro debugging
- Každý krok je logován do konzole

### 4. **Opraveno ukládání do Firestore**
- Lepší zpracování parametrů
- Podpora pro `paymentSessionId` i `idPaymentSession`

## Jak zkontrolovat, že to funguje:

### 1. Otevřete Developer Console (F12)

Po úspěšné platbě byste měli vidět v konzoli:

```
🔍 Zpracovávám GoPay parametry: {...}
✅ GoPay parametry nalezeny: {...}
💾 Ukládám platbu do Firestore...
✅ Platba uložena do Firestore: hobby
🔍 Payment type pro orderNumber: hobby → {type: 'package', id: 'hobby'}
🎯 Aktivuji plán... {type: 'package', id: 'hobby'}
✅ Balíček aktivován: hobby
✅ Plán aktivován: {type: 'package', id: 'hobby'}
```

### 2. Zkontrolujte Firestore

1. Jděte na: https://console.firebase.google.com/project/inzerio-inzerce/firestore
2. Klikněte na kolekci **payments**
3. Měl by být záznam s `orderNumber: "hobby"` (nebo "firma")
4. Zkontrolujte `state` - mělo by být "PAID"

### 3. Zkontrolujte uživatelský profil

1. Jděte na kolekci **users**
2. Vyberte uživatele, který zaplatil
3. Jděte na `profile/profile`
4. Měl by být nastaven:
   - `plan: "hobby"` (nebo "business")
   - `planPeriodStart: Timestamp`
   - `planPeriodEnd: Timestamp`

## Pokud to stále nefunguje:

### Zkontrolujte v Developer Console:

1. **Jsou tam chyby?** (červené zprávy)
2. **Vidíte logy?** (🔍, 💾, ✅, ❌)
3. **Co se zobrazuje?** Zkopírujte logy z konzole

### Možné problémy:

1. **Uživatel není přihlášen**
   - Zkontrolujte, že jste přihlášeni
   - Zkontrolujte `window.firebaseAuth.currentUser`

2. **Firebase není dostupný**
   - Zkontrolujte, že `window.firebaseDb` existuje
   - Zkontrolujte Firebase Console → Firestore → zda je povoleno

3. **Chybí orderNumber**
   - GoPay musí vracet `orderNumber` v URL parametrech
   - Zkontrolujte URL po návratu z GoPay

4. **Firestore pravidla**
   - Zkontrolujte, že máte oprávnění zapisovat do Firestore
   - Zkontrolujte Firestore Rules

---

**Po opravě by mělo vše fungovat! Zkuste znovu zaplatit a zkontrolujte logy v konzoli.**

