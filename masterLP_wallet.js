const { ethers } = require("ethers");
require("dotenv").config(); // Load environment variables
const { pairABI, factoryABI, routerABI, erc20ABI } = require("./abis.js"); // Import ABIs using require()
const addresses = require("./addresses.js"); // Import addresses
const XLSX = require("xlsx");
const fs = require("fs");

// Get provider
const RPC_URL = process.env.RPC_URL;
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Insert wallet number
let wallet_number = 2;

// Initialize global variables
let feePercentage = 0.22;
let tokenAlt = 0;
let token0LiqUSD = 0;
let token1LiqUSD = 0;
let pricePLSInUSD = 0;
let decimals0;
let decimals1;
let symbol0;
let symbol1;
let priceHelp;
let price0inUSD;
let price1inUSD;

// Array to store the results
let resultsAllPools = [];
let resultsUserPools = [];
let totalResults = [];

// Factory Address (same for V1 and V2)
const factoryAddress = "0x1715a3E4A142d8b698131108995174F37aEBA10D"; // Replace with PulseX factory address

// Router Addresses V1 and V2
const routerAddressV1 = "0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02"; // Replace with PulseX router address V1
const routerAddressV2 = "0x165C3410fC91EF562C50559f7d2289fEbed552d9"; // Replace with PulseX router address V2

// Get contract instances Factory and Router (V1 and V2!)
const factory = new ethers.Contract(factoryAddress, factoryABI, provider);
const routerV1 = new ethers.Contract(routerAddressV1, routerABI, provider);
const routerV2 = new ethers.Contract(routerAddressV2, routerABI, provider);

// Function to get the Token Symbols (tickers)
async function getTokenSymbol(tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
    return await tokenContract.symbol();
  } catch (error) {
    console.error(`Error fetching symbol for ${tokenAddress}:`, error);
    return "Unknown";
  }
}

// List of Known LP Pairs (manually add known pairs to avoid scanning all)
// Create a mapping with names, addresses
const poolAddresses = [
  { name: "WPLS_pDAI", address: addresses.POOLADDY_WPLS_pDAI },
  { name: "WPLS_PLSX", address: addresses.POOLADDY_WPLS_PLSX },
  { name: "eHEX_pHEX", address: addresses.POOLADDY_eHEX_pHEX },
  { name: "eDAI_pDAI", address: addresses.POOLADDY_eDAI_pDAI },
  { name: "WPLS_pWBTC", address: addresses.POOLADDY_WPLS_pWBTC },
  { name: "WPLS_DAI", address: addresses.POOLADDY_WPLS_DAI },
  { name: "WPLS_USDC", address: addresses.POOLADDY_WPLS_USDC },
  { name: "WPLS_INC", address: addresses.POOLADDY_WPLS_INC },
  { name: "WPLS_pWETH", address: addresses.POOLADDY_WPLS_pWETH },
  { name: "WPLS_pUSDT", address: addresses.POOLADDY_WPLS_pUSDT },
  { name: "PLSX_DAI", address: addresses.POOLADDY_PLSX_DAI },
  { name: "WPLS_pHEX", address: addresses.POOLADDY_WPLS_pHEX },
  { name: "WPLS_pumpDai", address: addresses.POOLADDY_WPLS_pumpDai },
  { name: "WPLS_pumpSOL", address: addresses.POOLADDY_WPLS_pumpSOL },
  { name: "WPLS_pumpBTC", address: addresses.POOLADDY_WPLS_pumpBTC },
  { name: "WPLS_pumpDOGE", address: addresses.POOLADDY_WPLS_pumpDOGE },
  { name: "WPLS_pumpTRX", address: addresses.POOLADDY_WPLS_pumpTRX },
  { name: "WPLS_pumpPLSX", address: addresses.POOLADDY_WPLS_pumpPLSX },
  { name: "WPLS_pumpXRP", address: addresses.POOLADDY_WPLS_pumpXRP },
  { name: "WPLS_pumpBNB", address: addresses.POOLADDY_WPLS_pumpBNB },
  { name: "WPLS_pumpADA", address: addresses.POOLADDY_WPLS_pumpADA },
  { name: "WPLS_pumpMOST", address: addresses.POOLADDY_WPLS_pumpMOST },
  { name: "WPLS_pumpPUMP", address: addresses.POOLADDY_WPLS_pumpPUMP },
];

