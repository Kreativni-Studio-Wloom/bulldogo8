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
    // Může být idPaymentSession nebo paymentSessionId (podle verze GoPay)
    const paymentSessionId = urlParams.get('idPaymentSession') || urlParams.get('paymentSessionId');
    
    // GoPay při úspěšné platbě může vracet různé parametry
    // Pokud jsme na success stránce a není state, pravděpodobně je to úspěšná platba
    const isSuccessPage = window.location.pathname.includes('success');
    const isFailedPage = window.location.pathname.includes('failed');
    
    let defaultState = null;
    if (isSuccessPage && !urlParams.get('state')) {
        // Na success stránce bez state = pravděpodobně úspěšná platba
        defaultState = 'PAID';
    } else if (isFailedPage && !urlParams.get('state')) {
        // Na failed stránce bez state = pravděpodobně zrušená platba
        defaultState = 'CANCELED';
    }
    
    const params = {
        idPaymentSession: paymentSessionId,
        paymentSessionId: paymentSessionId, // Duplicitní pro kompatibilitu
        state: urlParams.get('state') || defaultState,
        totalPrice: urlParams.get('totalPrice'),
        currency: urlParams.get('currency'),
        orderNumber: urlParams.get('orderNumber'),
        productName: urlParams.get('productName'),
        targetGoId: urlParams.get('targetGoId'),
        encryptedSignature: urlParams.get('encryptedSignature'),
        // Další možné parametry
        paymentMethod: urlParams.get('paymentMethod'),
        payer: urlParams.get('payer'),
    };
    
    // Pokud jsou nějaké parametry, vrať je
    // Podporujeme paymentSessionId (zrušená platba) i idPaymentSession (úspěšná platba)
    if (params.idPaymentSession || params.paymentSessionId || params.orderNumber || params.state) {
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
        
        // Zkusit získat uživatele z Firebase Auth nebo sessionStorage
        let user = window.firebaseAuth?.currentUser;
        
        if (!user) {
            console.warn('⚠️ currentUser není dostupný, zkouším sessionStorage...');
            const userData = sessionStorage.getItem('firebase_user');
            if (userData) {
                try {
                    const userInfo = JSON.parse(userData);
                    console.log('ℹ️ Uživatel získána z sessionStorage:', userInfo.uid);
                    // Vytvořit mock user objekt
                    user = {
                        uid: userInfo.uid,
                        email: userInfo.email
                    };
                } catch (e) {
                    console.error('❌ Nelze parsovat user data z sessionStorage:', e);
                }
            }
        }
        
        if (!user || !window.firebaseDb) {
            console.error('❌ Uživatel není přihlášen nebo Firebase není dostupný');
            throw new Error('Uživatel není přihlášen nebo Firebase není dostupný');
        }
        
        const { setDoc, doc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const now = Timestamp.now();
        
        // Uložit záznam o platbě
        const orderNumber = paymentInfo.orderNumber || `ORDER-${Date.now()}`;
        const gopayId = paymentInfo.idPaymentSession || paymentInfo.paymentSessionId || null;
        // Pokud jsme na success stránce, state musí být PAID (i když GoPay vrací jiný)
        // Pokud není state, předpokládáme PAID (úspěšná platba)
        let state = paymentInfo.state || 'PAID';
        if (window.location.pathname.includes('success') && state !== 'PAID') {
            state = 'PAID';
            console.log('⚠️ Opravuji state na PAID (jsme na success stránce, GoPay vrátil:', paymentInfo.state, ')');
        }
        
        // Pokud chybí částka nebo produkt, zkusit získat z konfigurace
        let amount = paymentInfo.totalPrice ? parseInt(paymentInfo.totalPrice) / 100 : 0;
        let productName = paymentInfo.productName || '';
        
        if (!amount || !productName) {
            const paymentType = window.getPaymentTypeFromOrderNumber(orderNumber);
            if (paymentType) {
                const config = window.getPaymentConfig(paymentType.type, paymentType.id);
                if (config) {
                    if (!amount) {
                        amount = config.amount;
                        console.log('ℹ️ Částka získána z konfigurace:', amount, 'Kč');
                    }
                    if (!productName) {
                        productName = config.productName;
                        console.log('ℹ️ Produkt získána z konfigurace:', productName);
                    }
                }
            }
        }
        
        const userId = user.uid || user.userId;
        
        const paymentData = {
            gopayId: gopayId,
            orderNumber: orderNumber,
            userId: userId,
            state: state,
            amount: amount,
            currency: paymentInfo.currency || 'CZK',
            productName: productName,
            paymentMethod: paymentInfo.paymentMethod || null,
            payer: paymentInfo.payer || null,
            createdAt: now,
            updatedAt: now,
            returnUrl: window.location.href,
            rawParams: paymentInfo, // Uložit všechny parametry pro debugging
        };
        
        console.log('💾 Ukládám do Firestore:', paymentData);
        
        await setDoc(
            doc(window.firebaseDb, 'payments', orderNumber),
            paymentData,
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
        
        // Zkusit získat uživatele z Firebase Auth nebo sessionStorage
        let user = window.firebaseAuth?.currentUser;
        
        if (!user) {
            console.warn('⚠️ currentUser není dostupný, zkouším sessionStorage...');
            const userData = sessionStorage.getItem('firebase_user');
            if (userData) {
                try {
                    const userInfo = JSON.parse(userData);
                    console.log('ℹ️ Uživatel získána z sessionStorage:', userInfo.uid);
                    // Vytvořit mock user objekt pro použití v kódu
                    user = {
                        uid: userInfo.uid,
                        email: userInfo.email
                    };
                } catch (e) {
                    console.error('❌ Nelze parsovat user data z sessionStorage:', e);
                }
            }
        }
        
        if (!user || !window.firebaseDb) {
            console.error('❌ Uživatel není přihlášen nebo Firebase není dostupný');
            console.error('❌ Firebase Auth:', window.firebaseAuth);
            console.error('❌ Firebase Db:', window.firebaseDb);
            throw new Error('Uživatel není přihlášen nebo Firebase není dostupný');
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
            
            const userId = user.uid || user.userId;
            const profilePath = `users/${userId}/profile/profile`;
            const planData = {
                plan: paymentType.id,
                planName: config.productName,
                planUpdatedAt: now,
                planPeriodStart: now,
                planPeriodEnd: Timestamp.fromDate(periodEnd),
                planDurationDays: durationDays,
                planCancelAt: null,
            };
            
            console.log('💾 Ukládám plán do Firestore:');
            console.log('   Cesta:', profilePath);
            console.log('   Data:', planData);
            console.log('   User UID:', user.uid);
            console.log('   User Email:', user.email);
            
            try {
                // Použít uid z user objektu (může být z currentUser nebo sessionStorage)
                const userId = user.uid || user.userId;
                if (!userId) {
                    throw new Error('Chybí userId');
                }
                
                await setDoc(
                    doc(window.firebaseDb, 'users', userId, 'profile', 'profile'),
                    planData,
                    { merge: true }
                );
                
                console.log('✅ Balíček aktivován:', paymentType.id);
                console.log('✅ Plán uložen do:', profilePath);
                
                // Ověřit, že se to skutečně uložilo
                const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                // userId už je definován výše, použít existující
                const savedDoc = await getDoc(doc(window.firebaseDb, 'users', userId, 'profile', 'profile'));
                if (savedDoc.exists()) {
                    const savedData = savedDoc.data();
                    console.log('✅ Ověření - plán v databázi:', savedData.plan);
                    console.log('✅ Ověření - celá data:', savedData);
                } else {
                    console.error('❌ Dokument neexistuje po uložení!');
                }
            } catch (error) {
                console.error('❌ Chyba při ukládání plánu:', error);
                console.error('❌ Error code:', error.code);
                console.error('❌ Error message:', error.message);
                console.error('❌ Error stack:', error.stack);
                throw error; // Znovu vyhodit, aby to bylo vidět v success.html
            }
            
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

// Export pro globální použití - musí být na konci souboru
if (typeof window !== 'undefined') {
    window.parseGoPayReturnParams = parseGoPayReturnParams;
    window.savePaymentToFirestore = savePaymentToFirestore;
    window.getPaymentTypeFromOrderNumber = getPaymentTypeFromOrderNumber;
    window.activatePlanFromPayment = activatePlanFromPayment;
    console.log('✅ GoPay payment handler funkce exportovány na window');
}

