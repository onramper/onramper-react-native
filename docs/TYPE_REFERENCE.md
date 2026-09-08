A consolidated reference for every client-facing TypeScript type exported by `@onramper/onramper-react-native`. Each type mirrors a Swift `OnramperSDK` model; the wrapper transports them across the native bridge as JSON. Internal/native-only types (finalize request, requirement completions) are intentionally not exposed and not listed here.

> **iOS-only in this release.** On Android these APIs throw `OnramperError` with code `platformUnsupported`.

---

## Configuration

### `OnramperConfiguration`

Passed to `new OnramperClient(...)`.

| Field | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Partner API key (`pk_live_…`). |
| `clientId` | `string` | Yes | Partner client id. |
| `environment` | `OnramperEnvironment` | Yes | `'development'` (staging) or `'production'`. |
| `theme` | `OnramperTheme?` | No | `'system'` (default) \| `'light'` \| `'dark'`. |
| `logLevel` | `OnramperLogLevel?` | No | `'off'` (default) \| `'error'` \| `'info'` \| `'debug'`. |
| `onSessionExpired` | `() => SessionCredentials \| Promise<SessionCredentials>` | Yes | Called when the session must be re-bootstrapped; return fresh credentials. Throw/reject to signal none are available. |

### `SessionCredentials`

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Session id minted by your backend. |
| `sessionToken` | `string` | Session token minted by your backend. |

---

## Checkout request

### `CheckoutRequest`

Passed to `getCheckoutRequirements(request, buttonStyle?, prefill?)`. Flattened from the Swift
`OnramperTransactionData`; ISO codes are lowercased by the SDK (pass either case).

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | `string` | Yes | Source (fiat) asset ISO code, e.g. `'usd'`. |
| `destination` | `string` | Yes | Destination (crypto) asset the user receives, e.g. `'btc'`. |
| `amount` | `number` | Yes | Amount in the `source` currency. |
| `type` | `TransactionType` | Yes | `'buy'` \| `'sell'`. |
| `country` | `string?` | No | ISO 3166-1 alpha-2 (e.g. `'us'`). Derived from the request IP when omitted. |
| `subdivision` | `string?` | No | ISO 3166-2 (e.g. `'us-ca'`). Recommended for US. |
| `paymentMethod` | `string` | Yes | Payment method id, e.g. `'applepay'`. |
| `wallet` | `WalletInfo` | Yes | Destination wallet. |
| `onlyOnramps` | `string[]?` | No | Allowlist of provider ids. Omit for all eligible providers. |

### `WalletInfo`

| Field | Type | Required | Description |
|---|---|---|---|
| `network` | `string` | Yes | Wallet network, e.g. `'solana'`. |
| `address` | `string` | Yes | Destination wallet address. |
| `memo` | `string?` | No | Destination tag / memo, when the network requires one. |

### `CheckoutButtonStyle`

Optional second argument to `getCheckoutRequirements`. Per-checkout, not global.

| Field | Type | Default | Description |
|---|---|---|---|
| `backgroundColor` | `string?` | system blue | Hex `'#RRGGBB'` or `'#RRGGBBAA'`. |
| `foregroundColor` | `string?` | white | Hex `'#RRGGBB'` or `'#RRGGBBAA'`. |
| `borderRadius` | `number?` | `12` | Corner radius in pt. |

### `OnramperUserPrefill`

Optional third argument to `getCheckoutRequirements`. Values you already know about the
user, used to pre-populate the OnramperID sign-in and additional-info screens. Every field
is optional — supply only what you know.

| Field | Type | Format | Notes |
|---|---|---|---|
| `email` | `string?` | valid email address | Identifies which account the other values belong to — read the warning below before supplying it. |
| `firstName` | `string?` | up to 200 chars, no `<` or `>` | Must not be blank. |
| `lastName` | `string?` | up to 200 chars, no `<` or `>` | Must not be blank. |
| `phoneNumber` | `string?` | E.164, e.g. `'+3712345678'` | Always a *candidate*: the user still verifies it, and a number already verified on the account takes precedence. Prefill never skips phone verification. |

**Prefill never blocks sign-in.** If it can't be applied, the login sheet opens normally
without it. There is no error to handle and nothing surfaces to your app.

> **Supply `email` only when you're confident.** It identifies which account the other
> values belong to, so it is not just another prefilled value. If it matches the account
> that signs in, the remaining values may be applied automatically. If it does **not**
> match, the **whole** prefill is dropped — strictly worse than omitting `email`, where the
> values are still offered to the user for confirmation.

Prefill is enabled per integration, as is whether values are shown for confirmation or
applied silently. Talk to your Onramper representative before relying on it — without it
enabled, sign-in simply proceeds without prefill. See
[prefilling known user values](doc:headless-react-native-getting-started) in the getting-started guide.

---

## Quote

### `QuoteResponse`

Returned as `quote` from `getCheckoutRequirements`. **Success-only** — a request that can't
be priced rejects with `OnramperError` (e.g. `quoteUnavailable`) rather than returning a
partial quote, so the core fields are never null.

