// Top Ads functionality
let selectedPricing = null;
let selectedAd = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializeTopAds();
    initializeAuthState();
});

function initializeTopAds() {
    console.log('🚀 Initializing top ads');
    
    // Add event listeners to pricing buttons
    document.querySelectorAll('.btn-pricing').forEach(button => {
        button.addEventListener('click', function() {
            const duration = this.getAttribute('data-duration');
            const price = this.getAttribute('data-price');
            selectPricing(duration, price);
        });
    });

    // URL preselection (duration/price) support
    try {
        const params = new URLSearchParams(window.location.search);
        const d = params.get('duration');
        const p = params.get('price');
        if (d && p) {
            const di = parseInt(d, 10);
            const pi = parseInt(p, 10);
            if ([1,7,30].includes(di) && pi > 0) {
                selectPricing(di, pi);
            }
        }
    } catch (_) {}

    // Wait for Firebase to be ready before loading ads
    waitForFirebase();
}

function waitForFirebase() {
    console.log('⏳ Waiting for Firebase to be ready...');
    
    const checkFirebase = () => {
        if (window.firebaseAuth && window.firebaseDb) {
            console.log('✅ Firebase is ready, setting up auth listener...');
            setupAuthListener();
        } else {
            console.log('⏳ Firebase not ready yet, retrying in 100ms...');
            setTimeout(checkFirebase, 100);
        }
    };
    
    // Start checking immediately
    setTimeout(checkFirebase, 0);
}

function setupAuthListener() {
    console.log('🔐 Setting up auth state listener...');
    
    // Use onAuthStateChanged to properly detect auth state
    window.firebaseAuth.onAuthStateChanged((user) => {
        console.log('👤 Auth state changed:', user ? `Přihlášen: ${user.email}` : 'Odhlášen');
        
        if (user) {
            console.log('✅ User is authenticated, loading ads...');
            loadUserAds();
        } else {
            console.log('❌ User not authenticated, showing login message...');
            showLoginRequired();
        }
    });
}

function showLoginRequired() {
    const adsList = document.getElementById('adsList');
    if (adsList) {
        adsList.innerHTML = `
            <div class="no-ads-message">
                <i class="fas fa-lock"></i>
                <h3>Přihlášení vyžadováno</h3>
                <p>Pro topování inzerátů se musíte přihlásit.</p>
                <button class="btn btn-primary" onclick="showAuthModal('login')">
                    <i class="fas fa-sign-in-alt"></i>
                    Přihlásit se
                </button>
            </div>
        `;
    }
}

function selectPricing(duration, price) {
    selectedPricing = {
        duration: parseInt(duration),
        price: parseInt(price)
    };

    // Always show ad selection first, regardless of pre-selected ad
    showAdSelection();
}

