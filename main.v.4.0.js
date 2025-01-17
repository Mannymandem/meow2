/* ==============================
   main.v.3.9.js (Full Example)
   ============================== */

document.addEventListener('DOMContentLoaded', () => {
  const BACKEND_URL = "https://meowmeow.ngrok.app"; // Adjust if needed

  // 1) Define aggregatorCryptos at a higher scope
  let aggregatorCryptos = [];
  let coingeckoMap = {};

  // Default direction & currencies
  let direction = "crypto_to_xmr"; 
  let selectedFromCurrency = null;
  let selectedToCurrency = "XMR";
  const defaultCrypto = "USDTBEP20";

  // We'll default isFixed to true => "locked" = fixed rate
  let isFixed = true;

  // HTML references
  const fromAmountInput         = document.getElementById('from-amount-input');
  const toAmountInput           = document.getElementById('to-amount-input');
  const fromCurrencyButton      = document.getElementById('from-currency-select-button');
  const toCurrencyButton        = document.getElementById('to-currency-select-button');
  const fromCurrencyDropdown    = document.getElementById('from-currency-dropdown');
  const toCurrencyDropdown      = document.getElementById('to-currency-dropdown');
  const fromSearchInput         = document.getElementById('from-currency-search');
  const toSearchInput           = document.getElementById('to-currency-search');
  const switchButton            = document.getElementById('switch-button');
  const exchangeButton          = document.getElementById('exchange-button');
  const rateToggleButton        = document.getElementById('rate-toggle-button');
  const rateStatusEl            = document.querySelector('.paragraph-2'); // e.g. <p class="paragraph-2">Rate = fixed</p>

  // Modal references
  const addressesModalContainer = document.getElementById('exchange-modal-container');
  const addressesStep           = document.getElementById('addresses-step');
  const depositStep             = document.getElementById('deposit-step');
  const addressesModalWarning   = document.getElementById('addresses-modal-warning');
  const addressesConfirmBtn     = document.getElementById('addresses-confirm-btn');
  const recipientAddr           = document.getElementById('recipient-addr');
  const refundAddr              = document.getElementById('refund-addr');

  // Deposit step references
  const transactionIdEl         = document.getElementById('modal-tx-id');
  const depositAddressDisplay   = document.getElementById('modal-deposit-address');
  const qrcodeContainer         = document.getElementById('modal-qrcode');
  const statusText              = document.getElementById('modal-status-text');
  const confirmationsEl         = document.getElementById('modal-confirmations');

  // Warnings
  const fromWarningEl           = document.getElementById('modal-warning-from'); 
  const toWarningEl             = document.getElementById('network-warning-to');

  // Snake references (if still used)
  const snakeStatusText         = document.getElementById('snake-status-text');
  const snakeSpinner            = document.getElementById('snake-spinner');

  // 10-min countdown
  let countdownInterval;

  // Network color map
  const networkColors = {
    "BTC": "#F7931A",
    "ETH": "#3C3C3D",
    "BSC": "#F0B90B",
    "XMR": "#FF6600"
  };

  // By default, the “Rate = fixed” label
  if (rateStatusEl) {
    rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
  }

  /* ----------------------------------------------------------------------
     2) aggregatorCryptos must be used ONLY after it’s assigned from the API
     so we define helper functions below, but we won't call them until fetch
     succeeds and aggregatorCryptos is populated.
     ---------------------------------------------------------------------- */

  // ---------- Searching ----------
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

  // ---------- Building Dropdown Items ----------
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
      searchContainer.style.position  = 'sticky';
      searchContainer.style.top       = '0';
      searchContainer.style.background= '#442244';
      searchContainer.style.padding   = '10px';

      const searchInput = (dropdown === fromCurrencyDropdown)
        ? fromSearchInput
        : toSearchInput;

      searchContainer.appendChild(searchInput);
      searchInput.style.width         = '100%';
      searchInput.style.padding       = '8px';
      searchInput.style.borderRadius  = '5px';
      searchInput.style.border        = 'none';
      searchInput.style.fontSize      = '14px';
      searchInput.style.outline       = 'none';
      searchInput.style.color         = '#000';
      searchInput.placeholder         = "Search...";
      searchInput.style.boxSizing     = 'border-box';

      dropdown.appendChild(searchContainer);
    }

    let itemsContainer = dropdown.querySelector('.dropdown-items-container');
    if (!itemsContainer) {
      itemsContainer = document.createElement('div');
      itemsContainer.classList.add('dropdown-items-container');
      itemsContainer.style.padding    = '10px';
      itemsContainer.style.overflowY  = 'auto';
      itemsContainer.style.maxHeight  = 'calc(300px - 60px)';
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

      itemEl.addEventListener('mouseover', () => {
        itemEl.style.background = '#444';
      });
      itemEl.addEventListener('mouseout', () => {
        itemEl.style.background = '#333';
      });

      const uppercaseSymbol = coin.symbol.toUpperCase();
      const fallbackImage   = `https://static.simpleswap.io/images/currencies-logo/${coin.symbol.toLowerCase()}.svg`;
      const imgSrc          = (coin.image && coin.image.trim() !== '') ? coin.image : fallbackImage;

      const imgEl = document.createElement('img');
      imgEl.src    = imgSrc;
      imgEl.alt    = `${coin.symbol} logo`;
      imgEl.style.width       = '24px';
      imgEl.style.height      = '24px';
      imgEl.style.marginRight = '8px';
      imgEl.style.display     = 'block';

      const infoDiv = document.createElement('div');
      infoDiv.style.display        = 'flex';
      infoDiv.style.flexDirection  = 'column';
      infoDiv.style.alignItems     = 'center';

      const symbolSpan = document.createElement('span');
      symbolSpan.style.fontWeight  = 'bold';
      symbolSpan.style.fontSize    = '14px';
      symbolSpan.style.color       = '#fff';
      symbolSpan.textContent       = uppercaseSymbol;

      const nameSpan = document.createElement('span');
      nameSpan.style.fontSize      = '12px';
      nameSpan.style.color         = '#ddd';
      nameSpan.style.marginTop     = '2px';
      nameSpan.textContent         = coin.name || '';

      const netKey    = (coin.network || coin.symbol).toUpperCase();
      const networkDiv= document.createElement('div');
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

  // ---------- Render Crypto Button ----------
  function renderCryptoButton(buttonEl, symbol, image, network) {
    buttonEl.innerHTML = '';
    buttonEl.style.display       = 'inline-flex';
    buttonEl.style.alignItems    = 'center';
    buttonEl.style.padding       = '10px';
    buttonEl.style.background    = '#9002c0';
    buttonEl.style.border        = 'none';
    buttonEl.style.color         = '#fff';
    buttonEl.style.margin        = '0 8px 0 0'; 
    buttonEl.style.textAlign     = 'center';
    buttonEl.style.cursor        = 'pointer';
    buttonEl.style.fontWeight    = 'bold';
    buttonEl.style.fontSize      = '14px';

    const fallbackImage = `https://static.simpleswap.io/images/currencies-logo/${symbol.toLowerCase()}.svg`;
    const imgSrc        = (image && image.trim() !== '') ? image : fallbackImage;

    const imgEl = document.createElement('img');
    imgEl.src            = imgSrc;
    imgEl.alt            = `${symbol} logo`;
    imgEl.style.width    = '28px';
    imgEl.style.height   = '28px';
    imgEl.style.marginRight = '8px';
    imgEl.style.display  = 'block';

    // Format the ticker + network
    const { ticker, network: net } = formatTickerAndNetwork(symbol, network);

    const textSpan = document.createElement('span');
    textSpan.textContent         = ticker;
    textSpan.style.display       = 'inline-block';
    textSpan.style.marginRight   = '8px';

    buttonEl.appendChild(imgEl);
    buttonEl.appendChild(textSpan);

    if (net) {
      const netKey  = net;
      const bgColor = networkColors[netKey] || '#444';

      const networkPill = document.createElement('span');
      networkPill.style.fontSize       = '12px';
      networkPill.style.color          = '#fff';
      networkPill.style.padding        = '2px 4px';
      networkPill.style.borderRadius   = '4px';
      networkPill.style.display        = 'inline-block';
      networkPill.style.backgroundColor= bgColor;
      networkPill.style.width          = '50px'; 
      networkPill.style.textAlign      = 'center';
      networkPill.textContent          = netKey;

      buttonEl.appendChild(networkPill);
    }
  }

  // ---------- Updating Warnings ----------
  async function fetchWarnings(symbol) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/get_currency?symbol=${symbol.toLowerCase()}`);
      const d = await r.json();
      const net = d.network || "";
      if (!net) return "";
      const netKey = net.toUpperCase();
      const bgColor= networkColors[netKey] || "#444";
      return `Please note that ${symbol.toUpperCase()} must be sent on the <span style="display:inline-block;padding:2px 4px;border-radius:4px;background-color:${bgColor};color:#fff;">${netKey}</span> network!`;
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
      toWarningEl.style.display   = 'none';
      toWarningEl.innerHTML       = "";
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
          toWarningEl.style.display   = 'block';
          toWarningEl.innerHTML       = toFallback;
          toWarningEl.style.color     = '#ffb700';
        }
      })
      .catch(err => console.error("Error in updateWarnings:", err));
  }

  // ---------- Update "You Get" Amount ----------
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

    // is_fixed => isFixed
    fetch(`${BACKEND_URL}/api/exchange-estimate?from_currency=${fromCur.toLowerCase()}&to_currency=${toCur.toLowerCase()}&from_amount=${fromAmount}&is_fixed=${isFixed}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          toAmountInput.value = parseErrorDescription(data.error);
          return;
        }
        toAmountInput.value   = data.to_amount.toFixed(6);
      })
      .catch(err => {
        console.error("Error fetching estimate:", err);
        toAmountInput.value = "Error";
      });
  }

  // ---------- Switch Direction ----------
  switchButton.addEventListener('click', () => {
    const oldDirection = direction;
    direction = (direction === "crypto_to_xmr") 
                ? "xmr_to_crypto" 
                : "crypto_to_xmr";

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

  // ---------- updateUIAfterDirectionChange ----------
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

  // ---------- 10-min Countdown for Fixed Swaps ----------
  let countdownInterval = null;
  function startDepositCountdown() {
    // Only show timer if isFixed = true
    if (!isFixed) {
      return; // no countdown for float
    }
    const totalSeconds = 600; // 10 min
    let remaining      = totalSeconds;

    const minutesEl    = document.getElementById('countdown-minutes');
    const secondsEl    = document.getElementById('countdown-seconds');
    const fillEl       = document.getElementById('countdown-fill');
    const countdownEl  = document.getElementById('countdown-timer');

    // Show countdown area if hidden
    if (countdownEl) {
      countdownEl.style.display = 'block';
    }

    if (!minutesEl || !secondsEl || !fillEl) {
      console.log("Countdown elements not found; skipping timer logic.");
      return;
    }

    fillEl.style.width = '0%';
    clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining < 0) {
        clearInterval(countdownInterval);
        alert("Time limit reached. Please restart the trade for an updated rate.");
        addressesModalContainer.style.display = 'none';
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

  // ---------- Poll aggregator status ----------
  function pollTransactionStatus(txId) {
    const interval = setInterval(() => {
      fetch(`${BACKEND_URL}/api/status/${txId}`)
        .then(res => res.json())
        .then(statusData => {
          if (statusData.error) {
            statusText.textContent = `Error: ${statusData.error}`;
            clearInterval(interval);
            return;
          }
          const spinnerEl = document.getElementById('modal-spinner');
          statusText.className   = '';
          confirmationsEl.textContent = '';

          if (snakeSpinner) snakeSpinner.style.display = 'none';
          if (snakeStatusText) snakeStatusText.className = '';

          switch (statusData.status) {
            case 'waiting':
            case 'confirming':
            case 'exchanging':
            case 'sending':
              spinnerEl.style.display = 'block';
              if (snakeSpinner) snakeSpinner.style.display = 'block';
              break;
            case 'finished':
            default:
              spinnerEl.style.display = 'none';
              if (snakeSpinner) snakeSpinner.style.display = 'none';
          }

          // deposit step status
          switch(statusData.status) {
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
              clearInterval(interval);
              break;
            default:
              statusText.textContent = "Unknown Status";
              clearInterval(interval);
          }

          // stop countdown if no longer waiting
          if (statusData.status !== 'waiting') {
            clearInterval(countdownInterval);
          }

          // Mirror status in Snake step if needed
          if (snakeStatusText) {
            snakeStatusText.className = '';
            switch(statusData.status) {
              case 'waiting':
                snakeStatusText.classList.add('status-waiting');
                snakeStatusText.textContent = "Awaiting Deposit";
                break;
              case 'confirming':
                snakeStatusText.classList.add('status-confirming');
                snakeStatusText.textContent = "Confirming";
                break;
              case 'exchanging':
                snakeStatusText.classList.add('status-exchanging');
                snakeStatusText.textContent = "Exchanging";
                break;
              case 'sending':
                snakeStatusText.classList.add('status-sending');
                snakeStatusText.textContent = "Sending";
                break;
              case 'finished':
                snakeStatusText.classList.add('status-finished');
                snakeStatusText.textContent = "Finished";
                break;
              default:
                snakeStatusText.textContent = "Unknown Status";
            }
          }
        })
        .catch(err => {
          console.error("Error polling status:", err);
          clearInterval(interval);
        });
    }, 5000);
  }

  // ---------- "Exchange" => show addresses step ----------
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

    addressesModalContainer.style.display = 'flex';
    addressesStep.style.display           = 'block';
    depositStep.style.display             = 'none';

    addressesModalWarning.textContent     = "";
    recipientAddr.value                   = "";
    refundAddr.value                      = "";
  });

  // ---------- Confirm addresses => create exchange ----------
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

      // aggregator_tx_id => no label prefix
      if (transactionIdEl) {
        transactionIdEl.textContent = data.aggregator_tx_id;
      }
      // deposit address => no prefix
      if (depositAddressDisplay) {
        depositAddressDisplay.textContent = data.deposit_address;
      }

      // "You Send" / "You Receive"
      const modalYouSend = document.getElementById('modal-you-send');
      const modalYouGet  = document.getElementById('modal-you-get');
      if (modalYouSend) {
        modalYouSend.textContent = `${fromAmount} ${fromCur.toUpperCase()}`;
      }
      if (modalYouGet && data.to_amount) {
        modalYouGet.textContent  = `${data.to_amount} ${toCur.toUpperCase()}`;
      }

      // Optional: Generate QR code
      if (qrcodeContainer) {
        qrcodeContainer.innerHTML = "";
        new QRCode(qrcodeContainer, {
          text: data.deposit_address,
          width:128,
          height:128
        });
      }

      pollTransactionStatus(data.transactionId);
      startDepositCountdown();
    })
    .catch(err => {
      console.error("Error creating exchange:", err);
      alert("Failed to create exchange.");
    });
  };

  // ---------- Searching Setup ----------
  setupSearch(fromSearchInput, fromCurrencyDropdown);
  setupSearch(toSearchInput,   toCurrencyDropdown);

  // ---------- init logic on page load ----------
  fromAmountInput.addEventListener('input', updateAmounts);

  // Rate toggle button
  if (rateToggleButton) {
    rateToggleButton.addEventListener('click', () => {
      isFixed = !isFixed;
      if (rateStatusEl) {
        rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
      }
      updateAmounts();
    });
  }

  // 4) The main fetch => aggregatorCryptos
  fetch(`${BACKEND_URL}/api/all_cryptos`)
    .then(res => res.json())
    .then(cryptos => {
      aggregatorCryptos = cryptos; // fill the global aggregatorCryptos
      selectedFromCurrency = defaultCrypto;
      selectedToCurrency   = "XMR";
      fromAmountInput.value= 100;

      // Possibly second fetch => coingecko
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
      // Now aggregatorCryptos is populated, coingeckoMap is also populated
      // => call these
      updateUIAfterDirectionChange();
      updateAmounts();

      // Build initial dropdown
      buildDropdownItems(fromCurrencyDropdown, aggregatorCryptos, coin => {
        selectedFromCurrency = coin.symbol;
        updateUIAfterDirectionChange();
        updateAmounts();
      });
      buildDropdownItems(toCurrencyDropdown, aggregatorCryptos, coin => {
        selectedToCurrency = coin.symbol;
        updateUIAfterDirectionChange();
        updateAmounts();
      });

      // auto-refresh every 10s
      setInterval(() => {
        updateAmounts();
      }, 10000);
    })
    .catch(err => {
      console.error("Error fetching cryptos/logos:", err);
      // aggregatorCryptos remains empty => might want to skip or show fallback
    });
});
