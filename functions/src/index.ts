import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import cors from "cors";

// Inicializace Firebase Admin (pouze pokud ještě není inicializováno)
if (!admin.apps.length) {
  admin.initializeApp();
}

// CORS middleware
const corsHandler = cors({ origin: true });

// GoPay konfigurace z environment variables
const getGoPayConfig = () => {
  const config = functions.config().gopay || {};
  const isTest = process.env.NODE_ENV !== "production" || config.use_test === "true";
  
  return {
    clientId: isTest ? (config.test_client_id || "") : (config.client_id || ""),
    clientSecret: isTest ? (config.test_client_secret || "") : (config.client_secret || ""),
    apiUrl: isTest ? (config.test_api_url || "https://gw.sandbox.gopay.com/api") : (config.api_url || "https://gate.gopay.cz/api"),
    isTest,
  };
};

// Pomocná funkce pro získání OAuth2 tokenu
async function getGoPayAccessToken(scope = "payment-create"): Promise<string> {
  const gopayConfig = getGoPayConfig();
  
  if (!gopayConfig.clientId || !gopayConfig.clientSecret) {
    console.error("GoPay config:", {
      clientId: gopayConfig.clientId ? "***" : "MISSING",
      clientSecret: gopayConfig.clientSecret ? "***" : "MISSING",
      apiUrl: gopayConfig.apiUrl,
      isTest: gopayConfig.isTest,
    });
    throw new Error("GoPay credentials not configured. Please set gopay.test_client_id and gopay.test_client_secret");
  }

  try {
    // GoPay očekává credentials v Basic Auth hlavičce
    // Formát: Base64(ClientID:ClientSecret)
    const credentials = Buffer.from(`${gopayConfig.clientId}:${gopayConfig.clientSecret}`).toString('base64');
    
    const response = await axios.post(
      `${gopayConfig.apiUrl}/oauth2/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        scope: scope,
      }),
      {
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
      }
    );

    if (!response.data || !response.data.access_token) {
      throw new Error("GoPay API did not return access token");
    }

    return response.data.access_token;
  } catch (error: any) {
    console.error("GoPay OAuth2 error:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: `${gopayConfig.apiUrl}/oauth2/token`,
    });
    throw new Error(`Failed to get GoPay access token: ${error.response?.data?.errors?.[0]?.message || error.response?.data?.message || error.message}`);
  }
}

// Rozhraní pro opakovanou platbu
interface Recurrence {
  recurrence_cycle: "DAY" | "WEEK" | "MONTH";
  recurrence_period: number;
  recurrence_date_to: string; // YYYY-MM-DD
}

// Rozhraní pro platební data
interface PaymentData {
  amount: number;
  currency: string;
  order_number: string;
  order_description: string;
  items: Array<{
    name: string;
    amount: number;
    count: number;
  }>;
  payer: {
    allowed_payment_instruments?: string[];
    default_payment_instrument?: string;
    contact?: {
      email?: string;
      phone_number?: string;
      first_name?: string;
      last_name?: string;
    };
  };
  target: {
    type: string;
    goid: number;
  };
  return_url: string;
  notification_url: string;
  lang?: string;
  recurrence?: Recurrence;
}

// Rozhraní pro odpověď z createPayment
interface GoPayPaymentResponse {
  id: number;
  order_number: string;
  state: string;
  amount: number;
  currency: string;
  payer?: {
    payment_card?: {
      card_number?: string;
    };
  };
  gw_url?: string;
  result?: string;
  recurrence?: {
    recurrence_cycle: string;
    recurrence_period: number;
    recurrence_date_to: string;
    recurrence_state?: string;
  };
}

/**
 * Vytvoří platbu v GoPay
 * 
 * POST /createPayment
 * Body: {
 *   amount: number,
 *   currency: string (default: "CZK"),
 *   orderNumber: string,
 *   orderDescription: string,
 *   userId: string,
 *   planId: string,
 *   planName: string,
 *   items: Array<{name: string, amount: number, count: number}>,
 *   payerEmail?: string,
 *   payerPhone?: string,
 *   payerFirstName?: string,
 *   payerLastName?: string,
 *   returnUrl?: string (default: automaticky)
 * }
 */
export const createPayment = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Povolit pouze POST
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
      }

      const {
        amount,
        currency = "CZK",
        orderNumber,
        orderDescription,
        userId,
        planId,
        planName,
        items = [],
        payerEmail,
        payerPhone,
        payerFirstName,
        payerLastName,
        returnUrl,
        isRecurring = false, // Nový parametr pro opakované platby
        recurrenceDateTo, // Datum do kdy se má opakovat (YYYY-MM-DD)
      } = req.body;

      // Validace povinných polí
      if (!amount || !orderNumber || !orderDescription || !userId || !planId || !planName) {
        res.status(400).json({
          error: "Missing required fields: amount, orderNumber, orderDescription, userId, planId, planName",
        });
        return;
      }

      // Validace částky
      if (amount <= 0) {
        res.status(400).json({ error: "Amount must be greater than 0" });
        return;
      }

      // Získání přístupového tokenu
      const accessToken = await getGoPayAccessToken("payment-create");

      // Příprava payment data
      const gopayConfig = getGoPayConfig();
      
      // Vytvoření return_url a notification_url
      const baseUrl = returnUrl || `https://${functions.config().project?.region || "europe-west1"}-${functions.config().project?.id || ""}.cloudfunctions.net`;
      const paymentReturnUrl = returnUrl || `${baseUrl}/paymentReturn`;
      const paymentNotificationUrl = `${baseUrl}/gopayNotification`;

      // Zpracování items - frontend posílá amount v Kč, převedeme na haléře
      let processedItems: Array<{name: string, amount: number, count: number}> = items;
      if (items.length > 0) {
        // Items z frontendu - amount je v Kč, převedeme na haléře
        processedItems = items.map((item: any) => ({
          name: item.name,
          amount: Math.round(item.amount * 100), // Převod z Kč na haléře
          count: item.count || 1,
        }));
      } else {
        // Vytvoříme nové items
        processedItems = [
          {
            name: planName,
            amount: Math.round(amount * 100),
            count: 1,
          },
        ];
      }

      const paymentData: PaymentData = {
        amount: Math.round(amount * 100), // GoPay používá haléře
        currency: currency,
        order_number: orderNumber,
        order_description: orderDescription,
        items: processedItems,
        payer: {
          allowed_payment_instruments: ["PAYMENT_CARD", "BANK_ACCOUNT"],
          default_payment_instrument: "PAYMENT_CARD",
          contact: {
            // Email je povinný pro GoPay
            email: payerEmail || "unknown@example.com",
            ...(payerPhone && { phone_number: payerPhone }),
            ...(payerFirstName && { first_name: payerFirstName }),
            ...(payerLastName && { last_name: payerLastName }),
          },
        },
        target: {
          type: "ACCOUNT",
          goid: parseInt(gopayConfig.clientId, 10),
        },
        return_url: paymentReturnUrl,
        notification_url: paymentNotificationUrl,
        lang: "cs",
      };

      // Přidat opakovanou platbu, pokud je požadována
      // POZNÁMKA: Opakované platby musí být aktivované v GoPay administraci
      // Pokud dostáváte chybu 409, zkuste dočasně vypnout opakované platby (isRecurring: false)
      if (isRecurring) {
        // Pro balíčky nastavíme měsíční opakování
        // Validace data - musí být větší než aktuální datum a menší než 2099-12-31
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDate = new Date("2099-12-31");
        maxDate.setHours(23, 59, 59, 999);
        
        let dateTo = recurrenceDateTo || "2099-12-31";
        const dateToObj = new Date(dateTo);
        
        // Validace, že datum je v budoucnosti
        if (dateToObj <= today) {
          console.warn(`recurrence_date_to ${dateTo} je v minulosti, použiji max datum`);
          dateTo = "2099-12-31";
        }
        
        // Validace, že datum není větší než max
        if (dateToObj > maxDate) {
          console.warn(`recurrence_date_to ${dateTo} je větší než max, použiji max datum`);
          dateTo = "2099-12-31";
        }
        
        // Validace formátu data (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateTo)) {
          console.error(`❌ Neplatný formát data: ${dateTo}, očekává se YYYY-MM-DD`);
          dateTo = "2099-12-31";
        }
        
        paymentData.recurrence = {
          recurrence_cycle: "MONTH",
          recurrence_period: 1, // Každý měsíc
          recurrence_date_to: dateTo,
        };
        
        console.log("Přidávám opakovanou platbu:", paymentData.recurrence);
      } else {
        console.log("Opakované platby jsou vypnuté (isRecurring: false)");
      }

      // Logování dat před odesláním (bez citlivých údajů)
      console.log("Odesílám platbu do GoPay:", {
        amount: paymentData.amount,
        currency: paymentData.currency,
        order_number: paymentData.order_number,
        order_description: paymentData.order_description,
        items: paymentData.items,
        hasRecurrence: !!paymentData.recurrence,
        recurrence: paymentData.recurrence,
        return_url: paymentData.return_url,
        notification_url: paymentData.notification_url,
        target: paymentData.target,
      });
      
      // Validace, že součet items odpovídá celkové částce
      const itemsSum = paymentData.items.reduce((sum, item) => sum + (item.amount * item.count), 0);
      if (Math.abs(itemsSum - paymentData.amount) > 1) {
        console.warn(`⚠️ Součet items (${itemsSum}) se nerovná celkové částce (${paymentData.amount})`);
      }

      // Vytvoření platby v GoPay
      const paymentResponse = await axios.post<GoPayPaymentResponse>(
        `${gopayConfig.apiUrl}/payments/payment`,
        paymentData,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );

      const goPayPayment = paymentResponse.data;

      // Logování odpovědi z GoPay (bez citlivých údajů)
      console.log("GoPay odpověď:", {
        id: goPayPayment.id,
        state: goPayPayment.state,
        hasGwUrl: !!goPayPayment.gw_url,
        gwUrlLength: goPayPayment.gw_url?.length || 0,
        order_number: goPayPayment.order_number,
      });

      // Validace, že GoPay vrátil gw_url
      if (!goPayPayment.gw_url) {
        console.error("GoPay nevrátil gw_url:", goPayPayment);
        res.status(500).json({
          error: "GoPay nevrátil platební URL",
          message: "GoPay API nevrátilo gw_url v odpovědi. Zkontrolujte logy.",
          details: {
            paymentId: goPayPayment.id,
            state: goPayPayment.state,
            response: goPayPayment,
          },
        });
        return;
      }

      // Uložení do Firestore pro sledování
      const paymentRecord = {
        gopayId: goPayPayment.id,
        orderNumber: orderNumber,
        userId: userId,
        planId: planId,
        planName: planName,
        amount: amount,
        currency: currency,
        state: goPayPayment.state || "CREATED",
        isRecurring: isRecurring,
        recurrencePaymentId: isRecurring ? goPayPayment.id : null, // ID zakládající opakované platby
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        gopayResponse: goPayPayment,
      };

      await admin.firestore().collection("payments").doc(orderNumber).set(paymentRecord);

      // Vrácení odpovědi s gw_url pro přesměrování
      res.status(200).json({
        success: true,
        paymentId: goPayPayment.id,
        orderNumber: orderNumber,
        gwUrl: goPayPayment.gw_url,
        state: goPayPayment.state,
      });
    } catch (error: any) {
      console.error("Create payment error:", error);
      
      // Pokud je to GoPay API chyba, vrať detailní informace
      if (error.response) {
        const status = error.response.status;
        const goPayError = error.response.data;
        
        console.error("GoPay API error:", {
          status,
          data: goPayError,
        });
        
        // Pro validační chyby (409) vrať detailní informace
        if (status === 409) {
          res.status(409).json({
            error: "GoPay validation error",
            message: goPayError?.errors?.[0]?.message || goPayError?.message || "Validační chyba",
            details: {
              errors: goPayError?.errors || goPayError?.error || goPayError,
              message: goPayError?.message,
            },
          });
          return;
        }
        
        // Pro ostatní chyby
        res.status(status || 500).json({
          error: "Failed to create payment",
          message: goPayError?.errors?.[0]?.message || goPayError?.message || error.message,
          details: goPayError,
        });
        return;
      }
      
      // Obecná chyba
      res.status(500).json({
        error: "Failed to create payment",
        message: error.message,
        details: undefined,
      });
    }
  });
});