function showAdSelection() {
    document.getElementById('adSelection').style.display = 'block';
    document.querySelector('.top-ads-pricing').style.display = 'none';
    
    // Scroll to ad selection
    document.getElementById('adSelection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function hideAdSelection() {
    document.getElementById('adSelection').style.display = 'none';
    document.querySelector('.top-ads-pricing').style.display = 'block';
    
    // Scroll to pricing
    document.querySelector('.top-ads-pricing').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function loadUserAds() {
    console.log('🔍 loadUserAds called');
    
    const adsList = document.getElementById('adsList');
    if (!adsList) {
        console.error('❌ adsList element not found!');
        return;
    }
    
    console.log('✅ adsList element found');
    
    // Check if we have a pre-selected ad from URL
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectedAdId = urlParams.get('adId');
    
    console.log('🔍 Loading user ads, preSelectedAdId:', preSelectedAdId);
    
    // Load real user ads from Firebase
    loadUserAdsFromFirebase(preSelectedAdId);
}

async function loadUserAdsFromFirebase(preSelectedAdId = null) {
    try {
        console.log('🔄 Loading ads from Firebase, preSelectedAdId:', preSelectedAdId);
        
        // Get current user from auth state
        const currentUser = window.firebaseAuth.currentUser;
        console.log('👤 Current user from auth:', currentUser);
        
        if (!currentUser) {
            console.log('❌ No current user, this should not happen with auth listener');
            showLoginRequired();
            return;
        }

        const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const adsCollection = collection(window.firebaseDb, 'users', currentUser.uid, 'inzeraty');
        const querySnapshot = await getDocs(adsCollection);
        
        console.log('📊 Found ads:', querySnapshot.size);
        
        const adsList = document.getElementById('adsList');
        adsList.innerHTML = '';
        
        let foundPreSelected = false;
        
        if (querySnapshot.size === 0) {
            console.log('⚠️ No ads found, showing message');
            adsList.innerHTML = `
                <div class="no-ads-message">
                    <i class="fas fa-info-circle"></i>
                    <h3>Žádné inzeráty nenalezeny</h3>
                    <p>Nemáte žádné inzeráty k topování. Nejdříve vytvořte inzerát v sekci "Mé inzeráty".</p>
                    <button class="btn btn-primary" onclick="window.location.href='my-ads.html'">
                        <i class="fas fa-list"></i>
                        Moje inzeráty
                    </button>
                </div>
            `;
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const ad = doc.data();
            const adId = doc.id;
            
            console.log('📝 Processing ad:', adId, 'title:', ad.title);
            
            const adItem = document.createElement('div');
            adItem.className = 'ad-item';
            adItem.setAttribute('data-ad-id', adId);
            adItem.innerHTML = `
                <h3>${ad.title}</h3>
                <p>${ad.description}</p>
                <p><strong>Kategorie:</strong> ${ad.category}</p>
                <p><strong>Lokace:</strong> ${ad.location}</p>
                <p><strong>Cena:</strong> ${ad.price}</p>
            `;
            
            adItem.addEventListener('click', function() {
                selectAd({ id: adId, ...ad }, adItem);
            });
            
            adsList.appendChild(adItem);
            
            // Mark pre-selected ad visually; auto-select when pricing preselected
            if (preSelectedAdId && adId === preSelectedAdId) {
                console.log('✅ Found pre-selected ad, marking visually:', adId);
                foundPreSelected = true;
                adItem.classList.add('pre-selected');
                adItem.innerHTML += '<div class="pre-selected-badge"><i class="fas fa-star"></i> Doporučeno</div>';

                // Pokud je předvybraná délka/price (selectedPricing), rovnou vyber a přejdi na platbu
                if (selectedPricing && typeof selectedPricing.duration === 'number') {
                    try { selectAd({ id: adId, ...ad }, adItem); } catch (_) {}
                }
            }
        });
        
        if (preSelectedAdId && !foundPreSelected) {
            console.log('⚠️ Pre-selected ad not found:', preSelectedAdId);
        }
        
    } catch (error) {
        console.error('❌ Chyba při načítání inzerátů:', error);
        const adsList = document.getElementById('adsList');
        adsList.innerHTML = `
            <div class="no-ads-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Chyba při načítání</h3>
                <p>Nepodařilo se načíst vaše inzeráty. Zkuste to prosím znovu.</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-refresh"></i>
                    Obnovit stránku
                </button>
            </div>
        `;
    }
}


function selectAd(ad, element) {
    console.log('🎯 Selecting ad:', ad.id, 'title:', ad.title);
    
    // Remove previous selection
    document.querySelectorAll('.ad-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Select current ad
    element.classList.add('selected');
    selectedAd = ad;
    
    console.log('✅ Ad selected, showing payment in 500ms');
    
    // Show payment section after a short delay
    setTimeout(() => {
        showPayment();
    }, 500);
}

function showPayment() {
    document.getElementById('adSelection').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'block';
    
    // Update payment summary
    updatePaymentSummary();
    
    // Scroll to payment
    document.getElementById('paymentSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function hidePayment() {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('adSelection').style.display = 'block';
    
    // Scroll to ad selection
    document.getElementById('adSelection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function updatePaymentSummary() {
    if (!selectedAd || !selectedPricing) return;
    
    document.getElementById('selectedAdTitle').textContent = selectedAd.title;
    
    let durationText = '';
    if (selectedPricing.duration === 1) {
        durationText = '1 den';
    } else if (selectedPricing.duration === 7) {
        durationText = '1 týden';
    } else if (selectedPricing.duration === 30) {
        durationText = '1 měsíc';
    }
    
    document.getElementById('selectedDuration').textContent = durationText;
    document.getElementById('totalPrice').textContent = selectedPricing.price + ' Kč';
}

function processPayment() {
    // Zkontrolovat, zda je vybrané topování
    if (!selectedPricing || !selectedAd) {
        alert("Prosím nejdříve vyberte inzerát a délku topování");
        return;
    }
    
    // Zkontrolovat, zda je GoPay konfigurace načtena
    if (typeof window.createGoPayUrl !== 'function') {
        alert("GoPay konfigurace není načtena. Obnovte prosím stránku.");
        return;
    }
    
    try {
        // Mapovat duration na GoPay ID
        let topAdId;
        if (selectedPricing.duration === 1) {
            topAdId = 'oneday';
        } else if (selectedPricing.duration === 7) {
            topAdId = 'oneweek';
        } else if (selectedPricing.duration === 30) {
            topAdId = 'onemonth';
        } else {
            throw new Error('Neznámá délka topování: ' + selectedPricing.duration);
        }
        
        // Získat platební URL
        const paymentUrl = window.createGoPayUrl('topAd', topAdId);
        
        console.log('💳 Přesměrování na GoPay pro topování:', paymentUrl);
        
        // Zobrazit loading stav
        const payButton = document.querySelector('.payment-actions .btn-primary');
        const originalText = payButton.innerHTML;
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Přesměrovávám...';
        payButton.disabled = true;
        
        // Uložit informace o platbě do sessionStorage
        const paymentConfig = window.getPaymentConfig('topAd', topAdId);
        sessionStorage.setItem('gopay_payment', JSON.stringify({
            type: 'topAd',
            id: topAdId,
            orderNumber: paymentConfig.orderNumber,
            amount: paymentConfig.amount,
            duration: selectedPricing.duration,
            adId: selectedAd.id,
            timestamp: Date.now()
        }));
        
        // Přesměrovat na GoPay platební bránu
        window.location.href = paymentUrl;
        
    } catch (error) {
        console.error('❌ Chyba při vytváření platební URL:', error);
        alert("Nepodařilo se vytvořit platební odkaz. Zkuste to prosím znovu.");
        
        // Obnovit tlačítko
        const payButton = document.querySelector('.payment-actions .btn-primary');
        if (payButton) {
            payButton.innerHTML = '<i class="fas fa-credit-card"></i> Zaplatit';
            payButton.disabled = false;
        }
    }
}

function showSuccess() {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'block';
    
    // Scroll to success
    document.getElementById('successSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function resetTopAds() {
    // Reset all selections
    selectedPricing = null;
    selectedAd = null;
    
    // Hide all sections except pricing
    document.getElementById('adSelection').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
    document.querySelector('.top-ads-pricing').style.display = 'block';
    
    // Clear selections
    document.querySelectorAll('.ad-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