// Read information of LP position user's wallet
async function getUserLPTokens(wallet_number) {
  const WALLET_ADDRESS = process.env[`WALLET_ADDRESS_${wallet_number}`];

  console.log(
    `Checking LP tokens for wallet ${wallet_number}: ${WALLET_ADDRESS}`
  );

  // Store LPs in array
  // Loop over all LP pairs
  // for (let pairAddress of poolAddresses) {
  // Store LPs in array (now with both name and address)
  for (let pool of poolAddresses) {
    const poolName = pool.name; // e.g., "WPLS_pDAI", "WPLS_PLSX", etc.
    const pairAddress = pool.address; // The actual contract address
    const lpToken = new ethers.Contract(pairAddress, erc20ABI, provider);

    // Get LP token balance
    const balance = await lpToken.balanceOf(WALLET_ADDRESS);
    //if (balance.gt(0)) {
    // Only process if balance > 0
    // Get token symbol
    const lpSymbol = await lpToken.symbol();

    // Fetch reserves & token pair
    const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();
    const [reserve0, reserve1] = await pairContract.getReserves();
    const totalSupply = await lpToken.totalSupply();

    // Fetch token symbols for token0 & token1
    const symbol0 = await getTokenSymbol(token0);
    const symbol1 = await getTokenSymbol(token1);

    // Convert reserves and balances to BigNumber
    const reserve0BN = ethers.BigNumber.from(reserve0);
    const reserve1BN = ethers.BigNumber.from(reserve1);
    const balanceBN = ethers.BigNumber.from(balance);
    const totalSupplyBN = ethers.BigNumber.from(totalSupply);

    // Calculate user's share safely (userLiquidity = (balance / totalSupply) * reserves)
    const userLiquidity0 = balanceBN.mul(reserve0BN).div(totalSupplyBN);
    const userLiquidity1 = balanceBN.mul(reserve1BN).div(totalSupplyBN);
    const sharePercent =
      balanceBN.mul(10000).div(totalSupplyBN).toNumber() / 100; // Convert to float with 2 decimals

    // Format the user liquidity values (userLiquidity0 and userLiquidity1)
    let userLiquidity0Formatted = ethers.utils
      .formatUnits(userLiquidity0, 18)
      .replace(".", ",");
    let userLiquidity1Formatted = ethers.utils
      .formatUnits(userLiquidity1, 18)
      .replace(".", ",");

    // Format the share percent value
    let sharePercentFormatted = sharePercent.toFixed(2).replace(".", ",");

    // Format the balance value
    let formattedBalance = ethers.utils
      .formatUnits(balanceBN, 18)
      .replace(".", ",");

    resultsUserPools.push({
      lpSymbol, // LP token name
      token0: token0,
      token1: token1,
      balance: formattedBalance,
      sharePercent: sharePercentFormatted,
      userLiquidity0: userLiquidity0Formatted,
      userLiquidity1: userLiquidity1Formatted,
    });

    //}
  }
  console.log(resultsUserPools);
}

