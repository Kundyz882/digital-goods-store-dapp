const { expect } = require("chai");

describe("DigitalGoodsStore", function () {
  let token, store, owner, buyer;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("RewardToken");
    token = await Token.deploy();

    const Store = await ethers.getContractFactory("DigitalGoodsStore");
    store = await Store.deploy(await token.getAddress());

    await token.transferOwnership(await store.getAddress());
  });

  it("should create and buy product", async function () {
    await store.createProduct(
      "E-Book",
      "Best guide",
      "https://example.com/cover.jpg",
      0, 
      ethers.parseEther("0.01")
    );

    await store.connect(buyer).buyProduct(0, {
      value: ethers.parseEther("0.01"),
    });

    const balance = await token.balanceOf(buyer.address);
    expect(balance).to.be.gt(0);
  });


});
