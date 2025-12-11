"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentReturn = exports.voidRecurrence = exports.gopayNotification = exports.checkPayment = exports.createPayment = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
// Inicializace Firebase Admin
admin.initializeApp();
// CORS middleware
const corsHandler = (0, cors_1.default)({ origin: true });
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
async function getGoPayAccessToken(scope = "payment-create") {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
        const response = await axios_1.default.post(`${gopayConfig.apiUrl}/oauth2/token`, new URLSearchParams({
            grant_type: "client_credentials",
            scope: scope,
        }), {
            headers: {
                "Authorization": `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        });
        if (!response.data || !response.data.access_token) {
            throw new Error("GoPay API did not return access token");
        }
        return response.data.access_token;
    }
    catch (error) {
        console.error("GoPay OAuth2 error:", {
            status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
            statusText: (_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText,
            data: (_c = error.response) === null || _c === void 0 ? void 0 : _c.data,
            message: error.message,
            url: `${gopayConfig.apiUrl}/oauth2/token`,
        });
        throw new Error(`Failed to get GoPay access token: ${((_g = (_f = (_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.errors) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.message) || ((_j = (_h = error.response) === null || _h === void 0 ? void 0 : _h.data) === null || _j === void 0 ? void 0 : _j.message) || error.message}`);
    }
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
exports.createPayment = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            // Povolit pouze POST
            if (req.method !== "POST") {
                res.status(405).json({ error: "Method not allowed. Use POST." });
                return;
            }
            const { amount, currency = "CZK", orderNumber, orderDescription, userId, planId, planName, items = [], payerEmail, payerPhone, payerFirstName, payerLastName, returnUrl, isRecurring = false, // Nový parametr pro opakované platby
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
            const baseUrl = returnUrl || `https://${((_a = functions.config().project) === null || _a === void 0 ? void 0 : _a.region) || "europe-west1"}-${((_b = functions.config().project) === null || _b === void 0 ? void 0 : _b.id) || ""}.cloudfunctions.net`;
            const paymentReturnUrl = returnUrl || `${baseUrl}/paymentReturn`;
            const paymentNotificationUrl = `${baseUrl}/gopayNotification`;
            const paymentData = {
                amount: Math.round(amount * 100),
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
                    contact: Object.assign(Object.assign(Object.assign(Object.assign({}, (payerEmail && { email: payerEmail })), (payerPhone && { phone_number: payerPhone })), (payerFirstName && { first_name: payerFirstName })), (payerLastName && { last_name: payerLastName })),
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
                paymentData.recurrence = {
                    recurrence_cycle: "MONTH",
                    recurrence_period: 1,
                    recurrence_date_to: dateTo,
                };
                console.log("Přidávám opakovanou platbu:", paymentData.recurrence);
            }
            else {
                console.log("Opakované platby jsou vypnuté (isRecurring: false)");
            }
            // Logování dat před odesláním (bez citlivých údajů)
            console.log("Odesílám platbu do GoPay:", {
                amount: paymentData.amount,
                currency: paymentData.currency,
                order_number: paymentData.order_number,
                hasRecurrence: !!paymentData.recurrence,
                recurrence: paymentData.recurrence,
            });
            // Vytvoření platby v GoPay
            const paymentResponse = await axios_1.default.post(`${gopayConfig.apiUrl}/payments/payment`, paymentData, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            });
            const goPayPayment = paymentResponse.data;
            // Logování odpovědi z GoPay (bez citlivých údajů)
            console.log("GoPay odpověď:", {
                id: goPayPayment.id,
                state: goPayPayment.state,
                hasGwUrl: !!goPayPayment.gw_url,
                gwUrlLength: ((_c = goPayPayment.gw_url) === null || _c === void 0 ? void 0 : _c.length) || 0,
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
                recurrencePaymentId: isRecurring ? goPayPayment.id : null,
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
        }
        catch (error) {
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
                        message: ((_e = (_d = goPayError === null || goPayError === void 0 ? void 0 : goPayError.errors) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) || (goPayError === null || goPayError === void 0 ? void 0 : goPayError.message) || "Validační chyba",
                        details: {
                            errors: (goPayError === null || goPayError === void 0 ? void 0 : goPayError.errors) || (goPayError === null || goPayError === void 0 ? void 0 : goPayError.error) || goPayError,
                            message: goPayError === null || goPayError === void 0 ? void 0 : goPayError.message,
                        },
                    });
                    return;
                }
                // Pro ostatní chyby
                res.status(status || 500).json({
                    error: "Failed to create payment",
                    message: ((_g = (_f = goPayError === null || goPayError === void 0 ? void 0 : goPayError.errors) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.message) || (goPayError === null || goPayError === void 0 ? void 0 : goPayError.message) || error.message,
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
exports.checkPayment = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
        try {
            const paymentId = req.query.paymentId;
            const orderNumber = req.query.orderNumber;
            if (!paymentId && !orderNumber) {
                res.status(400).json({ error: "Missing paymentId or orderNumber" });
                return;
            }
            // Získání přístupového tokenu
            const accessToken = await getGoPayAccessToken("payment-all");
            const gopayConfig = getGoPayConfig();
            // Získání informací o platbě z GoPay
            const paymentResponse = await axios_1.default.get(`${gopayConfig.apiUrl}/payments/payment/${paymentId || orderNumber}`, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            });
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
        }
        catch (error) {
            console.error("Check payment error:", error);
            res.status(500).json({
                error: "Failed to check payment",
                message: error.message,
                details: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || undefined,
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
exports.gopayNotification = functions.https.onRequest(async (req, res) => {
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
            const paymentResponse = await axios_1.default.get(`${gopayConfig.apiUrl}/payments/payment/${paymentId}`, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            });
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
        }
        catch (error) {
            console.error("GoPay notification error:", error);
            // I při chybě vrátíme OK, abychom GoPay nezaměstnávali opakovanými notifikacemi
            res.status(200).send("OK");
        }
    });
});
/**
 * Pomocná funkce pro aktivaci uživatelského plánu po zaplacení
 */
async function activateUserPlan(orderNumber) {
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
    }
    catch (error) {
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
exports.voidRecurrence = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
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
            if ((userData === null || userData === void 0 ? void 0 : userData.recurrencePaymentId) !== paymentId) {
                res.status(403).json({ error: "User does not have permission to cancel this recurring payment" });
                return;
            }
            // Získání přístupového tokenu
            const accessToken = await getGoPayAccessToken("payment-all");
            const gopayConfig = getGoPayConfig();
            // Zrušení opakované platby v GoPay
            const voidResponse = await axios_1.default.post(`${gopayConfig.apiUrl}/payments/payment/${paymentId}/void-recurrence`, null, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                },
            });
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
        }
        catch (error) {
            console.error("Void recurrence error:", error);
            res.status(500).json({
                error: "Failed to cancel recurring payment",
                message: error.message,
                details: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || undefined,
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
exports.paymentReturn = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a, _b, _c;
        try {
            const paymentId = req.query.idPaymentSession;
            const state = req.query.state;
            // Pokud je paymentId, ověř stav platby
            if (paymentId) {
                const accessToken = await getGoPayAccessToken("payment-all");
                const gopayConfig = getGoPayConfig();
                try {
                    const paymentResponse = await axios_1.default.get(`${gopayConfig.apiUrl}/payments/payment/${paymentId}`, {
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                        },
                    });
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
                        const frontendUrl = ((_a = functions.config().frontend) === null || _a === void 0 ? void 0 : _a.url) || "https://bulldogo.cz";
                        const returnPath = `/packages.html?payment=${goPayPayment.state}&orderNumber=${orderNumber}&paymentId=${paymentId}`;
                        res.redirect(`${frontendUrl}${returnPath}`);
                        return;
                    }
                }
                catch (error) {
                    console.error("Error checking payment status:", error);
                }
            }
            // Fallback přesměrování
            const frontendUrl = ((_b = functions.config().frontend) === null || _b === void 0 ? void 0 : _b.url) || "https://bulldogo.cz";
            res.redirect(`${frontendUrl}/packages.html?payment=${state || "unknown"}`);
        }
        catch (error) {
            console.error("Payment return error:", error);
            const frontendUrl = ((_c = functions.config().frontend) === null || _c === void 0 ? void 0 : _c.url) || "https://bulldogo.cz";
            res.redirect(`${frontendUrl}/packages.html?payment=error`);
        }
    });
});
//# sourceMappingURL=index.js.map