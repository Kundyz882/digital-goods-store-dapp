const hre = require("hardhat");

async function main() {
  const RewardToken = await hre.ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  await rewardToken.waitForDeployment();

  const Store = await hre.ethers.getContractFactory("DigitalGoodsStore");
  const store = await Store.deploy(await rewardToken.getAddress());
  await store.waitForDeployment();

  await rewardToken.transferOwnership(await store.getAddress());

  console.log("RewardToken:", await rewardToken.getAddress());
  console.log("Store:", await store.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
