// Packages functionality
let selectedPlan = null;
// Zpřístupnit globálně pro GoPay integraci
window.selectedPlan = selectedPlan;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializePackages();
    initializeAuthState();
    // Po načtení stránky vyčkej na Firebase a načti stav balíčku
    (function waitAndLoadPlan(){
        if (window.firebaseAuth && window.firebaseDb) {
            loadCurrentPlan();
        } else {
            setTimeout(waitAndLoadPlan, 100);
        }
    })();
});

function initializePackages() {
    console.log('🚀 Initializing packages');
    
    // Add event listeners to pricing buttons
    document.querySelectorAll('.btn-pricing').forEach(button => {
        button.addEventListener('click', function() {
            const plan = this.getAttribute('data-plan');
            const price = this.getAttribute('data-price');
            selectPlan(plan, price);
        });
    });
}

function selectPlan(plan, price) {
    selectedPlan = {
        plan: plan,
        price: parseInt(price)
    };
    // Zpřístupnit globálně pro GoPay integraci
    window.selectedPlan = selectedPlan;

    console.log('📦 Selected plan:', plan, 'Price:', price);

    // Show payment section
    showPayment();
}

function showPayment() {
    document.getElementById('paymentSection').style.display = 'block';
    document.querySelector('.top-ads-pricing').style.display = 'none';
    
    // Update payment summary
    updatePaymentSummary();
    
    // Scroll to payment
    document.getElementById('paymentSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function hidePayment() {
    document.getElementById('paymentSection').style.display = 'none';
    document.querySelector('.top-ads-pricing').style.display = 'block';
    
    // Scroll to pricing
    document.querySelector('.top-ads-pricing').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function updatePaymentSummary() {
    if (!selectedPlan) return;
    
    // Získat konfiguraci z GoPay config
    let planTitle = '';
    let planType = '';
    let price = 0;
    
    if (typeof window.getPaymentConfig === 'function') {
        const config = window.getPaymentConfig('package', selectedPlan.plan);
        if (config) {
            planTitle = config.productName.replace('balicek ', '').replace('Hobby', 'Hobby uživatel').replace('Firma', 'Firma');
            planType = config.description || '';
            price = config.amount;
        }
    }
    
    // Fallback pokud GoPay config není načten
    if (!planTitle) {
        switch(selectedPlan.plan) {
            case 'hobby':
                planTitle = 'Hobby uživatel';
                planType = 'První měsíc zdarma, poté 39 Kč/měsíc';
                price = 39;
                break;
            case 'business':
                planTitle = 'Firma';
                planType = 'Měsíční předplatné';
                price = 199;
                break;
        }
    }
    
    document.getElementById('selectedPlanTitle').textContent = planTitle;
    document.getElementById('selectedPlanType').textContent = planType;
    
    if (selectedPlan.plan === 'hobby' && selectedPlan.price === 0) {
        document.getElementById('totalPrice').textContent = 'První měsíc zdarma';
    } else {
        document.getElementById('totalPrice').textContent = price + ' Kč/měsíc';
    }
}

async function processPayment() {
    // Zkontrolovat, zda je vybraný plán
    if (!window.selectedPlan || !window.selectedPlan.plan) {
        showMessage("Prosím nejdříve vyberte balíček", "error");
        return;
    }
    
    // Zkontrolovat, zda je GoPay konfigurace načtena
    if (typeof window.createGoPayUrl !== 'function') {
        showMessage("GoPay konfigurace není načtena. Obnovte prosím stránku.", "error");
        return;
    }
    
    try {
        // Získat platební URL
        const planId = window.selectedPlan.plan; // 'hobby' nebo 'business'
        const paymentUrl = window.createGoPayUrl('package', planId);
        
        console.log('💳 Přesměrování na GoPay:', paymentUrl);
        
        // Zobrazit loading stav
        const payButton = document.querySelector('.payment-actions .btn-primary');
        const originalText = payButton.innerHTML;
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Přesměrovávám...';
        payButton.disabled = true;
        
        // Uložit informace o platbě do sessionStorage pro pozdější zpracování
        const paymentConfig = window.getPaymentConfig('package', planId);
        sessionStorage.setItem('gopay_payment', JSON.stringify({
            type: 'package',
            id: planId,
            orderNumber: paymentConfig.orderNumber,
            amount: paymentConfig.amount,
            timestamp: Date.now()
        }));
        
        // Přesměrovat na GoPay platební bránu
        window.location.href = paymentUrl;
        
    } catch (error) {
        console.error('❌ Chyba při vytváření platební URL:', error);
        showMessage("Nepodařilo se vytvořit platební odkaz. Zkuste to prosím znovu.", "error");
        
        // Obnovit tlačítko
        const payButton = document.querySelector('.payment-actions .btn-primary');
        if (payButton) {
            payButton.innerHTML = '<i class="fas fa-credit-card"></i> Zaplatit';
            payButton.disabled = false;
        }
    }
}

async function showSuccess() {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'block';
    
    // Scroll to success
    document.getElementById('successSection').scrollIntoView({ 
        behavior: 'smooth' 
    });

    // Zapsat plán do Firestore profilu uživatele (users/{uid}/profile/profile) - zdroj pravdy
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (user && window.firebaseDb && selectedPlan && selectedPlan.plan) {
            const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const now = new Date();
            const durationDays = 30; // měsíční předplatné
            const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
            
            console.log('💾 Ukládám balíček do databáze:', selectedPlan.plan);
            await setDoc(
                doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'),
                { plan: selectedPlan.plan, planUpdatedAt: now, planPeriodStart: now, planPeriodEnd: periodEnd, planDurationDays: durationDays, planCancelAt: null },
                { merge: true }
            );
            console.log('✅ Balíček úspěšně uložen do databáze');
            
            // Volitelně synchronizovat do localStorage pouze pro zobrazení odznaku (cache)
            try {
                localStorage.setItem('bdg_plan', selectedPlan.plan);
            } catch (_) {}
        }
    } catch (e) {
        console.error('❌ Uložení plánu do Firestore selhalo:', e);
        showMessage('Nepodařilo se uložit balíček. Zkuste to prosím znovu.', 'error');
    }
}

function resetPackages() {
    // Reset all selections
    selectedPlan = null;
    window.selectedPlan = null;
    
    // Hide all sections except pricing
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
    document.querySelector('.top-ads-pricing').style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Ruční aktualizace odznaku po aktivaci balíčku (pro případ, že UI neodchytí změnu okamžitě)
async function refreshBadge() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user) { showAuthModal('login'); return; }
        if (!window.firebaseDb) return;
        
        // Kontrola balíčku přímo z databáze (použít globální funkci pokud existuje)
        let plan = null;
        if (typeof window.checkUserPlanFromDatabase === 'function') {
            plan = await window.checkUserPlanFromDatabase(user.uid);
        } else {
            // Fallback: načíst přímo z databáze
            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                plan = data.plan || null;
                // Kontrola, zda je balíček aktivní
                if (plan) {
                    const planPeriodEnd = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
                    if (planPeriodEnd && new Date() >= planPeriodEnd) {
                        plan = null;
                    }
                }
            }
        }
        
        // Volitelně synchronizovat do localStorage pro cache (zobrazení odznaku)
        if (plan) {
            try { localStorage.setItem('bdg_plan', plan); } catch (_) {}
        } else {
            try { localStorage.removeItem('bdg_plan'); } catch (_) {}
        }
        
        // Vložit/aktualizovat odznak v tlačítku Profil
        const userProfileSection = document.getElementById('userProfileSection');
        const btnProfile = userProfileSection && userProfileSection.querySelector('.btn-profile');
        if (btnProfile) {
            const old = btnProfile.querySelector('.user-badge');
            if (old) old.remove();
            const badge = document.createElement('span');
            const label = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : '?';
            const cls = plan === 'business' ? 'badge-business' : plan === 'hobby' ? 'badge-hobby' : 'badge-unknown';
            badge.className = 'user-badge ' + cls;
            badge.textContent = label;
            btnProfile.appendChild(badge);
        }
        // krátká zpráva
        alert('Odznak aktualizován' + (plan ? `: ${plan}` : ''));
    } catch (e) {
        console.error('❌ refreshBadge:', e);
        alert('Nepodařilo se aktualizovat odznak');
    }
}

