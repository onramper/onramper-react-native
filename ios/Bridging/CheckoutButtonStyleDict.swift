#if canImport(UIKit)
import ExpoModulesCore
import SwiftUI
import OnramperSDK

struct CheckoutButtonStyleDict: Record {
    @Field var backgroundColor: String? = nil
    @Field var foregroundColor: String? = nil
    @Field var borderRadius: Double? = nil

    func toSwift() -> CheckoutButtonStyle {
        var style = CheckoutButtonStyle()
        if let hex = backgroundColor, let color = Color(hex: hex) { style.backgroundColor = color }
        if let hex = foregroundColor, let color = Color(hex: hex) { style.foregroundColor = color }
        if let r = borderRadius { style.borderRadius = CGFloat(r) }
        return style
    }
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
