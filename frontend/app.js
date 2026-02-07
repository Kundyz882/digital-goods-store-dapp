let provider, signer, storeContract, tokenContract, currentAddress;

const STORE_ADDRESS = "0x071926FA95D54af0073A6Cb08Ddc7589de8FFA11";
const TOKEN_ADDRESS = "0xF2ff3E8f17C9Ee20EE9be28Ac92167Cf102Ba043";

const STORE_ABI = [
  "function productCount() view returns (uint256)",
  "function products(uint256) view returns (uint256,string,string,string,uint8,uint256,address,address,bool,bool)",
  "function createProduct(string,string,string,uint8,uint256)",
  "function buyProduct(uint256) payable",
  "function unlistProduct(uint256)",
  "function getMyPurchases() view returns (uint256[])",
  "function getMyListings() view returns (uint256[])",
  "function pendingWithdrawals(address) view returns (uint256)",
  "function withdraw()"
];

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

const CATEGORY = ["Smartphones", "Laptops", "Tablets", "Accessories", "Other"];

let productsCache = [];
let searchTimer = null;

function $(id) { return document.getElementById(id); }

function setScreen(screen) {
  $("screenAuth").classList.toggle("hidden", screen !== "auth");
  $("screenApp").classList.toggle("hidden", screen !== "app");
}

function isConnected() {
  return !!(signer && currentAddress && storeContract && tokenContract);
}

function requireConnected() {
  if (!isConnected()) {
    alert("Connect MetaMask first");
    return false;
  }
  return true;
}


/// ===== Profile (localStorage) =====
function getProfile(address) {
  const raw = localStorage.getItem(`profile_${address}`);
  return raw ? JSON.parse(raw) : null;
}

function renderProfileAuth() {
  if (!currentAddress) {
    $("profileNameAuth").innerText = "Not registered";
    $("avatarBox").innerText = "DS";
    return;
  }

  const profile = getProfile(currentAddress);
  if (!profile) {
    $("profileNameAuth").innerText = "Not registered";
    $("avatarBox").innerText = "DS";
    return;
  }

  $("profileNameAuth").innerText = profile.nick || "User";
  $("avatarBox").innerText = (profile.nick || "DS").slice(0, 2).toUpperCase();
}

function renderProfileTop() {
  if (!currentAddress) {
    $("profileNameTop").innerText = "—";
    return;
  }
  const profile = getProfile(currentAddress);
  $("profileNameTop").innerText = profile ? (profile.nick || "User") : "Not registered";
}

function saveProfileAndEnter() {
  if (!requireConnected()) return;

  const nick = ($("nickname").value || "").trim();
  const avatar = ($("avatar").value || "").trim();

  const profile = { nick: nick || "User", avatar: avatar || "" };
  localStorage.setItem(`profile_${currentAddress}`, JSON.stringify(profile));

  renderProfileAuth();
  enterApp(); 
}

/// ===== Connection =====
async function connect() {
  if (!window.ethereum) return alert("Install MetaMask");

  await window.ethereum.request({ method: "eth_requestAccounts" });

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  currentAddress = await signer.getAddress();

  const network = await provider.getNetwork();
  $("authAccount").innerText = currentAddress;
  $("authNetwork").innerText = `${network.name} (${network.chainId})`;

  if (network.chainId !== 11155111n) {
    alert("Switch MetaMask to Sepolia testnet");
    disconnect(); 
    return;
  }


  storeContract = new ethers.Contract(STORE_ADDRESS, STORE_ABI, signer);
  tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);

  renderProfileAuth();

  const profile = getProfile(currentAddress);
  if (profile) enterApp();
}

function disconnect() {
  provider = null;
  signer = null;
  currentAddress = null;
  storeContract = null;
  tokenContract = null;
  productsCache = [];

  $("authAccount").innerText = "Not connected";
  $("authNetwork").innerText = "—";
  $("account").innerText = "—";
  $("tokenBalance").innerText = "0";
  $("pendingEth").innerText = "0";
  $("profileNameTop").innerText = "—";

  $("products").innerHTML = "";
  $("myListings").innerHTML = "";
  $("myPurchases").innerHTML = "";

  setScreen("auth");
}

async function initFromMetamask() {
  if (!window.ethereum) return;

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    disconnect();
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  currentAddress = await signer.getAddress();

  const network = await provider.getNetwork();
  $("authAccount").innerText = currentAddress;
  $("authNetwork").innerText = `${network.name} (${network.chainId})`;

  if (network.chainId !== 11155111n) {
    alert("Switch MetaMask to Sepolia testnet");
    disconnect();
    return;
  }

  storeContract = new ethers.Contract(STORE_ADDRESS, STORE_ABI, signer);
  tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);

  renderProfileAuth();
}


