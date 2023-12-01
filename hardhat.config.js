require('dotenv').config();

require("@nomicfoundation/hardhat-toolbox");

process.env["HARDHAT"] = "1"

const { DEPLOYER_PRIVATE_KEY, DEFAULT_NETWORK } = process.env;

const config = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  defaultNetwork: DEFAULT_NETWORK,
  networks: {
    hardhat: {}
  }
};

if (config.networks && process.env.POLYGON_MUMBAI_HTTP_API_URL) {
  config.networks.polygon_mumbai = {
    url: process.env.POLYGON_MUMBAI_HTTP_API_URL,
    accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
  };
}
if (config.networks && process.env.POLYGON_MAINNET_HTTP_API_URL) {
  config.networks.polygon_mainnet = {
    url: process.env.POLYGON_MAINNET_HTTP_API_URL,
    accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
  };
}
if (config.networks && process.env.SEPOLIA_HTTP_API_URL) {
  config.networks.sepolia = {
    url: process.env.SEPOLIA_HTTP_API_URL,
    accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = config;