// Načíst aktuální balíček a aktualizovat manage UI
async function loadCurrentPlan() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        const pPlan = document.getElementById('currentPlan');
        const pEnd = document.getElementById('currentPlanEnd');
        const pCancel = document.getElementById('currentPlanCancelAt');
        const cancelInfo = document.getElementById('cancelInfo');
        const btnCancel = document.getElementById('btnCancelPlan');
        const btnUndo = document.getElementById('btnUndoCancel');
        if (!user || !window.firebaseDb || !pPlan) return;
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const snap = await getDoc(ref);
        let plan = 'none', planPeriodEnd = null, planCancelAt = null;
        if (snap.exists()) {
            const data = snap.data();
            plan = data.plan || 'none';
            planPeriodEnd = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
            planCancelAt = data.planCancelAt ? (data.planCancelAt.toDate ? data.planCancelAt.toDate() : new Date(data.planCancelAt)) : null;
        }
        const planLabel = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : 'Žádný';
        pPlan.textContent = planLabel;
        pEnd.textContent = planPeriodEnd ? planPeriodEnd.toLocaleDateString('cs-CZ') : '-';
        if (planCancelAt) {
            cancelInfo.style.display = '';
            pCancel.textContent = planCancelAt.toLocaleDateString('cs-CZ');
            if (btnCancel) btnCancel.style.display = 'none';
            if (btnUndo) btnUndo.style.display = '';
        } else {
            cancelInfo.style.display = 'none';
            if (btnCancel) btnCancel.style.display = plan === 'none' ? 'none' : '';
            if (btnUndo) btnUndo.style.display = 'none';
        }
    } catch (e) {
        console.error('❌ loadCurrentPlan:', e);
    }
}

