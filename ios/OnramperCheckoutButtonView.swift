#if canImport(UIKit)
import ExpoModulesCore
import SwiftUI
import UIKit
import OnramperSDK

/// Hosts the SwiftUI `OnramperCheckoutButton` produced by
/// `OnramperClient.getCheckoutRequirements`. The button is resolved from
/// `PreparedIntentRegistry` by `intentHandle` and embedded via
/// `UIHostingController` attached to the React view controller.
///
/// Note: per-view event dispatchers (`onCheckoutCompleted` / `onCheckoutFailed` /
/// `onCheckoutCancelled`) stay declared for API forward-compat, but are not fired
/// by this view. The SDK's `OnramperCheckoutButton` does not expose external
/// callback hooks, so checkout outcomes flow via the module-level
/// `onCheckoutEvent` stream (see `OnramperReactNativeModule`).
final class OnramperCheckoutButtonView: ExpoView {
    private var hostingController: UIHostingController<AnyView>?
    private var bound = false
    private weak var registry: PreparedIntentRegistry?
    private var pendingHandle: String?

    let onCheckoutCompleted = EventDispatcher()
    let onCheckoutFailed = EventDispatcher()
    let onCheckoutCancelled = EventDispatcher()

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        clipsToBounds = false
    }

    func bind(handle: String, registry: PreparedIntentRegistry) {
        guard !bound else {
            onCheckoutFailed([
                "code": "intentAlreadyConsumed",
                "message": "Intent handle already consumed by another view.",
            ])
            return
        }
        self.registry = registry
        self.pendingHandle = handle
        mountIfReady()
    }

    private func mountIfReady() {
        guard let handle = pendingHandle, let registry = registry else { return }
        bound = true
        Task { @MainActor [weak self] in
            guard let self else { return }
            guard let entry = await registry.consume(handle) else {
                self.onCheckoutFailed([
                    "code": "intentInvalidated",
                    "message": "Intent handle was invalidated or never created.",
                ])
                return
            }
            self.installHost(entry: entry)
        }
    }

    @MainActor
    private func installHost(entry: PreparedIntentRegistry.PreparedIntent) {
        // `entry.button` is already `AnyView` (constructed in the module when storing
        // the intent), so pass it directly without re-wrapping.
        let host = UIHostingController(rootView: entry.button)
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        self.hostingController = host
        addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            host.view.topAnchor.constraint(equalTo: topAnchor),
            host.view.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        attachAsChildVCIfPossible()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        attachAsChildVCIfPossible()
    }

    private func attachAsChildVCIfPossible() {
        guard let host = hostingController, host.parent == nil else { return }
        guard let parent = self.reactViewController() else { return }
        parent.addChild(host)
        host.didMove(toParent: parent)
    }

    deinit {
        if let host = hostingController {
            host.willMove(toParent: nil)
            host.view.removeFromSuperview()
            host.removeFromParent()
        }
    }
}

private extension UIView {
    func reactViewController() -> UIViewController? {
        var responder: UIResponder? = self
        while let r = responder {
            if let vc = r as? UIViewController { return vc }
            responder = r.next
        }
        return nil
    }
}
#endif