| Field | Type | Description |
|---|---|---|
| `quoteId` | `string` | Unique id for this quote (echoed back on finalize). |
| `ramp` | `string` | Provider (onramp) id that priced the trade, e.g. `'moonpay'`. |
| `rate` | `number` | Exchange rate applied to the trade. |
| `payout` | `number` | Amount of the destination asset the user receives. |
| `paymentMethod` | `string` | Payment method the quote was priced for. |
| `networkFee` | `number` | Network/processing fee for the trade. |
| `transactionFee` | `number` | Provider transaction fee for the trade. |
| `recommendations` | `string[]?` | Optional provider recommendation metadata. |

---

## Requirements

### `CheckoutRequirement`

A discriminated union on `type`, carried by `OnramperState` (`requireLogin`) and the
`loginRequired` event. The SDK consumes these for you; you rarely branch on them directly.

| `type` | Fields | Notes |
|---|---|---|
| `'tos'` | `providerId: string`, `items: ToSItem[]` | Consent sentence rendered below Buy automatically. |
| `'amount_limit'` | `providerId: string`, `minAmountLimit?: number`, `maxAmountLimit?: number`, `amountLimitSatisfied: boolean` | Validated locally during `getCheckoutRequirements()`. |
| `'user_info'` | `providerId: string`, `fields: UserInfoField[]` | Drives the OnramperID login sheet. |
| `'reverification'` | `providerId: string`, `field: ReverificationField`, `requiredRecencyDays: number`, `lastVerifiedAt?: string` | Phone re-verification through the OnramperID flow. Only emitted when re-verification is due. |

### `ToSItem`

| Field | Type | Description |
|---|---|---|
| `type` | `'tos' \| 'privacy_policy' \| 'user_agreement'` | Document kind. |
| `required` | `boolean` | Whether acknowledgement is required. |
| `satisfied` | `boolean` | Whether already acknowledged. |
| `url` | `string?` | Link to the document, when provided. |
| `content` | `string?` | Inline content, when provided. |

### `UserInfoField`

| Field | Type | Description |
|---|---|---|
| `type` | `UserInfoFieldType` | Which profile field. |
| `required` | `boolean` | Whether collection is required. |
| `satisfied` | `boolean` | Whether already collected. |

- **`UserInfoFieldType`** = `'first_name' \| 'last_name' \| 'email' \| 'email_verification' \| 'phone_number' \| 'phone_verification' \| 'ssn_last_four' \| 'address'`
- **`ReverificationField`** = `'email' \| 'phone'` — the SDK drives a client flow for `'phone'` today; `'email'` is decoded but has no re-verify UI.
- **`TransactionType`** = `'buy' \| 'sell'`

---

## Result types

### `CheckoutFinalizeResponse` / `HeadlessCheckoutData`

Carried by the `checkoutFinalized` event.

| Type | Field | Type | Description |
|---|---|---|---|
| `CheckoutFinalizeResponse` | `headlessCheckoutId` | `string` | Finalized checkout-attempt id. |
| | `onramperTransactionId` | `string` | Durable Onramper transaction id for support, reconciliation, and status lookup. Persist this one. |
| | `headlessCheckoutData` | `HeadlessCheckoutData` | Payment surface info. |
| `HeadlessCheckoutData` | `checkoutPaymentType` | `CheckoutPaymentType` | `'applepay'` \| `'revolutpay'`. |
| | `url` | `string` | Payment surface URL. |
| | `renderType` | `RenderType` | `'webview'` \| `'deeplink'`. |

---

## OnramperClient transaction ID

`OnramperClient.currentTransactionId: string | null` is `null` before successful finalization,
then mirrors the durable Onramper transaction ID published with `checkoutFinalized`. Subscribe with
`addTransactionIdListener((id) => void): () => void`; `id` is `string | null` and native
publishes `null` when `reset()` or `signOut()` clears the current value. Persist the ID before
either operation.

---

## Errors

### `OnramperError` / `OnramperErrorPayload`

`OnramperError` is a JS `Error` subclass with `code: OnramperErrorCode`, `message: string`,
and optional `info?: Record<string, unknown>`. See the **Error code reference** in
[Getting Started](doc:getting-started) for the full taxonomy and recommended handling.

`OnramperErrorCode` is a string union of the SDK codes (`notInitialized`,
`quoteUnavailable`, `checkoutForbidden`, `userTokenRefreshFailed`, …) plus JS-only codes
(`platformUnsupported`, `intentInvalidated`, `intentAlreadyConsumed`,
`clientAlreadyConfigured`, `sessionExpirationHandlerFailed`).

---

## State & events

- **`OnramperState`** — discriminated union on `kind`. See the `client.state` table in
  [Getting Started](doc:getting-started).
- **`CheckoutEvent`** — discriminated union on `type`, delivered to `addEventListener`. See
  the `CheckoutEvent` table in [Getting Started](doc:getting-started).
- **`EventName`** = `CheckoutEvent['type']`; **`EventPayload<K>`** extracts the event whose
  `type` is `K` — used to type `addEventListener(name, fn)` handlers.
