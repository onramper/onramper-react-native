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

        // Functions wired in subsequent tasks.

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
}