// Function to determine the price of the native token PLS
// We need to derive this price from the largest LP: WPLS/DAI LP
async function getPoolReservesPLS() {
  const poolContract = new ethers.Contract(
    addresses.POOLADDY_WPLS_DAI,
    pairABI,
    provider
  );

  // Get token addresses
  const token0 = await poolContract.token0();
  const token1 = await poolContract.token1();

  // Create ERC-20 contract instances for both tokens
  const token0Contract = new ethers.Contract(token0, erc20ABI, provider);
  const token1Contract = new ethers.Contract(token1, erc20ABI, provider);

  // Get reserves
  const [reserve0, reserve1] = await poolContract.getReserves();

  console.log(`Token 0: ${token0}, Reserve 0: ${reserve0}`);
  console.log(`Token 1: ${token1}, Reserve 1: ${reserve1}`);

  // Fetch decimals & symbol for both tokens
  [decimals0, symbol0, decimals1, symbol1] = await Promise.all([
    token0Contract.decimals(),
    token0Contract.symbol(),
    token1Contract.decimals(),
    token1Contract.symbol(),
  ]);

  // Check which token is WPLS and which is DAI
  if (token0.toLowerCase() === addresses.WPLS_ADDRESS.toLowerCase()) {
    pricePLSInUSD =
      Number(ethers.utils.formatUnits(reserve1, decimals1)) /
      Number(ethers.utils.formatUnits(reserve0, decimals0));
  } else {
    pricePLSInUSD =
      Number(ethers.utils.formatUnits(reserve0, decimals0)) /
      Number(ethers.utils.formatUnits(reserve1, decimals1));
  }
}

// This is a helper function for pools with TWO NON-NATIVE tokens
// Suppose we have two non native pools: a HEX/INC pool
// This HEX/INC pool only gives their relative prices
// To determine the USD prices as well, we also need PLS/HEX and PLS/INC pools
async function getPoolReservesHelper(poolAddress) {
  const poolContract = new ethers.Contract(poolAddress, pairABI, provider);

  // Get token addresses
  const token0 = await poolContract.token0();
  const token1 = await poolContract.token1();

  // Create ERC-20 contract instances for both tokens
  const token0Contract = new ethers.Contract(token0, erc20ABI, provider);
  const token1Contract = new ethers.Contract(token1, erc20ABI, provider);

  // Get reserves
  const [reserve0, reserve1] = await poolContract.getReserves();

  console.log(`Token 0: ${token0}, Reserve 0: ${reserve0}`);
  console.log(`Token 1: ${token1}, Reserve 1: ${reserve1}`);

  // Fetch decimals & symbol for both tokens
  [decimals0, symbol0, decimals1, symbol1] = await Promise.all([
    token0Contract.decimals(),
    token0Contract.symbol(),
    token1Contract.decimals(),
    token1Contract.symbol(),
  ]);

  // Check which token is WPLS and which is the other token
  // priceHelp is intermediate step to convert to price in PLS
  if (token0.toLowerCase() === addresses.WPLS_ADDRESS.toLowerCase()) {
    priceHelp =
      Number(ethers.utils.formatUnits(reserve1, decimals1)) /
      Number(ethers.utils.formatUnits(reserve0, decimals0));
  } else {
    priceHelp =
      Number(ethers.utils.formatUnits(reserve0, decimals0)) /
      Number(ethers.utils.formatUnits(reserve1, decimals1));
  }
}

