import ExpoModulesCore
import Foundation
import OnramperSDK

extension OnramperError {
    var jsCode: String {
        switch self {
        case .notInitialized: return "notInitialized"
        case .initializationFailed: return "initializationFailed"
        case .attestationFailed: return "attestationFailed"
        case .invalidStateTransition: return "invalidStateTransition"
        case .invalidState: return "invalidState"
        case .networkError: return "networkError"
        case .decodingError: return "decodingError"
        case .timeout: return "timeout"
        case .requirementNotSatisfied: return "requirementNotSatisfied"
        case .amountOutOfRange: return "amountOutOfRange"
        case .oidcFlowCancelled: return "oidcFlowCancelled"
        case .oidcTokenExchangeFailed: return "oidcTokenExchangeFailed"
        case .oidcFlowFailed: return "oidcFlowFailed"
        case .userTokenInvalid: return "userTokenInvalid"
        case .userTokenRefreshFailed: return "userTokenRefreshFailed"
        case .webviewLoadFailed: return "webviewLoadFailed"
        case .deepLinkFailed: return "deepLinkFailed"
        case .invalidRequest: return "invalidRequest"
        case .quoteUnavailable: return "quoteUnavailable"
        case .checkoutForbidden: return "checkoutForbidden"
        case .temporaryFailure: return "temporaryFailure"
        case .unrecoverable: return "unrecoverable"
        case .configurationError: return "configurationError"
        case .deviceBlocked: return "deviceBlocked"
        case .securityStorageFailed: return "securityStorageFailed"
        }
    }

    var jsInfo: [String: Any]? {
        switch self {
        case .amountOutOfRange(let min, let max):
            return ["min": min, "max": max]
        case .networkError(let code, _):
            return ["status": code]
        case .securityStorageFailed(let status):
            return ["status": Int(status)]
        case .invalidStateTransition(let from, let to):
            return ["from": from, "to": to]
        case .invalidState(let expected, let actual):
            return ["expected": expected, "actual": actual]
        case .invalidRequest(let field, let debugInfo):
            var info: [String: Any] = [:]
            if let field { info["field"] = field }
            if let debugInfo { info["debugInfo"] = debugInfo }
            return info.isEmpty ? nil : info
        case .temporaryFailure(let retryAfter, let debugInfo):
            var info: [String: Any] = [:]
            if let retryAfter { info["retryAfter"] = retryAfter }
            if let debugInfo { info["debugInfo"] = debugInfo }
            return info.isEmpty ? nil : info
        case .quoteUnavailable(let debugInfo),
             .checkoutForbidden(let debugInfo),
             .unrecoverable(let debugInfo):
            return debugInfo.map { ["debugInfo": $0] }
        default:
            return nil
        }
    }

    /// Build the JS-facing message: the SDK's human-readable
    /// `errorDescription` plus a `[info: <json>]` suffix when there's
    /// structured detail (debugInfo, status code, min/max, etc.).
    ///
    /// Expo Modules SDK 56's `JavaScriptThrowable` only bridges `message` and
    /// `code` to JS — raw `NSError.userInfo` entries are dropped. Folding
    /// the detail into the message text is the supported way to carry it
    /// across without losing it.
    func toJSMessage() -> String {
        let base = self.errorDescription ?? "Unknown error"
        guard let info = jsInfo, !info.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: info),
              let json = String(data: data, encoding: .utf8) else {
            return base
        }
        return "\(base) [info: \(json)]"
    }
}

func mappingOnramperError<T>(_ block: () async throws -> T) async throws -> T {
    do {
        return try await block()
    } catch let e as OnramperError {
        // Expo's bridge preserves Exception.code as JS `err.code` and
        // Exception.description as JS `err.message`. NSError userInfo is
        // dropped, so we fold any structured info into the message text via
        // toJSMessage() and recover it on the JS side.
        throw Exception(name: "OnramperError", description: e.toJSMessage(), code: e.jsCode)
    }
}
