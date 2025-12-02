# Vercel Routing - Oprava 404 chyby

## Problém

Když GoPay přesměruje na `https://bulldogo8.vercel.app/failed`, Vercel vrací 404 chybu.

## Řešení

Vytvořil jsem `vercel.json` soubor, který správně nasměruje požadavky na HTML soubory.

### Co bylo opraveno:

1. **Vytvořen `vercel.json`** - routing konfigurace pro Vercel
2. **Upraven `gopay-payment-handler.js`** - podporuje `paymentSessionId` (zrušená platba)

### `vercel.json` obsahuje:

```json
{
  "rewrites": [
    {
      "source": "/success",
      "destination": "/success.html"
    },
    {
      "source": "/failed",
      "destination": "/failed.html"
    }
  ]
}
```

## Co musíte udělat:

1. **Commitnout a pushnout `vercel.json`** do Git repozitáře
2. **Vercel automaticky nasadí** novou konfiguraci
3. **Zkontrolovat**, že `failed.html` a `success.html` jsou v projektu

## Po nasazení:

GoPay přesměrování by mělo fungovat:
- ✅ `https://bulldogo8.vercel.app/success` → `success.html`
- ✅ `https://bulldogo8.vercel.app/failed` → `failed.html`

## Testování:

1. Zrušte platbu na GoPay
2. Mělo by vás přesměrovat na `https://bulldogo8.vercel.app/failed?paymentSessionId=...`
3. Měla by se zobrazit stránka "Platba byla zrušena"

---

**Důležité:** Po přidání `vercel.json` musíte commitnout a pushnout změny, aby Vercel nasadil novou konfiguraci!

