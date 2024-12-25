document.addEventListener('DOMContentLoaded', () => {
  const BACKEND_URL = "https://meowmeow.ngrok.app"; // Adjust if needed

  let direction = "crypto_to_xmr"; 
  let selectedFromCurrency = null;
  let selectedToCurrency = "XMR";
  const defaultCrypto = "USDTBEP20";

  const fromAmountInput = document.getElementById('from-amount-input');
  const toAmountInput = document.getElementById('to-amount-input');
  toAmountInput.readOnly = true; // Make "You get" read-only

  const fromCurrencyButton = document.getElementById('from-currency-select-button');
  const toCurrencyButton = document.getElementById('to-currency-select-button');
  const fromCurrencyDropdown = document.getElementById('from-currency-dropdown');
  const toCurrencyDropdown = document.getElementById('to-currency-dropdown');
  const fromSearchInput = document.getElementById('from-currency-search');
  const toSearchInput = document.getElementById('to-currency-search');
  const switchButton = document.getElementById('switch-button');
  const exchangeButton = document.getElementById('exchange-button');

  // Modal elements
  const transactionIdEl = document.getElementById('modal-tx-id');
  const depositAddressDisplay = document.getElementById('modal-deposit-address');
  const qrcodeContainer = document.getElementById('modal-qrcode');
  const statusText = document.getElementById('modal-status-text');
  const confirmationsEl = document.getElementById('modal-confirmations');

  const fromWarningEl = document.getElementById('network-warning-from');
  const toWarningEl = document.getElementById('network-warning-to');

  // Step 1 (Addresses) elements
  const addressesStep = document.getElementById('addresses-step');
  const depositStep = document.getElementById('deposit-step');
  const addressesModalContainer = document.getElementById('exchange-modal-container');
  const addressesModalWarning = document.getElementById('addresses-modal-warning');
  const addressesConfirmBtn = document.getElementById('addresses-confirm-btn');
  const recipientAddr = document.getElementById('recipient-addr');
  const refundAddr = document.getElementById('refund-addr');

  let aggregatorCryptos = [];
  let coingeckoMap = {};

  const networkColors = {
    "BITCOIN": "#F7931A",
    "ETH": "#3C3C3D",
    "BSC": "#F0B90B",
    "TRX": "#EC0623",
    "EOS": "#000000",
    "SOL": "#9932CC",
    "XRP": "#346AA9",
    "LTC": "#BFBBBB",
    "ADA": "#0033AD",
    "DOT": "#E6007A",
    "AVAX": "#E84142",
    "MATIC": "#8247E5",
    "FTM": "#1969FF",
    "XMR": "#FF6600",
    "ARB": "#28A0F0",
    "OP": "#FF0420",
    "CRO": "#002D74",
    "ATOM": "#2E3148",
    "XTZ": "#0E75C9",
    "ALGO": "#000000",
    "ZIL": "#49C1BF",
    "NEAR": "#000000",
    "BNB": "#F3BA2F",
    "DOGE": "#C2A633",
    "VET": "#15BDFF",
    "ETC": "#34FA99",
    "DASH": "#008CE7",
    "ZEC": "#F4B728",
    "FIL": "#0090FF",
    "XLM": "#08B5E5",
    "HBAR": "#3A3A3A",
    "KSM": "#000000",
    "FLOW": "#28D9A3",
    "ICP": "#29ABE2",
    "ONE": "#00AEEF",
    "QTUM": "#2C9CED",
    "KAVA": "#FF2D55",
    "XDC": "#F49800",
    "WAVES": "#0055FF",
    "BTG": "#EBA809",
    "BCH": "#8DC351"
  };

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

  // Format ticker and network (like before)
  function formatTickerAndNetwork(symbol, network) {
    let s = symbol.toUpperCase();
    let net = network ? network.toUpperCase() : '';

    // If network is BSC and symbol ends with BEP20, remove 'BEP20'
    if (net === 'BSC' && s.endsWith('BEP20')) {
      s = s.replace('BEP20', '').trim(); // leaves 'USDT'
    }

    return { ticker: s, network: net };
  }

  function renderCryptoButton(buttonEl, symbol, image, network) {
    // Basic button styling
    buttonEl.innerHTML = '';
    buttonEl.style.display = 'inline-flex';
    buttonEl.style.alignItems = 'center';
    buttonEl.style.padding = '10px';
    buttonEl.style.background = '#9002c0';
    buttonEl.style.border = 'none';
    buttonEl.style.borderRadius = '8px';
    buttonEl.style.color = '#fff';
    buttonEl.style.margin = '0 8px 0 0'; // ensure spacing even on mobile
    buttonEl.style.textAlign = 'center';
    buttonEl.style.cursor = 'pointer';
    buttonEl.style.fontWeight = 'bold';
    buttonEl.style.fontSize = '14px';

    const uppercaseSymbol = symbol.toUpperCase();
    const fallbackImage = `https://static.simpleswap.io/images/currencies-logo/${symbol.toLowerCase()}.svg`;
    const imgSrc = (image && image.trim() !== '') ? image : (coingeckoMap[uppercaseSymbol] || fallbackImage);

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.alt = `${symbol} logo`;
    imgEl.style.width = '24px';
    imgEl.style.height = '24px';
    imgEl.style.marginRight = '8px';
    imgEl.style.display = 'block';

    const {ticker, network: net} = formatTickerAndNetwork(symbol, network);

    const textSpan = document.createElement('span');
    textSpan.textContent = ticker;
    textSpan.style.display = 'inline-block';
    textSpan.style.marginRight = '8px';

    buttonEl.appendChild(imgEl);
    buttonEl.appendChild(textSpan);

    // Network pill: all same size
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
      networkPill.style.width = '50px'; // fixed width for consistency
      networkPill.style.textAlign = 'center';
      networkPill.textContent = net;

      buttonEl.appendChild(networkPill);
    }
  }

  function setupSearch(searchInput, dropdown) {
    // Ensure search bar stays at top: already done by making position sticky in buildDropdownItems
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
    const existingItems = dropdown.querySelectorAll('.dropdown-item');
    existingItems.forEach(i => i.remove());

    dropdown.style.background = '#442244';
    dropdown.style.borderRadius = '8px';
    dropdown.style.padding = '0';
    dropdown.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    dropdown.style.maxHeight = '300px';
    dropdown.style.overflow = 'hidden';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '9999';

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
      searchInput.style.width = '100%';
      searchInput.style.padding = '8px';
      searchInput.style.borderRadius = '5px';
      searchInput.style.border = 'none';
      searchInput.style.fontSize = '14px';
      searchInput.style.outline = 'none';
      searchInput.style.color = '#000';
      searchInput.placeholder = "Search...";
      searchInput.style.boxSizing = 'border-box';

      dropdown.appendChild(searchContainer);
    }

    let itemsContainer = dropdown.querySelector('.dropdown-items-container');
    if (!itemsContainer) {
      itemsContainer = document.createElement('div');
      itemsContainer.classList.add('dropdown-items-container');
      itemsContainer.style.padding = '10px';
      itemsContainer.style.overflowY = 'auto';
      itemsContainer.style.maxHeight = 'calc(300px - 60px)'; 
      // Keep space for search at top
      dropdown.appendChild(itemsContainer);
    } else {
      itemsContainer.innerHTML = '';
    }

    cryptos.forEach(coin => {
      const itemEl = document.createElement('div');
      itemEl.classList.add('dropdown-item');
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.justifyContent = 'center'; // center the entire content
      itemEl.style.cursor = 'pointer';
      itemEl.style.padding = '8px';
      itemEl.style.background = '#333';
      itemEl.style.borderRadius = '5px';
      itemEl.style.marginBottom = '8px';
      itemEl.style.transition = 'background 0.2s ease';

      itemEl.addEventListener('mouseover', () => {
        itemEl.style.background = '#444';
      });
      itemEl.addEventListener('mouseout', () => {
        itemEl.style.background = '#333';
      });

      const uppercaseSymbol = coin.symbol.toUpperCase();
      const fallbackImage = `https://static.simpleswap.io/images/currencies-logo/${coin.symbol.toLowerCase()}.svg`;
      const imgSrc = (coin.image && coin.image.trim() !== '')
        ? coin.image
        : (coingeckoMap[uppercaseSymbol] || fallbackImage);

      const imgEl = document.createElement('img');
      imgEl.src = imgSrc;
      imgEl.alt = `${coin.symbol} logo`;
      imgEl.style.width = '24px';
      imgEl.style.height = '24px';
      imgEl.style.marginRight = '8px';
      imgEl.style.display = 'block';

      const infoDiv = document.createElement('div');
      infoDiv.style.display = 'flex';
      infoDiv.style.flexDirection = 'column';
      infoDiv.style.alignItems = 'center'; // center text inside

      const symbolSpan = document.createElement('span');
      symbolSpan.style.fontWeight = 'bold';
      symbolSpan.style.fontSize = '14px';
      symbolSpan.style.color = '#fff';
      symbolSpan.textContent = uppercaseSymbol;

      const nameSpan = document.createElement('span');
      nameSpan.style.fontSize = '12px';
      nameSpan.style.color = '#ddd';
      nameSpan.style.marginTop = '2px';
      nameSpan.textContent = coin.name || '';

      const netKey = (coin.network || coin.symbol).toUpperCase();
      const networkDiv = document.createElement('div');
      networkDiv.style.fontSize = '10px';
      networkDiv.style.color = '#fff';
      networkDiv.style.padding = '2px 4px';
      networkDiv.style.borderRadius = '4px';
      networkDiv.style.marginTop = '4px';
      networkDiv.style.display = 'inline-block';
      networkDiv.style.backgroundColor = networkColors[netKey] || '#444';
      networkDiv.style.width = '40px'; // fixed width for consistency
      networkDiv.style.textAlign = 'center';
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

  function updateUIAfterDirectionChange() {
    if (direction === "crypto_to_xmr") {
      let fromCoin = aggregatorCryptos.find(c => c.symbol === selectedFromCurrency);
      if (!fromCoin) {
        selectedFromCurrency = defaultCrypto;
        fromCoin = aggregatorCryptos.find(c => c.symbol === defaultCrypto);
      }
      renderCryptoButton(fromCurrencyButton, fromCoin.symbol, fromCoin.image, fromCoin.network);

      let xmrCoin = aggregatorCryptos.find(c => c.symbol === "XMR");
      if (!xmrCoin) xmrCoin = {symbol:"XMR", image:"", network:"xmr"};
      renderCryptoButton(toCurrencyButton, xmrCoin.symbol, xmrCoin.image, xmrCoin.network);

      toCurrencyButton.style.pointerEvents = 'none';
      fromCurrencyButton.style.pointerEvents = 'auto';
    } else {
      let xmrCoin = aggregatorCryptos.find(c => c.symbol === "XMR");
      if (!xmrCoin) xmrCoin = {symbol:"XMR", image:"", network:"xmr"};
      renderCryptoButton(fromCurrencyButton, xmrCoin.symbol, xmrCoin.image, xmrCoin.network);

      let toCoin = aggregatorCryptos.find(c => c.symbol === selectedToCurrency);
      if (!toCoin) {
        selectedToCurrency = defaultCrypto;
        toCoin = aggregatorCryptos.find(c => c.symbol === defaultCrypto);
      }
      renderCryptoButton(toCurrencyButton, toCoin.symbol, toCoin.image, toCoin.network);

      fromCurrencyButton.style.pointerEvents = 'none';
      toCurrencyButton.style.pointerEvents = 'auto';
    }

    updateWarnings();
  }

  function updateWarnings() {
    if (fromWarningEl) {
      fromWarningEl.style.display = 'none';
      fromWarningEl.textContent = "";
    }
    if (toWarningEl) {
      toWarningEl.style.display = 'none';
      toWarningEl.textContent = "";
    }

    let fromCur, toCur;
    if (direction === "crypto_to_xmr") {
      fromCur = selectedFromCurrency;
      toCur = "XMR";
    } else {
      fromCur = "XMR";
      toCur = selectedToCurrency;
    }

    if (!fromCur || !toCur) return;

    function fetchWarnings(symbol) {
      return fetch(`${BACKEND_URL}/api/get_currency?symbol=${symbol.toLowerCase()}`)
        .then(r => r.json())
        .then(d => {
          return {
            fromWarnings: d.warnings_from || [],
            toWarnings: d.warnings_to || []
          };
        })
        .catch(err => {
          console.error("Error fetching currency warnings:", err);
          return {fromWarnings:[], toWarnings:[]};
        });
    }

    Promise.all([
      fetchWarnings(fromCur),
      fetchWarnings(toCur)
    ]).then(([fromData, toData]) => {
      if (fromData.fromWarnings && fromData.fromWarnings.length > 0 && fromWarningEl) {
        fromWarningEl.style.display = 'block';
        fromWarningEl.style.color = '#ffb700';
        fromWarningEl.textContent = fromData.fromWarnings.join(" ");
      }

      if (toData.toWarnings && toData.toWarnings.length > 0 && toWarningEl) {
        toWarningEl.style.display = 'block';
        toWarningEl.style.color = '#ffb700';
        toWarningEl.textContent = toData.toWarnings.join(" ");
      }
    });
  }

  function updateAmounts() {
    const fromAmount = parseFloat(fromAmountInput.value);
    if (!fromAmount) {
      toAmountInput.value = "--";
      return;
    }

    let fromCur, toCur;
    if (direction === "crypto_to_xmr") {
      fromCur = selectedFromCurrency;
      toCur = "xmr";
    } else {
      fromCur = "xmr";
      toCur = selectedToCurrency;
    }

    if (!fromCur || !toCur) {
      toAmountInput.value = "--";
      return;
    }

    fetch(`${BACKEND_URL}/api/exchange-estimate?from_currency=${fromCur.toLowerCase()}&to_currency=${toCur.toLowerCase()}&from_amount=${fromAmount}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          const desc = parseErrorDescription(data.error);
          toAmountInput.value = desc;
          return;
        }
        toAmountInput.value = data.to_amount.toFixed(6);
      })
      .catch(err => {
        console.error("Error fetching estimate:", err);
        toAmountInput.value = "Error";
      });
  }

  // ---------------------------------------------
  // Updated Exchange Flow: two-step modal approach
  // ---------------------------------------------
  exchangeButton.addEventListener('click', () => {
    const fromAmount = parseFloat(fromAmountInput.value);
    if (!fromAmount) {
      alert("Please enter an amount first.");
      return;
    }

    let fromCur, toCur;
    if (direction === "crypto_to_xmr") {
      fromCur = selectedFromCurrency;
      toCur = "xmr";
      if (!fromCur) {
        alert("Please select a crypto first.");
        return;
      }
    } else {
      fromCur = "xmr";
      toCur = selectedToCurrency;
      if (!toCur) {
        alert("Please select a crypto first.");
        return;
      }
    }

    // Show the modal container and Step 1 (addresses)
    addressesModalContainer.style.display = 'flex';
    addressesStep.style.display = 'block';
    depositStep.style.display = 'none';

    // Clear old data
    addressesModalWarning.textContent = "";
    recipientAddr.value = "";
    refundAddr.value = "";

    // Optionally fetch warnings for the "to" currency:
    fetch(`${BACKEND_URL}/api/get_currency?symbol=${toCur.toLowerCase()}`)
      .then(r => r.json())
      .then(data => {
        if (data.warnings_to && data.warnings_to.length > 0) {
          addressesModalWarning.textContent = data.warnings_to.join(" ");
        }
      })
      .catch(err => console.error("Error fetching warnings for toCur:", err));

    // On "Confirm" in the addresses step
    addressesConfirmBtn.onclick = () => {
      const addressInput = recipientAddr.value.trim();
      const refundInput = refundAddr.value.trim();

      if (!addressInput) {
        alert(`${toCur.toUpperCase()} address is required.`);
        return;
      }

      // Hide addresses step (remain in same container)
      addressesStep.style.display = 'none';

      // Build the payload
      const payload = {
        from_currency: fromCur,
        to_currency: toCur, // ADDED THIS LINE
        from_amount: fromAmount,
        address_to: addressInput,
        user_refund_address: refundInput
      };

      // Create the exchange
      fetch(`${BACKEND_URL}/api/create_exchange?api_key=YOUR_API_KEY&fixed=false`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert("Error creating exchange: " + data.error);
          // If you want to let them retry or go back to addresses step, do so here
          return;
        }

        // Show deposit step
        depositStep.style.display = 'block';

        // Update transaction ID
        if (transactionIdEl) {
          transactionIdEl.textContent = `Transaction ID: ${data.aggregator_tx_id}`;
        }

        // Update deposit address
        if (depositAddressDisplay) {
          depositAddressDisplay.textContent = `Deposit Address: ${data.deposit_address}`;
        }

        // Generate the QR code in the modal
        if (qrcodeContainer) {
          qrcodeContainer.innerHTML = "";
          new QRCode(qrcodeContainer, {
            text: data.deposit_address,
            width:128,
            height:128
          });
        }

        pollTransactionStatus(data.transactionId);
      })
      .catch(err => {
        console.error("Error creating exchange:", err);
        alert("Failed to create exchange.");
      });
    };
  });

  function pollTransactionStatus(txId) {
    const interval = setInterval(() => {
      fetch(`${BACKEND_URL}/api/status/${txId}`)
        .then(res => res.json())
        .then(statusData => {
          if (statusData.error) {
            if (statusText) statusText.textContent = `Error: ${statusData.error}`;
            clearInterval(interval);
            return;
          }

          const modalStatusText = document.getElementById('modal-status-text');
          const modalConfirmations = document.getElementById('modal-confirmations');
          if (!modalStatusText || !modalConfirmations) return;

          // Remove existing status classes
          modalStatusText.className = '';
          modalConfirmations.textContent = '';

          switch(statusData.status) {
            case 'waiting':
              modalStatusText.classList.add('status-waiting');
              modalStatusText.textContent = "Awaiting Deposit";
              break;
            case 'confirming':
              modalStatusText.classList.add('status-confirming');
              modalStatusText.textContent = "Confirming";
              if (statusData.confirmations !== undefined && statusData.required_confirmations !== undefined) {
                modalConfirmations.textContent = `Confirmations: ${statusData.confirmations}/${statusData.required_confirmations}`;
              }
              break;
            case 'exchanging':
              modalStatusText.classList.add('status-exchanging');
              modalStatusText.textContent = "Exchanging";
              break;
            case 'sending':
              modalStatusText.classList.add('status-sending');
              modalStatusText.textContent = "Sending";
              if (statusData.confirmations !== undefined && statusData.required_confirmations !== undefined) {
                modalConfirmations.textContent = `Confirmations: ${statusData.confirmations}/${statusData.required_confirmations}`;
              }
              break;
            case 'finished':
              modalStatusText.classList.add('status-finished');
              modalStatusText.textContent = "Finished";
              clearInterval(interval);
              break;
            default:
              modalStatusText.textContent = "Unknown Status";
          }
        })
        .catch(err => {
          console.error("Error polling status:", err);
          clearInterval(interval);
        });
    }, 5000);
  }

  switchButton.addEventListener('click', () => {
    const oldDirection = direction;
    direction = (direction === "crypto_to_xmr") ? "xmr_to_crypto" : "crypto_to_xmr";
    
    if (oldDirection === "crypto_to_xmr" && direction === "xmr_to_crypto") {
      let temp = selectedFromCurrency;
      selectedFromCurrency = "XMR";
      selectedToCurrency = temp;
    } else if (oldDirection === "xmr_to_crypto" && direction === "crypto_to_xmr") {
      let temp = selectedToCurrency;
      selectedToCurrency = "XMR";
      selectedFromCurrency = temp;
    }

    updateUIAfterDirectionChange();
    updateAmounts();
  });

  fromCurrencyButton.addEventListener('click', (e) => {
    if (direction === "crypto_to_xmr") {
      fromCurrencyDropdown.style.display = (fromCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
    }
  });

  toCurrencyButton.addEventListener('click', (e) => {
    if (direction === "xmr_to_crypto") {
      toCurrencyDropdown.style.display = (toCurrencyDropdown.style.display === 'block') ? 'none' : 'block';
    }
  });

  setupSearch(fromSearchInput, fromCurrencyDropdown);
  setupSearch(toSearchInput, toCurrencyDropdown);

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

  document.addEventListener('click', (e) => {
    if (!fromCurrencyDropdown.contains(e.target) && !fromCurrencyButton.contains(e.target)) {
      fromCurrencyDropdown.style.display = 'none';
    }
    if (!toCurrencyDropdown.contains(e.target) && !toCurrencyButton.contains(e.target)) {
      toCurrencyDropdown.style.display = 'none';
    }
  });

  // Fetch aggregator cryptos first
  fetch(`${BACKEND_URL}/api/all_cryptos`)
    .then(res => res.json())
    .then(cryptos => {
      aggregatorCryptos = cryptos;
      selectedFromCurrency = defaultCrypto; 
      selectedToCurrency = "XMR";
      fromAmountInput.value = 100;

      // Fetch CoinGecko data for fallback logos
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

      // Refresh amounts every 10 seconds
      setInterval(() => {
        updateAmounts();
      }, 10000);
    })
    .catch(err => console.error("Error fetching cryptos:", err));
});
