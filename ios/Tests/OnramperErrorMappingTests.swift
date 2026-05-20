import XCTest
@testable import OnramperReactNative
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
            let nsError = error.toNSError()
            XCTAssertEqual(nsError.userInfo["code"] as? String, expectedCode, "case: \(error)")
            XCTAssertNotNil(nsError.userInfo["message"], "case: \(error)")
        }
    }

    func test_amountOutOfRange_carriesMinMaxInInfo() {
        let nsError = OnramperError.amountOutOfRange(min: 5, max: 50).toNSError()
        let info = nsError.userInfo["info"] as? [String: Double]
        XCTAssertEqual(info?["min"], 5)
        XCTAssertEqual(info?["max"], 50)
    }

    func test_networkError_carriesStatusInInfo() {
        let nsError = OnramperError.networkError(code: 503, message: "x").toNSError()
        let info = nsError.userInfo["info"] as? [String: Any]
        XCTAssertEqual(info?["status"] as? Int, 503)
    }
}
