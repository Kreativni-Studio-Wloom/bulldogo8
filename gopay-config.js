/**
 * GoPay Platební konfigurace
 * 
 * Tento soubor obsahuje konfiguraci pro všechny GoPay platby
 * Používá předgenerované URL s encrypted signature
 */

const GOPAY_CONFIG = {
  // Testovací prostředí
  isTest: true,
  baseUrl: "https://gw.sandbox.gopay.com/gw/pay-base-v2",
  targetGoId: "8419533331",
  
  // Produkční prostředí (až budete připraveni)
  // baseUrl: "https://gate.gopay.cz/gw/pay-base-v2",
  // targetGoId: "VÁŠ_PRODUKČNÍ_GO_ID",
  
  // Balíčky
  packages: {
    hobby: {
      amount: 39, // Kč
      amountInHellers: 3900, // v haléřích
      currency: "CZK",
      productName: "balicek Hobby",
      orderNumber: "hobby",
      duration: 1, // měsíc
      description: "První měsíc zdarma a poté se účtuje 39 kč měsíčně",
      encryptedSignature: "63e93a5e0066f2307418ff108f61516b275ece4346d76c7ddbe2b478e0a0e9e91ecb0519e2c4c1f9341f58f210b5cf53"
    },
    business: {
      amount: 199, // Kč
      amountInHellers: 19900, // v haléřích
      currency: "CZK",
      productName: "balicek Firma",
      orderNumber: "firma",
      duration: 1, // měsíc
      description: "Měsíční předplatné",
      encryptedSignature: "ca2ed9385e44b3928697af6bcb9af243acbd6b591c0fd0d009bfddf0dd2e433a46e3596e24af0825341f58f210b5cf53"
    }
  },
  
  // Topování
  topAds: {
    oneday: {
      amount: 19, // Kč
      amountInHellers: 1900, // v haléřích
      currency: "CZK",
      productName: "top oneday",
      orderNumber: "oneday",
      duration: 1, // den
      description: "Topování na 1 den",
      encryptedSignature: "664ef997fc47e6cd87a68be27ca798932d2afad9ba4b301a617c99fcf56774b983cf65a030d87ca9341f58f210b5cf53"
    },
    oneweek: {
      amount: 49, // Kč
      amountInHellers: 4900, // v haléřích
      currency: "CZK",
      productName: "top oneweek",
      orderNumber: "oneweek",
      duration: 7, // dní
      description: "Topování na 1 týden",
      encryptedSignature: "a420bc7fb94129fdc7e4fbf3d83cdf7a76fb01f7448e9e1487f4ed13a1ddb2183e9aa4ef8162d651341f58f210b5cf53"
    },
    onemonth: {
      amount: 149, // Kč
      amountInHellers: 14900, // v haléřích
      currency: "CZK",
      productName: "top onemonth",
      orderNumber: "onemonth",
      duration: 30, // dní
      description: "Topování na 1 měsíc",
      encryptedSignature: "905ab52c3930f14320c4a476f1cd98b6d183966571f6f9e84b0da9726fd008e6f4675eccfedeaabe341f58f210b5cf53"
    }
  },
  
  // URL pro návrat z platby
  returnUrls: {
    success: "https://bulldogo8.vercel.app/success",
    failed: "https://bulldogo8.vercel.app/failed"
  }
};

/**
 * Vytvoří GoPay platební URL
 * 
 * @param {string} type - Typ platby: 'package' nebo 'topAd'
 * @param {string} id - ID platby (např. 'hobby', 'business', 'oneday', 'oneweek', 'onemonth')
 * @returns {string} - GoPay platební URL
 */
function createGoPayUrl(type, id) {
  const config = GOPAY_CONFIG;
  let paymentConfig;
  
  if (type === 'package') {
    paymentConfig = config.packages[id];
  } else if (type === 'topAd') {
    paymentConfig = config.topAds[id];
  } else {
    throw new Error(`Neznámý typ platby: ${type}`);
  }
  
  if (!paymentConfig) {
    throw new Error(`Neznámé ID platby: ${id} pro typ ${type}`);
  }
  
  // Vytvoření URL parametrů
  const params = new URLSearchParams({
    'paymentCommand.targetGoId': config.targetGoId,
    'paymentCommand.totalPrice': paymentConfig.amountInHellers.toString(),
    'paymentCommand.currency': paymentConfig.currency,
    'paymentCommand.productName': paymentConfig.productName,
    'paymentCommand.orderNumber': paymentConfig.orderNumber,
    'paymentCommand.successURL': config.returnUrls.success,
    'paymentCommand.failedURL': config.returnUrls.failed,
    'paymentCommand.encryptedSignature': paymentConfig.encryptedSignature
  });
  
  return `${config.baseUrl}?${params.toString()}`;
}

/**
 * Získá konfiguraci platby
 * 
 * @param {string} type - Typ platby: 'package' nebo 'topAd'
 * @param {string} id - ID platby
 * @returns {Object} - Konfigurace platby
 */
function getPaymentConfig(type, id) {
  if (type === 'package') {
    return GOPAY_CONFIG.packages[id];
  } else if (type === 'topAd') {
    return GOPAY_CONFIG.topAds[id];
  }
  return null;
}

// Export pro globální použití
window.GOPAY_CONFIG = GOPAY_CONFIG;
window.createGoPayUrl = createGoPayUrl;
window.getPaymentConfig = getPaymentConfig;

