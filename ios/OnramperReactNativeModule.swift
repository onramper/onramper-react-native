import ExpoModulesCore
import OnramperSDK
import Combine

public class OnramperReactNativeModule: Module {
    private var client: OnramperClient?
    private var sessionExpiredHandler: JavaScriptFunction<SessionCredentialsDict>?
    private var stateObservation: AnyCancellable?
    private var eventTask: Task<Void, Never>?

    public func definition() -> ModuleDefinition {
        Name("OnramperReactNative")

        Events("onStateChanged", "onCheckoutEvent")

        AsyncFunction("configure") {
            (config: OnramperConfigurationDict, onSessionExpired: JavaScriptFunction<SessionCredentialsDict>) async throws in
            try await mappingOnramperError {
                try await self.configure(config: config, sessionExpiredJS: onSessionExpired)
            }
        }

        AsyncFunction("initialize") { (sessionId: String, sessionToken: String) async throws in
            try await mappingOnramperError {
                try await self.requireClient().initialize(sessionId: sessionId, sessionToken: sessionToken)
            }
        }

        AsyncFunction("reset") { () async throws in
            try await mappingOnramperError {
                await self.requireClient().reset()
            }
        }

        OnDestroy {
            self.tearDown()
        }
    }

    private func tearDown() {
        stateObservation?.cancel()
        stateObservation = nil
        eventTask?.cancel()
        eventTask = nil
        sessionExpiredHandler = nil
        client = nil
    }

    private func configure(
        config: OnramperConfigurationDict,
        sessionExpiredJS: JavaScriptFunction<SessionCredentialsDict>
    ) async throws {
        if let existing = self.client {
            if existing.configuration.apiKey == config.apiKey
                && existing.configuration.clientId == config.clientId {
                self.sessionExpiredHandler = sessionExpiredJS
                return
            }
            throw NSError(domain: "OnramperReactNative", code: 0, userInfo: [
                "code": "clientAlreadyConfigured",
                "message": "OnramperClient already configured with different apiKey/clientId",
            ])
        }

        self.sessionExpiredHandler = sessionExpiredJS
        let swiftHandler: @Sendable () async throws -> SessionCredentials = { [weak self] in
            guard let js = self?.sessionExpiredHandler else {
                throw OnramperError.userTokenRefreshFailed("session handler unavailable")
            }
            do {
                let dict = try js.call()
                return dict.toSwift()
            } catch {
                throw NSError(domain: "OnramperReactNative", code: 0, userInfo: [
                    "code": "sessionExpirationHandlerFailed",
                    "message": error.localizedDescription,
                ])
            }
        }
        let swiftConfig = config.toSwift(sessionExpirationHandler: swiftHandler)
        let newClient = await MainActor.run { OnramperClient(configuration: swiftConfig) }
        self.client = newClient
        await self.attachObservers(to: newClient)
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
}