// Function for reserves and prices of pools with NATIVE PLS
async function getPoolReservesALT(poolAddress) {
  const poolContract = new ethers.Contract(poolAddress, pairABI, provider);

  // Get token addresses
  const token0 = await poolContract.token0();
  const token1 = await poolContract.token1();

  // Create ERC-20 contract instances for both tokens
  const token0Contract = new ethers.Contract(token0, erc20ABI, provider);
  const token1Contract = new ethers.Contract(token1, erc20ABI, provider);

  // Fetch decimals & symbol for both tokens
  [decimals0, symbol0, decimals1, symbol1] = await Promise.all([
    token0Contract.decimals(),
    token0Contract.symbol(),
    token1Contract.decimals(),
    token1Contract.symbol(),
  ]);

  // Get reserves
  const [reserve0, reserve1] = await poolContract.getReserves();

  console.log(
    `🔹 Token 0: ${symbol0} (${token0}) | Decimals: ${decimals0} | Reserve 0: ${reserve0}`
  );
  console.log(
    `🔹 Token 1: ${symbol1} (${token1}) | Decimals: ${decimals1} | Reserve 1: ${reserve1}`
  );

  // Check which token is WPLS and which is DAI
  if (token0.toLowerCase() === addresses.WPLS_ADDRESS.toLowerCase()) {
    currentPrice =
      Number(ethers.utils.formatUnits(reserve1, decimals1)) /
      Number(ethers.utils.formatUnits(reserve0, decimals0));
    tokenAlt = symbol1;
  } else {
    currentPrice =
      Number(ethers.utils.formatUnits(reserve0, decimals0)) /
      Number(ethers.utils.formatUnits(reserve1, decimals1));
    tokenAlt = symbol0;
  }

  // Use correct prices for USD values of liquidity and volumes
  if (
    // Pools with TWO NON-NATIVE TOKENS
    poolAddress.toLowerCase() === addresses.POOLADDY_eHEX_pHEX.toLowerCase()
  ) {
    price0inUSD = price0inUSD;
    price1inUSD = price1inUSD;
  } else if (
    // Pools with TWO NON-NATIVE TOKENS, of which ONE STABLE (DAI, USDC, USDT)
    poolAddress.toLowerCase() === addresses.POOLADDY_eDAI_pDAI.toLowerCase()
  ) {
    // Pool with stable coin DAI/USDC/USDT equal to 1
    price0inUSD = 1 / currentPrice;
    price1inUSD = 1;
    console.log(price0inUSD);
    console.log(price1inUSD);
  } else if (
    // Pools with TWO NON-NATIVE TOKENS, of which ONE STABLE (DAI, USDC, USDT)
    (poolAddress.toLowerCase() === addresses.POOLADDY_WPLS_DAI.toLowerCase()) |
    (poolAddress.toLowerCase() === addresses.POOLADDY_WPLS_USDC.toLowerCase()) |
    (poolAddress.toLowerCase() === addresses.POOLADDY_PLSX_DAI.toLowerCase())
  ) {
    if (
      (token0.toLowerCase() === addresses.USDC_ADDRESS.toLowerCase()) |
      (token0.toLowerCase() === addresses.DAI_ADDRESS.toLowerCase())
    ) {
      price0inUSD = 1;
      price1inUSD = pricePLSInUSD;
    } else {
      price0inUSD = pricePLSInUSD;
      price1inUSD = 1;
    }
  } else {
    // For OTHER pools paired with PLS: Transform price in USD as follows:
    if (token0.toLowerCase() === addresses.WPLS_ADDRESS.toLowerCase()) {
      price0inUSD = pricePLSInUSD;
      price1inUSD = pricePLSInUSD / currentPrice;
    } else {
      price0inUSD = pricePLSInUSD / currentPrice;
      price1inUSD = pricePLSInUSD;
    }
  }

  token0LiqUSD = ((reserve0 * price0inUSD) / 10 ** decimals0).toFixed(0);
  token1LiqUSD = ((reserve1 * price1inUSD) / 10 ** decimals1).toFixed(0);
  console.log(`Liquidity ${symbol0}: `, token0LiqUSD);
  console.log(`Liquidity ${symbol1}: `, token1LiqUSD);
}

// ✅ Use `await` to ensure `pricePLSInUSD` is updated before logging
async function getPriceAndLiq(poolAddress) {
  // First get the price of PLS (base token in most pairs!)
  await getPoolReservesPLS();
  console.log(`✅ WPLS Price in DAI: ${pricePLSInUSD} DAI`);

  // For pools NOT paired with PLS: We first need to derive PLS price
  if (
    poolAddress.toLowerCase() === addresses.POOLADDY_eHEX_pHEX.toLowerCase()
  ) {
    await getPoolReservesHelper(addresses.POOLADDY_WPLS_pHEX);
    price0inUSD = pricePLSInUSD / priceHelp;

    await getPoolReservesHelper(addresses.POOLADDY_WPLS_HEX);
    price1inUSD = pricePLSInUSD / priceHelp;

    console.log("price0inUSD", price0inUSD);
    console.log("price1inUSD", price1inUSD);
  }

  // Then get the price of ALT coin in USD
  await getPoolReservesALT(poolAddress);
  console.log(`✅ ${tokenAlt} Price in DAI: ${price0inUSD} DAI`);
}