/// ===== App logic =====
function enterApp() {
  if (!requireConnected()) return;

  const profile = getProfile(currentAddress);
  if (!profile) {
    alert("Please create profile first (Sign Up)");
    setScreen("auth");
    renderProfileAuth();
    return;
  }

  $("account").innerText = currentAddress;
  renderProfileTop();

  setScreen("app");
  showTab("market");

  const search = $("search");
  if (search && !search.dataset.bound) {
    search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applyFilters(), 250);
    });
    search.dataset.bound = "1";
  }

  refreshProducts();
  loadTokenBalance();
  loadPendingEth();
}

function backToAuth() {
  setScreen("auth");
}

function showTab(name) {
  const market = $("tab_market");
  const my = $("tab_my");
  const segMarket = $("segMarket");
  const segMy = $("segMy");
  const line = $("segLine");

  const isMarket = name === "market";
  market.classList.toggle("hidden", !isMarket);
  my.classList.toggle("hidden", isMarket);

  segMarket.classList.toggle("active", isMarket);
  segMy.classList.toggle("active", !isMarket);

  if (line) line.style.transform = isMarket ? "translateX(0%)" : "translateX(100%)";

  if (!isMarket) {
  loadPendingEth();
  loadMyListings();
  loadMyPurchases();
}

}

/// ===== Create Product =====
async function createProduct() {
  
  if (!requireConnected()) return;

  const title = ($("title").value || "").trim();
  const description = ($("description").value || "").trim();
  const imageURI = ($("image").value || "").trim();
  const category = Number($("category").value);
  const priceEth = ($("price").value || "").trim();

  if (!title || !priceEth) return alert("Title and price are required");

  let priceWei;
  try { priceWei = ethers.parseEther(priceEth); }
  catch { return alert("Invalid ETH price"); }

  const tx = await storeContract.createProduct(title, description, imageURI, category, priceWei);
  await tx.wait();

  alert("Product created");
  await refreshProducts();
}
function clearCreateForm() {
  $("title").value = "";
  $("description").value = "";
  $("image").value = "";
  $("category").value = "0";
  $("price").value = "";
}


// ===== Market =====
async function refreshProducts() {
  if (!storeContract) return;

  const count = await storeContract.productCount();
  const arr = [];

  for (let i = 0; i < Number(count); i++) {
    const p = await storeContract.products(i);
    arr.push({
      id: Number(p[0]),
      title: p[1],
      description: p[2],
      imageURI: p[3],
      category: Number(p[4]),
      priceWei: p[5],
      seller: p[6],
      buyer: p[7],
      sold: p[8],
      active: p[9]
    });
  }

  productsCache = arr;
  applyFilters();
}

function applyFilters() {
  const box = $("products");

  if (!productsCache.length) {
    box.innerHTML = `<div class="muted center">No products yet.</div>`;
    return;
  }

  const filterCat = Number($("filterCategory").value);
  const q = (($("search").value || "").trim().toLowerCase());

  const filtered = productsCache.filter(p => {
      if (!p.active || p.sold) return false;

      if (currentAddress && p.seller.toLowerCase() === currentAddress.toLowerCase()) return false;

      if (filterCat !== -1 && p.category !== filterCat) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;

      return true;
    });


  if (!filtered.length) {
    box.innerHTML = `<div class="muted center">No active products.</div>`;
    return;
  }

  renderProducts(filtered);
}


function clearFilters() {
  $("filterCategory").value = "-1";
  $("search").value = "";
  applyFilters();
}

function renderProducts(list) {
  const box = $("products");
  box.innerHTML = "";

  if (!list.length) {
    box.innerHTML = `<div class="muted center">Nothing found.</div>`;
    return;
  }

  for (const p of list) {
    const canBuy =
      isConnected() &&
      p.active &&
      !p.sold &&
      p.seller.toLowerCase() !== currentAddress.toLowerCase();

    box.innerHTML += `
      <div class="card cardClean">
        ${p.imageURI ? `<img class="thumb" src="${p.imageURI}" alt="cover" />`
                    : `<div class="thumb ph">No image</div>`}

        <div class="titleRow">
          <div class="cardTitle">${escapeHtml(p.title)}</div>
          <div class="pill">${CATEGORY[p.category]}</div>
        </div>

        <div class="cardDesc">${escapeHtml(p.description || "")}</div>

        <div class="cardBottom">
          <div class="price">${ethers.formatEther(p.priceWei)} <span class="mutedSmall">ETH</span></div>
          <div class="meta">
            <div><span class="mutedSmall">Seller:</span> ${shortAddr(p.seller)}</div>
            <div><span class="mutedSmall">Status:</span> ${p.sold ? "Sold" : (p.active ? "Active" : "Unlisted")}</div>
          </div>
        </div>

        ${canBuy ? `<button onclick="buy(${p.id})">Buy</button>` : ""}
      </div>
    `;
  }
}

