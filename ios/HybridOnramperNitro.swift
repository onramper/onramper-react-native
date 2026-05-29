import Foundation
import NitroModules
import OnramperSDK

final class HybridOnramperNitro: HybridOnramperNitroSpec {
  private var ticker: Timer?
  private var tickCount: Double = 0

  // Spike #1: JS<->Swift round-trip.
  func ping(message: String) throws -> Promise<String> {
    return Promise.async { "pong: \(message)" }
  }

  // Spike #2: touch a real OnramperSDK symbol to prove the vendored
  // xcframework links and is callable from a Nitro Swift target.
  func sdkProbe() throws -> Promise<String> {
    return Promise.async {
      let env = OnramperConfiguration.Environment.production
      return "OnramperSDK linked: \(env)"
    }
  }

  // Spike #4: store the JS callback natively and fire it repeatedly — the
  // event-stream mechanism the real onStateChanged/onCheckoutEvent will use.
  func startTicker(onTick: @escaping (Double) -> Void) throws -> Promise<Void> {
    return Promise.async {
      DispatchQueue.main.async {
        self.ticker?.invalidate()
        self.tickCount = 0
        self.ticker = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
          guard let self else { return }
          self.tickCount += 1
          onTick(self.tickCount)
        }
      }
    }
  }

  func stopTicker() throws -> Promise<Void> {
    return Promise.async {
      DispatchQueue.main.async {
        self.ticker?.invalidate()
        self.ticker = nil
      }
    }
  }
}
