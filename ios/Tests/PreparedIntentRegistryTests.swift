import XCTest
import SwiftUI
@testable import OnramperReactNative

final class PreparedIntentRegistryTests: XCTestCase {
    func test_storeReturnsHandle_consumeReturnsEntry() async {
        let registry = PreparedIntentRegistry()
        let entry = PreparedIntentRegistry.PreparedIntent(
            button: AnyView(Text("hi")),
            createdAt: Date()
        )
        let handle = await registry.store(entry)
        XCTAssertFalse(handle.isEmpty)
        let consumed = await registry.consume(handle)
        XCTAssertNotNil(consumed)
    }

    func test_consumeTwice_returnsNilSecondTime() async {
        let registry = PreparedIntentRegistry()
        let entry = PreparedIntentRegistry.PreparedIntent(
            button: AnyView(Text("hi")),
            createdAt: Date()
        )
        let handle = await registry.store(entry)
        _ = await registry.consume(handle)
        let second = await registry.consume(handle)
        XCTAssertNil(second)
    }

    func test_invalidateAll_dropsPriorEntries() async {
        let registry = PreparedIntentRegistry()
        let h1 = await registry.store(.init(button: AnyView(Text("a")), createdAt: Date()))
        await registry.invalidateAll()
        let consumed = await registry.consume(h1)
        XCTAssertNil(consumed)
    }

    func test_drop_removesEntry() async {
        let registry = PreparedIntentRegistry()
        let h1 = await registry.store(.init(button: AnyView(Text("a")), createdAt: Date()))
        await registry.drop(h1)
        let consumed = await registry.consume(h1)
        XCTAssertNil(consumed)
    }

    func test_expiredEntries_sweptOnNextStore() async {
        let registry = PreparedIntentRegistry(ttl: 0.05)
        let old = await registry.store(.init(button: AnyView(Text("a")), createdAt: Date().addingTimeInterval(-1)))
        try? await Task.sleep(nanoseconds: 100_000_000)
        _ = await registry.store(.init(button: AnyView(Text("b")), createdAt: Date()))
        let consumed = await registry.consume(old)
        XCTAssertNil(consumed, "expired entry should have been swept")
    }
}
