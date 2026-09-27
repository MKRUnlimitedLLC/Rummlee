import assert from "node:assert/strict";
import test from "node:test";
import { banditVoiceRoute, synthesizeBandit } from "./bandit-voice.ts";

test("no speech key means the phone voice", async () => {
  assert.equal(banditVoiceRoute({} as NodeJS.ProcessEnv), null);
  assert.equal(await synthesizeBandit("Hello.", {} as NodeJS.ProcessEnv), null);
});

test("Grok voice wins when both keys exist", () => {
  const env = { XAI_API_KEY: "x", OPENAI_API_KEY: "o" } as NodeJS.ProcessEnv;
  assert.equal(banditVoiceRoute(env), "xai");
  assert.equal(banditVoiceRoute({ OPENAI_API_KEY: "o" } as NodeJS.ProcessEnv), "openai");
});
