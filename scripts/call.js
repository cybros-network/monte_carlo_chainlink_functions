const hre = require("hardhat");

const standalone = process.env['HARDHAT'] === undefined;
if (standalone) {
  console.log("Running in standalone mode");
}

const defaultContractName = "MonteCarloFunctionsConsumer";

const { Command } = require('commander');
const program = new Command();

program
  .requiredOption("-a, --address <CONTRACT_ADDRESS>", "the contract address")
  .requiredOption("-c, --contract", "the contract name", defaultContractName)
  .requiredOption("-f, --function <CONTRACT_FUNCTION>", "the function name")
  .option("--args <ARGS>", "args")
  .option("--ether <ETHER>", "ethers", "0")
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
const contractAddress = options.address;
if (!contractAddress || contractAddress.trim().length === 0) {
  console.error("`--address` must provide.");
  process.exit(1);
}
const functionName = options.function;
if (!functionName || functionName.trim().length === 0) {
  console.error("`--function` must provide.");
  process.exit(1);
}
const callArgs = (() => {
  if (!options.args) {
    return undefined;
  }

  try {
    return JSON.parse(options.args);
  } catch (_e) {
    console.error("`--args` must JSON format.");
    process.exit(1);
  }
})();
const etherAmount = (() => {
  try {
    return hre.ethers.parseEther(options.ether);
  } catch (_e) {
    console.error("`--ether` invalid.");
    process.exit(1);
  }
})();

async function main() {
  if (compile) {
    await hre.run("compile");
  }

  const contract = await hre.ethers.getContractAt(contractName, contractAddress);
  const callee = contract.getFunction(functionName);
  const callOverrides = (() => {
    let overrides = {
      gasLimit: 1_000_000,
    };
    if (etherAmount > 0) {
      overrides = {...overrides, value: etherAmount};
    }
    return overrides;
  })();
  
  console.info("Call ARGS:")
  console.info(callArgs)

  if (dryRun) {
    console.log("Dry run mode, the contract won't actual call.");
    try {
      const pendingTx = await (async () => {
        if (callArgs) {
          return callee.populateTransaction(...callArgs, callOverrides);
        } else {
          return callee.populateTransaction(callOverrides);
        }
      })();
      console.log(pendingTx);
    } catch (e) {
      console.error(`Error: "${e.message}"`);
      console.error("Maybe `args` is invalid");
    }

    process.exit(0);
  }

  const tx = await (async () => {
    if (callArgs) {
      return callee.send(...callArgs, callOverrides);
    } else {
      return callee.send(callOverrides);
    }
  })();

  console.log(
    `Tx hash ${tx.hash}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
