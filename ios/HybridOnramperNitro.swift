import Combine
import Foundation
import NitroModules
import OnramperSDK
import SwiftUI

/// Nitro bridge to OnramperSDK's `OnramperClient`. Wraps the @MainActor SDK
/// client, mirrors its `@Published state` and `events` stream to stored JS
/// callbacks, and feeds the SDK's `sessionExpirationHandler` from a stored
/// async JS callback. The public typed JS API lives in `OnramperClient.ts`.
final class HybridOnramperNitro: HybridOnramperNitroSpec {
  var sdkVersion: String { OnramperSDK.OnramperClient.sdkVersion }

  private let logRelay = SDKLogRelay()
  @MainActor private var client: OnramperClient?
  @MainActor private var stateObservation: AnyCancellable?
  @MainActor private var transactionIdObservation: AnyCancellable?
  @MainActor private var eventTask: Task<Void, Never>?

  private let lifetime = PreparedIntentLifetime()
  private let callbackLock = NSLock()
  private struct Callbacks {
    var onState: ((String) -> Void)?
    var onEvent: ((String) -> Void)?
    var onTransactionId: ((String?) -> Void)?
    // Nitro wraps the async JS callback's own returned Promise.
    var sessionHandler: (() -> Promise<Promise<NitroSessionCredentials>>)?
  }
  private var callbacks = Callbacks()

  private func withCallbacks<Value>(_ body: (inout Callbacks) -> Value) -> Value {
    callbackLock.lock()
    defer { callbackLock.unlock() }
    return body(&callbacks)
  }

  // MARK: - Listener registration (synchronous)

  func setLogListener(onLog: @escaping (String) -> Void) {
    logRelay.setListener(onLog)
  }

  func setStateListener(onState: @escaping (String) -> Void) {
    withCallbacks { $0.onState = onState }
  }

  func setEventListener(onEvent: @escaping (String) -> Void) {
    withCallbacks { $0.onEvent = onEvent }
  }

  func setTransactionIdListener(onTransactionId: @escaping (String?) -> Void) {
    withCallbacks { $0.onTransactionId = onTransactionId }
  }

  func setSessionExpirationHandler(handler: @escaping () -> Promise<Promise<NitroSessionCredentials>>) {
    withCallbacks { $0.sessionHandler = handler }
  }

  /// Also used by reset/signOut: invalidate synchronously before scheduling
  /// asynchronous SDK work, so old results cannot become usable buttons.
  private func beginPreparation() throws -> PreparedIntentLifetime.Ticket {
    do { return try lifetime.begin() } catch { throw bridgeSDKError(error) }
  }

  // MARK: - Lifecycle

