import Combine
import ExpoModulesCore
import OnramperSDK
#if canImport(UIKit)
import SwiftUI
#endif

public class OnramperReactNativeModule: Module {
    private var client: OnramperClient?
    private var stateObservation: AnyCancellable?
    private var eventTask: Task<Void, Never>?
    private let intentRegistry = PreparedIntentRegistry()

    /// Tracks pending session-credentials requests issued via the
    /// `onSessionExpired` event. JS responds with `provideSessionCredentials`,
    /// which resumes the matching continuation. Each entry is single-flight:
    /// the SDK serializes session refresh, so map size is effectively 0..1.
    private actor SessionRequests {
        private var continuations: [String: CheckedContinuation<SessionCredentials, Error>] = [:]
        private var counter: UInt64 = 0

        func register(_ continuation: CheckedContinuation<SessionCredentials, Error>) -> String {
            counter &+= 1
            let token = "session-\(counter)"
            continuations[token] = continuation
            return token
        }

        func resolve(token: String, credentials: SessionCredentials) -> Bool {
            guard let continuation = continuations.removeValue(forKey: token) else { return false }
            continuation.resume(returning: credentials)
            return true
        }

        func reject(token: String, error: Error) -> Bool {
            guard let continuation = continuations.removeValue(forKey: token) else { return false }
            continuation.resume(throwing: error)
            return true
        }

        func cancelAll() {
            for continuation in continuations.values {
                continuation.resume(throwing: OnramperError.userTokenRefreshFailed("module torn down"))
            }
            continuations.removeAll()
        }
    }

    private let sessionRequests = SessionRequests()

    public func definition() -> ModuleDefinition {
        Name("OnramperReactNative")

        Events("onStateChanged", "onCheckoutEvent", "onSessionExpired")

        AsyncFunction("configure") { (config: OnramperConfigurationDict) async throws in
            try await mappingOnramperError {
                try await self.configure(config: config)
            }
        }

        AsyncFunction("initialize") { (sessionId: String, sessionToken: String) async throws in
            try await mappingOnramperError {
                try await self.requireClient().initialize(sessionId: sessionId, sessionToken: sessionToken)
            }
        }

        AsyncFunction("reset") { () async throws in
            try await mappingOnramperError {
                try await self.requireClient().reset()
            }
        }

        AsyncFunction("provideSessionCredentials") { (token: String, credentials: SessionCredentialsDict) async in
            _ = await self.sessionRequests.resolve(token: token, credentials: credentials.toSwift())
        }

        AsyncFunction("failSessionRefresh") { (token: String, message: String) async in
            let error = OnramperError.userTokenRefreshFailed(message)
            _ = await self.sessionRequests.reject(token: token, error: error)
        }

        #if canImport(UIKit)
        AsyncFunction("getCheckoutRequirements") {
            (request: CheckoutRequestDict, buttonStyle: CheckoutButtonStyleDict) async throws -> PreparedIntentDict in
            try await mappingOnramperError {
                try await self.prepareIntent(request: request, buttonStyle: buttonStyle)
            }
        }

        AsyncFunction("cancelPreparedIntent") { (intentHandle: String) async in
            await self.intentRegistry.drop(intentHandle)
        }

        View(OnramperCheckoutButtonView.self) {
            Prop("intentHandle") { (view: OnramperCheckoutButtonView, handle: String) in
                view.bind(handle: handle, registry: self.intentRegistry)
            }
            Events("onCheckoutCompleted", "onCheckoutFailed", "onCheckoutCancelled")
        }
        #endif

        OnDestroy {
            self.tearDown()
        }
    }

    private func tearDown() {
        stateObservation?.cancel()
        stateObservation = nil
        eventTask?.cancel()
        eventTask = nil
        Task { await self.sessionRequests.cancelAll() }
        client = nil
    }

    @MainActor
    private func configure(config: OnramperConfigurationDict) async throws {
        if let existing = self.client {
            if existing.configuration.apiKey == config.apiKey
                && existing.configuration.clientId == config.clientId {
                return
            }
            throw NSError(domain: "OnramperReactNative", code: 0, userInfo: [
                "code": "clientAlreadyConfigured",
                "message": "OnramperClient already configured with different apiKey/clientId",
            ])
        }

        let swiftHandler: @Sendable () async throws -> SessionCredentials = { [weak self] in
            guard let self else {
                throw OnramperError.userTokenRefreshFailed("module deallocated")
            }
            return try await self.requestFreshSessionCredentials()
        }
        let swiftConfig = config.toSwift(sessionExpirationHandler: swiftHandler)
        let newClient = OnramperClient(configuration: swiftConfig)
        self.client = newClient
        self.attachObservers(to: newClient)
    }

    /// Suspends until JS calls `provideSessionCredentials(token, creds)` or
    /// `failSessionRefresh(token, message)`. Emits `onSessionExpired` with the
    /// request token so the JS layer can respond asynchronously without being
    /// gated by the synchronous limitations of expo-modules-core's native →
    /// JS function calls.
    private func requestFreshSessionCredentials() async throws -> SessionCredentials {
        try await withCheckedThrowingContinuation { continuation in
            Task {
                let token = await self.sessionRequests.register(continuation)
                self.sendEvent("onSessionExpired", ["token": token])
            }
        }
    }

    @MainActor
    private func attachObservers(to client: OnramperClient) {
        stateObservation = client.$state.sink { [weak self] state in
            self?.sendEvent("onStateChanged", state.toJSDict())
        }
        eventTask = Task { [weak self] in
            for await event in client.events {
                self?.sendEvent("onCheckoutEvent", event.toJSDict())
            }
        }
    }

    private func requireClient() throws -> OnramperClient {
        guard let client = self.client else {
            throw NSError(domain: "OnramperReactNative", code: 0, userInfo: [
                "code": "notInitialized",
                "message": "configure() must be called before this method",
            ])
        }
        return client
    }

    #if canImport(UIKit)
    @MainActor
    private func prepareIntent(
        request: CheckoutRequestDict,
        buttonStyle: CheckoutButtonStyleDict
    ) async throws -> PreparedIntentDict {
        let client = try requireClient()
        // Invalidate any prior prepared intent — mirrors the SDK's single-flight gate.
        await intentRegistry.invalidateAll()

        let swiftRequest = request.toSwift()
        let style = buttonStyle.toSwift()
        let result = try await client.getCheckoutRequirements(swiftRequest, buttonStyle: style)

        let entry = PreparedIntentRegistry.PreparedIntent(
            button: AnyView(result.button),
            createdAt: Date()
        )
        let handle = await intentRegistry.store(entry)

        var dict = PreparedIntentDict()
        dict.intentHandle = handle
        dict.quote = (codableToJSValue(result.quote) as? [String: Any]) ?? [:]
        return dict
    }
    #endif
}
