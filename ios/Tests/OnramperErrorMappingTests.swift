import XCTest
@testable internal import OnramperReactNative
import OnramperSDK

final class OnramperErrorMappingTests: XCTestCase {
    func test_everyCase_mapsToTypedJSCode() {
        let cases: [(OnramperError, String)] = [
            (.notInitialized, "notInitialized"),
            (.initializationFailed("x"), "initializationFailed"),
            (.attestationFailed("x"), "attestationFailed"),
            (.invalidStateTransition(from: "a", to: "b"), "invalidStateTransition"),
            (.invalidState(expected: "a", actual: "b"), "invalidState"),
            (.networkError(code: 500, message: "boom"), "networkError"),
            (.decodingError("x"), "decodingError"),
            (.timeout, "timeout"),
            (.requirementNotSatisfied("x"), "requirementNotSatisfied"),
            (.amountOutOfRange(min: 10, max: 1000), "amountOutOfRange"),
            (.oidcFlowCancelled, "oidcFlowCancelled"),
            (.oidcTokenExchangeFailed("x"), "oidcTokenExchangeFailed"),
            (.oidcFlowFailed("x"), "oidcFlowFailed"),
            (.userTokenInvalid, "userTokenInvalid"),
            (.userTokenRefreshFailed("x"), "userTokenRefreshFailed"),
            (.webviewLoadFailed("x"), "webviewLoadFailed"),
            (.deepLinkFailed("x"), "deepLinkFailed"),
            (.invalidRequest(field: "amount", debugInfo: nil), "invalidRequest"),
            (.quoteUnavailable(debugInfo: nil), "quoteUnavailable"),
            (.checkoutForbidden(debugInfo: nil), "checkoutForbidden"),
            (.temporaryFailure(retryAfter: nil, debugInfo: nil), "temporaryFailure"),
            (.unrecoverable(debugInfo: nil), "unrecoverable"),
            (.configurationError(reason: "x"), "configurationError"),
            (.deviceBlocked, "deviceBlocked"),
            (.securityStorageFailed(status: -25300), "securityStorageFailed"),
        ]

        for (error, expectedCode) in cases {
            XCTAssertEqual(error.jsCode, expectedCode, "case: \(error)")
            XCTAssertFalse(error.toJSMessage().isEmpty, "case: \(error)")
        }
    }

    func test_amountOutOfRange_carriesMinMaxInMessage() {
        let msg = OnramperError.amountOutOfRange(min: 5, max: 50).toJSMessage()
        XCTAssertTrue(msg.contains("\"min\":5"), "got: \(msg)")
        XCTAssertTrue(msg.contains("\"max\":50"), "got: \(msg)")
    }

    func test_networkError_carriesStatusInMessage() {
        let msg = OnramperError.networkError(code: 503, message: "x").toJSMessage()
        XCTAssertTrue(msg.contains("\"status\":503"), "got: \(msg)")
    }
}
