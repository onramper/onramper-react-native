#if canImport(UIKit)
import Foundation
import OnramperSDK
import SwiftUI

// Decodes the flat JS CheckoutRequest / CheckoutButtonStyle JSON into the SDK's
// nested request + styled button config. (The SDK's OnramperTransactionData.init
// lowercases ISO codes, so we construct via inits rather than Codable-decoding
// straight into CheckoutIntentRequest.)

private struct CheckoutRequestJSON: Decodable {
  let source: String
  // Required — the SDK can't price a trade without it. Decoding throws (→
  // invalidRequest) if absent; the TS `CheckoutRequest.destination` guarantees it.
  let destination: String
  let amount: Double
  let type: String
  let country: String?
  let subdivision: String?
  let paymentMethod: String
  let wallet: WalletJSON
  let onlyOnramps: [String]?

  struct WalletJSON: Decodable {
    let network: String
    let address: String
    let memo: String?
  }
}

func decodeCheckoutRequest(_ json: String) throws -> CheckoutIntentRequest {
  guard let data = json.data(using: .utf8) else {
    throw OnramperError.invalidRequest(field: nil, debugInfo: "request JSON not UTF-8")
  }
  do {
    let r = try JSONDecoder().decode(CheckoutRequestJSON.self, from: data)
    let txData = OnramperTransactionData(
      source: r.source,
      destination: r.destination,
      amount: r.amount,
      type: r.type == "sell" ? .sell : .buy,
      country: r.country,
      subdivision: r.subdivision,
      paymentMethod: r.paymentMethod,
      wallet: WalletInfo(network: r.wallet.network, address: r.wallet.address, memo: r.wallet.memo)
    )
    return CheckoutIntentRequest(onramperTransactionData: txData, onlyOnramps: r.onlyOnramps)
  } catch {
    throw OnramperError.invalidRequest(field: nil, debugInfo: "request decode failed: \(error)")
  }
}

private struct UserPrefillJSON: Decodable {
  let email: String?
  let firstName: String?
  let lastName: String?
  let phoneNumber: String?
}

/// Decodes the JS `OnramperUserPrefill` JSON, or `nil` when the caller supplied
/// nothing (`{}`) or the payload is unusable.
///
/// Never throws. Prefill is best-effort on the SDK side and must never fail a
/// checkout that would otherwise succeed, so a malformed payload degrades to
/// "no prefill" rather than surfacing an error. `nil` for an all-empty payload
/// also spares a token mint the server is guaranteed to reject
/// (`no_fields_supplied`) — the SDK's own `hasAnyValue` check.
///
/// Only nil-ness is checked. Present-but-invalid values (a malformed phone
/// number, say) are passed through to the server, which is authoritative;
/// mirroring its validation here would drift the moment either side changed.
func decodeUserPrefill(_ json: String) -> OnramperUserPrefill? {
  guard let data = json.data(using: .utf8),
        let p = try? JSONDecoder().decode(UserPrefillJSON.self, from: data) else {
    return nil
  }
  let prefill = OnramperUserPrefill(
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    phoneNumber: p.phoneNumber
  )
  return prefill == OnramperUserPrefill() ? nil : prefill
}

private struct CheckoutButtonStyleJSON: Decodable {
  let backgroundColor: String?
  let foregroundColor: String?
  let borderRadius: Double?
}

func decodeCheckoutButtonStyle(_ json: String) -> CheckoutButtonStyle {
  var style = CheckoutButtonStyle()
  guard let data = json.data(using: .utf8),
        let s = try? JSONDecoder().decode(CheckoutButtonStyleJSON.self, from: data) else {
    return style
  }
  if let hex = s.backgroundColor, let color = Color(hex: hex) { style.backgroundColor = color }
  if let hex = s.foregroundColor, let color = Color(hex: hex) { style.foregroundColor = color }
  if let radius = s.borderRadius { style.borderRadius = CGFloat(radius) }
  return style
}

extension Color {
  init?(hex: String) {
    let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard s.count == 6 || s.count == 8, let value = UInt64(s, radix: 16) else { return nil }
    let r, g, b, a: Double
    if s.count == 6 {
      r = Double((value >> 16) & 0xFF) / 255
      g = Double((value >> 8) & 0xFF) / 255
      b = Double(value & 0xFF) / 255
      a = 1
    } else {
      r = Double((value >> 24) & 0xFF) / 255
      g = Double((value >> 16) & 0xFF) / 255
      b = Double((value >> 8) & 0xFF) / 255
      a = Double(value & 0xFF) / 255
    }
    self = Color(.sRGB, red: r, green: g, blue: b, opacity: a)
  }
}
#endif