// ✅ Fetch 24H Volume from Swap Events
async function get24HVolume(poolAddress) {
  const lpContract = new ethers.Contract(poolAddress, pairABI, provider);

  const latestBlock = await provider.getBlockNumber();
  const blocksPerHour = 360; // Approximate 10-sec block time
  const blocksAgo = 24 * blocksPerHour;
  const batchSize = 500; // Process in chunks to avoid timeouts
  let startBlock = latestBlock - blocksAgo;

  let volumeToken0 = ethers.BigNumber.from(0);
  let volumeToken1 = ethers.BigNumber.from(0);

  // Loop over the last blocks in past 24 hours
  while (startBlock < latestBlock) {
    const endBlock = Math.min(startBlock + batchSize, latestBlock);
    console.log(
      `🔍 Fetching Swap events from block ${startBlock} to ${endBlock}...`
    );

    try {
      const events = await lpContract.queryFilter("Swap", startBlock, endBlock);
      for (const event of events) {
        const amount0In = ethers.BigNumber.from(event.args.amount0In);
        const amount1In = ethers.BigNumber.from(event.args.amount1In);

        // ✅ Only count the actual input amount (ignore zero values)
        if (!amount0In.isZero()) {
          volumeToken0 = volumeToken0.add(amount0In);
        }
        if (!amount1In.isZero()) {
          volumeToken1 = volumeToken1.add(amount1In);
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching events:`, error);
      break;
    }

    startBlock = endBlock + 1;
  }

  // Convert to readable format
  const formattedToken0 = Number(
    ethers.utils.formatUnits(volumeToken0, decimals0)
  ).toFixed(4);
  const formattedToken1 = Number(
    ethers.utils.formatUnits(volumeToken1, decimals1)
  ).toFixed(4);

  const volumeUSD =
    Number(ethers.utils.formatUnits(volumeToken0, decimals0)) * price0inUSD +
    Number(ethers.utils.formatUnits(volumeToken1, decimals1)) * price1inUSD;

  console.log(token0LiqUSD);
  console.log(token1LiqUSD);
  const totalLiqUSD = Number(token0LiqUSD) + Number(token1LiqUSD);
  const feesUSD = (feePercentage * volumeUSD) / 100;
  const aprPool = (feesUSD / totalLiqUSD) * 100;

  console.log(`📊 24H Trading Volume for Pool: ${poolAddress}`);
  console.log(`   - Token 0 Volume: ${formattedToken0}`);
  console.log(`   - Token 1 Volume: ${formattedToken1}`);
  console.log(`   - Total Liquidity in USD: ${totalLiqUSD}`);
  console.log(`   - 🔹 Total 24H Volume in USD: $${volumeUSD.toFixed(2)}`);
  console.log(`   - 🔹 Total 24H Fees in USD: $${feesUSD.toFixed(2)}`);
  console.log(`   - 🔹 Daily APR based on 24H volume: ${aprPool.toFixed(2)}%`);

  return {
    token0Volume: formattedToken0,
    token1Volume: formattedToken1,
    totalLiqUSD: totalLiqUSD.toFixed(0),
    volumeUSD: volumeUSD.toFixed(0),
    feesUSD: feesUSD.toFixed(0),
    aprPool: aprPool.toFixed(2),
    price0inUSD: price0inUSD.toFixed(8),
    price1inUSD: price1inUSD.toFixed(8),
    pricePLSInUSD: pricePLSInUSD.toFixed(8),
  };
}

// ✅ getPriceAndVolume function: Fetch pool data & volume
async function getPriceAndVolume(poolAddress) {
  try {
    // Get Prices (assuming getPriceAndLiq() doesn't return anything)
    await getPriceAndLiq(poolAddress).catch(console.error);

    // Get 24H Volume and related data
    const volumeData = await get24HVolume(poolAddress);

    // Destructure the values from the returned volume data
    const {
      totalLiqUSD,
      volumeUSD,
      feesUSD,
      aprPool,
      price0inUSD,
      price1inUSD,
      pricePLSInUSD,
    } = volumeData;

    // Check if the data is valid before returning
    if (!totalLiqUSD || !volumeUSD || !feesUSD || !aprPool) {
      return { poolAddress, volume: 0, fees: 0, apr: 0 }; // Return default values if something is missing
    }

    // Return the processed data
    return {
      poolAddress,
      totalLiqUSD: parseFloat(totalLiqUSD), // Convert to float for consistency
      volumeUSD: parseFloat(volumeUSD),
      feesUSD: parseFloat(feesUSD),
      aprPool: parseFloat(aprPool),
      price0inUSD: parseFloat(price0inUSD),
      price1inUSD: parseFloat(price1inUSD),
      pricePLSInUSD: parseFloat(pricePLSInUSD),
    };
  } catch (error) {
    console.error(`Error processing pool: ${poolAddress}`, error);
    return { poolAddress, volume: 0, fees: 0, apr: 0 }; // Return default values in case of error
  }
}

// ✅ Run ALL scripts
// Loop over each pool address and get the results
async function calculateAllPools() {
  for (const pool of poolAddresses) {
    // Use 'pool' as the object containing both 'name' and 'address'
    try {
      const poolAddress = pool.address; // Extract the pool address
      const poolName = pool.name; // Extract the pool name

      // Call your function to get the price and volume, pass in the pool address
      const result = await getPriceAndVolume(poolAddress);

      // Optionally, log the pool name for better tracking
      console.log(`Calculating data for pool: ${poolName} (${poolAddress})`);

      // Push the result to resultsAllPools with the name included if needed
      resultsAllPools.push({
        poolName, // Add the pool name
        ...result, // Add the result data
      });
    } catch (error) {
      console.error(
        `Error calculating data for ${pool.name} (${pool.address}):`,
        error
      );
    }
  }
}

let mergedResults = [];

// Main execution
async function main() {
  try {
    // Step 1: Calculate pools and write to Excel
    await calculateAllPools();

    // Step 2: Get user LP tokens and append to the same Excel file
    await getUserLPTokens(wallet_number); // Pass the wallet number, here it's 1

    // Combine both arrays into totalResults
    // Assuming resultsAllPools and resultsUserPools have the same length
    for (let i = 0; i < resultsAllPools.length; i++) {
      let poolData = resultsAllPools[i];
      let userData = resultsUserPools[i] || {}; // Get user data, if available

      // Calculate myLpUSD and myLPFees
      let sharePercent = parseFloat(
        userData.sharePercent.replace("%", "").replace(",", ".")
      ); // Convert sharePercent to a number (e.g., '0.00%' -> 0.00)
      let myLpUSD = (sharePercent / 100) * poolData.totalLiqUSD; // Calculate myLpUSD
      let myLPFees = (sharePercent / 100) * poolData.feesUSD; // Calculate myLPFees

      // Merge the pool data and user data into a single object
      let combined = {
        ...poolData, // Pool data (totalLiqUSD, volumeUSD, etc.)
        ...userData, // User data (sharePercent, userLiquidity0, userLiquidity1, etc.)
        myLpUSD, // Add calculated myLpUSD
        myLPFees, // Add calculated myLPFees
      };

      mergedResults.push(combined);
    }

    console.log(mergedResults);
    // Step 2: Write the merged results to Excel
    await writeToExcel(mergedResults, "PoolData");
  } catch (error) {
    console.error("Error:", error);
  }
}

function getFormattedDateTime() {
  const now = new Date();

  // Format date as MM_DD_YYYY_HH_MM_SS
  const date = `${now.getMonth() + 1}_${now.getDate()}_${now.getFullYear()}`;
  const time = `${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`;

  return `${date}_${time}`;
}

function writeToExcel(data, sheetName) {
  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Convert the data to a worksheet
  const ws = XLSX.utils.json_to_sheet(data);

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Get the formatted date and time for the filename
  const formattedDateTime = getFormattedDateTime();

  //console.log(wallet_number);

  // Write the workbook to a new Excel file with the date and time in the filename
  const filename = `lp_data_wallet_${wallet_number}_date_${formattedDateTime}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`${sheetName} saved to ${filename}`);
}

main();