/**
 * Ověří stav platby v GoPay
 * 
 * GET /checkPayment?paymentId=123456&orderNumber=ORDER-123
 */
export const checkPayment = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const paymentId = req.query.paymentId as string;
      const orderNumber = req.query.orderNumber as string;

      if (!paymentId && !orderNumber) {
        res.status(400).json({ error: "Missing paymentId or orderNumber" });
        return;
      }

      // Získání přístupového tokenu
      const accessToken = await getGoPayAccessToken("payment-all");

      const gopayConfig = getGoPayConfig();

      // Získání informací o platbě z GoPay
      const paymentResponse = await axios.get<GoPayPaymentResponse>(
        `${gopayConfig.apiUrl}/payments/payment/${paymentId || orderNumber}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      const goPayPayment = paymentResponse.data;

      // Aktualizace záznamu v Firestore
      if (orderNumber) {
        const paymentRef = admin.firestore().collection("payments").doc(orderNumber);
        await paymentRef.update({
          state: goPayPayment.state,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastChecked: admin.firestore.FieldValue.serverTimestamp(),
          gopayResponse: goPayPayment,
        });

        // Pokud je platba zaplacená, aktualizuj uživatelský plán
        if (goPayPayment.state === "PAID") {
          await activateUserPlan(orderNumber);
        }
      }

      res.status(200).json({
        success: true,
        payment: {
          id: goPayPayment.id,
          orderNumber: goPayPayment.order_number,
          state: goPayPayment.state,
          amount: goPayPayment.amount ? goPayPayment.amount / 100 : 0,
          currency: goPayPayment.currency,
        },
      });
    } catch (error: any) {
      console.error("Check payment error:", error);
      res.status(500).json({
        error: "Failed to check payment",
        message: error.message,
        details: error.response?.data || undefined,
      });
    }
  });
});

/**
 * Endpoint pro notifikace od GoPay
 * 
 * POST /gopayNotification
 * GoPay posílá notifikace automaticky na tento endpoint
 */
export const gopayNotification = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // GoPay posílá notifikaci jako JSON v body
      const notification = req.body;

      console.log("GoPay notification received:", JSON.stringify(notification, null, 2));

      if (!notification.id) {
        res.status(400).json({ error: "Missing payment id in notification" });
        return;
      }

      const paymentId = notification.id;

      // Ověření stavu platby v GoPay API
      const accessToken = await getGoPayAccessToken("payment-all");
      const gopayConfig = getGoPayConfig();

      const paymentResponse = await axios.get<GoPayPaymentResponse>(
        `${gopayConfig.apiUrl}/payments/payment/${paymentId}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      const goPayPayment = paymentResponse.data;

      // Nalezení záznamu platby v Firestore podle GoPay ID
      const paymentsSnapshot = await admin.firestore()
        .collection("payments")
        .where("gopayId", "==", paymentId)
        .limit(1)
        .get();

      if (!paymentsSnapshot.empty) {
        const paymentDoc = paymentsSnapshot.docs[0];
        const orderNumber = paymentDoc.id;

        // Aktualizace stavu platby
        await paymentDoc.ref.update({
          state: goPayPayment.state,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          notificationReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
          gopayResponse: goPayPayment,
        });

        // Pokud je platba zaplacená, aktivuj uživatelský plán
        if (goPayPayment.state === "PAID") {
          await activateUserPlan(orderNumber);
        }
      }

      // GoPay očekává odpověď "OK"
      res.status(200).send("OK");
    } catch (error: any) {
      console.error("GoPay notification error:", error);
      // I při chybě vrátíme OK, abychom GoPay nezaměstnávali opakovanými notifikacemi
      res.status(200).send("OK");
    }
  });
});