  func configure(config: OnramperNitroConfig) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      do {
        guard let self else { throw BridgeLifecycleError.clientDestroyed }
        try await self.performConfigure(config)
      } catch {
        throw bridgeSDKError(error)
      }
    }
  }

  @MainActor
  private func performConfigure(_ config: OnramperNitroConfig) async throws {
    try lifetime.checkActive()
    // Idempotent: a second configure() with the SDK already built is a no-op.
    if client != nil { return }

    let environment: OnramperConfiguration.Environment =
      config.environment == "development" ? .development : .production
    let theme: OnramperConfiguration.Theme = {
      switch config.theme {
      case "light": return .light
      case "dark": return .dark
      default: return .system
      }
    }()
    let logLevel: LogLevel = {
      switch config.logLevel {
      case "error": return .error
      case "info": return .info
      case "debug": return .debug
      default: return .off
      }
    }()

    let relay = logRelay
    let swiftConfig = OnramperConfiguration(
      apiKey: config.apiKey,
      clientId: config.clientId,
      environment: environment,
      theme: theme,
      logLevel: logLevel,
      logHandler: { record in
        OnramperLog.systemHandler(record)
        relay.emit(record)
      },
      isEventLoggingEnabled: config.isEventLoggingEnabled,
      isEventConsoleLoggingEnabled: config.isEventConsoleLoggingEnabled,
      sessionExpirationHandler: { [weak self] in
        guard let self, let handler = self.withCallbacks({ $0.sessionHandler }) else {
          throw OnramperError.userTokenRefreshFailed("no session expiration handler registered")
        }
        // Await twice: outer Promise = the callback invocation, inner Promise =
        // the JS async function's own returned Promise. Then map to the SDK type.
        try self.lifetime.checkActive()
        let creds = try await handler().await().await()
        try self.lifetime.checkActive()
        return SessionCredentials(sessionId: creds.sessionId, sessionToken: creds.sessionToken)
      }
    )

    let newClient = OnramperClient(configuration: swiftConfig)
    try lifetime.checkActive()
    client = newClient
    attachObservers(to: newClient)
  }

  @MainActor
  private func attachObservers(to client: OnramperClient) {
    stateObservation = client.$state.sink { [weak self] state in
      guard let self, (try? self.lifetime.checkActive()) != nil else { return }
      self.withCallbacks { $0.onState }?(jsonString(state.toJSDict()))
    }
    transactionIdObservation = client.$currentTransactionId.sink { [weak self] transactionId in
      guard let self, (try? self.lifetime.checkActive()) != nil else { return }
      self.withCallbacks { $0.onTransactionId }?(transactionId)
    }
    // `events` is a computed AsyncStream that captures a single continuation, so
    // access it exactly once here. CheckoutEvent is Sendable → safe to iterate
    // off the main actor.
    let stream = client.events
    eventTask = Task { [weak self] in
      for await event in stream {
        guard let self, !Task.isCancelled, (try? self.lifetime.checkActive()) != nil else { break }
        self.withCallbacks { $0.onEvent }?(jsonString(event.toJSDict()))
      }
    }
  }

  @MainActor
  private func requireClient() throws -> OnramperClient {
    try lifetime.checkActive()
    guard let client else { throw OnramperError.notInitialized }
    return client
  }

  func initialize(sessionId: String, sessionToken: String) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      do {
        guard let self else { throw BridgeLifecycleError.clientDestroyed }
        let client = try await self.requireClient()
        try await client.initialize(sessionId: sessionId, sessionToken: sessionToken)
        try self.lifetime.checkActive()
      } catch {
        throw bridgeSDKError(error)
      }
    }
  }

  func reset() throws -> Promise<Void> {
    _ = try beginPreparation()
    return Promise.async { [weak self] in
      do {
        guard let self else { throw BridgeLifecycleError.clientDestroyed }
        let client = try await self.requireClient()
        await PreparedIntentRegistry.shared.dropInvalidated(for: self.lifetime)
        await client.reset()
        try self.lifetime.checkActive()
      } catch {
        throw bridgeSDKError(error)
      }
    }
  }

  func signOut() throws -> Promise<Void> {
    _ = try beginPreparation()
    return Promise.async { [weak self] in
      do {
        guard let self else { throw BridgeLifecycleError.clientDestroyed }
        let client = try await self.requireClient()
        await PreparedIntentRegistry.shared.dropInvalidated(for: self.lifetime)
        await client.signOut()
        try self.lifetime.checkActive()
      } catch {
        throw bridgeSDKError(error)
      }
    }
  }

  // MARK: - Checkout

  func getCheckoutRequirements(
    requestJson: String,
    prefillJson: String,
    styleJson: String
  ) throws -> Promise<PreparedIntentResult> {
    let ticket = try beginPreparation()
    return Promise.async { [weak self] in
      do {
        guard let self else { throw BridgeLifecycleError.clientDestroyed }
        return try await self.performGetCheckoutRequirements(
          requestJson: requestJson,
          prefillJson: prefillJson,
          styleJson: styleJson,
          ticket: ticket
        )
      } catch {
        throw bridgeSDKError(error)
      }
    }
  }

  @MainActor
  private func performGetCheckoutRequirements(
    requestJson: String,
    prefillJson: String,
    styleJson: String,
    ticket: PreparedIntentLifetime.Ticket
  ) async throws -> PreparedIntentResult {
    let prepared = try await PreparedIntentRegistry.shared.prepare(ticket: ticket) { [self] in
      try ticket.check()
      let client = try requireClient()
      let request = try decodeCheckoutRequest(requestJson)
      // Best-effort; prefill values are never logged.
      let prefill = decodeUserPrefill(prefillJson)
      let style = decodeCheckoutButtonStyle(styleJson)
      let result = try await client.getCheckoutRequirements(request, prefill: prefill, buttonStyle: style)
      let entry = PreparedIntentRegistry.PreparedIntent(button: AnyView(result.button), createdAt: Date())
      let quoteDict = (codableToJSValue(result.quote) as? [String: Any]) ?? [:]
      return (entry, jsonString(quoteDict))
    }
    try await PreparedIntentRegistry.shared.validateDelivery(of: prepared.handle, ticket: ticket)
    return PreparedIntentResult(intentHandle: prepared.handle, quoteJson: prepared.value)
  }

  func cancelPreparedIntent(intentHandle: String) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      do {
        guard let self else { throw BridgeLifecycleError.clientDestroyed }
        try self.lifetime.checkActive()
        await PreparedIntentRegistry.shared.drop(intentHandle, owner: self.lifetime)
        try self.lifetime.checkActive()
      } catch {
        throw bridgeSDKError(error)
      }
    }
  }

  // MARK: - Teardown

  /// Releases the stored JS callbacks (Nitro holds strong refs to them) and the
  /// SDK client. Called from `OnramperClient.destroy()` in JS.
  func dispose() {
    guard lifetime.destroy() else { return }
    logRelay.setListener(nil)
    withCallbacks { $0 = Callbacks() }
    // SDK ownership and Combine subscriptions belong to the main actor.
    // Tickets are already invalid even if this cleanup has not run yet.
    Task { @MainActor [self] in
      stateObservation?.cancel()
      stateObservation = nil
      transactionIdObservation?.cancel()
      transactionIdObservation = nil
      eventTask?.cancel()
      eventTask = nil
      client = nil
      await PreparedIntentRegistry.shared.dropInvalidated(for: lifetime)
    }
  }
}
