/***************************************************************
 * main.js - Final with improved Min/Max short error logic
 * 
 * CHANGES (styling/position only):
 *   - Each dropdown is positioned under its own .swap-input (Send or Receive).
 *   - We locate the parent .swap-input (send or receive) and set position: relative.
 *   - The dropdown is absolute: top: calc(100% + 5px), left: 50%, transform: translateX(-50%),
 *     width: 100%, so it's the same width as the .swap-input container, centered.
 *   - Search bar border + text are #d68bfc.
 *   - Crypto button background removed (#9002c0 => transparent).
 *
 * ADDITIONAL CHANGES:
 *   - All crypto icon fallback URLs now use ImageKit.
 *   - The deposit modal’s “You Receive” field and rate note are updated solely
 *     based on the local isFixed variable (Option A).
 *   - The QR code is generated with the correct URI scheme, 5px quiet zone, and
 *     error correction level H.
 *   - The rate toggle now immediately updates the rate text and re-enables the tooltip.
 *   - The image source is forced to always use the ImageKit fallback URL.
 ***************************************************************/
document.addEventListener('DOMContentLoaded', () => {

  /****************************************************
   * 0) GLOBAL CONFIG
   ****************************************************/
  const BACKEND_URL = "https://meowmeow.ngrok.app"; // aggregator
  const defaultCrypto = "USDTBEP20";
  // URI schemes for known currencies:
  const uriSchemes = {
    "BTC": "bitcoin:",
    "ETH": "ethereum:",
    "XMR": "monero:"
    // add others as needed
  };
  let isFixed = true;  
  let direction = "crypto_to_xmr";  

  let aggregatorCryptos = [];
  let coingeckoMap      = {};
  let tradePollInterval = null;
  let trackPollInterval = null;
  let countdownInterval = null;

  // color-coded
  const networkColors = {
    "BTC": "#F7931A",
    "ETH": "#3C3C3D",
    "BSC": "#F0B90B",
    "XMR": "#FF6600"
  };

  /****************************************************
   * 1) FRONT-END ELEMENTS for MAIN EXCHANGE
   ****************************************************/
  const fromAmountInput      = document.getElementById('from-amount-input');
  const toAmountInput        = document.getElementById('to-amount-input');

  if(fromAmountInput){
    fromAmountInput.style.background = 'transparent';
    fromAmountInput.style.border = 'none';
    fromAmountInput.style.color = '#fff';
  }
  if(toAmountInput){
    toAmountInput.readOnly = true;
    toAmountInput.style.background = 'transparent';
    toAmountInput.style.border = 'none';
    toAmountInput.style.color = '#fff';
  }

  const fromCurrencyButton   = document.getElementById('from-currency-select-button');
  const toCurrencyButton     = document.getElementById('to-currency-select-button');
  const fromCurrencyDropdown = document.getElementById('from-currency-dropdown');
  const toCurrencyDropdown   = document.getElementById('to-currency-dropdown');
  const fromSearchInput      = document.getElementById('from-currency-search');
  const toSearchInput        = document.getElementById('to-currency-search');
  const switchButton         = document.getElementById('switch-button');
  const exchangeButton       = document.getElementById('exchange-button');

  const rateToggleButton     = document.getElementById('rate-toggle-button');
  const rateStatusEl         = document.querySelector('.paragraph-2');
  // Also update the optional element in the footer if it exists:
  const textContainerRateEl  = document.getElementById('text-container-rate');

  let selectedFromCurrency   = null;
  let selectedToCurrency     = "XMR";

  /****************************************************
   * 2) EXCHANGE MODAL => addresses + deposit
   ****************************************************/
  const tradeModalContainer  = document.getElementById('exchange-modal-container');
  const addressesStep        = document.getElementById('addresses-step');
  const depositStep          = document.getElementById('deposit-step');

  const addressesModalWarning= document.getElementById('addresses-modal-warning');
  const addressesConfirmBtn  = document.getElementById('addresses-confirm-btn');
  const addressesCancelBtn   = document.getElementById('addresses-cancel-btn');
  const recipientAddr        = document.getElementById('recipient-addr');
  const refundAddr           = document.getElementById('refund-addr');

  const transactionIdEl       = document.getElementById('modal-tx-id');
  const depositAddressDisplay = document.getElementById('modal-deposit-address');
  const qrcodeContainer       = document.getElementById('modal-qrcode');
  const statusText            = document.getElementById('modal-status-text');
  const confirmationsEl       = document.getElementById('modal-confirmations');
  const tradeCloseBtn         = document.getElementById('modal-close-btn');

  const modalYouSendIcon      = document.getElementById('modal-you-send-icon');
  const modalYouSendTicker    = document.getElementById('modal-you-send-ticker');
  const modalYouSendPill      = document.getElementById('modal-you-send-pill');
  const modalYouSendAmount    = document.getElementById('modal-you-send-amount');

  const modalYouGetIcon       = document.getElementById('modal-you-get-icon');
  const modalYouGetTicker     = document.getElementById('modal-you-get-ticker');
  const modalYouGetPill       = document.getElementById('modal-you-get-pill');
  const modalYouGetAmount     = document.getElementById('modal-you-get-amount');

  // This element shows the rate note (floating/fixed)
  const rateNoteEl            = document.getElementById('rate-note');

  const fromWarningEl         = document.getElementById('modal-warning-from');
  const toWarningEl           = document.getElementById('network-warning-to');
  const modalRecipientAddrEl  = document.getElementById('modal-recipient-address');

  /****************************************************
   * 3) TRACKING MODAL => replicate deposit
   ****************************************************/
  const trackingModalContainer    = document.getElementById('tracking-modal-container');
  const trackLink                 = document.getElementById('track-link');

  const trackStep                 = document.getElementById('track-step');
  const trackCancelBtn            = document.getElementById('track-cancel-btn');
  const trackConfirmBtn           = document.getElementById('track-confirm-btn');
  const trackTxIdInput            = document.getElementById('track-tx-id');

  const trackDepositStep          = document.getElementById('track-deposit-step');
  const trackCloseBtn             = document.getElementById('track-close-btn');

  const trackModalTxIdEl          = document.getElementById('track-modal-tx-id');
  const trackModalYouSendIcon     = document.getElementById('track-modal-you-send-icon');
  const trackModalYouSendTicker   = document.getElementById('track-modal-you-send-ticker');
  const trackModalYouSendPill     = document.getElementById('track-modal-you-send-pill');
  const trackModalYouSendAmount   = document.getElementById('track-modal-you-send-amount');
  const trackModalYouGetIcon      = document.getElementById('track-modal-you-get-icon');
  const trackModalYouGetTicker    = document.getElementById('track-modal-you-get-ticker');
  const trackModalYouGetPill      = document.getElementById('track-modal-you-get-pill');
  const trackModalYouGetAmount    = document.getElementById('track-modal-you-get-amount');
  const trackModalDepositAddrEl   = document.getElementById('track-modal-deposit-address');
  const trackModalRecipientAddrEl = document.getElementById('track-modal-recipient-address');
  const trackModalStatusText      = document.getElementById('track-modal-status-text');
  const trackModalConfirmations   = document.getElementById('track-modal-confirmations');
  const trackModalSpinner         = document.getElementById('track-modal-spinner');

  /****************************************************
   * 4) RATE TOGGLE => isFixed
   ****************************************************/
  if(rateToggleButton){
    rateToggleButton.addEventListener('click', () => {
      isFixed = !isFixed;
      if(rateStatusEl){
        rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
      }
      // Removed update of textContainerRateEl to mimic v.8 behavior
      updateAmounts();
    });
  }
  if(rateStatusEl){
    rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
  }
  // Re-add tippy tooltip for the rate toggle button:
  tippy(rateToggleButton, {
    content: `
      <div style="max-width:200px;">
        <strong>Floating exchange rate</strong><br />
        The amount you get may change due to market volatility.<br /><br />
        <strong>Fixed exchange rate</strong><br />
        The amount you get is fixed and doesn’t depend on market volatility.
      </div>
    `,
    allowHTML: true,
    theme: 'light-border',
    placement: 'right'
  });

  /****************************************************
   * 5) 10-min countdown
   ****************************************************/
  function startDepositCountdown(){
    const cEl = document.getElementById('countdown-timer');
    if(!isFixed){
      if(cEl) cEl.style.display = 'none';
      return;
    }
    if(cEl) cEl.style.display = 'block';

    const totalSeconds = 600;
    let remaining = totalSeconds;

    const minEl  = document.getElementById('countdown-minutes');
    const secEl  = document.getElementById('countdown-seconds');
    const fillEl = document.getElementById('countdown-fill');
    if(!minEl || !secEl || !fillEl) return;

    fillEl.style.width = '0%';
    clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      remaining--;
      if(remaining < 0){
        clearInterval(countdownInterval);
        alert("Time limit reached. Please restart the trade for an updated rate.");
        tradeModalContainer.style.display = 'none';
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      minEl.textContent = m.toString();
      secEl.textContent = (s < 10 ? '0' : '') + s;
      const pct = ((totalSeconds - remaining) / totalSeconds) * 100;
      fillEl.style.width = pct + '%';
    }, 1000);
  }

  /****************************************************
   * 6) aggregator error parsing => min + max
   ****************************************************/
  function parseErrorDescription(errMsg, userAmt){
    const jsStart = errMsg.indexOf('{');
    if(jsStart > -1){
      const jsonStr = errMsg.slice(jsStart);
      try{
        const parsed = JSON.parse(jsonStr);
        if(parsed.description){
          let desc = parsed.description;
          if(/amount does not fall within the range/i.test(desc)){
            const minRegex = /min:\s*([\d\.]+)/i;
            const maxRegex = /max:\s*([\d\.]+)/i;

            const minMatch = desc.match(minRegex);
            const maxMatch = desc.match(maxRegex);

            let minVal = (minMatch && minMatch[1]) ? parseFloat(minMatch[1]) : null;
            let maxVal = (maxMatch && maxMatch[1]) ? parseFloat(maxMatch[1]) : null;

            if(minVal && userAmt < minVal){
              return `Min Amount: ${minVal}`;
            }
            if(maxVal && userAmt > maxVal){
              return `Max Amount: ${maxVal}`;
            }
          }
          return desc;
        }
      } catch(e){}
    }
    if(errMsg.includes("Pair is unavailable")) return "Pair is unavailable";
    if(errMsg.includes("Unprocessable Entity")) return "Amount not in allowed range";
    return "An error occurred";
  }

  /****************************************************
   * 7) formatTickerAndNetwork
   ****************************************************/
  function formatTickerAndNetwork(symbol, network){
    let s = symbol.toUpperCase();
    let net = network ? network.toUpperCase() : '';
    if(net === 'BSC' && s.endsWith('BEP20')){
      s = s.replace('BEP20','').trim();
    }
    return { ticker: s, network: net };
  }

  /****************************************************
   * 8) RENDER CRYPTO BUTTON
   ****************************************************/
  function renderCryptoButton(btn, symbol, image, network){
    btn.innerHTML = '';
    btn.style.display      = 'inline-flex';
    btn.style.alignItems   = 'center';
    btn.style.padding      = '10px';
    btn.style.background   = 'transparent';
    btn.style.border       = 'none';
    btn.style.color        = '#fff';
    btn.style.margin       = '0 8px 0 0';
    btn.style.fontWeight   = 'bold';
    btn.style.fontSize     = '14px';
    btn.style.cursor       = 'pointer';

    // Force the fallback image from ImageKit regardless of the aggregator value.
    const fallbackImg = `https://ik.imagekit.io/mupgznku9/crypto/${symbol.toLowerCase()}.svg`;
    const imgSrc = fallbackImg;

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.alt = `${symbol} logo`;
    imgEl.style.width = '28px';
    imgEl.style.height = '28px';
    imgEl.style.marginRight = '8px';

    const { ticker, network: netFormatted } = formatTickerAndNetwork(symbol, network);
    const txtSpan = document.createElement('span');
    txtSpan.textContent = ticker;
    txtSpan.style.marginRight = '8px';

    btn.appendChild(imgEl);
    btn.appendChild(txtSpan);

    if(netFormatted){
      const netKey = netFormatted;
      const bg = networkColors[netKey] || '#444';
      const pill = document.createElement('span');
      pill.style.fontSize = '12px';
      pill.style.color = '#fff';
      pill.style.padding = '2px 4px';
      pill.style.borderRadius = '4px';
      pill.style.backgroundColor = bg;
      pill.style.width = '50px';
      pill.style.textAlign = 'center';
      pill.textContent = netFormatted;
      btn.appendChild(pill);
    }
  }

  /****************************************************
   * 9) OLD SEARCH CODE => Hides/Shows .dropdown-item
   ****************************************************/
  function setupSearch(sInput, dropdown){
    if(!sInput) return;
    sInput.style.background   = 'transparent';
    sInput.style.border       = '1px solid #d68bfc';
    sInput.style.borderRadius = '8px';
    sInput.style.color        = '#d68bfc';
    sInput.style.outline      = 'none';

    sInput.addEventListener('input', () => {
      const q = sInput.value.toLowerCase();
      const items = dropdown.querySelectorAll('.dropdown-item');
      items.forEach(item => {
        const t = item.textContent.toLowerCase();
        item.style.display = t.includes(q) ? 'flex' : 'none';
      });
    });
  }

  /****************************************************
   * 10) buildDropdownItems
   ****************************************************/
  function buildDropdownItems(dropdown, cryptos, onSelect){
    let parentInputDiv = null;
    if(dropdown === fromCurrencyDropdown){
      parentInputDiv = document.querySelector('.swap-input.send');
    } else {
      parentInputDiv = document.querySelector('.swap-input.receive');
    }
    if(parentInputDiv){
      parentInputDiv.style.position = 'relative';
    }
    const existing = dropdown.querySelectorAll('.dropdown-item');
    existing.forEach(e => e.remove());
    dropdown.style.position = 'absolute';
    dropdown.style.left = '50%';
    dropdown.style.top = 'calc(100% + 5px)';
    dropdown.style.transform = 'translateX(-50%)';
    dropdown.style.width = '100%';
    dropdown.style.background = '#2a013f';
    dropdown.style.borderRadius = '0px';
    dropdown.style.padding = '0';
    dropdown.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    dropdown.style.maxHeight = '300px';
    dropdown.style.overflow = 'hidden';
    dropdown.style.zIndex = '9999';
    dropdown.style.display = 'none';

    let searchContainer = dropdown.querySelector('.search-container');
    if(!searchContainer){
      searchContainer = document.createElement('div');
      searchContainer.classList.add('search-container');
      searchContainer.style.position = 'sticky';
      searchContainer.style.top = '0';
      searchContainer.style.background = 'transparent';
      searchContainer.style.padding = '10px';
      const sInput = (dropdown === fromCurrencyDropdown) ? fromSearchInput : toSearchInput;
      searchContainer.appendChild(sInput);
      dropdown.appendChild(searchContainer);
    }
    let itemsContainer = dropdown.querySelector('.dropdown-items-container');
    if(!itemsContainer){
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
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.justifyContent = 'flex-start';
      itemEl.style.cursor = 'pointer';
      itemEl.style.padding = '5px';
      itemEl.style.background = 'transparent';
      itemEl.style.borderRadius = '5px';
      itemEl.style.marginBottom = '5px';
      itemEl.style.transition = 'background 0.2s ease';

      itemEl.addEventListener('mouseover', () => { itemEl.style.background = 'rgba(255,255,255,0.1)'; });
      itemEl.addEventListener('mouseout', () => { itemEl.style.background = 'transparent'; });

      const uppercaseSymbol = coin.symbol.toUpperCase();
      // Force using the ImageKit fallback URL:
      const fallbackImg = `https://ik.imagekit.io/mupgznku9/crypto/${coin.symbol.toLowerCase()}.svg`;
      const imgSrc = fallbackImg;

      const imgEl = document.createElement('img');
      imgEl.src = imgSrc;
      imgEl.alt = `${coin.symbol} logo`;
      imgEl.style.width = '24px';
      imgEl.style.height = '24px';
      imgEl.style.marginRight = '8px';

      const infoDiv = document.createElement('div');
      infoDiv.style.display = 'flex';
      infoDiv.style.flexDirection = 'row';
      infoDiv.style.alignItems = 'center';

      const symbolSpan = document.createElement('span');
      symbolSpan.style.fontWeight = 'bold';
      symbolSpan.style.fontSize = '14px';
      symbolSpan.style.color = '#fff';
      symbolSpan.style.marginRight = '10px';
      symbolSpan.textContent = uppercaseSymbol;

      const nameSpan = document.createElement('span');
      nameSpan.style.fontSize = '12px';
      nameSpan.style.color = '#ddd';
      nameSpan.style.marginRight = '10px';
      nameSpan.textContent = coin.name || '';

      const netKey = (coin.network || coin.symbol).toUpperCase();
      const networkDiv = document.createElement('div');
      networkDiv.style.fontSize = '10px';
      networkDiv.style.color = '#fff';
      networkDiv.style.padding = '2px 4px';
      networkDiv.style.borderRadius = '4px';
      networkDiv.style.display = 'inline-block';
      networkDiv.style.backgroundColor = networkColors[netKey] || '#444';
      networkDiv.style.marginRight = '10px';
      networkDiv.textContent = coin.network ? coin.network.toUpperCase() : coin.symbol;

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
   * 11) updateUIAfterDirectionChange
   ****************************************************/
  function updateUIAfterDirectionChange(){
    if(direction === "crypto_to_xmr"){
      let fromCoin = aggregatorCryptos.find(c => c.symbol === selectedFromCurrency);
      if(!fromCoin){
        selectedFromCurrency = defaultCrypto;
        fromCoin = aggregatorCryptos.find(c => c.symbol === defaultCrypto);
      }
      renderCryptoButton(fromCurrencyButton, fromCoin.symbol, fromCoin.image, fromCoin.network);

      let xmrCoin = aggregatorCryptos.find(c => c.symbol === "XMR");
      if(!xmrCoin) xmrCoin = { symbol: "XMR", image: "", network: "xmr" };
      renderCryptoButton(toCurrencyButton, xmrCoin.symbol, xmrCoin.image, xmrCoin.network);

      toCurrencyButton.style.pointerEvents = 'none';
      fromCurrencyButton.style.pointerEvents = 'auto';
    } else {
      let xmrCoin = aggregatorCryptos.find(c => c.symbol === "XMR");
      if(!xmrCoin) xmrCoin = { symbol: "XMR", image: "", network: "xmr" };
      renderCryptoButton(fromCurrencyButton, xmrCoin.symbol, xmrCoin.image, xmrCoin.network);

      let toCoin = aggregatorCryptos.find(c => c.symbol === selectedToCurrency);
      if(!toCoin){
        selectedToCurrency = defaultCrypto;
        toCoin = aggregatorCryptos.find(c => c.symbol === defaultCrypto);
      }
      renderCryptoButton(toCurrencyButton, toCoin.symbol, toCoin.image, toCoin.network);

      fromCurrencyButton.style.pointerEvents = 'none';
      toCurrencyButton.style.pointerEvents = 'auto';
    }
    updateWarnings();
  }

  /****************************************************
   * 12) aggregator warnings
   ****************************************************/
  async function fetchWarnings(symbol){
    try {
      const r = await fetch(`${BACKEND_URL}/api/get_currency?symbol=${symbol.toLowerCase()}`);
      const d = await r.json();
      const net = d.network || "";
      if(!net) return "";
      const netKey = net.toUpperCase();
      const bg = networkColors[netKey] || "#444";
      return `Please note that ${symbol.toUpperCase()} must be sent on the 
        <span style="display:inline-block;padding:2px 4px;border-radius:4px;background-color:${bg};color:#fff;">
        ${netKey}</span> network!`;
    } catch(e) {
      console.log("fetchWarnings error:", e);
      return "";
    }
  }
  function updateWarnings(){
    if(fromWarningEl){
      fromWarningEl.style.display = 'none';
      fromWarningEl.innerHTML = "";
    }
    if(toWarningEl){
      toWarningEl.style.display = 'none';
      toWarningEl.innerHTML = "";
    }

    let fromCur, toCur;
    if(direction === "crypto_to_xmr"){
      fromCur = selectedFromCurrency; 
      toCur = "XMR";
    } else {
      fromCur = "XMR"; 
      toCur = selectedToCurrency;
    }
    if(!fromCur || !toCur) return;

    Promise.all([fetchWarnings(fromCur), fetchWarnings(toCur)])
      .then(([fw, tw]) => {
        if(fw && fromWarningEl){
          fromWarningEl.style.display = 'block';
          fromWarningEl.innerHTML = fw;
          fromWarningEl.style.color = '#ffb700';
        }
        if(tw && toWarningEl){
          toWarningEl.style.display = 'block';
          toWarningEl.innerHTML = tw;
          toWarningEl.style.color = '#ffb700';
        }
      })
      .catch(err => console.log("updateWarnings err:", err));
  }

  /****************************************************
   * 13) updateAmounts => "You Get"
   ****************************************************/
  function updateAmounts(){
    const fromAmt = parseFloat(fromAmountInput?.value || "0");
    if(!fromAmt){
      if(toAmountInput) toAmountInput.value = "--";
      return;
    }
    let fromCur, toCur;
    if(direction === "crypto_to_xmr"){
      fromCur = selectedFromCurrency; 
      toCur = "xmr";
    } else {
      fromCur = "xmr"; 
      toCur = selectedToCurrency;
    }
    if(!fromCur || !toCur){
      if(toAmountInput) toAmountInput.value = "--";
      return;
    }

    const url = `${BACKEND_URL}/api/exchange-estimate?from_currency=${fromCur.toLowerCase()}&to_currency=${toCur.toLowerCase()}&from_amount=${fromAmt}&is_fixed=${isFixed}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if(d.error){
          if(toAmountInput) toAmountInput.value = parseErrorDescription(d.error, fromAmt);
          return;
        }
        if(toAmountInput){
          let displayValue = d.to_amount.toFixed(6);
          if(!isFixed){
            displayValue = "~" + displayValue;
          }
          toAmountInput.value = displayValue;
        }
      })
      .catch(e => {
        console.log("updateAmounts fetch error:", e);
        if(toAmountInput) toAmountInput.value = "Error";
      });
  }

  /****************************************************
   * 14) "EXCHANGE" => addresses step
   ****************************************************/
  if(exchangeButton){
    exchangeButton.addEventListener('click', () => {
      const fromAmt = parseFloat(fromAmountInput?.value || "0");
      if(!fromAmt){
        alert("Please enter an amount first.");
        return;
      }
      let fromCur, toCur;
      if(direction === "crypto_to_xmr"){
        fromCur = selectedFromCurrency; 
        toCur = "xmr";
        if(!fromCur){
          alert("Please select a crypto first.");
          return;
        }
      } else {
        fromCur = "xmr"; 
        toCur = selectedToCurrency;
        if(!toCur){
          alert("Please select a crypto first.");
          return;
        }
      }
      if(tradeModalContainer) tradeModalContainer.style.display = 'flex';
      if(addressesStep) addressesStep.style.display = 'block';
      if(depositStep) depositStep.style.display = 'none';

      if(addressesModalWarning) addressesModalWarning.textContent = "";
      if(recipientAddr) recipientAddr.value = "";
      if(refundAddr) refundAddr.value = "";
    });
  }
  if(addressesCancelBtn){
    addressesCancelBtn.addEventListener('click', () => {
      if(tradeModalContainer){
        tradeModalContainer.style.display = 'none';
      }
    });
  }

  /****************************************************
   * 15) addresses confirm => create_exchange
   ****************************************************/
  if(addressesConfirmBtn){
    addressesConfirmBtn.addEventListener('click', () => {
      if(!document.getElementById('terms-agree').checked){
        alert("You must agree to the Terms & Conditions and Risk Disclosure before proceeding.");
        return;
      }
      const fromAmt = parseFloat(fromAmountInput?.value || "0");
      let fromCur, toCur;
      if(direction === "crypto_to_xmr"){
        fromCur = selectedFromCurrency; 
        toCur = "xmr";
      } else {
        fromCur = "xmr"; 
        toCur = selectedToCurrency;
      }

      const addressInput = recipientAddr?.value.trim() || "";
      const refundInput  = refundAddr?.value.trim() || "";
      if(!addressInput){
        alert(`${toCur.toUpperCase()} address is required.`);
        return;
      }
      if(addressesStep) addressesStep.style.display = 'none';

      const payload = {
        from_currency: fromCur,
        to_currency: toCur,
        from_amount: fromAmt,
        address_to: addressInput,
        user_refund_address: refundInput,
        is_fixed: isFixed
      };

      fetch(`${BACKEND_URL}/api/create_exchange?api_key=YOUR_API_KEY`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(d => {
        if(d.error){
          alert("Error creating exchange: " + d.error);
          return;
        }
        if(depositStep) depositStep.style.display = 'block';

        const aggregatorTxId = d.aggregator_tx_id || "";
        if(transactionIdEl){
          transactionIdEl.textContent = aggregatorTxId;
        }
        if(depositAddressDisplay){
          depositAddressDisplay.textContent = d.deposit_address || "--";
        }

        const fromCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === fromCur.toUpperCase());
        if(fromCoinData){
          const fallbackSendImg = `https://ik.imagekit.io/mupgznku9/crypto/${fromCoinData.symbol.toLowerCase()}.svg`;
          modalYouSendIcon.src = fallbackSendImg;
          modalYouSendTicker.textContent = fromCoinData.symbol.toUpperCase();
          const netKey = (fromCoinData.network || fromCoinData.symbol).toUpperCase();
          modalYouSendPill.textContent = netKey;
          modalYouSendPill.style.backgroundColor = networkColors[netKey] || '#444';
        }
        modalYouSendAmount.textContent = fromAmt.toString();

        const toCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === toCur.toUpperCase());
        if(toCoinData && d.to_amount){
          const fallbackGetImg = `https://ik.imagekit.io/mupgznku9/crypto/${toCoinData.symbol.toLowerCase()}.svg`;
          modalYouGetIcon.src = fallbackGetImg;
          modalYouGetTicker.textContent = toCoinData.symbol.toUpperCase();
          const netKey2 = (toCoinData.network || toCoinData.symbol).toUpperCase();
          modalYouGetPill.textContent = netKey2;
          modalYouGetPill.style.backgroundColor = networkColors[netKey2] || '#444';
          if(!isFixed){
            modalYouGetAmount.textContent = "~" + d.to_amount.toString();
          } else {
            modalYouGetAmount.textContent = d.to_amount.toString();
          }
          if(rateNoteEl){
            if(!isFixed){
              rateNoteEl.innerHTML = `<span style="color:#d68bfc; font-weight:bold;">Floating exchange rate</span> - <span style="color:#fff;">The amount you get may change due to market volatility.</span>`;
            } else {
              rateNoteEl.innerHTML = `<span style="color:#d68bfc; font-weight:bold;">Fixed exchange rate</span> - <span style="color:#fff;">The amount you get is fixed and doesn’t depend on market volatility.</span>`;
            }
          }
        }

        if(qrcodeContainer && d.deposit_address){
          qrcodeContainer.innerHTML = '';
          let depositCurrency = (direction === "crypto_to_xmr") ? selectedFromCurrency : "XMR";
          let scheme = uriSchemes[depositCurrency.toUpperCase()] || depositCurrency.toLowerCase() + ":";
          new QRCode(qrcodeContainer, {
            text: scheme + d.deposit_address,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
          });
        }

        if(modalRecipientAddrEl){
          modalRecipientAddrEl.textContent = addressInput || "--";
        }

        pollTransactionStatus(aggregatorTxId);
        startDepositCountdown();
      })
      .catch(e => {
        console.log("create_exchange error:", e);
        alert("Failed to create exchange.");
      });
    });
  }

  /****************************************************
   * 16) aggregator poll => deposit (uses /api/status)
   ****************************************************/
  function pollTransactionStatus(aggTxId){
    if(tradePollInterval){
      clearInterval(tradePollInterval);
      tradePollInterval = null;
    }
    tradePollInterval = setInterval(() => {
      fetch(`${BACKEND_URL}/api/status/${aggTxId}`)
        .then(r => r.json())
        .then(d => {
          if(d.error){
            if(statusText) statusText.textContent = `Error: ${d.error}`;
            clearInterval(tradePollInterval);
            tradePollInterval = null;
            return;
          }
          if(statusText) statusText.className = '';
          if(confirmationsEl) confirmationsEl.textContent = '';

          const spinnerEl = document.getElementById('modal-spinner');
          if(spinnerEl) spinnerEl.style.display = 'none';

          switch(d.status){
            case 'waiting':
            case 'confirming':
            case 'exchanging':
            case 'sending':
              if(spinnerEl) spinnerEl.style.display = 'block';
              break;
            default:
              if(spinnerEl) spinnerEl.style.display = 'none';
          }

          if(statusText){
            switch(d.status){
              case 'waiting':
                statusText.classList.add('status-waiting');
                statusText.textContent = "Awaiting Deposit";
                break;
              case 'confirming':
                statusText.classList.add('status-confirming');
                statusText.textContent = "Confirming";
                if(d.confirmations !== undefined && d.required_confirmations !== undefined){
                  confirmationsEl.textContent = `Confirmations: ${d.confirmations}/${d.required_confirmations}`;
                }
                break;
              case 'exchanging':
                statusText.classList.add('status-exchanging');
                statusText.textContent = "Exchanging";
                break;
              case 'sending':
                statusText.classList.add('status-sending');
                statusText.textContent = "Sending";
                if(d.confirmations !== undefined && d.required_confirmations !== undefined){
                  confirmationsEl.textContent = `Confirmations: ${d.confirmations}/${d.required_confirmations}`;
                }
                break;
              case 'finished':
                statusText.classList.add('status-finished');
                statusText.textContent = "Finished";
                clearInterval(tradePollInterval);
                tradePollInterval = null;
                break;
              case 'expired':
                statusText.classList.add('status-expired');
                statusText.textContent = "Expired";
                clearInterval(tradePollInterval);
                tradePollInterval = null;
                break;
              default:
                statusText.textContent = "Unknown Status";
                clearInterval(tradePollInterval);
                tradePollInterval = null;
            }
          }
          if(d.status !== 'waiting'){
            if(countdownInterval){
              clearInterval(countdownInterval);
              countdownInterval = null;
            }
          }
        })
        .catch(e => {
          console.log("pollTransactionStatus error:", e);
          if(tradePollInterval){
            clearInterval(tradePollInterval);
            tradePollInterval = null;
          }
        });
    }, 5000);
  }

  /****************************************************
   * 17) SWITCH => direction
   ****************************************************/
  if(switchButton){
    switchButton.addEventListener('click', () => {
      const old = direction;
      direction = (direction === "crypto_to_xmr") ? "xmr_to_crypto" : "crypto_to_xmr";

      if(old === "crypto_to_xmr" && direction === "xmr_to_crypto"){
        let temp = selectedFromCurrency;
        selectedFromCurrency = "XMR";
        selectedToCurrency = temp;
      } else if(old === "xmr_to_crypto" && direction === "crypto_to_xmr"){
        let temp = selectedToCurrency;
        selectedToCurrency = "XMR";
        selectedFromCurrency = temp;
      }
      updateUIAfterDirectionChange();
      updateAmounts();
    });
  }

  /****************************************************
   * 18) SHOW/HIDE currency dropdown
   ****************************************************/
  if(fromCurrencyButton){
    fromCurrencyButton.addEventListener('click', () => {
      if(direction === "crypto_to_xmr"){
        fromCurrencyDropdown.style.display =
          (fromCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
      }
    });
  }
  if(toCurrencyButton){
    toCurrencyButton.addEventListener('click', () => {
      if(direction === "xmr_to_crypto"){
        toCurrencyDropdown.style.display =
          (toCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
      }
    });
  }
  document.addEventListener('click', (ev) => {
    if(fromCurrencyDropdown && !fromCurrencyDropdown.contains(ev.target) && !fromCurrencyButton.contains(ev.target)){
      fromCurrencyDropdown.style.display = 'none';
    }
    if(toCurrencyDropdown && !toCurrencyDropdown.contains(ev.target) && !toCurrencyButton.contains(ev.target)){
      toCurrencyDropdown.style.display = 'none';
    }
  });

  /****************************************************
   * 19) LOAD aggregator cryptos
   ****************************************************/
  function initializeDropdowns(){
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

    setupSearch(fromSearchInput, fromCurrencyDropdown);
    setupSearch(toSearchInput, toCurrencyDropdown);
  }
  if(fromAmountInput){
    fromAmountInput.addEventListener('input', updateAmounts);
  }
  fetch(`${BACKEND_URL}/api/all_cryptos`)
    .then(r => r.json())
    .then(cryptos => {
      aggregatorCryptos = cryptos;
      selectedFromCurrency = defaultCrypto;
      selectedToCurrency = "XMR";
      if(fromAmountInput) fromAmountInput.value = 100;
      return fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd');
    })
    .then(r => r.json())
    .then(data => {
      data.forEach(coin => {
        const tk = coin.symbol.toUpperCase();
        if(coin.image){
          coingeckoMap[tk] = coin.image;
        }
      });
      initializeDropdowns();
      updateUIAfterDirectionChange();
      updateAmounts();
      setInterval(() => { updateAmounts(); }, 10000);
    })
    .catch(e => console.log("Error fetching aggregator cryptos/logos:", e));

  /****************************************************
   * 20) TRACKING MODAL => EXACT REPLICA
   ****************************************************/
  if(trackLink && trackingModalContainer){
    trackLink.addEventListener('click', (ev) => {
      ev.preventDefault();
      trackingModalContainer.style.display = 'flex';
      if(trackStep) trackStep.style.display = 'block';
      if(trackDepositStep) trackDepositStep.style.display = 'none';
      if(trackTxIdInput) trackTxIdInput.value = "";
      resetTrackingDeposit();
    });
  }
  if(trackCancelBtn){
    trackCancelBtn.addEventListener('click', () => {
      trackingModalContainer.style.display = 'none';
      resetTrackingDeposit();
    });
  }
  if(trackConfirmBtn){
    trackConfirmBtn.addEventListener('click', () => {
      const aggregatorTxId = trackTxIdInput?.value.trim() || "";
      if(!aggregatorTxId){
        alert("Please enter a valid aggregatorTxId!");
        return;
      }
      if(trackStep) trackStep.style.display = 'none';
      if(trackDepositStep) trackDepositStep.style.display = 'block';
      if(trackModalTxIdEl) trackModalTxIdEl.textContent = aggregatorTxId;
      pollTrackingStatus(aggregatorTxId);
    });
  }
  if(trackCloseBtn){
    trackCloseBtn.addEventListener('click', () => {
      trackingModalContainer.style.display = 'none';
      resetTrackingDeposit();
    });
  }

  function resetTrackingDeposit(){
    if(trackPollInterval){
      clearInterval(trackPollInterval);
      trackPollInterval = null;
    }
    if(trackModalTxIdEl) trackModalTxIdEl.textContent = "--";
    if(trackModalYouSendIcon) trackModalYouSendIcon.src = "";
    if(trackModalYouSendTicker) trackModalYouSendTicker.textContent = "---";
    if(trackModalYouSendPill){
      trackModalYouSendPill.textContent = "---";
      trackModalYouSendPill.style.backgroundColor = "#777";
    }
    if(trackModalYouSendAmount) trackModalYouSendAmount.textContent = "--";
    if(trackModalYouGetIcon) trackModalYouGetIcon.src = "";
    if(trackModalYouGetTicker) trackModalYouGetTicker.textContent = "---";
    if(trackModalYouGetPill){
      trackModalYouGetPill.textContent = "---";
      trackModalYouGetPill.style.backgroundColor = "#777";
    }
    if(trackModalYouGetAmount) trackModalYouGetAmount.textContent = "--";
    if(trackModalDepositAddrEl) trackModalDepositAddrEl.textContent = "--";
    if(trackModalRecipientAddrEl) trackModalRecipientAddrEl.textContent = "--";
    if(trackModalStatusText){
      trackModalStatusText.textContent = "Awaiting Deposit";
      trackModalStatusText.className = "";
      trackModalStatusText.classList.add('status-waiting');
    }
    if(trackModalConfirmations) trackModalConfirmations.textContent = "";
    if(trackModalSpinner) trackModalSpinner.style.display = 'none';
  }

  function showTrackSpinner(){
    if(trackModalSpinner) trackModalSpinner.style.display = 'block';
  }
  function hideTrackSpinner(){
    if(trackModalSpinner) trackModalSpinner.style.display = 'none';
  }

  function pollTrackingStatus(aggTxId){
    if(trackPollInterval){
      clearInterval(trackPollInterval);
      trackPollInterval = null;
    }
    fetchAndUpdateTrack(aggTxId);
    trackPollInterval = setInterval(() => {
      fetchAndUpdateTrack(aggTxId);
    }, 5000);
  }

  function fetchAndUpdateTrack(aggTxId){
    showTrackSpinner();
    fetch(`${BACKEND_URL}/api/tracking/${aggTxId}`)
      .then(r => r.json())
      .then(d => {
        hideTrackSpinner();
        if(d.error){
          trackModalStatusText.textContent = `Error: ${d.error}`;
          trackModalStatusText.className = "";
          trackModalConfirmations.textContent = "";
          if(trackPollInterval){
            clearInterval(trackPollInterval);
            trackPollInterval = null;
          }
          return;
        }
        if(d.currency_from && trackModalYouSendTicker){
          trackModalYouSendTicker.textContent = d.currency_from.toUpperCase();
        }
        if(d.amount_from && trackModalYouSendAmount){
          trackModalYouSendAmount.textContent = d.amount_from.toString();
        }
        const fromCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === d.currency_from?.toUpperCase());
        if(fromCoinData){
          const fallbackSendImg = `https://ik.imagekit.io/mupgznku9/crypto/${fromCoinData.symbol.toLowerCase()}.svg`;
          trackModalYouSendIcon.src = (fromCoinData.image && fromCoinData.image.trim() !== '') 
            ? fallbackSendImg 
            : fallbackSendImg;
          const netKey = (fromCoinData.network || fromCoinData.symbol).toUpperCase();
          trackModalYouSendPill.textContent = netKey;
          trackModalYouSendPill.style.backgroundColor = networkColors[netKey] || '#444';
        }
        if(d.currency_to && trackModalYouGetTicker){
          trackModalYouGetTicker.textContent = d.currency_to.toUpperCase();
        }
        if(d.amount_to && trackModalYouGetAmount){
          trackModalYouGetAmount.textContent = d.amount_to.toString();
        }
        const toCoinData = aggregatorCryptos.find(c => c.symbol.toUpperCase() === d.currency_to?.toUpperCase());
        if(toCoinData){
          const fallbackGetImg = `https://ik.imagekit.io/mupgznku9/crypto/${toCoinData.symbol.toLowerCase()}.svg`;
          trackModalYouGetIcon.src = (toCoinData.image && toCoinData.image.trim() !== '') 
            ? fallbackGetImg 
            : fallbackGetImg;
          const netKey2 = (toCoinData.network || toCoinData.symbol).toUpperCase();
          trackModalYouGetPill.textContent = netKey2;
          trackModalYouGetPill.style.backgroundColor = networkColors[netKey2] || '#444';
        }
        if(d.address_from && trackModalDepositAddrEl){
          trackModalDepositAddrEl.textContent = d.address_from;
        }
        if(d.address_to && trackModalRecipientAddrEl){
          trackModalRecipientAddrEl.textContent = d.address_to;
        }
        trackModalStatusText.className = '';
        trackModalConfirmations.textContent = '';
        switch(d.status){
          case 'waiting':
            trackModalStatusText.classList.add('status-waiting');
            trackModalStatusText.textContent = "Awaiting Deposit";
            break;
          case 'confirming':
            trackModalStatusText.classList.add('status-confirming');
            trackModalStatusText.textContent = "Confirming";
            if(d.confirmations !== undefined && d.required_confirmations !== undefined){
              trackModalConfirmations.textContent = `Confirmations: ${d.confirmations}/${d.required_confirmations}`;
            }
            break;
          case 'exchanging':
            trackModalStatusText.classList.add('status-exchanging');
            trackModalStatusText.textContent = "Exchanging";
            break;
          case 'sending':
            trackModalStatusText.classList.add('status-sending');
            trackModalStatusText.textContent = "Sending";
            if(d.confirmations !== undefined && d.required_confirmations !== undefined){
              trackModalConfirmations.textContent = `Confirmations: ${d.confirmations}/${d.required_confirmations}`;
            }
            break;
          case 'finished':
            trackModalStatusText.classList.add('status-finished');
            trackModalStatusText.textContent = "Finished";
            if(trackPollInterval){
              clearInterval(trackPollInterval);
              trackPollInterval = null;
            }
            break;
          case 'expired':
            trackModalStatusText.classList.add('status-expired');
            trackModalStatusText.textContent = "Expired";
            if(trackPollInterval){
              clearInterval(trackPollInterval);
              trackPollInterval = null;
            }
            break;
          default:
            trackModalStatusText.textContent = "Unknown Status";
            if(trackPollInterval){
              clearInterval(trackPollInterval);
              trackPollInterval = null;
            }
        }
      })
      .catch(e => {
        console.log("fetchAndUpdateTrack error:", e);
        trackModalStatusText.textContent = "Error fetching aggregator status!";
        hideTrackSpinner();
        if(trackPollInterval){
          clearInterval(trackPollInterval);
          trackPollInterval = null;
        }
      });
  }

  /****************************************************
   * 21) CLOSE => deposit step
   ****************************************************/
  if(tradeCloseBtn && tradeModalContainer){
    tradeCloseBtn.addEventListener('click', () => {
      tradeModalContainer.style.display = 'none';
    });
  }

}); // END DOMContentLoaded
