import Foundation
import SwiftUI

private enum TestFailure: Error { case expectedProviderFailure }

/// Explicit continuations control completion order: no sleeps or network calls.
@MainActor
private final class Reply {
    private var continuation: CheckedContinuation<String, Error>?
    private var started: CheckedContinuation<Void, Never>?

    func wait() async throws -> String {
        try await withCheckedThrowingContinuation {
            continuation = $0
            started?.resume()
            started = nil
        }
    }
    func waitUntilStarted() async {
        if continuation != nil { return }
        await withCheckedContinuation { started = $0 }
    }
    func finish(_ result: Result<String, Error>) {
        guard let continuation else { fatalError("Reply was not awaited") }
        self.continuation = nil
        continuation.resume(with: result)
    }
}

@main
@MainActor
struct PreparedIntentLifecycleTests {
    static var passed = 0

    static func expect(_ condition: Bool, _ message: String) {
        guard condition else { fatalError(message) }
    }

    static func rejects<Value>(_ task: Task<Value, Error>, _ expected: BridgeLifecycleError) async {
        do { _ = try await task.value; fatalError("Expected \(expected)") }
        catch let error as BridgeLifecycleError { expect(error == expected, "Wrong lifecycle error") }
        catch { fatalError("Unexpected error: \(error)") }
    }

    private static func start(_ owner: PreparedIntentLifetime, _ registry: PreparedIntentRegistry, _ reply: Reply)
      throws -> Task<(handle: String, value: String), Error> {
        // Same issuance and registry path used by HybridOnramperNitro.
        let ticket = try owner.begin()
        return Task {
            try await registry.prepare(ticket: ticket) {
                let value = try await reply.wait()
                return (.init(button: AnyView(Text(value)), createdAt: Date()), value)
            }
        }
    }

    static func overlapping(newerFinishesFirst: Bool) async throws {
        let owner = PreparedIntentLifetime()
        let registry = PreparedIntentRegistry()
        let aReply = Reply(), bReply = Reply()
        let a = try start(owner, registry, aReply)
        await aReply.waitUntilStarted()
        let b = try start(owner, registry, bReply)
        await bReply.waitUntilStarted()
        if !newerFinishesFirst {
            aReply.finish(.success("A"))
            await rejects(a, .intentInvalidated)
            expect(await registry.count == 0, "A retained an orphan before B finished")
        }
        bReply.finish(.success("B"))
        let result = try await b.value
        expect(result.value == "B", "Wrong quote returned")
        if newerFinishesFirst {
            aReply.finish(.success("A"))
            await rejects(a, .intentInvalidated)
        }
        expect(await registry.count == 1, "Only B should be retained")
        expect(await registry.consume(result.handle) != nil, "B must be usable")
        expect(await registry.consume(result.handle) == nil, "Handles are single use")
        expect(await registry.count == 0, "Consumed button must leave the registry")
        passed += 1
    }

    static func newerFails() async throws {
        let owner = PreparedIntentLifetime(), registry = PreparedIntentRegistry()
        let aReply = Reply(), bReply = Reply()
        let a = try start(owner, registry, aReply)
        await aReply.waitUntilStarted()
        let b = try start(owner, registry, bReply)
        await bReply.waitUntilStarted()
        bReply.finish(.failure(TestFailure.expectedProviderFailure))
        do { _ = try await b.value; fatalError("Expected provider failure") }
        catch TestFailure.expectedProviderFailure { }
        aReply.finish(.success("obsolete A"))
        await rejects(a, .intentInvalidated)
        expect(await registry.count == 0, "A must not reappear after B fails")
        passed += 1
    }

    static func invalidation(destroy: Bool, staleFails: Bool) async throws {
        let owner = PreparedIntentLifetime(), registry = PreparedIntentRegistry(), reply = Reply()
        let task = try start(owner, registry, reply)
        await reply.waitUntilStarted()
        if destroy {
            expect(owner.destroy(), "First destruction should succeed")
            expect(!owner.destroy(), "Destruction must be idempotent")
        } else {
            // reset and signOut both invalidate at the synchronous Nitro entrypoint.
            _ = try owner.begin()
        }
        await registry.dropInvalidated(for: owner)
        reply.finish(staleFails ? .failure(TestFailure.expectedProviderFailure) : .success("late"))
        await rejects(task, destroy ? .clientDestroyed : .intentInvalidated)
        expect(await registry.count == 0, "Late response retained a button")
        if destroy {
            do { _ = try owner.begin(); fatalError("Destroyed owner accepted a request") }
            catch BridgeLifecycleError.clientDestroyed { }
        }
        passed += 1
    }

