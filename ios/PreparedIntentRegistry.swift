import Foundation
import Security
import SwiftUI

/// Issued synchronously at the Nitro boundary, so request order does not depend
/// on when Promise.async happens to reach the main actor. Disposal can also
/// invalidate tickets immediately from the JS thread.
final class PreparedIntentLifetime: @unchecked Sendable {
    private let lock = NSLock()
    private var generation = UUID()
    private var destroyed = false

    struct Ticket {
        fileprivate let owner: PreparedIntentLifetime
        fileprivate let generation: UUID

        func check() throws { try owner.check(generation: generation) }
    }

    func begin() throws -> Ticket {
        lock.lock()
        defer { lock.unlock() }
        guard !destroyed else { throw BridgeLifecycleError.clientDestroyed }
        generation = UUID()
        return Ticket(owner: self, generation: generation)
    }

    func checkActive() throws { try check(generation: nil) }

    private func check(generation expected: UUID?) throws {
        lock.lock()
        defer { lock.unlock() }
        guard !destroyed else { throw BridgeLifecycleError.clientDestroyed }
        if let expected, expected != generation { throw BridgeLifecycleError.intentInvalidated }
    }

    func destroy() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !destroyed else { return false }
        destroyed = true
        return true
    }
}

enum BridgeLifecycleError: String, Error {
    case clientDestroyed
    case intentInvalidated

    var payload: [String: Any] {
        switch self {
        case .clientDestroyed:
            return ["code": rawValue, "supportCode": rawValue,
                    "message": "This OnramperClient has been destroyed. Create a new client before making SDK calls.",
                    "userMessage": "This checkout session has ended. Please reopen checkout."]
        case .intentInvalidated:
            return ["code": rawValue, "supportCode": rawValue,
                    "message": "This checkout preparation was superseded or cleared. Use the most recent request.",
                    "userMessage": "Your checkout details have changed. Please use the latest quote."]
        }
    }
}

actor PreparedIntentRegistry {
    /// Process-wide registry. `getCheckoutRequirements` (on HybridOnramperNitro)
    /// stores the SwiftUI button under a ULID handle; the separate
    /// HybridOnramperCheckoutButton view consumes it by handle. Handles are
    /// unique ULIDs, so a single shared registry is safe across clients.
    static let shared = PreparedIntentRegistry()

    struct PreparedIntent {
        let button: AnyView
        let createdAt: Date
        fileprivate var ticket: PreparedIntentLifetime.Ticket?

        init(button: AnyView, createdAt: Date) {
            self.button = button
            self.createdAt = createdAt
        }

        // The main-actor view rechecks after the hop from the registry actor.
        var isValid: Bool {
            guard let ticket else { return true }
            do { try ticket.check(); return true } catch { return false }
        }
    }

    private var entries: [String: PreparedIntent] = [:]
    // Internal diagnostics used by the standalone native regression suite.
    var count: Int { entries.count }
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

    /// The bridge uses this path so stale successes AND stale errors are
    /// rejected consistently, including SDK cancellation errors. The operation
    /// may still finish on the server; this only controls local button ownership.
    func prepare<Value>(
        ticket: PreparedIntentLifetime.Ticket,
        operation: @MainActor () async throws -> (PreparedIntent, Value)
    ) async throws -> (handle: String, value: Value) {
        dropInvalidated(for: ticket.owner)
        try ticket.check()
        do {
            let (entry, value) = try await operation()
            try ticket.check()
            sweepExpired()
            let handle = Self.makeULID()
            var ownedEntry = entry
            ownedEntry.ticket = ticket
            entries[handle] = ownedEntry
            return (handle, value)
        } catch {
            try ticket.check()
            throw error
        }
    }

    func consume(_ handle: String) -> PreparedIntent? {
        // Transfer ownership to the mounted view instead of retaining consumed
        // SwiftUI views until some future quote request triggers a sweep.
        guard let entry = entries.removeValue(forKey: handle),
              Date().timeIntervalSince(entry.createdAt) < ttl else { return nil }
        return entry.isValid ? entry : nil
    }

    func drop(_ handle: String, owner: PreparedIntentLifetime? = nil) {
        if let owner, entries[handle]?.ticket?.owner !== owner { return }
        entries.removeValue(forKey: handle)
    }

    func dropInvalidated(for owner: PreparedIntentLifetime) {
        entries = entries.filter { _, entry in
            guard let ticket = entry.ticket, ticket.owner === owner else { return true }
            do { try ticket.check(); return true } catch { return false }
        }
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
