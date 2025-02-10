const { ethers } = require("ethers");
require("dotenv").config(); // ✅ Load environment variables

// Replace with your provider (Infura, Alchemy, etc.)

const PRIVATE_KEY = process.env.WALLET_PK_DEV;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS_DEV;
const RPC_URL = process.env.RPC_URL;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log(`✅ Wallet Loaded: ${wallet.address}`);
// We need to fetch prices from liquidity pools on PulseX
// PulseX V1:
// WPLS/DAI(eth):  0xe56043671df55de5cdf8459710433c10324de0ae
// WPLS/PLSX:      0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9
// WPLS/INC:       0xf808bb6265e9ca27002c0a04562bf50d4fe37eaa
// WPLS/HEX:       0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65
// WPLS/WETH:      0x42abdfdb63f3282033c766e72cc4810738571609

// PulseX V2:
// WPLS/DAI(pulse): 0xae8429918fdbf9a5867e3243697637dc56aa76a1
// WPLS/PLSX:       0x149b2c629e652f2e89e11cd57e5d4d77ee166f9f
// eHEX/pHEX:       0x922723fc4de3122f7dc837e2cd2b82dce9da81d2
// eDAI/pDAI:       0xfc64556faa683e6087f425819c7ca3c558e13ac1
// WPLS/pWBTC:      0xe0e1f83a1c64cf65c1a86d7f3445fc4f58f7dcbf

// ✅ PulseX Router ABI (minimal)
const routerABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable external returns (uint[] memory amounts)",
];

// ✅ Create router contract instance
// Router Addresses V1 and V2
const routerAddressV1 = "0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02"; // Replace with PulseX router address V1
const routerAddressV2 = "0x165C3410fC91EF562C50559f7d2289fEbed552d9"; // Replace with PulseX router address V2

// ✅ Define Swap Parameters
const WPLS_ADDRESS = "0xa1077a294dde1b09bb078844df40758a5d0f9a27"; // WPLS
const TOKEN_ADDRESS = "0xefd766ccb38eaf1dfd701853bfce31359239f305"; // Replace with the token you want to buy (e.g., DAI)

// ✅ Swap Config
const AMOUNT_IN_ETH = "0.01"; // Amount of WPLS to swap
const SLIPPAGE_TOLERANCE = 0.01; // 1% slippage

const router = new ethers.Contract(routerAddressV2, routerABI, wallet); // ✅ Ethers contract instance

async function checkBalance() {
  const balance = await provider.getBalance(wallet.address);
  console.log(
    `💰 Native PLS Balance: ${ethers.utils.formatEther(balance)} PLS`
  );
}
checkBalance();

async function swapWPLSForToken() {
  try {
    console.log(
      `🔄 Fetching expected output amount for ${AMOUNT_IN_ETH} WPLS...`
    );

    // ✅ Convert 0.01 WPLS to Wei
    const amountIn = ethers.utils.parseEther(AMOUNT_IN_ETH);
    const path = [WPLS_ADDRESS, TOKEN_ADDRESS]; // WPLS → TOKEN
    const amountsOut = await router.getAmountsOut(amountIn, path);

    // ✅ Fix underflow issue: Ensure `BigNumber` calculations are correct
    const amountOutMin = amountsOut[1].sub(
      amountsOut[1]
        .mul(ethers.BigNumber.from(Math.floor(SLIPPAGE_TOLERANCE * 100)))
        .div(100)
    );

    console.log(
      `✅ Estimated Output: ${ethers.utils.formatUnits(
        amountsOut[1],
        18
      )} Tokens`
    );
    console.log(
      `✅ Minimum Output (after slippage): ${ethers.utils.formatUnits(
        amountOutMin,
        18
      )} Tokens`
    );

    // ✅ Execute swap transaction
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5-minute deadline
    console.log(`⏳ Swapping ${AMOUNT_IN_ETH} WPLS for Tokens...`);

    const tx = await router.swapExactETHForTokens(
      amountOutMin,
      path,
      wallet.address,
      deadline,
      { value: amountIn, gasLimit: 300000 }
    );

    console.log(`✅ Swap TX Sent: ${tx.hash}`);
    console.log("⏳ Waiting for transaction confirmation...");

    const receipt = await tx.wait();
    console.log(`🎉 Swap Successful! TX Hash: ${receipt.transactionHash}`);
  } catch (error) {
    console.error("❌ Swap Failed:", error);
  }
}

// ✅ Run the swap function
swapWPLSForToken();