// Naplánovat zrušení k datu konce období
async function cancelPlan() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) return;
        const { getDoc, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const end = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
        if (!end) { alert('Nelze určit konec období.'); return; }
        await setDoc(ref, { planCancelAt: end }, { merge: true });
        alert('Zrušení balíčku naplánováno k: ' + end.toLocaleDateString('cs-CZ'));
        loadCurrentPlan();
    } catch (e) {
        console.error('❌ cancelPlan:', e);
        alert('Nepodařilo se naplánovat zrušení');
    }
}

// Zrušit naplánované zrušení
async function undoCancel() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) return;
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        await setDoc(ref, { planCancelAt: null }, { merge: true });
        alert('Zrušení bylo odebráno');
        loadCurrentPlan();
    } catch (e) {
        console.error('❌ undoCancel:', e);
        alert('Nepodařilo se zrušit naplánované zrušení');
    }
}

// Auth modal functions (reused from main script)
function showAuthModal(type) {
    const modal = document.getElementById('authModal');
    const title = modal.querySelector('.modal-title');
    const form = modal.querySelector('.auth-form');
    const submitBtn = modal.querySelector('.auth-submit-btn');
    const switchBtn = modal.querySelector('.auth-switch-btn');
    
    if (type === 'login') {
        title.textContent = 'Přihlášení';
        submitBtn.textContent = 'Přihlásit se';
        switchBtn.textContent = 'Nemáte účet? Zaregistrujte se';
        switchBtn.setAttribute('data-type', 'register');
    } else {
        title.textContent = 'Registrace';
        submitBtn.textContent = 'Zaregistrovat se';
        switchBtn.textContent = 'Máte účet? Přihlaste se';
        switchBtn.setAttribute('data-type', 'login');
    }
    
    modal.style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('authModal');
    if (event.target === modal) {
        closeAuthModal();
    }
});

// Auth form handling
document.getElementById('authForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Prosím vyplňte všechna pole.');
        return;
    }
    
    // Simulate auth process
    const submitBtn = this.querySelector('.auth-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Zpracovávám...';
    submitBtn.disabled = true;
    
    setTimeout(() => {
        alert('Přihlášení úspěšné!');
        closeAuthModal();
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 1500);
});

// Auth switch handling
document.querySelector('.auth-switch-btn').addEventListener('click', function() {
    const type = this.getAttribute('data-type');
    showAuthModal(type);
});

// Chat link handling with auth check
document.querySelectorAll('a[href="chat.html"]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        checkAuthForChat();
    });
});

function checkAuthForChat() {
    // Check if user is authenticated
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                // User is logged in, allow access to chat
                window.location.href = 'chat.html';
            } else {
                // User is not logged in, show auth modal
                showAuthModal('login');
            }
        });
    } else {
        // Firebase not loaded yet, show auth modal
        showAuthModal('login');
    }
}
