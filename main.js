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
  const depositInfo = document.getElementById('deposit-info');
  const depositAddressDisplay = document.getElementById('deposit-address-display');
  const statusDisplay = document.getElementById('status-display');
  const qrcodeContainer = document.getElementById('qrcode');

  const fromWarningEl = document.getElementById('network-warning-from');
  const toWarningEl = document.getElementById('network-warning-to');

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
            // Extract min if available
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

  function renderCryptoButton(buttonEl, symbol, image, network) {
  buttonEl.innerHTML = ''; 
  buttonEl.style.display = 'inline-flex';
  buttonEl.style.alignItems = 'center';
  buttonEl.style.padding = '10px';               // Slightly increase padding for better appearance
  buttonEl.style.background = '#9002c0';         // Set background color to #9002c0
  buttonEl.style.border = 'none';                // Remove the border
  buttonEl.style.borderRadius = '8px';           // Optional: rounded corners for aesthetics
  buttonEl.style.color = '#fff';                 // Optional: set text color to white for better contrast
  buttonEl.style.margin = '0 auto';              // Center the button horizontally
  buttonEl.style.textAlign = 'center';           // Ensure the content is centered
}

    let imgSrc = image && image.trim() !== '' ? image : coingeckoMap[symbol] || 'https://via.placeholder.com/24';

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.alt = `${symbol} logo`;
    imgEl.style.width = '24px';
    imgEl.style.height = '24px';
    imgEl.style.marginRight = '8px';

    const infoDiv = document.createElement('div');
    infoDiv.style.display = 'flex';
    infoDiv.style.flexDirection = 'column';

    let coin = aggregatorCryptos.find(c => c.symbol === symbol);
    let displayName = symbol;
    if (coin && coin.name) {
      displayName = symbol + " - " + coin.name;
    }

    const symbolSpan = document.createElement('span');
    symbolSpan.style.fontWeight = 'bold';
    symbolSpan.style.fontSize = '14px';
    symbolSpan.textContent = displayName;

    const netKey = (network || symbol).toUpperCase();
    const networkDiv = document.createElement('div');
    networkDiv.style.fontSize = '12px';
    networkDiv.style.color = '#fff';
    networkDiv.style.padding = '2px 4px';
    networkDiv.style.borderRadius = '4px';
    networkDiv.style.marginTop = '2px';
    networkDiv.style.display = 'inline-block';
    networkDiv.style.backgroundColor = networkColors[netKey] || '#444';
    networkDiv.textContent = network ? network.toUpperCase() : symbol;

    infoDiv.appendChild(symbolSpan);
    infoDiv.appendChild(networkDiv);

    buttonEl.appendChild(imgEl);
    buttonEl.appendChild(infoDiv);
  };

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
    const existingItems = dropdown.querySelectorAll('.dropdown-item');
    existingItems.forEach(i => i.remove());

    cryptos.forEach(coin => {
      const itemEl = document.createElement('div');
      itemEl.classList.add('dropdown-item');
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.cursor = 'pointer';
      itemEl.style.padding = '5px';

      let imgSrc = coin.image && coin.image.trim() !== '' ? coin.image : (coingeckoMap[coin.symbol] || 'https://via.placeholder.com/24');

      const imgEl = document.createElement('img');
      imgEl.src = imgSrc;
      imgEl.alt = `${coin.symbol} logo`;
      imgEl.style.width = '24px';
      imgEl.style.height = '24px';
      imgEl.style.marginRight = '8px';

      const infoDiv = document.createElement('div');
      infoDiv.style.display = 'flex';
      infoDiv.style.flexDirection = 'column';

      let displayName = coin.symbol;
      if (coin.name) displayName = coin.symbol + " - " + coin.name;

      const symbolSpan = document.createElement('span');
      symbolSpan.style.fontWeight = 'bold';
      symbolSpan.style.fontSize = '14px';
      symbolSpan.textContent = displayName;

      const netKey = (coin.network || coin.symbol).toUpperCase();
      const networkDiv = document.createElement('div');
      networkDiv.style.fontSize = '12px';
      networkDiv.style.color = '#fff';
      networkDiv.style.padding = '2px 4px';
      networkDiv.style.borderRadius = '4px';
      networkDiv.style.marginTop = '2px';
      networkDiv.style.display = 'inline-block';
      networkDiv.style.backgroundColor = networkColors[netKey] || '#444';
      networkDiv.textContent = coin.network ? coin.network.toUpperCase() : coin.symbol;

      infoDiv.appendChild(symbolSpan);
      infoDiv.appendChild(networkDiv);

      itemEl.appendChild(imgEl);
      itemEl.appendChild(infoDiv);

      itemEl.addEventListener('click', () => {
        onSelect(coin);
        dropdown.style.display = 'none';
      });
      dropdown.appendChild(itemEl);
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
    fromWarningEl.style.display = 'none';
    toWarningEl.style.display = 'none';
    fromWarningEl.textContent = "";
    toWarningEl.textContent = "";

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
      // fromData.fromWarnings -> show in network-warning-from
      if (fromData.fromWarnings && fromData.fromWarnings.length > 0) {
        fromWarningEl.style.display = 'block';
        fromWarningEl.textContent = fromData.fromWarnings.join(" ");
      }

      // toData.toWarnings -> show in network-warning-to
      if (toData.toWarnings && toData.toWarnings.length > 0) {
        toWarningEl.style.display = 'block';
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

    // Use lowercase for aggregator
    fetch(`${BACKEND_URL}/api/exchange-estimate?from_currency=${fromCur.toLowerCase()}&from_amount=${fromAmount}`)
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

    const address = prompt(`Enter the recipient's ${toCur.toUpperCase()} address:`);
    if (!address) {
      alert(`${toCur.toUpperCase()} address is required.`);
      return;
    }

    const refundAddress = prompt(`Enter refund address for ${fromCur.toUpperCase()}:`) || "";

    const payload = {
      from_currency: fromCur,
      from_amount: fromAmount,
      address_to: address,
      user_refund_address: refundAddress
    };

    fetch(`${BACKEND_URL}/api/create_exchange?api_key=YOUR_API_KEY&fixed=false`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert("Error creating exchange: " + data.error);
        return;
      }

      depositAddressDisplay.textContent = `Deposit this amount to: ${data.deposit_address}`;
      depositInfo.style.display = 'block';

      qrcodeContainer.innerHTML = "";
      new QRCode(qrcodeContainer, {
        text: data.deposit_address,
        width:128,
        height:128
      });

      pollTransactionStatus(data.transactionId);
    })
    .catch(err => {
      console.error("Error creating exchange:", err);
      alert("Failed to create exchange.");
    });
  });

  function pollTransactionStatus(txId) {
    const interval = setInterval(() => {
      fetch(`${BACKEND_URL}/api/status/${txId}`)
        .then(res => res.json())
        .then(statusData => {
          if (statusData.error) {
            statusDisplay.textContent = `Error: ${statusData.error}`;
            clearInterval(interval);
            return;
          }

          statusDisplay.textContent = `Status: ${statusData.status}`;
          if (statusData.status === 'finished' || statusData.status === 'failed') {
            clearInterval(interval);
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
    
    // Swap currencies
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

  fetch(`${BACKEND_URL}/api/all_cryptos`)
    .then(res => res.json())
    .then(cryptos => {
      aggregatorCryptos = cryptos;
      return fetch(`${BACKEND_URL}/api/cryptos`);
    })
    .then(res => res.json())
    .then(geckoData => {
      geckoData.forEach(g => {
        const ticker = g.ticker.toUpperCase();
        coingeckoMap[ticker] = g.logo; 
      });

      selectedFromCurrency = defaultCrypto; 
      selectedToCurrency = "XMR";
      fromAmountInput.value = 100;

      initializeDropdowns();
      updateUIAfterDirectionChange();
      updateAmounts();
    })
    .catch(err => console.error("Error fetching cryptos:", err));

});
