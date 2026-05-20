import Foundation
import OnramperSDK

extension OnramperState {
    func toJSDict() -> [String: Any] {
        switch self {
        case .idle: return ["kind": "idle"]
        case .initializing: return ["kind": "initializing"]
        case .ready: return ["kind": "ready"]
        case .checkoutPreparing: return ["kind": "checkoutPreparing"]
        case .requireLogin(let requirements):
            return ["kind": "requireLogin", "requirements": codableToJSArray(requirements)]
        case .authenticating: return ["kind": "authenticating"]
        case .readyToCheckout: return ["kind": "readyToCheckout"]
        case .finalizing: return ["kind": "finalizing"]
        case .rendering(let ctx):
            return [
                "kind": "rendering",
                "url": ctx.url.absoluteString,
                "renderType": ctx.renderType.jsValue,
                "paymentType": ctx.paymentType.jsValue,
            ]
        case .completed: return ["kind": "completed"]
        case .failed(let error):
            var info: [String: Any] = [
                "code": error.jsCode,
                "message": error.errorDescription ?? "",
            ]
            if let extra = error.jsInfo { info["info"] = extra }
            return ["kind": "failed", "error": info]
        }
    }
}

extension RenderType {
    var jsValue: String { rawValue }   // "webview" | "deeplink"
}

extension CheckoutPaymentType {
    var jsValue: String { rawValue }   // "applepay" | "revolutpay"
}

/// Encode any `Codable` value into a JSON-compatible `[String: Any]` or `[Any]`
/// so it can ride through Expo Modules to JS unchanged.
func codableToJSValue<T: Codable>(_ value: T) -> Any {
    guard let data = try? JSONEncoder().encode(value),
          let obj = try? JSONSerialization.jsonObject(with: data) else {
        return [:]
    }
    return obj
}

func codableToJSArray<T: Codable>(_ values: [T]) -> [Any] {
    (codableToJSValue(values) as? [Any]) ?? []
}
