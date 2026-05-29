import NitroModules

final class HybridOnramperNitro: HybridOnramperNitroSpec {
  func ping(message: String) throws -> Promise<String> {
    return Promise.async { "pong: \(message)" }
  }
}
