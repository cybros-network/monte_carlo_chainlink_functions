const hre = require("hardhat");

const standalone = process.env['HARDHAT'] === undefined;
if (standalone) {
  console.log("Running in standalone mode");
}

const defaultContractName = "MonteCarloFunctionsConsumer";

const { Command } = require('commander');
const program = new Command();

program
  .requiredOption("-c, --contract", "the contract name", defaultContractName)
  .option("-d, --dry", "dry run")
  .option("--compile", "compile the contract", standalone);

program.parse(process.argv);
const options = program.opts();

const compile = options.compile;
const dryRun = options.dry;

const contractName = options.contract;
if (!contractName || contractName.trim().length === 0) {
  console.error("`--contract` must provide.");
  process.exit(1);
}

async function main() {
  if (compile) {
    await hre.run("compile");
  }
  
  if (dryRun) {
    console.log("Dry run mode, the contract won't actual deploy to the network");
    process.exit(0);
  }

  const contract = await hre.ethers.deployContract(contractName);

  await contract.waitForDeployment();

  console.log(
    `Contract deployed to ${contract.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
