# Debug - Proč se platba neukládá do databáze

## Jak zkontrolovat problém:

### 1. Otevřete Developer Console (F12)

Po úspěšné platbě zkontrolujte konzoli. Měli byste vidět:

**✅ Pokud vše funguje:**
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

**❌ Pokud je problém:**
- Chybí některé logy
- Jsou tam červené chyby
- Vidíte varování (⚠️)

### 2. Zkontrolujte URL parametry

Po návratu z GoPay zkontrolujte URL v prohlížeči:
- Měla by obsahovat parametry jako `?orderNumber=hobby&...`
- Zkopírujte celou URL a pošlete mi ji

### 3. Zkontrolujte sessionStorage

V Developer Console zadejte:
```javascript
sessionStorage.getItem('gopay_payment')
```

Mělo by zobrazit JSON s informacemi o platbě.

### 4. Zkontrolujte Firestore

1. Jděte na: https://console.firebase.google.com/project/inzerio-inzerce/firestore
2. Klikněte na kolekci **payments**
3. Je tam záznam s `orderNumber: "hobby"`?

### 5. Zkontrolujte uživatelský profil

1. Jděte na kolekci **users**
2. Vyberte uživatele
3. Jděte na `profile/profile`
4. Je tam `plan: "hobby"`?

## Možné problémy:

### Problém 1: GoPay nevrací orderNumber v URL

**Řešení:** Kód už má fallback na sessionStorage - mělo by to fungovat.

### Problém 2: Uživatel není přihlášen

**Zkontrolujte:**
```javascript
window.firebaseAuth.currentUser
```

Mělo by vrátit objekt uživatele.

### Problém 3: Firebase není dostupný

**Zkontrolujte:**
```javascript
window.firebaseDb
```

Mělo by vrátit Firestore instanci.

### Problém 4: Firestore Rules blokují zápis

**Zkontrolujte:**
- Firebase Console → Firestore → Rules
- Měly by povolovat zápis pro přihlášené uživatele

---

**Pošlete mi:**
1. Logy z Developer Console (F12)
2. URL po návratu z GoPay
3. Co vidíte v Firestore Console

**Pak to opravím!**

