import {loadSync as loadEnvSync} from "https://deno.land/std/dotenv/mod.ts"
import {parse} from "https://deno.land/std/flags/mod.ts"

import {ApiPromise, HttpProvider, Keyring, WsProvider} from "https://deno.land/x/polkadot/api/mod.ts";
import {cryptoWaitReady} from "https://deno.land/x/polkadot/util-crypto/mod.ts";
import type {KeyringPair} from "https://deno.land/x/polkadot/keyring/types.ts";

import {Application, Router} from "https://deno.land/x/oak/mod.ts";
import {oakCors} from "https://deno.land/x/cors/mod.ts";

declare global {
  let nonce: number

  interface Window {
    nonce: number;
  }
}

// function balanceToNumber(value: BN | string) {
//   const bn1e9 = new BN(10).pow(new BN(9));
//   const bnValue = isHex(value) ? new BN(hexToU8a(value), "hex") : new BN(value.toString());
//   // May overflow if the user too rich
//   return bnValue.div(bn1e9).toNumber() / 1e3;
// }

const env = loadEnvSync()
const parsedArgs = parse(Deno.args, {
  alias: {
    "dryRun": "dry",
  },
  boolean: [
    "dryRun",
  ],
  string: [
    "bind",
    "port",
  ],
  default: {
    dryRun: false,
    bind: "0.0.0.0",
    port: 8001
  },
})

const dryRun = parsedArgs.dryRun
const jobPoolId = parseInt(env.JOB_POOL_ID)
if (Number.isNaN(jobPoolId) || jobPoolId <= 0) {
  console.error("JOB_POOL_ID is invalid.")
  Deno.exit(1)
}
const jobPolicyId = parseInt(env.JOB_POLICY_ID)
if (Number.isNaN(jobPolicyId) || jobPolicyId <= 0) {
  console.error("JOB_POLICY_ID is invalid.")
  Deno.exit(1)
}
const jobSpecVersion = parseInt(env.JOB_SPEC_VERSION)
if (Number.isNaN(jobSpecVersion) || jobSpecVersion <= 0) {
  console.error("JOB_SPEC_VERSION is invalid.")
  Deno.exit(1)
}
const jobMaxInputSize = parseInt(env.JOB_MAX_INPUT_SIZE)
if (Number.isNaN(jobMaxInputSize) || jobMaxInputSize <= 0) {
  console.error("JOB_MAX_INPUT_SIZE is invalid.")
  Deno.exit(1)
}

function createSubstrateApi(rpcUrl: string): ApiPromise | null {
  let provider = null;
  if (rpcUrl.startsWith("wss://") || rpcUrl.startsWith("ws://")) {
    provider = new WsProvider(rpcUrl);
  } else if (
    rpcUrl.startsWith("https://") || rpcUrl.startsWith("http://")
  ) {
    provider = new HttpProvider(rpcUrl);
  } else {
    return null;
  }

  return new ApiPromise({
    provider,
    throwOnConnect: true,
    throwOnUnknown: true,
  });
}

await cryptoWaitReady().catch((e) => {
  console.error(e.message);
  Deno.exit(1);
});

const operatorKeyPair: KeyringPair = (() => {
  const operatorMnemonic = env.SUB_OPERATOR_MNEMONIC;
  if (operatorMnemonic === undefined || operatorMnemonic === "") {
    console.error("Mnemonic is blank")
    Deno.exit(1)
  }

  try {
    return new Keyring({ type: "sr25519" }).addFromUri(operatorMnemonic, { name: "The operator" });
  } catch (e) {
    console.error(`Operator mnemonic invalid: ${e.message}`);
    Deno.exit(1)
  }
})();
console.log(`Operator: ${operatorKeyPair.address}`);

const api = createSubstrateApi(env.SUB_NODE_RPC_URL);
if (api === null) {
  console.error(`Invalid RPC URL "${env.SUB_NODE_RPC_URL}"`);
  Deno.exit(1);
}

api.on("error", (e) => {
  console.error(`Polkadot.js error: ${e.message}"`);
  Deno.exit(1);
});

await api.isReady.catch((e) => {
  console.error(e);
  Deno.exit(1);
});
console.log(`Connected to RPC: ${env.SUB_NODE_RPC_URL}`);

const { nonce } = await api.query.system.account(operatorKeyPair.address);
window.nonce = nonce.toNumber();

const router = new Router();
router.get("/", (ctx) => {
  ctx.response.body = {
    configuration: {
      jobPoolId,
      jobPolicyId,
      jobSpecVersion,
    },
    nonce: window.nonce,
  };
});

router.post("/submit", async (ctx) => {
  if (!ctx.request.hasBody) {
    ctx.throw(415);
    return
  }

  const reqBody = await ctx.request.body().value;
  console.log(reqBody, typeof reqBody);

  const uniqueTrackId = reqBody["unique_track_id"];
  if (uniqueTrackId === undefined) {
    console.error("unique_track_id is missing");
    ctx.response.status = 400;
    ctx.response.body = {
      error: "`unique_track_id` missing"
    };

    return
  }
  const data = reqBody["data"];
  if (data === undefined) {
    console.error("data is missing");
    ctx.response.status = 400;
    ctx.response.body = {
      error: "`data` missing"
    };

    return
  }

  const input = JSON.stringify({
    e2e: false,
    v: 1,
    data,
  });
  if (input.length > jobMaxInputSize) {
    console.error(`Data too large!`);
    ctx.response.status = 400;
    ctx.response.body = {
      error: "`data` too large"
    };

    return
  }

  console.info(`Sending offchainComputingPool.createJob(poolId, policyId, uniqueTrackId, beneficiary, implSpecVersion, input, softExpiresIn)`);
  const txPromise = api.tx.offchainComputingPool.createJob(
    jobPoolId, jobPolicyId, uniqueTrackId, null, jobSpecVersion, input, null
  );

  const callHash = txPromise.toHex();
  console.info(`Call hash: ${callHash}`);

  if (dryRun) {
    ctx.response.body = {
      callHash,
    };

    return
  }

  const currentNonce = window.nonce;
  window.nonce += 1;

  let txHash;
  try {
    txHash = await txPromise.signAndSend(operatorKeyPair, { nonce: currentNonce });
    console.info(`Transaction hash: "${txHash.toHex()}" Nonce: "${currentNonce}"`);
  } catch (e) {
    console.error(e.message);

    ctx.response.status = 400;
    ctx.response.body = {
      error: "Submit Tx error"
    };

    return
  }

  ctx.response.body = {
    callHash,
    nonce: currentNonce,
    txHash: txHash,
  };
});

const app = new Application();
app.use(async (_ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    throw err;
  }
});
app.use(router.routes());
app.use(oakCors()); // Enable CORS for All Routes
app.use(router.allowedMethods());

app.addEventListener("listen", ({ hostname, port, secure }) => {
  console.log(
    `Listening on: ${secure ? "https://" : "http://"}${
      hostname ?? "localhost"
    }:${port}`,
  );
});
await app.listen({ hostname: parsedArgs.bind, port: parseInt(parsedArgs.port.toString()), secure: false });
