# What this kit does

How a checkout flows through `@onramper/react-native`. For the full integration walkthrough — install, usage, error handling, API reference — see [Getting started](doc:getting-started-1).

---

## What the Headless Wrapper handles for you

The Headless Wrapper owns the parts of a checkout you'd otherwise have to build and maintain:

- ✅ **Abstracts away many headless providers** — integrate once instead of wiring up each onramp's API and quirks.
- ✅ **Fulfills every requirement each provider needs**, resolved per user + amount:
  - **Amount limits** — validates the order against each provider's min / max.
  - **ToS display and validation** — surfaces the right consent text and confirms acceptance.
  - **Dynamic KYC collection** — gathers the identity data the provider requires, only when needed.
- ✅ **Apple Pay support for US & EU** — works in both regions out of the box.
- ✅ **Bring your own API keys** — run on your own partner credentials.
- ✅ **Integrates quickly** — three calls and a native button, in under a day.
- ✅ **Fully private** — never phones home with your app's usage data.
- ✅ **Unified API and event bridge** — one set of calls and events across providers.
- ✅ **Flexible to match your UI / UX** — drop the native button anywhere and style it.
- ✅ **Custom flow configuration** — pick the providers, payment methods, and behavior.
- ✅ **Terms-of-Service** — renders consent text and links under the Buy button.
- ✅ **Token refresh** — refreshes both tokens proactively and reactively. You only handle failure if `onSessionExpired` can't deliver a fresh pair.
- ✅ **Token storage** — OIDC tokens live in the iOS keychain; nothing to cache on the JS side.
- ✅ **Payment surface** — picks the right view (Apple Pay, card, etc.) from the provider's response.

---

## How a checkout flows

A typical checkout maps to these calls, in order:

1. **Your backend mints a session.** Your server calls Onramper's partner endpoint with your private partner key and gets back a one-shot `{ sessionId, sessionToken }` pair. It hands them to the app over your normal channel.
2. **Your app constructs `OnramperClient`** with config (`apiKey`, `clientId`, `environment`, `onSessionExpired`) and calls `initialize({ sessionId, sessionToken })`. The native side runs device attestation and exchanges the token for an authenticated Headless Wrapper session. State becomes `ready`.
3. **Your app requests a checkout.** `getCheckoutRequirements(request, style)` creates a checkout intent, resolves what consent / KYC is needed for this user + amount, and returns `{ button, quote }`.
4. **Your app embeds `button`.** The user sees "Buy" and the Terms-of-Service sentence the Headless Wrapper rendered for the selected provider.
5. **User taps Buy.** The button records ToS consent, presents the OnramperID login sheet if the provider needs user identity, then finalizes the intent.
6. **The Headless Wrapper renders the payment surface.** Apple Pay, card webview, or other — chosen automatically from the provider's response. State transitions through `finalizing` → `rendering`.
7. **Outcome.** `completed` (with checkout id) or `failed` (with `OnramperError`). Call `client.reset()` to return to `ready` for another checkout.

Token refresh — both Headless Wrapper session and OnramperID user token — is fully automatic. Your code only sees it if both refresh paths exhaust, in which case the Headless Wrapper calls your `onSessionExpired` handler for a fresh `{ sessionId, sessionToken }` pair.

---

## What OnramperID is

OnramperID is Onramper's hosted OIDC identity layer. It collects whatever identity / KYC data the chosen onramp requires (email, name, contact info, document upload) so partners don't host a login UI or hold user PII themselves.

- The Headless Wrapper presents OnramperID as a sheet on Buy tap, **only when** the current checkout's requirements include `user_info`. If the provider doesn't need it, no sheet ever appears.
- Redirect is a **hosted HTTPS callback** intercepted inside the webview — you do **not** need to register a custom URL scheme, universal link, or anything in `Info.plist` for OnramperID.
- Token refresh, re-authentication, and re-presenting the login sheet on a terminal refresh failure are all handled by the Headless Wrapper. Partners never read, write, or inspect OnramperID tokens.