    static func handleInvalidationAndIsolation() async throws {
        let owner = PreparedIntentLifetime(), other = PreparedIntentLifetime(), registry = PreparedIntentRegistry()
        let ticket = try owner.begin(), otherTicket = try other.begin()
        let first = try await registry.prepare(ticket: ticket) { (.init(button: AnyView(Text("A")), createdAt: Date()), "A") }
        let second = try await registry.prepare(ticket: otherTicket) { (.init(button: AnyView(Text("B")), createdAt: Date()), "B") }
        // A different client's cancel must not discard B.
        await registry.drop(second.handle, owner: owner)
        _ = try owner.begin()
        // Even before asynchronous cleanup, a stale handle cannot mount.
        expect(await registry.consume(first.handle) == nil, "Stale handle mounted before cleanup")
        await registry.dropInvalidated(for: owner)
        expect(await registry.count == 1, "Cleanup discarded another client")
        expect(await registry.consume(second.handle) != nil, "Other client lost its button")
        passed += 1
    }

    static func cleanupWithoutConsuming() async throws {
        let owner = PreparedIntentLifetime(), registry = PreparedIntentRegistry()
        let ticket = try owner.begin()
        _ = try await registry.prepare(ticket: ticket) { (.init(button: AnyView(Text("A")), createdAt: Date()), ()) }
        expect(await registry.count == 1, "Missing fixture")
        _ = owner.destroy()
        await registry.dropInvalidated(for: owner)
        expect(await registry.count == 0, "Destroy left an unmounted button retained")
        passed += 1
    }

    static func skipsSupersededWork() async throws {
        let owner = PreparedIntentLifetime(), registry = PreparedIntentRegistry()
        let oldTicket = try owner.begin()
        _ = try owner.begin()
        do {
            _ = try await registry.prepare(ticket: oldTicket) { () -> (PreparedIntentRegistry.PreparedIntent, Void) in
                fatalError("Superseded work should not call the SDK")
            }
            fatalError("Expected invalidation")
        } catch BridgeLifecycleError.intentInvalidated { }
        passed += 1
    }

    static func invalidatedWhileMounting() async throws {
        let owner = PreparedIntentLifetime(), registry = PreparedIntentRegistry()
        let result = try await registry.prepare(ticket: owner.begin()) { (.init(button: AnyView(Text("A")), createdAt: Date()), ()) }
        guard let entry = await registry.consume(result.handle) else { fatalError("Missing fixture") }
        expect(entry.isValid, "Current entry should mount")
        _ = try owner.begin()
        expect(!entry.isValid, "An entry invalidated during the main-actor hop must not mount")
        passed += 1
    }

    static func expiryAndCancellation() async throws {
        let owner = PreparedIntentLifetime(), registry = PreparedIntentRegistry()
        let old = try await registry.prepare(ticket: owner.begin()) {
            (.init(button: AnyView(Text("old")), createdAt: Date().addingTimeInterval(-301)), ())
        }
        expect(await registry.consume(old.handle) == nil, "Expired button mounted without another store")
        let current = try await registry.prepare(ticket: owner.begin()) { (.init(button: AnyView(Text("new")), createdAt: Date()), ()) }
        await registry.drop(current.handle, owner: owner)
        expect(await registry.consume(current.handle) == nil, "Cancelled handle mounted")
        expect(await registry.count == 0, "Cancellation retained a view")
        passed += 1
    }

    static func main() async throws {
        let watchdog = DispatchWorkItem {
            fputs("Native lifecycle tests timed out waiting for a continuation\n", stderr)
            exit(1)
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + 30, execute: watchdog)
        defer { watchdog.cancel() }
        try await overlapping(newerFinishesFirst: false)
        try await overlapping(newerFinishesFirst: true)
        try await newerFails()
        for destroy in [false, true] {
            for staleFails in [false, true] { try await invalidation(destroy: destroy, staleFails: staleFails) }
        }
        try await handleInvalidationAndIsolation()
        try await cleanupWithoutConsuming()
        try await skipsSupersededWork()
        try await invalidatedWhileMounting()
        try await expiryAndCancellation()
        print("Passed \(passed) native prepared-intent lifecycle scenarios")
    }
}
