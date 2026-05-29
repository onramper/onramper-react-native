import NitroModules
import SwiftUI
import UIKit

// Spike #3: a Nitro View that hosts SwiftUI via UIHostingController — proving the
// pattern the real OnramperCheckoutButtonView (Phase 2) depends on. The SDK's
// checkout button is SwiftUI, so it will be embedded the same way.
final class HybridNitroSpikeView: HybridNitroSpikeViewSpec {
  var label: String = "" {
    didSet { host.rootView = AnyView(SpikeLabel(text: label)) }
  }

  private let host = UIHostingController(rootView: AnyView(SpikeLabel(text: "")))

  var view: UIView { host.view }
}

private struct SpikeLabel: View {
  let text: String
  var body: some View {
    Text(text.isEmpty ? "(SwiftUI placeholder)" : text)
      .font(.headline)
      .padding()
      .frame(maxWidth: .infinity, alignment: .center)
  }
}
