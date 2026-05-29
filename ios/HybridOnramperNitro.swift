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
  private var client: OnramperClient?
  private var stateObservation: AnyCancellable?
  private var eventTask: Task<Void, Never>?

  private var onState: ((String) -> Void)?
  private var onEvent: ((String) -> Void)?
  // Nitro wraps a callback's return value in a Promise; our callback already
  // returns Promise<NitroSessionCredentials>, hence the doubly-nested Promise.
  private var sessionHandler: (() -> Promise<Promise<NitroSessionCredentials>>)?

  // MARK: - Listener registration (synchronous)

  func setStateListener(onState: @escaping (String) -> Void) {
    self.onState = onState
  }

  func setEventListener(onEvent: @escaping (String) -> Void) {
    self.onEvent = onEvent
  }

  func setSessionExpirationHandler(handler: @escaping () -> Promise<Promise<NitroSessionCredentials>>) {
    self.sessionHandler = handler
  }

  // MARK: - Lifecycle

  func configure(config: OnramperNitroConfig) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self else { return }
      try await self.performConfigure(config)
    }
  }

  @MainActor
  private func performConfigure(_ config: OnramperNitroConfig) async throws {
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

    let swiftConfig = OnramperConfiguration(
      apiKey: config.apiKey,
      clientId: config.clientId,
      environment: environment,
      theme: theme,
      logLevel: logLevel,
      sessionExpirationHandler: { [weak self] in
        guard let self, let handler = self.sessionHandler else {
          throw OnramperError.userTokenRefreshFailed("no session expiration handler registered")
        }
        // Await twice: outer Promise = the callback invocation, inner Promise =
        // the JS async function's own returned Promise. Then map to the SDK type.
        let creds = try await handler().await().await()
        return SessionCredentials(sessionId: creds.sessionId, sessionToken: creds.sessionToken)
      }
    )

    let newClient = OnramperClient(configuration: swiftConfig)
    client = newClient
    attachObservers(to: newClient)
  }

  @MainActor
  private func attachObservers(to client: OnramperClient) {
    stateObservation = client.$state.sink { [weak self] state in
      self?.onState?(jsonString(state.toJSDict()))
    }
    // `events` is a computed AsyncStream that captures a single continuation, so
    // access it exactly once here. CheckoutEvent is Sendable → safe to iterate
    // off the main actor.
    let stream = client.events
    eventTask = Task { [weak self] in
      for await event in stream {
        self?.onEvent?(jsonString(event.toJSDict()))
      }
    }
  }

  @MainActor
  private func requireClient() throws -> OnramperClient {
    guard let client else { throw OnramperError.notInitialized }
    return client
  }

  func initialize(sessionId: String, sessionToken: String) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self else { return }
      let client = try await self.requireClient()
      try await client.initialize(sessionId: sessionId, sessionToken: sessionToken)
    }
  }

  func reset() throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self else { return }
      let client = try await self.requireClient()
      await client.reset()
    }
  }

  func signOut() throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self else { return }
      let client = try await self.requireClient()
      await client.signOut()
    }
  }

  // MARK: - Checkout

  func getCheckoutRequirements(requestJson: String, styleJson: String) throws -> Promise<PreparedIntentResult> {
    return Promise.async { [weak self] in
      guard let self else { throw OnramperError.notInitialized }
      return try await self.performGetCheckoutRequirements(requestJson: requestJson, styleJson: styleJson)
    }
  }

  @MainActor
  private func performGetCheckoutRequirements(requestJson: String, styleJson: String) async throws -> PreparedIntentResult {
    let client = try requireClient()
    let request = try decodeCheckoutRequest(requestJson)
    let style = decodeCheckoutButtonStyle(styleJson)

    // Single-flight: a new prepared intent supersedes any prior unconsumed one.
    await PreparedIntentRegistry.shared.invalidateAll()

    let result = try await client.getCheckoutRequirements(request, buttonStyle: style)
    let entry = PreparedIntentRegistry.PreparedIntent(button: AnyView(result.button), createdAt: Date())
    let handle = await PreparedIntentRegistry.shared.store(entry)
    let quoteDict = (codableToJSValue(result.quote) as? [String: Any]) ?? [:]
    return PreparedIntentResult(intentHandle: handle, quoteJson: jsonString(quoteDict))
  }

  func cancelPreparedIntent(intentHandle: String) throws -> Promise<Void> {
    return Promise.async {
      await PreparedIntentRegistry.shared.drop(intentHandle)
    }
  }

  // MARK: - Teardown

  /// Releases the stored JS callbacks (Nitro holds strong refs to them) and the
  /// SDK client. Called from `OnramperClient.destroy()` in JS.
  func dispose() {
    stateObservation?.cancel()
    stateObservation = nil
    eventTask?.cancel()
    eventTask = nil
    onState = nil
    onEvent = nil
    sessionHandler = nil
    client = nil
  }
}
