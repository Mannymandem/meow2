/***************************************************************
 * main.js - FINAL with Two Modals:
 *  1) #exchange-modal-container (addresses + deposit)
 *  2) #tracking-modal-container (exact deposit replica)
 ***************************************************************/
document.addEventListener('DOMContentLoaded', () => {

  /****************************************************
   * 0) GLOBAL CONFIG & VARIABLES
   ****************************************************/
  const BACKEND_URL = "https://meowmeow.ngrok.app"; // Your aggregator endpoint
  const defaultCrypto = "USDTBEP20";
  let isFixed = true;  // default => locked/fixed rate
  let direction = "crypto_to_xmr"; // "crypto_to_xmr" or "xmr_to_crypto"

  // aggregator cryptos
  let aggregatorCryptos = [];
  let coingeckoMap      = {};

  // Poll intervals
  let tradePollInterval = null;   // deposit step
  let trackPollInterval = null;   // tracking modal
  let countdownInterval = null;   // for 10-min countdown

  // Basic color map for network pills
  const networkColors = {
    "BTC": "#F7931A",
    "ETH": "#3C3C3D",
    "BSC": "#F0B90B",
    "XMR": "#FF6600"
  };

  /****************************************************
   * 1) FRONT-END ELEMENTS for MAIN EXCHANGE
   ****************************************************/
  // If you have fromAmountInput / toAmountInput, etc.
  const fromAmountInput       = document.getElementById('from-amount-input');
  const toAmountInput         = document.getElementById('to-amount-input');
  if (toAmountInput) toAmountInput.readOnly = true;

  const fromCurrencyButton    = document.getElementById('from-currency-select-button');
  const toCurrencyButton      = document.getElementById('to-currency-select-button');
  const fromCurrencyDropdown  = document.getElementById('from-currency-dropdown');
  const toCurrencyDropdown    = document.getElementById('to-currency-dropdown');
  const fromSearchInput       = document.getElementById('from-currency-search');
  const toSearchInput         = document.getElementById('to-currency-search');
  const switchButton          = document.getElementById('switch-button');
  const exchangeButton        = document.getElementById('exchange-button');

  // Rate toggle
  const rateToggleButton      = document.getElementById('rate-toggle-button');
  const rateStatusEl          = document.querySelector('.paragraph-2');

  // We'll hold selectedFromCurrency, selectedToCurrency
  let selectedFromCurrency = null;
  let selectedToCurrency   = "XMR";


  /****************************************************
   * 2) EXCHANGE MODAL => ADDRESSES + DEPOSIT
   ****************************************************/
  const tradeModalContainer   = document.getElementById('exchange-modal-container');
  const addressesStep         = document.getElementById('addresses-step');
  const depositStep           = document.getElementById('deposit-step');

  // Addresses step
  const addressesModalWarning = document.getElementById('addresses-modal-warning');
  const addressesConfirmBtn   = document.getElementById('addresses-confirm-btn');
  const addressesCancelBtn    = document.getElementById('addresses-cancel-btn');
  const recipientAddr         = document.getElementById('recipient-addr');
  const refundAddr            = document.getElementById('refund-addr');

  // Deposit step
  const transactionIdEl       = document.getElementById('modal-tx-id');
  const depositAddressDisplay = document.getElementById('modal-deposit-address');
  const qrcodeContainer       = document.getElementById('modal-qrcode');
  const statusText            = document.getElementById('modal-status-text');
  const confirmationsEl       = document.getElementById('modal-confirmations');
  const tradeCloseBtn         = document.getElementById('modal-close-btn');

  // “You Send” / “You Receive” fields
  const modalYouSendIcon      = document.getElementById('modal-you-send-icon');
  const modalYouSendTicker    = document.getElementById('modal-you-send-ticker');
  const modalYouSendPill      = document.getElementById('modal-you-send-pill');
  const modalYouSendAmount    = document.getElementById('modal-you-send-amount');
  const modalYouGetIcon       = document.getElementById('modal-you-get-icon');
  const modalYouGetTicker     = document.getElementById('modal-you-get-ticker');
  const modalYouGetPill       = document.getElementById('modal-you-get-pill');
  const modalYouGetAmount     = document.getElementById('modal-you-get-amount');

  // Additional warnings
  const fromWarningEl         = document.getElementById('modal-warning-from');
  const toWarningEl           = document.getElementById('network-warning-to');

  // “Recipient Address” label in deposit step
  const modalRecipientAddrEl  = document.getElementById('modal-recipient-address');


  /****************************************************
   * 3) TRACKING MODAL => EXACT REPLICA
   ****************************************************/
  const trackingModalContainer  = document.getElementById('tracking-modal-container');
  const trackLink               = document.getElementById('track-link');

  // Step 1 => aggregatorTxId
  const trackStep               = document.getElementById('track-step');
  const trackCancelBtn          = document.getElementById('track-cancel-btn');
  const trackConfirmBtn         = document.getElementById('track-confirm-btn');
  const trackTxIdInput          = document.getElementById('track-tx-id');

  // Step 2 => deposit replicate
  const trackDepositStep        = document.getElementById('track-deposit-step');

  // Fields in the replicate deposit step
  const trackModalTxIdEl        = document.getElementById('track-modal-tx-id');
  const trackModalYouSendIcon   = document.getElementById('track-modal-you-send-icon');
  const trackModalYouSendTicker = document.getElementById('track-modal-you-send-ticker');
  const trackModalYouSendPill   = document.getElementById('track-modal-you-send-pill');
  const trackModalYouSendAmount = document.getElementById('track-modal-you-send-amount');
  const trackModalYouGetIcon    = document.getElementById('track-modal-you-get-icon');
  const trackModalYouGetTicker  = document.getElementById('track-modal-you-get-ticker');
  const trackModalYouGetPill    = document.getElementById('track-modal-you-get-pill');
  const trackModalYouGetAmount  = document.getElementById('track-modal-you-get-amount');
  const trackModalDepositAddrEl = document.getElementById('track-modal-deposit-address');
  const trackModalStatusText    = document.getElementById('track-modal-status-text');
  const trackModalConfirmations = document.getElementById('track-modal-confirmations');
  const trackModalSpinner       = document.getElementById('track-modal-spinner');


  /****************************************************
   * 4) RATE TOGGLE => isFixed
   ****************************************************/
  if (rateToggleButton) {
    rateToggleButton.addEventListener('click', () => {
      isFixed = !isFixed;
      if (rateStatusEl) {
        rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
      }
      updateAmounts();
    });
  }
  if (rateStatusEl) {
    rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
  }


  /****************************************************
   * 5) 10-min Countdown for deposit
   ****************************************************/
  function startDepositCountdown() {
    const countdownTimerEl = document.getElementById('countdown-timer');
    if (!isFixed) {
      if (countdownTimerEl) countdownTimerEl.style.display = 'none';
      return;
    }
    if (countdownTimerEl) countdownTimerEl.style.display = 'block';

    const totalSeconds = 600;
    let remaining = totalSeconds;

    const minutesEl = document.getElementById('countdown-minutes');
    const secondsEl = document.getElementById('countdown-seconds');
    const fillEl    = document.getElementById('countdown-fill');
    if (!minutesEl || !secondsEl || !fillEl) return;

    fillEl.style.width = '0%';
    clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining < 0) {
        clearInterval(countdownInterval);
        alert("Time limit reached. Please restart the trade for an updated rate.");
        tradeModalContainer.style.display = 'none';
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      minutesEl.textContent = m.toString();
      secondsEl.textContent = (s < 10 ? '0' : '') + s;

      const percent = ((totalSeconds - remaining) / totalSeconds) * 100;
      fillEl.style.width = percent + '%';
    }, 1000);
  }


  /****************************************************
   * 6) aggregator error parsing
   ****************************************************/
  function parseErrorDescription(errMsg) {
    const jsonStart = errMsg.indexOf('{');
    if (jsonStart > -1) {
      const jsonStr = errMsg.slice(jsonStart);
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.description) {
          let desc = parsed.description;
          if (desc.includes("Amount does not fall within the range.")) {
            const match = desc.match(/Min:\s*([\d\.]+)/);
            if (match && match[1]) {
              return `Min Amount: ${match[1]}`;
            }
          }
          return desc;
        }
      } catch (e) {/* ignore */}
    }
    if (errMsg.includes("Pair is unavailable")) return "Pair is unavailable";
    if (errMsg.includes("Unprocessable Entity")) return "Amount not in allowed range";
    return "An error occurred";
  }


  /****************************************************
   * 7) Format ticker + network
   ****************************************************/
  function formatTickerAndNetwork(symbol, network) {
    let s   = symbol.toUpperCase();
    let net = network ? network.toUpperCase() : '';
    if (net === 'BSC' && s.endsWith('BEP20')) {
      s = s.replace('BEP20','').trim();
    }
    return { ticker: s, network: net };
  }


  /****************************************************
   * 8) RENDER CRYPTO BUTTON
   ****************************************************/
  function renderCryptoButton(buttonEl, symbol, image, network) {
    buttonEl.innerHTML = '';
    buttonEl.style.display    = 'inline-flex';
    buttonEl.style.alignItems = 'center';
    buttonEl.style.padding    = '10px';
    buttonEl.style.background = '#9002c0';
    buttonEl.style.border     = 'none';
    buttonEl.style.color      = '#fff';
    buttonEl.style.margin     = '0 8px 0 0';
    buttonEl.style.textAlign  = 'center';
    buttonEl.style.cursor     = 'pointer';
    buttonEl.style.fontWeight = 'bold';
    buttonEl.style.fontSize   = '14px';

    const fallbackImage = `https://static.simpleswap.io/images/currencies-logo/${symbol.toLowerCase()}.svg`;
    const imgSrc = (image && image.trim() !== '') ? image : fallbackImage;

    const imgEl = document.createElement('img');
    imgEl.src  = imgSrc;
    imgEl.alt  = `${symbol} logo`;
    imgEl.style.width  = '28px';
    imgEl.style.height = '28px';
    imgEl.style.marginRight = '8px';
    imgEl.style.display = 'block';

    const { ticker, network: net } = formatTickerAndNetwork(symbol, network);
    const textSpan = document.createElement('span');
    textSpan.textContent = ticker;
    textSpan.style.display = 'inline-block';
    textSpan.style.marginRight = '8px';

    buttonEl.appendChild(imgEl);
    buttonEl.appendChild(textSpan);

    if (net) {
      const netKey = net;
      const bgColor = networkColors[netKey] || '#444';
      const networkPill = document.createElement('span');
      networkPill.style.fontSize = '12px';
      networkPill.style.color = '#fff';
      networkPill.style.padding = '2px 4px';
      networkPill.style.borderRadius = '4px';
      networkPill.style.display = 'inline-block';
      networkPill.style.backgroundColor = bgColor;
      networkPill.style.width = '50px';
      networkPill.style.textAlign = 'center';
      networkPill.textContent = net;
      buttonEl.appendChild(networkPill);
    }
  }


  /****************************************************
   * 9) SETUP SEARCH for DROPDOWNS
   ****************************************************/
  function setupSearch(searchInput, dropdown) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const items = dropdown.querySelectorAll('.dropdown-item');
      items.forEach(item => {
        const textContent = item.textContent.toLowerCase();
        item.style.display = textContent.includes(query) ? 'flex' : 'none';
      });
    });
  }


  /****************************************************
   * 10) BUILD DROPDOWN ITEMS
   ****************************************************/
  function buildDropdownItems(dropdown, cryptos, onSelect) {
    // remove existing items
    const existing = dropdown.querySelectorAll('.dropdown-item');
    existing.forEach(e => e.remove());

    dropdown.style.background   = '#442244';
    dropdown.style.borderRadius = '0px';
    dropdown.style.padding      = '0';
    dropdown.style.boxShadow    = '0 2px 10px rgba(0,0,0,0.2)';
    dropdown.style.maxHeight    = '300px';
    dropdown.style.overflow     = 'hidden';
    dropdown.style.position     = 'absolute';
    dropdown.style.zIndex       = '9999';

    let searchContainer = dropdown.querySelector('.search-container');
    if (!searchContainer) {
      searchContainer = document.createElement('div');
      searchContainer.classList.add('search-container');
      searchContainer.style.position = 'sticky';
      searchContainer.style.top = '0';
      searchContainer.style.background = '#442244';
      searchContainer.style.padding = '10px';

      const searchInput = (dropdown === fromCurrencyDropdown) ? fromSearchInput : toSearchInput;
      searchContainer.appendChild(searchInput);
      searchInput.style.width       = '100%';
      searchInput.style.padding     = '8px';
      searchInput.style.borderRadius= '5px';
      searchInput.style.border      = 'none';
      searchInput.style.fontSize    = '14px';
      searchInput.style.outline     = 'none';
      searchInput.style.color       = '#000';
      searchInput.placeholder       = 'Search...';
      searchInput.style.boxSizing   = 'border-box';

      dropdown.appendChild(searchContainer);
    }

    let itemsContainer = dropdown.querySelector('.dropdown-items-container');
    if (!itemsContainer) {
      itemsContainer = document.createElement('div');
      itemsContainer.classList.add('dropdown-items-container');
      itemsContainer.style.padding = '10px';
      itemsContainer.style.overflowY = 'auto';
      itemsContainer.style.maxHeight = 'calc(300px - 60px)';
      dropdown.appendChild(itemsContainer);
    } else {
      itemsContainer.innerHTML = '';
    }

    cryptos.forEach(coin => {
      const itemEl = document.createElement('div');
      itemEl.classList.add('dropdown-item');
      itemEl.style.display        = 'flex';
      itemEl.style.alignItems     = 'center';
      itemEl.style.justifyContent = 'center';
      itemEl.style.cursor         = 'pointer';
      itemEl.style.padding        = '8px';
      itemEl.style.background     = '#333';
      itemEl.style.borderRadius   = '5px';
      itemEl.style.marginBottom   = '8px';
      itemEl.style.transition     = 'background 0.2s ease';

      itemEl.addEventListener('mouseover', () => { itemEl.style.background = '#444'; });
      itemEl.addEventListener('mouseout',  () => { itemEl.style.background = '#333'; });

      const uppercaseSymbol = coin.symbol.toUpperCase();
      const fallbackImage   = `https://static.simpleswap.io/images/currencies-logo/${coin.symbol.toLowerCase()}.svg`;
      const imgSrc          = (coin.image && coin.image.trim() !== '') ? coin.image : fallbackImage;

      const imgEl = document.createElement('img');
      imgEl.src  = imgSrc;
      imgEl.alt  = `${coin.symbol} logo`;
      imgEl.style.width       = '24px';
      imgEl.style.height      = '24px';
      imgEl.style.marginRight = '8px';
      imgEl.style.display     = 'block';

      const infoDiv = document.createElement('div');
      infoDiv.style.display       = 'flex';
      infoDiv.style.flexDirection = 'column';
      infoDiv.style.alignItems    = 'center';

      const symbolSpan = document.createElement('span');
      symbolSpan.style.fontWeight = 'bold';
      symbolSpan.style.fontSize   = '14px';
      symbolSpan.style.color      = '#fff';
      symbolSpan.textContent      = uppercaseSymbol;

      const nameSpan = document.createElement('span');
      nameSpan.style.fontSize   = '12px';
      nameSpan.style.color      = '#ddd';
      nameSpan.style.marginTop  = '2px';
      nameSpan.textContent      = coin.name || '';

      const netKey   = (coin.network || coin.symbol).toUpperCase();
      const networkDiv = document.createElement('div');
      networkDiv.style.fontSize        = '10px';
      networkDiv.style.color           = '#fff';
      networkDiv.style.padding         = '2px 4px';
      networkDiv.style.borderRadius    = '4px';
      networkDiv.style.marginTop       = '4px';
      networkDiv.style.display         = 'inline-block';
      networkDiv.style.backgroundColor = networkColors[netKey] || '#444';
      networkDiv.style.width           = '40px';
      networkDiv.style.textAlign       = 'center';
      networkDiv.textContent           = coin.network ? coin.network.toUpperCase() : coin.symbol;

      infoDiv.appendChild(symbolSpan);
      infoDiv.appendChild(nameSpan);
      infoDiv.appendChild(networkDiv);

      itemEl.appendChild(imgEl);
      itemEl.appendChild(infoDiv);

      itemEl.addEventListener('click', () => {
        onSelect(coin);
        dropdown.style.display = 'none';
      });

      itemsContainer.appendChild(itemEl);
    });
  }


  /****************************************************
   * 11) UPDATE UI AFTER DIRECTION CHANGE
   ****************************************************/
  function updateUIAfterDirectionChange() {
    if (direction === "crypto_to_xmr") {
      let fromCoin = aggregatorCryptos.find(c => c.symbol === selectedFromCurrency);
      if (!fromCoin) {
        selectedFromCurrency = defaultCrypto;
        fromCoin = aggregatorCryptos.find(c => c.symbol === defaultCrypto);
      }
      renderCryptoButton(fromCurrencyButton, fromCoin.symbol, fromCoin.image, fromCoin.network);

      let xmrCoin = aggregatorCryptos.find(c => c.symbol === "XMR");
      if (!xmrCoin) xmrCoin = { symbol:"XMR", image:"", network:"xmr" };
      renderCryptoButton(toCurrencyButton, xmrCoin.symbol, xmrCoin.image, xmrCoin.network);

      toCurrencyButton.style.pointerEvents   = 'none';
      fromCurrencyButton.style.pointerEvents = 'auto';
    } else {
      let xmrCoin = aggregatorCryptos.find(c => c.symbol === "XMR");
      if (!xmrCoin) xmrCoin = { symbol:"XMR", image:"", network:"xmr" };
      renderCryptoButton(fromCurrencyButton, xmrCoin.symbol, xmrCoin.image, xmrCoin.network);

      let toCoin = aggregatorCryptos.find(c => c.symbol === selectedToCurrency);
      if (!toCoin) {
        selectedToCurrency = defaultCrypto;
        toCoin = aggregatorCryptos.find(c => c.symbol === defaultCrypto);
      }
      renderCryptoButton(toCurrencyButton, toCoin.symbol, toCoin.image, toCoin.network);

      fromCurrencyButton.style.pointerEvents = 'none';
      toCurrencyButton.style.pointerEvents   = 'auto';
    }
    updateWarnings();
  }


  /****************************************************
   * 12) aggregator warnings
   ****************************************************/
  async function fetchWarnings(symbol) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/get_currency?symbol=${symbol.toLowerCase()}`);
      const d = await r.json();
      const net = d.network || "";
      if (!net) return "";
      const netKey = net.toUpperCase();
      const bgColor = networkColors[netKey] || '#444';
      return `Please note that ${symbol.toUpperCase()} must be sent on the 
        <span style="display:inline-block;padding:2px 4px;border-radius:4px;background-color:${bgColor};color:#fff;">
        ${netKey}</span> network!`;
    } catch (err) {
      console.error("Error fetching currency network:", err);
      return "";
    }
  }
  function updateWarnings() {
    if (fromWarningEl) {
      fromWarningEl.style.display = 'none';
      fromWarningEl.innerHTML     = "";
    }
    if (toWarningEl) {
      toWarningEl.style.display = 'none';
      toWarningEl.innerHTML     = "";
    }

    let fromCur, toCur;
    if (direction === "crypto_to_xmr") {
      fromCur = selectedFromCurrency;
      toCur   = "XMR";
    } else {
      fromCur = "XMR";
      toCur   = selectedToCurrency;
    }
    if (!fromCur || !toCur) return;

    Promise.all([fetchWarnings(fromCur), fetchWarnings(toCur)])
      .then(([fromWarn, toWarn]) => {
        if (fromWarn && fromWarningEl) {
          fromWarningEl.style.display = 'block';
          fromWarningEl.innerHTML = fromWarn;
          fromWarningEl.style.color = '#ffb700';
        }
        if (toWarn && toWarningEl) {
          toWarningEl.style.display = 'block';
          toWarningEl.innerHTML = toWarn;
          toWarningEl.style.color = '#ffb700';
        }
      })
      .catch(err => console.error("Error in updateWarnings:", err));
  }


  /****************************************************
   * 13) UPDATE "YOU GET" in real-time
   ****************************************************/
  function updateAmounts() {
    const fromAmount = parseFloat(fromAmountInput?.value || "0");
    if (!fromAmount) {
      if (toAmountInput) toAmountInput.value = "--";
      return;
    }

    let fromCur, toCur;
    if (direction === "crypto_to_xmr") {
      fromCur = selectedFromCurrency;
      toCur   = "xmr";
    } else {
      fromCur = "xmr";
      toCur   = selectedToCurrency;
    }
    if (!fromCur || !toCur) {
      if (toAmountInput) toAmountInput.value = "--";
      return;
    }

    const url = `${BACKEND_URL}/api/exchange-estimate?from_currency=${fromCur.toLowerCase()}&to_currency=${toCur.toLowerCase()}&from_amount=${fromAmount}&is_fixed=${isFixed}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          if (toAmountInput) toAmountInput.value = parseErrorDescription(data.error);
          return;
        }
        if (toAmountInput) {
          toAmountInput.value = data.to_amount.toFixed(6);
        }
      })
      .catch(err => {
        console.error("Error fetching estimate:", err);
        if (toAmountInput) toAmountInput.value = "Error";
      });
  }


  /****************************************************
   * 14) "EXCHANGE" => show addresses step
   ****************************************************/
  if (exchangeButton) {
    exchangeButton.addEventListener('click', () => {
      const fromAmount = parseFloat(fromAmountInput?.value || "0");
      if (!fromAmount) {
        alert("Please enter an amount first.");
        return;
      }

      let fromCur, toCur;
      if (direction === "crypto_to_xmr") {
        fromCur = selectedFromCurrency;
        toCur   = "xmr";
        if (!fromCur) {
          alert("Please select a crypto first.");
          return;
        }
      } else {
        fromCur = "xmr";
        toCur   = selectedToCurrency;
        if (!toCur) {
          alert("Please select a crypto first.");
          return;
        }
      }

      // show addresses step
      if (tradeModalContainer) tradeModalContainer.style.display = 'flex';
      if (addressesStep) addressesStep.style.display = 'block';
      if (depositStep)   depositStep.style.display   = 'none';

      if (addressesModalWarning) addressesModalWarning.textContent = "";
      if (recipientAddr) recipientAddr.value = "";
      if (refundAddr)    refundAddr.value    = "";
    });
  }

  // CANCEL => close addresses
  if (addressesCancelBtn) {
    addressesCancelBtn.addEventListener('click', () => {
      if (tradeModalContainer) tradeModalContainer.style.display = 'none';
    });
  }


  /****************************************************
   * 15) CONFIRM ADDRESSES => CREATE EXCHANGE
   ****************************************************/
  if (addressesConfirmBtn) {
    addressesConfirmBtn.addEventListener('click', () => {
      const fromAmount = parseFloat(fromAmountInput?.value || "0");
      let fromCur, toCur;
      if (direction === "crypto_to_xmr") {
        fromCur = selectedFromCurrency;
        toCur   = "xmr";
      } else {
        fromCur = "xmr";
        toCur   = selectedToCurrency;
      }

      const addressInput = recipientAddr?.value.trim() || "";
      const refundInput  = refundAddr?.value.trim()  || "";
      if (!addressInput) {
        alert(`${toCur.toUpperCase()} address is required.`);
        return;
      }

      if (addressesStep) addressesStep.style.display = 'none';

      const payload = {
        from_currency: fromCur,
        to_currency: toCur,
        from_amount: fromAmount,
        address_to: addressInput,
        user_refund_address: refundInput,
        is_fixed: isFixed
      };

      fetch(`${BACKEND_URL}/api/create_exchange?api_key=YOUR_API_KEY`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert("Error creating exchange: " + data.error);
          return;
        }
        // show deposit step
        if (depositStep) depositStep.style.display = 'block';

        const aggregatorTxId = data.aggregator_tx_id || "";
        if (transactionIdEl) {
          transactionIdEl.textContent = aggregatorTxId;
        }
        if (depositAddressDisplay) {
          depositAddressDisplay.textContent = data.deposit_address || "--";
        }

        // fill "You Send"
        const fromCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === fromCur.toUpperCase());
        if (fromCoinData) {
          const fallbackSendImg = `https://static.simpleswap.io/images/currencies-logo/${fromCoinData.symbol.toLowerCase()}.svg`;
          modalYouSendIcon.src   = (fromCoinData.image && fromCoinData.image.trim() !== '') 
                                    ? fromCoinData.image 
                                    : fallbackSendImg;
          modalYouSendTicker.textContent = fromCoinData.symbol.toUpperCase();
          const netKey = (fromCoinData.network || fromCoinData.symbol).toUpperCase();
          modalYouSendPill.textContent = netKey;
          modalYouSendPill.style.backgroundColor = networkColors[netKey] || '#444';
        }
        modalYouSendAmount.textContent = fromAmount.toString();

        // fill "You Receive"
        const toCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === toCur.toUpperCase());
        if (toCoinData && data.to_amount) {
          const fallbackGetImg = `https://static.simpleswap.io/images/currencies-logo/${toCoinData.symbol.toLowerCase()}.svg`;
          modalYouGetIcon.src = (toCoinData.image && toCoinData.image.trim() !== '') 
                                  ? toCoinData.image 
                                  : fallbackGetImg;
          modalYouGetTicker.textContent = toCoinData.symbol.toUpperCase();
          const netKey2 = (toCoinData.network || toCoinData.symbol).toUpperCase();
          modalYouGetPill.textContent = netKey2;
          modalYouGetPill.style.backgroundColor = networkColors[netKey2] || '#444';
          modalYouGetAmount.textContent = data.to_amount.toString();
        }

        // generate QR
        if (qrcodeContainer && data.deposit_address) {
          qrcodeContainer.innerHTML = "";
          new QRCode(qrcodeContainer, {
            text: data.deposit_address,
            width: 128,
            height:128
          });
        }

        // fill recipient address label
        if (modalRecipientAddrEl) {
          modalRecipientAddrEl.textContent = addressInput || "--";
        }

        // poll aggregator status
        pollTransactionStatus(aggregatorTxId);
        startDepositCountdown();
      })
      .catch(err => {
        console.error("Error create_exchange:", err);
        alert("Failed to create exchange.");
      });
    });
  }


  /****************************************************
   * 16) aggregator polling => deposit step
   ****************************************************/
  function pollTransactionStatus(aggregatorTxId) {
    // clear old
    if (tradePollInterval) {
      clearInterval(tradePollInterval);
      tradePollInterval = null;
    }

    tradePollInterval = setInterval(() => {
      fetch(`${BACKEND_URL}/api/status/${aggregatorTxId}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            statusText.textContent = `Error: ${data.error}`;
            clearInterval(tradePollInterval);
            tradePollInterval = null;
            return;
          }

          // clear old classes
          statusText.className = '';
          confirmationsEl.textContent = '';

          // spinner
          const spinnerEl = document.getElementById('modal-spinner');
          if (spinnerEl) spinnerEl.style.display = 'none';

          switch (data.status) {
            case 'waiting':
            case 'confirming':
            case 'exchanging':
            case 'sending':
              if (spinnerEl) spinnerEl.style.display = 'block';
              break;
            default:
              if (spinnerEl) spinnerEl.style.display = 'none';
          }

          switch (data.status) {
            case 'waiting':
              statusText.classList.add('status-waiting');
              statusText.textContent = "Awaiting Deposit";
              break;
            case 'confirming':
              statusText.classList.add('status-confirming');
              statusText.textContent = "Confirming";
              if (data.confirmations !== undefined && data.required_confirmations !== undefined) {
                confirmationsEl.textContent = 
                  `Confirmations: ${data.confirmations}/${data.required_confirmations}`;
              }
              break;
            case 'exchanging':
              statusText.classList.add('status-exchanging');
              statusText.textContent = "Exchanging";
              break;
            case 'sending':
              statusText.classList.add('status-sending');
              statusText.textContent = "Sending";
              if (data.confirmations !== undefined && data.required_confirmations !== undefined) {
                confirmationsEl.textContent = 
                  `Confirmations: ${data.confirmations}/${data.required_confirmations}`;
              }
              break;
            case 'finished':
              statusText.classList.add('status-finished');
              statusText.textContent = "Finished";
              clearInterval(tradePollInterval);
              tradePollInterval = null;
              break;
            default:
              statusText.textContent = "Unknown Status";
              clearInterval(tradePollInterval);
              tradePollInterval = null;
          }

          // if no longer waiting, kill countdown
          if (data.status !== 'waiting') {
            if (countdownInterval) {
              clearInterval(countdownInterval);
              countdownInterval = null;
            }
          }
        })
        .catch(err => {
          console.error("pollTransactionStatus error:", err);
          if (tradePollInterval) {
            clearInterval(tradePollInterval);
            tradePollInterval = null;
          }
        });
    }, 5000);
  }


  /****************************************************
   * 17) SWITCH => crypto_to_xmr or xmr_to_crypto
   ****************************************************/
  if (switchButton) {
    switchButton.addEventListener('click', () => {
      const oldDir = direction;
      direction = (direction === "crypto_to_xmr") ? "xmr_to_crypto" : "crypto_to_xmr";

      if (oldDir === "crypto_to_xmr" && direction === "xmr_to_crypto") {
        let temp = selectedFromCurrency;
        selectedFromCurrency = "XMR";
        selectedToCurrency   = temp;
      } else if (oldDir === "xmr_to_crypto" && direction === "crypto_to_xmr") {
        let temp = selectedToCurrency;
        selectedToCurrency   = "XMR";
        selectedFromCurrency = temp;
      }

      updateUIAfterDirectionChange();
      updateAmounts();
    });
  }


  /****************************************************
   * 18) Show/hide currency dropdown
   ****************************************************/
  if (fromCurrencyButton) {
    fromCurrencyButton.addEventListener('click', () => {
      if (direction === "crypto_to_xmr") {
        fromCurrencyDropdown.style.display = 
          (fromCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
      }
    });
  }
  if (toCurrencyButton) {
    toCurrencyButton.addEventListener('click', () => {
      if (direction === "xmr_to_crypto") {
        toCurrencyDropdown.style.display = 
          (toCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
      }
    });
  }

  document.addEventListener('click', (ev) => {
    if (fromCurrencyDropdown && !fromCurrencyDropdown.contains(ev.target) && !fromCurrencyButton.contains(ev.target)) {
      fromCurrencyDropdown.style.display = 'none';
    }
    if (toCurrencyDropdown && !toCurrencyDropdown.contains(ev.target) && !toCurrencyButton.contains(ev.target)) {
      toCurrencyDropdown.style.display = 'none';
    }
  });


  /****************************************************
   * 19) LOAD aggregator cryptos => fill dropdown
   ****************************************************/
  function initializeDropdowns() {
    buildDropdownItems(fromCurrencyDropdown, aggregatorCryptos, (coin) => {
      selectedFromCurrency = coin.symbol;
      updateUIAfterDirectionChange();
      updateAmounts();
    });
    buildDropdownItems(toCurrencyDropdown, aggregatorCryptos, (coin) => {
      selectedToCurrency = coin.symbol;
      updateUIAfterDirectionChange();
      updateAmounts();
    });
  }

  if (fromAmountInput) {
    fromAmountInput.addEventListener('input', updateAmounts);
  }

  // fetch cryptos, then coingecko
  fetch(`${BACKEND_URL}/api/all_cryptos`)
    .then(r => r.json())
    .then(cryptos => {
      aggregatorCryptos     = cryptos;
      selectedFromCurrency  = defaultCrypto;
      selectedToCurrency    = "XMR";
      if (fromAmountInput) fromAmountInput.value = 100;

      return fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd');
    })
    .then(r => r.json())
    .then(data => {
      data.forEach(coin => {
        const ticker = coin.symbol.toUpperCase();
        if (coin.image) coingeckoMap[ticker] = coin.image;
      });
      initializeDropdowns();
      updateUIAfterDirectionChange();
      updateAmounts();

      // auto-refresh "You Get" every 10s
      setInterval(() => {
        updateAmounts();
      }, 10000);
    })
    .catch(err => console.error("Error fetching aggregator cryptos/logos:", err));


  /****************************************************
   * 20) TRACKING MODAL => EXACT REPLICA
   ****************************************************/

  // Show tracking modal => aggregatorTxId step
  if (trackLink && trackingModalContainer) {
    trackLink.addEventListener('click', (ev) => {
      ev.preventDefault();
      trackingModalContainer.style.display = 'flex';

      // Show aggregatorTxId input => #track-step
      // Hide deposit replicate => #track-deposit-step
      if (trackStep) trackStep.style.display        = 'block';
      if (trackDepositStep) trackDepositStep.style.display = 'none';

      // Clear aggregatorTxId
      if (trackTxIdInput) trackTxIdInput.value = "";
      resetTrackingDeposit();
    });
  }

  // Cancel => close
  if (trackCancelBtn) {
    trackCancelBtn.addEventListener('click', () => {
      trackingModalContainer.style.display = 'none';
      resetTrackingDeposit();
    });
  }

  // Confirm => aggregatorTxId => show deposit replicate
  if (trackConfirmBtn) {
    trackConfirmBtn.addEventListener('click', () => {
      const aggregatorTxId = trackTxIdInput?.value.trim() || "";
      if (!aggregatorTxId) {
        alert("Please enter a valid aggregatorTxId!");
        return;
      }
      // Hide aggregatorTxId input
      if (trackStep) trackStep.style.display = 'none';
      // Show deposit replicate
      if (trackDepositStep) trackDepositStep.style.display = 'block';

      // fill aggregatorTxId in #track-modal-tx-id
      if (trackModalTxIdEl) trackModalTxIdEl.textContent = aggregatorTxId;

      // Now poll aggregator => fill track deposit fields
      pollTrackingStatus(aggregatorTxId);
    });
  }

  function resetTrackingDeposit() {
    // clear old poll
    if (trackPollInterval) {
      clearInterval(trackPollInterval);
      trackPollInterval = null;
    }
    // reset fields
    if (trackModalTxIdEl)        trackModalTxIdEl.textContent        = "--";
    if (trackModalYouSendIcon)   trackModalYouSendIcon.src           = "";
    if (trackModalYouSendTicker) trackModalYouSendTicker.textContent = "---";
    if (trackModalYouSendPill) {
      trackModalYouSendPill.textContent = "---";
      trackModalYouSendPill.style.backgroundColor = "#777";
    }
    if (trackModalYouSendAmount) trackModalYouSendAmount.textContent = "--";

    if (trackModalYouGetIcon)    trackModalYouGetIcon.src           = "";
    if (trackModalYouGetTicker)  trackModalYouGetTicker.textContent = "---";
    if (trackModalYouGetPill) {
      trackModalYouGetPill.textContent = "---";
      trackModalYouGetPill.style.backgroundColor = "#777";
    }
    if (trackModalYouGetAmount)  trackModalYouGetAmount.textContent = "--";

    if (trackModalDepositAddrEl) trackModalDepositAddrEl.textContent = "--";

    if (trackModalStatusText) {
      trackModalStatusText.textContent = "Awaiting Deposit";
      trackModalStatusText.className   = ""; // clear old
      trackModalStatusText.classList.add('status-waiting');
    }
    if (trackModalConfirmations) trackModalConfirmations.textContent = "";
    if (trackModalSpinner) trackModalSpinner.style.display = 'none';
  }

  function showTrackSpinner() {
    if (trackModalSpinner) trackModalSpinner.style.display = 'block';
  }
  function hideTrackSpinner() {
    if (trackModalSpinner) trackModalSpinner.style.display = 'none';
  }

  // poll aggregator => fill track deposit step
  function pollTrackingStatus(aggregatorTxId) {
    // clear old
    if (trackPollInterval) {
      clearInterval(trackPollInterval);
      trackPollInterval = null;
    }

    // fetch once, then every 5s
    fetchAndUpdateTrack(aggregatorTxId);
    trackPollInterval = setInterval(() => {
      fetchAndUpdateTrack(aggregatorTxId);
    }, 5000);
  }

  function fetchAndUpdateTrack(aggregatorTxId) {
    const url = `${BACKEND_URL}/api/status/${aggregatorTxId}`;
    showTrackSpinner();

    fetch(url)
      .then(r => r.json())
      .then(data => {
        hideTrackSpinner();
        if (data.error) {
          trackModalStatusText.textContent = `Error: ${data.error}`;
          trackModalStatusText.className   = "";
          trackModalConfirmations.textContent = "";
          if (trackPollInterval) {
            clearInterval(trackPollInterval);
            trackPollInterval = null;
          }
          return;
        }

        // fill fields => trackModalYouSendAmount, trackModalDepositAddrEl, etc.
        // e.g. data.amount_from, data.amount_to, data.address_to, data.currency_from, currency_to, etc.
        if (data.currency_from && trackModalYouSendTicker) {
          trackModalYouSendTicker.textContent = data.currency_from.toUpperCase();
        }
        if (data.amount_from && trackModalYouSendAmount) {
          trackModalYouSendAmount.textContent = data.amount_from.toString();
        }
        if (data.currency_to && trackModalYouGetTicker) {
          trackModalYouGetTicker.textContent = data.currency_to.toUpperCase();
        }
        if (data.amount_to && trackModalYouGetAmount) {
          trackModalYouGetAmount.textContent = data.amount_to.toString();
        }
        if (data.address_to && trackModalDepositAddrEl) {
          trackModalDepositAddrEl.textContent = data.address_to;
        }

        // color-coded statuses
        trackModalStatusText.className = "";
        trackModalConfirmations.textContent = "";

        switch (data.status) {
          case 'waiting':
            trackModalStatusText.classList.add('status-waiting');
            trackModalStatusText.textContent = "Awaiting Deposit";
            break;
          case 'confirming':
            trackModalStatusText.classList.add('status-confirming');
            trackModalStatusText.textContent = "Confirming";
            if (data.confirmations !== undefined && data.required_confirmations !== undefined) {
              trackModalConfirmations.textContent = 
                `Confirmations: ${data.confirmations}/${data.required_confirmations}`;
            }
            break;
          case 'exchanging':
            trackModalStatusText.classList.add('status-exchanging');
            trackModalStatusText.textContent = "Exchanging";
            break;
          case 'sending':
            trackModalStatusText.classList.add('status-sending');
            trackModalStatusText.textContent = "Sending";
            if (data.confirmations !== undefined && data.required_confirmations !== undefined) {
              trackModalConfirmations.textContent = 
                `Confirmations: ${data.confirmations}/${data.required_confirmations}`;
            }
            break;
          case 'finished':
            trackModalStatusText.classList.add('status-finished');
            trackModalStatusText.textContent = "Finished";
            if (trackPollInterval) {
              clearInterval(trackPollInterval);
              trackPollInterval = null;
            }
            break;
          default:
            trackModalStatusText.textContent = "Unknown Status";
            if (trackPollInterval) {
              clearInterval(trackPollInterval);
              trackPollInterval = null;
            }
        }
      })
      .catch(err => {
        console.error("pollTrackingStatus error:", err);
        trackModalStatusText.textContent = "Error fetching aggregator status!";
        hideTrackSpinner();
        if (trackPollInterval) {
          clearInterval(trackPollInterval);
          trackPollInterval = null;
        }
      });
  }


  /****************************************************
   * 21) CLOSE => deposit step
   ****************************************************/
  if (tradeCloseBtn && tradeModalContainer) {
    tradeCloseBtn.addEventListener('click', () => {
      tradeModalContainer.style.display = 'none';
    });
  }

}); // end DOMContentLoaded
