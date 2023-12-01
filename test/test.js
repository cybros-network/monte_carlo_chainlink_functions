const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MonteCarloFunctionsConsumer", function () {
  it("test initial value", async function () {
    const deployedContract = await ethers.deployContract("MonteCarloFunctionsConsumer");
    const [owner] = await ethers.getSigners();
    expect(await deployedContract.owner()).to.equal(owner.address);
  });

  it("not enough value error", async function () {
    const deployedContract = await ethers.deployContract("MonteCarloFunctionsConsumer");
    // const testPrompt = "{\"prompt\":\"cute illustration, high-res, ultra-detailed, beautiful detailed eyes, 1girl,solo, small breasts,brown eyes, blush, bow, brown medium hair, mountaineering hat, climbing clothes,windbreaker, carrying a backpack, alpine flowers, trail, mountain, cloud, blue sky, perfect lighting\",\"negative_prompt\":\"(bad-hands-3:1.1)EasyNegativeV2, Two heads, distorted fingers, poorly drawn face, cropped image, disfigured hands, disconnected limbs, low-resolution, bad anatomy, grainy quality, overexposed lighting\",\"sd_model_name\":\"gostlyCute_v10\",\"sampler_name\":\"DPM++ 2M\",\"width\":512,\"height\":768,\"seed\":9369390,\"steps\":29,\"cfg_scale\":7.5,\"hr_fix\":true,\"hr_fix_upscaler_name\":\"Lanczos\",\"hr_fix_upscale\":2,\"hr_fix_steps\":22,\"hr_fix_denoising\":0.3}}";
    const testPrompt = "foo";
    const amount = ethers.parseEther("0.001");
    
    await deployedContract.simplePrompt(["", testPrompt, "0x11"], {
      value: amount
    });
  });

  // it("not enough value error", async function () {
  //   const deployedContract = await ethers.deployContract("MonteCarloFunctionsConsumer");
  //   // const testPrompt = "{\"prompt\":\"cute illustration, high-res, ultra-detailed, beautiful detailed eyes, 1girl,solo, small breasts,brown eyes, blush, bow, brown medium hair, mountaineering hat, climbing clothes,windbreaker, carrying a backpack, alpine flowers, trail, mountain, cloud, blue sky, perfect lighting\",\"negative_prompt\":\"(bad-hands-3:1.1)EasyNegativeV2, Two heads, distorted fingers, poorly drawn face, cropped image, disfigured hands, disconnected limbs, low-resolution, bad anatomy, grainy quality, overexposed lighting\",\"sd_model_name\":\"gostlyCute_v10\",\"sampler_name\":\"DPM++ 2M\",\"width\":512,\"height\":768,\"seed\":9369390,\"steps\":29,\"cfg_scale\":7.5,\"hr_fix\":true,\"hr_fix_upscaler_name\":\"Lanczos\",\"hr_fix_upscale\":2,\"hr_fix_steps\":22,\"hr_fix_denoising\":0.3}}";
  //   const testPrompt = "foo";
    
  //   await deployedContract.sendRequest([testPrompt]);
  // });
});