/**
 * Pomocná funkce pro aktivaci uživatelského plánu po zaplacení
 */
async function activateUserPlan(orderNumber: string): Promise<void> {
  try {
    const paymentDoc = await admin.firestore().collection("payments").doc(orderNumber).get();

    if (!paymentDoc.exists) {
      console.error(`Payment document ${orderNumber} not found`);
      return;
    }

    const paymentData = paymentDoc.data();
    if (!paymentData) {
      console.error(`Payment data for ${orderNumber} is empty`);
      return;
    }

    const { userId, planId, planName, state } = paymentData;

    // Zkontroluj, že platba je skutečně zaplacená
    if (state !== "PAID") {
      console.log(`Payment ${orderNumber} is not paid yet (state: ${state})`);
      return;
    }

    // Zkontroluj, zda už není plán aktivován (ochrana před duplicitní aktivací)
    if (paymentData.planActivated) {
      console.log(`Plan for payment ${orderNumber} already activated`);
      return;
    }

    if (!userId || !planId) {
      console.error(`Missing userId or planId for payment ${orderNumber}`);
      return;
    }

    // Aktivace plánu v profilu uživatele
    const userProfileRef = admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("profile")
      .doc("profile");

    const now = admin.firestore.Timestamp.now();
    const durationDays = 30; // měsíční předplatné
    const periodEnd = new Date(now.toDate());
    periodEnd.setDate(periodEnd.getDate() + durationDays);

    // Získat informace o opakované platbě z payment záznamu
    const isRecurring = paymentData.isRecurring || false;
    const recurrencePaymentId = paymentData.recurrencePaymentId || null;

    await userProfileRef.set({
      plan: planId,
      planName: planName,
      planUpdatedAt: now,
      planPeriodStart: now,
      planPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
      planDurationDays: durationDays,
      planCancelAt: null,
      isRecurring: isRecurring,
      recurrencePaymentId: recurrencePaymentId, // ID zakládající opakované platby pro zrušení
    }, { merge: true });

    // Označení, že plán byl aktivován
    await paymentDoc.ref.update({
      planActivated: true,
      planActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Plan ${planId} activated for user ${userId}`);
  } catch (error: any) {
    console.error(`Error activating plan for payment ${orderNumber}:`, error);
    throw error;
  }
}

/**
 * Zruší opakovanou platbu v GoPay
 * 
 * POST /voidRecurrence
 * Body: {
 *   paymentId: number (GoPay payment ID zakládající opakované platby)
 *   userId: string (pro ověření, že uživatel má oprávnění)
 * }
 */
export const voidRecurrence = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Povolit pouze POST
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
      }

      const { paymentId, userId } = req.body;

      if (!paymentId || !userId) {
        res.status(400).json({
          error: "Missing required fields: paymentId, userId",
        });
        return;
      }

      // Ověření, že uživatel má oprávnění zrušit tuto opakovanou platbu
      const userProfileRef = admin.firestore()
        .collection("users")
        .doc(userId)
        .collection("profile")
        .doc("profile");

      const userProfile = await userProfileRef.get();
      if (!userProfile.exists) {
        res.status(404).json({ error: "User profile not found" });
        return;
      }

      const userData = userProfile.data();
      if (userData?.recurrencePaymentId !== paymentId) {
        res.status(403).json({ error: "User does not have permission to cancel this recurring payment" });
        return;
      }

      // Získání přístupového tokenu
      const accessToken = await getGoPayAccessToken("payment-all");
      const gopayConfig = getGoPayConfig();

      // Zrušení opakované platby v GoPay
      const voidResponse = await axios.post(
        `${gopayConfig.apiUrl}/payments/payment/${paymentId}/void-recurrence`,
        null,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json",
          },
        }
      );

      // Aktualizace uživatelského profilu
      await userProfileRef.update({
        isRecurring: false,
        recurrencePaymentId: null,
        planCancelAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Aktualizace payment záznamu
      const paymentsSnapshot = await admin.firestore()
        .collection("payments")
        .where("gopayId", "==", paymentId)
        .limit(1)
        .get();

      if (!paymentsSnapshot.empty) {
        await paymentsSnapshot.docs[0].ref.update({
          recurrenceCancelled: true,
          recurrenceCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      res.status(200).json({
        success: true,
        message: "Recurring payment cancelled successfully",
        result: voidResponse.data,
      });
    } catch (error: any) {
      console.error("Void recurrence error:", error);
      res.status(500).json({
        error: "Failed to cancel recurring payment",
        message: error.message,
        details: error.response?.data || undefined,
      });
    }
  });
});

/**
 * Pomocný endpoint pro payment return (redirect z GoPay)
 * 
 * GET /paymentReturn?paymentId=123456&orderNumber=ORDER-123
 * 
 * Tento endpoint je volán po návratu uživatele z GoPay platební brány
 * Měl by přesměrovat uživatele na frontend s parametry
 */
export const paymentReturn = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const paymentId = req.query.idPaymentSession as string;
      const state = req.query.state as string;

      // Pokud je paymentId, ověř stav platby
      if (paymentId) {
        const accessToken = await getGoPayAccessToken("payment-all");
        const gopayConfig = getGoPayConfig();

        try {
          const paymentResponse = await axios.get<GoPayPaymentResponse>(
            `${gopayConfig.apiUrl}/payments/payment/${paymentId}`,
            {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            }
          );

          const goPayPayment = paymentResponse.data;

          // Najdi payment záznam podle GoPay ID
          const paymentsSnapshot = await admin.firestore()
            .collection("payments")
            .where("gopayId", "==", parseInt(paymentId, 10))
            .limit(1)
            .get();

          if (!paymentsSnapshot.empty) {
            const paymentDoc = paymentsSnapshot.docs[0];
            const orderNumber = paymentDoc.id;

            // Aktualizace stavu
            await paymentDoc.ref.update({
              state: goPayPayment.state,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              gopayResponse: goPayPayment,
            });

            // Pokud je platba zaplacená, aktivuj plán
            if (goPayPayment.state === "PAID") {
              await activateUserPlan(orderNumber);
            }

            // Přesměrování na správné URL podle stavu platby
            // Pro Hobby balíček použijeme specifické URL (orderNumber začíná "hobby-")
            if (orderNumber && orderNumber.startsWith("hobby-")) {
              if (goPayPayment.state === "PAID") {
                res.redirect(`https://vercel.bulldogo8.app/success?orderNumber=${orderNumber}&paymentId=${paymentId}`);
              } else {
                res.redirect(`https://vercel.bulldogo8.app/failed?orderNumber=${orderNumber}&paymentId=${paymentId}&state=${goPayPayment.state}`);
              }
            } else {
              // Pro ostatní balíčky použijeme standardní přesměrování
              const frontendUrl = functions.config().frontend?.url || "https://bulldogo.cz";
              const returnPath = `/packages.html?payment=${goPayPayment.state}&orderNumber=${orderNumber}&paymentId=${paymentId}`;
              res.redirect(`${frontendUrl}${returnPath}`);
            }
            return;
          }
        } catch (error: any) {
          console.error("Error checking payment status:", error);
        }
      }

      // Fallback přesměrování - pokud není paymentId, použijeme state z URL parametrů
      // Pro Hobby balíček použijeme specifické URL (orderNumber začíná "hobby-")
      const orderNumber = req.query.orderNumber as string;
      if (orderNumber && orderNumber.startsWith("hobby-")) {
        if (state === "PAID") {
          res.redirect(`https://vercel.bulldogo8.app/success?orderNumber=${orderNumber}&state=${state}`);
        } else {
          res.redirect(`https://vercel.bulldogo8.app/failed?orderNumber=${orderNumber}&state=${state || "unknown"}`);
        }
      } else {
        const frontendUrl = functions.config().frontend?.url || "https://bulldogo.cz";
        res.redirect(`${frontendUrl}/packages.html?payment=${state || "unknown"}`);
      }
    } catch (error: any) {
      console.error("Payment return error:", error);
      // Při chybě přesměrujeme na failed URL
      const orderNumber = req.query.orderNumber as string;
      if (orderNumber && orderNumber.startsWith("hobby-")) {
        res.redirect(`https://vercel.bulldogo8.app/failed?orderNumber=${orderNumber}&error=true`);
      } else {
        const frontendUrl = functions.config().frontend?.url || "https://bulldogo.cz";
        res.redirect(`${frontendUrl}/packages.html?payment=error`);
      }
    }
  });
});

