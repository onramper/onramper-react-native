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

    func toNSError() -> NSError {
        var userInfo: [String: Any] = [
            "code": jsCode,
            "message": self.errorDescription ?? "Unknown error",
            NSLocalizedDescriptionKey: self.errorDescription ?? "Unknown error",
        ]
        if let info = jsInfo { userInfo["info"] = info }
        return NSError(domain: "OnramperReactNative", code: 0, userInfo: userInfo)
    }
}

func mappingOnramperError<T>(_ block: () async throws -> T) async throws -> T {
    do {
        return try await block()
    } catch let e as OnramperError {
        throw e.toNSError()
    }
}