/// ===== Buy & Unlist =====
async function buy(id) {
  if (!requireConnected()) return;

  const product = productsCache.find(x => x.id === id);
  if (!product) return alert("Not found. Refresh.");

  const tx = await storeContract.buyProduct(id, { value: product.priceWei });
  await tx.wait();

  alert("Product purchased!");
  await refreshProducts();
  await loadTokenBalance();
  await loadPendingEth();
}


async function unlist(id) {
  if (!requireConnected()) return;

  try {
    const tx = await storeContract.unlistProduct(id);
    await tx.wait();

    alert("Unlisted successfully");
    await refreshProducts();   
    await loadMyListings();   
  } catch (e) {
    console.error(e);

    const msg =
      e?.info?.error?.message ||
      e?.reason ||
      e?.shortMessage ||
      e?.message ||
      "Unlist failed";

    alert(msg);
  }
}

// ===== My Listings & Purchases =====
async function loadMyListings() {
  if (!requireConnected()) return;

  const ids = await storeContract.getMyListings();
  const box = $("myListings");
  box.innerHTML = "";

  if (ids.length === 0) {
    box.innerHTML = `<small class="muted">No listings yet.</small>`;
    return;
  }

  for (const idBig of ids) {
    const id = Number(idBig);
    const p = await storeContract.products(id);

    const title = p[1];
    const category = CATEGORY[Number(p[4])];
    const price = ethers.formatEther(p[5]);
    const sold = p[8];
    const active = p[9];

    const canUnlist = (!sold && active); 

    box.innerHTML += `
      <div class="rowline">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
          <div>
            <b>${escapeHtml(title)}</b><br/>
            <small>${category}</small><br/>
            <small>${price} ETH • ${sold ? "Sold" : (active ? "Active" : "Unlisted")}</small>
          </div>

          ${canUnlist ? `<button class="ghost" onclick="unlist(${id})">Unlist</button>` : ``}
        </div>
      </div>
    `;
  }
}


async function loadMyPurchases() {
  if (!requireConnected()) return;

  const ids = await storeContract.getMyPurchases();
  const box = $("myPurchases");
  box.innerHTML = "";

  if (ids.length === 0) {
    box.innerHTML = `<small class="muted">No purchases yet.</small>`;
    return;
  }

  for (const idBig of ids) {
    const id = Number(idBig);
    const p = await storeContract.products(id);

    box.innerHTML += `
      <div class="rowline">
        <div>
          <b>${escapeHtml(p[1])}</b><br/>
          <small>Seller: ${shortAddr(p[6])}</small><br/>
          <small>Paid: ${ethers.formatEther(p[5])} ETH</small>
        </div>
      </div>
    `;
  }
}

// ===== Withdraw =====
async function loadTokenBalance() {
  if (!requireConnected()) return;
  const balance = await tokenContract.balanceOf(currentAddress);
  $("tokenBalance").innerText = ethers.formatUnits(balance, 18);
}

async function loadPendingEth() {
  if (!requireConnected()) return;
  const pending = await storeContract.pendingWithdrawals(currentAddress);
  $("pendingEth").innerText = ethers.formatEther(pending);
}

async function withdraw() {
  if (!requireConnected()) return;

  const pending = await storeContract.pendingWithdrawals(currentAddress);
  if (pending === 0n) return alert("Nothing to withdraw");

  const tx = await storeContract.withdraw();
  await tx.wait();

  alert("Withdraw successful");
  await loadPendingEth();
}

// ===== Utils =====
function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("load", async () => {
  setScreen("auth");
  await initFromMetamask();

  if (currentAddress) {
    const profile = getProfile(currentAddress);
    if (profile) enterApp();
  }
});


if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => {
    disconnect();
  });

  window.ethereum.on("chainChanged", () => {
    disconnect();
  });
}


