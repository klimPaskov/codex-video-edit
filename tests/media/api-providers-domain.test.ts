import assert from "node:assert/strict";
import test from "node:test";
import {
  assertApiProviderConnectRequest,
  assertApiProviderModelRequest,
  assertApiProvidersView,
} from "../../packages/domain/src/api-providers.ts";

test("API-key IPC confines provider identity and keeps keys out of returned state", () => {
  const request = {
    provider: "deepseek",
    key: "TEST-ONLY-KEY",
    remember: false,
  };
  assertApiProviderConnectRequest(request);
  for (const bad of [
    { ...request, provider: "https://example.invalid" },
    { ...request, key: "bad\r\nHeader: value" },
    { ...request, extra: "private" },
  ])
    assert.throws(() => assertApiProviderConnectRequest(bad));
  assertApiProviderModelRequest({ provider: "openai", model: "gpt-4.1" });
  const view = {
    providers: [
      {
        id: "deepseek",
        connected: true,
        remembered: false,
        canRemember: false,
        models: ["deepseek-flash"],
        selectedModel: "deepseek-flash",
        busy: false,
        message: null,
      },
      {
        id: "openai",
        connected: false,
        remembered: false,
        canRemember: false,
        models: [],
        selectedModel: null,
        busy: false,
        message: null,
      },
    ],
  };
  assertApiProvidersView(view);
  assert.ok(!JSON.stringify(view).includes(request.key));
  assert.throws(() =>
    assertApiProvidersView({
      providers: [
        view.providers[0],
        { ...view.providers[1], key: request.key },
      ],
    }),
  );
});
