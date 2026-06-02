import Foundation
import Security
import SwiftUI

actor PreparedIntentRegistry {
    /// Process-wide registry. `getCheckoutRequirements` (on HybridOnramperNitro)
    /// stores the SwiftUI button under a ULID handle; the separate
    /// HybridOnramperCheckoutButton view consumes it by handle. Handles are
    /// unique ULIDs, so a single shared registry is safe across clients.
    static let shared = PreparedIntentRegistry()

    struct PreparedIntent {
        let button: AnyView
        let createdAt: Date
        var consumed: Bool = false
    }

    private var entries: [String: PreparedIntent] = [:]
    private let ttl: TimeInterval

    init(ttl: TimeInterval = 300) {
        self.ttl = ttl
    }

    func store(_ entry: PreparedIntent) -> String {
        sweepExpired()
        let handle = Self.makeULID()
        entries[handle] = entry
        return handle
    }

    func consume(_ handle: String) -> PreparedIntent? {
        guard var entry = entries[handle], !entry.consumed else { return nil }
        entry.consumed = true
        entries[handle] = entry
        return entry
    }

    func drop(_ handle: String) {
        entries.removeValue(forKey: handle)
    }

    func invalidateAll() {
        entries.removeAll()
    }

    private func sweepExpired() {
        let now = Date()
        entries = entries.filter { now.timeIntervalSince($0.value.createdAt) < ttl }
    }

    private static func makeULID() -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, 10, &bytes[6])
        let ts = UInt64(Date().timeIntervalSince1970 * 1000)
        for i in 0..<6 {
            bytes[i] = UInt8((ts >> ((5 - i) * 8)) & 0xFF)
        }
        let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
        var out = ""
        var bits: UInt64 = 0
        var bitCount = 0
        for byte in bytes {
            bits = (bits << 8) | UInt64(byte)
            bitCount += 8
            while bitCount >= 5 {
                bitCount -= 5
                let idx = Int((bits >> bitCount) & 0x1F)
                out.append(alphabet[idx])
            }
        }
        if bitCount > 0 {
            let idx = Int((bits << (5 - bitCount)) & 0x1F)
            out.append(alphabet[idx])
        }
        return String(out.prefix(26))
    }
}
