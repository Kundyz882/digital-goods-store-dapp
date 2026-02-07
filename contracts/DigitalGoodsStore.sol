// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RewardToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract DigitalGoodsStore is ReentrancyGuard {

    enum Category { Smartphones, Laptops, Tablets, Accessories, Other }


    struct Product {
        uint256 id;
        string title;
        string description;
        string imageURI;
        Category category;
        uint256 price;         
        address payable seller;
        address buyer;         
        bool sold;
        bool active;
    }

    RewardToken public rewardToken;
    uint256 public productCount;

    uint256 public constant REWARD_RATE = 100; 


    mapping(uint256 => Product) public products;
    mapping(address => uint256[]) private purchases;
    mapping(address => uint256[]) private listings;

    mapping(address => uint256) public pendingWithdrawals;

    event ProductCreated(uint256 indexed id, address indexed seller, uint256 price, Category category);
    event ProductBought(uint256 indexed id, address indexed buyer, address indexed seller, uint256 price);
    event ProductUnlisted(uint256 indexed id);
    event Withdraw(address indexed seller, uint256 amount);

    constructor(address tokenAddress) {
        rewardToken = RewardToken(tokenAddress);
    }

    modifier exists(uint256 id) {
        require(id < productCount, "Product does not exist");
        _;
    }

    modifier onlySeller(uint256 id) {
        require(products[id].seller == msg.sender, "Not seller");
        _;
    }

    function createProduct(
        string calldata _title,
        string calldata _description,
        string calldata _imageURI,
        Category _category,
        uint256 _price
    ) external {
        require(_price > 0, "Price must be > 0");
        require(bytes(_title).length > 0, "Empty title");

        uint256 id = productCount;

        products[id] = Product({
            id: id,
            title: _title,
            description: _description,
            imageURI: _imageURI,
            category: _category,
            price: _price,
            seller: payable(msg.sender),
            buyer: address(0),
            sold: false,
            active: true
        });

        listings[msg.sender].push(id);
        productCount++;

        emit ProductCreated(id, msg.sender, _price, _category);
    }

    function unlistProduct(uint256 id) external exists(id) onlySeller(id) {
        Product storage p = products[id];
        require(!p.sold, "Already sold");
        p.active = false;
        emit ProductUnlisted(id);
    }

    function buyProduct(uint256 id) external payable exists(id) {
        Product storage p = products[id];

        require(p.active, "Not active");
        require(!p.sold, "Already sold");
        require(msg.sender != p.seller, "Seller can't buy");
        require(msg.value == p.price, "Incorrect ETH");

        p.sold = true;
        p.active = false;
        p.buyer = msg.sender;

        pendingWithdrawals[p.seller] += msg.value;

        rewardToken.mint(msg.sender, msg.value * REWARD_RATE);


        purchases[msg.sender].push(id);

        emit ProductBought(id, msg.sender, p.seller, msg.value);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Withdraw failed");

        emit Withdraw(msg.sender, amount);
    }

    function getMyPurchases() external view returns (uint256[] memory) {
        return purchases[msg.sender];
    }

    function getMyListings() external view returns (uint256[] memory) {
        return listings[msg.sender];
    }
}
