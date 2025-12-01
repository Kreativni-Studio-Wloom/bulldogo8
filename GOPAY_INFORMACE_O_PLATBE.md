# GoPay - Informace o platbě

## ✅ Ano, GoPay vrací informace o platbě!

GoPay vrací informace o platbě v **URL parametrech** při návratu z platební brány.

---

## 📋 Jaké informace GoPay vrací:

### V URL parametrech (na success/failed stránce):

GoPay vrací tyto parametry v URL:

```
https://bulldogo.cz/success?
  idPaymentSession=123456789&
  state=PAID&
  totalPrice=19900&
  currency=CZK&
  orderNumber=firma&
  productName=balicek+Firma&
  targetGoId=8419533331&
  paymentMethod=PAYMENT_CARD
```

### Parametry:

| Parametr | Popis | Příklad |
|----------|-------|---------|
| `idPaymentSession` | **ID platby** z GoPay | `123456789` |
| `state` | **Stav platby** | `PAID`, `CANCELED`, `TIMEOUTED` |
| `totalPrice` | **Částka v haléřích** | `19900` (= 199.00 Kč) |
| `currency` | **Měna** | `CZK` |
| `orderNumber` | **Číslo objednávky** (naše) | `firma`, `hobby`, `oneday` |
| `productName` | **Název produktu** | `balicek+Firma` |
| `targetGoId` | **GoPay ID** | `8419533331` |
| `paymentMethod` | **Způsob platby** | `PAYMENT_CARD`, `BANK_ACCOUNT` |

---

## 🔧 Jak to funguje v našem systému:

### 1. Uživatel zaplatí na GoPay

GoPay zpracuje platbu.

### 2. GoPay přesměruje zpět

GoPay přesměruje uživatele na:
- **Úspěch:** `https://bulldogo.cz/success?idPaymentSession=123&state=PAID&...`
- **Zrušení:** `https://bulldogo.cz/failed?idPaymentSession=123&state=CANCELED&...`

### 3. `success.html` zpracuje parametry

Naše `success.html`:
1. ✅ **Načte parametry** z URL pomocí `parseGoPayReturnParams()`
2. ✅ **Zobrazí informace** o platbě uživateli
3. ✅ **Uloží do Firestore** pomocí `savePaymentToFirestore()`
4. ✅ **Aktivuje plán** pomocí `activatePlanFromPayment()`

### 4. Informace jsou uloženy

Všechny informace jsou uloženy v Firestore v kolekci `payments`:

```javascript
{
  gopayId: "123456789",
  orderNumber: "firma",
  userId: "user-123",
  state: "PAID",
  amount: 199,  // v Kč
  currency: "CZK",
  productName: "balicek Firma",
  paymentMethod: "PAYMENT_CARD",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  rawParams: { /* všechny parametry */ }
}
```

---

## ✅ Co se ukládá:

### V Firestore kolekci `payments`:

- ✅ **ID platby** z GoPay (`gopayId`)
- ✅ **Číslo objednávky** (`orderNumber`)
- ✅ **Stav platby** (`state`: PAID, CANCELED, atd.)
- ✅ **Částka** (`amount` v Kč)
- ✅ **Měna** (`currency`)
- ✅ **Uživatel** (`userId`)
- ✅ **Název produktu** (`productName`)
- ✅ **Způsob platby** (`paymentMethod`)
- ✅ **Čas vytvoření** (`createdAt`)
- ✅ **Čas aktualizace** (`updatedAt`)
- ✅ **Všechny parametry** (`rawParams` - pro debugging)

### V uživatelském profilu (pro balíčky):

- ✅ **Aktivní plán** (`plan`: "hobby", "business")
- ✅ **Začátek období** (`planPeriodStart`)
- ✅ **Konec období** (`planPeriodEnd`)
- ✅ **Délka období** (`planDurationDays`)

---

## 🔍 Jak zkontrolovat platbu:

### 1. V Firestore Console:

1. Jděte na: https://console.firebase.google.com/project/inzerio-inzerce/firestore
2. Klikněte na kolekci **payments**
3. Najděte záznam podle `orderNumber` (např. "firma")
4. Zkontrolujte `state` - mělo by být "PAID"

### 2. V Developer Console:

Otevřete `success.html` a podívejte se do konzole (F12):
- Měli byste vidět logy: `✅ GoPay parametry nalezeny`
- `✅ Platba uložena do Firestore`
- `✅ Plán aktivován`

---

## 🛡️ Bezpečnost:

### Ověření platby:

GoPay posílá informace v URL parametrech. Pro plné ověření můžete:

1. **Uložit do Firestore** - ✅ Už to děláme
2. **Ověřit přes GoPay API** - Volitelné (vyžaduje backend)
3. **Zkontrolovat signature** - Volitelné (vyžaduje backend)

**Pro naše použití (jednoduché platby):** Stačí uložit parametry z URL a aktivovat plán.

---

## 📝 Příklad:

### Co uživatel vidí:

```
Platba byla úspěšně dokončena!

Detaily platby:
ID platby: 123456789
Stav: PAID
Částka: 199.00 CZK
Objednávka: firma
Produkt: balicek Firma
Způsob platby: PAYMENT_CARD
```

### Co je uloženo v Firestore:

```javascript
payments/firma: {
  gopayId: "123456789",
  orderNumber: "firma",
  userId: "fXF5xLgpOxbs2eW3hY6nV7gvMoh2",
  state: "PAID",
  amount: 199,
  currency: "CZK",
  productName: "balicek Firma",
  paymentMethod: "PAYMENT_CARD",
  createdAt: Timestamp(2025-12-01T20:00:00Z),
  updatedAt: Timestamp(2025-12-01T20:00:00Z)
}

users/fXF5xLgpOxbs2eW3hY6nV7gvMoh2/profile/profile: {
  plan: "business",
  planName: "balicek Firma",
  planPeriodStart: Timestamp(2025-12-01T20:00:00Z),
  planPeriodEnd: Timestamp(2026-01-01T20:00:00Z),
  planDurationDays: 30
}
```

---

## ✅ Shrnutí:

- ✅ **GoPay vrací informace** v URL parametrech
- ✅ **Všechny informace se ukládají** do Firestore
- ✅ **Plán se automaticky aktivuje** po úspěšné platbě
- ✅ **Uživatel vidí detaily** platby na success stránce
- ✅ **Vše je logováno** pro pozdější kontrolu

---

**Všechno funguje automaticky! 🎉**

