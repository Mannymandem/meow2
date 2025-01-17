document.addEventListener('DOMContentLoaded', () => {
  const BACKEND_URL = "https://meowmeow.ngrok.app"; // Adjust if needed

  let direction = "crypto_to_xmr"; 
  let selectedFromCurrency = null;
  let selectedToCurrency = "XMR";
  const defaultCrypto = "USDTBEP20";

  // We'll default isFixed to true => "locked" symbol means fixed rate
  let isFixed = true;

  // Trading window elements
  const fromAmountInput = document.getElementById('from-amount-input');
  const toAmountInput   = document.getElementById('to-amount-input');
  toAmountInput.readOnly = true;

  const fromCurrencyButton = document.getElementById('from-currency-select-button');
  const toCurrencyButton   = document.getElementById('to-currency-select-button');
  const fromCurrencyDropdown = document.getElementById('from-currency-dropdown');
  const toCurrencyDropdown   = document.getElementById('to-currency-dropdown');
  const fromSearchInput      = document.getElementById('from-currency-search');
  const toSearchInput        = document.getElementById('to-currency-search');
  const switchButton         = document.getElementById('switch-button');
  const exchangeButton       = document.getElementById('exchange-button');

  const rateToggleButton = document.getElementById('rate-toggle-button'); 
  const rateStatusEl     = document.querySelector('.paragraph-2'); 

  // Modal references
  const addressesModalContainer = document.getElementById('exchange-modal-container');
  const addressesStep = document.getElementById('addresses-step');
  const depositStep   = document.getElementById('deposit-step');

  const addressesModalWarning = document.getElementById('addresses-modal-warning');
  const addressesConfirmBtn   = document.getElementById('addresses-confirm-btn');
  const recipientAddr         = document.getElementById('recipient-addr');
  const refundAddr            = document.getElementById('refund-addr');

  // In the updated embedded code, we have these elements:
  const transactionIdEl       = document.getElementById('modal-tx-id');
  const depositAddressDisplay = document.getElementById('modal-deposit-address');
  const qrcodeContainer       = document.getElementById('modal-qrcode');
  const statusText            = document.getElementById('modal-status-text');
  const confirmationsEl       = document.getElementById('modal-confirmations');

  const modalYouSendEl = document.getElementById('modal-you-send');
  const modalYouGetEl  = document.getElementById('modal-you-get');

  const countdownTimerEl  = document.getElementById('countdown-timer');
  const countdownMinutes  = document.getElementById('countdown-minutes');
  const countdownSeconds  = document.getElementById('countdown-seconds');
  const countdownFillEl   = document.getElementById('countdown-fill');

  // aggregator warnings
  const fromWarningEl  = document.getElementById('modal-warning-from');
  const toWarningEl    = document.getElementById('network-warning-to'); // optional if needed

  // We'll no longer reference snake game or snake-step 
  // (We've removed them from the new HTML)

  let countdownInterval;

  let aggregatorCryptos = [];
  let coingeckoMap = {};

  // Some example network color map
  const networkColors = {
    BTC: "#F7931A",
    ETH: "#3C3C3D",
    BSC: "#F0B90B",
    XMR: "#FF6600"
  };

  //------------------------------------------------
  // Toggle isFixed from the single button
  //------------------------------------------------
  if (rateToggleButton) {
    rateToggleButton.addEventListener('click', () => {
      isFixed = !isFixed;
      if (rateStatusEl) {
        rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
      }
      // Re-fetch
      updateAmounts();
    });
  }
  if (rateStatusEl) {
    rateStatusEl.textContent = isFixed ? "Rate = fixed" : "Rate = float";
  }

  //------------------------------------------------
  // Countdown Timer (only if isFixed)
  //------------------------------------------------
  function startDepositCountdown() {
    // If not fixed, do not show countdown
    if (!isFixed) {
      // hide countdown
      if (countdownTimerEl) countdownTimerEl.style.display = 'none';
      return;
    }
    // Otherwise we show it
    if (countdownTimerEl) countdownTimerEl.style.display = 'block';

    const totalSeconds = 600; 
    let remaining = totalSeconds;

    if (!countdownMinutes || !countdownSeconds || !countdownFillEl) {
      console.log("Countdown elements not found; skipping timer logic.");
      return;
    }

    countdownFillEl.style.width = '0%';
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
      countdownMinutes.textContent = m.toString();
      countdownSeconds.textContent = (s < 10 ? '0' : '') + s;

      const percent = ((totalSeconds - remaining) / totalSeconds) * 100;
      countdownFillEl.style.width = percent + '%';
    }, 1000);
  }

  //------------------------------------------------
  // aggregator error parser
  //------------------------------------------------
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
      } catch (e) {}
    }
    if (errMsg.includes("Pair is unavailable")) return "Pair is unavailable";
    if (errMsg.includes("Unprocessable Entity")) return "Amount not in allowed range";
    return "An error occurred";
  }

  //------------------------------------------------
  // Format ticker & network
  //------------------------------------------------
  function formatTickerAndNetwork(symbol, network) {
    let s = symbol.toUpperCase();
    let net = (network || '').toUpperCase();
    if (net === 'BSC' && s.endsWith('BEP20')) {
      s = s.replace('BEP20','').trim();
    }
    return { ticker: s, network: net };
  }

  //------------------------------------------------
  // Renders the icon + ticker + pill + amount
  // into a targetEl for “You Send” or “You Receive”
  //------------------------------------------------
  function renderCryptoLine(targetEl, coinSymbol, amountValue) {
    // Clear old content
    targetEl.innerHTML = '';

    // Find aggregator info
    const coinInfo = aggregatorCryptos.find(c => c.symbol.toLowerCase() === coinSymbol.toLowerCase());
    if (!coinInfo) {
      // fallback text
      targetEl.textContent = amountValue + ' ' + coinSymbol.toUpperCase();
      return;
    }
    // image fallback
    const fallbackImage = `https://static.simpleswap.io/images/currencies-logo/${coinSymbol.toLowerCase()}.svg`;
    const imgSrc = (coinInfo.image && coinInfo.image.trim() !== '') ? coinInfo.image : fallbackImage;

    // create elements
    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.classList.add('crypto-icon');

    const { ticker, network: net } = formatTickerAndNetwork(coinInfo.symbol, coinInfo.network);

    const tickerSpan = document.createElement('span');
    tickerSpan.textContent = ticker;
    tickerSpan.style.fontWeight = 'bold';

    // pill
    const pill = document.createElement('span');
    pill.classList.add('network-pill');
    pill.textContent = net || '';

    const amtSpan = document.createElement('span');
    amtSpan.classList.add('amount-text');
    amtSpan.textContent = amountValue; 

    // Append
    targetEl.appendChild(imgEl);
    targetEl.appendChild(tickerSpan);
    if (net) {
      // set pill background color if known
      const netKey = net.toUpperCase();
      const color = networkColors[netKey] || '#444';
      pill.style.backgroundColor = color;
      targetEl.appendChild(pill);
    }
    targetEl.appendChild(amtSpan);
  }

  //------------------------------------------------
  // Searching + building dropdown
  //------------------------------------------------
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

  function buildDropdownItems(dropdown, cryptos, onSelect) {
    // ... same as before ...
    // omitted here for brevity, but you keep your existing code
    // that builds the .dropdown-item for each coin
    // then calls onSelect(coin)
  }

  //------------------------------------------------
  // Update direction
  //------------------------------------------------
  function updateUIAfterDirectionChange() {
    // same as before => calls renderCryptoButton for from/to
    // ...
  }

  //------------------------------------------------
  // aggregator warnings
  //------------------------------------------------
  async function fetchWarnings(symbol) { /* ... same as before ... */ }
  function updateWarnings() { /* ... same as before ... */ }

  //------------------------------------------------
  // updateAmounts
  //------------------------------------------------
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
    fetch(`${BACKEND_URL}/api/exchange-estimate?from_currency=${fromCur}&to_currency=${toCur}&from_amount=${fromAmount}&is_fixed=${isFixed}`)
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

  //------------------------------------------------
  // Exchange => show addresses step
  //------------------------------------------------
  exchangeButton.addEventListener('click', () => {
    const fromAmount = parseFloat(fromAmountInput.value) || 0;
    if (!fromAmount) {
      alert("Please enter an amount first.");
      return;
    }
    if (direction === "crypto_to_xmr" && !selectedFromCurrency) {
      alert("Please select a crypto first.");
      return;
    } else if (direction === "xmr_to_crypto" && !selectedToCurrency) {
      alert("Please select a crypto first.");
      return;
    }
    addressesModalContainer.style.display = 'flex';
    addressesStep.style.display = 'block';
    depositStep.style.display = 'none';
  });

  addressesConfirmBtn.onclick = () => {
    const fromAmount = parseFloat(fromAmountInput.value) || 0;
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
        depositStep.style.display = 'block';

        // fill Transaction ID
        if (transactionIdEl) {
          transactionIdEl.textContent = data.aggregator_tx_id || '--';
        }
        // fill deposit address
        if (depositAddressDisplay) {
          depositAddressDisplay.textContent = data.deposit_address || '--';
        }

        // “You Send” / “You Receive” => with icon + pill
        if (modalYouSendEl) {
          renderCryptoLine(modalYouSendEl, fromCur, fromAmount.toString());
        }
        if (modalYouGetEl && data.to_amount) {
          renderCryptoLine(modalYouGetEl, toCur, data.to_amount.toString());
        }

        // QR code
        if (qrcodeContainer && data.deposit_address) {
          qrcodeContainer.innerHTML = '';
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

  //------------------------------------------------
  // pollTransactionStatus
  //------------------------------------------------
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
          // spinner
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
            case 'finished':
            default:
              spinnerEl.style.display = 'none';
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
        })
        .catch(err => {
          console.error("Error polling status:", err);
          clearInterval(interval);
        });
    }, 5000);
  }

  //------------------------------------------------
  // Switch direction logic
  //------------------------------------------------
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

  //------------------------------------------------
  // Show/hide currency dropdown
  //------------------------------------------------
  fromCurrencyButton.addEventListener('click', () => {
    if (direction === "crypto_to_xmr") {
      fromCurrencyDropdown.style.display = 
        (fromCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
    }
  });
  toCurrencyButton.addEventListener('click', () => {
    if (direction === "xmr_to_crypto") {
      toCurrencyDropdown.style.display = 
        (toCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
    }
  });
  document.addEventListener('click', (e) => {
    if (!fromCurrencyDropdown.contains(e.target) && !fromCurrencyButton.contains(e.target)) {
      fromCurrencyDropdown.style.display = 'none';
    }
    if (!toCurrencyDropdown.contains(e.target) && !toCurrencyButton.contains(e.target)) {
      toCurrencyDropdown.style.display = 'none';
    }
  });

  // set up searching
  setupSearch(fromSearchInput, fromCurrencyDropdown);
  setupSearch(toSearchInput, toCurrencyDropdown);

  //------------------------------------------------
  // Build initial dropdown
  //------------------------------------------------
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

  fromAmountInput.addEventListener('input', updateAmounts);

  //------------------------------------------------
  // Fetch aggregator cryptos + fallback logos
  //------------------------------------------------
  fetch(`${BACKEND_URL}/api/all_cryptos`)
    .then(res => res.json())
    .then(cryptos => {
      aggregatorCryptos = cryptos;
      selectedFromCurrency = defaultCrypto; 
      selectedToCurrency   = "XMR";
      fromAmountInput.value = 100;

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

      // auto-refresh every 10s
      setInterval(() => {
        updateAmounts();
      }, 10000);
    })
    .catch(err => console.error("Error fetching cryptos/logos:", err));
});
