/**
 * GoPay Payment Handler
 * Zpracovává informace o platbě z GoPay URL parametrů
 */

/**
 * Zpracuje URL parametry z GoPay návratu
 * @returns {Object|null} - Informace o platbě nebo null
 */
function parseGoPayReturnParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // GoPay vrací tyto parametry v URL
    const params = {
        idPaymentSession: urlParams.get('idPaymentSession'),
        state: urlParams.get('state'),
        totalPrice: urlParams.get('totalPrice'),
        currency: urlParams.get('currency'),
        orderNumber: urlParams.get('orderNumber'),
        productName: urlParams.get('productName'),
        targetGoId: urlParams.get('targetGoId'),
        // Další možné parametry
        paymentMethod: urlParams.get('paymentMethod'),
        payer: urlParams.get('payer'),
    };
    
    // Pokud jsou nějaké parametry, vrať je
    if (params.idPaymentSession || params.orderNumber || params.state) {
        return params;
    }
    
    return null;
}

/**
 * Uloží informace o platbě do Firestore
 * @param {Object} paymentInfo - Informace o platbě
 * @returns {Promise<void>}
 */
async function savePaymentToFirestore(paymentInfo) {
    try {
        // Počkat na Firebase
        await new Promise((resolve) => {
            if (window.firebaseAuth && window.firebaseDb) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.firebaseAuth && window.firebaseDb) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
        
        const user = window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) {
            console.log('⚠️ Uživatel není přihlášen nebo Firebase není dostupný');
            return;
        }
        
        const { setDoc, doc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const now = Timestamp.now();
        
        // Uložit záznam o platbě
        const orderNumber = paymentInfo.orderNumber || `ORDER-${Date.now()}`;
        await setDoc(
            doc(window.firebaseDb, 'payments', orderNumber),
            {
                gopayId: paymentInfo.idPaymentSession || null,
                orderNumber: orderNumber,
                userId: user.uid,
                state: paymentInfo.state || 'UNKNOWN',
                amount: paymentInfo.totalPrice ? parseInt(paymentInfo.totalPrice) / 100 : 0, // převod z haléřů
                currency: paymentInfo.currency || 'CZK',
                productName: paymentInfo.productName || '',
                paymentMethod: paymentInfo.paymentMethod || null,
                payer: paymentInfo.payer || null,
                createdAt: now,
                updatedAt: now,
                returnUrl: window.location.href,
                rawParams: paymentInfo, // Uložit všechny parametry pro debugging
            },
            { merge: true }
        );
        
        console.log('✅ Platba uložena do Firestore:', orderNumber);
        
        return orderNumber;
    } catch (error) {
        console.error('❌ Chyba při ukládání platby do Firestore:', error);
        throw error;
    }
}

/**
 * Získá typ a ID platby podle orderNumber
 * @param {string} orderNumber - Číslo objednávky
 * @returns {Object|null} - {type: 'package'|'topAd', id: 'hobby'|'business'|'oneday'|...}
 */
function getPaymentTypeFromOrderNumber(orderNumber) {
    if (!orderNumber) return null;
    
    // Zkontrolovat balíčky
    const packages = window.GOPAY_CONFIG?.packages || {};
    for (const [id, config] of Object.entries(packages)) {
        if (config.orderNumber === orderNumber) {
            return { type: 'package', id: id };
        }
    }
    
    // Zkontrolovat topování
    const topAds = window.GOPAY_CONFIG?.topAds || {};
    for (const [id, config] of Object.entries(topAds)) {
        if (config.orderNumber === orderNumber) {
            return { type: 'topAd', id: id };
        }
    }
    
    return null;
}

/**
 * Aktivuje plán podle informací o platbě
 * @param {Object} paymentInfo - Informace o platbě z GoPay
 * @param {Object} paymentType - {type: 'package'|'topAd', id: '...'}
 * @returns {Promise<void>}
 */
async function activatePlanFromPayment(paymentInfo, paymentType) {
    if (!paymentType) {
        console.warn('⚠️ Nelze aktivovat plán - neznámé orderNumber:', paymentInfo.orderNumber);
        return;
    }
    
    try {
        // Počkat na Firebase
        await new Promise((resolve) => {
            if (window.firebaseAuth && window.firebaseDb) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.firebaseAuth && window.firebaseDb) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            }
        });
        
        const user = window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) {
            console.log('⚠️ Uživatel není přihlášen nebo Firebase není dostupný');
            return;
        }
        
        const { setDoc, doc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const config = window.getPaymentConfig(paymentType.type, paymentType.id);
        
        if (!config) {
            console.warn('⚠️ Nelze aktivovat plán - neznámá konfigurace:', paymentType);
            return;
        }
        
        const now = Timestamp.now();
        
        if (paymentType.type === 'package') {
            // Aktivovat balíček
            const durationDays = config.duration * 30; // měsíce na dny
            const periodEnd = new Date(now.toDate());
            periodEnd.setDate(periodEnd.getDate() + durationDays);
            
            await setDoc(
                doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'),
                {
                    plan: paymentType.id,
                    planName: config.productName,
                    planUpdatedAt: now,
                    planPeriodStart: now,
                    planPeriodEnd: Timestamp.fromDate(periodEnd),
                    planDurationDays: durationDays,
                    planCancelAt: null,
                },
                { merge: true }
            );
            
            console.log('✅ Balíček aktivován:', paymentType.id);
            
        } else if (paymentType.type === 'topAd') {
            // Topování - potřebujeme adId ze sessionStorage
            const paymentData = sessionStorage.getItem('gopay_payment');
            if (paymentData) {
                const payment = JSON.parse(paymentData);
                const adId = payment.adId;
                
                if (adId) {
                    const durationDays = config.duration; // už v dnech
                    const periodEnd = new Date(now.toDate());
                    periodEnd.setDate(periodEnd.getDate() + durationDays);
                    
                    await setDoc(
                        doc(window.firebaseDb, 'ads', adId),
                        {
                            topUntil: Timestamp.fromDate(periodEnd),
                            topActivatedAt: now,
                            topDuration: durationDays,
                        },
                        { merge: true }
                    );
                    
                    console.log('✅ Topování aktivováno pro inzerát:', adId);
                } else {
                    console.warn('⚠️ Nelze aktivovat topování - chybí adId');
                }
            }
        }
    } catch (error) {
        console.error('❌ Chyba při aktivaci plánu:', error);
        throw error;
    }
}

// Export pro globální použití
window.parseGoPayReturnParams = parseGoPayReturnParams;
window.savePaymentToFirestore = savePaymentToFirestore;
window.getPaymentTypeFromOrderNumber = getPaymentTypeFromOrderNumber;
window.activatePlanFromPayment = activatePlanFromPayment;

