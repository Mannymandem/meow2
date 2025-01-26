document.addEventListener('DOMContentLoaded', () => {

  /****************************************************
   * 0) GLOBAL CONFIG & VARIABLES
   ****************************************************/
  const BACKEND_URL = "https://meowmeow.ngrok.app"; // Adjust to your server
  const defaultCrypto = "USDTBEP20";
  let isFixed = true;  // default => locked/fixed rate
  let direction = "crypto_to_xmr"; // "crypto_to_xmr" or "xmr_to_crypto"

  // For aggregator cryptos
  let aggregatorCryptos = [];
  let coingeckoMap = {};

  // For polling intervals
  let tradePollInterval   = null; // for the trade modal
  let trackPollInterval   = null; // for the tracking modal
  let countdownInterval   = null; // 10-min countdown for fixed swaps

  // A simple color map for network pills
  const networkColors = {
    "BTC": "#F7931A",
    "ETH": "#3C3C3D",
    "BSC": "#F0B90B",
    "XMR": "#FF6600"
  };


  /****************************************************
   * 1) ELEMENTS FOR THE TRADING WINDOW (front-end)
   ****************************************************/
  const fromAmountInput    = document.getElementById('from-amount-input');
  const toAmountInput      = document.getElementById('to-amount-input');
  if (toAmountInput) toAmountInput.readOnly = true;

  const fromCurrencyButton = document.getElementById('from-currency-select-button');
  const toCurrencyButton   = document.getElementById('to-currency-select-button');
  const fromCurrencyDropdown = document.getElementById('from-currency-dropdown');
  const toCurrencyDropdown   = document.getElementById('to-currency-dropdown');
  const fromSearchInput      = document.getElementById('from-currency-search');
  const toSearchInput        = document.getElementById('to-currency-search');
  const switchButton         = document.getElementById('switch-button');
  const exchangeButton       = document.getElementById('exchange-button');

  // Rate toggle
  const rateToggleButton    = document.getElementById('rate-toggle-button');
  const rateStatusEl        = document.querySelector('.paragraph-2');

  /****************************************************
   * 2) TRADE MODAL: #exchange-modal-container
   ****************************************************/
  const tradeModalContainer  = document.getElementById('exchange-modal-container');
  const addressesStep        = document.getElementById('addresses-step');
  const depositStep          = document.getElementById('deposit-step');

  // Addresses step
  const addressesModalWarning = document.getElementById('addresses-modal-warning');
  const addressesConfirmBtn    = document.getElementById('addresses-confirm-btn');
  const recipientAddr          = document.getElementById('recipient-addr');
  const refundAddr             = document.getElementById('refund-addr');
  const addressesCancelBtn     = document.getElementById('addresses-cancel-btn');

  // Deposit step
  const transactionIdEl       = document.getElementById('modal-tx-id');
  const depositAddressDisplay = document.getElementById('modal-deposit-address');
  const qrcodeContainer       = document.getElementById('modal-qrcode');
  const statusText            = document.getElementById('modal-status-text');
  const confirmationsEl       = document.getElementById('modal-confirmations');
  const tradeCloseBtn         = document.getElementById('modal-close-btn');

  // "You Send" / "You Receive" fields in trade deposit step
  const modalYouSendIcon   = document.getElementById('modal-you-send-icon');
  const modalYouSendTicker = document.getElementById('modal-you-send-ticker');
  const modalYouSendPill   = document.getElementById('modal-you-send-pill');
  const modalYouSendAmount = document.getElementById('modal-you-send-amount');

  const modalYouGetIcon    = document.getElementById('modal-you-get-icon');
  const modalYouGetTicker  = document.getElementById('modal-you-get-ticker');
  const modalYouGetPill    = document.getElementById('modal-you-get-pill');
  const modalYouGetAmount  = document.getElementById('modal-you-get-amount');

  // Additional warnings
  const fromWarningEl = document.getElementById('modal-warning-from');
  const toWarningEl   = document.getElementById('network-warning-to');


  /****************************************************
   * 3) TRACKING MODAL: #tracking-modal-container
   ****************************************************/
  const trackingModalContainer   = document.getElementById('tracking-modal-container');
  const trackingModalCloseBtn    = document.getElementById('tracking-modal-close-btn');

  // Fields inside the tracking modal => deposit address, recipient address, aggregatorTxId, etc.
  // e.g.:
  const trackModalTxIdEl          = document.getElementById('track-modal-tx-id');
  const trackModalDepositAddrEl   = document.getElementById('track-modal-deposit-address');
  const trackModalRecipientAddrEl = document.getElementById('track-modal-recipient-address');
  const trackModalStatusText      = document.getElementById('track-modal-status-text');
  const trackModalConfirmations   = document.getElementById('track-modal-confirmations');
  const trackModalSpinner         = document.getElementById('track-modal-spinner');
  const trackModalYouSendIcon     = document.getElementById('track-modal-you-send-icon');
  const trackModalYouSendTicker   = document.getElementById('track-modal-you-send-ticker');
  const trackModalYouSendPill     = document.getElementById('track-modal-you-send-pill');
  const trackModalYouSendAmount   = document.getElementById('track-modal-you-send-amount');
  const trackModalYouGetIcon      = document.getElementById('track-modal-you-get-icon');
  const trackModalYouGetTicker    = document.getElementById('track-modal-you-get-ticker');
  const trackModalYouGetPill      = document.getElementById('track-modal-you-get-pill');
  const trackModalYouGetAmount    = document.getElementById('track-modal-you-get-amount');
  const trackModalQrcodeEl        = document.getElementById('track-modal-qrcode'); // if needed

  // Possibly a #track-link user can press to open the tracking modal
  const trackLink = document.getElementById('track-link');


  /****************************************************
   * 4) GENERAL UTILITY: CLEARING + RESETS
   ****************************************************/
  // Clears data in trade modal steps (addresses + deposit)
  function resetTradeModal() {
    // Hide container
    tradeModalContainer.style.display = 'none';

    // Hide steps
    addressesStep.style.display = 'none';
    depositStep.style.display   = 'none';

    // Stop intervals
    if (tradePollInterval) {
      clearInterval(tradePollInterval);
      tradePollInterval = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Clear addresses step fields
    if (addressesModalWarning) addressesModalWarning.textContent = "";
    if (recipientAddr) recipientAddr.value = "";
    if (refundAddr)    refundAddr.value   = "";

    // Clear deposit step fields
    if (transactionIdEl) transactionIdEl.textContent = "--";
    if (depositAddressDisplay) depositAddressDisplay.textContent = "--";
    if (qrcodeContainer) qrcodeContainer.innerHTML = "";

    if (statusText) {
      statusText.textContent = "Awaiting Deposit";
      statusText.className   = 'status-waiting';
    }
    if (confirmationsEl) confirmationsEl.textContent = "";

    if (modalYouSendIcon)   modalYouSendIcon.src = "";
    if (modalYouSendTicker) modalYouSendTicker.textContent = "---";
    if (modalYouSendPill) {
      modalYouSendPill.textContent = "---";
      modalYouSendPill.style.backgroundColor = '#777';
    }
    if (modalYouSendAmount) modalYouSendAmount.textContent = "--";

    if (modalYouGetIcon)    modalYouGetIcon.src = "";
    if (modalYouGetTicker)  modalYouGetTicker.textContent = "---";
    if (modalYouGetPill) {
      modalYouGetPill.textContent = "---";
      modalYouGetPill.style.backgroundColor = '#777';
    }
    if (modalYouGetAmount)  modalYouGetAmount.textContent = "--";

    // Hide spinner
    const spinnerEl = document.getElementById('modal-spinner');
    if (spinnerEl) spinnerEl.style.display = 'none';
  }

  // Clears data in tracking modal
  function resetTrackingModal() {
    // Hide container
    trackingModalContainer.style.display = 'none';

    // Stop tracking poll
    if (trackPollInterval) {
      clearInterval(trackPollInterval);
      trackPollInterval = null;
    }

    // Clear fields
    if (trackModalTxIdEl) trackModalTxIdEl.textContent = "--";
    if (trackModalDepositAddrEl) trackModalDepositAddrEl.textContent = "--";
    if (trackModalRecipientAddrEl) trackModalRecipientAddrEl.textContent = "--";

    if (trackModalYouSendIcon) trackModalYouSendIcon.src = "";
    if (trackModalYouSendTicker) trackModalYouSendTicker.textContent = "---";
    if (trackModalYouSendPill) {
      trackModalYouSendPill.textContent = "---";
      trackModalYouSendPill.style.backgroundColor = '#777';
    }
    if (trackModalYouSendAmount) trackModalYouSendAmount.textContent = "--";

    if (trackModalYouGetIcon) trackModalYouGetIcon.src = "";
    if (trackModalYouGetTicker) trackModalYouGetTicker.textContent = "---";
    if (trackModalYouGetPill) {
      trackModalYouGetPill.textContent = "---";
      trackModalYouGetPill.style.backgroundColor = '#777';
    }
    if (trackModalYouGetAmount) trackModalYouGetAmount.textContent = "--";

    if (trackModalQrcodeEl) trackModalQrcodeEl.innerHTML = "";

    if (trackModalStatusText) {
      trackModalStatusText.textContent = "Awaiting Deposit";
      trackModalStatusText.className   = 'status-waiting';
    }
    if (trackModalConfirmations) trackModalConfirmations.textContent = "";

    if (trackModalSpinner) trackModalSpinner.style.display = 'none';
  }


  /****************************************************
   * 5) EVENT: RATE TOGGLE => isFixed true/false
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
   * 6) 10-min countdown for the trade deposit step
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
        resetTradeModal();
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
   * 7) aggregator error parsing
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
      } catch (e) {
        // ignore
      }
    }
    if (errMsg.includes("Pair is unavailable")) return "Pair is unavailable";
    if (errMsg.includes("Unprocessable Entity")) return "Amount not in allowed range";
    return "An error occurred";
  }


  /****************************************************
   * 8) Format ticker & network
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
   * 9) Renders the currency button
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
    imgEl.src = imgSrc;
    imgEl.alt = `${symbol} logo`;
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
   * 10) Searching in dropdown
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
   * 11) Build dropdown items
   ****************************************************/
  function buildDropdownItems(dropdown, cryptos, onSelect) {
    const existingItems = dropdown.querySelectorAll('.dropdown-item');
    existingItems.forEach(i => i.remove());

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
      searchInput.placeholder       = "Search...";
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
      itemEl.style.display         = 'flex';
      itemEl.style.alignItems      = 'center';
      itemEl.style.justifyContent  = 'center';
      itemEl.style.cursor          = 'pointer';
      itemEl.style.padding         = '8px';
      itemEl.style.background      = '#333';
      itemEl.style.borderRadius    = '5px';
      itemEl.style.marginBottom    = '8px';
      itemEl.style.transition      = 'background 0.2s ease';

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
      infoDiv.style.display        = 'flex';
      infoDiv.style.flexDirection  = 'column';
      infoDiv.style.alignItems     = 'center';

      const symbolSpan = document.createElement('span');
      symbolSpan.style.fontWeight   = 'bold';
      symbolSpan.style.fontSize     = '14px';
      symbolSpan.style.color        = '#fff';
      symbolSpan.textContent        = uppercaseSymbol;

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
   * 12) updateUIAfterDirectionChange => from->XMR or XMR->to
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
      if (!xmrCoin) xmrCoin = { symbol: "XMR", image: "", network: "xmr" };
      renderCryptoButton(toCurrencyButton, xmrCoin.symbol, xmrCoin.image, xmrCoin.network);

      toCurrencyButton.style.pointerEvents   = 'none';
      fromCurrencyButton.style.pointerEvents = 'auto';
    } else {
      let xmrCoin = aggregatorCryptos.find(c => c.symbol === "XMR");
      if (!xmrCoin) xmrCoin = { symbol: "XMR", image: "", network: "xmr" };
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
   * 13) aggregator warnings
   ****************************************************/
  async function fetchWarnings(symbol) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/get_currency?symbol=${symbol.toLowerCase()}`);
      const d = await r.json();
      const net = d.network || "";
      if (!net) return "";
      const netKey = net.toUpperCase();
      const bgColor = networkColors[netKey] || "#444";
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
      .then(([fromFallback, toFallback]) => {
        if (fromFallback && fromWarningEl) {
          fromWarningEl.style.display = 'block';
          fromWarningEl.innerHTML     = fromFallback;
          fromWarningEl.style.color   = '#ffb700';
        }
        if (toFallback && toWarningEl) {
          toWarningEl.style.display = 'block';
          toWarningEl.innerHTML     = toFallback;
          toWarningEl.style.color   = '#ffb700';
        }
      })
      .catch(err => console.error("Error in updateWarnings:", err));
  }


  /****************************************************
   * 14) Update "You Get" amount in real-time
   ****************************************************/
  function updateAmounts() {
    const fromAmount = parseFloat(fromAmountInput.value);
    if (!fromAmount) {
      toAmountInput.value = "--";
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
      toAmountInput.value = "--";
      return;
    }

    const url = `${BACKEND_URL}/api/exchange-estimate?from_currency=${fromCur.toLowerCase()}&to_currency=${toCur.toLowerCase()}&from_amount=${fromAmount}&is_fixed=${isFixed}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          toAmountInput.value = parseErrorDescription(data.error);
          return;
        }
        toAmountInput.value = data.to_amount.toFixed(6);
      })
      .catch(err => {
        console.error("Error fetching estimate:", err);
        toAmountInput.value = "Error";
      });
  }


  /****************************************************
   * 15) "Exchange" => open addresses step
   ****************************************************/
  if (exchangeButton) {
    exchangeButton.addEventListener('click', () => {
      const fromAmount = parseFloat(fromAmountInput.value);
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

      // Show trade modal
      tradeModalContainer.style.display = 'flex';

      // Show addresses step
      addressesStep.style.display = 'block';
      depositStep.style.display   = 'none';

      // Clear addresses fields
      if (addressesModalWarning) addressesModalWarning.textContent = "";
      if (recipientAddr) recipientAddr.value = "";
      if (refundAddr)    refundAddr.value    = "";
    });
  }


  /****************************************************
   * 16) Confirm addresses => create exchange
   ****************************************************/
  if (addressesConfirmBtn) {
    addressesConfirmBtn.onclick = () => {
      const fromAmount = parseFloat(fromAmountInput.value);
      let fromCur, toCur;
      if (direction === "crypto_to_xmr") {
        fromCur = selectedFromCurrency;
        toCur   = "xmr";
      } else {
        fromCur = "xmr";
        toCur   = selectedToCurrency;
      }

      const addressInput = recipientAddr.value.trim();
      const refundInput  = refundAddr.value.trim();
      if (!addressInput) {
        alert(`${toCur.toUpperCase()} address is required.`);
        return;
      }

      addressesStep.style.display = 'none';
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
        // Show deposit step
        depositStep.style.display = 'block';

        // aggregatorTxId => string
        const aggregatorTxId = data.aggregator_tx_id;

        // Update deposit step fields
        if (transactionIdEl) {
          transactionIdEl.textContent = aggregatorTxId;
        }
        if (depositAddressDisplay) {
          depositAddressDisplay.textContent = data.deposit_address || "--";
        }

        // "You Send"
        const fromCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === fromCur.toUpperCase());
        if (fromCoinData) {
          const fallbackSendImg = `https://static.simpleswap.io/images/currencies-logo/${fromCoinData.symbol.toLowerCase()}.svg`;
          modalYouSendIcon.src   = (fromCoinData.image && fromCoinData.image.trim() !== '') ? fromCoinData.image : fallbackSendImg;
          modalYouSendTicker.textContent = fromCoinData.symbol.toUpperCase();
          const netKey = (fromCoinData.network || fromCoinData.symbol).toUpperCase();
          modalYouSendPill.textContent = netKey;
          modalYouSendPill.style.backgroundColor = networkColors[netKey] || '#444';
        }
        modalYouSendAmount.textContent = fromAmount.toString();

        // "You Receive"
        const toCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === toCur.toUpperCase());
        if (toCoinData && data.to_amount) {
          const fallbackGetImg = `https://static.simpleswap.io/images/currencies-logo/${toCoinData.symbol.toLowerCase()}.svg`;
          modalYouGetIcon.src = (toCoinData.image && toCoinData.image.trim() !== '') ? toCoinData.image : fallbackGetImg;
          modalYouGetTicker.textContent = toCoinData.symbol.toUpperCase();
          const netKey = (toCoinData.network || toCoinData.symbol).toUpperCase();
          modalYouGetPill.textContent = netKey;
          modalYouGetPill.style.backgroundColor = networkColors[netKey] || '#444';
          modalYouGetAmount.textContent = data.to_amount.toString();
        }

        // If you want to display the user’s recipient address in the deposit step,
        // you can create a new label box for it and populate it similarly.

        // Generate QR
        if (qrcodeContainer && data.deposit_address) {
          qrcodeContainer.innerHTML = "";
          new QRCode(qrcodeContainer, {
            text: data.deposit_address,
            width: 128,
            height:128
          });
        }

        // Start aggregator polling with aggregatorTxId => as a string
        pollTransactionStatus(aggregatorTxId);
        startDepositCountdown();
      })
      .catch(err => {
        console.error("Error creating exchange:", err);
        alert("Failed to create exchange.");
      });
    };
  }


  /****************************************************
   * 17) aggregator polling => aggregatorTxId (string)
   ****************************************************/
  function pollTransactionStatus(aggregatorTxId) {
    // Clear old poll if any
    if (tradePollInterval) {
      clearInterval(tradePollInterval);
      tradePollInterval = null;
    }

    tradePollInterval = setInterval(() => {
      fetch(`${BACKEND_URL}/api/status/${aggregatorTxId}`) // string route
        .then(res => res.json())
        .then(statusData => {
          if (statusData.error) {
            statusText.textContent = `Error: ${statusData.error}`;
            clearInterval(tradePollInterval);
            tradePollInterval = null;
            return;
          }
          // Update deposit step status
          const spinnerEl = document.getElementById('modal-spinner');
          statusText.className = '';
          confirmationsEl.textContent = '';

          switch (statusData.status) {
            case 'waiting':
            case 'confirming':
            case 'exchanging':
            case 'sending':
              spinnerEl.style.display = 'block';
              break;
            default:
              spinnerEl.style.display = 'none';
          }

          switch (statusData.status) {
            case 'waiting':
              statusText.classList.add('status-waiting');
              statusText.textContent = "Awaiting Deposit";
              break;
            case 'confirming':
              statusText.classList.add('status-confirming');
              statusText.textContent = "Confirming";
              if (statusData.confirmations !== undefined && statusData.required_confirmations !== undefined) {
                confirmationsEl.textContent = `Confirmations: ${statusData.confirmations}/${statusData.required_confirmations}`;
              }
              break;
            case 'exchanging':
              statusText.classList.add('status-exchanging');
              statusText.textContent = "Exchanging";
              break;
            case 'sending':
              statusText.classList.add('status-sending');
              statusText.textContent = "Sending";
              if (statusData.confirmations !== undefined && statusData.required_confirmations !== undefined) {
                confirmationsEl.textContent = `Confirmations: ${statusData.confirmations}/${statusData.required_confirmations}`;
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

          // Stop countdown if no longer waiting
          if (statusData.status !== 'waiting') {
            if (countdownInterval) {
              clearInterval(countdownInterval);
              countdownInterval = null;
            }
          }
        })
        .catch(err => {
          console.error("Error polling aggregator status:", err);
          if (tradePollInterval) {
            clearInterval(tradePollInterval);
            tradePollInterval = null;
          }
        });
    }, 5000);
  }


  /****************************************************
   * 18) Switch direction => from->XMR or XMR->to
   ****************************************************/
  if (switchButton) {
    switchButton.addEventListener('click', () => {
      const oldDirection = direction;
      direction = (direction === "crypto_to_xmr") ? "xmr_to_crypto" : "crypto_to_xmr";

      if (oldDirection === "crypto_to_xmr" && direction === "xmr_to_crypto") {
        let temp = selectedFromCurrency;
        selectedFromCurrency = "XMR";
        selectedToCurrency   = temp;
      } else if (oldDirection === "xmr_to_crypto" && direction === "crypto_to_xmr") {
        let temp = selectedToCurrency;
        selectedToCurrency   = "XMR";
        selectedFromCurrency = temp;
      }

      updateUIAfterDirectionChange();
      updateAmounts();
    });
  }


  /****************************************************
   * 19) Show/hide currency dropdown
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

  document.addEventListener('click', (e) => {
    if (!fromCurrencyDropdown.contains(e.target) && !fromCurrencyButton.contains(e.target)) {
      fromCurrencyDropdown.style.display = 'none';
    }
    if (!toCurrencyDropdown.contains(e.target) && !toCurrencyButton.contains(e.target)) {
      toCurrencyDropdown.style.display = 'none';
    }
  });


  /****************************************************
   * 20) Load aggregator cryptos & initialize
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

  fetch(`${BACKEND_URL}/api/all_cryptos`)
    .then(res => res.json())
    .then(cryptos => {
      aggregatorCryptos       = cryptos;
      selectedFromCurrency    = defaultCrypto;
      selectedToCurrency      = "XMR";
      if (fromAmountInput) fromAmountInput.value = 100;

      return fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd');
    })
    .then(res => res.json())
    .then(data => {
      data.forEach(coin => {
        const ticker = coin.symbol.toUpperCase();
        if (coin.image) {
          coingeckoMap[ticker] = coin.image;
        }
      });
      initializeDropdowns();
      updateUIAfterDirectionChange();
      updateAmounts();

      // auto-refresh "You Get" amounts every 10s
      setInterval(() => {
        updateAmounts();
      }, 10000);
    })
    .catch(err => console.error("Error fetching cryptos/logos:", err));


  /****************************************************
   * 21) TRACKING MODAL => if user wants to track an existing aggregatorTxId
   ****************************************************/
  if (trackLink) {
    trackLink.addEventListener('click', (ev) => {
      ev.preventDefault();
      // Show some prompt or separate UI? 
      // In your current code, #track-step is in the trade modal. 
      // But we want a separate tracking modal => #tracking-modal-container
      // So we open tracking modal, user enters aggregatorTxId, we fetch, etc.
      trackingModalContainer.style.display = 'flex';
      resetTrackingModal(); // clear old data
    });
  }

  if (trackingModalCloseBtn) {
    trackingModalCloseBtn.addEventListener('click', () => {
      resetTrackingModal();
    });
  }

  // You’d also have a "confirm" button in the tracking modal to fetch aggregatorTxId from an input,
  // then fill fields, call pollTrackStatus(aggregatorTxId), etc. 
  // That code is omitted here for brevity, but pattern is similar to pollTransactionStatus.


}); // END DOMContentLoaded
