import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import cors from "cors";

// Inicializace Firebase Admin
admin.initializeApp();

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
    throw new Error("GoPay credentials not configured. Please set gopay.client_id and gopay.client_secret");
  }

  try {
    const response = await axios.post(
      `${gopayConfig.apiUrl}/oauth2/token`,
      null,
      {
        auth: {
          username: gopayConfig.clientId,
          password: gopayConfig.clientSecret,
        },
        params: {
          grant_type: "client_credentials",
          scope: scope,
        },
      }
    );

    return response.data.access_token;
  } catch (error: any) {
    console.error("GoPay OAuth2 error:", error.response?.data || error.message);
    throw new Error(`Failed to get GoPay access token: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
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

      const paymentData: PaymentData = {
        amount: Math.round(amount * 100), // GoPay používá haléře
        currency: currency,
        order_number: orderNumber,
        order_description: orderDescription,
        items: items.length > 0 ? items : [
          {
            name: planName,
            amount: Math.round(amount * 100),
            count: 1,
          },
        ],
        payer: {
          allowed_payment_instruments: ["PAYMENT_CARD", "BANK_ACCOUNT"],
          default_payment_instrument: "PAYMENT_CARD",
          contact: {
            ...(payerEmail && { email: payerEmail }),
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

      // Vytvoření platby v GoPay
      const paymentResponse = await axios.post<GoPayPaymentResponse>(
        `${gopayConfig.apiUrl}/payments/payment`,
        paymentData,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const goPayPayment = paymentResponse.data;

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
      res.status(500).json({
        error: "Failed to create payment",
        message: error.message,
        details: error.response?.data || undefined,
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

    await userProfileRef.set({
      plan: planId,
      planName: planName,
      planUpdatedAt: now,
      planPeriodStart: now,
      planPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
      planDurationDays: durationDays,
      planCancelAt: null,
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

            // Přesměrování na frontend s parametry
            const frontendUrl = functions.config().frontend?.url || "https://bulldogo.cz";
            const returnPath = `/packages.html?payment=${goPayPayment.state}&orderNumber=${orderNumber}&paymentId=${paymentId}`;
            
            res.redirect(`${frontendUrl}${returnPath}`);
            return;
          }
        } catch (error: any) {
          console.error("Error checking payment status:", error);
        }
      }

      // Fallback přesměrování
      const frontendUrl = functions.config().frontend?.url || "https://bulldogo.cz";
      res.redirect(`${frontendUrl}/packages.html?payment=${state || "unknown"}`);
    } catch (error: any) {
      console.error("Payment return error:", error);
      const frontendUrl = functions.config().frontend?.url || "https://bulldogo.cz";
      res.redirect(`${frontendUrl}/packages.html?payment=error`);
    }
  });
});

