import XCTest
@testable internal import OnramperReactNative
import OnramperSDK

// Pins the JS -> SDK contract for `OnramperUserPrefill`. Prefill is best-effort
// on the SDK side: it must never fail a checkout that would otherwise succeed,
// so every unusable input has to degrade to `nil` rather than throw.
final class UserPrefillDecodingTests: XCTestCase {

    func test_fullPayload_decodesEveryField() {
        let json = """
        {"email":"ada@example.com","firstName":"Ada","lastName":"Lovelace","phoneNumber":"+3712345678"}
        """
        let prefill = decodeUserPrefill(json)

        XCTAssertEqual(prefill?.email, "ada@example.com")
        XCTAssertEqual(prefill?.firstName, "Ada")
        XCTAssertEqual(prefill?.lastName, "Lovelace")
        XCTAssertEqual(prefill?.phoneNumber, "+3712345678")
    }

    func test_partialPayload_leavesUnsuppliedFieldsNil() {
        // Names only — the shape the example apps send by default, since `email`
        // is the binding identity and a wrong guess drops the whole prefill.
        let prefill = decodeUserPrefill(#"{"firstName":"Ada","lastName":"Lovelace"}"#)

        XCTAssertEqual(prefill?.firstName, "Ada")
        XCTAssertEqual(prefill?.lastName, "Lovelace")
        XCTAssertNil(prefill?.email)
        XCTAssertNil(prefill?.phoneNumber)
    }

    func test_emailOnly_isValid() {
        let prefill = decodeUserPrefill(#"{"email":"ada@example.com"}"#)

        XCTAssertEqual(prefill?.email, "ada@example.com")
        XCTAssertNil(prefill?.firstName)
    }

    func test_emptyObject_decodesToNil() {
        // What the JS layer sends when the caller supplied no prefill. Returning
        // nil skips a token mint the server would reject (`no_fields_supplied`).
        XCTAssertNil(decodeUserPrefill("{}"))
    }

    func test_nullFields_decodeToNil() {
        XCTAssertNil(decodeUserPrefill(#"{"email":null,"firstName":null,"lastName":null,"phoneNumber":null}"#))
    }

    func test_malformedJSON_decodesToNilWithoutThrowing() {
        XCTAssertNil(decodeUserPrefill("not json"))
        XCTAssertNil(decodeUserPrefill(""))
        XCTAssertNil(decodeUserPrefill("[]"))
    }

    func test_wrongFieldTypes_decodeToNil() {
        // A number where a string belongs fails the whole decode; prefill is
        // skipped rather than partially applied.
        XCTAssertNil(decodeUserPrefill(#"{"firstName":42}"#))
    }

    func test_presentButInvalidValues_arePassedThroughToTheServer() {
        // The server is authoritative on format. Mirroring its regexes here
        // would drift, so a blank name or a malformed phone still crosses.
        let prefill = decodeUserPrefill(#"{"firstName":"","phoneNumber":"nonsense"}"#)

        XCTAssertEqual(prefill?.firstName, "")
        XCTAssertEqual(prefill?.phoneNumber, "nonsense")
    }
}
