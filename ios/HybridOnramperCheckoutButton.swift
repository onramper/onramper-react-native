#if canImport(UIKit)
import NitroModules
import SwiftUI
import UIKit

/// Nitro view that renders the SwiftUI `OnramperCheckoutButton` produced by
/// `getCheckoutRequirements` and stashed in `PreparedIntentRegistry.shared`
/// under `intentHandle`. The button is hosted in a `UIHostingController` whose
/// view is added to our container; the controller is attached as a child of the
/// nearest React view controller so the SDK button can present its login /
/// webview sheets.
final class HybridOnramperCheckoutButton: HybridOnramperCheckoutButtonSpec {
  private let container = CheckoutContainerView()
  private var mountedHandle: String?
  private var lastReportedHeight: CGFloat = 0

  var onContentHeightChange: ((_ height: Double) -> Void)?

  var intentHandle: String = "" {
    didSet {
      guard !intentHandle.isEmpty, intentHandle != mountedHandle else { return }
      mount(handle: intentHandle)
    }
  }

  var view: UIView { container }

  private func mount(handle: String) {
    mountedHandle = handle
    lastReportedHeight = 0
    Task { @MainActor [weak self] in
      guard let self else { return }
      guard let entry = await PreparedIntentRegistry.shared.consume(handle) else {
        // Handle was invalidated or already consumed — leave the view empty.
        return
      }
      // Pin the SwiftUI content to the container's width so long ToS text wraps
      // instead of laying out at its intrinsic (single-line) width and spilling
      // past the right edge. `.fixedSize(vertical:)` lets it take its ideal
      // height, which is measured and reported to JS so React Native can size
      // the view (ToS text below the Buy button makes it taller than 56pt, and
      // can appear or disappear after mount).
      self.container.host(AnyView(
        entry.button
          .frame(maxWidth: .infinity, alignment: .leading)
          .fixedSize(horizontal: false, vertical: true)
          .background(GeometryReader { proxy in
            Color.clear.preference(key: CheckoutContentHeightKey.self, value: proxy.size.height)
          })
          .onPreferenceChange(CheckoutContentHeightKey.self) { [weak self] height in
            self?.reportContentHeight(height)
          }
      ))
    }
  }

  @MainActor
  private func reportContentHeight(_ height: CGFloat) {
    guard height > 0, abs(height - lastReportedHeight) > 0.5 else { return }
    lastReportedHeight = height
    onContentHeightChange?(Double(height))
  }
}

/// Carries the hosted content's laid-out height out of SwiftUI.
private struct CheckoutContentHeightKey: PreferenceKey {
  static let defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
    value = max(value, nextValue())
  }
}

/// Container that hosts the SwiftUI button and (re)attaches the hosting
/// controller to the React view-controller hierarchy when it enters a window.
final class CheckoutContainerView: UIView {
  private var hostingController: UIHostingController<AnyView>?

  override init(frame: CGRect) {
    super.init(frame: frame)
    // Backstop: never draw over neighbouring React Native views, even for the
    // frame between a content-size change and JS applying the new height.
    clipsToBounds = true
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    clipsToBounds = true
  }

  @MainActor
  func host(_ rootView: AnyView) {
    // Re-hosting (e.g. when `intentHandle` changes) must tear the previous
    // controller down first, otherwise its view/constraints accumulate and the
    // old controller stays childed to the parent VC.
    detachHosted()
    let controller = UIHostingController(rootView: rootView)
    controller.view.backgroundColor = .clear
    // Inside a ScrollView near the notch/home indicator the hosting controller
    // would otherwise inject safe-area padding that shifts the content as it scrolls.
    if #available(iOS 16.4, *) {
      controller.safeAreaRegions = []
    }
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    hostingController = controller
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    attachChildIfPossible()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    attachChildIfPossible()
  }

  private func attachChildIfPossible() {
    guard let controller = hostingController, controller.parent == nil,
          let parent = nearestViewController() else { return }
    parent.addChild(controller)
    controller.didMove(toParent: parent)
  }

  private func nearestViewController() -> UIViewController? {
    var responder: UIResponder? = self
    while let current = responder {
      if let vc = current as? UIViewController { return vc }
      responder = current.next
    }
    return nil
  }

  /// Detaches the currently hosted controller from the VC hierarchy and removes
  /// its view/constraints. Safe to call when nothing is hosted.
  @MainActor
  private func detachHosted() {
    guard let controller = hostingController else { return }
    controller.willMove(toParent: nil)
    controller.view.removeFromSuperview()
    controller.removeFromParent()
    hostingController = nil
  }

  deinit {
    // deinit can't hop to @MainActor; the container is torn down on the main
    // thread by UIKit, so touching the controller here is safe.
    if let controller = hostingController {
      controller.willMove(toParent: nil)
      controller.view.removeFromSuperview()
      controller.removeFromParent()
    }
  }
}
#endif
